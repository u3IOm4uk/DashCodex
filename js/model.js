/**
 * @fileoverview Модуль для роботи з базою даних. Вибірка та оновлення даних.
 * @version 1.12.0
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
        this.dbVersion = Data.global.dbVersion;
        this.dbModels = Data.global.dbModels;
        this.dbModelsOpt = Data.global.dbModelsOpt;
        this.dbModelsPrimaries = Data.global.dbModelsPrimaries;
        this.xlsSheets = Data.global.xlsSheets;
        // DB init
        if (!db && !this.db) {
            // check presets
            Data.global.debag && console.error('Model: No db presets. ', 'param: ', db, 'Model.db: ', this.db);
        } else {
            // dexie DB initialisation
            this.db = db;
            /// db init
            this.db.version(this.dbVersion).stores(this.getDexieStores());
            /*this.db.open()
                .then(() => console.log("Models: Базу даних успішно створено/відкрито!"))
                .catch(err => Data.global.debag && console.error("Models: Помилка відкриття БД:", err));*/
        }

        this.init();
    }
    //TODO: CLEAN [Models] Models.init description
    init() {

    }

    //=============================
    // Моделі сторінок
    //=============================
    /**
     * Збір та агрегація даних для Головного Дашборду (Таблиця ГОЧ)
     * @async
     * @see {@link getDatesInRange} Генерація масиву дат у заданому інтервалі.
     * @see {@link getEventByDate} Асинхронна вибірка даних із таблиць IndexedDB ('ГОЧ', 'Застосування БК та FPV').
     * @see {@link Models.getWarDay} Отримання поточного дня війни.
     * @see {@link Models.getNum} Безпечне витягування числових значень із рядків БД.
     * @see {@link Models.getDateFormat} Форматування дат для текстового відображення та input-полів.
     * @see {@link buildDashBoardUnits} Модульний виклик: побудова ViewModel підрозділів.
     * @see {@link buildDashBoardCategories} Модульний виклик: побудова ViewModel категорій та загального радара.
     * @see {@link buildDashBoardUnitTrends} Модульний виклик: побудова тенденцій підрозділів та великого тренду.
     * @see {@link buildDashBoardRadar} Модульний виклик: побудова конфігурацій та моделей радарного графіка.
     * @see {@link buildDashBoardCorrelations} Модульний виклик: співвідношення даних ГОЧ та FPV/БК.
     * @see {@link buildDashBoardDrones} Модульний виклик: статистика використання БпС противника.
     * @see {@link buildCarouselSlides} Модульний виклик: формування слайдів каруселі.
     * @see {@link deepMerge} Об'єднання об'єктів конфігурації графіків у підсумковий `chartReg`.
     * 
     * @requires Data.page.DashBoard Глобальні конфігурації та списки категорій сторінки Дашборду.
     * @requires Data.global Глобальні структури підрозділів та ключів даних (`units`, `unitStructure`, `unitsKey`).
     * 
     * @param {Object} filter - Об'єкт параметрів фільтрації.
     * @param {string|Date} [filter.from] - Початкова дата фільтрації (за замовчуванням — поточна дата).
     * @param {string|Date} [filter.to] - Кінцева дата фільтрації (за замовчуванням — поточна дата).
     * @param {string} filter.activeCategory - Назва активної обраної категорії (наприклад, 'БпС противника').
     * @param {Object} [filter.op] - Додаткові конфігурації категорії.
     * 
     * @returns {Promise<DashBoardViewModel>} Проміс, що повертає повну структуру моделі сторінки з картками, слайдами каруселі та реєстром ApexCharts (`chartReg`).
     */
    //TODO UPDATE [Models.pageDashBoard] додати обробку дат, підкатегорії, змінити ієрархію.
    //TODO TASK [Models.pageDashBoard] нова категорія "просування" м^2 + -. Додати слайд з відповідним графіком загальним і по угрупованням (це може в деталі)
    //TODO TASK [Models.pageDashBoard] об'єднати категорії штурмові дії та штурмові тривають - вивести окремим слайдом ті що тривають за поточну дату (вказати в заголовку)
    //TODO TASK [Models.pageDashBoard,Models.pageOVgP] створити універсальний метод для вироблення моделі сторінки
    //TODO FIX [Models.pageDashBoard,Models.pageOVgP] вивести легенду на загальний тренд за період
    //TODO TASK [Models] універсальний метод збору моделі кастомно.
    async pageDashBoard(filter) {
        const Name = 'DashBoard';
        const unitsKey = Data.page[Name].unitsKey || Data.global.unitsKey;
        const from = (filter && filter.from) || new Date();
        const to = (filter && filter.to) || new Date();
        let { activeCategory } = filter;
        if (!Data.page[Name].categories.includes(activeCategory)) {
            activeCategory = Data.page[Name].categories[0];
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const isSingleDate = fromDate.getFullYear() === toDate.getFullYear() &&
            fromDate.getMonth() === toDate.getMonth() &&
            fromDate.getDate() === toDate.getDate();

        const datesForCards = this.getDatesInRange(from, to);

        let datesToFetch = [];
        if (isSingleDate) {
            
            const targetDate = new Date(fromDate);
            targetDate.setHours(0, 0, 0, 0);

            const diffInDays = Math.floor((todayDate - targetDate) / (1000 * 60 * 60 * 24));
            let startDate = new Date(targetDate);
            let endDate = new Date(targetDate);

            if (diffInDays <= 3) {
                endDate = new Date(todayDate);
                startDate = new Date(todayDate);
                startDate.setDate(startDate.getDate() - 6);
            } else {
                startDate.setDate(startDate.getDate() - 3);
                endDate.setDate(endDate.getDate() + 3);
            }
            datesToFetch = this.getDatesInRange(startDate, endDate);
        } else {
            datesToFetch = this.getDatesInRange(from, to);
        }

        let datesToChart = [...datesToFetch];

        const rawData = await this.getEventByDate(datesToFetch, 'ГОЧ');
        const rawDataToday = await this.getEventByDate([Models.getDateFormat(todayDate)], 'ГОЧ');
        const actData = await this.getEventByDate(datesToFetch, 'Застосування БК та FPV');

        const warDay = Models.getWarDay();
        const chartReg = {};

        // КРОК 1 & 2. Hierarchy Map (Залишаємо швидку побудову)
        const hierarchyMap = new Map();

        // Допоміжна функція для генерації Map категорій зі значеннями 0
        const createCategoryMap = () => {
            const catMap = new Map();
            Data.page[Name].categories.forEach(catKey => {
                const dbKeys = Data.page[Name].categoriesByKey[catKey];
                if (Array.isArray(dbKeys)) {
                    dbKeys.forEach(k => catMap.set(k, 0));
                } else if (dbKeys) {
                    catMap.set(dbKeys, 0);
                }
            });
            return catMap;
        };

        // 1. ІНІЦІАЛІЗАЦІЯ СТРУКТУРИ HIERARCHY MAP
        datesToFetch.forEach(date => {
            const unitsMap = new Map();

            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;

                // Додаємо головне угруповання
                unitsMap.set(unitKey, createCategoryMap());

                // Якщо є підрозділи (squad), додаємо кожен з них
                if (Array.isArray(config.squad) && config.squad.length > 0) {
                    config.squad.forEach(subunitKey => {
                        unitsMap.set(subunitKey, createCategoryMap());
                    });
                }
            });

            hierarchyMap.set(date, unitsMap);
        });

        // 2. НАПОВНЕННЯ ДАНИМИ З rawData
        datesToFetch.forEach(date => {
            const dayUnitsMap = hierarchyMap.get(date);
            if (!dayUnitsMap) return;

            const dayRows = rawData.filter(row => row && row['Дата'] === date);

            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;

                // --- А. Заповнюємо дані для головного угруповання ---
                const targetUnitDbKeys = dayUnitsMap.get(unitKey);
                if (targetUnitDbKeys) {
                    const targetName = config.nameMd;
                    const row = dayRows.find(r => r[unitsKey] === targetName);

                    targetUnitDbKeys.forEach((_, dbKey) => {
                        targetUnitDbKeys.set(dbKey, row ? Models.getNum(row, dbKey) : 0);
                    });
                }

                // --- Б. Заповнюємо дані для всіх підрозділів у squad ---
                if (Array.isArray(config.squad) && config.squad.length > 0) {
                    config.squad.forEach(subunitKey => {
                        const targetSubunitDbKeys = dayUnitsMap.get(subunitKey);
                        if (!targetSubunitDbKeys) return;

                        // Якщо назва підрозділу збігається з його ключем або окремим іменем
                        const subRow = dayRows.find(r => r[unitsKey] === subunitKey);

                        targetSubunitDbKeys.forEach((_, dbKey) => {
                            targetSubunitDbKeys.set(dbKey, subRow ? Models.getNum(subRow, dbKey) : 0);
                        });
                    });
                }
            });
        });

        const dbKeysActive = Data.page[Name].categoriesByKey[activeCategory];
        const isMultiActive = Array.isArray(dbKeysActive);
        //-------------------------
        // МОДУЛЬНІ ВИКЛИКИ
        //-------------------------
        // 1. Підрозділи (Units)
        const descrUnits = {};
        if (activeCategory === 'Території') {
            descrUnits.model = 'buildDescrArea';
            descrUnits.classContainer = ['DescrArea'];
        }
        const { items: unitsViewModel, chartReg: unitsChartReg } = this.buildDashBoardUnits({
            datesForCards, rawData, hierarchyMap, activeCategory, dbKeysActive, isMultiActive, pageName: Name, descr:descrUnits
        });
        this.deepMerge(chartReg, unitsChartReg);

        // 2. Категорії (Categories)
        const descrCategoriesViewModel = {
            'Втрати ос': {
                model: 'buildDescrLossPersonal',
                classContainer: ['DescrCategoryLossPersonal'],
            }
        };
        const categoriesViewModelResult = this.buildDashBoardCategories({ catModelName: 'categories', datesToFetch, datesForCards, datesToChart, isSingleDate, rawData, activeCategory, pageName: Name, totalDBKey: Data.page[Name].categoriesByRelations, searchKey: unitsKey, descr: descrCategoriesViewModel });
        const categoriesViewModel = categoriesViewModelResult.items;
        const catModelName = categoriesViewModelResult.global.catModelName;
        const totalRadar = categoriesViewModelResult.global.totalRadarStr;
        this.deepMerge(chartReg, categoriesViewModelResult.global.chartReg);

        // 3. Тенденції підрозділів (Trends)
        const descrTrendsViewModel = {};
        if (activeCategory === 'Втрати ос') {
            descrTrendsViewModel.big = {
                model: 'buildDescrLoss',
                classContainer:['DescrAverageLoss']
            }
        }
        const { items: unitsTrendsViewModel, totalTrendBigModel, chartReg: trendsChartReg } = this.buildDashBoardUnitTrends({
            datesToFetch, datesForCards, datesToChart, hierarchyMap, activeCategory, dbKeysActive, isMultiActive, isSingleDate, rawData, totalRadar, pageName: Name, descr: descrTrendsViewModel
        });
        this.deepMerge(chartReg, trendsChartReg);

        // 4. Радар (Radar)
        const { radarModel, radarBigModel, chartReg: radarChartReg } = this.buildDashBoardRadar({
            unitsViewModel, isMultiActive, dbKeysActive, activeCategory, totalRadar, pageName: Name
        });
        this.deepMerge(chartReg, radarChartReg);
        if (activeCategory !== 'Території') {
            unitsViewModel.push(radarModel);
        }


        // 5. Співвідношення (Correlations)
        const correlationsViewModelRes = this.buildDashBoardCorrelations({ datesForCards, rawData, actData, pageName: Name });
        const correlationsViewModel = correlationsViewModelRes.items;
        this.deepMerge(chartReg, correlationsViewModelRes.chartReg);

        // 6. Дрони (Drones)
        let droneTrendsViewModel = [];
        if (activeCategory === 'БпС противника') {
            const droneRes = this.buildDashBoardDrones({ datesForCards, rawData, pageName: Name });
            droneTrendsViewModel = droneRes.items;
            this.deepMerge(chartReg, droneRes.chartReg);
        }

        // 7. Текстовий блок
        let unitTextModel = null;
        if (activeCategory === 'Території') {
            unitTextModel = this.buildUnitTextModel({
                datesToFetch, datesForCards, isSingleDate, rawData, rawDataToday, activeCategory, pageName: Name
            });
            // unitsViewModel.unshift(unitTextModel);
            unitTextModel.cssClass = 'item-unit-text-block';
            unitsViewModel.push(unitTextModel);
        }
        
        // 8. Рух переднього краю
        const descrFrontier = {};
        if (activeCategory === 'Території') {
            descrFrontier.model = 'buildDescrFrontier';
            descrFrontier.classContainer = ['DescrFrontier'];
        }
        let unitFrontierModel = null;
        if (activeCategory === 'Території') {
            const { items, chartReg: unitFrontierChartReg } = this.buildDashBoardFrontier({
                datesToFetch, datesForCards, isSingleDate, rawData, rawDataToday, activeCategory, pageName: Name, unitsKey: null, descr: descrFrontier, hierarchyMap
            });
            unitFrontierModel = items;
            this.deepMerge(chartReg, unitFrontierChartReg);
        }

        // FINAL. Карусель та результат
        // Блок підготовки назви слайду
        const slideTitle = Data.page[Name].categoriesByHeader[activeCategory] ||
            Data.page[Name].categoriesByTitle[activeCategory] ||
            activeCategory;

        const carouselSlides = this.buildCarouselSlides({
            activeCategory,
            slideTitle,
            models: {
                unitsViewModel,
                unitsTrendsViewModel,
                radarBigModel,
                totalTrendBigModel,
                droneTrendsViewModel,
                unitFrontierModel,
                unitTextModel
            },
            pageName: Name
        });

        return {
            id: 'page' + Name,
            warDay: warDay,
            activeCategoryHeader: Data.page[Name].categoriesByHeader[activeCategory] || Data.page[Name].categoriesByTitle[activeCategory] || activeCategory,
            pageContainer: [{
                id: 'pageContainer',
                tpl: 'tpl-page-container',
                [catModelName]: categoriesViewModel,
                slideContent: [{
                    id: 'slideContent',
                    tpl: 'slide-content',
                    carousel: carouselSlides
                }],
                correlations: correlationsViewModel,
            }],
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
     * Збір, агрегація даних та формування підсумкової ViewModel для сторінки "ОВгП".
     * 
     * Для використання ф-налу btnDetaile треба до кнопки прив'язати JSON з моделью відображення (відображатиметься через буферний шаблон)
     * та вказати модель яка відпрацьовуватиме контент для відображення. Див. btnDetaileModel.
     * 
     * @async
     * @see {@link getDatesFromFilter} Парсинг та підготовка дат, інтервалів і прапорців для карток та графіків з об'єкта фільтра.
     * @see {@link getEventByDate} Асинхронна вибірка записів із таблиць IndexedDB ('ОВгП', 'ГОЧ', 'Застосування БК та FPV').
     * @see {@link mergeAllTables} Об'єднання результатів паралельних запитів з різних таблиць БД в єдину структуру `rawData`.
     * @see {@link Models.getWarDay} Отримання поточного дня війни.
     * @see {@link Models.getNum} Безпечне перетворення та витягування числових значень із рядків БД.
     * @see {@link Models.getDateFormat} Форматування дат для текстового відображення та input-полів.
     * @see {@link buildDashBoardUnits} Модульний виклик: побудова ViewModel підрозділів (для основної категорії та підкатегорій).
     * @see {@link buildDashBoardCategories} Модульний виклик: побудова ViewModel основних категорій та підкатегорій.
     * @see {@link buildDashBoardUnitTrends} Модульний виклик: побудова графіків тенденцій для підрозділів та загальних трендів.
     * @see {@link buildDashBoardRadar} Модульний виклик: побудова радарних діаграм (із генерацією кнопок деталізації `btnDetaile`).
     * @see {@link buildDashBoardCorrelations} Модульний виклик: обчислення співвідношень між даними ОВгП/ГОЧ та БК/FPV.
     * @see {@link buildCarouselSlides} Модульний виклик: збірка та структурування слайдів каруселі (включаючи `subModel`).
     * @see {@link deepMerge} Об'єднання об'єктів конфігурації графіків ApexCharts у загальний `chartReg`.
     * 
     * @requires Data.page.OVgP Глобальні конфігурації, зв'язки категорій та підкатегорій сторінки ОВгП.
     * @requires Data.global Глобальні структури підрозділів та ключів даних (`units`, `unitStructure`, `unitsKey`).
     * @requires Data.text.detail Текст для відображення на кнопках деталізації.
     * 
     * @param {Object} filter - Об'єкт параметрів фільтрації та налаштувань.
     * @param {string} filter.activeCategory - Назва активної обраної категорії.
     * @param {string|Date} [filter.from] - Початкова дата інтервалу.
     * @param {string|Date} [filter.to] - Кінцева дата інтервалу.
     * @param {Object} [filter.opt] - Опціональний об'єкт кастомних конфігурацій сторінки для перевизначення за замовчуванням.
     * @param {Array<string>} [filter.opt.categories] - Кастомний перелік доступних категорій.
     * @param {Object} [filter.opt.categoriesByKey] - Маппінг ключів категорій на ключі БД.
     * @param {Object} [filter.opt.categoriesByTitle] - Маппінг назв заголовків категорій.
     * @param {Object} [filter.opt.categoriesByHeader] - Маппінг шапок категорій.
     * @param {Object} [filter.opt.categoriesByRelations] - Конфігурація зв'язків та задекларованих ключових показників.
     * 
     * @returns {Promise<OVgPViewModel>} Проміс, що повертає повну структуру моделі сторінки OVgP (картки, слайди каруселі з підкатегоріями, кореляції, реєстр `chartReg`).
     */
    //TODO: REFACTOR [Models.pageOVgP,Models.pageDashBoard] hierarchyMap = new Map() треба переробити на {} (у всіх моделях сторінок). це використовується по всім моделям віджетів.
    //TODO: TASK [Models.pageOVgP] співвідношення - всунути в слайд і показувати БК/ВЗ для підкатегорії (по калібрам)
    async pageOVgP(filter) {
        const Name = 'OVgP';
        const unitsKey = Data.page[Name].unitsKey || Data.global.unitsKey;
        const categories = (filter.opt && filter.opt.categories) || Data.page[Name].categories;
        const catByKey = (filter.opt && filter.opt.categoriesByKey) || Data.page[Name].categoriesByKey;
        const catByTitle = (filter.opt && filter.opt.categoriesByTitle) || Data.page[Name].categoriesByTitle;
        const catByHeader = (filter.opt && filter.opt.categoriesByHeader) || Data.page[Name].categoriesByHeader;
        const catByRel = (filter.opt && filter.opt.categoriesByRelations) || Data.page[Name].categoriesByRelations;
        (filter.opt && console.log('filter',filter))
        // Виклик функції обробки дат
        const {
            from,
            to,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        } = this.getDatesFromFilter(filter);

        let { activeCategory } = filter;
        if (!categories.includes(activeCategory)) {
            activeCategory = categories[0];
        }

        // 2. Вибираємо з визначених таблиць БД дані
        const rawTables = ['ОВгП', 'ГОЧ'];
        const fetchPromises = rawTables.map(async (table) => {
            const data = await this.getEventByDate(datesToFetch, table);
            return { table, data };
        });
        const results = await Promise.all(fetchPromises);
        const rawData = this.mergeAllTables(results, datesToFetch);
        // const rawData = await this.getEventByDate(datesToFetch, 'ОВгП');
        // const rawData = await this.getEventByDate(datesToFetch, 'ГОЧ');
        const actData = await this.getEventByDate(datesToFetch, 'Застосування БК та FPV');

        const warDay = Models.getWarDay();
        const chartReg = {};

        // КРОК 1 & 2. Hierarchy Map (з підтримкою підкатегорій)
        const pageData = Data.page[Name];
        const subcatByKey = pageData.subcategoriesByKey || {};

        // 1. Збираємо унікальний список усіх ключів категорій та підкатегорій
        const allCatKeys = Array.from(new Set([
            ...categories,
            ...Object.keys(subcatByKey)
        ]));

        const hierarchyMap = new Map(); 

        // 2. Ініціалізація hierarchyMap порожніми значеннями (0) для всіх ключів
        datesToFetch.forEach(date => {
            const unitsMap = new Map();
            Data.global.units.forEach(unitKey => {
                const dbKeysMap = new Map();

                allCatKeys.forEach(catKey => {
                    // Шукаємо ключі БД в основних категоріях, якщо немає — у підкатегоріях
                    const dbKeys = catByKey[catKey] || subcatByKey[catKey];
                    if (!dbKeys) return;

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
        
        datesToFetch.forEach(date => {
            const dayUnitsMap = hierarchyMap.get(date);
            const dayRows = rawData.filter(row => row && row['Дата'] === date);

            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;
                const targetUnitDbKeys = dayUnitsMap.get(unitKey);
                const targetName = config.nameMd;
                const row = dayRows.find(r => r[unitsKey] === targetName);

                Array.from(targetUnitDbKeys.keys()).forEach(dbKey => {
                    targetUnitDbKeys.set(dbKey, row ? Models.getNum(row, dbKey) : 0);
                });
            });
        });

        const dbKeysActive = catByKey[activeCategory];
        const isMultiActive = Array.isArray(dbKeysActive);
        //-------------------------
        // МОДУЛЬНІ ВИКЛИКИ
        //-------------------------
        // 1. Підрозділи (Units)
        const { items: unitsViewModel, chartReg: unitsChartReg } = this.buildDashBoardUnits({
            datesForCards, rawData, hierarchyMap, activeCategory, dbKeysActive, isMultiActive, pageName: Name
        });
        this.deepMerge(chartReg, unitsChartReg);
        // 2. Категорії (Categories)
        const categoriesViewModelResult = this.buildDashBoardCategories({ catModelName: 'categories', datesToFetch, datesForCards, datesToChart, isSingleDate, rawData, activeCategory, pageName: Name, totalDBKey: catByRel, searchKey: unitsKey });
        const categoriesViewModel = categoriesViewModelResult.items;
        const catModelName = categoriesViewModelResult.global.catModelName;
        const totalRadar = categoriesViewModelResult.global.totalRadarStr;
        this.deepMerge(chartReg, categoriesViewModelResult.global.chartReg);
        
        // 3. Тенденції підрозділів (Trends)
        const { items: unitsTrendsViewModel, totalTrendBigModel, chartReg: trendsChartReg } = this.buildDashBoardUnitTrends({
            datesToFetch, datesForCards, datesToChart, hierarchyMap, activeCategory, dbKeysActive, isMultiActive, isSingleDate, rawData, totalRadar, pageName: Name
        });
        this.deepMerge(chartReg, trendsChartReg);

        // 4. Радар (Radar)
        const { radarModel, radarBigModel, chartReg: radarChartReg } = this.buildDashBoardRadar({
            unitsViewModel, isMultiActive, dbKeysActive, activeCategory, totalRadar, pageName: Name
        });
        this.deepMerge(chartReg, radarChartReg);
        unitsViewModel.push(radarModel);

        // 5. Співвідношення (Correlations)
        const correlationsViewModelRes = this.buildDashBoardCorrelations({ datesForCards, rawData, actData, pageName: Name });
        const correlationsViewModel = correlationsViewModelRes.items;
        this.deepMerge(chartReg, correlationsViewModelRes.chartReg);

        // 6. Дрони (Drones)
        // let droneTrendsViewModel = [];
        // if (activeCategory === 'БпС противника') {
        //     const droneRes = this.buildDashBoardDrones({ datesForCards, rawData, pageName: Name });
        //     droneTrendsViewModel = droneRes.items;
        //     this.deepMerge(chartReg, droneRes.chartReg);
        // }
        
        // підкатегорії
        let subcategoriesModelResult = null;
        let subcategoriesModel = null;
        let subModel = {};
        const isSubSubMulti = (isMulti) => {
            return isMulti;
        };
        
        const subCatList = pageData.categoriesBySub?.[activeCategory];
        if (Array.isArray(subCatList) && subCatList.length > 0) {
            let byRel = null;
            if (pageData.subcategoriesByRelations) {
                byRel = Object.fromEntries(
                    Object.entries(pageData.subcategoriesByRelations).filter(([key]) => subCatList.includes(key))
                );
            }
            
            // 1. Отримуємо моделі підкатегорій для верхніх карток (передаємо route = 'subcategories')
            subcategoriesModelResult = this.buildDashBoardCategories({
                catModelName: 'subcategories',
                datesToFetch,
                datesForCards,
                datesToChart,
                isSingleDate,
                rawData,
                activeCategory: subCatList[0], // Перша підкатегорія за замовчуванням
                pageName: Name,
                totalDBKey: byRel || pageData.categoriesByRelations,
                searchKey: unitsKey,
                route: 'subcategories',
                subCatList // свій набір категорій
            });
            subcategoriesModel = subcategoriesModelResult.items.filter(it => subCatList.includes(it.category_key));
            if (subcategoriesModelResult?.global?.chartReg) {
                this.deepMerge(chartReg, subcategoriesModelResult.global.chartReg);
            }
            
            // 2. Ітерація по підкатегоріях активної категорії
            subCatList.forEach(subCatName => {
                const subDbKeys = pageData.subcategoriesByKey?.[subCatName];
                if (!subDbKeys) return;
                if (!subModel[subCatName]) subModel[subCatName] = {}; 
                const isSubMulti = Array.isArray(subDbKeys);

                // А) Побудова Units для підкатегорії
                const { items: unitModel, chartReg: subUnitChartReg } = this.buildDashBoardUnits({
                    datesForCards,
                    rawData,
                    hierarchyMap,
                    activeCategory: subCatName,
                    dbKeysActive: subDbKeys,
                    isMultiActive: isSubMulti,
                    pageName: Name
                });
                subModel[subCatName].unitsViewModel = unitModel;
                if (subUnitChartReg) this.deepMerge(chartReg, subUnitChartReg);

                // Б) Отримання total_value з побудованої раніше категорії для Радара
                const subCatInfo = subcategoriesModelResult.items.find(item => item.category_key === subCatName);
                const subTotalRadar = subCatInfo ? subCatInfo.total_value : 0;

                const btnDetaileModel = (type) => {
                    const modelDetail = {
                        cat: subCatName,
                        type,
                        model: 'buildDescrAmmo',
                        depth: true,
                    };
                    return {
                        tpl: 'tpl-btn-detaile',
                        id: `tpl-btn-detaile:${subCatName}-descr`, // Views.DOM element key (renderId)
                        textDetail: Data.text.detail,
                        modelDetail: JSON.stringify(modelDetail)
                    };
                };
                
                // В) Radar (Отримуємо і radarModel, і radarBigModel!)
                const {
                    radarModel: subRadarModel,
                    radarBigModel: subRadarBigModel,
                    chartReg: subRadarChartReg
                } = this.buildDashBoardRadar({
                    unitsViewModel: unitModel,
                    isMultiActive: isSubSubMulti(isSubMulti),
                    dbKeysActive: isSubMulti ? subDbKeys : [subDbKeys],
                    activeCategory: subCatName,
                    totalRadar: subTotalRadar,
                    pageName: Name
                });
                subRadarModel.btnDetaile = [btnDetaileModel('radar')];
                subRadarBigModel.btnDetaile = [btnDetaileModel('radar')];
                // if (!subModel[subCatName].radarModel) subModel[subCatName].radarModel = [];
                // if (!subModel[subCatName].radarBigModel) subModel[subCatName].radarBigModel = [];
                // subModel[subCatName].radarModel.push(subRadarModel);
                // subModel[subCatName].radarBigModel.push(subRadarBigModel || null);
                subModel[subCatName].radarModel = subRadarModel;
                subModel[subCatName].radarBigModel = subRadarBigModel || null;
                if (subRadarChartReg) this.deepMerge(chartReg, subRadarChartReg);

                // Г) Побудова Трендів для підкатегорії
                const {
                    items: trendModel,
                    totalTrendBigModel: subTotalTrendBigModel,
                    chartReg: subTrendChartReg
                } = this.buildDashBoardUnitTrends({
                    datesToFetch,
                    datesForCards,
                    datesToChart,
                    hierarchyMap,
                    activeCategory: subCatName,
                    dbKeysActive: subDbKeys,
                    isMultiActive: isSubMulti,
                    isSingleDate,
                    rawData,
                    totalRadar: subTotalRadar,
                    pageName: Name
                });
                trendModel.btnDetaile = [btnDetaileModel('area')];
                subTotalTrendBigModel.btnDetaile = [btnDetaileModel('area')];
                // if (!subModel[subCatName].trendsViewModel) subModel[subCatName].trendsViewModel = [];
                // if (!subModel[subCatName].totalTrendBigModels) subModel[subCatName].totalTrendBigModels = []; 
                // subModel[subCatName].trendsViewModel.push(trendModel);
                // subModel[subCatName].totalTrendBigModels.push(subTotalTrendBigModel || null); 
                subModel[subCatName].unitsTrendsViewModel = trendModel;
                subModel[subCatName].totalTrendBigModel = subTotalTrendBigModel || null;
                if (subTrendChartReg) this.deepMerge(chartReg, subTrendChartReg);
            });
        }
        // 7. Карусель та результат
        // Блок підготовки назви слайду
        const slideTitle = catByHeader[activeCategory] ||
            catByTitle[activeCategory] ||
            activeCategory;

        const carouselSlides = this.buildCarouselSlides({
            activeCategory,
            slideTitle,
            models: {
                unitsViewModel,
                unitsTrendsViewModel,
                radarBigModel,
                totalTrendBigModel,
                // droneTrendsViewModel,
                ...subModel,
            },
            pageName: Name
        });
        // Модель сторінки
        return {
            id: 'page' + Name,
            warDay: warDay,
            activeCategoryHeader: catByHeader[activeCategory] || catByTitle[activeCategory] || activeCategory,
            pageContainer: [{
                id: 'pageContainer',
                tpl: 'tpl-page-container',
                [catModelName]: categoriesViewModel,
                slideContent: [{
                    id: 'slideContent',
                    tpl: 'slide-content',
                    carousel: carouselSlides
                }],
                correlations: correlationsViewModel,
            }],
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

    //===================================================================================
    // Моделі елементів
    //===================================================================================

    buildUnitTextModel({ datesToFetch, datesForCards, isSingleDate, rawData, rawDataToday, activeCategory, pageName, unitsKey, descr }) {
        const dataPage = Data.page[pageName];
        const dbKeys = dataPage.categoriesByKey[activeCategory];
        const dbKeyPerYear = ['втрати_територій_сумарно', 'відновлено_територій_сумарно'];
        const summarize = (acc, row, key) => Models.fix(acc + Models.getNum(row, key));
        // Збираємо модель для текстового ітема (залежно від кількості ключів)
        const cardItemsYear = dbKeyPerYear.map((key,ind) => {
            let sum = 0;
            rawDataToday.forEach(row => {
                // console.log('unitsKey', unitsKey,unitsKey === row[Data.global.unitsKey])
                //беремо суму за рік
                if (unitsKey) {
                    if (unitsKey === row[Data.global.unitsKey]) {
                        sum = summarize(sum, row, key);
                    }
                } else {
                    if (dataPage.categoriesByRelations[activeCategory].includes(row[Data.global.unitsKey])) {
                        sum = summarize(sum, row, key);
                    }
                }
                
            });
            return {
                //sets
                tpl: 'tpl-text-card-item',
                id: `tpl-text-card-item:${activeCategory}:${key}`,
                //attr
                cssClass: ind!=0 ? 'positive' : 'negative',
                //field
                textTitle: dataPage.categoriesByTitle[key] || key,
                textNumber: sum,
                textMeasure: ' км<span style="vertical-align: super; font-size:0.5rem">2</span>',
                //tpl
            };
        });
        const cardItemsPeriod = dbKeys.map((key,ind) => {
            //рахуємо суму за вказаний період
            let sum = 0;
            datesForCards.forEach(date => {
                rawData.forEach(row => {
                    if (row['Дата'] === date) {
                        if (unitsKey) {
                            if (unitsKey === row[Data.global.unitsKey]) {
                                sum = summarize(sum, row, key);
                            }
                        } else {
                            if (dataPage.categoriesByRelations[activeCategory].includes(row[Data.global.unitsKey])) {
                                sum = summarize(sum, row, key);
                            }
                        }
                    }
                    
                    
                });
            });

            return {
                //sets
                tpl: 'tpl-text-card-item',
                id: `tpl-text-card-item:${activeCategory}:${key}:${unitsKey ? unitsKey : ''}`,
                //attr
                cssClass: ind != 0 ? 'positive' : 'negative',
                //field
                textTitle: dataPage.categoriesByTitle[key],
                textNumber: sum,
                textMeasure: ' км<span style="vertical-align: super; font-size:0.5rem">2</span>',
                //tpl
            };
        });
        const btnDetaile = [];
        if (descr?.model) {
            btnDetaile.push({
                //sets
                tpl: 'tpl-btn-detaile',
                id: `tpl-btn-detaile:${activeCategory}:${unitsKey ? unitsKey : ''}-descr`,
                //attr
                modelDetail: descr.model,
                //field
                textDetail: Data.text['detail'],
                //tpl
            });
        }
        return {
            //sets
            tpl:'block-detaile-info2',
            id: `block-detaile-info2:${activeCategory}${(unitsKey ? ':'+unitsKey : '')}`,
            cssClass: 'item-text-block',
            classCounter: 'd-none', //TODO: приховати якщо не треба
            //attr
            //field
            unitName: unitsKey ? unitsKey : dataPage.categoriesByTitle[activeCategory],
            value:'value',
            //tpl
            btnDetaile,
            cardItemsTotal: [
                {
                    //sets
                    tpl: 'tpl-text-card-block',
                    id: `tpl-text-card-block:${activeCategory}:Year`,
                    //attr
                    //field
                    blockTitle: Data.text['за рік'],
                    //tpl
                    cardItems: cardItemsYear,
                },
                {
                    //sets
                    tpl: 'tpl-text-card-block',
                    id: `tpl-text-card-block:${activeCategory}:Other`,
                    //attr
                    //field
                    blockTitle: Data.text['за період'],
                    //tpl
                    cardItems: cardItemsPeriod,
                }
            ],
        }
    }
    /**
     * Будує втрати площі по корпусам
     */
    async buildDescrArea({ cat, unitKey }) {
        const {
            from,
            to,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        } = this.getDatesFromFilter({ from: app.State.get('dateFrom'), to: app.State.get('dateTo') });
        const pageName = app.State.get('pageName');
        const activeCategory = app.State.get('activeCategory');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const rawData = await this.getEventByDate(datesToFetch, 'ГОЧ');
        const rawDataToday = await this.getEventByDate([Models.getDateFormat(todayDate)], 'ГОЧ');

        const model = [];
        if (Data.global.unitStructure[unitKey].squad.length > 0) {
            Data.global.unitStructure[unitKey].squad.forEach(unit => {
                const m = this.buildUnitTextModel({ datesToFetch, datesForCards, isSingleDate, rawData, rawDataToday, activeCategory, pageName, unitsKey: unit });
                model.push(m);
            });
        } else {
            const m = this.buildUnitTextModel({ datesToFetch, datesForCards, isSingleDate, rawData, rawDataToday, activeCategory, pageName, unitsKey: Data.global.unitStructure[unitKey].nameMd });
            m.classContainer = ['DescrArea'];
            model.push(m);
        }

        return {content: model}





        
        
    }
    /**
     * Збирає модель для панелі Деталі на сторінці OVgP.
     * 
     * Виводимо на базі buildOneItem -> tpl: 'block-detaile-info' набір ітемів на основі вказаної прив'язки
     * в Data.page['pageName'].subcategoriesByAmmo.
     * 
     * @see {@link getDatesFromFilter}
     * @see {@link clearToDBKey}
     * @see {@link buildOneItem}
     * 
     * @param {any} param0
     * @returns
     */
    async buildDescrAmmo({cat, type = 'radar', depth = true}) {
        const {
            from,
            to,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        } = this.getDatesFromFilter({ from: app.State.get('dateFrom'), to: app.State.get('dateTo') });
        const pageName = app.State.get('pageName');
        const ammos = Data.page[pageName].subcategoriesByAmmo[cat];
        const keys = ammos.map(ammo => {
            const dbKey = this.clearToDBKey(ammo);
            return [
                dbKey + '_вз',
                dbKey + '_бп',
            ];
        });
        const primaries = Data.global.units.reduce((acc,unit) => {
            let u = !depth
                ? [Data.global.unitStructure[unit].name]
                : (Data.global.unitStructure[unit].squad.length
                    ? Data.global.unitStructure[unit].squad
                    : [Data.global.unitStructure[unit].name]
                );
            acc.push(...u);
            return acc;
        },[]);

        const descrAmmoPromices = ammos.map(async (ammo,ind) => {
            const confOne = {
                filter: { from: app.State.get('dateFrom'), to: app.State.get('dateTo') },
                conf: {
                    db: ['ОВгП'],
                    keys: keys[ind],
                    primeTotal: ['Угруповання', 'ВСЬОГО за СО:'],
                    primaries: type !== 'area' ? primaries : [],
                    renderId: `block-detaile-info:descr-${cat}-${ammo}`,
                    title: '',
                },
                value: {
                    header: ammo,
                    separator: '/',
                },
                chart: {
                    // type: 'bar-one',
                    // type: 'bar-multiple',
                    // type: 'area',
                    type,
                },
                tpl: 'block-detaile-info',
            };
            switch (type) {
                case 'radar':
                    confOne.chart.conf = {
                        chart: {
                            height: 477,
                        },
                        plotOptions: {
                            radar: { size: 200 }
                        },
                        xaxis: {
                            labels: {
                                style: { fontSize: '1.25rem' }
                            }
                        },
                        dataLabels: {
                            enabled: true,
                        }
                    };
                    break;
                case 'area':
                    confOne.chart.conf = {
                        chart: {
                            height: 477,
                        },
                        xaxis: {
                            labels: {
                                style: { fontSize: '1.25rem' }
                            },
                            tickAmount: datesToChart.length - 1
                        },
                        annotation: {
                            isSingleDate,
                            targetDateStr: datesForCards[0],
                            value: ''
                        },
                        grid: { padding: { top: 50 } },
                        legend: {
                            show: true,
                            position: 'top',
                            horizontalAlign: 'left',
                            fontSize: '1rem',
                            labels: { colors: '#dee2e6' },
                            markers: { width: 12, height: 12, radius: 4, strokeWidth: 0, offsetX: -5 },
                            itemMargin: { horizontal: 10, vertical: 8 },
                        }
                    };
                    break;
                case 'bar-multiple':
                    confOne.chart.conf = {
                        chart: {
                            height: 16 * 2.5 * primaries.length,
                        },
                        xaxis: {
                            labels: {
                                style: { fontSize: '1.25rem' }
                            },
                        },
                    };
                    break;
            }
            const oneItemModel = await this.buildOneItem(confOne);
            return oneItemModel;
        });
        const descrAmmoModel = await Promise.all(descrAmmoPromices);
        return { content: descrAmmoModel };
    }

    /**
     * Будує модель даних дашборду категорій (ViewModel) та конфігурації графіків ApexCharts.
     * Агрегує статистику за вказаними датами, підтримує як одиночні, так і складні (мульти) категорії,
     * розраховує сумарні показники для карток і формує підсумкові дані для графіків та радарів.
     * @see {@link getDateFormat}
     * @see {@link getNum}
     * @see {@link buildChartConfig}
     * 
     * @param {string} params.catModelNameA - Альтернативна назва моделі категорій (за замовчуванням 'categories').
     * @param {Array<string>} params.datesToFetch - Масив дат для вибірки та побудови часових рядів графіків.
     * @param {Array<string>} params.datesForCards - Масив дат для підрахунку сумарних значень (total) у картках.
     * @param {Array<string|Date>} params.datesToChart - Масив дат для підписів осі X у графіках.
     * @param {boolean} params.isSingleDate - Прапор, що вказує, чи вибрано один конкретний день (для додавання анотацій).
     * @param {Array<Object>} params.rawData - Сирі дані з бази даних.
     * @param {string} params.activeCategory - Ключ поточної активної категорії.
     * @param {Object} params.descr - конфіг для кнопки деталі
     * @param {String} params.descr.model - модель яка запуститься при натисканні на кнопку
     * @returns {Object} Об'єкт, що містить список карток категорій (`items`) та глобальний реєстр графіків (`global`).
     */
    buildDashBoardCategories({ catModelName, datesToFetch, datesForCards, datesToChart, isSingleDate, rawData, activeCategory, pageName, totalDBKey, searchKey, route = 'categories', subCatList = null, descr }) {
        let totalRadar = 0;
        let totalRadarStr = '';
        const chartReg = {};
        const catListCustom = subCatList || Data.page[pageName][route];
        const chartDataLabels = {
            formatter: function (val, opts) {
                const data = opts.w.config.series[opts.seriesIndex].data;
                const i = opts.dataPointIndex;
                const totalDays = data.length;

                // 1. Якщо даних >= 60 днів (2 місяці) — підпис раз на 30 днів (в останній день місяця)
                if (totalDays >= 60) {
                    if ((i + 1) % 30 === 0 || i === totalDays - 1) {
                        return Models.fix(val);
                        // Рахуємо суму за останні 30 днів
                        /*const startIndex = Math.max(0, i - 29);
                        const sum = data.slice(startIndex, i + 1).reduce((acc, curr) => acc + curr, 0);
                        return Models.fix(sum);*/
                    }
                    return "";
                }

                // 2. Якщо даних >= 14 днів (2 тижні) — підпис раз на 7 днів (в останній день тижня)
                if (totalDays >= 14) {
                    if ((i + 1) % 7 === 0 || i === totalDays - 1) {
                        return Models.fix(val);
                        // Рахуємо суму за останні 7 днів
                        /*const startIndex = Math.max(0, i - 6);
                        const sum = data.slice(startIndex, i + 1).reduce((acc, curr) => acc + curr, 0);
                        return Models.fix(sum);*/
                    }
                    return "";
                }

                // 3. Якщо менше 14 днів — показуємо звичайне значення для кожного дня
                return val;
            },
        };

        const categoriesViewModel = catListCustom.map((catKey, ind) => {
            const dbKeys = Data.page[pageName][route+'ByKey'][catKey];
            const isCatMulti = Array.isArray(dbKeys);

            const series = [];
            let totalValueStr = '';

            // Пошук рядка
            const findTotalRow = (date) =>
                rawData.find(row => row && row['Дата'] === date && totalDBKey[catKey]?.includes(row[searchKey]));

            // Головна допоміжна функція
            const processCategoryKey = (key, nameKey = key) => {
                // 1. Одночасно рахуємо щоденні дані
                const dailyData = datesToFetch.map(date => Models.getNum(findTotalRow(date), key));
                // 2. Рахуємо суму для карток
                const cardsTotal = datesForCards.reduce((sum, date) => sum + Models.getNum(findTotalRow(date), key), 0);
                // 3. Формуємо об'єкт серії
                const name = Data.page[pageName].categoriesByTitle[nameKey] || nameKey;
                const color = Data.page[pageName].categoriesChartColor[nameKey];
                const seriesItem = { name, data: dailyData, ...(color && { color }) };
                return { seriesItem, cardsTotal, dailyData };
            };

            if (isCatMulti) {
                const tempTotalArray = dbKeys.map(k => {
                    const { seriesItem, cardsTotal } = processCategoryKey(k);
                    series.push(seriesItem);

                    if (catKey === activeCategory) {
                        totalRadar += Models.fix(cardsTotal);
                    }
                    return `<span class="val"><span class="name">${Data.page[pageName].categoriesByTitle[k]}</span> ${Models.fix(cardsTotal)}</span>`;
                });

                totalValueStr = tempTotalArray.join('|');
                if (catKey === activeCategory) {
                    totalRadarStr = totalValueStr;
                }
            } else {
                const { seriesItem, cardsTotal } = processCategoryKey(dbKeys, catKey);

                series.push(seriesItem);
                totalValueStr = Models.fix(cardsTotal);

                if (catKey === activeCategory) {
                    totalRadarStr = totalRadar = Models.fix(cardsTotal);
                }
            }

            const categories = datesToChart.map(d => Models.getDateFormat(d, 'apex'));

            // Генеруємо конфіг ApexCharts
            const chart = this.buildChartConfig({
                type: 'area',
                series,
                categories,
                customOptions: {
                    xaxis: {
                        tickAmount: datesToChart.length - 1
                    },
                    dataLabels: chartDataLabels,
                },
                annotation: {
                    isSingleDate,
                    targetDateStr: datesForCards[0],
                    value: totalValueStr
                },
            });

            const renderId = `cat-${catKey.replace(/\//g, '_')}`;
            chartReg[renderId] = chart;

            // формування конфігу для кнопки деталі
            const btnDetaile = [];
            if (descr?.[catKey]?.model) {
                const descrModel = {
                    cat: activeCategory,
                    unitKey: catKey,
                    ...descr[catKey]
                };
                const btnDetaileModel = {
                    tpl: 'tpl-btn-detaile',
                    id: '', // Views.DOM element key (renderId)
                    //attr
                    modelDetail: JSON.stringify(descrModel),
                    //field
                    textDetail: Data.text.detail,
                };
                btnDetaile.push(btnDetaileModel);
            }

            return {
                id: renderId,
                ind: ind,
                category_key: catKey,
                category_name: Data.page[pageName].categoriesByTitle[catKey] || catKey,
                total_value: totalValueStr,
                btnDetaile,
                tpl: 'block-dynamic-info',
                cssClass: catKey === activeCategory ? 'active' : '',
                chart: chart,
                chartOptName: renderId,
            };
        });

        return {
            items: categoriesViewModel,
            global: {
                chartReg: chartReg,
                totalRadar: totalRadar,
                totalRadarStr: totalRadarStr,
                catModelName: catModelName
            }
        };
    }
    /**
     * Побудова ViewModel та конфігурацій графіків для військових підрозділів (Units).
     * Метод розраховує статистику з урахуванням ієрархічної структури (підрозділи та їхні підпорядковані загони/squads),
     * підтримує як одиночні, так і складні (мульти) активні категорії, та генерує відповідні Bar-графіки.
     * @see {@link getNum}
     * @see {@link buildChartConfig}
     * 
     * @param {Object} params - Об'єкт параметрів функціоналу.
     * @param {Array<string>} params.datesForCards - Масив дат, за які підраховується агрегована статистика.
     * @param {Array<Object>} params.rawData - Масив сирих даних із бази даних.
     * @param {Map<string, Map<string, Map<string, number>>>} params.hierarchyMap - Ієрархічна Map-структура значень [Дата -> Юніт -> Категорія].
     * @param {string} params.activeCategory - Назва/ключ поточної активної категорії.
     * @param {string|Array<string>} params.dbKeysActive - Ключ або масив ключів БД для активної категорії.
     * @param {boolean} params.isMultiActive - Прапор, що вказує, чи є активна категорія мульти-категорією (масивом ключів).
     * @param {Object} params.descr - конфіг для кнопки деталі
     * @param {String} params.descr.model - модель яка запуститься при натисканні на кнопку
     * @returns {{ items: Array<Object>, chartReg: Object }} Об'єкт із підготовленими картками підрозділів (`items`) та реєстром конфігурацій графіків (`chartReg`).
     */
    buildDashBoardUnits({ datesForCards, rawData, hierarchyMap, activeCategory, dbKeysActive, isMultiActive, pageName, descr }) {
        const chartReg = {};
        const items = Data.global.units.map(unitKey => {
            const config = Data.global.unitStructure[unitKey];
            if (!config) return null;

            let totalValueForUnit = 0;
            const totalValueMulti = {};
            if (isMultiActive) dbKeysActive.forEach(k => totalValueMulti[k] = 0);
            // 1. Агрегація підсумкових значень за датами
            datesForCards.forEach(date => {
                const dayUnitsMap = hierarchyMap.get(date);
                if (!dayUnitsMap) return;
                const targetUnitDbKeys = dayUnitsMap.get(unitKey);

                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        const val = targetUnitDbKeys.get(k) || 0;
                        totalValueMulti[k] = Models.fix(totalValueMulti[k]+val);
                        totalValueForUnit = Models.fix(totalValueForUnit+val);
                    });
                } else {
                    totalValueForUnit += Models.fix(targetUnitDbKeys.get(dbKeysActive)) || 0;
                }
            });

            const series = [];
            let categories = [];
            const isSingleUnitWithoutSquad = !config.squad || config.squad.length === 0;

            // 2. Підготовка series та categories залежно від наявності squad
            if (!isSingleUnitWithoutSquad) {
                const chartSquadData = isMultiActive ? {} : [];
                if (isMultiActive) dbKeysActive.forEach(k => chartSquadData[k] = new Array(config.squad.length).fill(0));

                config.squad.forEach((squadName, sIdx) => {
                    let squadTotal = 0;
                    datesForCards.forEach(date => {
                        const squadRow = rawData.find(row => row && row['Дата'] === date && row['Угруповання'] === squadName);
                        if (squadRow) {
                            if (isMultiActive) {
                                dbKeysActive.forEach(k => {
                                    chartSquadData[k][sIdx] = Models.fix(chartSquadData[k][sIdx] + Models.getNum(squadRow, k));
                                });
                            } else {
                                squadTotal = Models.fix(squadTotal+Models.getNum(squadRow, dbKeysActive));
                            }
                        }
                    });
                    if (!isMultiActive) chartSquadData.push(squadTotal);
                });

                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        const s = { name: Data.page[pageName].categoriesByTitle[k] || k, data: chartSquadData[k] };
                        if (Data.page[pageName].categoriesChartColor[k]) s.color = Data.page[pageName].categoriesChartColor[k]; //TODO: UPDATE [Models.buildDashBoardUnits] зробити базово ще перевірку на Data.global
                        series.push(s);
                    });
                } else {
                    series.push({
                        name: Data.page[pageName].categoriesByTitle[activeCategory] || activeCategory,
                        data: chartSquadData
                    });
                }
                categories = config.squad;
            } else {
                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        const s = { name: Data.page[pageName].categoriesByTitle[k] || k, data: [totalValueMulti[k]] };
                        if (Data.page[pageName].categoriesChartColor[k]) s.color = Data.page[pageName].categoriesChartColor[k]; //TODO: UPDATE [Models.buildDashBoardUnits] зробити базово ще перевірку на Data.global
                        series.push(s);
                    });
                } else {
                    series.push({ data: [totalValueForUnit] });
                }
                categories = [config.nameMd];
            }

            // 3. Генерація конфігурації черезbuildChartConfig
            const chartType = isMultiActive ? 'bar-multiple' : 'bar-one';
            const chart = this.buildChartConfig({
                type: chartType,
                series,
                categories,
                customOptions: isSingleUnitWithoutSquad ? { chart: { height: 130 } } : {}
            });

            chartReg[unitKey] = chart;

            const totalSumPerKeyA = [];
            
            if (isMultiActive) dbKeysActive.forEach(k => totalSumPerKeyA.push(`<span class="val"><span class="name">${Data.page[pageName].categoriesByTitle[k]}</span> ${totalValueMulti[k]}</span>`));

            // 4. формування конфігу для кнопки деталі
            const btnDetaile = [];
            if (descr?.model) {
                const descrModel = {
                    cat: activeCategory,
                    unitKey,
                    ...descr
                };
                const btnDetaileModel = {
                    tpl: 'tpl-btn-detaile',
                    id: '', // Views.DOM element key (renderId)
                    //attr
                    modelDetail: JSON.stringify(descrModel),
                    //field
                    textDetail: Data.text.detail,
                };
                btnDetaile.push(btnDetaileModel);
            }
           
            

            return {
                id: unitKey,
                unitName: config.nameMd,
                value: isMultiActive ? totalSumPerKeyA.join('|') : totalValueForUnit,
                valueSet: isMultiActive ? totalValueMulti : totalValueForUnit,
                cssClass: config.class,
                tpl: 'block-detaile-info',
                chart,
                chartOptName: unitKey,
                //tpl
                btnDetaile
            };
        }).filter(Boolean);
        return { items, chartReg };
    }
    /**
     * Побудова ViewModel та конфігурацій графіків трендів (Area Charts) для підрозділів і загальних показників.
     * Розраховує динамику за датами для кожного підрозділу, генерує графіки трендів з анотаціями, 
     * а також формує загальний тренд (стандартний та розширений) для підсумкових рядків за весь період.
     * @see {@link getDateFormat}
     * @see {@link buildChartConfig}
     * @see {@link getNum}
     * 
     * @param {Object} params - Об'єкт параметрів функціоналу.
     * @param {Array<string>} params.datesToFetch - Масив дат для вибірки та побудови часових рядів графіків.
     * @param {Array<string>} params.datesForCards - Масив дат, за які підраховується агрегована статистика (для карток та анотацій).
     * @param {Array<string|Date>} params.datesToChart - Масив дат для підписів осі X у графіках.
     * @param {Map<string, Map<string, Map<string, number>>>} params.hierarchyMap - Ієрархічна Map-структура значень [Дата -> Юніт -> Категорія].
     * @param {string} params.activeCategory - Назва/ключ поточної активної категорії.
     * @param {string|Array<string>} params.dbKeysActive - Ключ або масив ключів БД для активної категорії.
     * @param {boolean} params.isMultiActive - Прапор, що вказує, чи є активна категорія мульти-категорією (масивом ключів).
     * @param {boolean} params.isSingleDate - Прапор, що вказує, чи вибрано один конкретний день (для додавання анотацій).
     * @param {Array<Object>} params.rawData - Масив сирих даних із бази даних.
     * @param {number|string} params.totalRadar - Загальне сумарне значення (для відображення у загальному тренді).
     * @param {object} params.descr - Дані для створення кнопки Деталі.
     * @param {object} params.descr.big - Об'єкт параметри якого передаються в модель, що викликає кнопка Деталі для великого графіку.
     * @param {object} params.descr.big.model - назва моделі для кнопки Деталі на великому графіку.
     * @param {object} params.descr.small - Об'єкт параметри якого передаються в модель, що викликає кнопка Деталі для маленького графіку
     * @param {object} params.descr.small.model - назва моделі для кнопки Деталі на маленькому графіку.
     * @returns {{ items: Array<Object>, totalTrendBigModel: Object, chartReg: Object }} Об'єкт із підготовленими картками трендів (`items`), розширеною моделлю загального тренду (`totalTrendBigModel`) та реєстром конфігурацій графіків (`chartReg`).
     */
    buildDashBoardUnitTrends({ datesToFetch, datesForCards, datesToChart, hierarchyMap, activeCategory, dbKeysActive, isMultiActive, isSingleDate, rawData, totalRadar, pageName, descr }) {
        const chartReg = {};
        const totalDBKey = Data.page[pageName].subcategoriesByRelations?.[activeCategory] || Data.page[pageName].categoriesByRelations[activeCategory];
        const formattedCategories = datesToChart.map(d => Models.getDateFormat(d, 'apex'));
        const tickAmount = datesToChart.length - 1;
        const chartDataLabels = {
            formatter: function (val, opts) {
                const data = opts.w.config.series[opts.seriesIndex].data;
                const i = opts.dataPointIndex;
                const totalDays = data.length;

                // 1. Якщо даних >= 60 днів (2 місяці) — підпис раз на 30 днів (в останній день місяця)
                if (totalDays >= 90) {
                    if ((i + 1) % 30 === 0 || i === totalDays - 1) {
                        return Models.fix(val);
                        // Рахуємо суму за останні 30 днів
                        /*const startIndex = Math.max(0, i - 29);
                        const sum = data.slice(startIndex, i + 1).reduce((acc, curr) => acc + curr, 0);
                        return Models.fix(sum); // Або Math.round(sum)*/
                    }
                    return "";
                }

                // 2. Якщо даних >= 14 днів (2 тижні) — підпис раз на 7 днів (в останній день тижня)
                if (totalDays >= 21) {
                    if ((i + 1) % 7 === 0 || i === totalDays - 1) {
                        return Models.fix(val);
                        // Рахуємо суму за останні 7 днів
                        /*const startIndex = Math.max(0, i - 6);
                        const sum = data.slice(startIndex, i + 1).reduce((acc, curr) => acc + curr, 0);
                        return Models.fix(sum);*/
                    }
                    return "";
                }

                // 3. Якщо менше 14 днів — показуємо звичайне значення для кожного дня
                return val;
            },
        };

        const items = Data.global.units.map(unitKey => {
            const config = Data.global.unitStructure[unitKey];
            if (!config) return null;

            let totalValueForUnit = 0;
            const totalValueMulti = {};
            if (isMultiActive) dbKeysActive.forEach(k => totalValueMulti[k] = 0);

            // 1. Розрахунок підсумкових значень за датами
            datesForCards.forEach(date => {
                const dayUnitsMap = hierarchyMap.get(date);
                if (!dayUnitsMap) return;
                const targetUnitDbKeys = dayUnitsMap.get(unitKey);

                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        const val = targetUnitDbKeys.get(k) || 0;
                        totalValueMulti[k] = Models.fix(totalValueMulti[k] + val);
                        totalValueForUnit = Models.fix(totalValueForUnit + val);
                    });
                } else {
                    totalValueForUnit = Models.fix(totalValueForUnit+(targetUnitDbKeys.get(dbKeysActive) || 0));
                }
            });
            // 1.1 Розраховуємо середній показник за графік
            let totalUnitForPeriod = 0;
            const totalMultiForPeriod = {};
            datesToChart.forEach(date => {
                const dayUnitsMap = hierarchyMap.get(date);
                if (!dayUnitsMap) return;
                const targetUnitDbKeys = dayUnitsMap.get(unitKey);

                if (isMultiActive) {
                    dbKeysActive.forEach(k => {
                        if (!totalMultiForPeriod.hasOwnProperty(k)) totalMultiForPeriod[k] = 0;
                        const val = targetUnitDbKeys.get(k) || 0;
                        totalMultiForPeriod[k] = Models.fix(totalMultiForPeriod[k] + val);
                        totalUnitForPeriod = Models.fix(totalUnitForPeriod + val);
                    });
                } else {
                    totalUnitForPeriod = Models.fix(totalUnitForPeriod + (targetUnitDbKeys.get(dbKeysActive) || 0));
                }
            });
            const averageUnit = Models.fix(totalUnitForPeriod / datesToChart.length);
            const averageUnitMulti = {};
            if (isMultiActive) {
                dbKeysActive.forEach(k => {
                    averageUnitMulti[k] = Models.fix(totalMultiForPeriod[k] / datesToChart.length);
                });
            }

            // 2. Підготовка series для конкретного підрозділу
            const series = [];
            const seriesSum = { name: [], sum: [] };
            const disp = [];
            if (isMultiActive) {
                dbKeysActive.forEach(k => {
                    const data = datesToFetch.map(date => hierarchyMap.get(date)?.get(unitKey)?.get(k) || 0);
                    const dataPeriod = datesForCards.map(date => hierarchyMap.get(date)?.get(unitKey)?.get(k) || 0);
                    const name = Data.page[pageName].categoriesByTitle[k] || k;
                    const sum = dataPeriod.reduce((acc, n) => {
                        return Models.fix(acc + n);
                    }, 0);
                    seriesSum.name.push(name);
                    seriesSum.sum.push(sum);
                    disp.push(`<span class="val"><span class="name">${name}</span> ${sum}</span>`)
                    const s = { name, data, type: 'area' };
                    if (Data.page[pageName].categoriesChartColor[k]) s.color = Data.page[pageName].categoriesChartColor[k];
                    series.push(s);
                });
            } else {
                const dailyData = datesToFetch.map(date => hierarchyMap.get(date)?.get(unitKey)?.get(dbKeysActive) || 0);
                const s = { name: Data.page[pageName].categoriesByTitle[activeCategory] || activeCategory, data: dailyData, type: 'area' };
                if (Data.page[pageName].categoriesChartColor[activeCategory]) s.color = Data.page[pageName].categoriesChartColor[activeCategory];
                series.push(s);
            }

            const totalSumPerKeyA = seriesSum.sum;
            const displayVal = isMultiActive ? disp.join('|') : totalValueForUnit;

            // 3. Генерація конфігу для тренду підрозділу
            // генерація annotation yaxis для середнього показнику
            const annotations = {};
            if (isMultiActive) {
                if (!annotations.hasOwnProperty('yaxis')) annotations.yaxis = [];
                dbKeysActive.forEach((k, kInd) => {
                    annotations.yaxis.push({
                        y: averageUnitMulti[k],
                        borderColor: series[kInd].color || Data.global.chartColors[kInd],
                        label: {
                            borderColor: series[kInd].color || Data.global.chartColors[kInd],
                            style: {
                                color: '#000',
                                background: series[kInd].color || Data.global.chartColors[kInd],
                                fontWeight: 400,
                                fontSize: "1rem",
                                
                            },
                            text: `${Data.text['Average']}: ${averageUnitMulti[k]}`,
                            position: 'left',
                            textAnchor: 'satrt',
                            offset: 40
                        },
                    });
                });
            } else {
                annotations.yaxis = [
                    {
                        y: averageUnit,
                        borderColor: series[0].color || Data.global.chartColors[0],
                        label: {
                            borderColor: series[0].color || Data.global.chartColors[0],
                            style: {
                                color: '#000',
                                background: series[0].color || Data.global.chartColors[0],
                                fontWeight: 400,
                                fontSize: "1rem",
                                
                            },
                            text: `${Data.text['Average']}: ${averageUnit}`,
                            position: 'left',
                            textAnchor: 'satrt',
                            offset: 40
                        },
                    },
                ]
            }

            let chartCustomOptions = {
                chart: {
                    height: 215,
                },
                xaxis: { tickAmount },
                dataLabels: chartDataLabels,
                annotations
            }
            // генерація мульти осі У
            const yaxis = [];
            series.forEach(s => {
                yaxis.push({
                    show: false,
                    seriesName: s.name,
                    axisTicks: {
                        show: false,
                    },
                    axisBorder: {
                        show: false,
                    },
                });
            });

            if (isMultiActive) {
                chartCustomOptions = {
                    ...chartCustomOptions,
                    grid: { padding: { top: 50 } },
                    legend: {
                        show: true,
                        position: 'top',
                        horizontalAlign: 'left',
                        fontSize: '1rem',
                        labels: { colors: '#dee2e6' },
                        markers: { width: 12, height: 12, radius: 4, strokeWidth: 0, offsetX: -5 },
                        itemMargin: { horizontal: 10, vertical: 8 },
                        /*formatter: (seriesName, opts) => {
                            if (opts.w.config.series[opts.seriesIndex]) {
                                return opts.w.config.series[opts.seriesIndex].name;
                            }
                            return seriesName;
                        }*/
                    },
                    // yaxis
                }
            }
            const chart = this.buildChartConfig({
                type: 'area',
                series,
                categories: formattedCategories,
                customOptions: chartCustomOptions,
                annotation: {
                    isSingleDate,
                    targetDateStr: datesForCards[0],
                    value: displayVal
                }
            });

            // УНІКАЛЬНИЙ КЛЮЧ: додаємо activeCategory
            const trendRenderId = `unit-trend-${unitKey}-${activeCategory}`;
            chartReg[trendRenderId] = chart;

            return {
                id: trendRenderId,
                unitName: config.nameMd,
                value: displayVal,
                valueSet: isMultiActive ? totalValueMulti : totalValueForUnit,
                cssClass: `${config.class} chart-area`,
                textDetail: Data.text.detail,
                tpl: 'block-detaile-info',
                chart,
                chartOptName: trendRenderId
            };
        }).filter(Boolean);

        //------------------------------------
        // Загальні тренди
        //------------------------------------
        

        // 4. Підготовка series для Загального тренду
        const totalSeries = [];
        let totalSum = 0;
        const totalSumMulti = {};
        if (isMultiActive) {
            dbKeysActive.forEach(k => {
                const dailyTotalData = datesToChart.map(date => {
                    const totalRow = rawData.find(row => row && row['Дата'] === date && totalDBKey.includes(row['Угруповання']));
                    return Models.getNum(totalRow, k);
                });
                const s = { name: Data.page[pageName].categoriesByTitle[k] || k, data: dailyTotalData };
                if (Data.page[pageName].categoriesChartColor[k]) s.color = Data.page[pageName].categoriesChartColor[k];
                totalSeries.push(s);
                let sumDaily = dailyTotalData.reduce((acc, v) => acc + v, 0);
                totalSum = totalSum + sumDaily;
                if (!totalSumMulti.hasOwnProperty(k)) totalSumMulti[k] = 0;
                totalSumMulti[k] = totalSumMulti[k] + sumDaily;
            });
        } else {
            const dailyTotalData = datesToChart.map(date => {
                const totalRow = rawData.find(row => row && row['Дата'] === date && totalDBKey.includes(row['Угруповання']));
                return Models.getNum(totalRow, dbKeysActive);
            });
            const s = { name: Data.page[pageName].categoriesByTitle[activeCategory] || activeCategory, data: dailyTotalData };
            if (Data.page[pageName].categoriesChartColor[activeCategory]) s.color = Data.page[pageName].categoriesChartColor[activeCategory];
            totalSeries.push(s);
            let sumDaily = dailyTotalData.reduce((acc, v) => acc + v, 0);
            totalSum = totalSum + sumDaily;
        }
        // визначаємо середній показник
        const averageUnit = Models.fix(totalSum / datesToChart.length);
        const averageUnitMulti = {};
        if (isMultiActive) {
            dbKeysActive.forEach(k => {
                averageUnitMulti[k] = Models.fix(totalSumMulti[k] / datesToChart.length);
            });
        }
        // генерація annotation yaxis для середнього показнику
        const annotations = {};
        if (isMultiActive) {
            if (!annotations.hasOwnProperty('yaxis')) annotations.yaxis = [];
            dbKeysActive.forEach((k, kInd) => {
                annotations.yaxis.push({
                    y: averageUnitMulti[k],
                    borderColor: totalSeries[kInd].color || Data.global.chartColors[kInd],
                    label: {
                        borderColor: totalSeries[kInd].color || Data.global.chartColors[kInd],
                        style: {
                            color: '#000',
                            background: totalSeries[kInd].color || Data.global.chartColors[kInd],
                            fontWeight: 400,
                            fontSize: "1rem",
                            
                        },
                        text: `${Data.text['Average']}: ${averageUnitMulti[k]}`,
                        position: 'left',
                        textAnchor: 'satrt',
                        offset: 40
                    },
                });
            });
        } else {
            annotations.yaxis = [
                {
                    y: averageUnit,
                    borderColor: totalSeries[0].color || Data.global.chartColors[0],
                    label: {
                        borderColor: totalSeries[0].color || Data.global.chartColors[0],
                        style: {
                            color: '#000',
                            background: totalSeries[0].color || Data.global.chartColors[0],
                            fontWeight: 400,
                            fontSize: "1rem",
                            
                        },
                        text: `${Data.text['Average']}: ${averageUnit}`,
                        position: 'left',
                        textAnchor: 'satrt',
                        offset: 40
                    },
                },
            ]
        };

        // 5. Генерація конфігів для загальних трендів (стандартний і великий)
        let chartCustomOptions = {
            chart: {
                height: 215,
            },
            xaxis: { tickAmount },
            dataLabels: chartDataLabels,
            annotations
        }
        if (isMultiActive) {
            chartCustomOptions = {
                ...chartCustomOptions,
                grid: { padding: { top: 50 } },
                legend: {
                    show: true,
                    position: 'top',
                    horizontalAlign: 'left',
                    fontSize: '1rem',
                    labels: { colors: '#dee2e6' },
                    markers: { width: 12, height: 12, radius: 4, strokeWidth: 0, offsetX: -5 },
                    itemMargin: { horizontal: 10, vertical: 8 },
                    /*formatter: (seriesName, opts) => {
                        if (opts.w.config.series[opts.seriesIndex]) {
                            return opts.w.config.series[opts.seriesIndex].name;
                        }
                        return seriesName;
                    }*/
                    annotations
                }
            }
        }

        const totalTrendConf = {
            type: 'area',
            series: totalSeries,
            categories: formattedCategories,
            customOptions: chartCustomOptions,
            annotation: {
                isSingleDate,
                targetDateStr: datesForCards[0],
                value: totalRadar
            }
        };
        const chartTotalTrend = this.buildChartConfig(totalTrendConf);
        chartCustomOptions.chart.height = 477;
        const chartTotalTrendBig = this.buildChartConfig(totalTrendConf);

        // УНІКАЛЬНІ КЛЮЧІ ЗАГАЛЬНИХ ТРЕНДІВ: додаємо activeCategory
        const totalTrendId = `unit-trend-total-${activeCategory}`;
        const totalTrendBigId = `unit-trend-total-big-${activeCategory}`;

        chartReg[totalTrendId] = chartTotalTrend;
        chartReg[totalTrendBigId] = chartTotalTrendBig;

        // 6. формування конфігу для кнопки деталі
        const btnDetaileBig = [];
        const btnDetaileSmall = [];
        if (descr) {
            if (descr.big?.model) {
                const descrModel = {
                    cat: activeCategory,
                    ...descr.big
                };
                const btnDetaileModel = {
                    tpl: 'tpl-btn-detaile',
                    id: '', // Views.DOM element key (renderId)
                    //attr
                    modelDetail: JSON.stringify(descrModel),
                    //field
                    textDetail: Data.text.detail,
                };
                btnDetaileBig.push(btnDetaileModel);
            }
            if (descr.small?.model) {
            }
            
        }

        const totalTrendModel = {
            id: totalTrendId,
            unitName: 'Загальний тренд',
            value: totalRadar,
            cssClass: 'radar-card chart-area',
            btnDetaile: btnDetaileSmall,
            tpl: 'block-detaile-info',
            chart: chartTotalTrend,
            chartOptName: totalTrendId
        };

        const totalTrendBigModel = {
            id: totalTrendBigId,
            unitName: 'Загальний тренд за період',
            value: totalRadar,
            cssClass: 'radar-card chart-area-big',
            btnDetaile: btnDetaileBig,
            tpl: 'block-detaile-info',
            chart: chartTotalTrendBig,
            chartOptName: totalTrendBigId
        };

        items.push(totalTrendModel);

        return { items, totalTrendBigModel, chartReg };
    }
    /**
     * Побудова ViewModel та конфігурацій пелюсткових діаграм (Radar Charts) для відображення розподілу сил/показників між підрозділами.
     * Формує осі діаграми на основі списку підрозділів, агрегує дані за категоріями (мульти або соло режим) 
     * та генерує дві версії графіка: стандартну для дашборду та збільшену для модального перегляду.
     * @see {@link buildChartConfig}
     * 
     * @param {Object} params - Об'єкт параметрів функціоналу.
     * @param {Array<Object>} params.unitsViewModel - Список підготовлених моделей підрозділів (із методу buildDashBoardUnits).
     * @param {boolean} params.isMultiActive - Прапор, що вказує, чи є активна категорія мульти-категорією (масивом ключів).
     * @param {Array<string>} params.dbKeysActive - Масив ключів БД для активної мульти-категорії.
     * @param {string} params.activeCategory - Назва/ключ поточної активної категорії.
     * @param {number|string} params.totalRadar - Загальне сумарне значення для відображення в картці радара.
     * @returns {{ radarModel: Object, radarBigModel: Object, chartReg: Object }} Об'єкт із моделлю стандартного радара (`radarModel`), розширеного радара (`radarBigModel`) та реєстром конфігурацій ApexCharts (`chartReg`).
     */
    //TODO UPDATE [Models.buildDashBoardRadar] додати можливість виводу по units або units.squad
    buildDashBoardRadar({ unitsViewModel, isMultiActive, dbKeysActive, activeCategory, totalRadar, pageName }) {
        const chartReg = {};

        // 1. Формуємо категорії (список підрозділів)
        const categories = unitsViewModel.map(unit => unit.unitName);

        // 2. Формуємо series залежно від активного режиму (мульти / соло)
        const series = [];

        if (isMultiActive) {
            dbKeysActive.forEach(k => {
                const radarSquadData = unitsViewModel.map(unit => {
                    // 2.1 змінюємо тип графіку для кнопки деталі
                    /*const detModel = JSON.parse(unit.modelDetail);
                    detModel.type = 'radar';
                    unit.modelDetail = JSON.stringify(detModel);*/
                    // 2.2 повертаємо значення для формування series
                    return (unit.valueSet && typeof unit.valueSet === 'object') ? (unit.valueSet[k] || 0) : 0;
                });

                const s = { name: Data.page[pageName].categoriesByTitle[k] || k, data: radarSquadData };
                if (Data.page[pageName].categoriesChartColor[k]) s.color = Data.page[pageName].categoriesChartColor[k];
                series.push(s);
            });
        } else {
            const radarSquadData = unitsViewModel.map(unit => {
                // 2.1 змінюємо тип графіку для кнопки деталі
                /*const detModel = JSON.parse(unit.modelDetail);
                detModel.type = 'radar';
                unit.modelDetail = JSON.stringify(detModel);*/
                // 2.2 повертаємо значення для формування series
                return typeof unit.valueSet === 'object'
                    ? Object.values(unit.valueSet).reduce((a, b) => a + b, 0)
                    : (unit.valueSet || 0);
            });

            const s = {
                name: Data.page[pageName].categoriesByTitle[activeCategory] || activeCategory,
                data: radarSquadData
            };
            if (Data.page[pageName].categoriesChartColor[activeCategory]) s.color = Data.page[pageName].categoriesChartColor[activeCategory];
            series.push(s);
        }

        // 3. Генерація стандартного радарного графіка
        const chartRadar = this.buildChartConfig({
            type: 'radar',
            series,
            categories,
            customOptions: {
                tooltip: {
                    enabled: true
                }
            }
        });

        // 4. Генерація збільшеного радарного графіка для модального/розширеного перегляду
        const chartRadarBig = this.buildChartConfig({
            type: 'radar',
            series,
            categories,
            customOptions: {
                chart: { height: 477 },
                plotOptions: {
                    radar: { size: 200 }
                },
                xaxis: {
                    labels: {
                        style: { fontSize: '1.25rem' }
                    }
                },
                dataLabels: {
                    enabled: true,
                }
            }
        });

        const chartKey = `radar-distribution-${activeCategory}`;
        const chartKeyBig = `radar-distribution-big-${activeCategory}`;

        chartReg[chartKey] = chartRadar;
        chartReg[chartKeyBig] = chartRadarBig;

        const radarModel = {
            id: chartKey,
            unitName: 'Розподіл',
            value: totalRadar,
            cssClass: 'radar-card',
            textDetail: Data.text.detail,
            tpl: 'block-detaile-info',
            chart: chartRadar,
            chartOptName: chartKey // Використовуємо динамічний ключ
        };

        const radarBigModel = {
            id: chartKeyBig,
            unitName: 'Розподіл об\'єму за період',
            value: totalRadar,
            cssClass: 'radar-card',
            textDetail: Data.text.detail,
            tpl: 'block-detaile-info',
            chart: chartRadarBig,
            chartOptName: chartKeyBig // Використовуємо динамічний ключ
        };

        return { radarModel, radarBigModel, chartReg };
    }
    /**
     * Побудова ViewModel та конфігурацій графіків для порівняльних кореляцій (співвідношень сил) між Силами оборони України та противником.
     * Розраховує абсолютні значення, відсоткові частки та коефіцієнти пропорційності (ратіо) для:
     * 1. Витрат боєприпасів (БК).
     * 2. Втрат особового складу.
     * 3. Застосування FPV-дронів.
     * Генерує двосторонні Bar-графіки протилежних значень (bar-opposite) для візуалізації балансу сил.
     * @see {@link getNum}
     * @see {@link buildChartConfig}
     * @see {@link getFlexibleRatio}
     * 
     * @param {Object} params - Об'єкт параметрів функціоналу.
     * @param {Array<string>} params.datesForCards - Масив дат, за які підраховується кореляційна статистика.
     * @param {Array<Object>} params.rawData - Масив сирих даних із бази даних по підрозділах.
     * @param {Array<Object>} params.actData - Масив даних активності/дій військ за відповідні дати.
     * @returns {{ items: Array<Object>, chartReg: Object }} Об'єкт із підготовленими картками кореляцій (`items`) та реєстром конфігурацій ApexCharts (`chartReg`).
     */
    buildDashBoardCorrelations({ datesForCards, rawData, actData, pageName }) {
        const correlations = [];
        const chartReg = {};

        // 1. Витрати БК
        let bkSou = 0, bkEnemy = 0;
        datesForCards.forEach(date => {
            const dayActRows = actData.filter(row => row && row['Дата'] === date);
            dayActRows.forEach(row => {
                bkSou += Models.getNum(row, 'Наші_війська_БК');
                bkEnemy += Models.getNum(row, 'Противник_БК');
            });
        });

        const bkTotal = bkSou + bkEnemy;
        const bkSouPct = bkTotal > 0 ? Math.round((bkSou / bkTotal) * 100) : 0;
        const bkEnemyPct = bkTotal > 0 ? Math.round((bkEnemy / bkTotal) * 100) : 0;

        const amoChart = this.buildChartConfig({
            type: 'bar-opposite',
            series: [
                { name: 'Сили оборони', data: [-bkSouPct] },
                { name: 'Противник', data: [bkEnemyPct] }
            ]
        });

        const amoId = 'corr-losses-amo';
        chartReg[amoId] = amoChart;

        correlations.push({
            id: amoId,
            title: 'Витрати БК',
            souValue: bkSou,
            enemyValue: bkEnemy,
            ratioText: Models.getFlexibleRatio(bkSou, bkEnemy),
            textDetail: Data.text.detail,
            chart: amoChart,
            chartOptName: amoId
        });

        // 2. Втрати особового складу
        const loss = (keySOU, keyEnemy, title)=>{
            let lossSou = 0, lossEnemy = 0;
            datesForCards.forEach(date => {
                const dayRows = rawData.filter(row => row && row['Дата'] === date);
                const targetName = 'ВСЬОГО за СО:';
                dayRows.forEach(row => {
                    if (row['Угруповання'] === targetName) {
                        lossSou += Models.getNum(row, keySOU);
                        lossEnemy += Models.getNum(row, keyEnemy);
                    }
                });
            });

            const lossTotal = lossSou + lossEnemy;
            const lossSouPct = lossTotal > 0 ? Math.round((lossSou / lossTotal) * 100) : 0;
            const lossEnemyPct = lossTotal > 0 ? Math.round((lossEnemy / lossTotal) * 100) : 0;

            const lossChart = this.buildChartConfig({
                type: 'bar-opposite',
                series: [
                    { name: 'Сили оборони', data: [-lossSouPct] },
                    { name: 'Противник', data: [lossEnemyPct] }
                ]
            });

            const lossId = 'corr-losses-unit';
            chartReg[lossId] = lossChart;

            return {
                id: lossId,
                title,
                souValue: lossSou,
                enemyValue: lossEnemy,
                ratioText: Models.getFlexibleRatio(lossSou, lossEnemy),
                textDetail: Data.text.detail,
                chart: lossChart,
                chartOptName: lossId
            }
        }
        correlations.push(loss('Втрати_всього_ЗСУ', 'Втрати_всього_рф', 'Втрати о.с.'));
        // 2.1 Втрати особового складу (Безповоротні)
        correlations.push(loss('безповоротні_ЗСУ', 'безповоротні_рф', 'Безповоротні втрати'));

        // 3. Застосування FPV
        let fpvStrikesSou = 0, fpvStrikesEnemy = 0;
        datesForCards.forEach(date => {
            const dayActRows = actData.filter(row => row && row['Дата'] === date);
            dayActRows.forEach(row => {
                fpvStrikesSou += Models.getNum(row, 'Наші_війська_FPV');
                fpvStrikesEnemy += Models.getNum(row, 'Противник_FPV');
            });
        });

        const fpvTotal = fpvStrikesSou + fpvStrikesEnemy;
        const fpvSouPct = fpvTotal > 0 ? Math.round((fpvStrikesSou / fpvTotal) * 100) : 0;
        const fpvEnemyPct = fpvTotal > 0 ? Math.round((fpvStrikesEnemy / fpvTotal) * 100) : 0;

        const fpvChart = this.buildChartConfig({
            type: 'bar-opposite',
            series: [
                { name: 'Сили оборони', data: [-fpvSouPct] },
                { name: 'Противник', data: [fpvEnemyPct] }
            ]
        });

        const fpvId = 'corr-fpv';
        chartReg[fpvId] = fpvChart;

        correlations.push({
            id: fpvId,
            title: 'Застосування FPV',
            souValue: fpvStrikesSou,
            enemyValue: fpvStrikesEnemy,
            ratioText: Models.getFlexibleRatio(fpvStrikesSou, fpvStrikesEnemy),
            textDetail: Data.text.detail,
            chart: fpvChart,
            chartOptName: fpvId
        });

        return { items: correlations, chartReg };
    }
    /**
     * Побудова ViewModel та конфігурацій графіків для безпілотних систем (Drones / Unmanned Systems).
     * Метод розраховує кількість застосувань різних типів БПЛА (за вказаними датами) у розрізі кожного військового підрозділу,
     * підраховує підсумкові показники та генерує односерійні Bar-графіки (`bar-one`) для кожної системи.
     * @see {@link getNum}
     * @see {@link buildChartConfig}
     * 
     * @param {Object} params - Об'єкт параметрів функціоналу.
     * @param {Array<string>} params.datesForCards - Масив дат, за які підраховується статистика застосування дронів.
     * @param {Array<Object>} params.rawData - Масив сирих даних із бази даних по підрозділах.
     * @returns {{ items: Array<Object>, chartReg: Object }} Об'єкт із підготовленими картками безпілотних систем (`items`) та реєстром конфігурацій ApexCharts (`chartReg`).
     */
    buildDashBoardDrones({ datesForCards, rawData, pageName }) {
        const chartReg = {};
        if (!Data.global.unmSys || !Data.global.unmSysConf) return { items: [], chartReg };

        const items = Data.global.unmSys.map(droneKey => {
            const config = Data.global.unmSysConf[droneKey];
            if (!config) return null;

            let totalDroneCount = 0;
            const chartDataValues = [];
            const chartCategories = [];

            // 1. Формування даних по підрозділах та підрахунок загальної суми
            Data.global.units.forEach(unitKey => {
                const uConfig = Data.global.unitStructure[unitKey];
                if (!uConfig) return;

                chartCategories.push(uConfig.nameMd);

                let unitDroneSum = 0;
                datesForCards.forEach(date => {
                    const dayRows = rawData.filter(row => row && row['Дата'] === date);
                    const row = dayRows.find(r => r['Угруповання'] === uConfig.nameMd);
                    if (row) unitDroneSum += Models.getNum(row, config.dbKey);
                });

                chartDataValues.push(unitDroneSum);
                totalDroneCount += unitDroneSum;
            });

            // 2. Генерація конфігурації чарту через уніфікований метод
            const chart = this.buildChartConfig({
                type: 'bar-one',
                series: [{ name: config.name, data: chartDataValues }],
                categories: chartCategories,
                customOptions: {
                    chart: { height: 200 },
                    xaxis: { tickAmount: chartCategories.length - 1 }
                }
            });

            const droneRenderId = `drone-trend-${droneKey}`;
            chartReg[droneRenderId] = chart;

            return {
                id: droneRenderId,
                unitName: config.name,
                value: totalDroneCount,
                valueSet: totalDroneCount,
                cssClass: `${config.class} chart-bar-drone`,
                textDetail: Data.text.detail,
                tpl: 'block-detaile-info',
                chart,
                chartOptName: droneRenderId
            };
        }).filter(Boolean);

        return { items, chartReg };
    }

    buildDashBoardFrontier({ datesToFetch, datesForCards, isSingleDate, rawData, rawDataToday, activeCategory, pageName, lookUpKeys, unitsKey, descr, hierarchyMap, id='', depth=false }) {
        const units = unitsKey || Data.global.units;
        const unitStructure = Data.global.unitStructure;
        const lKeys = Array.isArray(lookUpKeys) ? lookUpKeys : Data.page[pageName].categoriesByKey[activeCategory];
        const delta = [];
        let indCounter = 0;
        const takeDelta = (d, unit) => {
            const r = d.get(unit);
            const neg = r.get(lKeys[0]) * (-1);
            const pos = r.get(lKeys[1]);
            if (delta[indCounter] === undefined) {
                delta[indCounter] = 0;
            }
            delta[indCounter] = Models.fix(delta[indCounter] + neg + pos);
            indCounter = indCounter + 1;
        };
        datesForCards.forEach(date => {
            const d = hierarchyMap.get(date);
            indCounter = 0;
            units.forEach((unit, ind) => {
                if (depth && unitStructure[unit].squad.length > 0) {
                    unitStructure[unit].squad.forEach((subunit, sind) => {
                        takeDelta(d, subunit);
                    });
                } else {
                    takeDelta(d, unit);
                }
            });
        });
        const bufChartCategories = units.map(unit => {
            if (depth && unitStructure[unit].squad.length > 0) {
                return unitStructure[unit].squad;
            } else {
                return Data.global.unitStructure[unit].nameMd
            }
        });
        const chartCategories = [];
        bufChartCategories.forEach(unit => {
            if (!Array.isArray(unit)) {
                chartCategories.push(unit);
            } else {
                chartCategories.push(...unit);
            }
        });
        const chart = this.buildChartConfig({
            type: 'area',
            series: [{
                data: delta,
                color: '#4a90e2',
            }],
            categories: chartCategories,
            customOptions: {
                chart: {
                    height: 477,
                },
                grid: {
                    padding: { bottom: 80, top: 20 }
                },
                stroke: {
                    width: 2,
                    opacity: 1,
                },
                fill: {
                    opacity: 0.5
                },
                plotOptions: {
                    line: {
                        colors: {
                            threshold: 0,
                            colorAboveThreshold: "#00E396",
                            colorBelowThreshold: "#FF4560",
                        },
                    },
                },
                xaxis: {
                    type: 'category',
                    labels: {
                        show: true,
                        rotate: -45,
                        rotateAlways: true,
                        textAnchor: 'end',
                        format:null,
                        style: {
                            fontSize: '1rem'
                        }
                    }
                },
            },
            annotation: null
        });

        const tpl = 'block-detaile-info';
        const tplId = `frontier-${activeCategory}${id}`;

        // 4. формування конфігу для кнопки деталі
        const btnDetaile = [];
        if (descr?.model) {
            const descrModel = {
                cat: activeCategory,
                ...descr
            };
            const btnDetaileModel = {
                tpl: 'tpl-btn-detaile',
                id: '', // Views.DOM element key (renderId)
                //attr
                modelDetail: JSON.stringify(descrModel),
                //field
                textDetail: Data.text.detail,
            };
            btnDetaile.push(btnDetaileModel);
        }
        return {
            items: {
                id: `${tpl}:${tplId}`,
                renderId: `${tpl}:${tplId}`,
                unitName: 'Передній край',
                value: `&Delta;: ${Models.fix(delta.reduce((acc, n) => acc + n, 0))} км<span class="text-sup">2</span>`,
                valueSet: '',
                cssClass: 'frontier',
                tpl,
                chart,
                chartOptName: `${tpl}:${tplId}`,
                //tpl
                btnDetaile,
            },
            chartReg: {
                [`${tpl}:${tplId}`]:chart,
            }
        };
    }

    async buildDescrFrontier() {
        const {
            from,
            to,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        } = this.getDatesFromFilter({ from: app.State.get('dateFrom'), to: app.State.get('dateTo') });
        const pageName = app.State.get('pageName');
        const activeCategory = app.State.get('activeCategory');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const unitsKey = Data.page[pageName].unitsKey || Data.global.unitsKey;

        const rawData = await this.getEventByDate(datesToFetch, 'ГОЧ');
        const rawDataToday = await this.getEventByDate([Models.getDateFormat(todayDate)], 'ГОЧ');

        const hierarchyMap = new Map();

        // Допоміжна функція для генерації Map категорій зі значеннями 0
        const createCategoryMap = () => {
            const catMap = new Map();
            Data.page[pageName].categories.forEach(catKey => {
                const dbKeys = Data.page[pageName].categoriesByKey[catKey];
                if (Array.isArray(dbKeys)) {
                    dbKeys.forEach(k => catMap.set(k, 0));
                } else if (dbKeys) {
                    catMap.set(dbKeys, 0);
                }
            });
            return catMap;
        };

        // 1. ІНІЦІАЛІЗАЦІЯ СТРУКТУРИ HIERARCHY MAP
        datesToFetch.forEach(date => {
            const unitsMap = new Map();

            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;

                // Додаємо головне угруповання
                unitsMap.set(unitKey, createCategoryMap());

                // Якщо є підрозділи (squad), додаємо кожен з них
                if (Array.isArray(config.squad) && config.squad.length > 0) {
                    config.squad.forEach(subunitKey => {
                        unitsMap.set(subunitKey, createCategoryMap());
                    });
                }
            });

            hierarchyMap.set(date, unitsMap);
        });

        // 2. НАПОВНЕННЯ ДАНИМИ З rawData
        datesToFetch.forEach(date => {
            const dayUnitsMap = hierarchyMap.get(date);
            if (!dayUnitsMap) return;

            const dayRows = rawData.filter(row => row && row['Дата'] === date);

            Data.global.units.forEach(unitKey => {
                const config = Data.global.unitStructure[unitKey];
                if (!config) return;

                // Заповнюємо дані для головного угруповання
                const targetUnitDbKeys = dayUnitsMap.get(unitKey);
                if (targetUnitDbKeys) {
                    const targetName = config.nameMd;
                    const row = dayRows.find(r => r[unitsKey] === targetName);

                    targetUnitDbKeys.forEach((_, dbKey) => {
                        targetUnitDbKeys.set(dbKey, row ? Models.getNum(row, dbKey) : 0);
                    });
                }

                // Заповнюємо дані для всіх підрозділів у squad
                if (Array.isArray(config.squad) && config.squad.length > 0) {
                    config.squad.forEach(subunitKey => {
                        const targetSubunitDbKeys = dayUnitsMap.get(subunitKey);
                        if (!targetSubunitDbKeys) return;

                        // Якщо назва підрозділу збігається з його ключем або окремим іменем
                        const subRow = dayRows.find(r => r[unitsKey] === subunitKey);

                        targetSubunitDbKeys.forEach((_, dbKey) => {
                            targetSubunitDbKeys.set(dbKey, subRow ? Models.getNum(subRow, dbKey) : 0);
                        });
                    });
                }
            });
        });
        const res = this.buildDashBoardFrontier({ datesToFetch, datesForCards, isSingleDate, rawData, rawDataToday, activeCategory, pageName, lookUpKeys: null, unitsKey: null, descr: null, hierarchyMap, id: '-descr', depth: true });
        return {
            content: [res.items]
        };
    }

    async buildDescrLoss() {
        const {
            from,
            to,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        } = this.getDatesFromFilter({ from: app.State.get('dateFrom'), to: app.State.get('dateTo') });
        const pageName = app.State.get('pageName');
        const activeCategory = app.State.get('activeCategory');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const dataPage = Data.page[pageName];
        const unitsKey = dataPage.unitsKey || Data.global.unitsKey;

        const rawData = await this.getEventByDate(datesToFetch, 'ГОЧ');
        const rawDataToday = await this.getEventByDate([Models.getDateFormat(todayDate)], 'ГОЧ');

        const getAverage = ({keyLooked, dataTable, dates, keyTotal = 'ВСЬОГО за СО:'}) => {
            let sum = 0;
            dates.forEach(date => {
                dataTable.forEach(row => {
                    if (row['Дата'] === date && row[Data.global.unitsKey] === keyTotal) {
                        let buf = sum + Models.getNum(row, keyLooked);
                        sum = Models.fix(buf);
                    }
                })
            });
            return Models.fix(sum / dates.length);
        }
        const keySet = {
            'безповоротні': {
                friendly: 'безповоротні_ЗСУ',
                enemy: 'безповоротні_рф',
            },
            'санітарні': {
                friendly: 'санітарні_ЗСУ',
                enemy: 'санітарні_рф'
            },
            'полон': {
                friendly: 'полон_ЗСУ',
                enemy: 'полон_рф'
            },
            'зниклі': {
                friendly: 'зниклі_безвісті_ЗСУ',
                enemy: ''
            },
            'всього': {
                friendly: 'Втрати_всього_ЗСУ',
                enemy: 'Втрати_всього_рф',
            },
        };
        const series = {};
        const modelCardItems = []; //блок значень під одним заголовком
        Object.entries(keySet).forEach(t => {
            const type = t[0];
            const val = t[1];
            const modelCardItem = []; //блок з одним значенням
            if (!series[type]) series[type] = {}; //series for chart
            Object.entries(val).forEach(s => {
                const side = s[0];
                const key = s[1];
                modelCardItem.push({
                    //sets
                    tpl: 'tpl-text-card-item',
                    id: `tpl-text-card-item:${activeCategory}:${key}`,
                    //attr
                    cssClass: side,
                    //field
                    textTitle: Data.text[side] || key,
                    textNumber: getAverage({
                        keyLooked: key,
                        dataTable: rawData,
                        dates: datesForCards
                    }),
                    textMeasure: ' всл',
                    //tpl
                });

                if (!series[type][side]) series[type][side] = {
                    name: Data.text[side] || key,
                    color: Data.global.color[`text${side}`]
                }; //series for chart
            });
            modelCardItems.push({
                //sets
                tpl: 'tpl-text-card-block',
                id: `tpl-text-card-block:${activeCategory}:${type}`,
                //attr
                //field
                blockTitle: Data.text[`втрати ${type}`],
                //tpl
                cardItems: modelCardItem,
            });
        });
        
        const model = {
            //sets
            tpl: 'block-detaile-info2',
            id: `block-detaile-info2:${activeCategory}${(unitsKey ? ':' + unitsKey : '')}`,
            cssClass: null,
            classCounter: 'd-none', //TODO: приховати якщо не треба
            //attr
            //field
            unitName: Data.text['втрати середньодобові'],
            value: 'value',
            //tpl
            btnDetaile:[],
            cardItemsTotal: modelCardItems,
        }
        
        return {
            content: [model]
        };
    }

    async buildDescrLossPersonal() {
        const {
            from,
            to,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        } = this.getDatesFromFilter({ from: app.State.get('dateFrom'), to: app.State.get('dateTo') });
        const pageName = app.State.get('pageName');
        const activeCategory = app.State.get('activeCategory');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const dataPage = Data.page[pageName];
        const unitsKey = dataPage.unitsKey || Data.global.unitsKey;


        // 2. Вибираємо з визначених таблиць БД дані
        const rawTables = ['Втрати ЗСУ', 'ГОЧ'];
        const fetchPromises = rawTables.map(async (table) => {
            const data = await this.getEventByDate(datesToFetch, table);
            return { table, data };
        });
        const results = await Promise.all(fetchPromises);
        const rawData = this.mergeAllTables(results, datesToFetch);
        // Вибираємо дані для сьогодні
        const todayDates = [Models.getDateFormat(todayDate)];
        const fetchPromisesToday = rawTables.map(async (table) => {
            const data = await this.getEventByDate(todayDates, table);
            return { table, data };
        });
        const resultToday = await Promise.all(fetchPromisesToday);
        const rawDataToday = this.mergeAllTables(resultToday, todayDates);
        const getSum = ({ keyLooked, dataTable, dates, primeKey}) => {
            let sum = 0;
            dates.forEach(date => {
                dataTable.forEach(row => {
                    if (row['Дата'] === date && row['Угруповання'] === primeKey) {
                        let buf = sum + Models.getNum(row, keyLooked);
                        sum = Models.fix(buf);
                    }
                })
            });
            return Models.fix(sum);
        }

        // Модель для відображення оперативного показнику

        const keySet = {
            'за період': {
                'безповоротні': {
                    operations: 'безповоротні_ЗСУ',
                    personel: 'безповоротні_доба',
                    enemy: 'безповоротні_рф',
                },
                'санітарні': {
                    operations: 'санітарні_ЗСУ',
                    personel: 'санітарні_доба',
                    enemy:  'санітарні_рф',
                },
                'полон': {
                    operations: 'полон_ЗСУ',
                    personel: 'полон_доба',
                    enemy:  'полон_рф',
                },
                'зниклі': {
                    operations: 'зниклі_безвісті_ЗСУ',
                    personel: 'зниклі_безвісті_доба',
                    enemy:  '',
                },
                'всього': {
                    operations: 'Втрати_всього_ЗСУ',
                    personel: 'ВСЬОГО_доба',
                    enemy: 'Втрати_всього_рф',
                },
            },
            'з початку року': {
                'безповоротні': {
                    operations: 'безповоротні_рік_ЗСУ',
                    personel: 'безповоротні_рік',
                    enemy: 'безповоротні_рік_рф',
                },
                'санітарні': {
                    operations: 'санітарні_рік_ЗСУ',
                    personel: 'санітарні_рік',
                    enemy:  'санітарні_рік_рф',
                },
                'полон': {
                    operations: 'полон_рік_ЗСУ',
                    personel: 'полон_рік',
                    enemy:  'полон_рік_рф',
                },
                'зниклі': {
                    operations: 'зниклі_безвісті_рік_ЗСУ',
                    personel: 'зниклі_безвісті_рік',
                    enemy:  '',
                },
                'всього': {
                    operations: 'Втрати_всього_рік_ЗСУ',
                    personel: 'ВСЬОГО_рік',
                    enemy: 'Втрати_всього_рік_рф',
                },
            },
            'з початку наступу': {
                'безповоротні': {
                    operations: '',
                    personel: 'безповоротні_всього',
                    enemy: 'безповоротні_всього_рф',
                },
                'санітарні': {
                    operations: '',
                    personel: 'санітарні_всього',
                    enemy: 'санітарні_всього_рф',
                },
                'полон': {
                    operations: '',
                    personel: 'полон_всього',
                    enemy: 'полон_всього_рф',
                },
                'зниклі': {
                    operations: '',
                    personel: 'зниклі_безвісті_всього',
                    enemy: '',
                },
                'всього': {
                    operations: '',
                    personel: 'ВСЬОГО_всього',
                    enemy: 'Втрати_всього_всього_рф',
                },
            }
        };
        const model = []; // картки
        Object.entries(keySet).forEach(p => {
            const cat = p[0];
            const valP = p[1];
            const series = {};
            const modelCardItems = []; //блок значень під одним заголовком
            Object.entries(valP).forEach(t => {
                const type = t[0];
                const val = t[1];
                const modelCardItem = []; //блок з одним значенням
                if (!series[type]) series[type] = {}; //series for chart
                Object.entries(val).forEach(s => {
                    const side = s[0];
                    const key = s[1];
                    modelCardItem.push({
                        //sets
                        tpl: 'tpl-text-card-item',
                        id: `tpl-text-card-item:${activeCategory}:${key}`,
                        //attr
                        cssClass: side,
                        //field
                        textTitle: Data.text[side] || key,
                        textNumber: !key ? '--' : (cat === 'з початку наступу' || cat === 'з початку року') ? Models.fix(Models.getNum(rawDataToday[0], key)) : getSum({
                            keyLooked: key,
                            dataTable: rawData,
                            dates: datesForCards,
                            primeKey: 'ВСЬОГО за СО:'
                        }),
                        textMeasure: ' всл',
                        //tpl
                    });

                    if (!series[type][side]) series[type][side] = {
                        name: Data.text[side] || key,
                        color: Data.global.color[`text${side}`]
                    }; //series for chart
                });
                modelCardItems.push({
                    //sets
                    tpl: 'tpl-text-card-block',
                    id: `tpl-text-card-block:${activeCategory}:${type}`,
                    //attr
                    //field
                    blockTitle: Data.text[`втрати ${type}`],
                    //tpl
                    cardItems: modelCardItem,
                });
            });
            model.push({
                //sets
                tpl: 'block-detaile-info2',
                id: `block-detaile-info2:${activeCategory}${(unitsKey ? ':' + unitsKey : '')}:${cat}`,
                cssClass: null,
                classCounter: 'd-none', //TODO: приховати якщо не треба
                //attr
                //field
                unitName: Data.text[`втрати ${cat}`] || `втрати ${cat}`,
                value: 'value',
                //tpl
                btnDetaile: [],
                cardItemsTotal: modelCardItems,
            });
        });
        return {
            content: model
        };
    }

    

    //===================================================================================
    // Універсальні збирачі моделей віджетів
    //===================================================================================
    /**
     * Універсальний генератор слайдів каруселі на основі декларативного конфігу:
     * [
                {
                    id: String,
                    tpl: String,
                    activeClass: String,
                    subCatKey: String,
                    customTitle: String,
                    titleSuffix: String,
                    source: String || [String,...]
                },
                ...
        ]
     * @param {Object} params
     * @param {string} params.activeCategory
     * @param {string} params.slideTitle - Базовий заголовок (з categoriesByHeader / categoriesByTitle)
     * @param {Object} params.models - Об'єкт із підготовленими ViewModel-даними { unitsViewModel, unitsTrendsViewModel, ... }
     * @returns {Array<Object>} Масив згенерованих слайдів
     */
    buildCarouselSlides({ activeCategory, slideTitle, models, pageName }) {
        // 1. Беремо конфіг для активної категорії або дефолтний
        let config = '';
        if (Data.page[pageName] && Data.page[pageName].carouselConfigs) {
            config = Data.page[pageName].carouselConfigs[activeCategory] || Data.page[pageName].carouselConfigs._default;
        }
        if (!config) {
            config = Data.global.carouselConfigs._default;
        }
        // 2. Фільтруємо та трансформуємо слайди відповідно до конфігу
        const slides = config
            .filter(slideCfg => {
                // Якщо є умова показу (condition) — перевіряємо її
                if (typeof slideCfg.condition === 'function') {
                    return slideCfg.condition(models);
                }
                return true;
            })
            .map(slideCfg => {
                // Визначаємо вміст для поля units/widgets
                let unitsData;
                let model = slideCfg.subCatKey && models[slideCfg.subCatKey] ? models[slideCfg.subCatKey] : models;
                if (Array.isArray(slideCfg.source)) {
                    unitsData = slideCfg.source.map(key => model[key]);
                } else {
                    unitsData = model[slideCfg.source];
                }

                // Формуємо заголовок (customTitle або базовий + suffix)
                const title = slideCfg.customTitle
                    ? slideCfg.customTitle
                    : slideTitle + (slideCfg.titleSuffix || '');

                return {
                    id: slideCfg.id,
                    tpl: slideCfg.tpl,
                    active: slideCfg.activeClass || '',
                    title: title,
                    units: unitsData
                };
            });

        // 3. Безпечне встановлення активного слайду зі State
        let setActSlide = parseInt(app.State.get('pageSlide'), 10);
        if (Number.isNaN(setActSlide) || !slides[setActSlide]) {
            setActSlide = 0;
            app.State.set('pageSlide', 0);
        }

        // Додаємо клас 'active' до обраного слайду
        slides[setActSlide].active = (slides[setActSlide].active + ' active').trim();

        return slides;
    }
    /**
     * Універсальний йзбирач моделі віджета.
     * Побудова кастомного віджета на базі tpl: block-detaile-info
     * шаблон можна змінити
     * @see {@link getDatesFromFilter}
     * @see {@link getDateFormat}
     * @see {@link getEventByDate}
     * @see {@link getNum}
     * @see {@link buildChartConfig}
     * 
     * @param {Object} filter - Об'єкт з параметрами фільтрації.
     * @param {string|Date} [filter.from] - Початкова дата фільтра (за замовчуванням — поточна дата).
     * @param {string|Date} [filter.to] - Кінцева дата фільтра (за замовчуванням — поточна дата).
     * @param {Object} conf - Об'єкт з конфігами категорії
     * @param {Array<String>} conf.db - перелік таблиць
     * @param {Array<String>} conf.keys - перелік ключів з яких вибрати дані
     *      якщо в різних таблицях будуть однакові ключі то приорітетним буде значення з останньої таблиці.
     * @param {Array<String>} conf.primeTotal - [key,val], де key - в якій колонці шукати, val - яке значення шукати (головний об'єкт відносно якого здійснюємо пошук).
     * @param {Array<String>} conf.primaries - значення в колонці conf.primeTotal[0] для пошуку складових conf.primeTotal[1].
     * @param {string} conf.renderId - унікальний id для реєстрації в DOM. !! Оббов'язковий параметр.
     * @param {string} conf.cssClass - клас для html.
     * @param {Object} conf.values - змінні необхідні для шаблону. Будуть додані до кореня об'єкту моделі.
     * @param {string} conf.title - як виводити primeTotal
     * @param {Object} value - налаштування для значення
     * @param {string} value.header - Заголовок картки
     * @param {string} value.separator - якщо задано то вивести через сепаратор, як ні то загальну суму
     * @param {Object} chart - параметри для створення графіку
     * @param {string} chart.type - bar,area,radar ...
     * TODO @param {??} chart.depth - тут треба подумати - це для того відображати до АК чи по УВ
     * @param {string} chart.format - Big Small
     * @param {Object} chart.conf - можна самому задати базовий конфіг. допишеться в корінь chartConfig. однакові параметри перезапишуться.
     * @param {string} tpl
     * @param {Object} modelSet - інші параметри потрібні для моделі обраного шаблону
     */
    //TODO: TASK [Models.buildOneItem] ChartReg
    //TODO: TASK [Models.buildOneItem] можливість передавати дані, щоб не тягнути з бази якщо такі є
    async buildOneItem({ filter, conf, value, chart, tpl = 'block-detaile-info', modelSet = {} }) {
        if (!conf.renderId || !conf.renderId.trim()) {
            Data.global.debag && console.error('[Models.buildOneItem] Відсутній renderId', tpl, conf, value, filter);
            return;
        }
        // 1. Формуємо дати
        const {
            from,
            to,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        } = this.getDatesFromFilter(filter);
        // 2. Вибираємо з визначених таблиць БД дані
        const rawData = {};
        const fetchPromises = conf.db.map(async (table) => {
            const data = await this.getEventByDate(datesToFetch, table);
            return { table, data };
        });
        const results = await Promise.all(fetchPromises);
        results.forEach(({ table, data }) => {
            rawData[table] = data;
        });
        // 3. обираємо з сирих даних рядки primeTotal, об'єднуємо дані з різних таблиць в одну.
        // Пошук рядка по primaryKey
        const findTotalRow = (date, table, key, val) => //TODO: FIX: [Models.buildOneItem] findTotalRow винести в метод класу і прорефакторити по всім моделям де вибираються дані з таблиці. і додати пошук рядка по кільком primary - гарна ідея в Models.mergeAllTables з композитним ключем.
            rawData[table].find(row => row && row['Дата'] === date && row[key] === val);
        // Об'єднуємо рядки за датою з урахуванням пріоритету останньої таблиці в conf.db
        const getMergedRowsForDates = (dates, key, val) => { //TODO: FIX: [Models.buildOneItem] переробити getMergeRowsForDates на Models.mergeAllTables
            return dates.map(date => {
                const mergedRow = {};
                conf.db.forEach(table => {
                    const row = findTotalRow(date, table, key, val);
                    if (row) {
                        Object.assign(mergedRow, row);
                    }
                });
                return mergedRow;
            });
        };

        const cardRows = getMergedRowsForDates(datesForCards, conf.primeTotal[0], conf.primeTotal[1]); //total row
        const chartRows = {};
        const isMultItem = conf.primaries && conf.primaries.length > 0;
        if (isMultItem) {
            conf.primaries.forEach(item => {
                chartRows[item] = getMergedRowsForDates(((isSingleDate && chart.type === 'area') || !isSingleDate) ? datesToChart : datesForCards, conf.primeTotal[0], item);
            });
        } else {
            chartRows[conf.primeTotal[1]] = getMergedRowsForDates(((isSingleDate && chart.type === 'area') || !isSingleDate) ? datesToChart : datesForCards, conf.primeTotal[0], conf.primeTotal[1]);
        }

        const pageName = app.State.get('pageName'); // для конфігів
        // Вибрати значення які шукаємо
        const values = {
            card: {}, chart: {}
        };
        const series = [];
        let categories = [];
        conf.keys.forEach((key, ind) => {
            // Збираємо все для primeTotal
            values.card[key] = {
                data: [],
                sum: 0,
                name: Data.page[pageName]?.categoriesByTitle?.[key] || Data.text.titles?.[key] || key
            };
            cardRows.forEach(row => {
                const v = Models.getNum(row, key);
                values.card[key].data.push(v);
                values.card[key].sum += v;
            });
            // Збираємо все для графіку
            values.chart[key] = {
                data: [],
                sum: 0,
                name: Data.page[pageName]?.categoriesByTitle?.[key] || Data.text.titles?.[key] || key
            };
            if (isMultItem) {
                conf.primaries.forEach(item => {
                    const itemSum = chartRows[item].reduce((acc, row) => acc + Models.getNum(row, key), 0);
                    values.chart[key].data.push(itemSum);
                    values.chart[key].sum += itemSum;
                });
            } else {
                const totalKey = conf.primeTotal[1];
                chartRows[totalKey].forEach(row => {
                    const v = Models.getNum(row, key);
                    values.chart[key].data.push(v);
                    values.chart[key].sum += v;
                });
            }
            if (Data.page[pageName]?.categoriesChartColor?.[key] || Data.global.categoriesChartColor?.[key]) {
                values.chart[key].color = Data.page[pageName]?.categoriesChartColor?.[key] || Data.global.categoriesChartColor?.[key];
            } else {
                values.chart[key].color = Data.global.chartColors[ind];
            }
            series.push(values.chart[key]);
        });
        // 4. Формуємо сумарне значення primeTotal для виводу
        let val = '';
        if (Array.isArray(conf.keys)) {
            let r = conf.keys.map(key => values.card[key].sum).filter(v => v !== undefined && v !== null && v !== '');
            if (value.separator) {
                val = r.join(value.separator);
            } else {
                val = r.reduce((acc, v) => acc + v, 0);
            }
        }
        // 5. формуємо дані для генерування графіку
        /*
        // Конфіг ApexCharts
            const chart = this.buildChartConfig({
                type: 'area',
                series,
                categories,
                customOptions: {
                    xaxis: {
                        tickAmount: datesToChart.length - 1
                    }
                },
                annotation: {
                    isSingleDate,
                    targetDateStr: datesForCards[0],
                    value: totalValueStr
                }
            });
        */
        /* формуємо series = [{
                data:[], - масив значень
                name:String, - легендування
                [color]:String - колір графіку
            }]
            categories = [String] - вісь Х
        */
        // формування підписів на графіку.
        // Якщо один то це буде Area з відображенням дат.
        if (!isMultItem) {
            categories = datesToChart.map(d => Models.getDateFormat(d, 'apex'));
        } else {
            conf.primaries.forEach(item => {
                categories.push(Data.page[pageName]?.categoriesByTitle?.[item] || Data.text.titles?.[item] || item);
            });
        }
        const buildChart = {
            type: chart.type,
            series,
            categories,
            customOptions: chart.conf,
            // customOptions: {
            //     xaxis: {
            //         tickAmount: datesToChart.length - 1
            //     }
            // },
            // annotation: {
            //     isSingleDate,
            //     targetDateStr: datesForCards[0],
            //     value: totalValueStr
            // }
        };
        if (chart.conf && typeof chart.conf === 'object' && !Array.isArray(chart.conf)) {
            Object.assign(buildChart, chart.conf);
        }
        const chartConfig = this.buildChartConfig(buildChart);
        // повертаємо модель одного елементу (на базі unit шаблону)
        const model = {
            id: conf.renderId, //тут 
            tpl,
            cssClass: conf.cssClass || '',
            unitName: value.header || '', // header
            card: values.card, // всі вибрані значення розбиті по ключам
            value: val, // in header
            // valueSet: isMultiActive ? totalValueMulti : totalValueForUnit,
            textDetail: Data.text.detail || '',
            topDescr: '',
            btnDetaile: null,
            chart: chartConfig,
            chartOptName: conf.renderId,
            ...modelSet
        };
        conf.values && Object.assign(model, conf.values);
        return model;
    }

    /**
     * Універсальний генератор конфігурацій для ApexCharts.
     * Містить пресети для графіків у використовуваних віджетах.
     * @see {@link deepMerge}
     * @see {@link applySingleDateAnnotation}
     * @see {@link createSingleDateAnnotation}
     * 
     * @param {Object} options
     * @param {'area'|'bar-one'|'bar-multiple'|'bar-opposite'|'radar'|'bar'|'line'} options.type - Тип пресету графіка
     * @param {Array} options.series - Дані графіків [{ name, data }]
     * @param {Array} options.categories - Категорії (осі X)
     * @param {Object} [options.customOptions] - Додаткові перевизначення ApexCharts
     * @param {Object} [options.annotation] - Налаштування анотацій (для isSingleDate)
     */
    //TODO REFACTOR (Models.buildChartConfig) треба подумати як поприбирати ці костилі і зробити "з під одного" конфігу
    buildChartConfig({ type = 'line', series = [], categories = [], customOptions = {}, annotation = null } = {}) {
        // 1. Спільна дефолтна база для всіх графіків системи
        const baseConfig = {
            theme: { mode: 'dark' },
            chart: {
                type: type.startsWith('bar') ? 'bar' : type,
                height: '100%',
                width: '100%',
                background: 'transparent',
                toolbar: { show: false },
                zoom: { enabled: false },
                fontFamily: 'inherit',
                animations: { enabled: true, speed: 400 }
            },
            colors: Data.global.chartColors,
            legend: { show: false },
            dataLabels: {
                hideOverflowingLabels: true,
                onDataset: true,
                // тільки екстремуми
                /*formatter: function (val, opts) {
                    const data = opts.w.config.series[opts.seriesIndex].data;
                    const i = opts.dataPointIndex;

                    // Все одно показуємо першу та останню точку
                    if (i === 0 || i === data.length - 1) return val;

                    const prev = data[i - 1];
                    const curr = data[i];
                    const next = data[i + 1];

                    // Перевіряємо, чи є точка піком (локальним максимумом) або западиною (локальним мінімумом)
                    const isPeak = curr > prev && curr >= next;
                    const isTrough = curr < prev && curr <= next;

                    if (isPeak || isTrough) {
                        return val;
                    }

                    return ""; // Для всіх інших точок підпис приховується
                }*/
                // адаптивно
                /*formatter: function (val, opts) {
                    const totalPoints = opts.w.config.series[opts.seriesIndex].data.length;
                    const i = opts.dataPointIndex;

                    // Автоматично вираховуємо інтервал (наприклад: для 20 точок — кожна 2-га, для 50 — кожна 5-та)
                    const step = Math.ceil(totalPoints / 10);

                    // Завжди показуємо останню точку і точки, що крацій кроку
                    if (i % step === 0 || i === totalPoints - 1) {
                        return val;
                    }

                    return "";
                }*/
            }
        };

        // 2. Детальні пресети, створені на основі оригінальних методів
        const typePresets = {
            // --- 1. Одиночний горизонтальний бар (getChartBarOne) ---
            'bar-one': {
                chart: { height: 200 },
                dataLabels: {
                    enabled: true,
                    textAnchor: 'start',
                    style: { fontSize: '1rem', fontWeight: '700', colors: ['#fff'] },
                    background: {
                        enabled: true,
                        padding: 15,
                        borderColor: '#dee2e6',
                        foreColor: '#dee2e6',
                        backgroundColor: '#1d2124',
                        borderRadius: 5
                    },
                    offsetY: 8,
                    offsetX: 20,
                    hideOverflowingLabels: false
                },
                plotOptions: {
                    bar: {
                        horizontal: true,
                        distributed: true,
                        barHeight: '85%',
                        hideZeroBarsWhenGrouped: false,
                        dataLabels: { position: 'bottom', textAnchor: 'end', offsetY: 0, offsetX: 20 },
                        borderRadius: 5,
                        borderRadiusApplication: 'end'
                    }
                },
                stroke: { show: false, width: 1, colors: ['#ffffff00'] },
                title: { floating: true },
                xaxis: {
                    categories,
                    labels: {
                        show: false,
                        offsetY: 5,
                        formatter: (val) => val,
                        style: { fontSize: '1.25rem', fontWeight: 300, fontFamily: '"Exo 2", Arial, serif' }
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    title: { text: undefined },
                    labels: {
                        show: true,
                        minWidth: 50,
                        maxWidth: 300,
                        offsetY: 5,
                        style: { fontSize: '1.25rem', fontWeight: 300, fontFamily: '"Exo 2", Arial, serif' }
                    }
                },
                grid: {
                    show: false,
                    borderColor: '#333b42',
                    padding: { top: -20, bottom: -15, left: 0, right: 0 }
                },
                tooltip: {
                    enabled: true,
                    shared: false,
                    intersect: true,
                    followCursor: true,
                    theme: 'dark',
                    x: { show: false },
                    y: {
                        formatter: (val) => val,
                        title: { formatter: (seriesName) => seriesName }
                    }
                },
                fill: { opacity: 1 }
            },

            // --- 2. Мульти-горизонтальний бар (getChartBarMultiple) ---
            'bar-multiple': {
                chart: { height: 200 },
                dataLabels: {
                    enabled: true,
                    textAnchor: 'start',
                    style: { fontWeight: '100', colors: ['#fff'] },
                    background: { enabled: false },
                    offsetX: 5,
                    hideOverflowingLabels: false,
                },
                plotOptions: {
                    bar: {
                        horizontal: true,
                        distributed: false,
                        barHeight: '75%',
                        hideZeroBarsWhenGrouped: false,
                        dataLabels: { position: 'top' },
                        borderRadius: 2,
                        borderRadiusApplication: 'end'
                    }
                },
                stroke: { show: true, width: 3, colors: ['#ffffff00'] },
                title: { floating: true },
                xaxis: {
                    categories,
                    labels: {
                        show: false,
                        offsetY: 5,
                        formatter: (val) => val,
                        style: { fontSize: '1.25rem', fontWeight: 300, fontFamily: '"Exo 2", Arial, serif' }
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    title: { text: undefined },
                    labels: {
                        show: true,
                        minWidth: 50,
                        maxWidth: 300,
                        offsetY: 5,
                        style: { fontSize: '1.25rem', fontWeight: 300, fontFamily: '"Exo 2", Arial, serif' }
                    }
                },
                grid: {
                    show: false,
                    borderColor: '#333b42',
                    padding: { top: -20, bottom: -15, left: 0, right: 0 }
                },
                tooltip: {
                    enabled: true,
                    shared: false,
                    intersect: true,
                    followCursor: true,
                    theme: 'dark',
                    x: { show: false },
                    y: {
                        formatter: (val) => val,
                        title: { formatter: (seriesName) => seriesName }
                    }
                },
                fill: { opacity: 1 },
                legend: {
                    show: true,
                    position: 'right',
                    horizontalAlign: 'middle',
                    fontSize: '1rem',
                    labels: { colors: '#dee2e6' },
                    markers: { width: 12, height: 12, radius: 4, strokeWidth: 0, offsetX: -5 },
                    itemMargin: { horizontal: 10, vertical: 8 },
                    formatter: (seriesName, opts) => {
                        if (opts.w.config.series[opts.seriesIndex]) {
                            return opts.w.config.series[opts.seriesIndex].name;
                        }
                        return seriesName;
                    }
                }
            },

            // --- 3. Протилежний / Двосторонній бар (getChartBarOpposite) ---
            'bar-opposite': {
                chart: {
                    type: 'bar',
                    height: 10,
                    stacked: true,
                    sparkline: { enabled: true }
                },
                colors: ['#008FFB', '#FF4560'],
                plotOptions: {
                    bar: {
                        borderRadius: 2,
                        borderRadiusApplication: 'end',
                        borderRadiusWhenStacked: 'all',
                        horizontal: true,
                        barHeight: '100%'
                    }
                },
                dataLabels: { enabled: false },
                stroke: { show: false },
                grid: {
                    padding: { top: 0, bottom: 0, left: 0, right: 0 }
                },
                yaxis: { show: false },
                tooltip: {
                    enabled: false,
                    shared: false,
                    y: { formatter: (val) => Math.abs(val) }
                },
                xaxis: {
                    categories: ['0'],
                    show: false,
                    min: -100,
                    max: 100
                }
            },

            // --- 4. Радарний графік (getChartRadar) ---
            radar: {
                chart: { height: 200, type: 'radar' },
                dataLabels: {
                    enabled: false,
                    style: { fontWeight: '100' },
                    background: {
                        enabled: true,
                        padding: 3,
                        borderColor: 'rgba(29, 33, 36, 0.5)',
                        foreColor: '#dee2e6',
                        backgroundColor: 'rgba(29, 33, 36, 0.8)',
                        borderRadius: 5
                    },
                    offsetY: 0,
                    offsetX: 0
                },
                plotOptions: {
                    radar: {
                        size: 70,
                        polygons: {
                            strokeColors: '#6c757d',
                            fill: { colors: ['#1d2124', '#232629'] }
                        }
                    }
                },
                title: {},
                markers: {
                    enabled: false,
                    size: 0,
                    colors: ['#fff'],
                    strokeColor: '#FF4560',
                    strokeWidth: 2
                },
                tooltip: {
                    y: { formatter: (val) => val }
                },
                xaxis: {
                    categories,
                    labels: {
                        style: {
                            fontSize: '0.8rem',
                            fontWeight: 300,
                            fontFamily: '"Exo 2", Arial, serif',
                            colors: ['#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6']
                        }
                    }
                },
                yaxis: {
                    labels: {
                        formatter: (val, i) => (i % 2 === 0 ? val : '')
                    }
                },
                grid: {
                    padding: { top: 0, bottom: 20, left: 5, right: 5 }
                },
                legend: {
                    show: true,
                    position: 'bottom',
                    horizontalAlign: 'center',
                    fontSize: '0.8rem',
                    offsetY: 5,
                    labels: { colors: '#dee2e6' },
                    markers: { width: 10, height: 10, radius: 4, strokeWidth: 0, offsetX: -5 },
                    itemMargin: { horizontal: 8, vertical: 0 }
                }
            },

            // --- 5. Площа / Спарклайн (getChartArea) ---
            area: {
                chart: {
                    height: 100,
                    sparkline: { enabled: true }
                },
                stroke: { curve: 'smooth' },
                dataLabels: {
                    enabled: true,
                    style: { fontWeight: '100', colors: ['#fff'] },
                    background: {
                        enabled: true,
                        padding: 3,
                        borderColor: 'rgba(29, 33, 36, 0.5)',
                        foreColor: '#dee2e6',
                        backgroundColor: 'rgba(29, 33, 36, 0.8)',
                        borderRadius: 5
                    },
                    offsetY: 0,
                    offsetX: 0,
                    hideOverflowingLabels: true,
                    onDataset: true,
                },
                fill: {
                    type: 'solid',
                    opacity: 0.1
                },
                grid: {
                    show: false,
                    padding: { left: 0, right: 0, top: 0, bottom: 20 }
                },
                xaxis: {
                    type: 'datetime',
                    categories,
                    labels: {
                        show: true,
                        format: 'dd',
                        offsetY: -5,
                        offsetX: 0
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    tickPlacement: 'on'
                },
                yaxis: {
                    opposite: false,
                    labels: { show: false },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    forceNiceScale: true
                }
            }
        };

        // 3. Зливаємо відповідний пресет та кастомні параметри
        const preset = typePresets[type] || {};
        const finalConfig = this.deepMerge({}, baseConfig, preset, customOptions);
        finalConfig.series = series;
        // 4. Додавання анотацій
        if (annotation && annotation.isSingleDate && annotation.targetDateStr) {
            if (typeof Models.applySingleDateAnnotation === 'function') { //TODO: що за хуйня? 
                Models.applySingleDateAnnotation(finalConfig, annotation.targetDateStr, annotation.value, annotation.isSingleDate);
            } else if (typeof this.createSingleDateAnnotation === 'function') {
                finalConfig.annotations = this.createSingleDateAnnotation(annotation.targetDateStr, annotation.value);
            }
        }

        return finalConfig;
    }

    //===================================================================================
    // Функції помічники
    //===================================================================================
    /**
     * Витягаємо значення з рядка даних.
     * 
     * @param {any} row
     * @param {any} key
     * @returns {any|0}- якщо значення чи ключа в рядку немає то поверне 0.
     */
    static getNum = (row, key) => (row && parseFloat(row[key]?.toString().replace(',', '.'))) || 0;

    static fix = (n, d = 2) => Number(n.toFixed(d));
    /**
     * Беремо співвідношення двох чисел
     * 
     * @param {any} n1
     * @param {any} n2
     * @returns {String} - N1 : N2
     */
    static getFlexibleRatio = (n1, n2) => {
        if (n1 === 0 || n2 === 0) return "- : -";
        return n1 >= n2
            ? `${Models.fix((n1 / n2))} : 1`
            : `1 : ${Models.fix((n2 / n1))}`;
    };
    /**
     * Допоміжна функція для додавання вертикальної лінійки-анотації (xaxis) на графіки Area
     * у випадку, якщо користувач обрав одну конкретну дату.
     * @see {@link getDateFormat}
     * 
     * @param {Object} chartConfig - Конфігурація об'єкта ApexCharts
     * @param {string|Date} targetDateStr - Обрана дата (наприклад, '2026-07-22')
     * @param {string|number} labelValue - Значення для виводу на плашці анотації
     */
    static applySingleDateAnnotation = (chartConfig, targetDateStr, labelValue, isSingleDate) => {
        // Якщо обрано період, а не одну дату — анотація не потрібна
        if (!isSingleDate) return;

        const formattedTargetDate = Models.getDateFormat(targetDateStr, 'apex');

        // 1. Для sparkline-графіків вимикаємо режим спарклайну, щоб анотації не обрізалися
        /*if (chartConfig.chart && chartConfig.chart.sparkline) {
            chartConfig.chart.sparkline.enabled = false;
        }*/

        // 2. Визначаємо значення координати X:
        // Якщо тип осі 'datetime' — ApexCharts вимагає timestamp у мілісекундах.
        // Для звичайної категорії залишаємо рядок дати.
        let xValue = formattedTargetDate;
        if (chartConfig.xaxis && chartConfig.xaxis.type === 'datetime') {
            xValue = new Date(formattedTargetDate).getTime();
        }

        // 3. Гарантуємо, що стандартні маркери точок приховані
        chartConfig.markers = { size: 0 };

        // 4. Формуємо вертикальну смужку (xaxis annotation)
        const annot = {
            xaxis: [{
                x: xValue,                  // Координата дати по осі X
                borderColor: '#858d91',//'#656b6e',//'#FF4560',     // Колір вертикальної смужки (червоний)
                strokeDashArray: 7,         // Пунктир (0 — суцільна лінія, 2..4 — пунктир)
                // strokeWidth: 5,.
                width: 3,
                offsetX: -6,
                label: {
                    text: '',//String(labelValue), // Текст зі значенням на плашці
                    borderColor: '#FF4560',
                    borderWidth: 1,
                    borderRadius: 3,
                    orientation: 'vertical',
                    offsetY: 0,
                    style: {
                        background: '#FF4560',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: { left: 6, right: 6, top: 3, bottom: 3 }
                    }
                }
            }]
        };
        if (chartConfig.hasOwnProperty('annotations')) {
            chartConfig.annotations = { ...chartConfig.annotations, ...annot };
        } else {
            chartConfig.annotations = annot;
        }
        
    }
    /**
     * Об'єднує таблиці з бази даниз за композитним ключем (Дата + Угруповання).
     * Приорітет за кожною наступною таблицею в масиві (остання - приорітет найвищий)
     * 
     * @param {Array<{table: string, data: Array<Object>}>} rawTablesData - Вхідний масив таблиць
     * @param {Array<string>} datesToFetch - Впорядкований масив дат
     * @returns {Array<Object>} Єдиний об'єднаний масив рядків
     */
    mergeAllTables(rawTablesData, datesToFetch) {
        const mergedMap = new Map();
        const allGroups = new Set(); // Динамічний збір усіх унікальних угруповань

        // 1. Проходимо по таблицях у порядку їхнього розташування в масиві
        // (кожна наступна перезаписує значення попередньої)
        rawTablesData.forEach(tableObj => {
            const rows = tableObj.data;
            if (!Array.isArray(rows)) return;

            rows.forEach(row => {
                const date = row['Дата'];
                const group = row['Угруповання']; //TODO: FIX: [Models.mergeAllTables] треба допрацювати щоб задавати ключ і значення для вибірки і вибирати по декільком primaries. Так реалізовано в buildOneItem

                if (date && group) {
                    allGroups.add(group); // Фіксуємо назву угруповання

                    const compositeKey = `${date}_${group}`;
                    const existingRow = mergedMap.get(compositeKey) || {};

                    // Об'єднуємо об'єкти: наступна таблиця перезаписує збіги,
                    // але унікальні параметри зберігаються
                    mergedMap.set(compositeKey, Object.assign({}, existingRow, row));
                }
            });
        });

        // 2. Формуємо підсумковий масив строго у порядку дат з datesToFetch
        const result = [];

        datesToFetch.forEach(date => {
            allGroups.forEach(group => {
                const compositeKey = `${date}_${group}`;
                const mergedRow = mergedMap.get(compositeKey);

                if (mergedRow) {
                    result.push(mergedRow);
                }
            });
        });

        return result;
    }
    /**
     * Обробляє фільтр дат та розраховує діапазони дат для вибірки даних і відображення у картках/графіках.
     * 
     * Якщо у фільтрі вказано лише один день (`isSingleDate`), метод автоматично розширює діапазон вибірки (`datesToFetch`):
     * - Якщо обрана дата була не більше ніж 3 дні тому — береться період за останні 7 днів (включаючи сьогодні).
     * - Якщо дата старша за 3 дні — береться симетричний інтервал ±3 дні від обраної дати.
     * Якщо вказано інтервал (різні дати "from" та "to") — вибірка робиться строго в межах цього інтервалу.
     * @see {@link getDatesInRange}
     * 
     * @param {Object} filter - Об'єкт з параметрами фільтрації.
     * @param {string|Date} [filter.from] - Початкова дата фільтра (за замовчуванням — поточна дата).
     * @param {string|Date} [filter.to] - Кінцева дата фільтра (за замовчуванням — поточна дата).
     * 
     * @returns {{
     *   from: (string|Date),
     *   to: (string|Date),
     *   fromDate: Date,
     *   toDate: Date,
     *   isSingleDate: boolean,
     *   datesForCards: Array<string|Date>,
     *   datesToFetch: Array<string|Date>,
     *   datesToChart: Array<string|Date>
     * }} Об'єкт із підготовленими датами для карток, запитів до БД та побудови графіків.
     */
    getDatesFromFilter(filter) {
        const from = (filter && filter.from) || new Date();
        const to = (filter && filter.to) || new Date();

        const fromDate = new Date(from);
        const toDate = new Date(to);

        const isSingleDate = fromDate.getFullYear() === toDate.getFullYear() &&
            fromDate.getMonth() === toDate.getMonth() &&
            fromDate.getDate() === toDate.getDate();

        const datesForCards = this.getDatesInRange(from, to);

        let datesToFetch = [];
        if (isSingleDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const targetDate = new Date(fromDate);
            targetDate.setHours(0, 0, 0, 0);

            const diffInDays = Math.floor((today - targetDate) / (1000 * 60 * 60 * 24));
            let startDate = new Date(targetDate);
            let endDate = new Date(targetDate);

            if (diffInDays <= 3) {
                endDate = new Date(today);
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 6);
            } else {
                startDate.setDate(startDate.getDate() - 3);
                endDate.setDate(endDate.getDate() + 3);
            }
            datesToFetch = this.getDatesInRange(startDate, endDate);
        } else {
            datesToFetch = this.getDatesInRange(from, to);
        }

        const datesToChart = [...datesToFetch];

        return {
            from,
            to,
            fromDate,
            toDate,
            isSingleDate,
            datesForCards,
            datesToFetch,
            datesToChart
        };
    }
    /**
     * Створює об'єкт конфігурації анотації (позначки) для однієї обраної дати на осі X.
     * Формує стилізовану вертикальну пунктирну лінію з текстовим лейблом (використовується для ApexCharts).
     * 
     * @param {string} targetDateStr - Цільова дата у вигляді рядка (наприклад, 'YYYY-MM-DD' або 'DD.MM.YYYY').
     * @returns {Object} Об'єкт анотації для осі X, сумісний з конфігурацією графіків ApexCharts.
     */
    createSingleDateAnnotation(targetDateStr) {
        return {
            xaxis: [{
                x: targetDateStr,
                borderColor: '#ff4560',
                strokeDashArray: 4,
                label: {
                    borderColor: '#ff4560',
                    style: { color: '#fff', background: '#ff4560', fontSize: '10px' },
                    text: 'Обраний день'
                }
            }]
        };
    }

    /**
     * Виконує глибоке (рекурсивне) об'єднання (merge) декількох джерельних об'єктів у цільовий об'єкт.
     * Мутує об'єкт `target`, перезаписуючи примітиви та масиви, але рекурсивно занурюючись у вкладені Plain Objects.
     * 
     * @param {Object} target - Цільовий об'єкт, у який будуть зливатись властивості.
     * @param {...Object} sources - Один або кілька об'єктів-джерел, з яких копіюються дані.
     * @returns {Object} Оновлений цільовий об'єкт `target`.
     */
    deepMerge(target, ...sources) {
        for (const source of sources) {
            if (!source) continue;
            for (const key of Object.keys(source)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    this.deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    /**
     * Допоміжний метод для генерації масиву дат у заданому діапазоні включно.
     * Ітерується від початкової до кінцевої дати з кроком в один день та форматує кожну дату.
     * @see {@link getDateFormat}
     * 
     * @private
     * @param {string|Date} fromStr - Початкова дата діапазону (у форматі рядка або об'єкта Date).
     * @param {string|Date} toStr - Кінцева дата діапазону (у форматі рядка або об'єкта Date).
     * @param {string} [format] - Бажаний формат дати (параметр зарезервований для майбутнього розширення).
     * @returns {Array<string>} Масив відформатованих рядків дат у заданому діапазоні.
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
     * Вибірка даних з вказаної таблиці бази даних за масивом ключів дат.
     * Виконує паралельні асинхронні запити до IndexedDB для кожної дати зі списку 
     * та об'єднує результати в один плаский масив.
     * 
     * @param {string[]} dateKeysArray - Масив ключів дат для пошуку, наприклад ['6/14/26', '6/15/26'].
     * @param {string} tableName - Назва таблиці в базі даних, з якої виконується вибірка.
     * @returns {Promise<Object[]>} Проміс, що повертає масив усіх знайдених об'єктів з усіх вказаних дат.
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
            Data.global.debag && console.error("Помилка вибірки за кілька дат:", error);
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
            Data.global.debag && console.error("Models.getDateFormat: Невалідний формат дати ->", date);
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
    /**
     * Розраховує порядковий день війни (починаючи з 24 лютого 2022 року включно).
     * Автоматично нормалізує години та хвилини для уникнення похибок, 
     * пов'язаних із часовими поясами та переходом на літній/зимовий час.
     * 
     * @returns {number} Порядковий номер поточного дня війни (наприклад, 1 для 24.02.2022).
     */
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

    //===================================================================================
    // Робота з БД
    //===================================================================================
    /**
     * Вибірка ключів таблиці з xlsx.workbook з урахуванням багаторівневих заголовків (headerDepth).
     * @requires xlsx.js
     * @see {@link getMaxBounds}
     * @see {@link clearToDBKey}
     * 
     * @param {Object} book - Об'єкт книги xlsx
     * @param {string} sheetName - Назва робочого аркуша (worksheet name)
     * @param {Object} [opt] - Параметри визначення заголовків
     * @returns {string[]} Набір знайдених ключів таблиці (масив рядків)
     */
    getStorageModel(book, sheetName, opt) {
        opt = opt || this.dbModelsOpt[sheetName];
        if (!opt) {
            Data.global.debag && console.error('[ERROR] Models.getStorageModel: opt: ' + opt + '; for sheet:' + sheetName);
            opt = this.dbModelsOpt.base;
        }
        const { maxR, maxC } = this.getMaxBounds(opt);
        const sheet = book.Sheets[sheetName];
        const depth = opt.headerDepth || 1;
        const delimiter = opt.headerDelimiter || '_';
        const keys = [];

        // Допоміжна функція для отримання нормалізованого значення з комірки за (row, col)
        const getCellValue = (r, c) => {
            for (const key in sheet) {
                if (sheet[key] && sheet[key].cell && sheet[key].cell.row == r && sheet[key].cell.col == c) {
                    return sheet[key].w || '';
                }
            }
            return '';
        };

        // Допоміжна функція для конвертації літерної колонки в число та навпаки (для обходу зліва направо)
        const colToNum = (col) => {
            let num = 0;
            for (let i = 0; i < col.length; i++) {
                num = num * 26 + (col.charCodeAt(i) - 64);
            }
            return num;
        };
        const numToCol = (num) => {
            let col = '';
            while (num > 0) {
                let remainder = (num - 1) % 26;
                col = String.fromCharCode(65 + remainder) + col;
                num = Math.floor((num - 1) / 26);
            }
            return col;
        };

        // 1. Спочатку переконуємося, що всі комірки в sheet мають поле .cell
        for (const key in sheet) {
            if (!sheet[key] || typeof sheet[key] !== 'object' || key.startsWith('!')) continue;

            let col = (key.match(/\D/g) || []).join('');
            let row = (key.match(/\d/g) || []).join('');

            if (!sheet[key].cell && col && row) {
                sheet[key].cell = { row: parseInt(row, 10), col: col };
            }
        }

        // 2. Вибираємо унікальні координати заповнення основної осі
        const primaryCoords = new Set();
        for (const key in sheet) {
            if (!sheet[key] || !sheet[key].cell) continue;

            const cellRow = Number(sheet[key].cell.row);
            const cellColNum = XLSX.utils.decode_col(sheet[key].cell.col);

            // Пропускаємо комірки за межами maxR та maxC
            if (cellRow > maxR || cellColNum > maxC) continue;

            if (opt.direction && cellRow == opt.row) {
                primaryCoords.add(sheet[key].cell.col);
            } else if (!opt.direction && sheet[key].cell.col == opt.col) {
                primaryCoords.add(cellRow);
            }
        }

        // 3. Формуємо склеєні ключі за допомогою headerDepth
        if (opt.direction) {
            // Горизонтально: згори донизу (по рядках від opt.row до opt.row + depth - 1)
            const sortedCols = Array.from(primaryCoords).sort((a, b) => colToNum(a) - colToNum(b));

            for (const col of sortedCols) {
                const parts = [];
                for (let d = 0; d < depth; d++) {
                    const targetRow = Number(opt.row) + d;
                    const val = getCellValue(targetRow, col);
                    const cleaned = this.clearToDBKey(val);
                    if (cleaned) parts.push(cleaned);
                }

                const combinedKey = parts.join(delimiter);
                if (combinedKey) keys.push(combinedKey);
            }
        } else {
            // Вертикально: зліва направо (по колонках від opt.col до opt.col + depth - 1)
            const sortedRows = Array.from(primaryCoords).sort((a, b) => Number(a) - Number(b));
            const startColNum = colToNum(opt.col);

            for (const row of sortedRows) {
                const parts = [];
                for (let d = 0; d < depth; d++) {
                    const targetCol = numToCol(startColNum + d);
                    const val = getCellValue(row, targetCol);
                    const cleaned = this.clearToDBKey(val);
                    if (cleaned) parts.push(cleaned);
                }

                const combinedKey = parts.join(delimiter);
                if (combinedKey) keys.push(combinedKey);
            }
        }

        // Формуємо рядок для красивого виводу в консоль
        let str = '[' + keys.map(k => `\n '${k}'`).join(',') + '\n]';

        //** вивід масиву в консоль для копіювання та збереження **//
        Data.global.debag && console.log('FOR SAVE: s    toreModel for ' + sheetName + ': ', str, keys);

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
        const diff = {
            permitted: [...diffInModel],
            parsed: [...new Set([...diffInKeys])]
        };

        // База валідна тільки якщо довжини збігаються і відмінностей немає
        const flag = model.length === keys.length && diffInKeys.length === 0 && diffInModel.length === 0;
        if (!flag && Data.global.debag) {
            console.warn('Ключі в таблиці "' + sheetName + '" відрізняються від допущених', diff);
        }
        return {
            flag: flag,
            diff: diff 
        };
    }

    /**
     * Очищення рядка для можливості використання його у якості заголовку таблиці бази даних.
     * Якщо назва починається з цифри, на початок додається символ `_`.
     * 
     * @param {string} str - текст який треба очистити
     * @return {string}
     */
    clearToDBKey(str) {
        if (!str && str !== 0) return '';

        let cleaned = String(str)
            .replace(/[^a-zA-Z0-9а-яієїґА-ЯІЄЇҐ, _]/g, '')
            .replace(/[ ]/g, '_');

        if (/^[0-9]/.test(cleaned)) {
            cleaned = '_' + cleaned;
        }

        return cleaned;
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
     * @requires xlsx.js
     * @see {@link getMaxBounds}
     * @see {@link clearToDBKey}
     * 
     * @param {string} name Назва моделі таблиці (ключ у this.dbModelsOpt)
     * @param {Object} sheet Об'єкт аркуша з xlsx.workbook
     * @param {string[]} keys Масив очікуваних ключів (заголовків) для вибірки
     * @returns {Object[]} Сформований масив об'єктів із даними таблиці
     */
    getDBTable(name, sheet, keys) {
        const opt = this.dbModelsOpt[name] || this.dbModelsOpt.base;
        const depth = opt.headerDepth || 1;
        const delimiter = opt.headerDelimiter || '_';
        const { maxR, maxC } = this.getMaxBounds(opt);
        // Перетворення літери у номер (0-indexed) і назад
        const colToNum = (col) => XLSX.utils.decode_col(col);
        const numToCol = (num) => XLSX.utils.encode_col(num);

        const getCellValue = (r, c) => {
            const cellAddress = `${c}${r}`;
            return sheet[cellAddress]?.w || sheet[cellAddress]?.v || '';
        };

        // Карта адрес: { назва_ключа: col (для direction: true) або row (для direction: false) }
        const keysAddresses = {};

        // Етап 1: Прив'язка складних ключів до адрес
        if (opt.direction) {
            // Отримуємо унікальні колонки аркуша
            const cols = new Set();
            for (const cell in sheet) {
                if (sheet[cell] && sheet[cell].cell) {
                    const cellRow = Number(sheet[cell].cell.row);
                    const cellColNum = XLSX.utils.decode_col(sheet[cell].cell.col);

                    if (cellRow > maxR || cellColNum > maxC) continue;

                    cols.add(sheet[cell].cell.col);
                }
            }

            for (const col of cols) {
                const parts = [];
                for (let d = 0; d < depth; d++) {
                    const val = getCellValue(Number(opt.row) + d, col);
                    const cleaned = this.clearToDBKey(val);
                    if (cleaned) parts.push(cleaned);
                }
                const fullKey = parts.join(delimiter);

                if (fullKey && keys.includes(fullKey)) {
                    keysAddresses[fullKey] = col;
                }
            }
        } else {
            // Отримуємо унікальні рядки аркуша
            const rows = new Set();
            for (const cell in sheet) {
                if (sheet[cell] && sheet[cell].cell) {
                    const cellRow = Number(sheet[cell].cell.row);
                    const cellColNum = XLSX.utils.decode_col(sheet[cell].cell.col);

                    if (cellRow > maxR || cellColNum > maxC) continue;

                    rows.add(cellRow);
                }
            }

            const startColNum = colToNum(opt.col);
            for (const row of rows) {
                const parts = [];
                for (let d = 0; d < depth; d++) {
                    const targetCol = numToCol(startColNum + d);
                    const val = getCellValue(row, targetCol);
                    const cleaned = this.clearToDBKey(val);
                    if (cleaned) parts.push(cleaned);
                }
                const fullKey = parts.join(delimiter);

                if (fullKey && keys.includes(fullKey)) {
                    keysAddresses[fullKey] = row;
                }
            }
        }

        let objTable = {};

        // Етап 2: Збір даних на основі знайдених адрес з урахуванням межі (opt.row / opt.col)
        const startDataRow = Number(opt.row) + depth; // Рядок, з якого починаються НАШІ ДАНІ
        const startDataColNum = XLSX.utils.decode_col(opt.col) + depth; // Колонка, з якої починаються НАШІ ДАНІ

        for (const cell in sheet) {
            if (!sheet[cell] || !sheet[cell].cell) continue;

            const cellRow = Number(sheet[cell].cell.row);
            const cellCol = sheet[cell].cell.col;
            const cellColNum = XLSX.utils.decode_col(cellCol);

            if (cellRow > maxR || cellColNum > maxC) continue;

            if (opt.direction) {
                // Беремо дані ТІЛЬКИ з рядків, які розташовані НИЖЧЕ за шапку!
                if (cellRow < startDataRow) continue;

                for (const keyName in keysAddresses) {
                    if (keysAddresses[keyName] === cellCol) {
                        if (!objTable[cellRow]) objTable[cellRow] = {};
                        objTable[cellRow][keyName] = sheet[cell].w;
                    }
                }
            } else {
                // Перевіряємо, що колонка знаходиться не лівіше за початок даних
                if (cellColNum < startDataColNum) continue;

                for (const keyName in keysAddresses) {
                    if (keysAddresses[keyName] == cellRow) {
                        if (!objTable[cellCol]) objTable[cellCol] = {};
                        objTable[cellCol][keyName] = sheet[cell].w;
                    }
                }
            }
        }

        let resultTable = Object.values(objTable);

        // Етап 3: Генерація rowId за primaryKeys + ігнорування порожніх записів
        const primaryKeys = this.dbModelsPrimaries[name];

        if (primaryKeys && primaryKeys.length) {
            resultTable = resultTable.filter(rowData => {
                // Перевіряємо, щоб ВСІ первинні ключі мали не порожнє значення
                const hasAllPrimaries = primaryKeys.every(key => {
                    const rawValue = rowData[key] || '';
                    return this.clearToDBKey(rawValue) !== '';
                });

                if (!hasAllPrimaries) return false; // Ігноруємо рядок, якщо хоч один ключ порожній

                const idValues = primaryKeys.map(key => this.clearToDBKey(rowData[key]));
                rowData.id = idValues.join('_');
                return true;
            });
        } else {
            Data.global.debag && console.warn(`Не знайдено первинних ключів для моделі: ${name}.`);
        }

        // Етап 4: Фінальне очищення від повністю порожніх об'єктів
        return resultTable.filter(item => item && Object.keys(item).length > 0);
    }

    /**
     * Допоміжний метод для обчислення числових меж таблиці (максимальний рядок та колонка).
     * Визначає межі зчитування на основі параметрів `maxCell` (наприклад, 'Q49') 
     * або окремо вказаних `maxRow` та `maxCol`.
     * @requires xlsx.js
     * 
     * @param {Object} opt - Об'єкт конфігурації зчитування аркуша (із `dbModelsOpt`).
     * @param {string} [opt.maxCell] - Нижньо-права клітинка у форматі A1 (наприклад, 'Z20').
     * @param {number|string} [opt.maxRow] - Явно вказаний номер максимального рядка (1-indexed).
     * @param {string} [opt.maxCol] - Явно вказаний буквений ідентифікатор колони (наприклад, 'Z').
     * @returns {{ maxR: number, maxC: number }} Об'єкт із числовими межами: `maxR` (1-indexed рядок), `maxC` (0-indexed колонка).
     */
    getMaxBounds(opt) {
        let maxR = Infinity;
        let maxC = Infinity;

        // Якщо вказано нижню праву комірку рядком (наприклад, 'Z20')
        if (opt.maxCell) {
            const decoded = XLSX.utils.decode_cell(opt.maxCell);
            maxR = decoded.r + 1; // decode_cell повертає індекси з 0, додаємо 1 для нашої структури
            maxC = decoded.c;     // числовий індекс колонки (0-indexed)
        }

        // Якщо окремо вказано maxRow / maxCol — вони мають пріоритет
        if (opt.maxRow) maxR = Number(opt.maxRow);
        if (opt.maxCol) maxC = XLSX.utils.decode_col(opt.maxCol);

        return { maxR, maxC };
    }

    /**
     * Масовий запис або оновлення даних у базі даних (Ідемпотентний імпорт).
     * Використовує метод `bulkPut`, який автоматично перезаписує існуючі записи, 
     * якщо збігається первинний ключ (rowId), або створює нові, якщо ключа немає.
     * @requires xlsx.js
     * 
     * @param {string} tableName - Назва таблиці в базі даних Dexie (наприклад, 'ГОЧ')
     * @param {Object[]} data - Масив об'єктів (рядків) з даними для збереження
     * @returns {Promise<any>} Проміс, який завершується після успішного запису всіх елементів
     */
    pushToDB(tableName, data) {
        return this.db[tableName].bulkPut(data);
    }

    /**
     * Заповнює всі клітинки всередині об'єднаних діапазонів (!merges)
     * значеннями з їхньої першої (верхньої-лівої) клітинки.
     * @requires xlsx.js
     * 
     * @param {Object} sheet - Об'єкт аркуша із workbook.Sheets[sheetName]
     */
    fillMergedCells(sheet) {
        if (!sheet || !sheet['!merges']) return;

        sheet['!merges'].forEach(range => {
            // Координати початкової (верхньої-лівої) клітинки
            const startCellAddress = XLSX.utils.encode_cell(range.s);
            const startCellObj = sheet[startCellAddress];

            // Якщо початкова клітинка порожня, пропускаємо цей діапазон
            if (!startCellObj) return;

            // Проходимо по всіх клітинках усередині об'єднаного діапазону
            for (let r = range.s.r; r <= range.e.r; r++) {
                for (let c = range.s.c; c <= range.e.c; c++) {
                    // Пропускаємо саму першу клітинку
                    if (r === range.s.r && c === range.s.c) continue;

                    const cellAddress = XLSX.utils.encode_cell({ r, c });

                    // Клонуємо об'єкт початкової клітинки
                    sheet[cellAddress] = { ...startCellObj };

                    // Оновлюємо або створюємо кастомний об'єкт `.cell` під вашу логіку
                    const colLetter = XLSX.utils.encode_col(c);
                    const rowNumber = String(r + 1);

                    sheet[cellAddress].cell = {
                        row: rowNumber,
                        col: colLetter
                    };
                }
            }
        });
    }

    //===================================================================================
    // Особливі обробники сирих таблиць із завантажених даних
    //===================================================================================
    /**
     * Трансформує та агрегує дані з аркуша Excel (ОВгП) у пласку структуру за угрупованнями та показниками вз/бп.
     * Дати - лишає колонкою, 
     * тип та категорія - перетворює у об'єднані ключі (заголовки стовпців) де 
     *  тип         - це розділ
     *  категорія   - це підрозділ
     * засоби - значення колонки перетворює на заголовки колонок. сворює з урахуванням існуючих підзаголовки (2й рядок таблиці: вз,бп.) - калібр_вз; калібр_бп.
     * додаються заголовки колонок на кожен розділ (тип) і на кожен підрозділ (категорія). приклад: РСЗВ_вг, РСЗВ_бп, РСЗВ_важкий_вз, РСЗВ_важкий_бп, ... .
     * існуючі заголовки колонок перетворює на значення в колонці 'Угруповання', за кожен день додає ВСЬОГО за СО:
     * @requires xlsx.js
     * @see {@link clearToDBKey}
     * 
     * @param {Object} sheet - Об'єкт аркуша XLSX (після виклику fillMergedCells)
     * @param {Object} [config] - Конфігурація назв атрибутів та ключів
     * @returns {Array<Object>} Масив трансформованих об'єктів (рядків) під підсумкову таблицю
     */
    transformAmmunitionSheet(sheet, config = {}) {
        const sheetName = config.sheetName || 'ОВгП';

        // 1. Гнучкі налаштування ключів для універсальності
        const cfg = {
            dateColName: this.clearToDBKey(config.dateColName || 'Дата'),
            groupColName: this.clearToDBKey(config.groupColName || 'Угруповання'),
            weaponColName: config.weaponColName || 'засоби',
            typeColName: config.typeColName || 'тип',
            categoryColName: config.categoryColName || 'категорія',
            priceColName: config.priceColName || 'вартість_за_шт',
            totalPriceColName: this.clearToDBKey(config.totalPriceColName || 'вартість'),
            totalBpColName: this.clearToDBKey(config.totalBpColName || 'всього_бп'),
            totalVzColName: this.clearToDBKey(config.totalVzColName || 'всього_вз'),
            totalGroupTitle: config.totalGroupTitle || 'ВСЬОГО за СО:',
            metrics: (config.metrics || ['вз', 'бп']).map(m => this.clearToDBKey(m)),
            headerRowsCount: config.headerRowsCount || 4, // 1: угруповання, 2: вз/бп, 3-4: атрибути
            startDataColIndex: config.startDataColIndex !== undefined ? config.startDataColIndex : 5, // Індекс колонки з якої починаються угруповання (F = 5)
            priceColIndex: config.priceColIndex !== undefined ? config.priceColIndex : 4, // Індекс колонки з ціною (E = 4)
            ...config
        };

        // Отримуємо списки первинних ключів для генерації id
        const primaryKeys = this.dbModelsPrimaries[sheetName] || [cfg.dateColName, cfg.groupColName];

        // Допоміжні функції для роботи з координатами XLSX
        const colToNum = (col) => XLSX.utils.decode_col(col);
        const numToCol = (num) => XLSX.utils.encode_col(num);

        const getCellValue = (r, c) => {
            const addr = `${numToCol(c)}${r}`;
            return sheet[addr]?.w !== undefined ? String(sheet[addr].w).trim() : (sheet[addr]?.v !== undefined ? String(sheet[addr].v).trim() : '');
        };

        const getNumericValue = (r, c) => {
            const addr = `${numToCol(c)}${r}`;
            if (!sheet[addr]) return 0;
            const val = sheet[addr].v !== undefined ? sheet[addr].v : sheet[addr].w;
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        // Визначаємо межі таблиці на аркуші
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');

        // 2. Аналіз шапки та карта колонок угруповань (УОС, УВ (с) "Схід" тощо)
        const groupColumns = []; // [{ colIndex, groupName, metric }]

        for (let c = cfg.startDataColIndex; c <= range.e.c; c++) {
            const rawGroupName = getCellValue(1, c);
            const rawMetric = getCellValue(2, c);

            // Ігноруємо підсумкову колонку аркуша "ВСЬОГО за СО" у вихідній таблиці
            if (rawGroupName && rawMetric && !rawGroupName.includes('ВСЬОГО')) {
                groupColumns.push({
                    colIndex: c,
                    groupName: rawGroupName,
                    metric: this.clearToDBKey(rawMetric)
                });
            }
        }

        // Збираємо список унікальних угруповань у порядку їх появи
        const uniqueGroups = [...new Set(groupColumns.map(g => g.groupName))];

        // 3. Зчитування вихідних рядків із даними про засоби/калібри та вартість
        const rawData = [];
        const weaponKeysSet = new Set();
        const typeKeysSet = new Set();
        const typeCatKeysSet = new Set();

        const startDataRow = cfg.headerRowsCount + 1; // Рядок 5

        for (let r = startDataRow; r <= range.e.r + 1; r++) {
            const dateVal = getCellValue(r, 0);
            const rawWeaponVal = getCellValue(r, 1);
            const rawTypeVal = getCellValue(r, 2);
            const rawCatVal = getCellValue(r, 3);
            const unitPrice = getNumericValue(r, cfg.priceColIndex); // Отримуємо вартість за 1 шт БК

            if (!dateVal && !rawWeaponVal) continue; // Пропускаємо порожні рядки

            const weaponKey = this.clearToDBKey(rawWeaponVal);
            const typeKey = this.clearToDBKey(rawTypeVal);
            const catKey = this.clearToDBKey(rawCatVal);

            const typeCatKey = (typeKey && catKey) ? `${typeKey}_${catKey}` : typeKey;

            if (weaponKey) weaponKeysSet.add(weaponKey);
            if (typeKey) typeKeysSet.add(typeKey);
            if (typeCatKey) typeCatKeysSet.add(typeCatKey);

            const rowValues = {};
            groupColumns.forEach(g => {
                const val = getNumericValue(r, g.colIndex);
                const key = `${g.groupName}_${g.metric}`;
                rowValues[key] = val;
            });

            rawData.push({
                date: dateVal,
                weaponKey: weaponKey,
                typeKey: typeKey,
                typeCatKey: typeCatKey,
                unitPrice: unitPrice, // Фіксуємо ціну
                values: rowValues
            });
        }

        // 4. Групування та агрегація даних
        const dates = [...new Set(rawData.map(d => d.date))];
        let resultTable = [];

        dates.forEach(date => {
            const dateRows = rawData.filter(d => d.date === date);
            const dateGroupRows = [];

            uniqueGroups.forEach(groupName => {
                const transformedRow = {
                    [cfg.dateColName]: date,
                    [cfg.groupColName]: groupName,
                    [cfg.totalPriceColName]: 0, // Ініціалізуємо загальну вартість 0
                    [cfg.totalBpColName]: 0, // Ініціалізація підсумку всього_бп
                    [cfg.totalVzColName]: 0  // Ініціалізація підсумку всього_вз
                };

                // Ініціалізуємо всі динамічні очищені колонки значенням 0
                cfg.metrics.forEach(m => {
                    typeKeysSet.forEach(tk => { transformedRow[`${tk}_${m}`] = 0; });
                    typeCatKeysSet.forEach(tck => { transformedRow[`${tck}_${m}`] = 0; });
                    weaponKeysSet.forEach(wk => { transformedRow[`${wk}_${m}`] = 0; });
                });

                // Наповнюємо даними з вихідних рядків
                dateRows.forEach(row => {
                    // Отримуємо кількість БК (підзаголовок 'бп') для даного угруповання
                    const bpCount = row.values[`${groupName}_бп`] || 0;
                    const vzCount = row.values[`${groupName}_вз`] || 0;

                    // Накопичуємо суми всього_бп та всього_вз для даного угруповання
                    transformedRow[cfg.totalBpColName] += bpCount;
                    transformedRow[cfg.totalVzColName] += vzCount;
                    // Розраховуємо вартість: ціна * кількість БК та додаємо до загальної суми рядка
                    if (bpCount > 0 && row.unitPrice > 0) {
                        transformedRow[cfg.totalPriceColName] += (bpCount * row.unitPrice);
                    }

                    cfg.metrics.forEach(m => {
                        const val = row.values[`${groupName}_${m}`] || 0;

                        if (row.weaponKey) {
                            const key = `${row.weaponKey}_${m}`;
                            transformedRow[key] = (transformedRow[key] || 0) + val;
                        }
                        if (row.typeKey) {
                            const key = `${row.typeKey}_${m}`;
                            transformedRow[key] = (transformedRow[key] || 0) + val;
                        }
                        if (row.typeCatKey) {
                            const key = `${row.typeCatKey}_${m}`;
                            transformedRow[key] = (transformedRow[key] || 0) + val;
                        }
                    });
                });

                dateGroupRows.push(transformedRow);
                resultTable.push(transformedRow);
            });

            // 5. Розрахунок підсумкового рядка "ВСЬОГО за СО:" для поточної дати
            if (dateGroupRows.length > 0) {
                const dateTotalRow = {
                    [cfg.dateColName]: date,
                    [cfg.groupColName]: cfg.totalGroupTitle,
                    [cfg.totalPriceColName]: 0 // Сума вартостей всіх угруповань
                };

                const dataKeys = Object.keys(dateGroupRows[0]).filter(
                    k => k !== cfg.dateColName && k !== cfg.groupColName
                );

                dataKeys.forEach(key => {
                    dateTotalRow[key] = dateGroupRows.reduce((sum, row) => sum + (row[key] || 0), 0);
                });

                resultTable.push(dateTotalRow);
            }
        });

        // 6. ЕТАП ГЕНЕРАЦІЇ rowId (точно за логікою getDBTable)
        if (primaryKeys && primaryKeys.length) {
            resultTable = resultTable.filter(rowData => {
                const hasAllPrimaries = primaryKeys.every(key => {
                    const rawValue = rowData[key] || '';
                    return this.clearToDBKey(rawValue) !== '';
                });

                if (!hasAllPrimaries) return false;

                const idValues = primaryKeys.map(key => this.clearToDBKey(rowData[key]));
                rowData.id = idValues.join('_');
                return true;
            });
        } else {
            Data.global.debag && console.warn(`Не знайдено первинних ключів для моделі: ${sheetName}.`);
        }

        // 7. Вивід масиву ключів у консоль
        if (resultTable.length > 0) {
            const keys = Object.keys(resultTable[0]);
            const str = '[' + keys.map(k => `\n '${k}'`).join(',') + '\n]';

            Data.global.debag && console.log('FOR SAVE: storeModel for ' + sheetName + ': ', str, keys);
        }

        return resultTable;
    }
}



/*TODO: TASK: конфіг для опозитного area і на ньому накладені інші area

var options = {
  series: [
    {
      name: "Рух фронту",
      data: [
        0, 0, 0, -33, 12, 58, -10, 0, -10, 0, 10, -25, 24, 0, -10, 0, 10, -15,
        0, 0,
      ],
      color: "#00AAff",
    },
    {
      name: "Активність ШД Противника",
      data: [
        0, 0, 0, 33, 12, 28, 10, 0, 10, 0, 5, 25, 14, 0, 10, 0, 4, 15, 0, 0,
      ],

      color: "#A00000",
    },
    {
      name: "Активність ШД СОУ",
      data: [0, 0, 0, 5, 12, 58, 5, 0, 5, 0, 10, 15, 24, 0, 4, 0, 10, 6, 0, 0],

      color: "#0000A0",
    },
  ],
  chart: {
    height: 350,
    type: "area",

    zoom: {
      enabled: false,
    },
  },
  fill: {
    type: "solid",
    opacity: [0.8, 0.05, 0.05], // Прозорість: 1-ша серія 30%, 2-га і 3-тя по 15%
    colors: [
      undefined, // undefined дозволяє 1-й серії використовувати порогові кольори з plotOptions
      "#A00000", // Свій колір заливки для 2-ї серії
      "#0000A0", // Свій колір заливки для 3-ї серії
    ],
  },
  // (Для 1-ї серії колір лінії перевизначиться через plotOptions)
  colors: ["#00E396", "#A00000", "#0000A0"],
  theme: { mode: "dark" },
  dataLabels: {
    enabled: false,
  },
  title: {
    text: "Рух фронту за обраний період",
    align: "left",
  },
  subtitle: {
    text: "кореляція відбувається один раз на тиждень",
    align: "left",
  },
  yaxis: [
    {
      //show: false,
      name: "Рух фронту",
      labels: {
        formatter: function (val) {
          return val + "км^2";
        },
      },
    },
    {
      show: true,
      opposite: true,
      name: ["Активність ШД Противника", "Активність ШД СОУ"],
      labels: {
        formatter: function (val) {
          return val + "ШД";
        },
      },
    },
  ],
  xaxis: {
    categories: [
      "15 АК",
      "18 АК",
      "12 АК",
      'УВ "Курськ"',
      "14 АК",
      '2 КНГУ "Хартія"',
      "16 АК",
      "10 АК",
      "3 АК",
      "11 АК",
      "19 АК",
      '1 КНГУ "Азов"',
      "Покровський н.",
      "9 АК",
      "20 АК",
      "Олександрівський н.",
      "17 АК",
      "30 КМП",
      'ОТУ "Одеса"',
      'УВ (с) "Захід"',
    ],
    labels: {
      show: true,
      rotate: -45, // Кут повороту у градусах (наприклад, -45 або -90)
      rotateAlways: true, // true — повертати завжди, навіть якщо тексту достатньо місця
      style: {
        fontSize: "11px",
      },
    },
  },
  stroke: {
    width: [2, 2, 2],
    opacity: 1,
  },
  plotOptions: {
    line: {
      colors: {
        threshold: 0,
        colorAboveThreshold: "#00E396",
        colorBelowThreshold: "#FF4560",
      },
    },
  },
};

var chart = new ApexCharts(document.querySelector("#chart"), options);
chart.render();


*/