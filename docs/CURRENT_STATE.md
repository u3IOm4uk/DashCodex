# Поточний стан

Оновлено: **2026-09-12**. Етап 3 — performance & maintainability — перевірено користувачем і злитий у `main` squash-комітом `142a43f`. Етап 4 — change-scoped quality automation — виконується у гілці `test/change-scoped-quality`, draft PR #4.

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

## Етап 4 — робоча гілка

- `.github/workflows/quality.yml` запускається на PR і push у `main`.
- `scripts/quality-scope.cjs` визначає перевірки за changed files + patch content.
- Syntax check — лише змінені first-party JS.
- Adapter regression — лише schema/data/aggregate/workbook changes.
- Playwright browser tests поділені на `core`, `sticky`, `charts`, `bps`.
- BpS-test запускається лише при БпС/FPV/drone-related diff або зміні test infrastructure.
- Docs-only changes не запускають runtime/browser tests.
- `scripts/resource-version.cjs` перевіряє єдину first-party `?v=` revision і дозволяє підняти її однією командою.
- `package.json` і Playwright є dev/test tooling; production runtime не змінений і не потребує npm.

## Статус CI

- Перший Stage 4 run: scope/syntax/regression пройшли; browser suite знайшов передчасне вимірювання smooth-scroll у самому sticky-test.
- Sticky-test виправлено без зміни runtime.
- Наступний прогін: core, charts, BpS і sticky browser tests пройшли; syntax/regression також пройшли.
- Подальші коміти Stage 4 повторно перевіряються тим самим change-scoped workflow.

## Git/GitHub

- Канонічний репозиторій: `u3IOm4uk/DashCodex`.
- Базова гілка: `main`.
- Поточна робоча гілка: `test/change-scoped-quality`.
- Draft PR: **#4 — Stage 4: change-scoped quality automation**.

## Відомі відкриті задачі

- T05: глибше CSS-cascade cleanup після стабілізації automated browser coverage.
- T08: фактичне профілювання великої книги та фізичних/альтернативних браузерів.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.

## Поточний фокус

Довести PR #4 до фінального green CI і після перевірки використовувати change-scoped quality gate як стандартний merge-процес.
