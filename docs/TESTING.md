# Перевірки та запуск

Перевірки виконуються за ризиком зміни. Історію окремих ревізій тут не зберігати; детальні історичні проходи — у `.audit/REVISIONS.md`, короткий актуальний статус — у `CURRENT_STATE.md`.

## Запуск

Усі команди виконувати з кореня КОНТУРУ. Для локального сервера потрібен Python 3:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Відкрити `http://127.0.0.1:8080/`. Node.js потрібен лише для автоматичних JS/адаптерних перевірок. `npm install` для активного дашборду не потрібен.

## Рівні перевірки

### LOW

Для тексту, локального CSS, невеликої функції без зміни контракту даних або глобального layout.

Мінімум: зачеплений сценарій; для JS — відповідний `node --check`; для локальної UI-правки — один релевантний viewport.

### NORMAL

Для логіки компонента, кількох пов’язаних файлів, локальної responsive-поведінки або графіків.

Мінімум: синтаксис змінених JS, релевантні сценарії, 1–2 viewport за потреби та `node .audit/verify-contour.cjs`, якщо зачеплено Excel contract, aggregate, dates, comparison, FPV/типи, validation або pure chart/view helpers.

### FULL

Для архітектури, моделі даних, імпорту/експорту, performance/cache, декомпозиції runtime або глобального DOM/layout cleanup.

Базовий Stage 3 gate:

```sh
node --check js/contour-config.js
node --check js/contour-data.js
node --check js/contour-view.js
node --check js/contour-charts.js
node --check js/contour.js
node .audit/verify-contour.cjs
```

Якщо змінено глобальний DOM/navigation/responsive — три viewport: приблизно **1440×1000**, **1024×768**, **390×844**.

## Regression contract даних

`.audit/verify-contour.cjs` має завершитися exit 0. Він перевіряє:

- реальна `Накопичення.xlsx` проходить validation без critical errors;
- контрольні totals/series/null/0 і сім типів БпС не змінені;
- критично несумісна книга дає `WorkbookValidationError`, warning-only книга лишається допустимою;
- включну date policy, contextRange, comparison і adaptive axes;
- safety cap series не обрізає `raw/rows/totals` повного from/to;
- parsed data використовує lazy indexes і aggregate cache;
- однаковий aggregate повторно дає cache hit без повторного index build;
- новий `parse()` отримує ізольований порожній cache;
- pure `ContourView`/`ContourCharts` зберігають escaping/date formatting, single-day marker і reduced-motion option.

`performanceStats()` використовується лише як regression/profiling diagnostic. Не прив'язувати до нього UI.

## Browser regression Stage 3

Перед merge PR #3 перевірити:

1. Bundled книга автоматично завантажується, ручний імпорт працює, provenance bundled/user не змінилась.
2. Desktop/tablet: кнопка «Джерело» видима у top-status і відкриває source dialog.
3. Phone: top-status прихований; «Джерело» доступне через нижню мобільну навігацію.
4. Розділи/категорії працюють після видалення legacy sidebar; dialog navigation і `#inline-sections` залишаються функціональними.
5. Sticky metrics: той самий ряд стискається/розгортається, drag не спричиняє click, активна картка не губиться.
6. Структура показника не залежить від старого `#distribution-chart`; смуги/підписи/відсотки рендеряться як раніше.
7. Якщо частина distribution values = `null`, з'являється примітка про розрахунок лише за наявними числами; null не стає 0.
8. Area/bar основного графіка, territory dynamics/balance, single-day marker і chart error-state не регресують.
9. БпС: сім карток, локальні line/bar, detail chart, multi-select legend і окрема FPV axis.
10. Dialogs: source/detail/navigation, Escape, повторне відкриття й швидкі перемикання.
11. Перевірити відсутність горизонтального page overflow на трьох viewport.

## Performance smoke

Цей етап не декларує конкретний millisecond budget без вимірювання. Для великої книги порівнювати принаймні:

- перший render після імпорту — очікувані cache misses/index builds;
- повторний render того самого зрізу — мають з'являтися aggregate hits;
- після нового імпорту — попередні entries не повинні переноситися в нову модель.

Для фактичних time/memory цифр використовується окремий profiling task T08; не підміняти regression cache counters заявою про реальне прискорення на всіх пристроях.

## Сценарії за зачепленим модулем

- **Категорії/sticky:** один ряд, без spacer/клонів, active visibility, drag/click.
- **Дати:** доба/діапазон, межі, рівність дат, неповні дані, context не змінює totals.
- **Території:** balance, zero line, dynamics/balance.
- **БпС:** FPV + шість типів, масштаби, line/bar, details/legend.
- **Діалоги:** open/close, Escape, focus, rapid chart changes.
- **Імпорт/validation:** valid/error/warning, bundled/user, 30 MiB limit.
- **Структура/null:** partial percentages + explicit note.
- **CSV:** тільки якщо зміна торкається експорту.
- **Доступність/анімація:** reduced motion, keyboard focus, accessible names.

## Додаткові інструменти

`.audit/workbook_profile.py` — read-only профіль книги через openpyxl; використовувати для задач структури/джерела або T08.

## Технічні зауваження

- Активні first-party CSS/JS у Stage 3 мають revision **30**; після зміни перевірити, що браузер не тримає старий ресурс.
- Скріншот одразу після кліку може показувати попередній кадр; дочекайся завершення DOM/анімації.
- Timeout browser tool сам по собі не доводить помилку застосунку.
- Viewport simulation не є тестом на фізичному пристрої.
- Результати кожного проходу не накопичувати тут; короткий актуальний статус — у `CURRENT_STATE.md`.
