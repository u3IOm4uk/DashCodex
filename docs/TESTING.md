# Перевірки та запуск

Перевірки виконуються за **фактичним diff і ризиком зміни**. Повний набір не запускається автоматично для кожної правки.

## Локальний запуск

Runtime дашборда не потребує npm:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Playwright/npm потрібні лише для тестової інфраструктури:

```sh
npm install
npx playwright install chromium
```

## Автоматичний quality router

`scripts/quality-scope.cjs` аналізує список змінених файлів і їх diff та формує scopes для GitHub Actions.

| Тип зміни | Автоматична перевірка |
|---|---|
| лише docs | без runtime/browser tests |
| first-party JS | `node --check` тільки змінених JS |
| `index.html` / resource-version script | `scripts/resource-version.cjs --check` |
| `contour-config`, `contour-data`, workbook, adapter test | `.audit/verify-contour.cjs` |
| UI/DOM/CSS/runtime | `tests/browser/core.spec.cjs` |
| sticky/navigation-related diff | `tests/browser/sticky.spec.cjs` |
| chart-related diff | `tests/browser/charts.spec.cjs` |
| БпС/FPV/drone-related diff | `tests/browser/bps.spec.cjs` |
| hierarchy/archive-related diff | `tests/browser/units.spec.cjs` |
| CI/test infrastructure | повний quality suite |

БпС не перевіряється при кожному PR; так само hierarchy/archive test запускається лише для змін, що можуть вплинути на цю модель або її UI.

## GitHub Actions

Workflow: `.github/workflows/quality.yml`.

Основні jobs:

1. `scope` — визначає релевантні перевірки;
2. `syntax` — тільки змінені first-party JS;
3. `resource-version` — тільки при зміні `index.html` або versioning script;
4. `regression` — тільки data/schema/aggregate scope;
5. `browser` — тільки релевантні Playwright specs.

Push у `main` і кожен pull request отримують автоматичний pass/fail лише за релевантними перевірками. Старі runs того самого PR скасовуються через `concurrency`.

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

`node .audit/verify-contour.cjs` перевіряє Excel validation, контрольні totals/series/null/0, date policy, comparison/axes, cache/index semantics та pure view/chart helpers. Його запускати, коли зміна може вплинути на модель даних або агрегацію.

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

## Ручні перевірки

Автоматизація не замінює ручну FULL-перевірку для глобального layout/responsive, складної анімації або нової UX-концепції. Для локальних змін ієрархії/архіву перевіряти таблицю ГОЧ на desktop і mobile: expand/collapse, деталі батька, manager status, archive toggle і повернення статусу в `active`.

## Принцип

Мінімальний достатній тестовий обсяг = **змінений код + його безпосередні залежності + ризик регресії**. Не запускати повний browser-suite без причини.
