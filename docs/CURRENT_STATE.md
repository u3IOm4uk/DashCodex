# Поточний стан

Оновлено: **2026-09-12**. Етап 2 — reliability foundation — перевірено користувачем і злитий у `main` squash-комітом `c5e1cbe`. Етап 3 — performance & maintainability — виконується у гілці `refactor/performance-maintainability`, draft PR #3. Офіційного semver немає; активні first-party CSS/JS у цій гілці мають cache revision **30**.

## Реалізовано в `main`

- Статичний `index.html`, три активні CSS-шари, локальні SheetJS/ApexCharts, Excel/шрифти/зображення; backend і persistence відсутні.
- Чотири розділи, імпорт/CSV, дати, картки, часові графіки, структура, таблиці, діалоги й попередження якості.
- Парні показники СОУ/противник і втрачено/відновлено; територіальний баланс; FPV відокремлений від інших типів БпС.
- Контекст обраної доби до 30 днів не змінює підсумки періоду.
- Один sticky-ряд категорій без копій/spacer; responsive drawer і нижня мобільна навігація.
- `js/contour-config.js` централізує runtime/workbook config, source kinds і date policy.
- `validateWorkbook()` виконується до `parse()`: критичні структурні помилки блокують імпорт, некритичні відсутні поля формують warnings.
- Джерело має окремі `{kind, name}`; filename не визначає тип джерела.
- ApexCharts має видимий error-state, а generation guard відсікає застарілий основний render.
- Репозиторій очищено від legacy MVC/Dexie, ручних версій, дубля `xlsx.js`, старого `css.css` і непідключеного Bootstrap; `Запустити.cmd` переносимий.

## Етап 3 — реалізовано в робочій гілці

- `aggregate()` для моделей, створених `parse()`, використовує lazy indexes за date/group/type та LRU-кеш повторних запитів. Новий імпорт створює новий data-object і автоматично отримує ізольований cache.
- `performanceStats()` і `clearPerformanceCaches()` дають read-only діагностику cache/index поведінки для regression/profiling.
- Safety cap серії не змінює стару семантику `raw/rows/totals`: навіть при обрізаному календарному `days` підсумки рахуються за повним запитаним діапазоном джерела.
- Із `contour.js` винесені pure helpers: `contour-view.js` відповідає за escaping/format/date/icon, `contour-charts.js` — за chart options і mini-bar SVG. State, DOM orchestration та events залишаються у `contour.js`.
- Прихований legacy sidebar і старий `#distribution-chart` вилучені з DOM та JS-залежностей. Мобільна навігація використовує чинний dialog.
- «Джерело» має видиму кнопку в desktop/tablet top-status; на малих екранах використовується існуюча нижня кнопка.
- Якщо структура показника містить `null`, UI пояснює, що частки рахуються лише за наявними числовими значеннями і пропуски не прирівнюються до нуля.
- First-party CSS/JS query revisions вирівняні на `v=30`.
- Regression script розширено перевірками cache hit/miss, ізоляції нового імпорту, full-range totals за series cap та pure view/chart helpers.

## Git/GitHub

- Канонічний репозиторій: `u3IOm4uk/DashCodex`.
- Базова гілка: `main`.
- Поточна робоча гілка: `refactor/performance-maintainability`.
- Draft PR: **#3 — Stage 3: performance and maintainability**.
- Значущі зміни виконуються в окремих гілках; merge у `main` — лише після потрібного regression-проходу.

## Статус перевірок

- Stage 2 локальні перевірки користувач підтвердив перед merge.
- Для Stage 3 проведено code/diff/patch review; `contour.js` декомпозовано без зміни state/event-flow.
- `.audit/verify-contour.cjs` зберігає попередні snapshot-значення та містить нові Stage 3 checks.
- Автоматичного CI/browser-suite поки немає, тому **Stage 3 лишається draft до локального FULL проходу**.
- Перед merge потрібні `node --check` для `contour-config.js`, `contour-data.js`, `contour-view.js`, `contour-charts.js`, `contour.js`, запуск `.audit/verify-contour.cjs` і browser regression на desktop/tablet/mobile.

## Відомі обмеження й технічний борг

- Базові CSS-файли ще містять частину правил для вже видаленого legacy DOM та історичні overrides; функціональну залежність від sidebar/donut-host уже прибрано, але глибоке каскадне чищення T05 не завершене.
- `contour.js` став меншим за відповідальністю, але все ще володіє state, DOM render, navigation, dialogs, import/export і scroll orchestration; подальша декомпозиція має бути лише за реальною потребою.
- Продуктивність великої реальної книги ще не виміряна на цільових пристроях; cache/index logic покрита regression checks, але T08 потребує окремого профілювання.
- Одиниця територій не підтверджена; у вартості ОВгП є помилки джерела; формули Excel не перераховуються.
- Acceptance policy все ще вимагає заповнений ГОЧ або ОВгП; книга лише з персоналом/БК не проходить імпорт.
- Повного автоматичного browser-suite і CI поки немає — це scope Етапу 4.

## Поточний фокус

Завершити review/документацію Stage 3 та передати draft PR #3 на локальний FULL regression. Глибоке CSS-cascade cleanup виконувати лише після browser-перевірки поточного DOM cleanup; CI і browser automation залишаються наступним етапом.

Документація працює як continuity layer між сесіями: базовий контекст — `AGENTS.md` + цей файл + релевантний код; тематичні документи читаються й оновлюються лише за потреби. Перевірки виконуються за рівнями LOW/NORMAL/FULL із `TESTING.md`.
