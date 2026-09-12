/**
 * @fileoverview Модуль для виводу (відображення) даних на сторінку
 * @version 1.0.0
 * @dependencies apexchart.js
 */

//const db = null; // {Object<{name: string, iDB: Object}>} - відкриті бази даних
class Views {
    // TODO: Views.templates description
    templates = {};
    // TODO: Views.trueDOM description
    trueDOM = {};

    /**
     * @param {object} opt
     * @param {string[]} opt.dbList
     */
    constructor(opt) {
        
        this.init();
    }

    init() {
        this.getTemplates();
    }
    //=============================
    // Pages
    //=============================
    //TODO: Views.pageDashBoard description
    pageDashBoard(data) {
        console.log('отримані дані: ', data);
        //=======================
        // 0. Неправильний рендеринг структурного HTML
        //=======================
        const daysCounterEl = document.querySelector('.site-header .days-counter .days');
        const PeriodFromEl = document.querySelector('.site-header .title .from');
        const PeriodToEl = document.querySelector('.site-header .title .to');
        daysCounterEl.textContent = data.warDay;
        PeriodFromEl.textContent = data.showDateText.from;
        PeriodToEl.textContent = data.showDateText.to;

        
        // вибираємо куди вставлятимемо
        const containerCategories = document.querySelector('.block-dynamic > .row');
        const containerUnits = document.querySelector('.block-detale > .row');
        // підготовка контейнера
        containerCategories.innerHTML = '';
        containerUnits.innerHTML = '';
        // створюємо фрагмент коду
        let fragmentCategories = document.createDocumentFragment();
        let chartsCategories = [];

        let fragmentUnits = document.createDocumentFragment();
        let chartsUnits = [];
        // перебираємо дані для шаблону. це визначить кількість копій шаблону
        data.categories.order.forEach((catName, key) => {
            //=======================
            // 1. Категорії
            //=======================
            // екземпляр шаблону картки категорії
            let cloneCategories = this.templates['block-dynamic-info'].content.cloneNode(true);
            // вносимо дані в екземпляр шаблону
            /*
                <template id="block-dynamic-info" data-template="block-dynamic-info">
                    <div class="block-dynamic-info col-auto card text-center" data-chart="" data-title="">
                        <div class="card-header row align-items-center">
                            <div class="col d-flex flex-grow-1">
                                <h3 class="title">
                        
                                </h3>
                            </div>
                            <div class="col">
                                <button type="button" class="btn-show btn btn-outline-secondary btn-sm" data-bs-toggle="offcanvas" data-bs-target="#offcanvasTop" aria-controls="offcanvasTop"></button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="value"><span class="badge text-bg-warning"></span></div>
                            <div class="chart-container">
                                <div class="chart chart-dynamic"><!--Stacked Area--></div>
                            </div>
                        </div>
                    </div>
                </template>
            */
            // куди вставити
            const ElCategories = cloneCategories.querySelector('.block-dynamic-info');
            const titleElCategories = cloneCategories.querySelector('.title');
            const valueElCategories = cloneCategories.querySelector('.value .badge');
            const btnShowElCategories = cloneCategories.querySelector('.btn-show');
            const chartElCategories = cloneCategories.querySelector('.chart-dynamic');
            // що вставити
            ElCategories.dataset.title = data.categories.data[catName].headerText;
            titleElCategories && (titleElCategories.textContent = data.categories.data[catName].title);
            if (data.categories.data[catName].multiple && Array.isArray(data.categories.data[catName].multiple) && data.categories.data[catName].multiple.length) {
                // Якщо треба вивести тотал кількома значеннями
                let currentData = data.categories.data[catName];
                let text = '';
                for (let i = 0; i < currentData.multiple.length; i++) {
                    let totalItem = currentData.multiple[i];
                    Object.hasOwn(currentData, totalItem)
                        && valueElCategories
                        && (
                            (i > 0 && (text = text + '/')),
                            text = text + currentData[totalItem]
                        );
                }
                valueElCategories && (valueElCategories.textContent = text);
            } else {
                // Якщо тотал одним значенням
                valueElCategories && (valueElCategories.textContent = data.categories.data[catName].total);
            }
            btnShowElCategories && (btnShowElCategories.textContent = Data.text.detail);
            // вставка графіків
            // clone.dataset.chart
            chartsCategories.push(new ApexCharts(chartElCategories, data.categories.data[catName].chart));

            // зберігаємо у фрагмент коду
            fragmentCategories.appendChild(cloneCategories);

            if (key === 0) {
                //=======================
                // 2. Динамічні блоки
                //=======================
                let currentCategory = data.categories.data[catName];
                currentCategory.units.order.forEach(unitName => {
                    let currentUnit = currentCategory.units[unitName];
                    // екземпляр шаблону картки підрозділу
                    let cloneUnits = this.templates['block-detaile-info'].content.cloneNode(true);
                    /*
                        <template id="block-detaile-info" data-template="block-detaile-info">
                            <div class="block-detaile-info card col"> <!--.box-uv-west-->
                                <div class="card-header d-flex">
    
                                    <div class="flex-shrink-0">
                                        <h3 class="title mb-0"></h3>
                                    </div>
    
                                    <div class="flex-grow-1 d-flex align-items-center">
                                        <div class="counter"></div>
                                        <!--<div class="chart" id="chart3">--><!--Stacked Bar--><!--</div>-->
                                    </div>
    
                                    <div class="flex-shrink-0">
                                        <button class="btn-show btn btn-outline-secondary btn-sm"></button>
                                    </div>
                                </div>
    
                                <div class="card-body">
                                    <div class="row align-items-center">
                                        <div class="chart chart-detail"><!--Basic Bar--></div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    */
                    // куди вставити
                    const ElUnits = cloneUnits.querySelector('.block-detaile-info');
                    const titleElUnits = cloneUnits.querySelector('.title');
                    const valueElUnits = cloneUnits.querySelector('.counter');
                    const btnShowElUnits = cloneUnits.querySelector('.btn-show');
                    const chartElUnits = cloneUnits.querySelector('.chart-detail');
                    // що вставити
                    // console.log(cloneUnits);
                    ElUnits.classList.add(currentUnit.classes.join(','));
                    titleElUnits.textContent = currentUnit.title;
                    valueElUnits.textContent = currentUnit.total;
                    btnShowElUnits.textContent = Data.text.detail;
                    // вставка графіків
                    // clone.dataset.chart
                    chartsUnits.push(new ApexCharts(chartElUnits, currentUnit.chart));

                    fragmentUnits.appendChild(cloneUnits);
                });
            }
        });
        // Вставляємо в DOM 
        containerCategories.appendChild(fragmentCategories);
        chartsCategories.forEach(chartItem => {
            chartItem.render();
        });

        // Вставляємо в DOM 
        containerUnits.appendChild(fragmentUnits);
        chartsUnits.forEach(chartItem => {
            chartItem.render();
        });

        


        //=======================
        // 3. Співвідношення
        //=======================

        // TODO: створили фрагмент
        // TODO: заповнили фрагмент
        // TODO: вставили його в батьківський контейнер / фрагмент
        // TODO: вставили все в DOM
    }
    //TODO: обробник кожного маленького шаблону який бцде викликатися з батьківського через dataset
    render(tpl,data) {

    }

    //=============================
    // APIs
    //=============================
    //TODO: Views.getTemplates description
    getTemplates() {
        let tpls = document.querySelectorAll('body template');
        //TODO: зробити рендер та зберігання шаблонів в "базу"
        //TODO: побудувати карту залежностей шаблонів
        //TODO: розглянути Web Components там закладена логіка автоматичного рендерінгу шаблонів
        for (let i = 0; i < tpls.length; i++) {
            this.templates[tpls[i].dataset.template] = tpls[i];
        }
        console.log(tpls);
    }
}