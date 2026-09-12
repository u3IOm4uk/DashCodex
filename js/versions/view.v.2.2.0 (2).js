/**
 * @fileoverview Універсальний декларативний рушій шаблонів (Template Engine).
 * Забезпечує швидкий рендеринг HTML через нативні DOM-методи, точкове оновлення
 * інтерфейсу за бізнес-ключами (O(1)), двостороннє зв'язування динамічних атрибутів,
 * а також автоматичну утилізацію пам'яті (очищення Event Listeners).
 * @version 2.2.0
 */
class Views {
    constructor() {
        /**
         * Кеш оригінальних HTML-шаблонів, вилучених з тегів <template>.
         * @type {Object<string, HTMLTemplateElement>}
         * @example { "tpl-category": HTMLTemplateElement, "tpl-unit": HTMLTemplateElement }
         */
        this.templates = {};

        /**
         * Глобальний плоский реєстр відрендерених бізнес-блоків у DOM.
         * Ключ: renderId (бізнес-ключ вигляду "назва_шаблону:ID_з_БД" або автогенерований UUID/Timestamp).
         * Значення: метадані блоку (елемент, контейнер, назва шаблону, активні прослуховувачі подій).
         * @type {Map<string, {
         * el: HTMLElement,
         * container: HTMLElement,
         * templateName: string,
         * listeners: Array<{ target: HTMLElement, type: string, fn: Function }>
         * }>}
         */
        this.DOM = new Map();

        /**
         * Мапа зв'язку контейнерів із зарендереними в них ідентифікаторами (renderId).
         * Потрібна для того, щоб при повному очищенні контейнера коректно утилізувати всі події вкладених блоків.
         * @type {Map<HTMLElement, Set<string>>}
         */
        this.containers = new Map();

        this.init();
    }

    /**
     * Первинна ініціалізація: збір усіх тегів <template id="..."> на сторінці.
     * Має викликатися один раз при старті додатка (наприклад, у DOMContentLoaded).
     */
    init() {
        const tplElements = document.querySelectorAll('template[id]');
        tplElements.forEach(tpl => {
            this.templates[tpl.id] = tpl;
        });
        console.log(`[Views.init] Успішно зареєстровано шаблонів: ${Object.keys(this.templates).length}`/* , this.templates */);
    }

    /**
     * Основний метод рендерингу (компіляція та вставка в DOM).
     * Автоматично розпізнає масиви даних та рендерить списки.
    //*************************
        
        //*************************
        // Model
        //*************************

        {
            // 1. Прості змінні (для data-field)
            pageTitle: "Панель управління ГОЧ",
            warDay: 1542, // Кількість днів війни
            lastUpdated: "14.07.2026 13:56",

            // 2. Глибока вкладеність (тестуємо getNestedValue через крапку: data-field="user.profile.fullName")
            user: {
                role: "Оперативний черговий",
                profile: {
                    fullName: "Олександр Шевченко",
                    avatarUrl: "/assets/img/avatars/user-1.png"
                }
            },

            // 3. Зв'язування атрибутів головного екрана (data-bind-class, data-bind-style тощо)
            statusClass: "bg-success-subtle text-success",
            isOnline: true, // для data-bind-disabled або інших логічних атрибутів

            // 4. Список об'єктів (data-list="categories", кожен елемент рендериться через свій template)
            categories: [
                {
                    id: "cat-obstrily",       // Бізнес-ключ для data-key (id)
                    category_name: "Обстріли", // Текст для data-field
                    total_value: 135,         // Текст для data-field
                    cssClass: "card-danger",   // Динамічний клас: data-bind-class
                    icon: "ri-focus-3-line",  // Динамічна іконка: data-bind-class
                    unitId: "u-101",          // Бізнес-параметр для data-bind-data-unit

                    // 4.1. Внутрішній вкладений список об'єктів (data-list="subItems", template всередині template)
                    subItems: [
                        { itemId: "sub-1", label: "Артилерія", count: 84 },
                        { itemId: "sub-2", label: "РСЗВ", count: 51 }
                    ],

                    // 5. Внутрішній список примітивів (масив рядків, рендериться через data-field="")
                    tags: ["Пріоритет", "Важливо", "Черговий сектор"]

                    tpl: tplName // Динамічно задаємо використовуваний шаблон через data-bind-template
                },
                {
                    id: "cat-rakety",
                    category_name: "Ракетні удари",
                    total_value: 12,
                    cssClass: "card-warning",
                    icon: "ri-thunderstorms-line",
                    unitId: "u-102",
                    subItems: [
                        { itemId: "sub-3", label: "Крилаті ракети", count: 8 },
                        { itemId: "sub-4", label: "Балістика", count: 4 }
                    ],
                    tags: ["Критично", "ППО"]
                }
            ],

            // Ще один список для опозиційних графіків або порівнянь
            correlations: [
                {
                    id: "corr-1",
                    title: "Витрата боєприпасів (122мм)",
                    souValue: 1200,
                    enemyValue: 4500,
                    ratioText: "1 : 3.75",
                    chartType: "bar" // Можна використати в контролері для ініціалізації ApexCharts
                }
            ]
        };

        //*************************
        // Templates
        //*************************

        <template id="tpl-dashboard-page">
          <div class="dashboard-wrapper">
    
            <h1 data-field="pageTitle">Завантаження...</h1>
            <p>Черговий: <strong data-field="user.profile.fullName">Ім'я</strong> (<span data-field="user.role">Роль</span>)</p>
    
            <div class="meta-info">
              День війни: <span data-field="warDay">0</span> | Оновлено: <span data-field="lastUpdated">-</span>
            </div>

            <div class="status-indicator p-2 rounded" data-bind-class="statusClass">
              <img src="" alt="Avatar" class="avatar-img" data-bind-src="user.profile.avatarUrl">
              <span>Система активна</span>
            </div>

            <div class="categories-list row mt-4" 
                 data-list="categories" 
                 data-template="tpl-category-card">
                 </div>

          </div>
        </template>


        <template id="tpl-category-card">
          <div class="col-md-6 mb-3 card-item" data-key="id" data-bind-class="cssClass">
            <div class="card-body">
      
              <h3 class="card-title">
                <i class="" data-bind-class="icon"></i> <span data-field="category_name">Назва категорії</span>
              </h3>
      
              <div class="value-display display-4" data-field="total_value">0</div>

              <ul class="list-group my-2" 
                  data-list="subItems" 
                  data-template="tpl-category-subitem">
                  </ul>

              <div class="tags-container d-flex gap-1 mt-2" 
                   data-list="tags" 
                   data-template="tpl-simple-badge">
                   </div>

              <button class="btn btn-primary btn-sm mt-3" 
                      data-bind-data-unit="unitId"
                      data-bind-data-opt="id">
                Докладніше
              </button>

            </div>
          </div>
        </template>


        <template id="tpl-category-subitem">
          <li class="list-group-item d-flex justify-content-between align-items-center" data-key="itemId">
            <span data-field="label">Тип</span>
            <span class="badge bg-primary rounded-pill" data-field="count">0</span>
          </li>
        </template>

        <template id="tpl-simple-badge">
          <span class="badge bg-secondary" data-field="">Тег</span>
        </template>

        //*************************
        // Controller
        //*************************

        this.view.render('tpl-dashboard-page', pageDashboardViewModel, document.getElementById('app'));

    //*************************
     * @param {string} templateName - ID тегу <template> на сторінці.
     * @param {Object|Array} data - Дані (або масив об'єктів) для наповнення шаблону.
     * @param {HTMLElement} [container=null] - Контейнер, куди вставити результат.
     * @param {boolean} [append=false] - Чи додавати до існуючого контенту (true), чи очистити контейнер перед вставкою (false).
     * @returns {DocumentFragment|HTMLElement|null} Повертає відрендерений фрагмент або кореневий елемент.
     */
    render(templateName, data, container = null, append = false) {
        // console.log('Views.render: ', templateName, data, container, append);
        const template = this.templates[templateName];
        if (!template) {
            console.error(`[Views.render] Шаблон з ID "${templateName}" не знайдено.`);
            return null;
        }

        // Якщо контейнер передано і ми НЕ дописуємо в кінець (append = false) — чистимо його з утилізацією подій
        if (container && !append) {
            this.clearContainer(container);
        }

        const fragment = document.createDocumentFragment();
        const dataArray = Array.isArray(data) ? data : [data];

        dataArray.forEach((item, index) => {
            // Клонуємо чисту DOM-структуру з template
            const clone = template.content.cloneNode(true);
            const rootElement = clone.firstElementChild;
            
            if (!rootElement) return;

            // Генеруємо або дістаємо унікальний renderId для цього блоку
            // Пріоритет 1: Бізнес-ключ, сформований у верстці через data-key (наприклад, "tpl-category:12")
            // Пріоритет 2: Явно переданий renderId або id у структурі даних item
            // Пріоритет 3: Автогенерований унікальний Timestamp-індекс
            // TODO: data-key треба задавати автоматично або брати з даних
            let renderId = rootElement.dataset.key || item.renderId || item.id;
            if (renderId && !String(renderId).includes(':')) {
                renderId = `${templateName}:${renderId}`;
            }
            if (!renderId) {
                renderId = `${templateName}:${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            }
            
            // Записуємо renderId у dataset кореневого елемента, щоб його можна було ідентифікувати у DOM
            rootElement.dataset.renderId = renderId;

            // Рекурсивно наповнюємо даними та зв'язуємо атрибути
            this.compile(rootElement, item);

            // Реєструємо відрендерений блок у плоскій мапі this.DOM
            const record = {
                el: rootElement,
                container: container,
                templateName: templateName,
                listeners: []
            };
            this.DOM.set(renderId, record);

            // Якщо є фізичний контейнер, фіксуємо зв'язок "контейнер -> renderId"
            if (container) {
                if (!this.containers.has(container)) {
                    this.containers.set(container, new Set());
                }
                this.containers.get(container).add(renderId);
            }

            fragment.appendChild(clone);
        });

        // Якщо вказано контейнер — вставляємо результат у реальний DOM
        if (container) {
            container.appendChild(fragment);
            // Повертаємо перший елемент або список зарендерених
            return container;
        }

        return fragment;
    }
    /**
     * Чистий рекурсивний компілятор (алгоритм обходу вглиб - DFS).
     * Аналізує data-field, data-bind-* та вкладені циклічні/динамічні шаблони.
     * * @param {HTMLElement} element - Поточний DOM-елемент для аналізу.
     * @param {Object} data - Поточний об'єкт даних.
     */
    compile(element, data) {
        // console.log('Views.compile: ', element, data);
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

        // 1. Зв'язування текстового контенту (data-field)
        if (element.dataset.field !== undefined) {
            const path = element.dataset.field;
            const value = this.getNestedValue(data, path);
            element.textContent = (value !== undefined && value !== null) ? value : '';
        }

        // 2. Двостороннє зв'язування атрибутів (data-bind-[attr])
        this.bindAttributes(element, data);

        // 3. Обробка вкладеного циклічного рендерингу (data-list)
        const listName = element.dataset.list;

        if (listName) {
            const subData = this.getNestedValue(data, listName);

            if (subData) {
                // Визначаємо назву шаблону:
                // А. Статичний шаблон з атрибуту: data-template="tpl-id"
                let templateName = element.dataset.template;

                // Б. Динамічний шаблон з конфігу даних: data-bind-template="path.to.key"
                const bindTemplatePath = element.dataset.bindTemplate;
                if (!templateName && bindTemplatePath) {
                    templateName = this.getNestedValue(data, bindTemplatePath);
                }

                // Якщо ми маємо масив даних (список):
                if (Array.isArray(subData)) {
                    // Очищуємо контейнер перед рендерингом, якщо не активовано append
                    // (Зазвичай очищення робиться всередині вашого render за замовчуванням)

                    subData.forEach(item => {
                        // В. Супер-динамічний режим: кожен об'єкт у масиві може сам вказувати свій шаблон.
                        // Наприклад, якщо у елемента масиву є поле { tplName: 'block-radar-distribution' }
                        // Шукаємо його за ключем, вказаним у data-bind-template (наприклад, "tplName")
                        let activeTemplate = templateName;
                        if (bindTemplatePath && item[bindTemplatePath]) {
                            activeTemplate = item[bindTemplatePath];
                        }

                        if (activeTemplate) {
                            // Рендеримо поточний елемент списку з його власним шаблоном.
                            // Передаємо append = true, щоб елементи додавалися один за одним.
                            this.render(activeTemplate, item, element, true);
                        } else {
                            console.warn(`[Views.compile] Не знайдено шаблон для елемента списку`, item);
                        }
                    });
                } else {
                    // Якщо це не масив, а поодинокий вкладений об'єкт (компонентний підхід)
                    if (templateName) {
                        this.render(templateName, subData, element, false);
                    }
                }
            }
            // Зупиняємо рекурсію для дітей цього елемента, оскільки render() всередині сам зробить compile()
            return;
        }

        // 4. Рекурсивне занурення вглиб дерева DOM (якщо це звичайний структурний елемент)
        const children = Array.from(element.children);
        children.forEach(child => this.compile(child, data));
    }

    /**
     * Точкове оновлення (Update) конкретного блоку в DOM за його бізнес-ключем без перемальовування всього інтерфейсу.
     * Швидкість виконання: O(1).
     * * @param {string} renderId - Унікальний ідентифікатор блоку (наприклад, "tpl-category:12").
     * @param {Object} newData - Нові дані для оновлення полів блоку.
     */
    updateSingleBlock(renderId, newData) {
        const record = this.DOM.get(renderId);
        if (!record || !record.el.parentNode) {
            console.warn(`[Views.updateSingleBlock] Блок з renderId "${renderId}" не знайдено в active DOM.`);
            return;
        }

        // 1. ЗБІР ВСІХ ВКЛАДЕНИХ БЛОКІВ
        // Знаходимо всі елементи з data-render-id всередині старого блоку (це наші вкладені блоки)
        const childRenderElements = record.el.querySelectorAll('[data-render-id]');
        const childRecords = [];

        childRenderElements.forEach(childEl => {
            const childId = childEl.dataset.renderId;
            const childRec = this.DOM.get(childId);
            if (childRec) {
                childRecords.push({
                    id: childId,
                    record: childRec,
                    // Зберігаємо селектор вкладеного блоку відносно поточного оновлюваного кореня
                    selector: this.buildUniqueSelector(childEl, record.el)
                });
            }
        });

        // 2. ТИМЧАСОВЕ ЗНЯТТЯ СЛУХАЧІВ (як головного блоку, так і вкладених)
        // Збираємо та очищуємо слухачі головного блоку
        const savedListeners = [...record.listeners];
        savedListeners.forEach(listener => {
            listener.target.removeEventListener(listener.type, listener.fn);
        });
        record.listeners = [];

        // Знімаємо слухачі з усіх знайдених вкладених блоків
        childRecords.forEach(item => {
            item.record.listeners.forEach(listener => {
                listener.target.removeEventListener(listener.type, listener.fn);
            });
            // Тимчасово очищуємо масив слухачів вкладеного блоку перед переприв'язкою
            item.savedChildListeners = [...item.record.listeners];
            item.record.listeners = [];
        });

        // 3. СТВОРЕННЯ ТА КОМПІЛЯЦІЯ НОВОГО ЕЛЕМЕНТА
        const template = this.templates[record.templateName];
        if (!template) return;

        const clone = template.content.cloneNode(true);
        const newRootElement = clone.firstElementChild;
        if (!newRootElement) return;

        newRootElement.setAttribute('data-render-id', renderId);
        newRootElement.dataset.renderId = renderId;
        if (record.el.dataset.key) {
            newRootElement.setAttribute('data-key', record.el.dataset.key);
            newRootElement.dataset.key = record.el.dataset.key;
        }

        // Компілюємо новий елемент із свіжими даними
        this.compile(newRootElement, newData);

        // 4. ЗАМІНА ЕЛЕМЕНТА В DOM
        record.el.parentNode.replaceChild(newRootElement, record.el);
        record.el = newRootElement; // Оновлюємо посилання на root-елемент у реєстрі

        // 5. ПЕРЕПРИВ'ЯЗКА ПОДІЙ ГОЛОВНОГО БЛОКУ
        savedListeners.forEach(listener => {
            let newTarget = newRootElement;
            if (listener.target !== listener.oldRoot) {
                const selector = this.buildUniqueSelector(listener.target, listener.oldRoot);
                if (selector) {
                    newTarget = newRootElement.querySelector(selector) || newRootElement;
                }
            }
            this.addListener(renderId, newTarget, listener.type, listener.fn);
        });

        // 6. ПЕРЕПРИВ'ЯЗКА ПОДІЙ ВКЛАДЕНИХ БЛОКІВ
        childRecords.forEach(item => {
            // Шукаємо новий DOM-вузол вкладеного блоку всередині нового батьківського елемента
            const newChildRoot = newRootElement.querySelector(item.selector);
            
            if (newChildRoot) {
                // Оновлюємо посилання на DOM-елемент у реєстрі для вкладеного блоку
                item.record.el = newChildRoot;

                // Перенавішуємо події вкладеного блоку
                item.savedChildListeners.forEach(listener => {
                    let newTarget = newChildRoot;
                    // Якщо подія висіла на внутрішньому елементі вкладеного блоку
                    if (listener.target !== listener.oldRoot) {
                        const selector = this.buildUniqueSelector(listener.target, listener.oldRoot);
                        if (selector) {
                            newTarget = newChildRoot.querySelector(selector) || newChildRoot;
                        }
                    }
                    // Додаємо слухач заново з оновленими посиланнями
                    this.addListener(item.id, newTarget, listener.type, listener.fn);
                });
            } else {
                console.log('TESTER: ', newRootElement, item.selector, this.DOM);
                console.warn(`[Views.updateSingleBlock] Не вдалося знайти оновлений вкладений блок ${item.id}`);
            }
        });
    }

    /**
     * Безпечне додавання прослуховувача подій з автоматичною реєстрацією для утилізації пам'яті.
     * * @param {string} renderId - Ідентифікатор зарендереного блоку.
     * @param {HTMLElement} target - Елемент всередині блоку (наприклад, кнопка редагування).
     * @param {string} type - Тип події (наприклад, 'click', 'change').
     * @param {Function} handler - Функція-обробник події.
     */
    addListener(renderId, target, type, handler) {
        const record = this.DOM.get(renderId);
        if (record) {
            target.addEventListener(type, handler);
            record.listeners.push({
                target: target,
                type: type,
                fn: handler,
                oldRoot: record.el // Зберігаємо посилання на поточний корінь для подальшого пошуку селекторів
            });
        } else {
            console.warn(`[Views.addListener] Не вдалося додати подію: блок з renderId "${renderId}" не знайдено.`);
        }
    }

    /**
     * Повне видалення конкретного блоку з DOM та очищення всіх його подій (утилізація пам'яті).
     * * @param {string} renderId - Ідентифікатор блоку для видалення.
     */
    removeBlock(renderId) {
        const record = this.DOM.get(renderId);
        if (!record) return;

        // 1. Очищаємо всі прослуховувачі подій, зареєстровані на цей блок
        record.listeners.forEach(listener => {
            listener.target.removeEventListener(listener.type, listener.fn);
        });

        // 2. Видаляємо елемент із фізичного DOM
        if (record.el && record.el.parentNode) {
            record.el.parentNode.removeChild(record.el);
        }

        // 3. Видаляємо згадку про цей блок із контейнерних зв'язків
        if (record.container) {
            const containerIds = this.containers.get(record.container);
            if (containerIds) {
                containerIds.delete(renderId);
            }
        }

        // 4. Очищаємо картку з глобального реєстру
        this.DOM.delete(renderId);
    }

    /**
     * Екологічне очищення контейнера з гарантованим видаленням слухачів подій усіх вкладених блоків.
     * * @param {HTMLElement} container - Цільовий контейнер, який потрібно очистити.
     */
    clearContainer(container) {
        const renderedIds = this.containers.get(container);
        if (renderedIds) {
            renderedIds.forEach(renderId => {
                const record = this.DOM.get(renderId);
                if (record) {
                    // Видаляємо всі події
                    record.listeners.forEach(listener => {
                        listener.target.removeEventListener(listener.type, listener.fn);
                    });
                    // Видаляємо блок із глобального реєстру
                    this.DOM.delete(renderId);
                }
            });
            // Повністю видаляємо запис про цей контейнер
            this.containers.delete(container);
        }
        // Фізично очищаємо внутрішній HTML
        container.innerHTML = '';
    }

    /**
     * Пошук та зв'язування динамічних атрибутів виду data-bind-[attr].
     * Зберігає статичні HTML-класи та додає динамічні замість повної перезаписної заміни.
     * @private
     */
    bindAttributes(element, data) {
        Object.keys(element.dataset).forEach(key => {
            if (key.startsWith('bind') && key !== 'bindTemplate') {
                // Отримуємо назву атрибуту (наприклад, bindSrc -> src, bindClass -> class)
                const rawAttr = key.slice(4); // Вирізаємо слово "bind"
                // Робимо першу літеру малою (наприклад, DataSome -> dataSome, Src -> src)
                const camelCaseAttr = rawAttr.charAt(0).toLowerCase() + rawAttr.slice(1);
                // Конвертуємо camelCase в kebab-case (наприклад, dataSome -> data-some)
                // Шукаємо будь-яку велику літеру та замінюємо її на дефіс + цю ж літеру в нижньому регістрі
                const attributeName = camelCaseAttr.replace(/([A-Z])/g, '-$1').toLowerCase();
                // const attributeName = rawAttr.charAt(0).toLowerCase() + rawAttr.slice(1);

                // Шлях до значення у даних
                const path = element.dataset[key];
                const value = this.getNestedValue(data, path);

                if (value !== undefined && value !== null) {
                    if (attributeName === 'class') {
                        // --- Особлива обробка класів ---
                        // Розбиваємо рядок з класами у масив (фільтруємо зайві пробіли)
                        const newClasses = value.split(/\s+/).filter(Boolean);
                        if (newClasses.length > 0) {
                            // Додаємо нові класи через classList.add
                            element.classList.add(...newClasses);
                        }
                    } else {
                        // Для всіх інших атрибутів (src, href, id тощо) — звичайна заміна
                        element.setAttribute(attributeName, value);
                    }
                }
            }
        });
    }

    /**
     * Допоміжний метод для безпечного отримання значень з об'єктів за вкладеним шляхом (наприклад, "user.profile.name").
     * @private
     */
    getNestedValue(obj, path) {
        if (!path) {
            console.warn('Views:getNestedValue: path not set: ', path);
            return obj;
        }
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    /**
     * Допоміжний метод для побудови унікального CSS-селектора внутрішнього елемента відносно його кореня.
     * Використовується при переприв'язці подій під час точкового оновлення.
     * @private
     */
    buildUniqueSelector(element, root) {
        if (element === root) return '';
        const path = [];
        let current = element;

        while (current && current !== root) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break; // ID унікальний, далі йти вгору немає сенсу
            } else {
                if (current.className) {
                    // Очищаємо класи від зайвих пробілів
                    const classes = Array.from(current.classList).filter(c => c.trim() !== '');
                    if (classes.length > 0) {
                        selector += `.${classes.join('.')}`; //TODO: Vievs.buildUniqueSelector: проблема якщо ми змінюємо класи то об'єкт не знаходить в Views.DOM
                    }
                }

                // ДОДАЄМО ВИЗНАЧЕННЯ ІНДЕКСУ СЕРЕД СУСІДІВ (Siblings)
                const parent = current.parentElement;
                if (parent) {
                    // Знаходимо всі сусідні елементи з таким самим тегом
                    const siblings = Array.from(parent.children).filter(
                        child => child.tagName === current.tagName
                    );
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(current) + 1;
                        selector += `:nth-of-type(${index})`;
                    }
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

}