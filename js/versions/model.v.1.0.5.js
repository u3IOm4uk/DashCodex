/**
 * @fileoverview Модуль для роботи з базою даних. Вибірка та оновлення даних.
 * @version 1.0.5
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

        const fromDate = new Date(from);
        const toDate = new Date(to);

        // 1. Визначення типу вибірки за твоїм форматом
        const isSingleDate = fromDate.getFullYear() === toDate.getFullYear() &&
            fromDate.getMonth() === toDate.getMonth() &&
            fromDate.getDate() === toDate.getDate();

        // Залишаємо виклики getDatesInRange старими — вони генерують дати у форматі 'key' (m/d/yy)
        const datesForCards = this.getDatesInRange(from, to);

        let datesToFetch = [];
        if (isSingleDate) {
            const pastDate = new Date(fromDate);
            pastDate.setDate(pastDate.getDate() - 6);
            datesToFetch = this.getDatesInRange(pastDate, to);
        } else {
            datesToFetch = this.getDatesInRange(from, to);
        }

        // Для графіків відображення по осі X
        let datesToChart = [...datesToFetch];

        const rawData = await this.getEventByDate(datesToFetch, 'ГОЧ');
        const actData = await this.getEventByDate(datesToFetch, 'Застосування БК та FPV');

        const warDay = Models.getWarDay();
        const chartReg = {};
        const getNum = (row, key) => (row && parseInt(row[key])) || 0;

        const getFlexibleRatio = (n1, n2) => {
            if (n1 === 0 || n2 === 0) return "- : -";
            return n1 >= n2
                ? `${(n1 / n2).toFixed(1).replace('.', ',')} : 1`
                : `1 : ${(n2 / n1).toFixed(1).replace('.', ',')}`;
        };

        // ----------------------------------------------------
        // КРОК 1. Ініціалізація структур для збору: День -> Юніт -> Підкатегорія (базовий ключ БД)
        // ----------------------------------------------------
        const hierarchyMap = new Map();

        datesToFetch.forEach(date => {
            const unitsMap = new Map();
            Data.global.units.forEach(unitKey => {
                const dbKeysMap = new Map();
                // Розвертаємо всі можливі базові ключі бази даних для ініціалізації нулями
                Data.global.categories.forEach(catKey => {
                    const dbKeys = Data.global.categoriesByKey[catKey];
                    if (Array.isArray(dbKeys)) {
                        dbKeys.forEach(k => dbKeysMap.set(k, 0));
                    } else {
                        dbKeysMap.set(dbKeys, 0);
                    }
                });
                unitsMap.set(unitKey, dbKeysMap);
            });
            hierarchyMap.set(date, unitsMap);
        });

        // ----------------------------------------------------
        // КРОК 2. Агрегація даних знизу вгору (На рівні базових ключів БД)
        // ----------------------------------------------------
        datesToFetch.forEach(date => {
            const dayUnitsMap = hierarchyMap.get(date);
            const dayRows = rawData.filter(row => row && row['Дата'] === date);

            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;

                const targetUnitDbKeys = dayUnitsMap.get(unitKey);
                const targets = config.squad && config.squad.length > 0 ? config.squad : [config.nameMd];

                // Проходимо по кожному базовому ключу, який ми маємо порахувати
                Array.from(targetUnitDbKeys.keys()).forEach(dbKey => {
                    let accumulatedSum = 0;

                    targets.forEach(targetName => {
                        const row = dayRows.find(r => r['Угруповання'] === targetName);
                        if (row) {
                            accumulatedSum += getNum(row, dbKey);
                        }
                    });

                    targetUnitDbKeys.set(dbKey, accumulatedSum);
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

            let totalValueForUnit = 0;
            let totalValueMulti = {};
            if (isMultiActive) dbKeysActive.forEach(k => totalValueMulti[k] = 0);

            // Рахуємо ТЕКСТОВІ ЦИФРИ на картці підрозділу за datesForCards
            datesForCards.forEach(date => {
                const dayUnitsMap = hierarchyMap.get(date);
                if (!dayUnitsMap) return;
                const targetUnitDbKeys = dayUnitsMap.get(unitKey);

                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        const val = targetUnitDbKeys.get(k) || 0;
                        totalValueMulti[k] += val;
                        totalValueForUnit += val;
                    });
                } else {
                    totalValueForUnit += targetUnitDbKeys.get(dbKeysActive) || 0;
                }
            });

            // Побудова внутрішнього графіка юніта
            let chart = isMultiActive ? Data.global.getChartBarMultiple() : Data.global.getChartBarOne();
            chart.series = [];

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
                                squadTotal += getNum(squadRow, dbKeysActive);
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
        // КРОК 4. Побудова масиву КАТЕГОРІЙ (Багатолінійні графіки)
        // ----------------------------------------------------
        const catModelName = 'categories';
        let totalRadar = 0;

        const categoriesViewModel = Data.global.categories.map((catKey, ind) => {
            const dbKeys = Data.global.categoriesByKey[catKey];
            const isCatMulti = Array.isArray(dbKeys);

            let chart = Data.global.getChartArea();
            chart.series = [];

            let totalValueStr = '';

            if (isCatMulti) {
                // Складна категорія (наприклад, АУ/КАБ/КАР) -> Робимо кілька ліній
                let tempTotalArray = [];

                dbKeys.forEach(k => {
                    // Рахуємо масив по днях для поточної підкатегорії
                    const dailyData = datesToFetch.map(date => {
                        let daySum = 0;
                        Data.global.units.forEach(unitKey => {
                            daySum += hierarchyMap.get(date).get(unitKey).get(k) || 0;
                        });
                        return daySum;
                    });

                    // Лінія для цієї підкатегорії
                    let s = {
                        name: Data.global.categoriesByTitle[k] || k,
                        data: dailyData
                    };
                    if (Data.global.categoriesChartColor[k]) s.color = Data.global.categoriesChartColor[k];
                    chart.series.push(s);

                    // Загальна сума підкатегорії за весь розширений період графіку (або міняй на datesForCards якщо треба за день)
                    const subKeyTotal = dailyData.reduce((acc, v) => acc + v, 0);
                    tempTotalArray.push(subKeyTotal);

                    if (catKey === activeCategory) totalRadar += subKeyTotal;
                });

                totalValueStr = tempTotalArray.join('/');
            } else {
                // Проста одинарна категорія -> Одна лінія
                const dailyData = datesToFetch.map(date => {
                    let daySum = 0;
                    Data.global.units.forEach(unitKey => {
                        daySum += hierarchyMap.get(date).get(unitKey).get(dbKeys) || 0;
                    });
                    return daySum;
                });

                let s = {
                    name: Data.global.categoriesByTitle[catKey] || catKey,
                    data: dailyData
                };
                if (Data.global.categoriesChartColor[catKey]) s.color = Data.global.categoriesChartColor[catKey];
                chart.series.push(s);

                const totalSum = dailyData.reduce((acc, v) => acc + v, 0);
                totalValueStr = totalSum;

                if (catKey === activeCategory) totalRadar = totalSum;
            }
            chart.xaxis.categories = datesToChart.map(d => {
                return Models.getDateFormat(d, 'apex');
            });
            chart.xaxis.tickAmount = datesToChart.length;
            const renderId = `cat-${catKey.replace(/\//g, '_')}`;
            chartReg[renderId] = chart;

            return {
                id: renderId,
                ind: ind,
                category_key: catKey,
                category_name: Data.global.categoriesByTitle[catKey] || catKey,
                total_value: totalValueStr,
                textDetail: Data.text.detail,
                tpl: 'block-dynamic-info',
                cssClass: catKey === activeCategory ? 'active' : '',
                chart: chart,
                chartOptName: renderId
            };
        });

        // ----------------------------------------------------
        // КРОК 3.1. Побудова ТЕНДЕНЦІЙ підрозділів для 2-го слайда (unitsTrendsViewModel)
        // ----------------------------------------------------
        const unitsTrendsViewModel = Data.global.units.map(unitKey => {
            const config = Data.global.unitStructure[unitKey];
            if (!config) return null;

            const dayUnitsMap = hierarchyMap.get(datesForCards[0]); // Для текстового значення за обраний день
            let totalValueForUnit = 0;
            let totalValueMulti = {};
            if (isMultiActive) dbKeysActive.forEach(k => totalValueMulti[k] = 0);

            // Збираємо сухі цифри для карток (так само суворо за datesForCards)
            datesForCards.forEach(date => {
                const dayMap = hierarchyMap.get(date);
                if (!dayMap) return;
                const targetUnitDbKeys = dayMap.get(unitKey);

                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        const val = targetUnitDbKeys.get(k) || 0;
                        totalValueMulti[k] += val;
                        totalValueForUnit += val;
                    });
                } else {
                    totalValueForUnit += targetUnitDbKeys.get(dbKeysActive) || 0;
                }
            });

            // Ініціалізуємо АREA-графік тренду для цього юніта
            let chart = Data.global.getChartArea();
            chart.series = [];

            if (isMultiActive) {
                // Якщо категорія складна (наприклад, АУ/КАБ/КАР) — малюємо окрему лінію для кожної підкатегорії
                dbKeysActive.forEach(k => {
                    const dailyData = datesToFetch.map(date => {
                        return hierarchyMap.get(date)?.get(unitKey)?.get(k) || 0;
                    });

                    let s = {
                        name: Data.global.categoriesByTitle[k] || k,
                        data: dailyData
                    };
                    if (Data.global.categoriesChartColor[k]) s.color = Data.global.categoriesChartColor[k];
                    chart.series.push(s);
                });
            } else {
                // Якщо категорія проста — одна лінія тренду юніта за днями
                const dailyData = datesToFetch.map(date => {
                    return hierarchyMap.get(date)?.get(unitKey)?.get(dbKeysActive) || 0;
                });

                let s = {
                    name: Data.global.categoriesByTitle[activeCategory] || activeCategory,
                    data: dailyData
                };
                if (Data.global.categoriesChartColor[activeCategory]) {
                    s.color = Data.global.categoriesChartColor[activeCategory];
                }
                chart.series.push(s);
            }

            // Прив'язуємо правильні формати дат для осі X, як ти зробив у Кроці 4
            chart.xaxis.categories = datesToChart.map(d => Models.getDateFormat(d, 'apex'));
            chart.xaxis.tickAmount = datesToChart.length - 1;
            chart.chart.height = 215;

            // Реєструємо унікальний ID графіка тренду
            const trendRenderId = `unit-trend-${unitKey}`;
            chartReg[trendRenderId] = chart;

            let totalSumPerKeyA = [];
            if (isMultiActive) dbKeysActive.forEach(k => totalSumPerKeyA.push(totalValueMulti[k]));

            return {
                id: trendRenderId,
                unitName: config.nameMd,
                value: isMultiActive ? totalSumPerKeyA.join('/') : totalValueForUnit,
                valueSet: isMultiActive ? totalValueMulti : totalValueForUnit,
                cssClass: config.class+' chart-area',
                textDetail: Data.text.detail,
                tpl: 'block-detaile-info', // або твій шаблон для карток трендів
                chart: chart,
                chartOptName: trendRenderId
            };
        }).filter(Boolean);

        // ==========================================
        // Збірка Радара (З урахуванням підкатегорій)
        // ==========================================
        let chartRadar = Data.global.getChartRadar();
        let chartRadarBig = Data.global.getChartRadar();
        chartRadar.series = [];
        chartRadarBig.series = [];
        chartRadar.xaxis.categories = [];
        chartRadarBig.xaxis.categories = [];

        // 1. Спочатку формуємо осі (промені радара) — це наші підрозділи
        unitsViewModel.forEach(unit => {
            chartRadar.xaxis.categories.push(unit.unitName);
            chartRadarBig.xaxis.categories.push(unit.unitName);
        });

        // 2. Будуємо лінії залежно від того, чи активна категорія складна
        if (isMultiActive) {
            // Для кожної підкатегорії (наприклад: 'АУ_', 'КАБ', 'КАР') створюємо окрему серію
            dbKeysActive.forEach(k => {
                let radarSquadData = [];

                // Проходимо по кожному юніту і витягуємо значення конкретно для цього ключа
                unitsViewModel.forEach(unit => {
                    // Значення беремо з valueSet, яке ми заповнили в Кроці 3
                    const val = (unit.valueSet && typeof unit.valueSet === 'object')
                        ? (unit.valueSet[k] || 0)
                        : 0;
                    radarSquadData.push(val);
                });

                let s = {
                    name: Data.global.categoriesByTitle[k] || k,
                    data: radarSquadData
                };
                // Підтягуємо індивідуальний колір підкатегорії
                if (Data.global.categoriesChartColor[k]) s.color = Data.global.categoriesChartColor[k];

                chartRadar.series.push(s);
                chartRadarBig.series.push(s);
            });
        } else {
            // Якщо категорія проста, будуємо одну лінію, як і раніше
            let chartRadarSeries = {
                name: Data.global.categoriesByTitle[activeCategory] || activeCategory,
                data: []
            };

            unitsViewModel.forEach(unit => {
                chartRadarSeries.data.push(
                    typeof unit.valueSet === 'object'
                        ? Object.values(unit.valueSet).reduce((a, b) => a + b, 0)
                        : unit.valueSet
                );
            });

            if (Data.global.categoriesChartColor[activeCategory]) {
                chartRadarSeries.color = Data.global.categoriesChartColor[activeCategory];
            }
            chartRadar.series.push(chartRadarSeries);
            chartRadarBig.series.push(chartRadarSeries);
        }

        chartReg['radar-distribution'] = chartRadar;

        chartRadarBig.chart.height = 477;
        chartRadarBig.plotOptions.radar.size = 200;
        chartReg['radar-distribution-big'] = chartRadarBig;
        console.log('chartRadarBig: ', chartRadarBig);
        // Пушимо картку радара в загальний масив юнітів
        const unitsModelRadar = {
            id: 'radar-distribution',
            unitName: 'Розподіл',
            value: totalRadar,
            cssClass: 'radar-card',
            textDetail: Data.text.detail,
            tpl: 'block-detaile-info',
            chart: chartRadar,
            chartOptName: 'radar-distribution'
        };
        const unitsModelRadarBig = {
            id: 'radar-distribution-big',
            unitName: 'Розподіл',
            value: totalRadar,
            cssClass: 'radar-card',
            textDetail: Data.text.detail,
            tpl: 'block-detaile-info',
            chart: chartRadarBig,
            chartOptName: 'radar-distribution-big'
        };
        unitsViewModel.push(unitsModelRadar);

        // ----------------------------------------------------
        // КРОК 5. Розрахунок СПІВВІДНОШЕНЬ (correlationsViewModel)
        // ----------------------------------------------------
        const correlationsViewModel = [];

        let bkSou = 0, bkEnemy = 0;
        datesForCards.forEach(date => {
            const dayActRows = actData.filter(row => row && row['Дата'] === date);
            dayActRows.forEach(row => {
                bkSou += getNum(row, 'Наші_війська_BK') || getNum(row, 'Наші_війська_БК');
                bkEnemy += getNum(row, 'Противник_BK') || getNum(row, 'Противник_БК');
            });
        });
        correlationsViewModel.push({
            id: 'corr-losses-amo',
            title: 'Витрати БК',
            souValue: bkSou,
            enemyValue: bkEnemy,
            ratioText: getFlexibleRatio(bkSou, bkEnemy),
            textDetail: Data.text.detail
        });

        let lossSou = 0, lossEnemy = 0;
        datesForCards.forEach(date => {
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
        datesForCards.forEach(date => {
            const dayActRows = actData.filter(row => row && row['Дата'] === date);
            dayActRows.forEach(row => {
                fpvStrikesSou += getNum(row, 'Наші_війська_FPV');
                fpvStrikesEnemy += getNum(row, 'Противник_FPV');
            });
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

            // ОНОВЛЕНИЙ БЛОК КАРОСЕЛІ
            slideContent: [{
                id: 'slideContent',
                tpl: 'slide-content',
                carousel: [
                    // 1-й слайд: Картки підрозділів з розподілом по Squads (Bar Chart)
                    { id: 'carusel-content-1', tpl: 'carousel-inner', active: 'active', [unitModelName]: unitsViewModel },

                    // 2-й слайд: Картки підрозділів з графіками тенденцій за днями (Area Chart)
                    { id: 'carusel-content-2', tpl: 'carousel-inner', active: '', [unitModelName]: unitsTrendsViewModel },

                    // 3-й слайд
                    { id: 'carusel-content-3', tpl: 'carousel-inner', active: 'one-item', [unitModelName]: [unitsModelRadarBig] }
                ],
            }],

            correlations: correlationsViewModel,
            date: {
                from: Models.getDateFormat(from, 'input'),
                to: Models.getDateFormat(to, 'input')
            },
            dates: [{
                id: 'showDate',
                tplDate: !isSingleDate ? 'date-period' : 'date-one',
                showDates: {
                    from: Models.getDateFormat(from, 'text') || 'не вказано',
                    to: Models.getDateFormat(to, 'text') || 'не вказано'
                },
            }],
            chartReg: chartReg
        };
    }

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
        // Спрощена логіка повернення масиву дат
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