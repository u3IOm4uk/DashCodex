# Незавершені задачі

Оновлено: 2026-09-12. Етапи 1–3 злиті у `main`. Етап 4 виконується у `test/change-scoped-quality`.

| ID / пріоритет | Задача | Статус / залежності | Критерій завершення |
|---|---|---|---|
| T05 / P3 | Прибрати підтверджені мертві CSS-селектори й упорядкувати каскад | Відкладено до стабілізації automated browser coverage | Менше obsolete overrides без layout-регресій |
| T08 / P3 | Профілювання великої книги, Safari/Firefox і фізичні пристрої | Окремий profiling task | Є виміряні bottleneck-и та межі |
| T13 / P2 | GitHub Actions для автоматичних перевірок | Реалізовано в Stage 4 branch; очікує фінальний CI/merge | PR отримує change-scoped pass/fail |
| T14 / P2 | Browser smoke/regression tests | Реалізовано core/sticky/charts/BpS scopes; очікує фінальний CI/merge | Browser tests запускаються лише для релевантного diff |
| T16 / P3 | Централізувати cache revision/resource versioning | Реалізовано `scripts/resource-version.cjs`; очікує merge | `version:check` гарантує однакову revision, `version:bump` змінює її однією командою |

## Stage 4 quality policy

- docs-only → без runtime/browser tests;
- змінений first-party JS → syntax лише змінених файлів;
- data/schema/aggregate → adapter regression;
- `index.html` / resource-version script → resource revision check;
- UI → core browser;
- sticky/navigation → sticky browser;
- charts → chart browser;
- БпС/FPV/drone-related diff → BpS browser;
- test/CI infrastructure → повний quality suite.

Закрито й злитo у Stage 3: T02, T03, T11, T12 (перший модульний поділ), T15. Stage 2: T04, T07, T09, T10. Stage 1: launcher/Git hygiene/legacy cleanup.
