/**
 * @fileoverview Модуль для роботи з базою даних. Вибірка та оновлення даних.
 * @version 1.0.3 
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
     * @param {Object} period - Об'єкт із датами { from, to }
     * @returns {Promise<DashBoardViewModel>}
     */
    async pageDashBoard(filter = { from: '6/15/2026', to: '6/18/2026' }) {
        /*
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
         */
        console.log('Models.pageDashBoard si here');

        const { from, to, activeCategory = 'Обстріли' } = filter;
        // 1. Отримуємо масив дат та сирі дані з Dexie по таблиці ГОЧ
        const datesToFetch = this.getDatesInRange(from, to);
        // const rawData = await this.db['ГОЧ'].where('order_date').anyOf(datesToFetch).toArray();

        const rawData = await this.getEventByDate(datesToFetch);
        // ----------------------------------------------------
        // КОМЕНТАР: Розрахунок warDay (днів війни)
        // Початок повномасштабного вторгнення: 24.02.2022
        // Якщо у вашій системі є статичний хелпер, використовуйте його: Models.getWarDay()
        // ----------------------------------------------------
        const startDate = new Date('2022-02-24');
        const currentDate = to ? new Date(to) : new Date();
        const diffTime = Math.abs(currentDate - startDate);
        const warDay = Models.getWarDay();

        // ----------------------------------------------------
        // Крок 1. Попередня фільтрація та агрегація даних
        // ----------------------------------------------------
        // Окремо виділяємо рядок загальних сум та рядки по угрупованням
        let totalRow = null;
        const squadRows = [];

        rawData.forEach(row => {
            const unit = row['Угруповання'];
            if (unit === "ВСЬОГО за СО:") {
                totalRow = row;
            } else {
                squadRows.push(row);
            }
        });

        // Якщо немає явного рядка "ВСЬОГО за СО:", ми згенеруємо його математично (fallback)
        if (!totalRow && rawData.length > 0) {
            totalRow = { 'Угруповання': "ВСЬОГО за СО:" };
            // Сумуємо всі числові поля по наявним рядкам
            const fieldsToSum = Data.global.dbModels['ГОЧ'].filter(f => f !== 'Дата' && f !== 'Угруповання');
            fieldsToSum.forEach(field => {
                totalRow[field] = rawData.reduce((acc, row) => acc + (parseFloat(row[field]) || 0), 0).toString();
            });
        }

        // Хелпер для безпечного отримання числа з рядка даних
        const getNum = (row, key) => {
            if (!row) return 0;
            return parseFloat(row[key]) || 0;
        };

        // Хелпер для отримання значення за категорією (підтримує як один ключ, так і масив ключів)
        const getValueByCategory = (row, categoryKey) => {
            const dbKeys = Data.global.categoriesByKey[categoryKey];
            if (Array.isArray(dbKeys)) {
                return dbKeys.reduce((sum, key) => sum + getNum(row, key), 0);
            }
            return getNum(row, dbKeys);
        };

        // ----------------------------------------------------
        // Крок 2. Побудова масиву КАТЕГОРІЙ (categories)
        // ----------------------------------------------------
        const categoriesViewModel = Data.global.categories.map(catKey => {
            const totalValue = getValueByCategory(totalRow, catKey);

            return {
                id: `cat-${catKey.replace(/\//g, '_')}`, // Унікальний ID для dataset.opt
                category_key: catKey,
                category_name: Data.global.categoriesByTitle[catKey] || catKey,
                total_value: totalValue,

                // КОМЕНТАР щодо textDetail:
                // Дані для textDetail (наприклад "карт підрозділів: 5") не мають прямого джерела в поточному ітемі.
                // Зазвичай це короткий опис стану або супровідний текст. За замовчуванням виводимо назву заголовку.
                textDetail: Data.text.detail,

                tpl: 'block-dynamic-info',
                cssClass: catKey === activeCategory ? 'active' : '' // Клас активності категорії
            };
        });

        // ----------------------------------------------------
        // Крок 3. Побудова масиву ПІДРОЗДІЛІВ/УГРУПОВАНЬ (units)
        // ----------------------------------------------------
        const unitsViewModel = Data.global.units.map(unitKey => {
            const config = Data.global.unitStructure[unitKey];
            if (!config) return null;

            let totalValueForCategory = 0;

            // Якщо угруповання має підрозділи (squad), сумуємо їхні значення по активній категорії
            if (config.squad && config.squad.length > 0) {
                squadRows.forEach(row => {
                    if (config.squad.includes(row['Угруповання'])) {
                        totalValueForCategory += getValueByCategory(row, activeCategory);
                    }
                });
            } else {
                // Якщо squad порожній (наприклад, "12 АК" або "УВ Курськ" є самостійним угрупованням в базі даних)
                const directRow = squadRows.find(row => row['Угруповання'] === config.name || row['Угруповання'] === unitKey);
                if (directRow) {
                    totalValueForCategory = getValueByCategory(directRow, activeCategory);
                }
            }

            return {
                unitId: unitKey,
                unitName: config.nameMd,
                value: totalValueForCategory,
                cssClass: config.class,

                // КОМЕНТАР щодо textDetail у підрозділах:
                // Сюди логічно вивести інформацію про кількість підрозділів у складі або поточну категорію.
                textDetail: Data.text.detail,

                tpl: 'block-detaile-info' // Стандартний шаблон підрозділу
            };
        }).filter(Boolean);

        // Додаємо службову картку Радара "Розподіл" відповідно до вашої логіки вкладення шаблонів Views 2.1
        unitsViewModel.push({
            unitId: 'radar-distribution',
            unitName: 'Розподіл сил та засобів',
            value: 0, // Для радара загальне значення вираховується графіком
            cssClass: 'radar-card',
            textDetail: Data.text.detail,
            tpl: 'block-detaile-info', //'block-radar-distribution' // Динамічно завантажить шаблон з ApexCharts Radar
        });

        // ----------------------------------------------------
        // Крок 4. Побудова масиву СПІВВІДНОШЕНЬ (correlations)
        // ----------------------------------------------------
        // КОМЕНТАР щодо correlations:
        // Співвідношення (SOU vs Enemy) зазвичай будуються для категорій, де є чітке протистояння сторін.
        // Наприклад: Втрати о/с (Втрати_всього_ЗСУ проти Втрати_всього_рф) або Застосування БпЛА (ЗСУ проти рф).
        // Нижче описано алгоритм генерації на основі поточних даних "Втрати ос":
        // ----------------------------------------------------
        const correlationsViewModel = [];

        // Приклад побудови співвідношення для Втрат о/с
        const lossSou = getNum(totalRow, 'Втрати_всього_ЗСУ');
        const lossEnemy = getNum(totalRow, 'Втрати_всього_рф');
        const lossTotal = lossSou + lossEnemy;
        const lossRatioText = lossTotal > 0 ? `1 : ${((lossEnemy / (lossSou || 1))).toFixed(1)}` : '0 : 0';

        correlationsViewModel.push({
            id: 'corr-losses',
            title: 'Втрати особового складу',
            souValue: lossSou,
            enemyValue: lossEnemy,
            ratioText: lossRatioText,
            textDetail: Data.text.detail
        });

        // Приклад побудови для БпС (якщо потрібно порівняти FPV з іншими засобами, або якщо в базі є БпЛА ЗСУ)
        const fpvStrikes = getNum(totalRow, 'FPVдрони');
        const totalUavStrikes = getNum(totalRow, 'FPVдрони'); // TODO: треба 'FPVдрони' за наші війська
        const uavRatioText = totalUavStrikes > 0 ? `1 : ${((fpvStrikes / (totalUavStrikes || 1))).toFixed(1)}` : '0 : 0';

        correlationsViewModel.push({
            id: 'corr-uav',
            title: 'Застосування БпС противником',
            souValue: fpvStrikes, // У вашому масиві це ітем противника
            enemyValue: totalUavStrikes,
            ratioText: uavRatioText,
            textDetail: Data.text.detail
        });

        // ----------------------------------------------------
        // Крок 5. Складання та повернення результату (ViewModel)
        // ----------------------------------------------------
        return {
            showDates: { from: from || 'не вказано', to: to || 'не вказано' },
            warDay: warDay,
            activeCategoryName: Data.global.categoriesByTitle[activeCategory] || activeCategory,
            categories: categoriesViewModel,
            units: unitsViewModel,
            correlations: correlationsViewModel
        };



/*
        // 1. Отримуємо масив дат та сирі дані з Dexie по таблиці ГОЧ
        const datesToFetch = this.getDatesInRange(period.from, period.to);
        // const rawData = await this.db['ГОЧ'].where('order_date').anyOf(datesToFetch).toArray();
        
        const rawData = await this.getEventByDate(datesToFetch);
        console.log('рядок з indexedDB: rawData: ', rawData);
        // Перелік підрозділів із конфігу Data (наприклад: uvWest, uvEast тощо)
        const unitsList = Data.global.units || [];
        const unitConfigs = Data.global.unitStructure || {};

        // Базовий каркас для збору категорій
        const categoriesData = {};

        // Ініціалізуємо структури для відомих категорій із Data.text
        const trackedCategories = Data.global.categories || [];

        trackedCategories.forEach(cat => {
            categoriesData[cat] = {
                title: Data.text[cat] || cat,
                key: cat,
                total: 0,
                units: {},
                
            };
            // Ініціалізуємо лічильники для кожного підрозділу всередині категорії
            unitsList.forEach(unit => {
                categoriesData[cat].units[unit] = {
                    unitKey: unit,
                    name: unitConfigs[unit]?.name || unit,
                    value: 0,
                    valueOpposite: 0 // для подвійних/потрійних графіків або опозитних порівнянь
                };
            });
        });

        // 2. Агрегація сирих даних [ {tableKey: tableValue}, ... ]
        rawData.forEach(row => {
            // Приклад структури: row = { order_date: '...', unit_id: 'uvWest', category: 'Обстріли', count: 10, count_opp: 2 }
            const cat = row.category;
            const unit = row.unit_id;

            if (categoriesData[cat] && categoriesData[cat].units[unit]) {
                const val = Number(row.count || row.value || 0);
                const valOpp = Number(row.count_opp || row.value_opp || 0);

                categoriesData[cat].total += val;
                categoriesData[cat].units[unit].value += val;
                categoriesData[cat].units[unit].valueOpposite += valOpp;
            }
        });

        // 3. Формування фінального пакету ViewModel
        const viewModel = {
            showDates: { from: period.from, to: period.to },
            warDay: this.constructor.getWarDay ? this.constructor.getWarDay() : 0,
            categories: [], // Для шаблону 'dynamic'
            details: {},    // Для шаблону 'detail' (динамічне сховище за ключем категорії)
            correlations: [] // Для шаблону 'corelstion'
        };

        // Заповнюємо блоки
        Object.keys(categoriesData).forEach((catKey, index) => {
            const catInfo = categoriesData[catKey];

            // 3.1. Масив категорій для головного меню/карток (dynamic)
            let catDataItem = {
                id: `cat-${catKey}`,
                category_name: catInfo.title,
                category_key: catKey,
                total_value: catInfo.total,
                textDetail: Data.text.detail,
                tpl: 'block-dynamic-info'
            };
            viewModel.categories.push(catDataItem);

            // Масив підрозділів для цієї категорії
            const targetUnitsArray = Object.values(catInfo.units);

            // 3.2. Генерація конфігів графіків ApexCharts індивідуально під категорію
            const chartOptions = this.generateChartConfig(catKey, targetUnitsArray);
            const radarOptions = this.generateRadarConfig(targetUnitsArray);

            // 3.3. Сховище для detail (блоки підрозділів + графіки)
            viewModel.details[catKey] = {
                category_title: catInfo.title,
                // Перелік підрозділів, який розмножить шаблон detail
                items: targetUnitsArray.map(u => ({
                    unit_name: u.name,
                    unit_value: u.value,
                    unit_additional: u.valueOpposite
                })),
                // Вбудовані конфіги графіків, які зчитає Контролер через події
                charts: {
                    mainChart: chartOptions,
                    distributionChart: radarOptions // Самостійний блок "Розподіл"
                }
            };
        });

        // Специфічний блок співвідношень (наприклад, Втрати ЗСУ проти рф) для шаблону corelstion
        // viewModel.correlations = this.prepareCorrelationData(categoriesData);

        return viewModel;*/
    }

    /**
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
    async getEventByDate(dateKeysArray) {
        try {
            if (!this.db) throw new Error("Базу даних не ініціалізовано");

            // Створюємо масив промісів (запити запускаються паралельно)
            const promises = dateKeysArray.map(dateKey =>
                this.db['ГОЧ'].where('Дата').equals(dateKey).toArray()
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
     * @param {'key'|'text'} [format='key'] - Тип формату.
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