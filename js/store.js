/**
 * @class Store
 * @description Централізоване сховище стану застосунку з підтримкою явного видалення підписників.
 * @version 1.0.0
 */
class Store {
    #state = {};
    #listeners = new Set();

    constructor(initialState = {}) {
        this.#state = structuredClone(initialState);
    }

    // ==========================================
    // СЕТТЕР, ГЕТТЕР, ВИДАЛЕННЯ ПАРАМЕТРІВ
    // ==========================================
    set(keyPath, value) {
        if (!keyPath || typeof keyPath !== 'string') return;

        const keys = keyPath.split('.');
        let current = this.#state;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== 'object' || current[k] === null) {
                current[k] = {};
            }
            current = current[k];
        }

        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];

        if (oldValue !== value) {
            current[lastKey] = value;
            this.#notify(keyPath, value, oldValue);
        }
    }

    get(keyPath, defaultValue = undefined) {
        if (!keyPath || typeof keyPath !== 'string') return defaultValue;

        const keys = keyPath.split('.');
        let current = this.#state;

        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                return defaultValue;
            }
        }

        return typeof current === 'object' && current !== null
            ? structuredClone(current)
            : current;
    }

    delete(keyPath) {
        if (!keyPath || typeof keyPath !== 'string') return false;

        const keys = keyPath.split('.');
        let current = this.#state;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== 'object') return false;
            current = current[k];
        }

        const lastKey = keys[keys.length - 1];
        if (lastKey in current) {
            const oldValue = current[lastKey];
            delete current[lastKey];
            this.#notify(keyPath, undefined, oldValue);
            return true;
        }

        return false;
    }

    getState() {
        return structuredClone(this.#state);
    }

    reset(newState = {}) {
        this.#state = structuredClone(newState);
        this.#notify('*', this.getAll(), null);
    }

    // ==========================================
    // РОБОТА З ПІДПИСНИКАМИ (Subscribe / Unsubscribe)
    // ==========================================

    /**
     * Підписка на зміни стану.
     * @param {Function} callback - Функція, яка викликається при зміні.
     * @param {string} [targetKeyPath=null] - Опціонально: підписка тільки на конкретний ключ.
     * @returns {Function} - Функція для автоматичного скасування підписки (Clean-up).
     */
    subscribe(callback, targetKeyPath = null) {
        if (typeof callback !== 'function') return () => { };

        const listener = { callback, targetKeyPath };
        this.#listeners.add(listener);

        // Спосіб 1: Повертаємо анонімну функцію відписки
        return () => {
            this.#listeners.delete(listener);
        };
    }

    /**
     * Спосіб 2: Явний метод видалення підписника.
     * @param {Function} callback - Функція-колбек, яку потрібно відв'язати.
     * @param {string} [targetKeyPath=null] - Шлях, від якого відв'язуємо (якщо вказувався при підписці).
     * @returns {boolean} - true якщо підписника знайдено і видалено.
     */
    unsubscribe(callback, targetKeyPath = null) {
        if (typeof callback !== 'function') return false;

        for (const listener of this.#listeners) {
            if (listener.callback === callback && listener.targetKeyPath === targetKeyPath) {
                this.#listeners.delete(listener);
                return true;
            }
        }
        return false;
    }

    /**
     * Повне очищення ВСІХ підписників (наприклад, при зміні сторінки або руйнуванні контролера).
     */
    unsubscribeAll() {
        this.#listeners.clear();
    }

    #notify(keyPath, newValue, oldValue) {
        this.#listeners.forEach(({ callback, targetKeyPath }) => {
            if (
                !targetKeyPath ||
                targetKeyPath === '*' ||
                keyPath === targetKeyPath ||
                keyPath.startsWith(targetKeyPath + '.') ||
                targetKeyPath.startsWith(keyPath + '.')
            ) {
                callback({ keyPath, newValue, oldValue, state: this.getAll() });
            }
        });
    }
}