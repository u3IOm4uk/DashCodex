# Незавершені задачі

Оновлено: 2026-09-12. Тут залишаються тільки відкриті або свідомо відкладені задачі. Етап 2 злитий у `main`; Етап 3 виконується у draft PR #3.

| ID / пріоритет | Задача | Статус / залежності | Критерій завершення |
|---|---|---|---|
| T05 / P3 | Прибрати підтверджені мертві CSS-селектори й упорядкувати каскад | Функціональний dead DOM уже вилучено; глибоке CSS-чищення відкладено до browser regression | Менше obsolete overrides без зміни sticky/responsive/layout |
| T08 / P3 | Профілювання великої книги, Safari/Firefox і фізичні пристрої | Cache/index logic реалізовано, але реальні середовища ще не виміряні | Є виміряні результати, межі книги/пристроїв і зафіксовані bottleneck-и |
| T16 / P3 | Централізувати cache revision/resource versioning | У Stage 3 first-party ресурси вирівняно на `v=30`, але revision ще дублюється в HTML | Revision змінюється з одного місця або іншим простим контрольованим механізмом без build-system |
| T13 / P2 | Додати GitHub Actions для автоматичних adapter/syntax перевірок | Етап 4 | Pull request отримує автоматичний pass/fail status |
| T14 / P2 | Додати browser smoke/regression tests | Етап 4 | Критичні сценарії запуску/імпорту/навігації/графіків перевіряються автоматично |

## Перед merge Stage 3

Виконати локально FULL gate:

```sh
node --check js/contour-config.js
node --check js/contour-data.js
node --check js/contour-view.js
node --check js/contour-charts.js
node --check js/contour.js
node .audit/verify-contour.cjs
```

Browser regression:

- desktop приблизно 1440×1000;
- tablet приблизно 1024×768;
- phone приблизно 390×844;
- bundled і user import;
- navigation/sticky, source dialog, partial distribution note;
- area/bar, territory balance, БпС details/legend;
- швидкі перемикання графіків і dialogs.

Закрито кодом у Stage 3: T02 (видиме «Джерело»), T03 (пояснення partial distribution), T11 (lazy indexes + LRU aggregate cache), T12 (перший поділ pure view/chart responsibilities), T15 (legacy sidebar/donut DOM та handlers).

Закрито й злитo у Stage 2: T04, T07, T09, T10. Stage 1: переносимий launcher, Git/GitHub hygiene та вилучення legacy runtime-копій.

Невідомі одиниці площі та помилки вартості потребують підтвердженого джерела, а не припущень у коді.
