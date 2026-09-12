# Архітектура

Актуалізовано: 2026-09-13. Проєкт зберігається у приватному GitHub-репозиторії. Активний КОНТУР — статичний застосунок без build-system і backend; npm використовується лише для test tooling.

## Активний runtime

| Компонент | Відповідальність |
|---|---|
| `index.html` | Чинний DOM, доступні назви, підключення ресурсів, діалоги, шапка, dock і панелі |
| `js/contour-config.js` | `APP_CONFIG`, `WORKBOOK_SCHEMA`, `UNIT_HIERARCHY`, source/date/performance policy |
| `js/contour-data.js` | Workbook validation, parse/normalization, metadata, indexes/cache, aggregate, dates і comparisons |
| `js/contour-units.js` | Проєкція explicit hierarchy config на GOCh rows, unit statuses, archive/expand behavior |
| `js/contour-view.js` | Pure escaping/format/date/icon helpers |
| `js/contour-charts.js` | Pure ApexCharts option builders і mini-bar SVG |
| `js/contour-navigation.js` | Targeted navigation adapter для category/sticky scroll behavior |
| `js/contour.js` | Runtime state, import/export, DOM orchestration, dialogs, chart lifecycle, основний render |
| `js/contour-compare.js` | Незалежний UI/runtime конструктора міжкатегорійного порівняння поверх чинних `ContourData.parse()` / `aggregate()` |
| `css/contour.css` | Базова тема, компоненти, адаптивність |
| `css/contour-detail.css` | Парні показники й типи БпС |
| `css/contour-refinement.css` | Чинні уточнення sticky/navigation/щільності |
| `css/contour-units.css` | Ієрархічна таблиця, archive/status manager |
| `css/contour-compare.css` | Трипанельний desktop layout та одноколонковий mobile layout конструктора порівняння |
| `js/xlsx.full.min.js`, `js/apexcharts.js` | Локальні SheetJS та ApexCharts |
| `.audit/` | Data/regression checks і workbook profiling |
| `tests/browser/` | Change-scoped Playwright scenarios |
| `Запустити.cmd` | Переносимий Windows launcher локального HTTP-сервера |

Основний data flow: **Excel → SheetJS.read → validateWorkbook → parse/normalize → lazy indexes/cache → sections/categories → aggregate → UI**.

Unit presentation-гілка після parse: **parsed GOCh records + `ContourConfig.UNIT_HIERARCHY` → `ContourUnits.buildCatalog` → hierarchy/status view → існуюча detail table**. Вона не змінює normalized records і не входить у aggregate math.

Comparison flow: **та сама локальна Excel-книга → `ContourData.parse()` → `ContourData.sections()` → каталог доступних серій + `UNIT_HIERARCHY` → окремі `aggregate()` для вибраних показників/unit-вузлів → optional explicit multi-unit composition → presentation-only normalized/absolute transform → ApexCharts + таблиця**. Конструктор не вводить власних source-полів і не реконструює parent із children.

## Конфігурація та Excel-контракт

`contour-config.js` — runtime source of truth для bundled workbook, import limit, source kinds, date policy, workbook sheets, summary keys, category/drone fields, explicit unit hierarchy і aggregate cache limit.

`UNIT_HIERARCHY` є вкладеною структурою. Рівень визначається тільки вкладеністю: root = угруповання, перший рівень children = АК, глибші рівні = підрозділи. `GROUP_NAMES` формується з root-вузлів цієї структури.

`validateWorkbook()` формує `errors`/`warnings`; critical incompatibility зупиняє `parse()` через `WorkbookValidationError`.

## Aggregate indexes і cache

Тільки data-моделі, створені `parse()`, є cacheable. Для них `contour-data.js` ліниво будує:

- `date → rows`;
- `date → group → rows`;
- `date → type → rows`.

Повторний `aggregate()` використовує bounded LRU cache. Ключ містить section/sheet, category id/type/fields, from/to та group. Новий import створює новий data-object, тому runtime cache ізольований через WeakMap.

Safety cap може обмежити `days/series`, але `raw/rows/totals` зберігають повний фактичний from/to. `performanceStats()`/`clearPerformanceCaches()` — diagnostic API для regression/profiling, не UI state.

## Ієрархія підрозділів

`contour-units.js` підключається після `contour-data.js` і обгортає `ContourData.parse()`: після успішного parse будується окремий каталог з усіх GOCh records.

Parent-зв’язки не виводяться з Excel. `buildCatalog()` зіставляє точну назву row з `UNIT_HIERARCHY`:

1. конфігурація розгортається у map `name → parent/level/order`;
2. вузли, присутні у GOCh і конфігурації, отримують тільки configured parent та level;
3. Excel row order, шаблон `АК` та інші heuristics не використовуються для parent;
4. назва, відсутня в `UNIT_HIERARCHY`, стає `unconfigured` root і явно позначається у UI;
5. для bundled контрольної книги `units.spec.cjs` вимагає порожній `catalog.unconfigured`.

Ієрархія впливає тільки на представлення flat table. `+ / −` окремо керує expand/collapse, натискання назви викликає існуючі деталі. Батьківський numeric row не реконструюється з дітей.

У comparison runtime `UNIT_HIERARCHY` індексується окремо лише для UI selection state. Вибір parent використовує його власний `aggregate(..., group)`. Вибір descendant прибирає ancestor зі scope, а вибір parent прибирає descendants; це не дозволяє подвійно врахувати один hierarchy path. Якщо явно обрано кілька неперекривних вузлів, їхні власні серії композиційно сумуються тільки в `contour-compare.js`; день із хоча б одним `null` лишається `null`.

## Unit status і локальна persistence

Для unit view існують status overrides:

- `active` — звичайне відображення;
- `hidden` — не показувати в робочій таблиці;
- `archived` — приховувати за замовчуванням, але дозволити через archive toggle.

Overrides зберігаються у `localStorage` за ключем `contour.unit-status.v1` і keyed exact unit name. Це **UI preference**, не operational data persistence: Excel, parsed model, aggregate cache і історичні records не змінюються.

При new import каталог перебудовується; локальний override може повторно застосуватися, якщо точна назва збігається. Архівований row доступний тільки в period, де source реально має цей row; UI не синтезує відсутню історію.

## Джерело даних

Runtime source metadata: `{kind,name}`. Filename не визначає bundled/user. Автоматично fetched workbook — `bundled`; File API — `user`.

Data workbook після reload завантажується заново; unit visibility/archive preference є локальною persistence, а hierarchy source є статичною конфігурацією репозиторію.

`contour-compare.js` не має доступу до closure основного `contour.js`, тому першу версію comparison runtime будує ліниво з тієї самої bundled книги або повторно парсить файл після File API import. Обидва runtime використовують один `ContourData` контракт і не розходяться у формулах; можливий read-only runtime bridge розглядається лише як майбутня оптимізація після profiling.

## Дати

`APP_CONFIG.datePolicy`:

- manual range максимум 366 inclusive calendar days;
- from === to = 1 день;
- context до 30 calendar positions (-14/+15 із boundary shift);
- aggregate series safety cap 4001.

Preset «Увесь період» може бути ширшим за manual UX limit; safety cap не обрізає totals/raw rows.

## State, render і модульні межі

Основний analytics state лишається у closure `contour.js`: data/source, section/category, period, chart modes, distribution index, chart instances.

`contour-units.js` має власний presentation state (`catalog`, `expanded`, status overrides, showArchived) і не володіє analytics state. Він спостерігає rerender `#table-body` через `MutationObserver` і повторно накладає hierarchy state на нові rows.

`contour-compare.js` має окремий локальний state: parsed model/source metadata, metric catalog, selected series, comparison period, selected/expanded unit sets, opened metric categories, chart/value modes та chart instance. Цей state не змінює основні `from/to`, section/category або normalized records.

`contour-view.js`/`contour-charts.js` pure; `contour-navigation.js` не володіє data model. `generation` у main render відсікає stale async chart completion.

## Навігація і sticky

Один `#metrics` живе у `#workspace-dock`. Compact/sticky стан не створює копію row і spacer.

При category change у compact state `contour-navigation.js` перенаправляє scroll так, щоб pinned cards лишалися стисненими, а до робочої межі переміщався лише контент під ними. Full page top лишається для справді top-level navigation.

## Графіки та БпС

`ContourCharts` формує chart options; `contour.js` володіє ApexCharts lifecycle. Сім drone cards мають локальні modes; multi-series details використовують окрему FPV axis при спільному показі.

Мініграфіки мають `.mini-hover` із датами та значеннями; делегований pointer-handler показує спільний tooltip поза overflow-контейнерами. Мініграфіки не перехоплюють колесо.

`ContourCharts.periodRange()` визначає календарне вікно в межах дат джерела. `mountPlotPeriod()` додає пресети й wheel-handler до основного/модального chart-host; події колеса об’єднуються перед оновленням графіка. `mainPlotWindow` та локальне вікно деталей не змінюють облікові `from/to`. Нові точки отримуються через чинний `aggregate()`; кеш/формули не змінені. AbortController і cleanup прибирають wheel-handler та таймер при rerender/закритті деталей.

Comparison chart має власний ApexCharts lifecycle. Режим `normalized` виконує тільки presentation-transform: перше доступне ненульове значення серії = 100; `absolute` використовує вихідні значення. `null` не перетворюється на 0. Unit scope отримує окремі серії через чинний `aggregate(..., group)` лише для джерел із unit-деталізацією; multi-unit composition не змінює `ContourData` або його cache semantics.

## Імпорт, експорт і запуск

- initial fetch — `APP_CONFIG.defaultWorkbook`; File API підтримує `.xlsx/.xls/.xlsm`;
- acceptance policy вимагає filled GOCh або OVGp;
- Excel formulas не перераховуються;
- CSV: UTF-8 BOM, `;`, CRLF, null → empty field, formula-like prefixes escaped;
- `Запустити.cmd` bind only `127.0.0.1:8080`;
- first-party resource revision визначається `?v=` у `index.html`; поточний знімок — у [CURRENT_STATE.md](CURRENT_STATE.md).

## Репозиторій і quality gate

- `main` — verified baseline; значуща робота йде через branch/PR.
- `.github/workflows/quality.yml` аналізує diff через `scripts/quality-scope.cjs` і запускає тільки relevant jobs.
- syntax — changed first-party JS only;
- regression — data/schema/aggregate risk;
- resource-version — `index.html`/revision tooling;
- browser specs: `core`, `sticky`, `charts`, `bps`, `units`.
- `units.spec.cjs` запускається лише для hierarchy/archive-related risk; BpS spec не запускається лише через unit hierarchy changes.
- stale runs одного PR cancel через `concurrency`.

## Зони великого впливу

Wide review потрібен для `WORKBOOK_SCHEMA`, aggregate/cache semantics, null/date policy, CSV, global sticky/responsive DOM, `UNIT_HIERARCHY` contract або зміни meaning `active/hidden/archived`.

Велика книга все ще парситься у main thread; actual performance budget на target devices не встановлено.