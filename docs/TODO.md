# Незавершені задачі

Оновлено: 2026-09-12. Етапи 1–4 злиті у `main`. Етап 5 виконується у `feature/unit-hierarchy-archive`.

| ID / пріоритет | Задача | Статус / залежності | Критерій завершення |
|---|---|---|---|
| T05 / P3 | Прибрати підтверджені мертві CSS-селектори й упорядкувати каскад | Відкладено; робити під browser coverage | Менше obsolete overrides без layout-регресій |
| T08 / P3 | Профілювання великої книги, Safari/Firefox і фізичні пристрої | Окремий profiling task | Є виміряні bottleneck-и та межі |
| T17 / P2 | Ієрархія `Угруповання → АК → підрозділ` | Реалізовано в Stage 5 draft PR #5; потрібен green CI/UX review | Стабільні зв’язки розгортаються, неоднозначні не вигадуються |
| T18 / P2 | `active / hidden / archived` для підрозділів | Реалізовано локальними status overrides; потрібен green CI/UX review | Архів не видаляє дані, історичні деталі доступні при показі архіву |

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

Закрито у Stage 4: T13, T14, T16. Stage 3: T02, T03, T11, T12 (перший модульний поділ), T15. Stage 2: T04, T07, T09, T10. Stage 1: launcher/Git hygiene/legacy cleanup.
