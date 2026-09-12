# Поточний стан

Оновлено: **2026-09-12**. Етапи 1–5 завершені та злиті у `main`. Оновлення hierarchy ordering/tree animation з гілки `update_12` злиті у `main` squash-комітом `48120d5`.

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
- Дочірні вузли у hierarchy view відображаються нижче parent за `UNIT_HIERARCHY`, мають tree-branch і плавний expand/collapse з підтримкою `prefers-reduced-motion`.
- Статуси `active / hidden / archived` зберігаються лише локально; архівування не змінює Excel або normalized records.
- First-party resource revision у `main`: **34**.

## Поточна робоча зміна

- Гілка: `feature/detail-unit-breakdown`, створена від актуального `main`.
- Для деталей ГОЧ батьківський вузол з прямими дітьми отримує поденну таблицю з колонкою «Підрозділ»: спочатку власний рядок parent, далі тільки його безпосередні діти з `UNIT_HIERARCHY`.
- Глибші нащадки не підтягуються в таблицю автоматично.
- Батьківські та дочірні значення читаються окремими `aggregate(..., group)` викликами; дочірні рядки не сумуються в parent і не змінюють normalized records.
- Для leaf-вузла detail-таблиця лишається без hierarchy breakdown.
- Hierarchy breakdown використовує ті самі базові стилі клітинок, типографіку та розділювачі, що й звичайна detail-таблиця; дочірній рівень позначається лише відступом назви.
- Вертикальні проміжки у `#detail-dialog` між заголовком, вступом, summary/trend, поясненням і таблицею ущільнені без зміни розміру клітинок таблиці.
- `#detail-dialog > .sheet-heading` має локальний `margin-bottom: 10px` (`8px` на mobile), а перемикачі line/bar розташовані праворуч в одному горизонтальному блоці з `Тенденція + період`.
- Поточний browser test перевіряє direct children, компактний відступ заголовка detail-dialog і горизонтальне розташування trend controls.
- Для цієї гілки first-party resource revision: **38**.

## Відкритий технічний борг

- T05: глибше CSS-cascade cleanup.
- T08: profiling великої книги, Safari/Firefox і фізичних пристроїв.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.

## Поточний фокус

Перевірити detail breakdown для батьківського та leaf-вузла change-scoped browser test. Не змінювати `UNIT_HIERARCHY`, Excel schema, normalized records або aggregate math.