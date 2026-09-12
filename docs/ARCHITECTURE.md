# Архітектура

Актуалізовано: 2026-09-12. Проєкт зберігається у приватному GitHub-репозиторії. Активний КОНТУР — статичний застосунок без build-system, backend і package manager для runtime.

## Активний runtime

| Компонент | Відповідальність |
|---|---|
| `index.html` | Чинний DOM, доступні назви, підключення ресурсів, діалоги, шапка, dock і панелі |
| `js/contour-config.js` | `APP_CONFIG`, `WORKBOOK_SCHEMA`, основні угруповання, типи джерел, date/performance policy |
| `js/contour-data.js` | Перевірка Excel-контракту, parse/normalization, метадані категорій, індекси, кеш aggregate, агрегація, date policy і порівняння |
| `js/contour-view.js` | Pure view helpers: escaping, number/date formatting, SVG icons |
| `js/contour-charts.js` | Pure chart builders: ApexCharts base/temporal options і SVG mini-bar |
| `js/contour.js` | Runtime state, import/export, DOM orchestration, навігація, dialogs, chart lifecycle, sticky/scroll поведінка |
| `css/contour.css` | Базова тема, компоненти, адаптивність |
| `css/contour-detail.css` | Парні показники й типи БпС |
| `css/contour-refinement.css` | Чинні уточнення щільності, sticky/navigation та анімації; завантажується останнім |
| `js/xlsx.full.min.js`, `js/apexcharts.js` | Локальні SheetJS та ApexCharts; CDN не потрібен |
| `fonts/`, `img/` | Локальні шрифти й зображення |
| `.audit/` | Адаптерні/regression перевірки, профіль книги, історичні ревізії та початковий HTML |
| `Запустити.cmd` | Переносимий Windows launcher локального HTTP-сервера |

Основний потік: **Excel → SheetJS.read → validateWorkbook → parse/normalize → lazy indexes/cache → sections/categories → aggregate → UI**. Критичні помилки схеми зупиняють імпорт до побудови моделі; некритичні відхилення зберігаються як validation warnings.

Для часових графіків: `contextRange → aggregate → ContourCharts.temporalOptions → ApexCharts`. Для деталей угруповання використовується його ключ, а не загальний підсумок.

## Конфігурація та Excel-контракт

`contour-config.js` є runtime source of truth для назви bundled workbook, ліміту імпорту, source kinds, політики дат, підтримуваних аркушів, підсумкових ключів, полів категорій/БпС, основних угруповань і межі aggregate cache.

`validateWorkbook()` формує `errors` і `warnings`; `parse()` при критичній несумісності кидає `WorkbookValidationError` із деталями validation.

## Aggregate indexes і cache

Тільки data-моделі, створені `parse()`, позначаються cacheable. Для них `contour-data.js` ліниво будує індекси аркуша:

- `date → rows`;
- `date → group → rows`;
- `date → type → rows`.

Повторний `aggregate()` використовує LRU-кеш, ключ якого містить section/sheet, category id/type/fields, from/to та group. Межа визначена `APP_CONFIG.performance.aggregateCacheEntries`.

Новий імпорт завжди створює новий data-object, тому WeakMap-кеш нового джерела ізольований автоматично. `performanceStats()` і `clearPerformanceCaches()` існують для regression/profiling, а не як UI API.

Safety cap обмежує календарну `days/series`, але не змінює стару семантику `raw`, `rows` і `totals`: вони охоплюють усі фактичні записи джерела у запитаному from/to. `truncated` лише сигналізує, що календарний ряд був обмежений.

## Джерело даних

Runtime зберігає джерело як `{ kind, name }`. Filename не визначає bundled/user. Автоматично завантажена книга має `kind: bundled`; файл через File API — `kind: user`.

Видимий desktop/tablet доступ до діалогу «Джерело» розташований у `.top-status`. На малих екранах `.top-status` ховається штатним breakpoint, а доступ лишається через нижню мобільну навігацію.

## Дати

`APP_CONFIG.datePolicy` визначає:

- ручний діапазон — максимум 366 включних календарних днів;
- from === to — 1 день;
- контекст доби — до 30 календарних позицій (-14/+15 зі зміщенням біля меж джерела);
- safety cap aggregate — 4001 календарна позиція.

Preset «Увесь період» може бути ширшим за ручний UI-ліміт; внутрішній cap застосовується лише до календарної series, не до totals.

## Стан, render і модульні межі

State залишається у замиканні `contour.js`: data/source, section/category, from/to, chart mode, territory mode, drone mode, distribution index, table state і chart instances.

`contour-view.js` і `contour-charts.js` не володіють state, не підписують events і не мутують DOM. Це навмисна межа: декомпозиція зменшує blast radius, але не вводить framework або нову state architecture.

`render()` перебудовує релевантний DOM, знищує старі основні графіки й створює нові. `generation` відсікає застаріле асинхронне завершення. При помилці актуальний chart host отримує видимий error-state. Графіки dialogs мають окремий lifecycle.

## Навігація, sticky та DOM cleanup

Один `#metrics` постійно знаходиться у sticky `#workspace-dock`. `#dock-anchor`, rAF scroll handler, `is-scrolled`, `cards-away`, `categorySizeLock`, `followCategory` і `dragRail` зберігають попередню поведінку.

Legacy sidebar вилучений із DOM і `navigation()`; navigation sources тепер — `#inline-sections`, mobile/dialog `#sheet-sections` і `#sheet-categories`. Старий прихований `#distribution-chart` також вилучений; структура показника рендериться лише в `#distribution-legend`.

Базові CSS-файли ще можуть містити історичні селектори для видаленого DOM. Їхнє глибоке каскадне чищення не змішується з функціональним refactor і потребує окремої browser-перевірки.

## Структура показника і null

`distribution()` зберігає `null` до render-рівня. Для побудови смуг використовуються лише невід’ємні числові значення. Якщо хоча б один елемент має `null`, UI явно пояснює, що частки пораховані лише за наявними числами і пропуски не прирівнюються до нуля.

## Графіки та БпС

`axisRange` відповідає за локальний масштаб мініграфіків, `integerAxis` — за цілі поділки основних/модальних осей. `ContourCharts` будує конфігурацію, а `contour.js` володіє lifecycle ApexCharts.

Сім карток БпС мають незалежні локальні area/bar режими. Деталі угруповання агрегують сім типів за `row.name`; при спільному показі FPV має праву вісь, інші типи — ліву.

## Імпорт, експорт і запуск

- Початковий fetch — `APP_CONFIG.defaultWorkbook`; далі File API для `.xlsx/.xls/.xlsm`.
- Acceptance policy вимагає заповнений ГОЧ або ОВгП.
- Excel formulas не перераховуються; використовуються cached values.
- CSV: UTF-8 BOM, `;`, CRLF, лапки; null → порожнє поле; початкові `= + @ -` екрануються апострофом.
- `Запустити.cmd` запускає локальний HTTP server лише на `127.0.0.1:8080`.
- Активні first-party CSS/JS у Stage 3 використовують узгоджену cache revision **30**.

## Репозиторій і перевірки

- `main` — перевірений стан; значущі зміни — окремі гілки/PR.
- Stage 3: `refactor/performance-maintainability`, draft PR #3.
- `.audit/verify-contour.cjs` перевіряє snapshot totals, schema/date contracts, aggregate cache/index behavior, import isolation, safety-cap semantics і pure helper modules.
- Автоматичного CI/browser-suite ще немає; перед merge потрібен локальний FULL regression.

## Зони великого впливу

Широкої перевірки потребують зміни в `WORKBOOK_SCHEMA`, aggregate/cache key semantics, null-агрегації, date policy, period/context, CSV, ApexCharts lifecycle, sticky/responsive layout і каскаді CSS.

Велика книга все ще парситься в main thread. Індекси/кеш зменшують повторну роботу render, але реальний performance budget на цільових пристроях ще не виміряний.
