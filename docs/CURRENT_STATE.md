# Поточний стан

Оновлено: **2026-09-13**. Етапи 1–5, hierarchy ordering/tree animation, detail unit breakdown та інтерактивні графіки інтегровані у стабільний `main`; конструктор міжкатегорійного порівняння реалізується у feature-гілці.

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
- `contour-compare.js` додає окремий аналітичний конструктор поверх чинного `ContourData`: до 6 серій із різних категорій/розділів, включно з FPV та типами БпС, без зміни Excel schema або aggregate math.
- Конструктор має режими `Нормалізовано / Абсолютні`, `Лінія / Стовпчики`, ручний діапазон, 7/30 днів, копіювання періоду дашборда, вибір вузла `UNIT_HIERARCHY`, керовану легенду та поденну таблицю.
- Для нормалізації перше доступне ненульове значення серії = 100; `null` не перетворюється на 0. Фільтр підрозділу застосовується лише там, де джерело підтримує відповідну деталізацію.
- Модель конструктора завантажується ліниво з тієї самої книги та після локального імпорту повторно парситься тим самим `ContourData.parse()`; це окремий runtime-екземпляр без окремої семантики даних.
- На desktop кнопка `Порівняння` розташована праворуч у рядку перемикачів розділів. На mobile нижня панель містить `Огляд / Розділи / Порівняння`; кнопки `Період` і `Джерело` з нижньої панелі приховані.
- First-party resource revision: **44**.

## Відкритий технічний борг

- T05: глибше CSS-cascade cleanup.
- T08: profiling великої книги, Safari/Firefox і фізичних пристроїв.
- Acceptance policy книги лише з персоналом/БК не розширена.
- Одиниця територій не підтверджена; формули Excel не перераховуються.
- Після стабілізації конструктора можна прибрати повторний lazy parse через явний read-only runtime bridge з основного orchestration, якщо це буде виправдано профілюванням.

## Поточний фокус

Feature-гілка `feature/cross-category-comparison` містить першу версію конструктора порівняння. Перед інтеграцією перевірити syntax/resource revision, change-scoped browser scenarios та responsive layout; не змінювати `UNIT_HIERARCHY`, Excel schema, normalized records або aggregate math без прямої потреби задачі.

Базовий `main` перед початком цієї роботи: `4b1af2baa0360ec7d2a203cfb045a2d20c0e3a98`; його GitHub Actions `Change-scoped quality` завершився успішно.