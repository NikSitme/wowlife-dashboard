---
version: alpha
name: Sevkabel Flip — Investor Memorandum
description: Дизайн-система инвестиционной презентации флиппинг-проекта (3-комнатная квартира у Севкабель Порта, Васильевский остров, СПб).
colors:
  primary: "#17212B"
  on-primary: "#F4F1EA"
  primary-muted: "#A9B4BF"
  neutral: "#F4F1EA"
  surface-deep: "#E9E3D6"
  on-surface: "#17212B"
  on-surface-variant: "#56606B"
  rule: "#CFC7B8"
  tertiary: "#A5462C"
  on-tertiary: "#F4F1EA"
  tertiary-dark-mode: "#D9745A"
  secondary: "#1F6E99"
  on-secondary: "#F4F1EA"
  secondary-dark-mode: "#4F9ACB"
  heat-1: "#F1E1D8"
  heat-2: "#E3BBA9"
  heat-3: "#C98367"
  heat-4: "#A5462C"
  heat-5: "#6E2A18"
typography:
  display:
    fontFamily: Playfair Display
    fontSize: 120px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 64px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.01em
  figure-xl:
    fontFamily: Manrope
    fontSize: 120px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.03em
    fontFeature: '"tnum" 1'
  headline-md:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: '"tnum" 1'
  body-lg:
    fontFamily: Manrope
    fontSize: 30px
    fontWeight: 400
    lineHeight: 1.45
  label-caps:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.12em
rounded:
  none: 0px
  data: 4px
  card: 6px
spacing:
  unit: 8px
  margin: 128px
  footer: 64px
  gutter: 32px
  card-padding: 40px
components:
  slide-light:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.margin}"
  slide-deep:
    backgroundColor: "{colors.surface-deep}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.margin}"
  slide-night:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    padding: "{spacing.margin}"
  slide-night-caption:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-muted}"
    typography: "{typography.body-lg}"
  slide-statement:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.display}"
  eyebrow:
    textColor: "{colors.tertiary}"
    typography: "{typography.label-caps}"
  caption:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-lg}"
  kpi-card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    typography: "{typography.figure-xl}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  kpi-card-rule:
    backgroundColor: "{colors.rule}"
    size: 2px
  series-investor:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.data}"
  series-team:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.data}"
  series-investor-dark:
    backgroundColor: "{colors.tertiary-dark-mode}"
    textColor: "{colors.primary}"
  series-team-dark:
    backgroundColor: "{colors.secondary-dark-mode}"
    textColor: "{colors.primary}"
  heat-cell-low:
    backgroundColor: "{colors.heat-1}"
    textColor: "{colors.on-surface}"
  heat-cell-mid-low:
    backgroundColor: "{colors.heat-2}"
    textColor: "{colors.on-surface}"
  heat-cell-mid:
    backgroundColor: "{colors.heat-3}"
    textColor: "{colors.primary}"
  heat-cell-high:
    backgroundColor: "{colors.heat-4}"
    textColor: "{colors.on-tertiary}"
  heat-cell-top:
    backgroundColor: "{colors.heat-5}"
    textColor: "{colors.on-tertiary}"
---

# Sevkabel Flip — Investor Memorandum

## Overview

Инвестиционный меморандум петербургского бутик-девелопера, отпечатанный на плотной
кремовой бумаге и разложенный на столе частного банкира на Васильевском острове.
Это документ для одного читателя — частного инвестора, который решает, доверить ли
14,4 млн ₽ команде на четыре месяца. Он читает цифры, а не прилагательные.

Тон — спокойная уверенность финансовой газеты: одна мысль на слайд, большие
табличные цифры, источники под каждым фактом. Характер места приходит из двух
материалов района: красный кирпич корпусов завода «Севкабель» и ночной
гранитно-синий цвет Невы и Финского залива. Никакого «глянца» девелоперских
буклетов — это расчёт, а не реклама.

## Colors

Одна тёмная, одна светлая тональность и два акцента с разными ролями.

- **Primary — «Невская ночь»** {colors.primary}: весь текст на светлых слайдах, фон
  титульного и финального слайда. Никогда не чистый чёрный.
- **Neutral — «Бумага»** {colors.neutral}: основной фон. Тёплый, как мелованная
  бумага, никогда не чистый белый.
- **Surface deep — «Известняк»** {colors.surface-deep}: второй фон — для слайдов
  с аналитикой рынка и смет, чтобы разделить главы.
- **Tertiary — «Кирпич Севкабеля»** {colors.tertiary}: единственный акцент для
  текста (надзаголовки) и серия «инвестор» / «наш объект» в графиках. Один
  слайд-заявление целиком на кирпичном фоне — точка безубыточности.
- **Secondary — «Залив»** {colors.secondary}: только в данных — серия «команда» и
  «рынок/новостройка». Никогда не красит текст.
- **On-surface-variant** {colors.on-surface-variant}: подписи, источники, единицы.
- **Rule** {colors.rule}: волосяные линии таблиц и базовые линии графиков.
- **Heat 1–5**: последовательная шкала одного тона (кирпич, светлое → тёмное) для
  матрицы чувствительности. Пара «кирпич / залив» проверена валидатором
  палитр (CVD ΔE 16,5, контраст ≥ 3:1 к бумаге); тёмные варианты
  {colors.tertiary-dark-mode} и {colors.secondary-dark-mode} — для графиков на ночном фоне.

## Typography

- **Playfair Display** — голос Петербурга: заголовки слайдов и титул. Классицистский
  контраст штрихов, как на фасадах Васильевского. Только 600, только крупно.
- **Manrope** — всё остальное: текст, подписи, и особенно цифры. Цифры всегда
  табличные (`tnum`) и всегда Manrope 700 — финансовые данные не набираются
  антиквой.
- Шкала из пяти размеров: 120 / 64 / 40 / 30 / 24 px. Надзаголовок —
  {typography.label-caps} прописными в кирпичном цвете.
- Числа пишутся по-русски: пробел в разрядах, запятая в дробях, «млн ₽».

## Layout

Холст 1920×1080, поля 128 px, подвал — одна строка 24 px на 64 px от низа
(номер слайда слева, источник справа). Заголовок всегда в верхнем поле и никогда
не прыгает. Сетка на 8 px, промежуток между карточками 32 px. Графики и таблицы
занимают полную ширину колонки; текст — не шире 1100 px.

## Elevation & Depth

Плоско, как на печати. Иерархия — тоном фона (бумага → известняк → ночь) и
волосяными линиями {colors.rule}. Никаких теней, свечений и стекла.

## Shapes

Архитектурная строгость: карточки со скруглением 6 px, столбцы графиков —
4 px только на «конце данных», прижатые к базовой линии. Никаких кругов-декораций,
иконок ради иконок и фото-стоков.

## Components

- **KPI-карточка**: подпись label-caps сверху, число figure-xl, пояснение body-lg
  под ним. Карточки в ряд разделены линией rule, без заливки.
- **Графики**: горизонтальные столбцы для сравнения цен, «водопад» для
  прибыли, диаграмма Ганта для сроков, тепловая матрица для чувствительности.
  Прямые подписи значений у каждого столбца; зазор 2 px между соседними
  сегментами; легенда при ≥ 2 сериях; значение никогда не передаётся только цветом.
- **Таблицы**: без вертикальных линий, заголовок label-caps, цифры выровнены вправо.
- **Слайд-заявление**: одна фраза display на кирпичном фоне.

## Do's and Don'ts

- **Do** ставить источник и дату под каждым рыночным фактом.
- **Do** показывать и базовый, и стресс-сценарий — инвестор доверяет тому, кто
  показывает риски сам.
- **Do** оставлять видимые пустые плейсхолдеры `[ ]` там, где данных нет, вместо
  выдуманных цифр.
- **Don't** использовать градиенты, тени, стоковые фото интерьеров и 3D.
- **Don't** красить текст в «Залив»; синий живёт только в данных.
- **Don't** использовать зелёный/красный для «хорошо/плохо» — только тон и подпись.
- **Don't** больше одного кирпичного слайда-заявления на презентацию.
