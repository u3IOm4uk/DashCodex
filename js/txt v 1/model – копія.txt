/**
 * @fileoverview Модуль для роботи з базою даних. Вибірка та оновлення даних.
 * @version 1.0.0 
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
     * Формує та повертає повний пакет даних для рендерингу головної панелі (Dashboard).
     * Збирає налаштування періоду, текстові дати, день війни, категорії та вибірку з бази даних.
     * 
     * @async
     * @param {Object} [date] - Об'єкт із межами часового періоду. Якщо не передано, використовуються поточні дати.
     * @param {string|Date} date.from - Початкова дата періоду (рядок у валідному форматі або об'єкт Date).
     * @param {string|Date} date.to - Кінцева дата періоду (рядок у валідному форматі або об'єкт Date).
     * 
     * @returns {Promise<{
     *   showDates: { from: string, to: string },      // Дати у форматі ключів БД (M/D/YY)
     *   showDateText: { from: string, to: string },   // Дати у форматі для інтерфейсу (DD.MM.YYYY)
     *   warDay: number,                               // Поточний день повномасштабної війни
     *   categories: Object[],                         // Глобальний список категорій
     *   data: Object[]                                // Масив подій ГОЧ з бази даних за вказаний день
     * }>} Об'єкт із конфігурацією та даними для сторінки Dashboard.
     */
    async pageDashBoard(date) {
        console.log('Models.pageDashBoard is here');

        const targetDate = {
            from: (date && date.from) || new Date(),
            to: (date && date.to) || new Date()
        };

        // Взяти всі дні періоду для вибірки з бази
        const datesToFetch = []; // Всі дати з періоду
        const datesToChart = []; // всі дати з періоду для графіків
        let periodStart = new Date(targetDate.from);
        const periodEnd = new Date(targetDate.to);
        while (periodStart <= periodEnd) {
            datesToFetch.push(Models.getDateFormat(periodStart)); // додаємо "6/15/26"
            datesToChart.push(Models.getDateFormat(periodStart, 'apex')); // додаємо 2026-06-15
            periodStart.setDate(periodStart.getDate() + 1); // переходимо на наступний день
        }

        // Вибираємо дані з бази
        const dbData = await this.getEventByDate(datesToFetch);
        console.log('dbData: ', dbData);

        //=========================
        // 1. Категорії
        //=========================
        const categoriesData = {};
        const totalName = this.clearToDBKey('ВСЬОГО за СО:');
        const neededKey = this.clearToDBKey('Угруповання');

        // Перебираємо дозволені категорії з глобального конфігу
        for (let i = 0; i < Data.global.categories.length; i++) {
            const catName = Data.global.categories[i];
            const binding = Data.global.categoriesByKey[catName];
            const seriesItem = {};

            // 1.1. Збираємо дані для КАТЕГОРІЇ (рядок "ВСЬОГО за СО:")
            for (let j = 0; j < dbData.length; j++) {
                const row = dbData[j];

                if (Object.hasOwn(row, neededKey) && this.clearToDBKey(row[neededKey]) === totalName) {

                    // Задаємо базову структуру для категорії, якщо її ще немає в результатах
                    if (!Object.hasOwn(categoriesData, catName)) {
                        categoriesData[catName] = {
                            title: Data.global.categoriesByTitle[catName],
                            headerText: Data.global.categoriesByHeader[catName],
                            total: 0,
                            chart: Data.global.getChartArea()
                        };
                        categoriesData[catName].chart.xaxis.tickAmount = datesToChart.length;
                    }

                    // Варіант А: Прив'язка є рядком (один ключ в базі)
                    if (typeof binding === 'string') {
                        const value = parseInt(row[binding], 10) || 0;
                        categoriesData[catName].total += value;

                        !Object.hasOwn(seriesItem, catName) && (seriesItem[catName] = []);
                        seriesItem[catName].push(value);
                    }
                    // Варіант Б: Прив'язка є масивом (кілька ключів в базі)
                    else if (Array.isArray(binding)) {
                        categoriesData[catName].multiple = binding;

                        for (let k = 0; k < binding.length; k++) {
                            const keyName = binding[k];
                            const value = parseInt(row[keyName], 10) || 0;

                            !Object.hasOwn(seriesItem, keyName) && (seriesItem[keyName] = []);

                            if (!Object.hasOwn(categoriesData[catName], keyName)) {
                                categoriesData[catName][keyName] = 0;
                            }
                            categoriesData[catName].total += value;
                            categoriesData[catName][keyName] += value;
                            seriesItem[keyName].push(value);
                        }
                    }
                }
            }

            // Записуємо зібрані серії в об'єкт графіка категорії
            if (categoriesData[catName]) {
                if (categoriesData[catName].multiple) {
                    for (let keyName in seriesItem) {
                        const label = (Data.text[keyName] && Data.text[keyName]) || keyName;
                        categoriesData[catName].chart.series.push({ name: label, data: seriesItem[keyName] });
                    }
                } else {
                    categoriesData[catName].chart.series.push({ name: catName, data: seriesItem[catName] || [] });
                }
                categoriesData[catName].chart.labels = datesToChart;
            }

            // ==========================================
            // 2. ПІДРОЗДІЛИ ДЛЯ ПОТОЧНОЇ КАТЕГОРІЇ
            // ==========================================
            const unitsData = { order: Data.global.units };

            Data.global.units.forEach(unitName => {
                const squadList = Data.global.unitStructure[unitName].squad || [];
                const unitChart = Data.global.getChartBarOne();

                // Якщо склад (squad) порожній, вісь X підписуємо назвою самого підрозділу
                unitChart.xaxis.categories = squadList.length > 0 ? squadList : [Data.global.unitStructure[unitName].name];

                unitsData[unitName] = {
                    title: Data.text[unitName],
                    classes: ['box-' + Data.global.unitStructure[unitName].class],
                    total: 0,
                    chart: unitChart
                };

                // Ініціалізуємо лічильники для накопичення сум кожного підрозділу
                const squadCounter = {};
                squadList.forEach(squadName => { squadCounter[squadName] = 0; });
                let mainUnitTotal = 0;

                // Збираємо сумарні дані з бази для цього юніта
                for (let j = 0; j < dbData.length; j++) {
                    const row = dbData[j];
                    if (!Object.hasOwn(row, neededKey)) continue;

                    const rowGroup = this.clearToDBKey(row[neededKey]);

                    // Універсальний масив ключів (працює і для Варіанту А, і для Варіанту Б)
                    const keysToSum = typeof binding === 'string' ? [binding] : binding;

                    let rowSum = 0;
                    keysToSum.forEach(key => {
                        if (Object.hasOwn(row, key)) {
                            rowSum += parseInt(row[key], 10) || 0;
                        }
                    });

                    // Перевірка А: Рядок самого головного підрозділу
                    if (rowGroup === this.clearToDBKey(Data.global.unitStructure[unitName].nameMd)) {
                        unitsData[unitName].total += rowSum;
                        mainUnitTotal += rowSum;
                    }

                    // Перевірка Б: Рядок підлеглого підрозділу зі складу (squad)
                    squadList.forEach(squadName => {
                        if (rowGroup === this.clearToDBKey(squadName)) {
                            squadCounter[squadName] += rowSum;
                            unitsData[unitName].total += rowSum;
                        }
                    });
                }

                // Формуємо фінальний масив чистих значень для відображення в стовпчиках ApexCharts
                const chartDataValues = squadList.length > 0
                    ? squadList.map(squadName => squadCounter[squadName])
                    : [mainUnitTotal];

                unitsData[unitName].chart.series = [{
                    name: Data.global.categoriesByTitle[catName] || catName,
                    data: chartDataValues
                }];
            });

            // Додаємо сформовані підрозділи до поточної категорії
            if (categoriesData[catName]) {
                categoriesData[catName].units = unitsData;
            }

            console.log('Дані юнітів: ', catName, unitsData);
        }

        //=========================
        // TODO: 3. Співвідношення
        //=========================

        // Підготовка фінального пакета даних (ViewModel) для відображення
        const sets = {
            showDates: {
                from: Models.getDateFormat(targetDate.from), // m/d/yy
                to: Models.getDateFormat(targetDate.to)
            },
            showDateText: {
                from: Models.getDateFormat(targetDate.from, 'text'), // dd.mm.yyyy
                to: Models.getDateFormat(targetDate.to, 'text')
            },
            warDay: Models.getWarDay(),
            categories: {
                order: Data.global.categories,
                data: categoriesData
            },
            units: Data.global.unitsShow,
            data: dbData
        };

        return sets;
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