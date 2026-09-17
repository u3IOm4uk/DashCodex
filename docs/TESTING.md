# Перевірки та запуск

Перевірки виконуються за **фактичним diff і ризиком зміни**. Повний набір не запускається автоматично для кожної правки.

## Локальний запуск

Runtime дашборда не потребує npm:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Playwright/npm потрібні лише для тестової інфраструктури:

```sh
npm ci
npx playwright install chromium
node --test tests/unit/*.test.cjs
node scripts/verify-contour.cjs
npx playwright test
```

## Автоматичний quality router

`scripts/quality-scope.cjs` аналізує список змінених файлів і їх diff та формує scopes для GitHub Actions.

| Тип зміни | Автоматична перевірка |
|---|---|
| лише docs | без runtime/browser tests |
| first-party JS | `node --check` тільки змінених JS |
| `index.html` / resource-version script | `scripts/resource-version.cjs --check`; HTML також перевіряється `scripts/check-inline.cjs` |
| `contour-config`, `contour-data`, `contour-source`, workbook, adapter test | `scripts/verify-contour.cjs` і Node unit tests |
| UI/DOM/CSS/runtime | `tests/browser/core.spec.cjs` |
| sticky/navigation-related diff | `tests/browser/sticky.spec.cjs` |
| chart-related diff | `tests/browser/charts.spec.cjs` |
| БпС/FPV/drone-related diff | `tests/browser/bps.spec.cjs` |
| hierarchy/archive-related diff | `tests/browser/units.spec.cjs` |
| Comparison runtime/залежності | усі `compare*.spec.cjs` та релевантні загальні specs |
| Змінений browser spec | запускає себе |
| CI/test infrastructure | усі наявні browser specs та інші quality scopes |

Router визначає coverage за власністю файлів; ключові слова diff можуть лише додати перевірки. `browser_files` передається до workflow без окремого ручного переліку. Infrastructure scope знаходить усі specs у `tests/browser`; unit tests перевіряють comparison-only, новий spec, infrastructure та docs-only випадки. A02 виправлено.

БпС не перевіряється при кожному PR; так само hierarchy/archive test запускається лише для змін, що можуть вплинути на цю модель або її UI.

## GitHub Actions

Workflow: `.github/workflows/quality.yml`.

Основні jobs:

1. `scope` — визначає релевантні перевірки;
2. `syntax` — змінені first-party JS та inline scripts зміненого HTML;
3. `resource-version` — тільки при зміні `index.html` або versioning script;
4. `regression` — adapter і Node unit tests для data/source/schema/aggregate або infrastructure scope;
5. `browser` — тільки релевантні Playwright specs.

Push у `main` і кожен pull request отримують автоматичний pass/fail лише за обраними router перевірками. Mandatory branch protection окремо не підтверджена; наявність workflow не доводить merge gate. Старі runs того самого PR скасовуються через `concurrency`.

## Resource revision

Перевірка:

```sh
npm run version:check
```

Підняти всі first-party `?v=` одночасно:

```sh
npm run version:bump
```

Або встановити конкретну revision:

```sh
node scripts/resource-version.cjs 31
```

## Regression contract даних

`node scripts/verify-contour.cjs` перевіряє Excel validation, контрольні totals/series/null/0, date policy, comparison/axes, cache/index semantics та pure view/chart helpers. Його запускати, коли зміна може вплинути на модель даних або агрегацію.

## Browser tests

### Core

Базове завантаження dashboard, картки, зміна категорії, основний графік, структура та таблиця.

### Sticky

При зміні категорії у `cards-away` стані sticky-картки лишаються стисненими; переміщується контент під ними. Compact-картки стають вужчими без заміни DOM-вузлів та обрізання назв/чисел; перевіряються desktop, tablet і вузькі viewport.

### Charts

Area/bar та territory balance; hover мініграфіка з датою/значенням, збереження 0/null; календарні межі wheel zoom і пресетів; незмінність облікового періоду, підсумків і таблиць; збереження вікна при зміні типу та скидання фільтрами.

### БпС

Сім карток БпС, FPV і базова працездатність відповідного графіка; hover line/bar мініграфіків, період деталей, багатосерійна легенда з окремою віссю FPV і станом «усі вимкнені». Запуск лише за BpS scope.

### Units

`tests/browser/units.spec.cjs` перевіряє:

- зв’язки `угруповання → АК → підрозділ` із явного `UNIT_HIERARCHY` на синтетичних даних;
- вузол поза конфігурацією лишається `unconfigured` без вигаданого parent;
- окрема кнопка `+ / −` розгортає/згортає дітей нижче батька з гілками дерева й анімацією; натискання назви відкриває деталі;
- detail-таблиця містить власний рядок батька й лише його безпосередніх дітей;
- компактний відступ заголовка detail-dialog та горизонтальне розташування заголовка тенденції, періоду й перемикачів;
- архівований рядок приховується за замовчуванням;
- після ввімкнення «Архів» рядок знову доступний;
- історичні деталі архівованого підрозділу відкриваються штатним detail-handler.

Цей spec перевіряє невідомий вузол на синтетичних даних; він **не доводить**, що bundled-книга повністю покрита конфігурацією. У перевіреній книзі є `УВ "Курськ"` поза `UNIT_HIERARCHY` (A06). Не змінювати конфігурацію за припущенням лише для отримання порожнього `unconfigured`.

### Comparison

Три specs автоматично включені до comparison scope: compare-actions, compare-tablet і compare-audit. Часткове comparison coverage у charts збережене.

| Перевірка | Контракт |
|---|---|
| Actions | Reset/All, неперекривні leaf-вузли, derived parent, узгоджені кнопки |
| Tablet | Non-modal shell при видимій нижній навігації |
| Audit geometry | Графік/вісь/примітка доступні на 1366×768, 1440×1000, 820×1180, 390×844 без прихованого clipping |
| Audit state | Основне дерево зберігається; comparison не парсить повторно; валідний імпорт парситься один раз |
| Audit dates | Змінена межа має пріоритет в обох UI; таблиця лишається абсолютною |
| Audit accessibility | Tab/Enter/Space/Escape, повернення фокусу, контраст примітки ≥4,5:1 |
| Audit bulk/series | Один chart render для All; derived parent не додається до scope; видалення зберігає кольори решти; видима база |
| Audit import/coverage | Invalid-date import зберігає прийняту книгу та її source totals |

Node unit tests у tests/unit покривають календарну коректність і block policy, пріоритет межі, конкуренцію асинхронних source reads та quality routing. Числові контрольні сценарії залишаються в adapter regression.

### Повний набір

Для зміни CI/test infrastructure запускати adapter regression, Node unit tests, syntax/resource checks і весь Playwright suite. Сервер Playwright — portable Node scripts/serve.cjs на localhost; Python для тестів не потрібний. Lockfile фіксує dev dependencies, runtime залишається без npm.

Реально виконані перевірки й обмеження поточного етапу — [CURRENT_STATE](CURRENT_STATE.md); вихідний аудит не є звітом про нову реалізацію.

## Ручні перевірки

Автоматизація не замінює ручну FULL-перевірку для глобального layout/responsive, складної анімації або нової UX-концепції. Для локальних змін ієрархії/архіву перевіряти таблицю ГОЧ на desktop і mobile: expand/collapse, деталі батька, manager status, archive toggle і повернення статусу в `active`.

## Принцип

Мінімальний достатній тестовий обсяг = **змінений код + його безпосередні залежності + ризик регресії**. Не запускати повний browser-suite без причини.

### Оновлення огляду

`presentation.spec.cjs`: дата/діапазон і Enter, прибрана навігація, «Приховані» та деталі, кругла структура, вибір БпС через мініграфік, баланс позицій, клік реальної точки графіка, послідовність складання й подальшого scroll. Для поточного етапу користувач передав ручні візуальні перевірки собі; додаткові desktop/tablet/mobile ревізії не проводяться.
