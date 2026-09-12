# Поточний стан

Оновлено: **2026-09-12**. Етапи 1–5 завершені та злиті у `main`. Explicit hierarchy config та hierarchy row actions увійшли у `main`; останній користувацький commit `actual units` — `4263c4d`.

## Стабільний `main`

- Локальний статичний dashboard без backend; runtime не потребує npm/build-system.
- Excel validation виконується до parse; critical errors блокують імпорт, warnings лишають книгу доступною.
- `source.kind` відділений від filename.
- `aggregate()` використовує lazy indexes + bounded LRU cache без зміни числової семантики.
- `contour-view.js`, `contour-charts.js`, `contour-navigation.js` винесені окремо від основного orchestration.
- Sticky-категорії зберігають compact/pinned стан при зміні категорії; переміщується контент під ними.
- Change-scoped GitHub Actions є merge gate: syntax/regression/browser checks запускаються лише за релевантним diff.
- Playwright scopes: `core`, `sticky`, `charts`, `bps`, `units`; resource revision перевіряється окремо.
- `ContourConfig.UNIT_HIERARCHY` у `js/contour-config.js` є єдиним джерелом parent-зв’язків **угруповання → АК → підрозділ**; порядок Excel та naming heuristic не створюють зв’язків.
- `contour-units.js` відповідає за runtime-відображення дерева, expand/collapse, statuses та archive, але не визначає склад автоматично.
- Статуси `active / hidden / archived` зберігаються лише локально; архівування не змінює Excel або normalized records.
- First-party resource revision у `main`: **33**.

## Поточна робоча зміна

- Гілка: `update_12`, створена від `main` commit `4263c4d`.
- Рядки ГОЧ у hierarchy view перебудовуються за pre-order `UNIT_HIERARCHY`, тому підпорядковані вузли завжди відображаються нижче свого parent незалежно від порядку рядків Excel.
- Видимі дочірні рядки мають tree-branch із вертикальними та горизонтальними сегментами відповідно до фактичної вкладеності конфігу.
- `+ / −` лишається у вирівняному окремому слоті; назва відкриває штатні деталі.
- Expand/collapse дочірніх рядків має плавний fade/slide, а `prefers-reduced-motion` вимикає JS-анімацію.
- Видимі рядки перенумеровуються після hierarchy reorder/visibility changes; `data-row` та прив’язка деталей не змінюються.
- Для цієї гілки first-party resource revision: **34**.

## Відкритий технічний борг

- T05: глибше CSS-cascade cleanup.
- T08: profiling великої книги, Safari/Firefox і фізичних пристроїв.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.

## Поточний фокус

Перевірити hierarchy ordering, tree branch та expand/collapse animation на desktop/browser scenario. Не змінювати `UNIT_HIERARCHY`, Excel, aggregate math або інші компоненти поза цією UX-зміною.