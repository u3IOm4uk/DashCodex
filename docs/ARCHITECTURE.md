# Архітектура

Актуалізовано: 2026-09-13. Проєкт зберігається у приватному GitHub-репозиторії. Активний КОНТУР — статичний застосунок без build-system і backend; npm використовується лише для test tooling.

## Активний runtime

| Компонент | Відповідальність |
|---|---|
| `index.html` | DOM, ресурси й діалоги; без inline comparison handlers |
| `js/contour-config.js` | `APP_CONFIG`, `WORKBOOK_SCHEMA`, `UNIT_HIERARCHY`, source/date/performance policy |
| `js/contour-data.js` | Workbook validation, parse/normalization, metadata, indexes/cache, aggregate, dates і comparisons |
| `js/contour-units.js` | Проєкція explicit hierarchy config на GOCh rows, unit statuses, archive/expand behavior |
| `js/contour-view.js` | Pure escaping/format/date/icon helpers |
| `js/contour-charts.js` | Pure ApexCharts option builders і mini-bar SVG |
| `js/contour-navigation.js` | Targeted navigation adapter для category/sticky scroll behavior |
| `js/contour.js` | Runtime state, import/export, DOM orchestration, dialogs, chart lifecycle, основний render |
| `js/contour-compare.js` | Незалежний UI/state порівняння поверх прийнятої моделі та `aggregate()` |
| `js/contour-source.js` | Прийняття джерела, один parse, захист від застарілого асинхронного читання |
| `css/contour.css` | Базова тема, компоненти, адаптивність |
| `css/contour-detail.css` | Парні показники й типи БпС |
| `css/contour-refinement.css` | Чинні уточнення sticky/navigation/щільності |
| `css/contour-units.css` | Ієрархічна таблиця, archive/status manager |
| `css/contour-compare.css` | Трипанельний desktop layout та mobile picker/layout конструктора порівняння |
| `js/xlsx.full.min.js`, `js/apexcharts.js` | Локальні SheetJS 0.20.3 та ApexCharts 5.15.2 |
| `.audit/` | Data/regression checks і workbook profiling |
| `tests/browser/` | Change-scoped Playwright scenarios |
| `Запустити.cmd` | Переносимий Windows launcher локального HTTP-сервера |

Основний data flow: **Excel → SheetJS.read → validateWorkbook → parse/normalize → lazy indexes/cache → sections/categories → aggregate → UI**.

Unit presentation-гілка після parse: **parsed GOCh records + `ContourConfig.UNIT_HIERARCHY` → `ContourUnits.buildCatalog` → hierarchy/status view → існуюча detail table**. Вона не змінює normalized records і не входить у aggregate math.

Comparison flow розділений після `aggregate()`:

- **chart:** спільна прийнята модель `ContourSource` → `ContourData.sections()` → каталог серій + `UNIT_HIERARCHY` → окремі `aggregate()` вибраних показників/unit-вузлів → optional explicit multi-unit composition → presentation-only `normalized/absolute` transform → ApexCharts;
- **table:** ті самі raw `aggregate()` серії → абсолютні значення без presentation normalization → поденна деталізація; при unit scope — окремі `date × unit` rows, а не composite chart series.

Конструктор не вводить власних source-полів і не реконструює parent із children.

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

`contour-units.js` підключається після `contour-data.js` та отримує прийняту модель через явний `setData()`: будується окремий каталог з усіх GOCh records.

Parent-зв’язки не виводяться з Excel. `buildCatalog()` зіставляє точну назву row з `UNIT_HIERARCHY`:

1. конфігурація розгортається у map `name → parent/level/order`;
2. вузли, присутні у GOCh і конфігурації, отримують тільки configured parent та level;
3. Excel row order, шаблон `АК` та інші heuristics не використовуються для parent;
4. назва, відсутня в `UNIT_HIERARCHY`, стає `unconfigured` root і доступна лише в поданні «Приховані»;
5. `units.spec.cjs` перевіряє синтетичну ієрархію/невизначений вузол; вимоги порожнього bundled `catalog.unconfigured` у ньому немає. Фактичне охоплення — CURRENT_STATE / аудит A06.

В основному огляді ієрархія керує представленням flat table та direct-child деталізацією. `+ / −` окремо керує expand/collapse, натискання назви викликає існуючі деталі. Батьківський numeric row не реконструюється з дітей.

У comparison runtime `UNIT_HIERARCHY` індексується окремо лише для UI selection state. Вибір parent використовує його власний `aggregate(..., group)`. Вибір descendant прибирає ancestor зі scope, а вибір parent прибирає descendants; це не дозволяє подвійно врахувати один hierarchy path. Якщо явно обрано кілька неперекривних вузлів, їхні власні серії композиційно сумуються тільки для chart scope у `contour-compare.js`; день із хоча б одним `null` лишається `null`. Detail table натомість зберігає окремі raw series кожного вибраного вузла.

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

`ContourSource.load(readBuffer, name, kind)` призначає generation до читання, відхиляє застарілий результат до parse та замінює `current` лише після успішної validation/parse. Помилка нового імпорту зберігає попередню модель. Основний runtime публікує прийнятий snapshot через `ContourUnits.setData()` і `ContourCompare.setSource()`. Comparison очікує `ready()` та використовує той самий model/cache без повторного fetch/parse. Новий імпорт скидає unit selection і дерева; звичайне відкриття comparison не змінює дерево огляду.

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

`contour-view.js`/`contour-charts.js` pure; форматування чисел повторно використовує один `Intl.NumberFormat`. `ContourNavigation.scrollCategory()` викликається явно з main і не перевизначає `window.scrollTo`. Основний та comparison render мають незалежні generation guards для застарілих chart completion/errors.

Bulk/reset і derived parent checked/indeterminate state належать `contour-compare.js`: одна дія змінює Set і виконує один render. DOM не є джерелом аналітичного selection state; каскаду синтетичних change-подій та inline MutationObserver немає. Мобільні фільтри — нативні кнопки з aria-expanded/controls, закриті панелі inert; Escape повертає фокус. CSS визначає висоту chart host, workspace прокручується, а chart не стискається контейнером із прихованим overflow.

## Навігація і sticky

Один `#metrics` живе у `#workspace-dock`. Compact/sticky стан не створює копію row і spacer.

При category change у compact state `contour-navigation.js` перенаправляє scroll так, щоб pinned cards лишалися стисненими, а до робочої межі переміщався лише контент під ними. Full page top лишається для справді top-level navigation.

## Графіки та БпС

`ContourCharts` формує chart options; `contour.js` володіє ApexCharts lifecycle. Сім drone cards мають локальні modes; multi-series details використовують окрему FPV axis при спільному показі.

Мініграфіки мають `.mini-hover` із датами та значеннями; делегований pointer-handler показує спільний tooltip поза overflow-контейнерами. Мініграфіки не перехоплюють колесо.

`ContourCharts.periodRange()` визначає календарне вікно в межах дат джерела. `mountPlotPeriod()` додає пресети й wheel-handler до основного/модального chart-host; події колеса об’єднуються перед оновленням графіка. `mainPlotWindow` та локальне вікно деталей не змінюють облікові `from/to`. Нові точки отримуються через чинний `aggregate()`; кеш/формули не змінені. AbortController і cleanup прибирають wheel-handler та таймер при rerender/закритті деталей.

Comparison chart має власний ApexCharts lifecycle. Режим `normalized` виконує тільки presentation-transform: перше доступне ненульове значення серії = 100; `absolute` використовує вихідні значення. `null` не перетворюється на 0. Unit scope отримує окремі серії через чинний `aggregate(..., group)` лише для джерел із unit-деталізацією; multi-unit composition не змінює `ContourData` або його cache semantics. Comparison table не споживає transformed chart values: вона повторно використовує raw aggregate series, стандартний `details-panel + table-wrap` і зберігає unit-level rows.

## Імпорт, експорт і запуск

- initial fetch — `APP_CONFIG.defaultWorkbook`; File API підтримує `.xlsx/.xls/.xlsm`;
- acceptance policy вимагає filled GOCh або OVGp;
- Excel formulas не перераховуються;
- CSV: UTF-8 BOM, `;`, CRLF, null → empty field, formula-like prefixes escaped;
- `Запустити.cmd` bind only `127.0.0.1:8080`;
- first-party resource revision визначається `?v=` у `index.html`; поточний знімок — у [CURRENT_STATE.md](CURRENT_STATE.md).

## Репозиторій і quality gate

- Значуща робота йде через branch/PR; статус конкретного `main` і реально проведені перевірки фіксуються в CURRENT_STATE. Сам workflow не підтверджує обов'язковість branch-protection checks.
- `.github/workflows/quality.yml` аналізує diff через `scripts/quality-scope.cjs` і запускає тільки relevant jobs.
- syntax — changed first-party JS та inline script у зміненому HTML;
- regression — data/schema/aggregate risk;
- resource-version — `index.html`/revision tooling;
- browser specs: core/sticky/charts/bps/units і всі compare*.spec.cjs; перелік передається з router у workflow;
- Змінений browser spec запускає себе; infrastructure diff знаходить усі browser specs. Router має unit coverage. `npm ci` використовує package-lock.json; portable `scripts/serve.cjs` обслуговує локальні Playwright перевірки.
- `units.spec.cjs` запускається лише для hierarchy/archive-related risk; BpS spec не запускається лише через unit hierarchy changes.
- stale runs одного PR cancel через `concurrency`.

## Зони великого впливу

Wide review потрібен для `WORKBOOK_SCHEMA`, aggregate/cache semantics, null/date policy, CSV, global sticky/responsive DOM, `UNIT_HIERARCHY` contract або зміни meaning `active/hidden/archived`.

Велика книга все ще парситься у main thread; actual performance budget на target devices не встановлено.

## Огляд: дата, структура й складання БпС

`contour.js` керує нативним period-dialog і спільним застосуванням облікових дат. Chart click зіставляє dataPointIndex з поточним вікном графіка; wheel/presets не змінюють облікові межі. Для балансу позицій series перевпорядковуються тільки в presentation-шарі.

`ContourCharts.distributionDonut()` формує SVG з зовнішніми підписами й використовує той самий знаменник, що смуги. `contour-units.js` перемикає видимість unconfigured/hidden без зміни source records. Під час складання БпС flow-відступ узгоджується зі sticky-зміщенням, після завершення фіксується: подальший scroll переміщує нижні панелі під ряд.
