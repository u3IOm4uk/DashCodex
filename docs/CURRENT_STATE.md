# Поточний стан

Оновлено: **2026-09-12**. Етапи 1–4 злиті у `main`. Етап 5 — **unit hierarchy & archive** — виконується у гілці `feature/unit-hierarchy-archive`, draft PR #5.

## Стабільний `main`

- Локальний статичний dashboard без backend; runtime не потребує npm/build-system.
- Excel validation виконується до parse; critical errors блокують імпорт, warnings лишають книгу доступною.
- `source.kind` відділений від filename.
- `aggregate()` використовує lazy indexes + bounded LRU cache без зміни числової семантики.
- `contour-view.js`, `contour-charts.js`, `contour-navigation.js` винесені окремо від основного orchestration.
- Legacy sidebar/donut DOM прибрані.
- Sticky-категорії зберігають compact/pinned стан при зміні категорії; переміщується контент під ними.
- Change-scoped GitHub Actions уже є merge gate: syntax/regression/browser checks запускаються лише за релевантним diff.
- Playwright scopes: `core`, `sticky`, `charts`, `bps`; resource revision перевіряється окремо.

## Етап 5 — робоча гілка

- Додано `js/contour-units.js` і `css/contour-units.css`.
- Каталог підрозділів будується з повного ГОЧ після `ContourData.parse()`.
- Ієрархія визначається за стабільним порядком рядків по датах: **угруповання → АК → підрозділ**.
- Якщо той самий підрозділ у джерелі потрапляє під різних батьків, parent не вигадується; вузол позначається як неоднозначний.
- Батьківські значення не обчислюються із дочірніх — у таблиці лишаються значення джерела, тому подвійного підсумовування немає.
- Батьківський рядок розгортає/згортає дочірні; окрема дія відкриває його деталі.
- Статуси: `active`, `hidden`, `archived`.
- Статуси зберігаються тільки в `localStorage` як UI-настройка; Excel і нормалізовані записи не змінюються.
- Архівовані підрозділи приховані за замовчуванням, але можуть бути показані через «Архів» і відкривати історичні деталі за період, у якому є записи.
- First-party resource revision у Stage 5: **31**.
- Додано окремий change-scoped browser test `tests/browser/units.spec.cjs`.

## Git/GitHub

- Канонічний репозиторій: `u3IOm4uk/DashCodex`.
- Базова гілка: `main`.
- Поточна гілка: `feature/unit-hierarchy-archive`.
- Draft PR: **#5 — Stage 5: unit hierarchy and archive**.
- Merge у `main` — лише після green CI та перевірки сценарію ієрархії/архіву.

## Відкритий технічний борг

- T05: глибше CSS-cascade cleanup.
- T08: profiling великої книги, Safari/Firefox і фізичних пристроїв.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.

## Поточний фокус

Завершити Stage 5: green change-scoped CI, browser review і синхронізація контрактів ієрархії/архіву. Не розширювати scope на нові аналітичні фічі до стабілізації цієї моделі.
