/**
 * @fileoverview Набір основних ф-й, що об'єднують дані моделі та відображення. Навішування прослуховування подій.
 * @version 1.6.3
 * @dependencies
 */
class Controllers {
    /**
     * Ініціалізація об'єктів
     * @param {Object} model
     * @param {Object} view
     * @param {Object} store
     */
    constructor(model, view, store) {
        this.store = store;
        this.model = model;
        this.view = view;

        // Завантажуємо базові налаштування з localStorage
        this.parseLocalStore(true);

        // визначення ІД
        let t = new Date().getTime();
        let currentPageShort = document.body.dataset.page;
        let currentPage = 'page' + document.body.dataset.page;
        this.store.set('page', currentPage);
        this.store.set('pageName', document.body.dataset.page);
        let pageId = this.store.get('page') + t.toString();
        this.store.set('pageId', pageId);

        // Встановлення активної категорії
        if (!this.store.get('activeCategory')) {
            const initialCategory = Data.page[currentPageShort].categories[0];
            this.store.set('activeCategoryInd', 0);
            this.store.set('activeCategory', initialCategory);
        }

        // налаштування прокручування сторінки
        this.intervalPeriod = Data.global.intervalPeriod;
        this.intervalTimeout = Data.global.intervalTimeout;
        this.runInterval = Data.global.runInterval;
        this.store.set('pageScroll', !this.runInterval ? 'prohibited' : 'permitted');

        // налаштування головної каруселі
        this.pageCarousel = null;

        // Ідентифікатори таймерів
        this.intervalId = null;
        this.timeOutId = null;
        this.parseIntervalId = null;

        this.activeCharts = new Map();

        // Прив'язуємо контекст `this` до обробників подій для можливості їх подальшого видалення (removeEventListener)
        this.handleChange = this.handleChange.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleCarouselSlid = this.handleCarouselSlid.bind(this);
        this.handleNavigation = this.handleNavigation.bind(this);

        this.init();
    }

    init() {
        this.checkLocalStore();
        Data.global.debag && console.log('Controller init start');

        // Встановлюємо дати для моделі
        const dateSetters = {
            from: document.getElementById('start-date'),
            to: document.getElementById('end-date'),
        };
        let Dates = {
            to: (dateSetters.to && new Date(dateSetters.to.value && dateSetters.to.value)) || new Date(),
            from: (dateSetters.from && new Date(dateSetters.from.value && dateSetters.from.value)) || new Date(),
        };
        this.store.set('dateFrom', Dates.from);
        this.store.set('dateTo', Dates.to);
        
        this.store.get('page') && this[this.store.get('page')]({ from: Dates.from, to: Dates.to, activeCategory: this.store.get('activeCategory') });
        Data.global.debag && console.log('Controller init end');

        // Прив'язка глобальних слухачів за іменованими посиланнями
        document.addEventListener('change', this.handleChange);
        document.addEventListener('click', this.handleClick);
        document.addEventListener('slid.bs.carousel', this.handleCarouselSlid);
        document.addEventListener('navigation.action', this.handleNavigation);
    }


    //=========================
    // Helpers
    //=========================
    /**
     * Головний обробник подій зміни значення (event handler for 'change').
     * Відповідає за обробку завантаження Excel-файлів та валідацію/синхронізацію діапазону дат з наступним оновленням UI.
     * 
     * @param {Event} e - Об'єкт події ChangeEvent.
     * @returns {Promise<void>}
     */
    async handleChange(e) {
        /**
         * Допоміжна функція для валідації та синхронізації дат.
         * Забезпечує правильну хронологію (дата початку <= дата кінця) та оновлює стан у Store.
         * 
         * @param {HTMLInputElement} el - Елемент input (початкова або кінцева дата), який ініціював зміну.
         */
        const setInputDates = (el) => {
            let date = new Date(el.value);
            let Nei = document.getElementById(el.dataset.partner);
            if (!Nei) return;
            let dateNei = new Date(Nei.value);
            // вирівнювання дат
            if ((el.dataset.partner === 'end-date' && date.getTime() > dateNei.getTime())
                || (el.dataset.partner === 'start-date' && date.getTime() < dateNei.getTime())) {
                Nei.value = Models.getDateFormat(el.value, 'input');
                Data.global.debag && console.log('dates after set: ', Nei.value, el.value);
                dateNei = new Date(Nei.value);
            }

            const currentDates = {
                from: this.store.get('dateFrom'),
                to: this.store.get('dateTo')
            };
            currentDates[el.dataset.dest] = date;
            currentDates[Nei.dataset.dest] = dateNei;

            this.store.set('dateFrom', currentDates.from);
            this.store.set('dateTo', currentDates.to);
        };
        //----------------------------
        // Заливка/оновлення бази
        //----------------------------
        if (e.target.id === 'excel-file') {
            this.xlsxLoader(e).then(async (r) => {
                e.target.value = '';
                if (this.store.get('page')) {
                    this.pageScrollStop();
                    let data = await this.model[this.store.get('page')]({ from: this.store.get('dateFrom'), to: this.store.get('dateTo'), activeCategory: this.store.get('activeCategory') });
                    const tpl = 'base-tpl:' + this.store.get('page');
                    // destroy Charts
                    const chartSelector = '[data-render-id="' + tpl + '"] .chart';
                    const ch = document.querySelectorAll(chartSelector);
                    Controllers.destroyCharts(ch);
                    // update template
                    this.view.updateSingleBlock(tpl, data);
                    // render Charts
                    const chartContainers = document.querySelectorAll(chartSelector);
                    Controllers.renderCharts(chartContainers, data.chartReg);
                    this.pageScrollInit();
                    this.shareStore();
                    // ініціалізація слайдера/навігації
                    requestAnimationFrame(() => {
                        this.initSlideNav();
                    });
                }
            });
        }
        //----------------------------
        // Зміна дат
        //----------------------------
        if (e.target.id === 'start-date' || e.target.id === 'end-date') {
            setInputDates(e.target);
            // Перезавантажуємо сторінку
            if (this.store.get('page')) {
                this.pageScrollStop();
                let data = await this.model[this.store.get('page')]({ from: this.store.get('dateFrom'), to: this.store.get('dateTo'), activeCategory: this.store.get('activeCategory') });
                const tpl = 'base-tpl:' + this.store.get('page');
                // destroy Charts
                const chartSelector = '[data-render-id="' + tpl + '"] .chart';
                const ch = document.querySelectorAll(chartSelector);
                Controllers.destroyCharts(ch);
                // update template
                this.view.updateSingleBlock(tpl, data);
                // render Charts
                const chartContainers = document.querySelectorAll(chartSelector);
                Controllers.renderCharts(chartContainers, data.chartReg);
                this.pageScrollPause();
                // ініціалізація слайдера/навігації
                requestAnimationFrame(() => {
                    this.initSlideNav();
                });
            }
        }
    }

    /**
     * Головний обробник подій кліку (event handler for 'click').
     * Управляє автопрокручуванням, перемиканням категорій, швидкими фільтрами дат та синхронізацією стану.
     * 
     * @param {MouseEvent} e - Об'єкт події кліку.
     * @returns {Promise<void>}
     */
    //TODO TASK [Controllers] Вивід по кліку на кнопку "Деталі"
    //TODO TASK [Controllers] для OVgP клік на "Деталі" - вивести відповідний графік по кожному калібку
    async handleClick(e) {
        Data.global.debag && console.log('document click START');
        //----------------------------
        // Запустити/призупинити автопрокручування
        //----------------------------
        let closest = e.target.closest('.block-dynamic-info');
        if (!closest && !e.target.closest('.btn-filter-date')) {
            this.pageScrollPause();
        }

        //----------------------------
        // Перемикання категорій
        //----------------------------
        if (closest && !e.target.classList.contains('btn-show')) {
            let container = closest.closest('.block-dynamic');
            if (container) {
                let nodesList = container.querySelectorAll('.block-dynamic-info.active');
                nodesList.forEach(node => node.classList.remove('active'));
            }

            // Встановлюємо поточну активну категорію
            closest.classList.add('active');
            this.store.set('activeCategoryInd', closest.dataset.ind);
            this.store.set('activeCategory', closest.dataset.set);

            //Змінюємо заголовок
            if (closest.dataset.title) {
                const titleDetaile = document.querySelector('.block-detale-title');
                titleDetaile && (titleDetaile.innerHTML = closest.dataset.title);
            }
            // Перезавантажуємо сторінку
            if (this.store.get('page')) {
                let data = await this.model[this.store.get('page')]({ from: this.store.get('dateFrom'), to: this.store.get('dateTo'), activeCategory: this.store.get('activeCategory') });
                const tpl = 'slide-content:slideContent';

                this.pageScrollStop();

                const chartSelector = '[data-render-id="' + tpl + '"] .chart';
                const ch = document.querySelectorAll(chartSelector);
                Controllers.destroyCharts(ch);

                this.view.updateSingleBlock(tpl, data.pageContainer[0].slideContent[0]);

                const chartContainers = document.querySelectorAll(chartSelector);
                Controllers.renderCharts(chartContainers, data.chartReg);

                const isEmulated = e.detail && e.detail.emulated;
                isEmulated ? this.pageScrollInit() : this.pageScrollPause();
            }
        }

        //----------------------------
        // фільтр дат
        //----------------------------
        if (e.target.classList.contains('btn-filter-date')) {
            e.preventDefault();
            const date = { from: '', to: '' };
            const inpFrom = document.getElementById('start-date');
            const inpTo = document.getElementById('end-date');

            let d = new Date();
            switch (e.target.dataset.period) {
                case 'yesterday':
                    d.setDate(d.getDate() - 1);
                    date.from = Models.getDateFormat(d, 'input');
                    date.to = date.from;
                    break;
                case 'period':
                    date.to = Models.getDateFormat(d, 'input');
                    d.setDate(d.getDate() - 6);
                    date.from = Models.getDateFormat(d, 'input');
                    break;
                case 'month':
                    date.to = Models.getDateFormat(d, 'input');
                    d.setMonth(d.getMonth() - 1);
                    date.from = Models.getDateFormat(d, 'input');
                    break;
                default:
                    date.from = Models.getDateFormat(d, 'input');
                    date.to = date.from;
            }
            if (inpFrom && inpTo) {
                inpFrom.value = date.from;
                inpTo.value = date.to;
                const ev = new Event('change', { bubbles: true });
                inpFrom.dispatchEvent(ev);
            }
        }

        //----------------------------
        // Поділитися станом
        //----------------------------
        closest = e.target.closest('.btn-share-state');
        if (closest) {
            this.shareStore();
        }

        //----------------------------
        // Навігація (прокрутка і перехід)
        //----------------------------
        closest = e.target.closest('.navigation-slider');
        if (closest) {
            this.slideNav(e.target);
        }

        //----------------------------
        // Завантажити деталі
        //----------------------------
        closest = e.target.closest('.btn-detail');
        if (closest) {
            const container = document.getElementById('descr-container');
            this.view.clearContainer(container);
            if (container.dataset.dynamicClass) {
                let c = JSON.parse(container.dataset.dynamicClass);
                try {
                    container.classList.remove(...c);
                } catch (e) {
                    Data.global.debag && console.error('Помилка парсингу dynamicClass під час видалення:', e);   
                }
            }
            if (closest.dataset.model) {
                const model = JSON.parse(closest.dataset.model);
                const ammoModel = await this.model[model.model](model);
                // Буферний шаблон
                const jt = {
                    id: `tpl-just-template:top-descr`,
                    ...ammoModel,
                };
                if (Array.isArray(model.classContainer) && model.classContainer.length > 0) {
                    container.dataset.dynamicClass = JSON.stringify(model.classContainer);
                    container.classList.add(...model.classContainer);
                   /* model.classContainer.forEach(cl => {
                        console.log(cl);
                        container.classList.add(cl);
                    });*/
                }
                this.view.render('tpl-just-template', jt, container, false);
                ammoModel.content.forEach(ammo => {
                    ammo.chart && Controllers.renderCharts(this.view.DOM.get(ammo.id).el.querySelectorAll('.chart'), { [ammo.id]: ammo.chart });
                });
            }
        }

        closest = null;
        Data.global.debag && console.log('document click END');
    }

    /**
     * Обробляє подію перемикання слайда в каруселі (наприклад, Bootstrap 'slid.bs.carousel').
     * Зберігає індекс поточного активного слайда у глобальне сховище (Store).
     * 
     * @param {CustomEvent & { to: number }} e - Об'єкт події Bootstrap каруселі (e.to містить індекс нового слайда).
     */
    handleCarouselSlid(e) {
        if (e.target.id === "carouselExample") {
            this.store.set('pageSlide', e.to);
        }
    }

    async handleNavigation(e) {
        let page = e.detail.to.dataset.page;
        document.body.dataset.page = page;
        this.store.set('page', 'page' + page);
        this.store.set('activeCategory', Data.page[page].categories[0]);
        this.store.set('pageName', page);
        let data = await this.model[this.store.get('page')]({ from: this.store.get('dateFrom'), to: this.store.get('dateTo'), activeCategory: this.store.get('activeCategory') });
        const containerId = '#page-container';
        const container = document.querySelector(containerId);
        if (!container) return;

        const tpl = 'tpl-page-container:pageContainer';

        this.pageScrollStop();

        const chartSelector = '[data-render-id="' + tpl + '"] .chart';
        const ch = document.querySelectorAll(chartSelector);
        Controllers.destroyCharts(ch);

        this.view.updateSingleBlock(tpl, data.pageContainer[0]);
        this.view.substituteDOMEl('base-tpl:page' + e.detail.from.dataset.page, 'base-tpl:page' + page);
        this.store.set('prevPageTpl', 'base-tpl:page' + e.detail.from.dataset.page);
        this.store.set('curPageTpl', 'base-tpl:page' + page);

        const chartContainers = document.querySelectorAll(chartSelector);
        Controllers.renderCharts(chartContainers, data.chartReg);

        this.pageScrollInit();
        // this.updateClock();
        // this.destroy();
        // this.init();
    }

    //========================
    // Pages
    //========================
    /**
     * Завантажує дані та повністю рендерить головну сторінку дашборду (шаблон 'base-tpl').
     * Очищає старі графіки, вставляє новий HTML у контейнер та ініціалізує нові графіки зі скролом.
     * 
     * @param {Object} opt - Об'єкт з параметрами фільтрації.
     * @param {string|Date} opt.from - Початкова дата вибірки.
     * @param {string|Date} opt.to - Кінцева дата вибірки.
     * @param {string} opt.activeCategory - Ідентифікатор/назва поточної активної категорії.
     * @returns {Promise<void>}
     */
    async pageDashBoard(opt) {
        let { from, to, activeCategory } = opt;
        const data = await this.model[this.store.get('page')]({ from: from, to: to, activeCategory: activeCategory });

        const containerId = '#container';
        const container = document.querySelector(containerId);
        if (!container) return;

        const oldChartContainers = container.querySelectorAll('.chart');
        Controllers.destroyCharts(oldChartContainers);

        this.view.render('base-tpl', data, container, false);
        this.store.set('prevPageTpl', 'base-tpl:pageDashBoard');
        this.store.set('curPageTpl', 'base-tpl:pageDashBoard');
        this.store.set('pageName', 'DashBoard');
        const newChartContainers = container.querySelectorAll('.chart');
        Controllers.renderCharts(newChartContainers, data.chartReg);

        this.pageScrollInit();
        this.updateClock();
        // ініціалізація слайдера/навігації
        requestAnimationFrame(() => {
            this.initSlideNav();
        });
    }
    async pageOVgP(opt) {
        let { from, to, activeCategory } = opt;
        const page = this.store.get('page');
        const data = await this.model[page]({ from: from, to: to, activeCategory: activeCategory });

        const containerId = '#container';
        const container = document.querySelector(containerId);
        if (!container) return;

        const oldChartContainers = container.querySelectorAll('.chart');
        Controllers.destroyCharts(oldChartContainers);

        const test = this.view.render('base-tpl', data, container, false);
        this.store.set('prevPageTpl', 'base-tpl:pageOVgP');
        this.store.set('curPageTpl', 'base-tpl:pageOVgP');
        this.store.set('pageName', 'OVgP');
        const newChartContainers = container.querySelectorAll('.chart');
        Controllers.renderCharts(newChartContainers, data.chartReg);

        this.pageScrollInit();
        this.updateClock();
        // ініціалізація слайдера/навігації
        requestAnimationFrame(() => {
            this.initSlideNav();
        });
    }
    /**
     * Оновлює поточний час та дату в інтерфейсі (години, хвилини, секунди, день тижня та місяць) українською мовою.
     * Метод також відповідає за перезапуск внутрішнього таймера/інтервалу (`this.clock`) кожну секунду (1000 мс).
     * 
     * @important При передачі методу в `setInterval` важливо зберігати контекст `this` (наприклад, через `.bind(this)` або стрілочну функцію).
     * @returns {void}
     */
    updateClock() {
        clearInterval(this.clock);
        this.clock = null;
        const now = new Date();

        // Години та хвилини
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        document.getElementById('time-main').textContent = `${hours}:${minutes}`;
        document.getElementById('seconds').textContent = seconds;

        // Дата українською
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        const dateString = now.toLocaleDateString('uk-UA', options);
      
        document.getElementById('date').textContent = dateString;
        this.clock = setInterval(this.updateClock, 1000);
    }
    /**
     * Обробник навігації (перемикання) слайдера/каруселі.
     * Підтримує типи кнопок: 'next', 'prev' та 'direct' (перехід на конкретний слайд за індексом).
     *
     * @param {HTMLElement} e - HTML-елемент управління з data-btn-type ('next', 'prev' або 'direct').
     *                          Для 'direct' додатково потрібен атрибут `data-target-index` (або `data-index`).
     * @returns {null|void}
     */
    slideNav(e) {
        if (!e.dataset.btnType)
            return null;
        const d = e.dataset.btnType;
        const slider = document.getElementById(e.dataset.btnCarousel);
        if (!slider) return null;

        const track = slider.querySelector('.slider-track');
        const items = track.querySelectorAll('.slider-item');
        const windowWidth = slider.offsetWidth;

        // 1. Знаходимо поточний активний індекс
        const actIndex = Array.from(items).findIndex(item => item.classList.contains('active'));
        const currentIndex = actIndex !== -1 ? actIndex : 0;

        // 2. Вираховуємо наступний індекс залежно від напрямку або прямого вибору
        let nextIndex = currentIndex;

        if (d === 'next') {
            nextIndex = (currentIndex + 1 >= items.length) ? 0 : currentIndex + 1;
        } else if (d === 'prev') {
            nextIndex = (currentIndex - 1 < 0) ? items.length - 1 : currentIndex - 1;
        } else if (d === 'direct') {
            // Отримуємо індекс з data-target-index або data-index
            const target = e.closest('.slider-item');
            const targetIdx = Array.from(items).indexOf(target);
            // Якщо індекс передано коректно і він перебуває в межах списку
            if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < items.length) {
                nextIndex = targetIdx;
            } else {
                return null;
            }
        }

        // Якщо ми вже на цьому слайді — нічого не робимо
        if (nextIndex === currentIndex && d === 'direct') return;

        const itemAct = items[currentIndex];
        const itemNext = items[nextIndex];

        if (!itemNext) return;

        // 3. Перемикаємо класи анімації
        itemAct.classList.remove('active');
        itemNext.classList.add('active');

        // 4. Скидаємо/встановлюємо ширини для елементів:
        // Активному елементу даємо 300px (або ширину slider-а), 
        // неактивним — ширину їхнього внутрішнього .title
        items.forEach((item) => {
            const title = item.querySelector('.title');
            if (item === itemNext) {
                item.style.width = windowWidth + 'px';
            } else {
                item.style.width = title.offsetWidth + 'px';
            }
        });

        // 5. ТОЧНИЙ РОЗРАХУНОК `left`:
        const gap = 15;
        let targetLeft = 0;

        for (let i = 0; i < nextIndex; i++) {
            const title = items[i].querySelector('.title');
            targetLeft += title.offsetWidth + gap;
        }

        // Застосовуємо новий від'ємний зсув
        track.style.left = -targetLeft + 'px';

        const ev = new CustomEvent('navigation.action', {
            detail: {
                from: itemAct,
                to: itemNext
            },
            bubbles: true,
            cancelable: true
        });
        slider.dispatchEvent(ev);
    }
    /**
     * Ініціалізує стан слайдера навігації відповідно до поточної сторінки в Store/dataset.
     * Встановлює активний клас, обчислює ширини елементів та позицію track.
     */
    initSlideNav() {
        const currentPageName = this.store.get('pageName') || document.body.dataset.page;
        if (!currentPageName) return;

        // Знаходимо навігаційний слайдер
        const slider = document.getElementById('carouselNav') || document.querySelector('.navigation-slider');
        if (!slider) return;

        const track = slider.querySelector('.slider-track');
        if (!track) return;

        const items = track.querySelectorAll('.slider-item');
        if (!items.length) return;

        // 1. Знаходимо індекс активного слайда за data-page
        let activeIndex = Array.from(items).findIndex(
            item => item.dataset.page === currentPageName
        );

        // Якщо за dataset не знайшли — шукаємо той, у якого вже є клас active (або дефолтний 0)
        if (activeIndex === -1) {
            activeIndex = Array.from(items).findIndex(item => item.classList.contains('active'));
            if (activeIndex === -1) activeIndex = 0;
        }

        const windowWidth = slider.offsetWidth;

        // 2. Встановлюємо класи та стилі ширини
        items.forEach((item, index) => {
            const title = item.querySelector('.title');
            const titleWidth = title ? title.offsetWidth : 0;

            if (index === activeIndex) {
                item.classList.add('active');
                item.style.width = windowWidth + 'px';
            } else {
                item.classList.remove('active');
                item.style.width = titleWidth + 'px';
            }
        });

        // 3. Обчислюємо від'ємний зсув left (точно як у вашому slideNav)
        const gap = 15;
        let targetLeft = 0;

        for (let i = 0; i < activeIndex; i++) {
            const title = items[i].querySelector('.title');
            if (title) {
                targetLeft += title.offsetWidth + gap;
            }
        }

        // 4. Застосовуємо зсув треку
        track.style.left = -targetLeft + 'px';
    }
    /**
     * Зберігає поточний стан додатку (з об'єкта Store) у `localStorage`.
     * Використовується для синхронізації стану між вкладками браузера або збереження сесії.
     */
    shareStore() {
        const st = this.store.getState();
        for (const key in st) {
            localStorage.setItem(key, st[key]);
        }
        localStorage.setItem('status', 1);
        localStorage.setItem('pageId', this.store.get('pageId'));
    }
    /**
     * Зчитує стан додатку з `localStorage` та оновлює поточний `Store`.
     * Спрацьовує при синхронізації між вкладками або примусовому відновленні сесії.
     * 
     * @param {boolean} [direct=false] - Прапорець примусового читання (ігнорує статус `ls`, якщо `true`).
     * @returns {Object|null} Оновлений об'єкт стану `Store` або `null`, якщо оновлення не потрібне/недійсне.
     */
    parseLocalStore(direct = false) {
        const ls = parseInt(localStorage.getItem('status'));
        const pId = localStorage.getItem('pageId');
        if ((!direct || !ls) && (parseInt(pId) === 0 || this.store.get('pageId') === pId))
            return null;

        Data.global.store.forEach(key => {
            this.store.set(key, localStorage.getItem(key));
        });
        localStorage.setItem('status', 0);
        localStorage.setItem('pageId', 0);
        return this.store.getState();
    }
    /**
     * Запускає періодичну перевірку (polling) змін у `localStorage`.
     * Якщо виявлено оновлення стану (наприклад, з іншої вкладки), повторно завантажує 
     * дані моделі, перемальовує шаблон сторінки, оновлює діаграми та відновлює стан скролу.
     */
    checkLocalStore() {
        // Очищаємо попередній інтервал, якщо він існував
        if (this.parseIntervalId) {
            clearInterval(this.parseIntervalId);
            this.parseIntervalId = null;
        }

        this.parseIntervalId = setInterval(async () => {
            const r = this.parseLocalStore();
            
            if (r) {
                this.pageScrollStop();
                let data = await this.model[this.store.get('page')]({ from: this.store.get('dateFrom'), to: this.store.get('dateTo'), activeCategory: this.store.get('activeCategory') });
                const tpl = (this.store.get('pageName') !== document.body.dataset.page) ? this.store.get('prevPageTpl') : this.store.get('curPageTpl');
                const chartSelector = '[data-render-id="' + tpl + '"] .chart';
                const ch = document.querySelectorAll(chartSelector);
                Controllers.destroyCharts(ch);

                this.view.updateSingleBlock(tpl, data);

                const chartContainers = document.querySelectorAll(chartSelector);
                Controllers.renderCharts(chartContainers, data.chartReg);

                if (localStorage.getItem('pageScroll') === 'pause') {
                    this.pageScrollPause();
                } else if (localStorage.getItem('pageScroll') === 'run') {
                    this.pageScrollInit();
                }
                // ініціалізація слайдера/навігації
                requestAnimationFrame(() => {
                    this.initSlideNav();
                });
            }
        }, 1000);
    }
    /**
     * Ініціалізує та запускає цикл автопрокручування сторінки та каруселі.
     * Розраховує тривалість інтервалу на основі кількості слайдів та фіксує стан у Store.
     * 
     * @returns {null|void} Повертає `null`, якщо глобально автопрокручування вимкнено.
     */
    pageScrollInit() {
        if (!Data.global.runInterval) return null;
        this.carouselInit();
        if (this.pageCarousel && this.pageCarousel.element) {
            this.intervalPeriod = Data.global.pageCarousel.interval * (this.pageCarousel.element.querySelectorAll('.carousel-item').length + 1) - 30;
        }
        this.dushBoardScroll();
        this.pageCarousel && this.pageCarousel.cycle();
        this.store.set('pageScroll', 'run');
    }
    /**
     * Повністю зупиняє автопрокручування сторінки та роботу каруселі.
     * Знищує екземпляр каруселі, очищає активні таймери/інтервали та фіксує статус 'stop' у Store.
     */
    pageScrollStop() {
        this.carouselDestroy();
        this.pageScrollClear();
        this.store.set('pageScroll', 'stop');
    }
    /**
     * Тимчасово ставить автопрокручування на паузу з автоматичним відновленням через заданий таймаут.
     * Зупиняє поточний скрол, скидає попередні таймери та планує повторну ініціалізацію `pageScrollInit()`.
     * 
     * @returns {number|null} ID створеного таймауту для можливості його скасування або `null`, якщо автопрокручування глобально вимкнено.
     */
    pageScrollPause() {
        if (!Data.global.runInterval) return null;
        this.pageScrollStop();

        // Гарантуємо скасування попереднього timeout перед створенням нового
        if (this.timeOutId) {
            clearTimeout(this.timeOutId);
        }

        this.timeOutId = setTimeout(() => {
            this.pageScrollInit();
        }, this.intervalTimeout);

        this.store.set('pageScroll', 'pause');
        return this.timeOutId;
    }
    /**
     * Очищає активні інтервали та таймаути, пов'язані з автопрокручуванням сторінки.
     * Дозволяє вибірково скасовувати `intervalId`, `timeOutId` або обидва одразу.
     * 
     * @param {Object} [opt={}] - Опції для налаштування скидання таймерів.
     * @param {boolean} [opt.interval=true] - Прапорець для очищення інтервалу (`intervalId`).
     * @param {boolean} [opt.timeout=true] - Прапорець для очищення таймауту (`timeOutId`).
     * @returns {number} Завжди повертає `0`.
     */
    pageScrollClear(opt = {}) {
        let { interval = true, timeout = true } = opt;

        if (interval && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (timeout && this.timeOutId) {
            clearTimeout(this.timeOutId);
            this.timeOutId = null;
        }
        return 0;
    }
    /**
     * Автоматично перемикає категорії дашборду через рівні проміжки часу (`intervalPeriod`).
     * Циклічно проходить по масиву категорій, оновлює стан у Store та ініціює програмний (симульований) клік по відповідному DOM-елементу.
     * 
     * @returns {number|null} ID створеного інтервалу або `null`, якщо автопрокручування вимкнено.
     */
    dushBoardScroll() {
        if (!Data.global.runInterval) return null;
        this.pageScrollClear({ timeout: false });

        this.intervalId = setInterval(() => {
            this.pageScrollClear({ interval: false });

            let actCatInd = this.store.get('activeCategoryInd');
            actCatInd++;
            if (actCatInd >= Data.page[this.store.get('pageName')].categories.length) actCatInd = 0;

            let cat = Data.page[this.store.get('pageName')].categories[actCatInd];
            this.store.set('activeCategoryInd', actCatInd);
            this.store.set('activeCategory', cat);

            const catElRenderId = 'block-dynamic-info:cat-' + cat.replace(/\//g, '_');
            const catEl = this.view.DOM.get(catElRenderId);

            if (catEl && catEl.el) {
                const ev = new CustomEvent('click', { bubbles: true, cancelable: true, detail: { emulated: true } });
                catEl.el.dispatchEvent(ev);
            }
        }, this.intervalPeriod);
        return this.intervalId;
    }
    /**
     * Ініціалізує або отримує існуючий екземпляр каруселі Bootstrap для елемента `#carouselExample`.
     * 
     * @param {Object} [opt] - Необов'язкові конфігураційні параметри для каруселі Bootstrap. 
     *                         Якщо не передано, використовуються значення за замовчуванням з `Data.global.pageCarousel`.
     * @returns {bootstrap.Carousel|null} Екземпляр каруселі Bootstrap або `null`, якщо DOM-елемент не знайдено чи бібліотека Bootstrap недоступна.
     */
    carouselInit(opt) {
        const carouselEl = document.getElementById('carouselExample');
        if (!carouselEl) {
            this.carouselDestroy();
            return null;
        }

        if (typeof bootstrap !== 'undefined' && bootstrap.Carousel) {
            const carouselEx = bootstrap.Carousel.getInstance(carouselEl);
            if (carouselEx) {
                this.pageCarousel = carouselEx;
            } else {
                this.pageCarousel = new bootstrap.Carousel(carouselEl, opt || Data.global.pageCarousel);
            }
            this.pageCarousel.element = carouselEl;
        }
        return this.pageCarousel;
    }
    /**
     * Безпечно знищує екземпляр каруселі Bootstrap та очищає посилання на нього.
     * Використовує метод `.dispose()` для відв'язування подій та очищення пам'яті.
     */
    carouselDestroy() {
        if (this.pageCarousel) {
            try {
                this.pageCarousel.dispose();
            } catch (e) { }
            this.pageCarousel = null;
        }
    }
    /**
     * Статичний метод для безпечного знищення екземплярів діаграм (наприклад, Chart.js) 
     * у переданому масиві або колекції DOM-контейнерів.
     * Дозволяє уникнути витоків пам'яті та повторного накладання графіків на ті самі полотна (canvas).
     * 
     * @param {NodeList|Array<HTMLElement>} containers - Колекція DOM-елементів, які містять посилання на екземпляри діаграм `_chartInstance`.
     */
    static destroyCharts(containers) {
        containers.forEach(ch => {
            if (ch._chartInstance) {
                try {
                    ch._chartInstance.destroy();
                } catch (e) {
                    Data.global.debag && console.warn('Error destroying chart:', e);
                }
                ch._chartInstance = null;
            }
        });
    }
    /**
     * Статичний метод для ініціалізації та малювання діаграм (ApexCharts) у DOM-контейнерах.
     * Знаходить потрібну конфігурацію в реєстрі chartRegistry за значенням `data-chart` контейнера,
     * безпечно знищує старий екземпляр (якщо він існував) і створює новий.
     * 
     * @param {NodeList|Array<HTMLElement>} containers - Колекція DOM-елементів, у яких мають бути відмальовані діаграми.
     * @param {Object.<string, Object>} chartRegistry - Реєстр з конфігураціями діаграм, де ключі відповідають `data-chart`.
     */
    static renderCharts(containers, chartRegistry) {
        containers.forEach(ch => {
            const chartKey = ch.dataset.chart;

            if (chartRegistry && chartKey && chartRegistry[chartKey]) {
                if (ch._chartInstance) {
                    try {
                        ch._chartInstance.destroy();
                    } catch (e) { }
                    ch._chartInstance = null;
                }

                ch.innerHTML = '';

                if (typeof ApexCharts !== 'undefined') {
                    const chartItem = new ApexCharts(ch, chartRegistry[chartKey]);
                    chartItem.render();
                    ch._chartInstance = chartItem;
                }
            }
        });
    }

    /**
     * Завантажує, зчитує та обробляє обраний `.xlsx` файл.
     * Валідує структуру аркушів (Sheet), трансформує дані в таблиці бази даних 
     * та паралельно записує їх у БД за допомогою `Promise.all`.
     * 
     * @param {Event} ev - Об'єкт події ChangeEvent від файлового input (`e.target.files`).
     * @returns {Promise<Array|null>} Масив результатів виконання запитів до БД або `null`, якщо файл не обрано.
     * @throws {Error} Викидає помилку у разі невдалого зчитування файлу або запису в БД.
     */
    async xlsxLoader(ev) {
        // Отримуємо перший файл з обраних у файловому інпуті
        const file = ev.target.files[0];
        if (!file) return null;

        try {
            // 1. Зчитуємо файл у форматуванні ArrayBuffer за допомогою FileReader
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsArrayBuffer(file);
            });

            // 2. Конвертуємо буфер у масив байтів Uint8Array
            const data = new Uint8Array(arrayBuffer);

            // Налаштування для зчитування Excel (формули, HTML, текст, дати, UTC)
            let readOptions = {
                cellFormula: true,
                cellHTML: true,
                cellText: true,
                cellDates: true,
                UTC: true
            };

            // 3. Парсимо структури книги Excel за допомогою бібліотеки XLSX (SheetJS)
            const workbook = XLSX.read(data, readOptions);
            const storeModel = {};
            let tables = {};
            Data.global.debag && console.log('[Controllers.xlsxLoader] завантажений файл XLS: ',workbook);
            // 4. Проходимо по всіх аркушах Excel-файлу
            for (let i = 0; i < workbook.SheetNames.length; i++) {
                const sheetName = workbook.SheetNames[i];

                // Перевіряємо, чи підтримується цей аркуш моделлю додатка
                if (this.model.xlsSheets.includes(sheetName)) {
                    let sheet = workbook.Sheets[sheetName];
                    
                    // Нормалізуємо об'єднані клітинки перед обробкою
                    this.model.fillMergedCells(sheet);

                    // let sss = null;
                    if (sheetName === 'ОВгП') {
                        tables[sheetName] = this.model.transformAmmunitionSheet(sheet, {
                            dateColName: 'Дата',
                            groupColName: 'Угруповання',
                            priceColName: 'вартість_за_шт', // Назва колонки з ціною за одиницю БК
                            totalGroupTitle: 'ВСЬОГО за СО:'
                        });
                        // console.log('sheet', sheet);
                    } else {
                        // Отримуємо структуру моделі для даного аркуша
                        storeModel[sheetName] = this.model.getStorageModel(workbook, sheetName);

                        // Перевіряємо сумісність версії/структури аркуша
                        let validVersion = this.model.checkVersion(sheetName, storeModel[sheetName]);

                        // Якщо версія дійсна — формуємо об'єкт таблиці для БД
                        // if (validVersion.flag) {
                        tables[sheetName] = this.model.getDBTable(sheetName, sheet, storeModel[sheetName]);
                        // }
                    }
                }
            }
            Data.global.debag && console.log('[Controllers.xlsxLoader] Таблиці сформовані для збереження: ',tables);
            // return;
            // 5. Формуємо масив промісів для паралельного збереження таблиць у БД
            const dbPromises = [];
            for (let table in tables) {
                Data.global.debag && console.log(table);
                dbPromises.push(this.model.pushToDB(table, tables[table]));
            }

            // 6. Чекаємо завершення всіх записів у БД та повертаємо результат
            return await Promise.all(dbPromises);

        } catch (error) {
            // Виводимо помилку в консоль у режимі відлагодження
            Data.global.debag && console.error("Помилка під час завантаження файлу:", error);
            throw error;
        }
    }

    /**
     * Знищує поточний екземпляр класу та звільняє виділені ресурси.
     * Зупиняє автопрокручування, очищає фонові інтервали (polling) та видаляє 
     * глобальні обробники подій `document` для запобігання витокам пам'яті.
     */
    destroy() {
        this.pageScrollStop();
        if (this.parseIntervalId) {
            clearInterval(this.parseIntervalId);
            this.parseIntervalId = null;
        }
        clearInterval(this.clock);
        this.clock = null;

        document.removeEventListener('change', this.handleChange);
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('slid.bs.carousel', this.handleCarouselSlid);
        document.removeEventListener('navigation.action', this.handleNavigation);
    }
}