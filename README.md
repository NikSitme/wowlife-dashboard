# WOWlife dashboard

[GitHub Pages](https://niksitme.github.io/wowlife-dashboard/)

Помeсячный P&L, ФОТ и финмодель читают CSV актуального листа «сборка ОПиУ_2» (gid 1095006698) основной выгрузки Адеска. Автоматическое обновление — при открытии страницы, ручное — кнопка «Обновить данные». Кэш прежнего источника не применяется.

Нижний P&L по умолчанию сохраняет строки, знаки и итоги Адеска; отдельный управленческий вид и карточки используют принятые корректировки. Источник, время получения и предупреждения отображаются рядом с таблицей. Формулы и источники описаны во встроенной документации.

Проверка источника: `node scripts/test-opiu-source.cjs [path/to/current-source.csv]`. Регрессионные проверки: `node scripts/test-opiu-calendar.cjs`, `node scripts/test-marketplace-history.cjs`, `node scripts/test-sales-analytics.cjs`, `node scripts/test-revenue-dynamics.cjs`.
