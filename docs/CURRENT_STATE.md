# Поточний стан

Оновлено: **2026-09-12**. Етапи 1–5, hierarchy ordering/tree animation та detail unit breakdown інтегровані у стабільний `main`.

## Поточна реалізація

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
- У detail-вікні ГОЧ батьківський вузол з прямими дітьми отримує поденну таблицю з колонкою «Підрозділ»: спочатку власний рядок parent, далі тільки його безпосередні діти з `UNIT_HIERARCHY`.
- Глибші нащадки у detail-таблицю автоматично не підтягуються; parent і direct children читаються окремими `aggregate(..., group)` викликами, без сумування дітей у parent і без зміни normalized records.
- Для leaf-вузла detail-таблиця лишається без hierarchy breakdown.
- Hierarchy breakdown використовує ті самі базові стилі клітинок, типографіку та розділювачі, що й звичайна detail-таблиця; дочірній рівень позначається лише відступом назви.
- `#detail-dialog` ущільнений: локальний `sheet-heading` має `margin-bottom: 10px` (`8px` на mobile), а line/bar перемикачі розташовані праворуч в одному горизонтальному блоці з `Тенденція + період` на desktop; на телефоні дата має окремий ряд.
- Browser test перевіряє direct children, компактний відступ заголовка detail-dialog і горизонтальне розташування trend controls.
- Hover мініграфіків категорій і БпС показує дату/показник/значення; нуль і пропуск розрізняються.
- Основний і модальні графіки мають незалежне вікно з колесом та пресетами 7/30 днів; підсумки, таблиці й CSV лишаються за обліковим фільтром.
- Легенда деталей БпС має круглі маркери та нейтральні підписи зі збереженням керування серіями й окремої шкали FPV.
- Compact-картки категорій звужені; на телефоні дата модального графіка переноситься в окремий ряд, щоб показувати період повністю.
- First-party resource revision: **41**.

## Відкритий технічний борг

- T05: глибше CSS-cascade cleanup.
- T08: profiling великої книги, Safari/Firefox і фізичних пристроїв.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.

## Поточний фокус

Зміни інтерактивних графіків підготовлені на основі `main` у робочій гілці; статус інтеграції перевіряти в GitHub. Перед наступною задачею отримати актуальну гілку; не змінювати `UNIT_HIERARCHY`, Excel schema, normalized records або aggregate math без прямої потреби задачі.

Перевірки цієї зміни: JS syntax і resource revision PASS; adapter regression PASS; 11 сценаріїв Playwright (core/sticky/charts/bps/units, включно з календарними межами) пройдені локально в Chrome. Візуально переглянуті viewport 1440×1000, 1024×768, 390×844 і 320×844: підказки, легенда/періоди деталей, compact-картки; page overflow 0. Це симуляція viewport, не перевірка фізичних пристроїв. Локально використано bundled Playwright і встановлений Chrome; GitHub CI перевіряється окремо.