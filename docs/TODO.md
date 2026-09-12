# Незавершені задачі

Оновлено: 2026-09-13. Етапи 1–5 та конструктор міжкатегорійного порівняння інтегровані у `main`; порівняння злитий через PR #11. Відкритий технічний борг наведено нижче.

| ID / пріоритет | Задача | Статус / залежності | Критерій завершення |
|---|---|---|---|
| T05 / P3 | Прибрати підтверджені мертві CSS-селектори й упорядкувати каскад | Відкладено; робити під browser coverage | Менше obsolete overrides без layout-регресій |
| T08 / P3 | Профілювання великої книги, Safari/Firefox і фізичні пристрої | Окремий profiling task | Є виміряні bottleneck-и та межі |

## Quality policy

- docs-only → без runtime/browser tests;
- змінений first-party JS → syntax лише змінених файлів;
- data/schema/aggregate → adapter regression;
- UI → core browser;
- sticky/navigation → sticky browser;
- charts → chart browser;
- БпС/FPV → BpS browser;
- hierarchy/archive → units browser;
- test/CI infrastructure → повний quality suite.

Закрито у Stage 5: T17, T18 (PR #5 злитий). Stage 4: T13, T14, T16. Stage 3: T02, T03, T11, T12 (перший модульний поділ), T15. Stage 2: T04, T07, T09, T10. Stage 1: launcher/Git hygiene/legacy cleanup.
