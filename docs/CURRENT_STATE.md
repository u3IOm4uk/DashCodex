# Поточний стан

Оновлено: **2026-09-12**. Етапи 1–5 завершені та злиті у `main`. Stage 5 (unit hierarchy & archive) увійшов у `main` squash-комітом `73fae8d`.

## Стабільний `main`

- Локальний статичний dashboard без backend; runtime не потребує npm/build-system.
- Excel validation виконується до parse; critical errors блокують імпорт, warnings лишають книгу доступною.
- `source.kind` відділений від filename.
- `aggregate()` використовує lazy indexes + bounded LRU cache без зміни числової семантики.
- `contour-view.js`, `contour-charts.js`, `contour-navigation.js` винесені окремо від основного orchestration.
- Sticky-категорії зберігають compact/pinned стан при зміні категорії; переміщується контент під ними.
- Change-scoped GitHub Actions є merge gate: syntax/regression/browser checks запускаються лише за релевантним diff.
- Playwright scopes: `core`, `sticky`, `charts`, `bps`, `units`; resource revision перевіряється окремо.
- `contour-units.js` будує ієрархію **угруповання → АК → підрозділ** зі стабільного порядку рядків ГОЧ; неоднозначні зв’язки не вигадуються.
- Статуси `active / hidden / archived` зберігаються лише локально; архівування не змінює Excel або normalized records.
- First-party resource revision у `main`: **31**.

## Поточна робоча зміна

- Гілка: `fix/unit-hierarchy-row-actions`.
- У таблиці ієрархії окрема кнопка `+ / −` відповідає тільки за розгортання/згортання й розміщується у вирівняному слоті ліворуч від назви.
- Натискання назви угруповання/АК/підрозділу відкриває штатні деталі.
- Окрема дія `↗` у рядках ієрархії прибирається.
- Для цієї гілки first-party resource revision: **32**.

## Відкритий технічний борг

- T05: глибше CSS-cascade cleanup.
- T08: profiling великої книги, Safari/Firefox і фізичних пристроїв.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.

## Поточний фокус

Перевірити точкову UX-зміну hierarchy row actions change-scoped тестами. Не розширювати scope на аналітику, Excel або інші компоненти.