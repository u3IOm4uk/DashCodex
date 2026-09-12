/**
 * @fileoverview Модуль для роботи з базою даних. Вибірка та оновлення даних.
 * @version 1.0.4 
 * @dependencies xlsx.js, dexie.js
 */
class Models {
    /**
     * Екземпляр бази даних Dexie.
     * Ініціалізується як `undefined` і набуває значення після виклику `new Dexie()`.
     * 
     * @type {Dexie|undefined}
     */
    db = undefined;
    /**
     * Робота з indexedDB, вибірка та підготовка даних для відображення.
     * 
     * @param {Object} db - об'єкт бази даних створений dexie.js
     */
    constructor(db) {
        // set configs
        //TODO: переробити звернення this.dbModels = Data.global.dbModels на пряме. (ЧИСТКА КОДУ)
        this.dbVersion = Data.global.dbVersion;
        this.dbModels = Data.global.dbModels;
        this.dbModelsOpt = Data.global.dbModelsOpt;
        this.dbModelsPrimaries = Data.global.dbModelsPrimaries;
        this.xlsSheets = Data.global.xlsSheets;
        // DB init
        if (!db && !this.db) {
            // check presets
            console.error('Model: No db presets. ', 'param: ', db, 'Model.db: ', this.db);
        } else {
            // dexie DB initialisation
            this.db = db;
            /// db init
            this.db.version(this.dbVersion).stores(this.getDexieStores());
            /*this.db.open()
                .then(() => console.log("Models: Базу даних успішно створено/відкрито!"))
                .catch(err => console.error("Models: Помилка відкриття БД:", err));*/
        }

        this.init();
    }
    //TODO: Models.init description
    init() {

    }

    //=============================
    // Pages
    //=============================
    /**
     * Збір та агрегація даних для Головного Дашборду (Таблиця ГОЧ)
     * @param {Object} filter - Об'єкт із датами { from, to }
     * @returns {Promise<DashBoardViewModel>}
     */

    async pageDashBoard(filter) {
        const from = (filter && filter.from) || new Date();
        const to = (filter && filter.to) || new Date();
        let { activeCategory = 'Обстріли' } = filter;

        const datesToFetch = this.getDatesInRange(from, to);
        const rawData = await this.getEventByDate(datesToFetch, 'ГОЧ');
        const actData = await this.getEventByDate(datesToFetch, 'Застосування БК та FPV');

        const warDay = Models.getWarDay();
        let datesToChart = datesToFetch.map(d => Models.getDateFormat(d, 'apex'));
        const chartReg = {};

        const getNum = (row, key) => (row && parseInt(row[key])) || 0;

        const getFlexibleRatio = (n1, n2) => {
            if (n1 === 0 || n2 === 0) return "- : -";
            return n1 >= n2
                ? `${(n1 / n2).toFixed(1).replace('.', ',')} : 1`
                : `1 : ${(n2 / n1).toFixed(1).replace('.', ',')}`;
        };

        // Хелпер для отримання суми по категорії (підтримує масив ключів у базі)
        const getRowCatSum = (row, catKey) => {
            const dbKeys = Data.global.categoriesByKey[catKey];
            if (Array.isArray(dbKeys)) {
                return dbKeys.reduce((sum, key) => sum + getNum(row, key), 0);
            }
            return getNum(row, dbKeys);
        };

        // ----------------------------------------------------
        // КРОК 1. Ініціалізація структур для збору за ієрархією: День -> Юніт -> Категорія
        // ----------------------------------------------------
        // Створюємо карту щоденних даних для кожного дозволеного юніта
        // Структура: Date -> UnitKey -> CategoryKey -> Значення (число)
        const hierarchyMap = new Map();

        datesToFetch.forEach(date => {
            const unitsMap = new Map();
            Data.global.units.forEach(unitKey => {
                const catMap = new Map();
                Data.global.categories.forEach(catKey => {
                    catMap.set(catKey, 0);
                });
                unitsMap.set(unitKey, catMap);
            });
            hierarchyMap.set(date, unitsMap);
        });

        // ----------------------------------------------------
        // КРОК 2. Агрегація даних знизу вгору (Squad / Unit -> hierarchyMap)
        // ----------------------------------------------------
        datesToFetch.forEach(date => {
            const dayUnitsMap = hierarchyMap.get(date);

            // Фільтруємо сирі рядки бази за поточну дату
            const dayRows = rawData.filter(row => row && row['Дата'] === date);

            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;

                const targetUnitCats = dayUnitsMap.get(unitKey);

                Data.global.categories.forEach(catKey => {
                    let accumulatedSum = 0;

                    if (config.squad && config.squad.length > 0) {
                        // Якщо є squad — збираємо значення тільки з цих підрозділів
                        config.squad.forEach(squadName => {
                            const squadRow = dayRows.find(row => row['Угруповання'] === squadName);
                            if (squadRow) {
                                accumulatedSum += getRowCatSum(squadRow, catKey);
                            }
                        });
                    } else {
                        // Якщо squad немає — беремо чисте значення самого угруповання
                        const unitRow = dayRows.find(row => row['Угруповання'] === config.nameMd);
                        if (unitRow) {
                            accumulatedSum += getRowCatSum(unitRow, catKey);
                        }
                    }

                    targetUnitCats.set(catKey, accumulatedSum);
                });
            });
        });

        // ----------------------------------------------------
        // КРОК 3. Побудова масиву ПІДРОЗДІЛІВ/УГРУПОВАНЬ (unitsViewModel)
        // ----------------------------------------------------
        const unitModelName = 'units';
        const dbKeysActive = Data.global.categoriesByKey[activeCategory];
        const isMultiActive = Array.isArray(dbKeysActive);

        const unitsViewModel = Data.global.units.map(unitKey => {
            const config = Data.global.unitStructure[unitKey];
            if (!config) return null;

            // Збираємо фінальне значення та розбивки для відображення
            let totalValueForUnit = 0;
            let totalValueMulti = {};
            if (isMultiActive) dbKeysActive.forEach(k => totalValueMulti[k] = 0);

            // Для графіків підрозділів нам все одно потрібні сирі дані по днях
            let chart = isMultiActive ? Data.global.getChartBarMultiple() : Data.global.getChartBarOne();
            chart.series = [];

            // Агрегуємо загальне значення за весь вибраний період для картки юніта
            datesToFetch.forEach(date => {
                const dayValue = hierarchyMap.get(date).get(unitKey).get(activeCategory);
                totalValueForUnit += dayValue;

                // Якщо категорія складна (масив ключів), витягуємо сирі значення з бази для деталізації
                if (isMultiActive) {
                    const dayRows = rawData.filter(row => row && row['Дата'] === date);
                    const targets = config.squad && config.squad.length > 0 ? config.squad : [config.nameMd];

                    dayRows.forEach(row => {
                        if (targets.includes(row['Угруповання'])) {
                            dbKeysActive.forEach(k => {
                                totalValueMulti[k] += getNum(row, k);
                            });
                        }
                    });
                }
            });

            // Будуємо серії для внутрішніх графіків (xaxis: config.squad або config.nameMd)
            if (config.squad && config.squad.length > 0) {
                let chartSquadData = isMultiActive ? {} : [];
                if (isMultiActive) dbKeysActive.forEach(k => chartSquadData[k] = new Array(config.squad.length).fill(0));

                config.squad.forEach((squadName, sIdx) => {
                    let squadTotal = 0;
                    datesToFetch.forEach(date => {
                        const squadRow = rawData.find(row => row && row['Дата'] === date && row['Угруповання'] === squadName);
                        if (squadRow) {
                            if (isMultiActive) {
                                dbKeysActive.forEach(k => chartSquadData[k][sIdx] += getNum(squadRow, k));
                            } else {
                                squadTotal += getRowCatSum(squadRow, activeCategory);
                            }
                        }
                    });
                    if (!isMultiActive) chartSquadData.push(squadTotal);
                });

                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        let s = { name: Data.global.categoriesByTitle[k] || k, data: chartSquadData[k] };
                        if (Data.global.categoriesChartColor[k]) s.color = Data.global.categoriesChartColor[k];
                        chart.series.push(s);
                    });
                } else {
                    chart.series.push({
                        name: Data.global.categoriesByTitle[activeCategory] || activeCategory,
                        data: chartSquadData
                    });
                }
                chart.xaxis.categories = config.squad;
            } else {
                // Якщо підрозділів немає
                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        let s = { name: Data.global.categoriesByTitle[k] || k, data: [totalValueMulti[k]] };
                        if (Data.global.categoriesChartColor[k]) s.color = Data.global.categoriesChartColor[k];
                        chart.series.push(s);
                    });
                } else {
                    chart.series.push({ data: [totalValueForUnit] });
                }
                chart.xaxis.categories = [config.nameMd];
                chart.chart.height = 130;
            }

            chartReg[unitKey] = chart;

            let totalSumPerKeyA = [];
            if (isMultiActive) dbKeysActive.forEach(k => totalSumPerKeyA.push(totalValueMulti[k]));

            return {
                id: unitKey,
                unitName: config.nameMd,
                value: isMultiActive ? totalSumPerKeyA.join('/') : totalValueForUnit,
                valueSet: isMultiActive ? totalValueMulti : totalValueForUnit,
                cssClass: config.class,
                textDetail: Data.text.detail,
                tpl: 'block-detaile-info',
                chart: chart,
                chartOptName: unitKey
            };
        }).filter(Boolean);

        // ----------------------------------------------------
        // КРОК 4. Побудова масиву КАТЕГОРІЙ (categoriesViewModel)
        // ----------------------------------------------------
        const catModelName = 'categories';
        let totalRadar = 0;

        const categoriesViewModel = Data.global.categories.map((catKey, ind) => {
            // Рахуємо масив значень по днях на основі вже валідованих даних юнітів
            const dailyData = datesToFetch.map(date => {
                let daySum = 0;
                Data.global.units.forEach(unitKey => {
                    daySum += hierarchyMap.get(date).get(unitKey).get(catKey);
                });
                return daySum;
            });

            const totalSum = dailyData.reduce((acc, v) => acc + v, 0);
            if (catKey === activeCategory) totalRadar = totalSum;

            let chart = Data.global.getChartArea();
            chart.series = [{
                name: Data.global.categoriesByTitle[catKey] || catKey,
                data: dailyData
            }];
            if (Data.global.categoriesChartColor[catKey]) {
                chart.series[0].color = Data.global.categoriesChartColor[catKey];
            }
            chart.xaxis.categories = datesToChart;

            const renderId = `cat-${catKey.replace(/\//g, '_')}`;
            chartReg[renderId] = chart;

            return {
                id: renderId,
                ind: ind,
                category_key: catKey,
                category_name: Data.global.categoriesByTitle[catKey] || catKey,
                total_value: totalSum,
                textDetail: Data.text.detail,
                tpl: 'block-dynamic-info',
                cssClass: catKey === activeCategory ? 'active' : '',
                chart: chart,
                chartOptName: renderId
            };
        });

        // ==========================================
        // Збірка Радара
        // ==========================================
        let chartRadar = Data.global.getChartRadar();
        let chartRadarSeries = { data: [], name: activeCategory };
        chartRadar.series = [chartRadarSeries];
        chartRadar.xaxis.categories = [];

        unitsViewModel.forEach(unit => {
            chartRadarSeries.data.push(typeof unit.valueSet === 'object'
                ? Object.values(unit.valueSet).reduce((a, b) => a + b, 0)
                : unit.valueSet
            );
            chartRadar.xaxis.categories.push(unit.unitName);
        });

        chartReg['radar-distribution'] = chartRadar;
        unitsViewModel.push({
            id: 'radar-distribution',
            unitName: 'Розподіл',
            value: totalRadar,
            cssClass: 'radar-card',
            textDetail: Data.text.detail,
            tpl: 'block-detaile-info',
            chart: chartRadar,
            chartOptName: 'radar-distribution'
        });

        // ----------------------------------------------------
        // КРОК 5. Розрахунок СПІВВІДНОШЕНЬ (Втрати о/с також беремо з ієрархії валідних даних)
        // ----------------------------------------------------
        const correlationsViewModel = [];

        let bkSou = 0, bkEnemy = 0;
        actData.forEach(row => {
            bkSou += getNum(row, 'Наші_війська_BK') || getNum(row, 'Наші_війська_БК');
            bkEnemy += getNum(row, 'Противник_BK') || getNum(row, 'Противник_БК');
        });
        correlationsViewModel.push({
            id: 'corr-losses-amo',
            title: 'Витрати БК',
            souValue: bkSou,
            enemyValue: bkEnemy,
            ratioText: getFlexibleRatio(bkSou, bkEnemy),
            textDetail: Data.text.detail
        });

        // Втрати особового складу рахуємо виключно по відображених угрупованнях/squads
        let lossSou = 0, lossEnemy = 0;
        datesToFetch.forEach(date => {
            const dayRows = rawData.filter(row => row && row['Дата'] === date);
            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;
                const targets = config.squad && config.squad.length > 0 ? config.squad : [config.nameMd];

                dayRows.forEach(row => {
                    if (targets.includes(row['Угруповання'])) {
                        lossSou += getNum(row, 'Втрати_всього_рф');
                        lossEnemy += getNum(row, 'Втрати_всього_ЗСУ');
                    }
                });
            });
        });

        correlationsViewModel.push({
            id: 'corr-losses-unit',
            title: 'Втрати особового складу',
            souValue: lossSou,
            enemyValue: lossEnemy,
            ratioText: getFlexibleRatio(lossSou, lossEnemy),
            textDetail: Data.text.detail
        });

        let fpvStrikesSou = 0, fpvStrikesEnemy = 0;
        actData.forEach(row => {
            fpvStrikesSou += getNum(row, 'Наші_війська_FPV');
            fpvStrikesEnemy += getNum(row, 'Противник_FPV');
        });
        correlationsViewModel.push({
            id: 'corr-fpv',
            title: 'Застосування FPV',
            souValue: fpvStrikesSou,
            enemyValue: fpvStrikesEnemy,
            ratioText: getFlexibleRatio(fpvStrikesSou, fpvStrikesEnemy),
            textDetail: Data.text.detail
        });

        return {
            id: 'pageDashBoard',
            warDay: warDay,
            activeCategoryHeader: Data.global.categoriesByHeader[activeCategory] || Data.global.categoriesByTitle[activeCategory] || activeCategory,
            [catModelName]: categoriesViewModel,
            slideContent: [{
                id: 'slideContent',
                tpl: 'slide-content',
                carousel: [
                    { id: 'carusel-content-1', tpl: 'carousel-inner', active: 'active', [unitModelName]: unitsViewModel },
                    { id: 'carusel-content-1', tpl: 'carousel-inner', active: '', [unitModelName]: unitsViewModel },
                    { id: 'carusel-content-1', tpl: 'carousel-inner', active: '', [unitModelName]: unitsViewModel }
                ],
            }],
            correlations: correlationsViewModel,
            date: {
                from: Models.getDateFormat(from, 'input'),
                to: Models.getDateFormat(to, 'input')
            },
            dates: [{
                id: 'showDate',
                tplDate: (from.getTime() !== to.getTime()) ? 'date-period' : 'date-one',
                showDates: { from: Models.getDateFormat(from, 'text') || 'не вказано', to: Models.getDateFormat(to, 'text') || 'не вказано' },
            }],
            chartReg: chartReg
        };
    }


/*
    async pageDashBoard(filter) {
        *//*
          {
              // values
              showDates: {from:string, to:string},
              warDay: number,
              activeCategoryName: string,
              // tpls
              categories:[
                {
                    category_name: string,
                    textDetail: string,
                    total_value: number,
                    // активний елемент
                    tpl: block-dynamic-info
                }
              ],
              units:[
                {
                    unitName: string,
                    value: number, //total
                    textDetail: string,
                    tpl: block-detaile-info || block-radar-distribution
                }
              ],
              correlations:[
                {
                    title: string,
                    souValue: number,
                    enemyValue: number,
                    ratioText: string,
                    textDetail: string
                }
              ]
          }
         *//*
        // console.log('Models.pageDashBoard si here');
        
        const from = (filter && filter.from) || new Date();
        const to = (filter && filter.to) || new Date();
        let { activeCategory = 'Обстріли' } = filter;
        const activeCategoryKey = Data.global.categoriesByKey[activeCategory];
        // 1. Отримуємо масив дат та сирі дані з Dexie
        const datesToFetch = this.getDatesInRange(from, to);
        const rawData = await this.getEventByDate(datesToFetch,'ГОЧ');
        const actData = await this.getEventByDate(datesToFetch, 'Застосування БК та FPV');
        // console.log('actData: ', actData);
        // Початок повномасштабного вторгнення: 24.02.2022
        const warDay = Models.getWarDay();
        let datesToChart = [];
        datesToFetch.forEach(d => {
            datesToChart.push(Models.getDateFormat(d, 'apex'));
        });
        const chartReg = {}; // renderId: chartConfig{}
        // ----------------------------------------------------
        // Крок 1. Попередня фільтрація та агрегація даних
        // ----------------------------------------------------
        // Окремо виділяємо рядок загальних сум та рядки по угрупованням
        let totalRow = [];
        let squadRows = [];

        rawData.forEach(row => {
            const unit = row['Угруповання'];
            if (unit === "ВСЬОГО за СО:") {
                totalRow.push(row);
            } else {
                squadRows.push(row);
            }
        });
        // Validate db response
        let temp = [];
        datesToFetch.forEach(date => {
            let buf = false;
            totalRow.forEach(row => {
                if (row['Дата'] && row['Дата'] === date) {
                    temp.push(row);
                    buf = true;
                }
            });
            !buf && temp.push(null);
        });
        totalRow = temp;
        temp = [];
        datesToFetch.forEach(date => {
            let buf = false;
            squadRows.forEach(row => {
                if (row['Дата'] && row['Дата'] === date) {
                    temp.push(row);
                    buf = true;
                }
            });
            !buf && temp.push(null);
        });
        squadRows = temp;
        temp = [];
        // console.log('Масив даних: ',rawData);
        // console.log('рядки тотал: ', totalRow);
        // console.log('рядки за підрозділи', squadRows);

        // Хелпер для безпечного отримання числа з рядка даних
        const getNum = (row, key) => {
            if (!row) return 0;
            return parseInt(row[key]) || 0;
        };

        // Хелпер для отримання значення за категорією (підтримує як один ключ, так і масив ключів)
        const getValueByCategory = (row, categoryKey, returnPerKey = false) => {
            const dbKeys = Data.global.categoriesByKey[categoryKey];
            if (returnPerKey && Array.isArray(dbKeys)) {
                const totalPerKey = {};
                dbKeys.forEach(key => {
                    totalPerKey[key] = getNum(row, key);
                });
                return totalPerKey;
            }
            if (Array.isArray(dbKeys)) {
                return dbKeys.reduce((sum, key) => sum + getNum(row, key), 0);
            }
            return getNum(row, dbKeys);
        };

        const getFlexibleRatio = (n1, n2) => {
            // Якщо хоча б одне з чисел дорівнює 0 — виводимо "- : -"
            if (n1 === 0 || n2 === 0) {
                return "- : -";
            }

            if (n1 >= n2) {
                // Ділимо більше на менше, округлюємо і міняємо крапку на кому
                const coef = (n1 / n2).toFixed(1).replace('.', ',');
                return `${coef} : 1`;
            } else {
                const coef = (n2 / n1).toFixed(1).replace('.', ',');
                return `1 : ${coef}`;
            }
        };

        let totalRadar = 0;
        // ----------------------------------------------------
        // Крок 2. Побудова масиву КАТЕГОРІЙ (categories)
        // ----------------------------------------------------
        const catModelName = 'categories';
        const categoriesViewModel = Data.global.categories.map((catKey, ind) => {
            let totalSum = 0;
            let totalSumPerKey = {};
            let totalSumPerKeyA = [];
            let chart = Data.global.getChartArea();
            const dbKeys = Data.global.categoriesByKey[catKey];
            chart.series = [];
            let chT = [];
            totalRow.forEach(row => {
                if (Array.isArray(dbKeys)) {
                    dbKeys.forEach(key => {
                        if (!Object.hasOwn(totalSumPerKey, key)) {
                            totalSumPerKey[key] = 0;
                            let s = {
                                name: Data.global.categoriesByTitle[key] || key,
                                data: []
                            };
                            Data.global.categoriesChartColor[key] && (s.color = Data.global.categoriesChartColor[key]);
                            chart.series.push(s);
                        }
                        for (let i = 0; i < chart.series.length; i++) {
                            (chart.series[i].name === Data.global.categoriesByTitle[key]
                                && chart.series[i].data.push(getNum(row, key)))
                        }
                        totalSumPerKey[key] += getNum(row, key);
                        totalSum += getNum(row, key);
                    });
                } else {
                    let t = getValueByCategory(row, catKey);
                    totalSum += t;
                    chT.push(t);
                    
                }
            });
            if (Array.isArray(dbKeys)) {
                dbKeys.forEach(key => {
                    totalSumPerKeyA.push(totalSumPerKey[key] || 0)
                });
            } else {
                let s = {
                    name: Data.global.categoriesByTitle[catKey],
                    data: chT
                };
                Data.global.categoriesChartColor[catKey] && (s.color = Data.global.categoriesChartColor[catKey]);
                // побудова конфігу для chart
                chart.series.push(s);
            }
            chart.xaxis.categories = datesToChart;
            // chart.xaxis.tickAmount = datesToChart.length;
            catKey === activeCategory && (totalRadar = totalSum);
            console.dir(chart);
            chartReg[`cat-${catKey.replace(/\//g, '_')}`] = chart; //TODO: подумати може тут краще Map?
            return {
                id: `cat-${catKey.replace(/\//g, '_')}`, // Унікальний ID для dataset.opt
                ind: ind,
                category_key: catKey,
                category_name: Data.global.categoriesByTitle[catKey] || catKey,
                total_value: (Array.isArray(dbKeys) && totalSumPerKeyA.join('/')) || totalSum,
                textDetail: Data.text.detail,
                tpl: 'block-dynamic-info',
                cssClass: catKey === activeCategory ? 'active' : '', // Клас активності категорії
                chart: chart,
                chartOptName: `cat-${catKey.replace(/\//g, '_')}`
                // TODO: треба зробити конфіг для вибору типу графіку на units і на категорії індивідуально
            };
        });

        // ----------------------------------------------------
        // Крок 3. Побудова масиву ПІДРОЗДІЛІВ/УГРУПОВАНЬ (units)
        // ----------------------------------------------------
        const unitModelName = 'units';
        const unitsViewModel = Data.global.units.map(unitKey => {
            const config = Data.global.unitStructure[unitKey];
            const dbKeys = Data.global.categoriesByKey[activeCategory];
            
            if (!config) return null;

            let totalValueForUnit = 0;
            let totalValueMulti = {};
            let totalSumPerKeyA = [];
            let chart = (Array.isArray(dbKeys) && Data.global.getChartBarMultiple()) || Data.global.getChartBarOne();
            chart.series = [];
            
            squadRows.forEach((row) => {
                if (row === null || config.nameMd === row['Угруповання']) {
                    if (Array.isArray(dbKeys)) {
                        dbKeys.forEach(cat => {
                            if (!Object.hasOwn(totalValueMulti, cat)) {
                                totalValueMulti[cat] = 0;
                            }
                            if (row === null) {
                                return;
                            }
                            totalValueMulti[cat] += getNum(row, cat);
                        });
                    } else {
                        if (row === null) {
                            return;
                        }
                        totalValueForUnit += getValueByCategory(row, activeCategory);
                    }
                }
            });
            // console.log('totalValueMulti: ', totalValueMulti, 'totalValueForUnit: ',totalValueForUnit)
            if (Array.isArray(dbKeys)) {
                dbKeys.forEach(key => {
                    totalSumPerKeyA.push(totalValueMulti[key] || 0); // якщо ніякі рядки з бази не прийшли то записати 0
                });
            }
            // Якщо угруповання має підрозділи (squad), сумуємо їхні значення по активній категорії
            let chartSquad = [];
            let chartSquadMulti = {};
            
            if (config.squad && config.squad.length > 0) {
                if (Array.isArray(dbKeys)) {
                    dbKeys.forEach(cat => {
                        chartSquadMulti[cat] = [];
                    });
                }
                config.squad.map(squadName => {
                    let squadTotal = 0;
                    let squadTotalM = {};
                    if (Array.isArray(dbKeys)) {
                        dbKeys.forEach(cat => { squadTotalM[cat] = 0; });
                    }
                    squadRows.forEach(row => {
                        if (row === null || squadName === row['Угруповання']) {
                            if (Array.isArray(dbKeys)) {
                                dbKeys.forEach(cat => {
                                    if (row === null) {
                                        return;
                                    }
                                    const val = parseInt(row[cat]) || 0;
                                    squadTotalM[cat] += val;
                                });
                            } else {
                                if (row === null) {
                                    return;
                                }
                                const val = parseInt(row[activeCategoryKey]) || 0;
                                squadTotal += val;
                            }
                        }
                    });
                    if (Array.isArray(dbKeys)) {
                        // Записуємо підраховані суми у відповідні масиви категорій
                        dbKeys.forEach(cat => {
                            chartSquadMulti[cat].push(squadTotalM[cat]);
                        });
                    } else {
                        // Записуємо суму в загальний масив
                        chartSquad.push(squadTotal);
                    }
                });

                if (Array.isArray(dbKeys)) {
                    // Формат: [ { name: 'АУ', data: [...] }, { name: 'КАБ', data: [...] }, ... ]
                    dbKeys.forEach(cat => {
                        let s = {
                            name: Data.global.categoriesByTitle[cat] || cat, // додаємо ім'я для легенди графіка
                            data: chartSquadMulti[cat],
                        };
                        Data.global.categoriesChartColor[cat] && (s.color = Data.global.categoriesChartColor[cat]);
                        chart.series.push(s);
                        
                    });
                } else {
                    // Формат для однієї серії: [ { name: 'Всього', data: totals[] } ]
                    chart.series.push({
                        name: Data.global.categoriesByTitle[activeCategory] || activeCategory,
                        data: chartSquad
                    });
                }
                chart.xaxis.categories = config.squad;
                // console.log('Сформований chart.series: ', unitKey, chart.series);
            } else {
                // Якщо угруповання НЕ має складових totalSumPerKeyA
                if (Array.isArray(dbKeys)) {
                    dbKeys.forEach(cat => {
                        let s = {
                            name: Data.global.categoriesByTitle[cat] || cat,
                            data: [totalValueMulti[cat] || 0] // якщо ніякі рядки з бази не прийшли то записати 0
                        };
                        Data.global.categoriesChartColor[cat] && (s.color = Data.global.categoriesChartColor[cat]);
                        chart.series.push(s);
                    });
                } else {
                    chart.series.push({ data: [totalValueForUnit || 0] }); // якщо ніякі рядки з бази не прийшли то записати 0
                }
                chart.xaxis.categories = [config.nameMd];
                chart.chart.height = 130;
                // chart.legend.position = 'bottom';
            }
            // console.log('totalValueForUnit: ', totalValueMulti, totalValueForUnit, config.nameMd, config.class )
            chartReg[unitKey] = chart;
            return {
                id: unitKey,
                unitName: config.nameMd,
                value: (Array.isArray(dbKeys) && totalSumPerKeyA.join('/')) || totalValueForUnit || 0, // якщо ніякі рядки з бази не прийшли то записати 0
                valueSet: (Array.isArray(dbKeys) && totalValueMulti) || totalValueForUnit || 0, // якщо ніякі рядки з бази не прийшли то записати 0
                cssClass: config.class,
                textDetail: Data.text.detail,
                tpl: 'block-detaile-info', // Стандартний шаблон підрозділу
                chart: chart,
                chartOptName: unitKey
            };
        }).filter(Boolean);
        
        //================
        // Radar in units
        //================
        // Додаємо службову картку Радара "Розподіл" відповідно до вашої логіки вкладення шаблонів Views 2.1
        const dbKeysRadar = Data.global.categoriesByKey[activeCategory];
        let chartRadar = Data.global.getChartRadar();
        let chartRadarSeries = { data: [], name: '' };
        let chartRadarM = {}; // {cat:[unit.v, ...]}
        chartRadar.series = [];
        chartRadar.xaxis.categories = [];
        unitsViewModel.forEach(unit => {
            if (Array.isArray(dbKeysRadar)) {
                dbKeysRadar.forEach(cat => {
                    if (!Object.hasOwn(chartRadarM, cat)) {
                        chartRadarM[cat] = [];
                    }
                    // unit.valueSet == {catName: unitVal}
                    chartRadarM[cat].push(unit.valueSet[cat]);
                })
            } else {
                chartRadarSeries.name = activeCategory;
                chartRadarSeries.data.push(unit.valueSet);
            }
            chartRadar.xaxis.categories.push(unit.unitName);
        });
        if (Array.isArray(dbKeysRadar)) {
            // Формат: [ { name: 'АУ', data: [...] }, { name: 'КАБ', data: [...] }, ... ]
            dbKeysRadar.forEach(cat => {
                let s = {
                    name: Data.global.categoriesByTitle[cat] || cat, // додаємо ім'я для легенди графіка
                    data: chartRadarM[cat]
                };
                Data.global.categoriesChartColor[cat] && (s.color = Data.global.categoriesChartColor[cat]);
                chartRadar.series.push(s);
            });
        } else {
            // Формат для однієї серії: [ { name: 'Всього', data: totals[] } ]
            chartRadar.series.push(chartRadarSeries);
        }
        chartReg['radar-distribution'] = chartRadar;
        unitsViewModel.push({
            id: 'radar-distribution',
            unitName: 'Розподіл',
            value: totalRadar, // Для радара загальне значення вираховується графіком
            cssClass: 'radar-card',
            textDetail: Data.text.detail,
            tpl: 'block-detaile-info', //'block-radar-distribution' // Динамічно завантажить шаблон з ApexCharts Radar
            chart: chartRadar,
            chartOptName: 'radar-distribution'
        });
        // console.log('unitsViewModel: ', unitsViewModel);

        // ----------------------------------------------------
        // Крок 4. Побудова масиву СПІВВІДНОШЕНЬ (correlations)
        // ----------------------------------------------------
        const correlationsViewModel = [];

        // співвідношення для Витрати БК
        let bkSou = 0;
        let bkEnemy = 0;
        actData.forEach(row => {
            row['Наші_війська_БК'] && (bkSou += (parseInt(row['Наші_війська_БК']) || 0));
            row['Противник_БК'] && (bkEnemy += (parseInt(row['Противник_БК']) || 0));
        });
        const bkTotal = bkSou + bkEnemy;
        const bkRatioText = getFlexibleRatio(bkSou, bkEnemy);
        correlationsViewModel.push({
            id: 'corr-losses-amo',
            title: 'Витрати БК',
            souValue: bkSou,
            enemyValue: bkEnemy,
            ratioText: bkRatioText,
            textDetail: Data.text.detail
        });

        // співвідношення для Втрат о/с
        let lossSou = 0;
        let lossEnemy = 0;
        totalRow.forEach(row => {
            lossSou += getNum(row, 'Втрати_всього_рф') ;
            lossEnemy += getNum(row, 'Втрати_всього_ЗСУ');
        });
        const lossTotal = lossSou + lossEnemy;
        const lossRatioText = getFlexibleRatio(lossSou, lossEnemy);

        correlationsViewModel.push({
            id: 'corr-losses-unit',
            title: 'Втрати особового складу',
            souValue: lossSou,
            enemyValue: lossEnemy,
            ratioText: lossRatioText,
            textDetail: Data.text.detail
        });

        // співвідношення БпС
        let fpvStrikesSou = 0;
        let fpvStrikesEnemy = 0;
        actData.forEach(row => {
            fpvStrikesSou += getNum(row, 'Наші_війська_FPV');
            fpvStrikesEnemy += getNum(row, 'Противник_FPV');
        });
        const uavRatioText = getFlexibleRatio(fpvStrikesSou, fpvStrikesEnemy);

        correlationsViewModel.push({
            id: 'corr-fpv',
            title: 'Застосування FPV',
            souValue: fpvStrikesSou,
            enemyValue: fpvStrikesEnemy,
            ratioText: uavRatioText,
            textDetail: Data.text.detail
        });

        // ----------------------------------------------------
        // Крок 5. Складання та повернення результату (ViewModel)
        // ----------------------------------------------------
        return {
            id: 'pageDashBoard',
            warDay: warDay,
            activeCategoryHeader: Data.global.categoriesByHeader[activeCategory] || Data.global.categoriesByTitle[activeCategory] || activeCategory,
            [catModelName]: categoriesViewModel,
            slideContent: [{
                id: 'slideContent',
                tpl: 'slide-content',
                carousel: [{
                    id: 'carusel-content-1', //TODO: тут по кількості слайдів формувати
                    tpl: 'carousel-inner',
                    active: 'active',
                    [unitModelName]: unitsViewModel,
                }, {
                        id: 'carusel-content-1', //TODO: тут по кількості слайдів формувати
                        tpl: 'carousel-inner',
                        active: '',
                        [unitModelName]: unitsViewModel,
                    }, {
                        id: 'carusel-content-1', //TODO: тут по кількості слайдів формувати
                        tpl: 'carousel-inner',
                        active: '',
                        [unitModelName]: unitsViewModel,
                    }],
            }],
            correlations: correlationsViewModel,
            date: {
                from: Models.getDateFormat(from, 'input'),
                to: Models.getDateFormat(to, 'input')
            },
            dates: [{
                id: 'showDate',
                tplDate: (from.getTime() !== to.getTime()) ? 'date-period' : 'date-one',
                showDates: { from: Models.getDateFormat(from, 'text') || 'не вказано', to: Models.getDateFormat(to, 'text') || 'не вказано' },
            }],
            chartReg: chartReg,
        };
    }
*/
    /**
     * TODO: WTF
     * Генератор конфігурацій графіків залежно від бізнес-логіки категорії
     * @private
     */
    generateChartConfig(categoryKey, unitsData) {
        const categories = unitsData.map(u => u.name);
        const dataPrimary = unitsData.map(u => u.value);
        const dataSecondary = unitsData.map(u => u.valueOpposite);

        // Базовий шаблон
        const baseOptions = {
            chart: { width: '100%', height: 350 },
            xaxis: { categories: categories },
            colors: ['#008FFB', '#00E396', '#FEB019']
        };

        // Диференціація типів графіків відповідно до категорії
        switch (categoryKey) {
            case 'Обстріли':
                // Звичайний одинарний бар
                return {
                    ...baseOptions,
                    chart: { ...baseOptions.chart, type: 'bar' },
                    series: [{ name: 'Кількість обстрілів', data: dataPrimary }]
                };

            case 'РУ':
            case 'Ракетні удари':
                // Подвійний бар (Застосовано / Збито)
                return {
                    ...baseOptions,
                    chart: { ...baseOptions.chart, type: 'bar' },
                    series: [
                        { name: 'Випущено', data: dataPrimary },
                        { name: 'Збито/Подавлено', data: dataSecondary }
                    ]
                };

            case 'АУ/КАБ/КАР':
                // Потрійний бар (наприклад: КАБ, КАР, Некеровані)
                return {
                    ...baseOptions,
                    chart: { ...baseOptions.chart, type: 'bar' },
                    series: [
                        { name: 'КАБ', data: dataPrimary },
                        { name: 'КАР', data: dataSecondary },
                        { name: 'Інші АУ', data: unitsData.map(u => Math.round(u.value * 0.2)) } // умовний третій показник
                    ]
                };

            case 'ШД':
                // Лінійний графік або область для штурмових дій
                return {
                    ...baseOptions,
                    chart: { ...baseOptions.chart, type: 'area' },
                    series: [{ name: 'Штурми', data: dataPrimary }]
                };

            default:
                return {
                    ...baseOptions,
                    chart: { ...baseOptions.chart, type: 'bar' },
                    series: [{ name: 'Показник', data: dataPrimary }]
                };
        }
    }

    /**
     * TODO: WTF
     * Генерація Радар-графіка для самостійного блоку "Розподіл"
     * @private
     */
    generateRadarConfig(unitsData) {
        return {
            chart: {
                type: 'radar',
                height: 350,
                dropShadow: { enabled: true, blur: 1, left: 1, top: 1 }
            },
            title: { text: 'Розподіл сил та засобів по напрямках (УВ)' },
            series: [{
                name: 'Питома вага дій',
                data: unitsData.map(u => u.value)
            }],
            xaxis: {
                categories: unitsData.map(u => u.name)
            },
            colors: ['#FF4560'],
            stroke: { width: 2 },
            fill: { opacity: 0.1 }
        };
    }

    /**
     * Допоміжний метод генерації дат
     * @private
     */
    getDatesInRange(fromStr, toStr, format) {
        // Спрощена логіка повернення масиву дат (у вашому проекті тут робота з Date)
        let range = [];
        let periodStart = new Date(fromStr);
        const periodEnd = new Date(toStr);
        while (periodStart <= periodEnd) {
            range.push(Models.getDateFormat(periodStart)); 
            periodStart.setDate(periodStart.getDate() + 1); // переходимо на наступний день
        }
        return range;
    }

    /**
     * TODO: WTF
     * Підготовка даних для блоків співвідношення (corelstion)
     * @private
     */
    prepareCorrelationData(categoriesData) {
        // Розраховуємо загальні пропорції сторін на основі накопичених даних
        if (!categoriesData['Втрати ос']) return [];
        return [{
            title: 'Співвідношення втрат о/с (ЗСУ / рф)',
            sideA_name: 'ЗСУ',
            sideA_value: 120, // Приклад константи або вибірки
            sideB_name: 'Противник',
            sideB_value: categoriesData['Втрати os'].total || 450
        }];
    }

    /**
     * Вибірка даних з таблиці за масив дат
     * @param {string[]} dateKeysArray - Масив ключів дат, наприклад ['6/14/26', '6/15/26']
     * @returns {Promise<Object[]>} масив усіх знайдених об'єктів
     */
    async getEventByDate(dateKeysArray,tableName) {
        try {
            if (!this.db) throw new Error("Базу даних не ініціалізовано");

            // Створюємо масив промісів (запити запускаються паралельно)
            const promises = dateKeysArray.map(dateKey =>
                this.db[tableName].where('Дата').equals(dateKey).toArray()
            );

            // Чекаємо на завершення всіх запитів одночасно
            const resultsArray = await Promise.all(promises);

            // resultsArray — це масив масивів. Робимо його пласким через .flat()
            return resultsArray.flat();

        } catch (error) {
            console.error("Помилка вибірки за кілька дат:", error);
            return [];
        }
    }

    /**
     * Універсальний хелпер для форматування дат із повним ручним контролем.
     * @param {Date|string} [date] - Об'єкт дати або рядок дати.
     * @param {'key'|'text'|'apex'|'input'} [format='key'] - Тип формату.
     * @returns {string} Відформатований рядок дати.
     */
    static getDateFormat(date, format = 'key') {
        let targetDate;

        // 1. Перевіряємо, що саме до нас прилетіло
        if (!date) {
            targetDate = new Date(); // Якщо порожньо — беремо сьогодні
        } else if (typeof date === 'string') {
            targetDate = new Date(date); // Якщо прийшов рядок — конвертуємо в Date
        } else {
            targetDate = date; // Якщо прийшов готовий об'єкт Date
        }

        // Захист від Invalid Date (якщо прийшов битий рядок, який не вдалося спарсити)
        if (isNaN(targetDate.getTime())) {
            console.error("Models.getDateFormat: Невалідний формат дати ->", date);
            return '';
        }

        const d = targetDate.getDate();
        const m = targetDate.getMonth() + 1;
        const y = targetDate.getFullYear();

        switch (format) {
            case 'text': {
                const day = String(d).padStart(2, '0');
                const month = String(m).padStart(2, '0');
                return `${day}.${month}.${y}`;
            }

            case 'apex': {
                const day = String(d).padStart(2, '0');
                const month = String(m).padStart(2, '0');
                return `${y}-${month}-${day}`;
            }

            case 'input': {
                const day = String(d).padStart(2, '0');
                const month = String(m).padStart(2, '0');
                return `${y}-${month}-${day}`;
            }

            case 'key':
            default: {
                const yearShort = String(y).slice(-2);
                return `${m}/${d}/${yearShort}`;
            }
            
        }
    }

    static getWarDay() {
        const startDate = new Date(2022, 1, 24);
        const today = new Date();
        // Скидаємо години, хвилини та секунди до 00:00:00 для обох дат,
        // щоб уникнути похибок через години та перехід на літній/зимовий час
        startDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - startDate.getTime();
        const msInDay = 24 * 60 * 60 * 1000;
        const totalDays = Math.round(diffTime / msInDay) + 1; //включно поточний день
        return totalDays;
    }

    /**
     * Вибірка ключів таблиці з xlsx.workbook.
     * Створення адреси комірки в worksheet (параметр {Object} cell { row: number, col: string}).
     * 
     * @param {string} sheetName - Назва робочого аркуша (worksheet name)
     * @param {Object} opt - Параметри визначення рядків із заголовками (Models.dbModelsOpt)
     * @param {number} opt.row - Номер рядка із заголовками
     * @param {string} opt.col - Назва або індекс колонки
     * @param {boolean} opt.direction - Напрямок обходу (true/false)
     * @returns {string[]} Набір знайдених ключів таблиці (масив рядків)
     */
    getStorageModel(book, sheetName, opt) {
        opt = opt || this.dbModelsOpt[sheetName];
        if (!opt) {
            console.error('[ERROR] Models.getStorageModel: opt: ' + opt + '; for sheet:' + sheetName);
            opt = this.dbModelsOpt.base;
        }
        const keys = [];
        let str = '[';
        // parce key in sheet at: 'column', 'row'
        for (let key in book.Sheets[sheetName]) {
            let col = (key.match(/\D/g) || []).join('');
            let row = (key.match(/\d/g) || []).join('');
            // set cell params
            if (!book.Sheets[sheetName][key].cell) {
                (col && row
                    && (book.Sheets[sheetName][key].cell = { row: row, col: col })
                )
                    // || console.info('Model:getStorageModel: in "'+ sheetName +'" "'+key+'" Not cell');
            }
            // get keys
            if (!book.Sheets[sheetName][key].cell)
                continue;
            // console.log(opt.direction, row == opt.row, book.Sheets[sheetName][key]['w']);
            (opt.direction
                && row == opt.row
                && keys.push(this.clearToDBKey(book.Sheets[sheetName][key]['w']))
                && (str = str + "\n '" + keys[keys.length-1] + "',")
            );
            (!opt.direction
                && col == opt.col
                && keys.push(this.clearToDBKey(book.Sheets[sheetName][key]['w']))
                && (str = str + "\n '" + keys[keys.length-1] + "',")
            );
        }
        str = str + '\n]';
        //** вивід масиву в консоль для копіювання та збереження **//
        // console.log('FOR SAVE: storeModel for ' + sheetName +': ', str, keys); 
        return keys;
    }

    /**
     * Перевірити версію таблиці в базі з xlsx.workbook.
     * 
     * @param {string} sheetName - worksheet name
     * @param {string[]} keys - масив з вибраними ключами 
     * @returns {Object} Об'єкт із результатами перевірки структури
     * @returns {boolean} returns.flag Відповідність наявної моделі зі сформованою
     * @returns {string[]} returns.diff Масив елементів, які відрізняються
     */
    checkVersion(sheetName, keys) {
        const model = this.dbModels[sheetName];

        // 1. Перевіряємо, чи взагалі існує така модель аркуша
        if (!model) {
            return { flag: false, diff: [...keys] }; // Якщо моделі немає, всі передані ключі є "зайвими"
        }

        // 2. Шукаємо розбіжності за допомогою Set
        const modelSet = new Set(model);
        const keysSet = new Set(keys);

        // Ключі, які передані в функцію, але відсутні в dbModels (зайві або змінені)
        const diffInKeys = keys.filter(key => !modelSet.has(key));

        // Ключі, які є в dbModels, але їх забули передати (відсутні)
        const diffInModel = model.filter(key => !keysSet.has(key));

        // Об'єднуємо всі відмінності в один масив унікальних значень
        const diff = [...new Set([...diffInKeys, ...diffInModel])];

        // База валідна тільки якщо довжини збігаються і відмінностей немає
        const flag = model.length === keys.length && diff.length === 0;

        return {
            flag: flag,
            diff: diff 
        };
    }

    /**
     * Очищення рядка для можливості використання його у якості заголовку таблиці бази даних.
     * 
     * @param {string} str - текст який треба очистити
     * @return {string}
     */
    clearToDBKey(str) {
        // return str.replace(/[^a-zA-Z0-9а-яієїґА-ЯІЄЇҐ,\n _]/g, '').replace(/[ ]/g, '_');
        return str.replace(/[^a-zA-Z0-9а-яієїґА-ЯІЄЇҐ, _]/g, '').replace(/[ ]/g, '_');
    }
    /**
     * Перетворення моделі ключів у рядок для dexie stores з додаванням primaryKeyPath id.
     * 
     * @param {Object.<string, string[]>} keys Об'єкт за структурою як this.dbModels. за замовчуванням - this.dbModels.
     * @returns {Object.<string, string>} Об'єкт, де ключ — ім'я моделі, а значення — рядок для Dexie
     */
    getDexieStores(keys) {
        keys = keys || this.dbModels;
        this.dexieStores = {};
        for (const listName in keys) {
            this.dexieStores[listName] = 'id, ' + keys[listName].join(', '); // id - primaryKeyPath
        }
        return this.dexieStores;
    }

    /**
     * Парсинг даних із робочого аркуша XLSX та формування масиву об'єктів під структуру бази даних.
     * Функція динамічно визначає координати колонок/рядків заголовків і збирає відповідні їм дані.
     * 
     * @param {string} name Назва моделі таблиці (ключ у this.dbModelsOpt)
     * @param {Object} sheet Об'єкт аркуша з xlsx.workbook (де ключі — назви комірок, наприклад 'A1')
     * @param {string[]} keys Масив очікуваних ключів (заголовків) для вибірки
     * @returns {Object[]} Сформований масив об'єктів із даними таблиці (без порожніх індексів)
     */
    getDBTable(name, sheet, keys) {
        // Карта адрес: { назва_ключа: { row: number, col: string } }
        const keysAddresses = {};
        let objTable = [];
        
        // Етап 1: Прив'язка ключів (заголовків) до їхніх адрес у таблиці
        let counter = 0;
        for (const cell in sheet) {
            // console.log('Models:getDBTable cell: ', cell);
            if (!sheet[cell].cell) continue;

            switch (this.dbModelsOpt[name].direction) {
                case true: // Горизонтальне розташування заголовків (в один рядок)
                    if (this.dbModelsOpt[name].row == sheet[cell].cell.row) {
                        for (let i = 0; i < keys.length; i++) {
                            if (this.clearToDBKey(keys[i]) == this.clearToDBKey(sheet[cell].w)) {
                                keysAddresses[keys[i]] = { row: sheet[cell].cell.row, col: sheet[cell].cell.col };
                                counter++;
                            }
                        }
                    }
                    break;

                case false: // Вертикальне розташування заголовків (в одну колонку)
                    if (this.dbModelsOpt[name].col == sheet[cell].cell.col) {
                        for (let i = 0; i < keys.length; i++) {
                            if (this.clearToDBKey(keys[i]) == this.clearToDBKey(sheet[cell].w)) {
                                keysAddresses[keys[i]] = { row: sheet[cell].cell.row, col: sheet[cell].cell.col };
                                counter++;
                            }
                        }
                    }
                    break;
            }
            
            // Оптимізація: якщо знайшли всі ключі, достроково перериваємо цикл перебору комірок
            if (keys.length == counter) break;
        }
        
        // Етап 2: Визначення та збір всього набору даних на основі знайдених адрес
        for (const cell in sheet) {
            if (!sheet[cell].cell) continue;

            switch (this.dbModelsOpt[name].direction) {
                case true: // Збір даних для горизонтальної таблиці (рядки нижче заголовка)
                    if (this.dbModelsOpt[name].row != sheet[cell].cell.row) {
                        for (let i in keysAddresses) {
                            // Якщо колонка комірки збігається з колонкою заголовка
                            if (keysAddresses[i].col == sheet[cell].cell.col) {
                                // Ініціалізуємо об'єкт рядка, якщо він ще не створений
                                if (!objTable[sheet[cell].cell.row]) {
                                    objTable[sheet[cell].cell.row] = {};
                                }
                                // Записуємо значення комірки у відповідний ключ об'єкта
                                objTable[sheet[cell].cell.row][i] = sheet[cell].w;
                                continue;
                            }
                        }
                    }
                    break;

                case false: // Збір даних для вертикальної таблиці
                    if (this.dbModelsOpt[name].col != sheet[cell].cell.col) {
                        // TODO: доробити логіку будування таблиці для вертикального виконання
                    }
                    break;
            }
        }

        // Етап 3: Динамічна генерація rowId на основі двох ключів із dbModelsPrimaries
        const primaryKeys = this.dbModelsPrimaries[name]; // Наприклад: ['order_number', 'order_date']

        if (primaryKeys && primaryKeys.length) {
            for (const rowIndex in objTable) {
                if (objTable.hasOwnProperty(rowIndex)) {
                    const rowData = objTable[rowIndex];

                    // Збираємо очищені значення для всіх ключів, що задані в масиві primaryKeys
                    const keyValues = primaryKeys.map(key => {
                        const rawValue = rowData[key] || '';
                        return this.clearToDBKey(rawValue);
                    });

                    // Перевірка: якщо ВСІ вибрані поля виявилися порожніми — пропускаємо цей рядок
                    if (keyValues.every(val => val === '')) continue;

                    // Склеюємо всі отримані значення через роздільник підкреслення
                    // Наприклад, якщо 3 ключі: "знач1_знач2_знач3"
                    rowData.id = keyValues.join('_');
                }
            }
        } else {
            // Резервний варіант: якщо забули описати 2 ключі в конфігу, 
            // робимо звичайний автоінкремент або хеш усього рядка
            console.warn(`Не знайдено 2 первинних ключі для моделі: ${name}. Використовуємо fallback.`);
        }
        
        // Етап 4: Стискаємо масив (видаляємо порожні індекси, що виникли через відповідність номерам рядків XLSX)
        objTable = objTable.filter(() => true);

        return objTable;
    }

    /**
     * Масовий запис або оновлення даних у базі даних (Ідемпотентний імпорт).
     * Використовує метод `bulkPut`, який автоматично перезаписує існуючі записи, 
     * якщо збігається первинний ключ (rowId), або створює нові, якщо ключа немає.
     * 
     * @param {string} tableName - Назва таблиці в базі даних Dexie (наприклад, 'ГОЧ')
     * @param {Object[]} data - Масив об'єктів (рядків) з даними для збереження
     * @returns {Promise<any>} Проміс, який завершується після успішного запису всіх елементів
     */
    pushToDB(tableName, data) {
        return this.db[tableName].bulkPut(data);
    }
}