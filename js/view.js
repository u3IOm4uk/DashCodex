/**
 * @fileoverview Універсальний декларативний рушій шаблонів (Template Engine).
 * Забезпечує швидкий рендеринг HTML через нативні DOM-методи, точкове оновлення
 * інтерфейсу за бізнес-ключами (O(1)), двостороннє зв'язування динамічних атрибутів,
 * а також автоматичну утилізацію пам'яті (очищення Event Listeners).
 * @version 2.2.7
 */
class Views {
    constructor() {
        /**
         * Кеш оригінальних HTML-шаблонів, вилучених з тегів <template>.
         * @type {Object<string, HTMLTemplateElement>}
         */
        this.templates = {};

        /**
         * Глобальний плоский реєстр відрендерених бізнес-блоків у DOM.
         * Ключ: renderId
         * @type {Map<string, {
         * el: HTMLElement,
         * container: HTMLElement,
         * templateName: string,
         * listeners: Array<{ target: HTMLElement, eventId: string, type: string, fn: Function, oldRoot: HTMLElement }>
         * }>}
         */
        this.DOM = new Map();

        /**
         * Мапа зв'язку контейнерів із зарендереними в них ідентифікаторами (renderId).
         * Змінено Map на WeakMap. Оскільки ключем є HTMLElement, WeakMap дозволяє
         * Garbage Collector автоматично утилізувати видалені з DOM контейнери.
         * @type {WeakMap<HTMLElement, Set<string>>}
         */
        this.containers = new WeakMap();

        // Лічильник для генерації унікальних ідентифікаторів елементів з подіями всередині блоку
        this._eventElementCounter = 0;

        this.init();
    }

    /**
     * Первинна ініціалізація: збір усіх тегів <template id="..."> на сторінці.
     */
    init() {
        // Рекурсивна функція для пошуку всіх <template id="..."> включно з вкладеними
        const collectTemplates = (root) => {
            const elements = root.querySelectorAll('template[id]');
            elements.forEach(tpl => {
                this.templates[tpl.id] = tpl;

                // Якщо шаблон має вміст (DocumentFragment), шукаємо вкладені шаблони в ньому
                if (tpl.content) {
                    collectTemplates(tpl.content);
                }
            });
        };

        collectTemplates(document);

        if (Data.global.debag) {
            console.log(`[Views.init] Успішно зареєстровано шаблонів: ${Object.keys(this.templates).length}`);
            console.dir(this.templates);
        }
    }

    /**
     * Основний метод рендерингу (компіляція шаблону та вставка в DOM).
     * Клонує HTML5 <template>, наповнює його даними, присвоює унікальний `data-render-id`,
     * реєструє елемент у внутрішній карті `this.DOM` та вставляє в контейнер.
     * 
     * @param {string} templateName - Ідентифікатор/назва шаблону в об'єкті `this.templates`.
     * @param {Object|Array<Object>} data - Об'єкт даних або масив об'єктів для наповнення шаблону.
     * @param {HTMLElement|null} [container=null] - DOM-елемент, у який буде вставлено скомпільований HTML.
     * @param {boolean} [append=false] - Якщо `false`, контейнер попередньо очищається перед вставкою; якщо `true` — нові елементи додаються в кінець.
     * @returns {HTMLElement|DocumentFragment|null} Контейнер з оновленим вмістом, `DocumentFragment` (якщо контейнер не вказано) або `null` у разі помилки.
     */
    render(templateName, data, container = null, append = false) {
        //TODO UPDATE: [Views.render] треба пофіксити щоб шаблон не обов'язково був одним html елементом.
        const template = this.templates[templateName];
        if (!template) {
            Data.global.debag && console.error(`[Views.render] Шаблон з ID "${templateName}" не знайдено.`);
            return null;
        }

        if (container && !append) {
            this.clearContainer(container);
        }

        const fragment = document.createDocumentFragment();
        const dataArray = Array.isArray(data) ? data : [data];

        dataArray.forEach((item) => {
            const clone = template.content.cloneNode(true);
            const rootElement = clone.firstElementChild;

            if (!rootElement) return;

            // Формування стійкого бізнес-ключа renderId
            let renderId = rootElement.dataset.key ? this.getNestedValue(item, rootElement.dataset.key) : (item.renderId || item.id);
            if (renderId && !String(renderId).includes(':')) {
                renderId = `${templateName}:${renderId}`;
            }
            if (!renderId) {
                renderId = `${templateName}:${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            }

            rootElement.setAttribute('data-render-id', renderId);
            rootElement.dataset.renderId = renderId;

            this.compile(rootElement, item);

            const record = {
                el: rootElement,
                container: container,
                templateName: templateName,
                listeners: []
            };
            this.DOM.set(renderId, record);

            if (container) {
                if (!this.containers.has(container)) {
                    this.containers.set(container, new Set());
                }
                this.containers.get(container).add(renderId);
            }

            fragment.appendChild(clone);
        });

        if (container) {
            container.appendChild(fragment);
            return container;
        }

        return fragment;
    }

    /**
     * Рекурсивний компілятор елементів (обхід у глибину — Depth-First Search).
     * Сканує DOM-дерево вузла, зв'язує текстовий контент (`data-field`), атрибути
     * та обробляє динамічні списки/вкладені шаблони (`data-list`).
     * якщо встановити атрибут (`data-html`) або (`data-field-type="html"`) то з параметру (`data-field`) виведеться сирий HTML.
     * 
     * @param {HTMLElement} element - Поточний DOM-елемент для компіляції.
     * @param {Object|*} data - Об'єкт даних (або примітив), з якого витягуються значення.
     */
    compile(element, data) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

        // 1. Зв'язування текстового контенту
        if (element.dataset.field !== undefined) {
            const path = element.dataset.field;
            // Обробка масивів примітивів (наприклад, tags, де data-field="")
            const value = path === "" ? data : this.getNestedValue(data, path);
            const sanitizedValue = (value !== undefined && value !== null) ? value : '';

            // Перевіряємо, чи вказано прапорець для рендерингу HTML
            if (element.dataset.html !== undefined || element.dataset.fieldType === 'html') {
                element.innerHTML = sanitizedValue;
            } else {
                element.textContent = sanitizedValue;
            }
        }

        // 2. Зв'язування атрибутів
        this.bindAttributes(element, data);

        // 3. Обробка списків (data-list)
        const listName = element.dataset.list;
        if (listName) {
            const subData = this.getNestedValue(data, listName);
            if (subData) {
                let templateName = element.dataset.template;
                const bindTemplatePath = element.dataset.bindTemplate;

                if (!templateName && bindTemplatePath) {
                    templateName = this.getNestedValue(data, bindTemplatePath);
                }

                if (Array.isArray(subData)) {
                    // Перед очищенням innerHTML утилізуємо всі старі зарендерені вкладені блоки з this.DOM
                    const existingChildNodes = element.querySelectorAll('[data-render-id]');
                    existingChildNodes.forEach(childEl => {
                        const childRenderId = childEl.dataset.renderId;
                        if (childRenderId) {
                            this.removeBlock(childRenderId);
                        }
                    });

                    // Очищуємо контейнер списку перед рендерингом нових елементів
                    element.innerHTML = '';

                    subData.forEach(item => {
                        let activeTemplate = templateName;
                        if (bindTemplatePath && typeof item === 'object' && item !== null && item[bindTemplatePath]) {
                            activeTemplate = item[bindTemplatePath];
                        }

                        if (activeTemplate) {
                            this.render(activeTemplate, item, element, true);
                        } else {
                            Data.global.debag && console.warn(`[Views.compile] Не знайдено шаблон для елемента списку`, activeTemplate, item, element);
                        }
                    });
                } else if (typeof subData === 'object' && subData !== null) {
                    if (templateName) {
                        this.render(templateName, subData, element, false);
                    }
                }
            }
            return; // Перериваємо рекурсію для дітей, бо render() обробить їх сам
        }

        const children = Array.from(element.children);
        children.forEach(child => this.compile(child, data));
    }

    /**
     * Безпечно додає обробник подій до DOM-елемента всередині зарендереного блоку.
     * Реєструє слухача в записі `this.DOM`, присвоюючи елементу атрибут `data-view-event-id` 
     * для швидкого витоку/очищення подій при перемальовуванні блоку.
     * 
     * @param {string} renderId - Ідентифікатор зарендереного блоку в `this.DOM`.
     * @param {HTMLElement} target - DOM-елемент, до якого прив'язується обробник.
     * @param {string} type - Тип події (наприклад, 'click', 'change', 'input').
     * @param {Function} handler - Функція-обробник події.
     */
    addListener(renderId, target, type, handler) {
        const record = this.DOM.get(renderId);
        if (record) {
            // Якщо елемент ще не має Event ID, присвоюємо його (для O(1) пошуку при оновленні)
            if (!target.dataset.viewEventId) {
                this._eventElementCounter++;
                target.setAttribute('data-view-event-id', `ev-${this._eventElementCounter}`);
                target.dataset.viewEventId = `ev-${this._eventElementCounter}`;
            }

            target.addEventListener(type, handler);
            record.listeners.push({
                target: target,
                eventId: target.dataset.viewEventId,
                type: type,
                fn: handler,
                oldRoot: record.el
            });
        } else {
            Data.global.debag && console.warn(`[Views.addListener] Не вдалося додати подію: блок з renderId "${renderId}" не знайдено.`);
        }
    }

    /**
     * Точкове оновлення (Update) конкретного блоку за бізнес-ключем `renderId` із постійною складністю O(1).
     * Метод зберігає метадані та слухачі подій головного та вкладених блоків, замінює вузол у реальному DOM,
     * після чого відновлює слухачі подій на нових елементах за їхніми унікальними ідентифікаторами.
     * 
     * @param {string} renderId - Унікальний ідентифікатор блоку в `this.DOM`.
     * @param {Object} newData - Нові дані для рекомпіляції блоку.
     */
    updateSingleBlock(renderId, newData) {
        const record = this.DOM.get(renderId);
        if (!record || !record.el.parentNode) {
            Data.global.debag && console.warn(`[Views.updateSingleBlock] Блок з renderId "${renderId}" не знайдено в active DOM.`);
            return;
        }

        // 1. Збір метаданих вкладених блоків перед видаленням зі старого DOM
        const childRenderElements = record.el.querySelectorAll('[data-render-id]');
        const childRecords = [];

        childRenderElements.forEach(childEl => {
            const childId = childEl.dataset.renderId;
            const childRec = this.DOM.get(childId);
            if (childRec) {
                childRecords.push({
                    id: childId,
                    record: childRec
                });
            }
        });

        // 2. Зняття слухачів з головного блоку
        const savedListeners = [...record.listeners];
        savedListeners.forEach(listener => {
            listener.target.removeEventListener(listener.type, listener.fn);
        });
        record.listeners = [];

        // Зняття слухачів з усіх вкладених підблоків
        childRecords.forEach(item => {
            item.record.listeners.forEach(listener => {
                listener.target.removeEventListener(listener.type, listener.fn);
            });
            item.savedChildListeners = [...item.record.listeners];
            item.record.listeners = [];
        });

        // 3. Компіляція нового елемента
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

        // Рендеримо нові дані (на цьому етапі створюється чиста структура БЕЗ `data-view-event-id`)
        this.compile(newRootElement, newData);

        // 4. Заміна в реальному DOM
        record.el.parentNode.replaceChild(newRootElement, record.el);
        record.el = newRootElement;

        // 5. Переприв'язка івентів головного блоку (за допомогою стійкого eventId)
        savedListeners.forEach(listener => {
            let newTarget = null;
            if (listener.target === listener.oldRoot) {
                newTarget = newRootElement;
            } else {
                // Шукаємо за збереженим маркованим дата-атрибутом
                newTarget = newRootElement.querySelector(`[data-view-event-id="${listener.eventId}"]`);
            }

            // Переприв'язуємо івент тільки якщо знайдено цільовий елемент у новій структурі
            if (newTarget) {
                this.addListener(renderId, newTarget, listener.type, listener.fn);
            }
        });

        // 6. Переприв'язка івентів вкладених блоків
        childRecords.forEach(item => {
            // Знаходимо оновлений вкладений блок за його унікальним renderId
            const newChildRoot = newRootElement.querySelector(`[data-render-id="${item.id}"]`) ||
                (newRootElement.dataset.renderId === item.id ? newRootElement : null);

            if (newChildRoot) {
                item.record.el = newChildRoot;

                item.savedChildListeners.forEach(listener => {
                    let newTarget = null;
                    if (listener.target === listener.oldRoot) {
                        newTarget = newChildRoot;
                    } else {
                        newTarget = newChildRoot.querySelector(`[data-view-event-id="${listener.eventId}"]`);
                    }

                    // Безпечна прив'язка івенту до нового child node
                    if (newTarget) {
                        this.addListener(item.id, newTarget, listener.type, listener.fn);
                    }
                });
            } else {
                Data.global.debag && console.warn(`[Views.updateSingleBlock] Не вдалося знайти оновлений вкладений блок ${item.id}`);
                this.removeBlock(item.id);
            }
        });
    }

    /**
     * Повне рекурсивне видалення блоку та всіх його вкладених дочірніх елементів з DOM та карти `this.DOM`.
     * Очищає прив'язані обробники подій (listeners) та видаляє посилання з реєстру контейнерів для запобігання витокам пам'яті.
     * 
     * @param {string} renderId - Унікальний ідентифікатор блоку, який потрібно видалити.
     */
    removeBlock(renderId) {
        const record = this.DOM.get(renderId);
        if (!record) return;

        // Рекурсивне видалення всіх зарендерених дочірніх блоків з this.DOM
        if (record.el) {
            const childElements = record.el.querySelectorAll('[data-render-id]');
            childElements.forEach(childEl => {
                const childRenderId = childEl.dataset.renderId;
                if (childRenderId && childRenderId !== renderId) {
                    this.removeBlock(childRenderId);
                }
            });
        }

        record.listeners.forEach(listener => {
            listener.target.removeEventListener(listener.type, listener.fn);
        });

        if (record.el && record.el.parentNode) {
            record.el.parentNode.removeChild(record.el);
        }

        if (record.container) {
            const containerIds = this.containers.get(record.container);
            if (containerIds) {
                containerIds.delete(renderId);
            }
        }

        this.DOM.delete(renderId);
        Data.global.debag && console.info(`[Views.removeBlock] Видалено ${renderId}`);
    }

    /**
     * Очищає вміст DOM-контейнера та утилізує всі пов'язані з ним зарендерені блоки.
     * Метод рекурсивно видаляє зареєстровані блоки через `removeBlock`, відв'язує обробники подій, 
     * видаляє записи з `this.DOM` та обнуляє внутрішній HTML-вміст контейнера.
     * 
     * @param {HTMLElement} container - DOM-елемент контейнера, який необхідно очистити.
     */
    clearContainer(container) {
        const renderedIds = this.containers.get(container);
        if (renderedIds) {
            // Перетворюємо Set на масив перед ітерацією, щоб уникнути проблем під час видалення через removeBlock
            Array.from(renderedIds).forEach(renderId => {
                // Виклик removeBlock гарантує рекурсивне очищення подій, дочірніх підблоків та записів у this.DOM
                this.removeBlock(renderId);
            });
            this.containers.delete(container);
        }
        container.innerHTML = '';
    }

    /**
     * Шукає та зв'язує динамічні атрибути DOM-елемента з відповідними значеннями з об'єкта даних.
     * Сканує дата-атрибути, що починаються з `data-bind-*` (наприклад, `data-bind-src`, `data-bind-class`),
     * перетворює їх на стандартні HTML-атрибути та встановлює отримані значення.
     * 
     * @private
     * @param {HTMLElement} element - DOM-елемент, атрибути якого потрібно зв'язати.
     * @param {Object} data - Об'єкт даних, з якого витягуються значення за вказаним шляхом.
     */
    bindAttributes(element, data) {
        Object.keys(element.dataset).forEach(key => {
            if (key.startsWith('bind') && key !== 'bindTemplate') {
                const rawAttr = key.slice(4);
                const camelCaseAttr = rawAttr.charAt(0).toLowerCase() + rawAttr.slice(1);
                const attributeName = camelCaseAttr.replace(/([A-Z])/g, '-$1').toLowerCase();

                const path = element.dataset[key];
                const value = this.getNestedValue(data, path);

                if (value !== undefined && value !== null) {
                    if (attributeName === 'class') {
                        // Чистимо попередні класи, залишаючи нативні з верстки, якщо це повторний рендер
                        if (value.trim()) {
                            const newClasses = value.split(/\s+/).filter(Boolean);
                            if (newClasses.length > 0) {
                                element.classList.add(...newClasses);
                            }
                        }
                    } else {
                        element.setAttribute(attributeName, value);
                    }
                }
            }
        });
    }

    /**
     * Безпечно витягує значення з глибини вкладеного об'єкта за вказаним крапковим шляхом (dot-notation).
     * Запобігає виникненню помилок типу `TypeError: Cannot read property of undefined`.
     * 
     * @private
     * @param {Object} obj - Вхідний об'єкт для пошуку значень.
     * @param {string} path - Шлях до властивості у форматі "key1.key2.key3" (наприклад, "user.profile.name").
     * @returns {*} Знайдене значення або `undefined`, якщо будь-який з проміжних ключів відсутній.
     * 
     * @example
     * // Поверне "John"
     * getNestedValue({ user: { profile: { name: 'John' } } }, 'user.profile.name');
     * 
     * // Поверне undefined (без викидання помилки)
     * getNestedValue({ user: {} }, 'user.profile.name');
     */
    getNestedValue(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
    /**
     * Перейменовує (заміщує) ключ збереженого DOM-елемента у внутрішньому реєстрі Map (`this.DOM`).
     * Метод знаходить елемент за старим ключем, перепризначає його за новим ключем,
     * оновлює атрибут `data-render-id` у відповідному HTML-елементі та видаляє старий запис.
     * 
     * @param {string} oldKey - Старий ідентифікатор/ключ елемента в реєстрі `this.DOM`.
     * @param {string} newKey - Новий ідентифікатор/ключ для елемента.
     * @returns {boolean} Повертає `true`, якщо заміна пройшла успішно, або `false`, якщо старий ключ не знайдено.
     */
    substituteDOMEl(oldKey, newKey) {
        if (this.DOM.has(oldKey)) {
            this.DOM.set(newKey, this.DOM.get(oldKey));
            this.DOM.get(newKey).el.dataset.renderId = newKey;
            this.DOM.delete(oldKey);
            return true; // Перейменування успішне
        }
        return false; // Старого ключа не знайдено
    }
}