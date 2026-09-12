# Поточний стан

Оновлено: **2026-09-12**. Етап 3 — performance & maintainability — перевірено користувачем і злитий у `main` squash-комітом `142a43f`. Етап 4 — change-scoped quality automation — виконується у гілці `test/change-scoped-quality`.

## Реалізовано в `main`

- Статичний локальний dashboard без backend/persistence; runtime не потребує npm/build-system.
- `contour-config.js` централізує runtime/workbook config, source kinds і date policy.
- `validateWorkbook()` виконується до `parse()`; critical errors блокують імпорт, warnings відображаються користувачу.
- `source.kind` відділений від filename.
- `aggregate()` для parsed models використовує lazy indexes і bounded LRU cache; імпорти ізольовані.
- `contour-view.js` і `contour-charts.js` винесені як pure helpers; state/DOM orchestration лишаються в `contour.js`.
- Legacy sidebar і старий donut host прибрані.
- Sticky-категорії при зміні категорії у compact-режимі залишаються pinned/compact; переміщується лише контент під ними.
- Partial distribution із `null` пояснюється явно; null не прирівнюється до нуля.
- Видимий доступ до «Джерело» є на desktop/tablet і mobile.

## Етап 4 — робоча гілка

- Додано `.github/workflows/quality.yml`.
- Додано `scripts/quality-scope.cjs`, який визначає перевірки за зміненими файлами та їх diff.
- Syntax check запускається лише для змінених first-party JS.
- Adapter regression запускається для schema/data/aggregate/workbook changes.
- Playwright browser tests поділені на `core`, `sticky`, `charts`, `bps`.
- БпС-test запускається лише при БпС/FPV/drone-related diff або зміні самої test infrastructure.
- Docs-only changes не запускають runtime/browser tests.
- `package.json` і Playwright є dev/test tooling; production runtime не змінений і не потребує npm.

## Git/GitHub

- Канонічний репозиторій: `u3IOm4uk/DashCodex`.
- Базова гілка: `main`.
- Поточна робоча гілка: `test/change-scoped-quality`.
- Значущі зміни виконуються через окрему гілку/PR.

## Відомі відкриті задачі

- T05: глибше CSS-cascade cleanup після стабілізації automated browser coverage.
- T08: фактичне профілювання великої книги та фізичних/альтернативних браузерів.
- T16: централізований resource revision/cache busting без build-system.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.

## Поточний фокус

Завершити Stage 4 quality infrastructure, перевірити сам workflow у draft PR і після стабілізації використовувати change-scoped CI як стандартний merge gate.
