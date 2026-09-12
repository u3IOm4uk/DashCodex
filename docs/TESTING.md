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
| `contour-config`, `contour-data`, workbook, adapter test | `.audit/verify-contour.cjs` |
| UI/DOM/CSS/runtime | `tests/browser/core.spec.cjs` |
| sticky/navigation-related diff | `tests/browser/sticky.spec.cjs` |
| chart-related diff | `tests/browser/charts.spec.cjs` |
| БпС/FPV/drone-related diff | `tests/browser/bps.spec.cjs` |
| CI/test infrastructure | повний quality suite |

Отже, БпС **не перевіряється при кожному PR** — лише коли diff реально зачіпає БпС/FPV/drone-код/стилі або саму test infrastructure.

## GitHub Actions

Workflow: `.github/workflows/quality.yml`.

Він має три основні jobs:

1. `scope` — визначає релевантні перевірки;
2. `syntax` / `regression` — запускаються тільки за відповідним scope;
3. `browser` — встановлює Playwright/Chromium і запускає тільки обрані spec-файли.

Push у `main` і кожен pull request отримують автоматичний pass/fail лише за релевантними перевірками.

## Regression contract даних

`node .audit/verify-contour.cjs` перевіряє Excel validation, контрольні totals/series/null/0, date policy, comparison/axes, cache/index semantics та pure view/chart helpers. Його запускати, коли зміна може вплинути на модель даних або агрегацію.

## Browser tests

### Core

Перевіряє базове завантаження dashboard, картки, зміну категорії, основний графік, структуру та таблицю.

### Sticky

Перевіряє, що при зміні категорії у `cards-away` стані sticky-картки залишаються стисненими, а вгору підтягується контент під ними, а не вся сторінка.

### Charts

Перевіряє area/bar та territory balance.

### БпС

Перевіряє сім карток БпС, вибір FPV та базову працездатність відповідного графіка. Цей spec запускається **тільки за BpS scope**.

## Ручні перевірки

Автоматизація не замінює ручну FULL-перевірку, коли змінюється глобальний layout/responsive, складна анімація або UX-концепція. Для таких змін перевіряти релевантні viewport, а не механічно весь проєкт.

## Принцип

Мінімальний достатній тестовий обсяг = **змінений код + його безпосередні залежності + ризик регресії**. Не запускати повний browser-suite або БпС-suite без причини.
