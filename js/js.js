/**
 * @version 1.1.0
 * @dependencies dexie.js, xlsx.js, apexcharts.js
 */
//TODO TASK: конфігуратор сторінок
//TODO UPDATE: прокручування рядка категорій, якщо їх багато
//TODO FIX: warDay при настанні нової доби треба оновити
document.addEventListener("DOMContentLoaded", () => {
    const State = new Store();
    //(dexie.js)
    const DB = new Dexie("dashBoardTest");
    //(model.js)
    const Model = new Models(DB);
    //(view.js)
    const View = new Views();
    //(controller.js)
    const Controller = new Controllers(Model, View, State);

    window.app = {
        State,
        Model,
        View,
        Controller
    };
    // Запуск обробників
    
    Data.global.debag && console.log('DOM init: ',View.DOM);
});

window.addEventListener("load", () => {
    
});