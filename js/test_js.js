function loadData() {
    // [fileName] : loaded data
   /*
    // TODO: автоматичне завантаження файлу поки не працює, треба подумати обхідні шляхи. наразі зробимо через ручний ввід
    const sources = {
        '111.xlsx': null
    };*/
    
    // get file loader
    const fileLoader = document.getElementById('excel-file');
    // xlsx loader
    fileLoader.addEventListener('change', function (e) {
        const file = e.target.files[0]; // Отримуємо вибраний файл
        if (!file) return;

        /*console.log(e);
        console.log(this);
        console.log(fileLoader);*/
        const reader = new FileReader();

        // 1. Налаштовуємо подію, яка спрацює ПІСЛЯ зчитування файлу
        reader.onload = function (e) {
            console.log("I`m here");
            const data = new Uint8Array(e.target.result); // Перетворюємо в масив байтів

            // 2. Головна магія SheetJS: парсимо файл
            let readOptions = {
                type: undefined,        //undefined
                raw: false,             //false
                dense: false,           //false 
                codepage: undefined,    //undefined
                cellFormula: false,      //true
                cellHTML: false,         //true
                cellNF: false,          //false
                cellStyles: false,      //false
                cellText: true,         //true
                cellDates: true,       //false
                dateNF: undefined,      //undefined
                sheetStubs: false,      //false
                sheetRows: 0,           //0
                bookDeps: false,        //false
                bookFiles: false,       //false
                bookProps: false,       //false
                bookSheets: false,      //false
                bookVBA: false,         //false
                password: "",           //""
                WTF: false,             //false
                sheets: undefined,      //undefined
                nodim: false,           //false
                PRN: false,             //false
                xlfn: false,            //false
                FS: undefined,          //undefined
                UTC: true               //true
            };
            const workbook = XLSX.read(data, readOptions);

            // 3. Отримуємо назву першого листа (вкладки)
            const firstSheetName = workbook.SheetNames[0];

            // 4. Дістаємо дані з цього листа
            const worksheet = workbook.Sheets[firstSheetName];

            // 5. Конвертуємо дані у зручний формат JSON (масив об'єктів)
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            const htmlData = XLSX.utils.sheet_to_html(worksheet);
            document.body.insertAdjacentHTML('beforeend', htmlData);
            // Виводимо результат у консоль розробника (F12)
            console.log("Імпортовані дані:", workbook);
            // console.log("Імпортовані дані:", jsonData);
        };

        // 2. Запускаємо саме зчитування файлу як ArrayBuffer
        reader.readAsArrayBuffer(file);
    });
    // load file
    /*console.log(fileLoader);
    for (file in sources) {
        // sources[file] == null && continue;
        console.log("file: ", file);
        fileLoader.value = file;
        console.log(fileLoader);
        let ev = new Event('change');
        fileLoader.dispatchEvent(ev);
        console.log("fileLoader.value: ", fileLoader.value);
    }*/

};

function iDBDexie() {
    console.log('Run iDBDexie');
    let db = new Dexie("dashBoardTest");
    db.version(1).stores({
        unit: `
            id,
            name,
            unitEvents`,
        action: `
            id,
            ActionType,
            count,
            date`,
    });
    /*db.unit.bulkPut([
        { id: 1, name: "1АК", unitEvents: { "обстріли": 10, "доповіді": 23, date: "01/07/2026" } },
        { id: 2, name: "2АК", unitEvents: { "обстріли": 4, "доповіді": 43, date: "01/07/2026" } },
        { id: 3, name: "3АК", unitEvents: { "обстріли": 34, "доповіді": 65, date: "02/07/2026" } },
        { id: 4, name: "4АК", unitEvents: { "обстріли": 23, "доповіді": 1325, date: "01/07/2026" } },
        { id: 5, name: "5АК", unitEvents: { "обстріли": 43, "доповіді": 86, date: "02/07/2026" } },
        { id: 6, name: "6АК", unitEvents: { "обстріли": 765, "доповіді": 324, date: "03/07/2026" } },
        { id: 7, name: "7АК", unitEvents: { "обстріли": 2, "доповіді": 76, date: "03/07/2026" } },
    ]).then(() => {
        let resp = db.unit.toArray();
        console.log("Units: ", resp);
        return resp;
    }).catch (err => {
        console.error("Ouch... " + err);
    });
    db.action.bulkPut([
        { id: 1, ActionType: "move", count: 23, date: "01/07/2026" },
        { id: 2, ActionType: "move", count: 43, date: "01/07/2026" },
        { id: 3, ActionType: "move", count: 65, date: "02/07/2026" },
        { id: 4, ActionType: "move", count: 1325, date: "01/07/2026" },
        { id: 5, ActionType: "move", count: 86, date: "02/07/2026" },
        { id: 6, ActionType: "move", count: 324, date: "03/07/2026" },
        { id: 7, ActionType: "move", count: 76, date: "03/07/2026" },
    ]).then(() => {
        let resp = db.action.toArray();
        console.log("Actions: ", resp);
        return resp;
    }).catch(err => {
        console.error("Ouch... " + err);
    });*/

    /*
    Якщо треба заново звернутися до бази

    // 1. Створюємо об'єкт з ТІЄЮ Ж назвою, що й раніше
    const db = new Dexie("FriendDatabase");

    // 2. Обов'язково вказуємо ТУ Ж версію та структуру таблиць
    db.version(1).stores({
        friends: 'id, name, age' // Перелічіть ключі, які вже є в базі
    });

    // 3. Тепер можна одразу читати або писати дані
    db.friends.toArray()
        .then(data => {
            console.log("Дані успішно прочитані з існуючої бази:", data);
        })
        .catch(error => {
            console.error("Помилка підключення:", error);
        });
    */

    /*
    Якщо треба заново звернутися до бази
    і структура бази не відома
    
    const db = new Dexie("UnknownDatabase");

    // Відкриваємо базу БЕЗ опису .stores() — Dexie зчитає схему з пам'яті браузера
    db.open()
        .then(() => {
            console.log("Таблиці, які знайдено в цій базі:", db.tables.map(t => t.name));

            // Якщо знаємо назву таблиці (наприклад, 'users'), можемо читати:
            return db.table('users').toArray();
        })
        .then(users => console.log("Користувачі:", users))
        .catch(err => console.error("Не вдалося відкрити існуючу базу:", err));
    */

};

function drawChart() {

    // ==========================================
    // ГРАФІК 1: Area Chart (STOCK ABC)
    // ==========================================

    // Створюємо окрему змінну ДЛЯ ДАНИХ (назвемо її stockData, щоб не було плутанини)
    const stockData = {
        // prices: [3120, 3420, 3235, 3261, 3249, 3722, 3829],
        prices: [3722, 3829, 3261, 3249, 3120, 3420, 3235],
        // prices: [3120, 3120, 3120, 3120, 3120, 3120, 3120],
        dates: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07']
    };

    const options1 = {
        theme: {
            mode: 'dark'
        },
        series: [
            {
                name: 'Обстріли',
                data: stockData.prices, // Використовуємо наші дані
            },
        ],
        chart: {
            type: 'area',
            height: 100,
            width: '100%',
            zoom: {
                enabled: false,
            },
            background: 'transparent',
            toolbar: { show: false },
            sparkline: {
                enabled: true
            },
        },
        dataLabels: {
            enabled: true,
            style: {
                // fontSize: '1rem',
                fontWeight: '100',
                colors: ['#fff']
            },
            background: {
                enabled: true,
                padding: 3,
                borderColor: 'rgba(29, 33, 36, 0.5)',
                foreColor: '#dee2e6',
                backgroundColor: 'rgba(29, 33, 36, 0.8)',
                borderRadius: 5,
            },
            offsetY: 0,
            offsetX: 0,
        },
        stroke: {
            curve: 'straight',
        },
        title: {
            // text: '123',
        },
        subtitle: {
            // text: 'Price Movements',
            // align: 'left',
        },
        labels: stockData.dates, // Використовуємо наші дати
        grid: {
            show: false, // або true, якщо потрібна сітка
            padding: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 20
            },
        },
        xaxis: {
            type: 'datetime',
            // Форматування дат для внутрішньої логіки ApexCharts
            labels: {
                show: true, // Вісь гарантовано схована
                /* datetimeFormatter: {
                     year: '',
                     month: '',
                     day: 'dd',
                     hour: 'dd'
                 },*/
                format: 'dd',
                offsetY: -5,
                offsetX: -10,
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
            tickAmount: stockData.dates.length,
            tickPlacement: 'on',
        },
        yaxis: {
            opposite: false,
            labels: {
                show: false,
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        legend: {
            show: false,
            position: 'top',
            horizontalAlign: 'left',
            offsetX: 40,
        },
        fill: {
            opacity: 1,
        },
    };

    // Ініціалізуємо Перший графік в окрему змінну chart1 та в окремий блок #chart1
    let chartDynamic = document.querySelectorAll('.chart-dynamic');
    console.log(chartDynamic);
    for (let i = 0; i < chartDynamic.length; i++) {
        let chart1 = new ApexCharts(chartDynamic[i], options1);
        chart1.render();
    }

    // ==========================================
    // ГРАФІК 2: Стовпчиковий (Fiction Books Sales)
    // ==========================================
    const optionsBar = {
        options2: {
            theme: {
                mode: 'dark'
            },
            series: [
            /** /{ name: '14 АК', data: [22] },
            { name: '2 КНГУ "Хартія"', data: [43] },
            { name: '16 АК', data: [21] },
            { name: '10 АК', data: [13] },
            { name: '3 АК', data: [43] },/**/

            // дані для одинарного бару
            /**/{ data: [22, 43, 21, 0, 49, /** 22, 43, 21, 13, 43 /**/] }/**/

                // дані для подвійних барів
                /*{
                    name: 'Противник', // За бажанням можна додати назву
                    color: '#FF4560',
                    data: [44, 55, 41, 64, 22],
                },
                {
                    name: 'Свої',
                    color: '#008FFB',
                    data: [53, 32, 33, 52, 13],
                },*/

                // дані для потрійних барів
                /*{
                     name: 'Втрачено', // За бажанням можна додати назву
                     color: '#FF4560',
                     data: [44, 55, 41, 64, 22],
                 },
                 {
                     name: 'Виставлено',
                     color: '#ECC94B',
                     data: [53, 15, 33, 52, 13],
                 },
                 {
                     name: 'Відновлено',
                     color: '#10B981',
                     data: [53, 32, 33, 52, 13],
                 },*/



            ],
            chart: {
                type: 'bar',
                height: 200,
                // stacked: true,
                background: 'transparent',
                toolbar: { show: false },
                /*sparkline: {
                    enabled: true
                },*/
            },
            dataLabels: {
                enabled: true,
                textAnchor: 'start',
                style: {
                    //для одинарних:
                    fontSize: '1rem',
                    fontWeight: '700',
                    //Для подвійних та потрійних:
                    /*fontWeight: '100',*/

                    colors: ['#fff'],
                },
                background: {
                    enabled: true, //для одинарних треба true
                    padding: 15,
                    borderColor: '#dee2e6',
                    foreColor: '#dee2e6',
                    backgroundColor: '#1d2124',
                    borderRadius: 5,
                },
                //Для одинарних
                offsetY: 8,
                offsetX: 20,
                //Для подвійних потрійних
                /*offsetX: 5,*/

                hideOverflowingLabels: false,
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    distributed: true, // для одинарних треба true - Розподіляє кольори масиву окремо на кожен стовпчик
                    barHeight: '85%', //для одиночного бару
                    //barHeight: '75%', // для потрійного чи подвійного бару5
                    hideZeroBarsWhenGrouped: false,
                    dataLabels: {
                        // для одинарних:
                        position: 'bottom',
                        textAnchor: 'end',
                        offsetY: 0,
                        offsetX: 20,

                        // для подвійних потрійних
                        /*position: 'top',*/

                    },
                    borderRadius: 5, // Одинарні
                    // borderRadius: 2, // подвійні потрійні
                    borderRadiusApplication: 'end',

                },
            },
            stroke: {
                show: false,
                width: 1,
                colors: ['#ffffff0'],
            },
            title: {
                // text: 'Fiction Books Sales',
                floating: true,
            },
            xaxis: {
                categories: ['14 АК', '2 КНГУ "Хартія"', '16 АК', '10 АК', '3 АК', /**'14 АК', '2 КНГУ "Хартія"', '16 АК', '10 АК', '3 АК'/**/],
                labels: {
                    show: false,
                    offsetY: 5,
                    formatter: function (val) {
                        return val;
                    },
                    style: {
                        fontSize: '1.25rem',
                        fontWeight: 300,
                        fontFamily: '"Exo 2", Arial, serif',
                    },
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                title: {
                    text: undefined,
                },
                labels: {
                    show: true,
                    minWidth: 50,
                    maxWidth: 300,
                    offsetY: 5,
                    // align: 'right',
                    style: {
                        fontSize: '1.25rem',
                        fontWeight: 300,
                        fontFamily: '"Exo 2", Arial, serif',
                    },
                },
            },
            grid: {
                show: false,         // false — повністю ховає фонову сітку
                // Або якщо хочете змінити колір:
                borderColor: '#333b42', // колір ліній сітки, якщо вони увімкнені (show: true)
                padding: {
                    top: -20,    //  Трохи піднімемо верхню межу
                    bottom: -15, //  Зрізаємо порожнечу знизу, яка штовхала графік угору
                    left: 0,
                    right: 0
                },
            },

            tooltip: {
                enabled: true,
                shared: false,   //  ВИМИКАЄМО відображення всіх серій одночасно
                intersect: true,  //  ВМИКАЄМО точкове наведення на конкретний шматочок
                followCursor: true, // Тултіп буде бігати за мишкою, так зручніше на тонких графіках
                theme: 'dark',
                x: {
                    show: false  // Ховаємо категорію (ваш "2008"), щоб не заважала
                },
                y: {
                    formatter: function (val) {
                        return val; // Просто виводить цифру
                    },
                    title: {
                        formatter: function (seriesName) {
                            return seriesName; //  Повертає назву саме ТОЇ серії, на яку навели (напр. "14 АК")
                        }
                    }
                }
            },
            fill: {
                opacity: 1,
            },
            legend: {
                show: false, //для одинарних false
                position: 'right',
                horizontalAlign: 'middle',
                // offsetX: 40,
                fontSize: '1rem',
                labels: {
                    colors: '#dee2e6',    // Колір тексту легенди під вашу темну тему
                },
                markers: {
                    width: 12,
                    height: 12,
                    radius: 4,            // Заокруглені маркерні квадратики
                    strokeWidth: 0,
                },
                itemMargin: {
                    horizontal: 0,
                    vertical: 8,          // Відступи між елементами легенди по вертикалі
                }
            },
            colors: [

                // кольори для одинарних барів           
                '#0A74DA', '#AFB42B', '#00A86B', '#C62828', '#5E35B1', '#D84315',
                '#0288D1', '#C59B27', '#2E7D32', '#B71C1C', '#4527A0', '#E64A19',
                '#1565C0', '#E6A100', '#1B5E20', '#880E4F', '#6A1B9A', '#BF360C',
                '#0D47A1', '#F57C00', '#4E342E', '#AD1457', '#311B92', '#A1887F',
                '#4A90E2', '#FBC02D', '#00796B', '#D81B60', '#7B1FA2', '#8D6E63'

            ],
        },

        options21: {
            theme: {
                mode: 'dark'
            },
            series: [
                /** /{ name: '14 АК', data: [22] },
                { name: '2 КНГУ "Хартія"', data: [43] },
                { name: '16 АК', data: [21] },
                { name: '10 АК', data: [13] },
                { name: '3 АК', data: [43] },/**/

                // дані для одинарного бару
                /** /{ data: [22, 43, 21, 0, 49, /** 22, 43, 21, 13, 43 /** /] }/**/

                // дані для подвійних барів
                {
                    name: 'Противник', // За бажанням можна додати назву
                    color: '#FF4560',
                    data: [44, 55, 41, 64, 22],
                },
                {
                    name: 'Свої',
                    color: '#008FFB',
                    data: [53, 32, 33, 52, 13],
                },

                // дані для потрійних барів
                /*{
                     name: 'Втрачено', // За бажанням можна додати назву
                     color: '#FF4560',
                     data: [44, 55, 41, 64, 22],
                 },
                 {
                     name: 'Виставлено',
                     color: '#ECC94B',
                     data: [53, 15, 33, 52, 13],
                 },
                 {
                     name: 'Відновлено',
                     color: '#10B981',
                     data: [53, 32, 33, 52, 13],
                 },*/



            ],
            chart: {
                type: 'bar',
                height: 200,
                // stacked: true,
                background: 'transparent',
                toolbar: { show: false },
                /*sparkline: {
                    enabled: true
                },*/
            },
            dataLabels: {
                enabled: true,
                textAnchor: 'start',
                style: {
                    //для одинарних:
                    /*fontSize: '1rem',
                    fontWeight: '700',*/
                    //Для подвійних та потрійних:
                    fontWeight: '100',

                    colors: ['#fff'],
                },
                background: {
                    enabled: false, //для одинарних треба true
                    padding: 15,
                    borderColor: '#dee2e6',
                    foreColor: '#dee2e6',
                    backgroundColor: '#1d2124',
                    borderRadius: 5,
                },
                //Для одинарних
                /*offsetY: 8,
                offsetX: 20,*/
                //Для подвійних потрійних
                offsetX: 5,
                hideOverflowingLabels: false,
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    distributed: false, // для одинарних треба true - Розподіляє кольори масиву окремо на кожен стовпчик
                    //barHeight: '85%', //для одиночного бару
                    barHeight: '75%', // для потрійного чи подвійного бару5
                    hideZeroBarsWhenGrouped: true,
                    dataLabels: {
                        // для одинарних:
                        /* position: 'bottom',
                         textAnchor: 'end',
                         offsetY: 0,
                         offsetX: 20,*/

                        // для подвійних потрійних
                        position: 'top',

                    },
                    // borderRadius: 5, // Одинарні
                    borderRadius: 2, // подвійні потрійні
                    borderRadiusApplication: 'end',

                },
            },
            stroke: {
                show: false,
                width: 1,
                colors: ['#ffffff0'],
            },
            title: {
                // text: 'Fiction Books Sales',
                floating: true,
            },
            xaxis: {
                categories: ['14 АК', '2 КНГУ "Хартія"', '16 АК', '10 АК', '3 АК', /**'14 АК', '2 КНГУ "Хартія"', '16 АК', '10 АК', '3 АК'/**/],
                labels: {
                    show: false,
                    offsetY: 5,
                    formatter: function (val) {
                        return val;
                    },
                    style: {
                        fontSize: '1.25rem',
                        fontWeight: 300,
                        fontFamily: '"Exo 2", Arial, serif',
                    },
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                title: {
                    text: undefined,
                },
                labels: {
                    show: true,
                    minWidth: 50,
                    maxWidth: 300,
                    offsetY: 5,
                    // align: 'right',
                    style: {
                        fontSize: '1.25rem',
                        fontWeight: 300,
                        fontFamily: '"Exo 2", Arial, serif',
                    },
                },
            },
            grid: {
                show: false,         // false — повністю ховає фонову сітку
                // Або якщо хочете змінити колір:
                borderColor: '#333b42', // колір ліній сітки, якщо вони увімкнені (show: true)
                padding: {
                    top: -20,    //  Трохи піднімемо верхню межу
                    bottom: -15, //  Зрізаємо порожнечу знизу, яка штовхала графік угору
                    left: 0,
                    right: 0
                },
            },

            tooltip: {
                enabled: true,
                shared: false,   //  ВИМИКАЄМО відображення всіх серій одночасно
                intersect: true,  //  ВМИКАЄМО точкове наведення на конкретний шматочок
                followCursor: true, // Тултіп буде бігати за мишкою, так зручніше на тонких графіках
                theme: 'dark',
                x: {
                    show: false  // Ховаємо категорію (ваш "2008"), щоб не заважала
                },
                y: {
                    formatter: function (val) {
                        return val; // Просто виводить цифру
                    },
                    title: {
                        formatter: function (seriesName) {
                            return seriesName; //  Повертає назву саме ТОЇ серії, на яку навели (напр. "14 АК")
                        }
                    }
                }
            },
            fill: {
                opacity: 1,
            },
            legend: {
                show: true, //для одинарних false
                position: 'right',
                horizontalAlign: 'middle',
                // offsetX: 40,
                fontSize: '1rem',
                labels: {
                    colors: '#dee2e6',    // Колір тексту легенди під вашу темну тему
                },
                markers: {
                    width: 12,
                    height: 12,
                    radius: 4,            // Заокруглені маркерні квадратики
                    strokeWidth: 0,
                },
                itemMargin: {
                    horizontal: 0,
                    vertical: 8,          // Відступи між елементами легенди по вертикалі
                },
                formatter: function (seriesName, opts) {
                    // opts.w.config.series[opts.seriesIndex] — бере серію за її індексом
                    if (opts.w.config.series[opts.seriesIndex]) {
                        return opts.w.config.series[opts.seriesIndex].name;
                    }
                    return seriesName;
                },
            },
            colors: ['#FF4560', '#008FFB'],
        },

        options22: {
            theme: {
                mode: 'dark'
            },
            series: [
                /** /{ name: '14 АК', data: [22] },
                { name: '2 КНГУ "Хартія"', data: [43] },
                { name: '16 АК', data: [21] },
                { name: '10 АК', data: [13] },
                { name: '3 АК', data: [43] },/**/

                // дані для одинарного бару
                /** /{ data: [22, 43, 21, 0, 49, /** 22, 43, 21, 13, 43 /** /] }/**/

                // дані для подвійних барів
                /*{
                    name: 'Противник', // За бажанням можна додати назву
                    color: '#FF4560',
                    data: [44, 55, 41, 64, 22],
                },
                {
                    name: 'Свої',
                    color: '#008FFB',
                    data: [53, 32, 33, 52, 13],
                },*/

                // дані для потрійних барів
                {
                    name: 'Втрачено', // За бажанням можна додати назву
                    color: '#FF4560',
                    data: [44, 55, 41, 64, 22],
                },
                {
                    name: 'Виставлено',
                    color: '#ECC94B',
                    data: [53, 15, 33, 52, 13],
                },
                {
                    name: 'Відновлено',
                    color: '#10B981',
                    data: [53, 32, 33, 52, 13],
                },



            ],
            chart: {
                type: 'bar',
                height: 200,
                // stacked: true,
                background: 'transparent',
                toolbar: { show: false },
                /*sparkline: {
                    enabled: true
                },*/
            },
            dataLabels: {
                enabled: true,
                textAnchor: 'start',
                style: {
                    //для одинарних:
                    /*fontSize: '1rem',
                    fontWeight: '700',*/
                    //Для подвійних та потрійних:
                    fontWeight: '100',

                    colors: ['#fff'],
                },
                background: {
                    enabled: false, //для одинарних треба true
                    padding: 15,
                    borderColor: '#dee2e6',
                    foreColor: '#dee2e6',
                    backgroundColor: '#1d2124',
                    borderRadius: 5,
                },
                //Для одинарних
                /*offsetY: 8,
                offsetX: 20,*/
                //Для подвійних потрійних
                offsetX: 5,
                hideOverflowingLabels: false,
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    distributed: false, // для одинарних треба true - Розподіляє кольори масиву окремо на кожен стовпчик
                    //barHeight: '85%', //для одиночного бару
                    barHeight: '75%', // для потрійного чи подвійного бару5
                    hideZeroBarsWhenGrouped: true,
                    dataLabels: {
                        // для одинарних:
                        /* position: 'bottom',
                         textAnchor: 'end',
                         offsetY: 0,
                         offsetX: 20,*/

                        // для подвійних потрійних
                        position: 'top',

                    },
                    // borderRadius: 5, // Одинарні
                    borderRadius: 2, // подвійні потрійні
                    borderRadiusApplication: 'end',

                },
            },
            stroke: {
                show: false,
                width: 1,
                colors: ['#ffffff0'],
            },
            title: {
                // text: 'Fiction Books Sales',
                floating: true,
            },
            xaxis: {
                categories: ['14 АК', '2 КНГУ "Хартія"', '16 АК', '10 АК', '3 АК', /**'14 АК', '2 КНГУ "Хартія"', '16 АК', '10 АК', '3 АК'/**/],
                labels: {
                    show: false,
                    offsetY: 5,
                    formatter: function (val) {
                        return val;
                    },
                    style: {
                        fontSize: '1.25rem',
                        fontWeight: 300,
                        fontFamily: '"Exo 2", Arial, serif',
                    },
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                title: {
                    text: undefined,
                },
                labels: {
                    show: true,
                    minWidth: 50,
                    maxWidth: 300,
                    offsetY: 5,
                    // align: 'right',
                    style: {
                        fontSize: '1.25rem',
                        fontWeight: 300,
                        fontFamily: '"Exo 2", Arial, serif',
                    },
                },
            },
            grid: {
                show: false,         // false — повністю ховає фонову сітку
                // Або якщо хочете змінити колір:
                borderColor: '#333b42', // колір ліній сітки, якщо вони увімкнені (show: true)
                padding: {
                    top: -20,    //  Трохи піднімемо верхню межу
                    bottom: -15, //  Зрізаємо порожнечу знизу, яка штовхала графік угору
                    left: 0,
                    right: 0
                },
            },

            tooltip: {
                enabled: true,
                shared: false,   //  ВИМИКАЄМО відображення всіх серій одночасно
                intersect: true,  //  ВМИКАЄМО точкове наведення на конкретний шматочок
                followCursor: true, // Тултіп буде бігати за мишкою, так зручніше на тонких графіках
                theme: 'dark',
                x: {
                    show: false  // Ховаємо категорію (ваш "2008"), щоб не заважала
                },
                y: {
                    formatter: function (val) {
                        return val; // Просто виводить цифру
                    },
                    title: {
                        formatter: function (seriesName) {
                            return seriesName; //  Повертає назву саме ТОЇ серії, на яку навели (напр. "14 АК")
                        }
                    }
                }
            },
            fill: {
                opacity: 1,
            },
            legend: {
                show: true, //для одинарних false
                position: 'right',
                horizontalAlign: 'middle',
                // offsetX: 40,
                fontSize: '1rem',
                labels: {
                    colors: '#dee2e6',    // Колір тексту легенди під вашу темну тему
                },
                markers: {
                    width: 12,
                    height: 12,
                    radius: 4,            // Заокруглені маркерні квадратики
                    strokeWidth: 0,
                },
                itemMargin: {
                    horizontal: 0,
                    vertical: 8,          // Відступи між елементами легенди по вертикалі
                },
                formatter: function (seriesName, opts) {
                    // opts.w.config.series[opts.seriesIndex] — бере серію за її індексом
                    if (opts.w.config.series[opts.seriesIndex]) {
                        return opts.w.config.series[opts.seriesIndex].name;
                    }
                    return seriesName;
                },
            },
            colors: ['#FF4560', '#ECC94B', '#10B981'],
        }
    }
    

    // Ініціалізуємо Другий графік в окрему змінну chart2 та в окремий блок #chart2
    let chartDetail = document.querySelectorAll('.chart-detail');
    const chart2 = [];
    console.log(chartDynamic);
    for (let i = 0; i < chartDetail.length; i++) {
        chart2.push(new ApexCharts(chartDetail[i], optionsBar['options2']));
        chart2[chart2.length - 1].render();
    }
    /*const chart2 = new ApexCharts(document.querySelector('#chart2'), options2);
    chart2.render();*/

    /*setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 1000);*/

    // ==========================================
    // ГРАФІК 3: Radar with polygon fill
    // ==========================================

    let optionsRadar = {
        series: [
            {
                name: 'Series 1',
                data: [20, 100, 40, 30, 50, 80, 33],
            },
        ],
        chart: {
            height: 200,
            type: 'radar',
            toolbar: { show: false },
        },
        dataLabels: {
            enabled: true,
            style: {
                // fontSize: '1rem',
                fontWeight: '100',
            },
            background: {
                enabled: true,
                padding: 3,
                borderColor: 'rgba(29, 33, 36, 0.5)',
                foreColor: '#dee2e6',
                backgroundColor: 'rgba(29, 33, 36, 0.8)',
                borderRadius: 5,
            },
            offsetY: 0,
            offsetX: 0,
        },
        plotOptions: {
            radar: {
                size: 80,
                polygons: {
                    strokeColors: '#6c757d',
                    fill: {
                        colors: ['#1d2124', '#232629'],
                    },
                },
            },
        },
        title: {
            // text: 'Radar with Polygon Fill',
        },
        colors: ['#FF4560'],
        markers: {
            size: 4,
            colors: ['#fff'],
            strokeColor: '#FF4560',
            strokeWidth: 2,
        },
        tooltip: {
            y: {
                formatter: function (val) {
                    return val
                },
            },
        },
        xaxis: {
            categories: [
                'УВ (с) Зх',
                '12АК',
                'УВ (с) Пн',
                'УВ Курськ',
                'УОС',
                'УВ (с) Сх',
                'УВ (с) Пд',
            ],
            labels: {
                style: {
                    fontSize: '1rem',
                    fontWeight: 300,
                    fontFamily: '"Exo 2", Arial, serif',
                    colors: ['#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6'],
                }
            }
        },
        yaxis: {
            labels: {
                formatter: function (val, i) {
                    if (i % 2 === 0) {
                        return val
                    } else {
                        return ''
                    }
                },
            },
        },
        grid: {
            padding: {
                top: 0,    //  Трохи піднімемо верхню межу
                bottom: 0, //  Зрізаємо порожнечу знизу, яка штовхала графік угору
                left: 0,
                right: 0
            },
        },
    }

    let chartRad = new ApexCharts(document.querySelector('#chart-radar'), optionsRadar)
    chartRad.render();

    // ==========================================
    // ГРАФІК 4: Bar with Negative Values
    // ==========================================
    let optionsChartOposit = {
        series: [
            {
                name: 'СОУ',
                data: [-40],
            },
            {
                name: 'Противник',
                data: [100],
            },
        ],
        chart: {
            type: 'bar',
            height: 10, // 👈 1. Зменшуємо загальну висоту SVG-контейнера до мінімуму
            stacked: true,
            toolbar: { show: false },
            sparkline: { enabled: true } // 👈 2. ВКЛЮЧАЄМО режим sparkline (він миттєво зрізає всі відступи бібліотеки)
        },
        colors: ['#008FFB', '#FF4560'],
        plotOptions: {
            bar: {
                borderRadius: 2, // Зменшуємо радіус, бо для 10px великий радіус зламає вигляд
                borderRadiusApplication: 'end',
                borderRadiusWhenStacked: 'all',
                horizontal: true,
                barHeight: '100%', // 👈 3. Розтягуємо бар на всю доступну висоту (зараз регулюється висотою chart)
            },
        },
        dataLabels: {
            enabled: false,
        },
        stroke: {
            show: false, // Вимикаємо обводку, щоб не з'їдала товщину
        },
        grid: {
            show: false,
            padding: {
                top: 0,    // 👈 Спробуйте поставити від'ємне значення, щоб затягнути SVG вище
                bottom: 0,
                left: 0,
                right: 0
            },
        },
        yaxis: {
            show: false,
        },
        tooltip: {
            enabled: false,
            shared: false,
            y: {
                formatter: function (val) {
                    return Math.abs(val)
                },
            },
        },
        xaxis: {
            categories: ['0'],
            show: false,
            min: -100,
            max: 100,
        },
        legend: {
            show: false, // 👈 4. ОБОВ'ЯЗКОВО ХОВАЄМО. Легенду краще вивести звичайним HTML/CSS над графіком
        },
    };

    let chartCorel = document.querySelectorAll('.block-corelation-info .chart');
    for (let i = 0; i < chartCorel.length; i++) {
        let chartOposit = new ApexCharts(chartCorel[i], optionsChartOposit);
        chartOposit.render();
    }
    /*let chartOposit = new ApexCharts(document.querySelector('#chartOposit'), optionsChartOposit);
    chartOposit.render();*/

    // let dynamic = document.querySelector('.block-dynamic');
    let dynamicInfos = document.querySelectorAll('.block-dynamic .block-dynamic-info');
    for (let i = 0; i < dynamicInfos.length; i++) {
        dynamicInfos[i].addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-show')) {
                let el = (e.target.classList.contains('btn-show') && e.target) || e.target.closest('.block-dynamic-info');
                let container = el.closest('.block-dynamic');
                let nodesList = container.querySelectorAll('.block-dynamic-info.active');
                let opt = el.dataset.chart;
                for (let i = 0; i < nodesList.length; i++) {
                    nodesList[i].classList.remove('active');
                }
                el.classList.add('active');
                document.querySelector('.block-detale > .title').innerHTML = el.dataset.title;
                for (let i = 0; i < chartDetail.length; i++) {
                    // chart2[i].updateOptions(optionsBar[opt]);
                    let chartContainer = chart2[i].el;
                    // перезавантажуємо графік
                    chart2[i].destroy();
                    chart2[i] = new ApexCharts(chartContainer, optionsBar[opt]);
                    chart2[i].render();
                }
            }
        });
    }
};

window.addEventListener("load", () => {
    // loadData();
    iDBDexie();
    // drawChart();

    // console.log("localStorage set: ", localStorage.getItem("userMessage"));







    const options3 = {
        theme: {
            mode: 'dark'
        },
        series: [
            /*{ name: '12 АК', data: [5222] },
            { name: '13 АК', data: [1243] },
            { name: '14 АК', data: [2221] },
            { name: '15 АК', data: [3213] },
            { name: '16 АК', data: [1243] },*/

            { name: '12 АК', data: [22] },
            { name: '13 АК', data: [43] },
            { name: '14 АК', data: [21] },
            { name: '15 АК', data: [0] },
            { name: '16 АК', data: [43] },

            /*{ name: '12 АК', data: [0] },
            { name: '13 АК', data: [0] },
            { name: '14 АК', data: [0] },
            { name: '15 АК', data: [0] },
            { name: '16 АК', data: [0] },*/
        ],
        colors: [
            '#0A74DA', '#E6A100', '#00A86B', '#C62828', '#5E35B1', '#D84315',
            '#0288D1', '#C59B27', '#2E7D32', '#B71C1C', '#4527A0', '#E64A19',
            '#1565C0', '#AFB42B', '#1B5E20', '#880E4F', '#6A1B9A', '#BF360C',
            '#0D47A1', '#F57C00', '#4E342E', '#AD1457', '#311B92', '#A1887F',
            '#4A90E2', '#FBC02D', '#00796B', '#D81B60', '#7B1FA2', '#8D6E63'
        ],
        chart: {
            type: 'bar',
            width: '100%',
            height: 65, // Зменшено до 60 для кращого візуального балансу в один рядок
            stacked: true,
            background: 'transparent',
            toolbar: { show: false },
            sparkline: {
                enabled: true // 👈 ВИМКНЕНО, щоб не обрізався TOTAL
            }
        },
        dataLabels: {
            enabled: true,
            style: {
                fontSize: '1rem',
                fontWeight: '700',
                colors: ['#fff']
            },
            offsetY: 8,
            background: {
                enabled: true,
                padding: 5,
                borderColor: '#dee2e6',
                foreColor: '#dee2e6',
                backgroundColor: '#1d2124',
                borderRadius: 3,
            },
            hideOverflowingLabels: false,
        },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '60%', // Бар займає всю висоту контейнера (60px)
                hideZeroBarsWhenGrouped: false,
                dataLabels: {
                    total: {
                        enabled: true,
                        offsetX: 20, // 👈 Зміщуємо суму трохи вправо від краю бару
                        offsetY: -3,
                        style: {
                            fontSize: '2rem',
                            fontWeight: 900,
                            color: '#fff',
                        },
                    },
                },
            },
        },
        stroke: {
            width: 4,
            colors: ['#1d2124'], // Задайте колір вашого фону, щоб розділити шматочки гарною лінією
        },
        // Внутрішні відступи замість sparkline:
        grid: {
            show: false,
            padding: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 90 // 👈 ОСЬ ЦЕЙ ЗАПАС (40px) не дозволить значенню TOTAL обрізатися праворуч!
            }
        },
        xaxis: {
            categories: ['23/06/26-26/06/26'],
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        tooltip: {
            enabled: true // Оскільки tooltip вимкнено за вашим попереднім бажанням
        },
        fill: { opacity: 1 },
        legend: { show: false },
    }

    const chart3 = new ApexCharts(document.querySelector('#chart3'), options3);
    chart3.render();

    // Гарантуємо, що графік адаптується під новий flex-контейнер без багів
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 50);
});







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

    // Вибираємо дані з бази (паралельний Promise.all усередині вашого методу)
    const dbData = await this.getEventByDate(datesToFetch);
    console.log('dbData: ', dbData);
    //=========================
    // 1. Категорії
    //=========================
    // Формуємо сумарні дані для категорій
    const categoriesData = {};
    const totalName = this.clearToDBKey('ВСЬОГО за СО:');
    const neededKey = this.clearToDBKey('Угруповання');
    // Перебираємо дозволені категорії з глобального конфігу
    for (let i = 0; i < Data.global.categories.length; i++) {
        const catName = Data.global.categories[i];
        const binding = Data.global.categoriesByKey[catName];
        // Apex charts
        let chart = {
            /*series: [
                {
                    name: 'Обстріли',
                    data: [3722, 3829, 3261, 3249, 3120, 3420, 3235], // Використовуємо наші дані
                },
            ],*/
            series: [],
            /*['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07']*/
            labels: []
        };
        const seriesItem = {};
        // Підрозділи
        const unitsData = {
            order: Data.global.units
        };
        // Перебираємо рядки, які повернула база даних
        for (let j = 0; j < dbData.length; j++) {
            const row = dbData[j];
            // Картка категорії: Перевіряємо, чи це потрібний нам рядок підсумків ("ВСЬОГО за СО:")
            if (Object.hasOwn(row, neededKey) && this.clearToDBKey(row[neededKey]) === totalName) {

                // Задаємо базову структуру для категорії, якщо її ще немає в результатах
                if (!Object.hasOwn(categoriesData, catName)) {
                    categoriesData[catName] = {
                        title: Data.global.categoriesByTitle[catName],
                        headerText: Data.global.categoriesByHeader[catName],
                        total: 0,
                        chart: Data.global.getChartArea()
                    };
                    categoriesData[catName].chart.xaxis.tickAmount = datesToChart.length; // встановлюємо кількість засічок на осі Х
                    seriesItem[catName] = [];
                }

                // Варіант А: Прив'язка є рядком (один ключ в базі)
                if (typeof binding === 'string') {
                    // Парсимо .total
                    const value = parseInt(row[binding], 10) || 0;
                    categoriesData[catName].total += value; // Сумуємо в загальний тотал
                    // Series.data
                    seriesItem[catName].push(value);
                } else if (Array.isArray(binding)) {
                    // Варіант Б: Прив'язка є масивом (кілька ключів в базі)
                    categoriesData[catName].multiple = binding;
                    Array.isArray(seriesItem[catName]) && (seriesItem[catName] = {});
                    for (let k = 0; k < binding.length; k++) {
                        const keyName = binding[k];
                        const value = parseInt(row[keyName], 10) || 0;
                        !Object.hasOwn(seriesItem[catName], keyName) && (seriesItem[catName][keyName] = []);
                        // Ініціалізуємо лічильник total для конкретного підключа (наприклад: АУ, КАБ, КАР), якщо його немає
                        if (!Object.hasOwn(categoriesData[catName], keyName)) {
                            categoriesData[catName][keyName] = 0;
                        }
                        categoriesData[catName].total += value;    // Сумуємо в загальний тотал категорії
                        categoriesData[catName][keyName] += value; // Сумуємо в окреме поле цього ключа
                        seriesItem[catName][keyName].push(value);  // Додаємо дані для графіку
                        // console.log('seriesItem[catName][keyName].push(value): ', catName, keyName, value, seriesItem[catName])
                    }

                }
            }
            // TODO: Картка підрозділу
            // Формуємо сумарні дані для підрозділу
            // Перебираємо дозволені підрозділи з глобального конфігу
            Data.global.units.forEach(unitName => {
                !Object.hasOwn(unitsData, unitName) && (unitsData[unitName] = {});
                !Object.hasOwn(unitsData[unitName], 'title') && (unitsData[unitName].title = Data.text[unitName]);
                !Object.hasOwn(unitsData[unitName], 'classes') && (unitsData[unitName].classes = ['box-' + Data.global.unitStructure[unitName].class]);
                !Object.hasOwn(unitsData[unitName], 'total') && (unitsData[unitName].total = 0);
                !Object.hasOwn(unitsData[unitName], 'chart') // TODO: тут відразу брати і для мультибарного
                    && (unitsData[unitName].chart = Data.global.getChartBarOne()); // конфіг для одиночного бару
                !Object.hasOwn(unitsData[unitName].chart, 'series') && (unitsData[unitName].chart.series = []);
                !Object.hasOwn(unitsData[unitName].chart.xaxis, 'categories')
                    && (unitsData[unitName].chart.xaxis.categories = Data.global.unitStructure[unitName].squad);
                catName === 'Обстріли' && unitName === 'uvKursk'
                    && console.log('TESTER: ', catName, unitName, Data.global.unitStructure[unitName].squad)
                // Рядок з нашим підрозділом
                if (Object.hasOwn(row, neededKey) && this.clearToDBKey(row[neededKey]) === this.clearToDBKey(Data.global.unitStructure[unitName].nameMd)) {
                    // Дані з категорії по ключу
                    if (Object.hasOwn(row, Data.global.categoriesByKey[catName])) {
                        unitsData[unitName].total += parseInt(row[Data.global.categoriesByKey[catName]], 10);
                    }

                    // console.log(row[neededKey]);
                    //unitsData[unitName].total += row[unitName]
                }
                // Перебираємо підлеглі підрозділи (squad)
                // let squadDataSeries = [];
                Data.global.unitStructure[unitName].squad.forEach(squadName => {
                    // Рядок з підлеглим підрозділом (squad)
                    if (Object.hasOwn(row, neededKey) && this.clearToDBKey(row[neededKey]) === this.clearToDBKey(squadName)) {
                        // Дані з категорії по ключу (перевіряємо наявність даних в рядку)
                        if (Object.hasOwn(row, Data.global.categoriesByKey[catName])) {
                            unitsData[unitName].chart


                            // перебираємо вже існуючі series squad
                            /*let flag = false;
                            unitsData[unitName].chart.series.forEach((sq, key) => {
                                if (sq && Object.hasOwn(sq,'name') && sq.name === squadName) {
                                    unitsData[unitName].chart.series[key].data[0] += parseInt(row[Data.global.categoriesByKey[catName]]);
                                    flag = true;
                                }
                            });*/
                            // якщо squad зустрічається вперше
                            /*!flag && unitsData[unitName].chart.series.push({
                                name: squadName,
                                data: [parseInt(row[Data.global.categoriesByKey[catName]])]
                            });*/
                            unitsData[unitName].chart.series.push({
                                data: [parseInt(row[Data.global.categoriesByKey[catName]])]
                            });
                        }
                    }
                });
                // console.log(unitName,  squadDataSeries);
                // unitsData[unitName].chart.series = squadDataSeries;


            });
        }
        // Парсимо chart.series для категорії
        if (categoriesData[catName].multiple) {
            for (let keyName in seriesItem[catName]) {
                categoriesData[catName].chart.series.push({ name: (Data.text[keyName] && Data.text[keyName]) || keyName, data: seriesItem[catName][keyName] });
            }
        } else {
            categoriesData[catName].chart.series.push({ name: catName, data: seriesItem[catName] });
        }
        // Парсимо chart.labels
        console.log('Дані юнітів: ', catName, unitsData);
        categoriesData[catName].chart.labels = datesToChart;
        categoriesData[catName].units = unitsData;
    }

    //=========================
    // TODO: 2. Підрозділи
    //=========================
    // Формуємо сумарні дані для підрозділу
    /* const unitsData = {};
     // Перебираємо дозволені підрозділи з глобального конфігу
     Data.global.units.forEach(unitName => {
         unitsData[unitName] = {
             title: Data.text[unitName],
             class: ['box-' + Data.global.unitStructure[unitName].class],
             total: 0
         };
         //Йдемо по рядкам даних з бази
         dbData.forEach(dbRow => {
             // Вибараємо суму для підрозділу за категорію
         });
     });*/

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
            data: categoriesData // Передаємо сформований об'єкт із прорахованими сумами
        },
        units: Data.global.unitsShow,
        data: dbData // Сирі дані з бази про всяк випадок теж лишаємо
    };

    return sets;
}