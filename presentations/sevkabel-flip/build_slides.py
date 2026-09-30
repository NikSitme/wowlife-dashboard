import json, os, datetime
ROOT=os.path.dirname(os.path.abspath(__file__))
# ---- tokens from DESIGN.md ----
INK='#17212B'; PAPER='#F4F1EA'; DEEP='#E9E3D6'; VAR='#56606B'; RULE='#CFC7B8'
BRICK='#A5462C'; HARBOR='#1F6E99'; NMUTED='#A9B4BF'; BRICK_D='#D9745A'; HARBOR_D='#4F9ACB'
HEAT=['#F1E1D8','#E3BBA9','#C98367','#A5462C','#6E2A18']; HEAT_TXT=[INK,INK,INK,PAPER,PAPER]
SERIF="'Playfair Display', Georgia, serif"; SANS="'Manrope', Arial, sans-serif"
TOTAL=15
def sec(id, bg, fg, inner, notes, section_attr='', layout='display:flex;flex-direction:column;gap:48px', trans='fade'):
    return f'<section id="{id}" data-transition="{trans}" style="background:{bg};color:{fg};font-family:{SANS};font-variant-numeric:tabular-nums;padding:128px 128px 160px;{layout}">\n{inner}\n<aside>{notes}</aside>\n</section>\n'
def footer(n, src='', dark=False):
    c = NMUTED if dark else VAR
    s = f'<p style="position:absolute;left:128px;bottom:64px;width:200px;font-size:24px;color:{c};font-variant-numeric:tabular-nums">{n:02d} / {TOTAL}</p>'
    if src:
        s += f'\n<p style="position:absolute;right:128px;bottom:64px;width:1300px;font-size:24px;color:{c};text-align:right">{src}</p>'
    return s
def head(eyebrow, title, dark=False):
    ec = BRICK_D if dark else BRICK; tc = PAPER if dark else INK
    return (f'<div style="display:flex;flex-direction:column;gap:16px">'
            f'<p style="font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{ec}">{eyebrow}</p>'
            f'<h2 style="font-family:{SERIF};font-size:64px;font-weight:600;line-height:1.1;letter-spacing:-0.01em;color:{tc};">{title}</h2></div>')
def figure(num, unit, caption, color=INK, capc=VAR, size=120):
    return (f'<div style="flex:1;display:flex;flex-direction:column;gap:12px;border-top:2px solid {RULE};padding:32px 0px 0px 0px">'
            f'<p style="font-size:{size}px;font-weight:700;line-height:1;letter-spacing:-0.03em;color:{color};font-variant-numeric:tabular-nums;white-space:nowrap">{num}</p>'
            f'<p style="font-size:30px;font-weight:600;color:{color}">{unit}</p>'
            f'<p style="font-size:24px;line-height:1.35;color:{capc}">{caption}</p></div>')
S={}
SRC_LEG='Источники: novostroy.su, novostroy-spb.ru, obzor78.ru — данные май–июнь 2026'
# 1 cover
S['cover']=sec('cover',INK,PAPER,f'''<p style="font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{BRICK_D}">Инвестиционное предложение · Санкт-Петербург · 2026</p>
<div style="display:flex;flex-direction:column;gap:32px">
<h1 style="font-family:{SERIF};font-size:120px;font-weight:600;line-height:1.05;letter-spacing:-0.02em;color:{PAPER}">Флиппинг «трёшки»<br>у Севкабель Порта</h1>
<p style="font-size:30px;line-height:1.45;color:{NMUTED};width:1100px">Покупаем 3-комнатную квартиру без ремонта на Васильевском острове, делаем качественный бюджетный ремонт с меблировкой и продаём за 4 месяца</p>
</div>
<div style="display:flex;gap:32px">
<div style="flex:1;display:flex;flex-direction:column;gap:8px;border-top:2px solid {VAR};padding:24px 0px 0px 0px"><p style="font-size:64px;font-weight:700;letter-spacing:-0.02em;font-variant-numeric:tabular-nums">14,4 млн ₽</p><p style="font-size:24px;color:{NMUTED}">бюджет проекта</p></div>
<div style="flex:1;display:flex;flex-direction:column;gap:8px;border-top:2px solid {VAR};padding:24px 0px 0px 0px"><p style="font-size:64px;font-weight:700;letter-spacing:-0.02em;font-variant-numeric:tabular-nums">4 месяца</p><p style="font-size:24px;color:{NMUTED}">от покупки до продажи</p></div>
<div style="flex:1;display:flex;flex-direction:column;gap:8px;border-top:2px solid {BRICK_D};padding:24px 0px 0px 0px"><p style="font-size:64px;font-weight:700;letter-spacing:-0.02em;color:{BRICK_D};font-variant-numeric:tabular-nums">31,4%</p><p style="font-size:24px;color:{NMUTED}">годовых — доходность инвестора</p></div>
</div>''','Титул. Одна фраза: покупаем без ремонта, делаем ремонт, продаём за 4 месяца; инвестору — 31,4% годовых.',layout='display:flex;flex-direction:column;justify-content:space-between;gap:48px')
S['cover']=S['cover'].replace('\n<aside>', '\n'+footer(1,'Финансовая модель: расчёт команды проекта',dark=True)+'\n<aside>')
# 2 deal
S['deal']=sec('deal',PAPER,INK,head('Суть сделки','Сделка в одном слайде: 13,5 → 18,0 млн ₽ за 4 месяца')+f'''
<div style="display:flex;gap:32px">
{figure('13,5','млн ₽ · покупка','3-комнатная квартира без ремонта, Васильевский остров')}
{figure('0,9','млн ₽ · ремонт','Качественный бюджетный ремонт с меблировкой, 2 месяца')}
{figure('18,0','млн ₽ · продажа','Готовая к заезду квартира; срок экспозиции — 2 месяца')}
{figure('3,0','млн ₽ · чистая прибыль','После налога 13% с разницы цен покупки и продажи', color=BRICK)}
</div>
<div style="flex:1"></div>
<p style="font-size:40px;font-weight:700;line-height:1.3;width:1500px">Инвестору — <span style="color:{BRICK}">1,51 млн ₽</span> за 4 месяца: 10,5% на вложенный капитал, 31,4% в пересчёте на год.</p>
{footer(2,'Все суммы — из финансовой модели проекта')}''','Четыре числа. Прибыль делится 50/50 между инвестором и командой.')
# 3 location
def card(title, text, accent=INK):
    return (f'<div style="flex:1;display:flex;flex-direction:column;gap:20px;background:{PAPER};padding:40px;border-radius:6px;border-top:4px solid {accent}">'
            f'<h3 style="font-size:40px;font-weight:700;line-height:1.2;color:{INK}">{title}</h3>'
            f'<p style="font-size:30px;line-height:1.45;color:{VAR}">{text}</p></div>')
S['location']=sec('location',DEEP,INK,head('Локация','Васильевский остров: бывшая промзона Севкабеля становится премиальным районом')+f'''
<div style="display:flex;gap:32px">
{card('Севкабель Порт','Общественное пространство на набережной Финского залива в исторических корпусах завода: фестивали, рестораны, выход к воде.')}
{card('LEGENDA Васильевского','Премиальный квартал на бывшей территории завода «Севкабель»: 6 корпусов, около 1 900 квартир, сдача — 4 кв. 2027 – 1 кв. 2029.', BRICK)}
{card('Окно возможностей','Первые ключи в новостройке — не раньше конца 2027 года. До этого спрос на готовое жильё в районе закрывает только вторичный рынок.')}
</div>
{footer(3,SRC_LEG)}''','Район меняется: культурный кластер на воде и премиальный девелопер на соседнем участке.')
# 4 legenda
S['legenda']=sec('legenda',PAPER,INK,head('Соседний проект','ЖК LEGENDA Васильевского поднимает планку цен всего района')+f'''
<div style="display:flex;gap:32px">
{figure('430','тыс. ₽ за м²','Средняя цена в ЖК, май 2026')}
{figure('+25%','за полгода','Рост цен в ЖК по данным агрегаторов, 2026', color=BRICK)}
{figure('30,9','млн ₽ — минимум','Цена 3-комнатной квартиры в ЖК, июнь 2026 (до 47,2 млн ₽)')}
</div>
<div style="flex:1"></div>
<div style="display:flex;gap:24px;align-items:center;background:{DEEP};padding:32px 40px;border-radius:6px">
<p style="font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{BRICK};white-space:nowrap">Скоро</p>
<p style="font-size:30px;line-height:1.4">Старт продаж новой очереди — <b>[дата старта продаж]</b>. Каждый новый этап у премиального девелопера — новая ценовая планка и медиаповод для района.</p>
</div>
{footer(4,SRC_LEG)}''','Цены у соседа растут. Вход в новостройку для 3-комнатной — от 30,9 млн. Дату старта новой очереди уточнить у застройщика.')
# 5 gap chart
bars=[('Наш объект — покупка без ремонта',13.5,BRICK),('Наш объект — продажа с ремонтом',18.0,BRICK),('LEGENDA — 3-комнатная, минимум',30.9,HARBOR),('LEGENDA — 3-комнатная, максимум',47.2,HARBOR)]
PX=880/50
rows=''
for lab,v,c in bars:
    w=round(v*PX)
    val=f'{v:.1f}'.replace('.',',')+' млн ₽'
    rows+=(f'<div style="display:flex;align-items:center;gap:0px">'
           f'<p style="width:560px;font-size:30px;color:{INK}">{lab}</p>'
           f'<div style="display:flex;align-items:center;gap:20px;border-left:2px solid {VAR};padding:10px 0px 10px 0px">'
           f'<div style="width:{w}px;height:56px;background:{c};border-radius:0px 4px 4px 0px"></div>'
           f'<p style="font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap">{val}</p></div></div>')
legend=(f'<div style="display:flex;gap:48px;align-items:center">'
        f'<div style="display:flex;gap:12px;align-items:center"><div style="width:28px;height:28px;background:{BRICK};border-radius:4px"></div><p style="font-size:24px;color:{VAR}">Наш объект</p></div>'
        f'<div style="display:flex;gap:12px;align-items:center"><div style="width:28px;height:28px;background:{HARBOR};border-radius:4px"></div><p style="font-size:24px;color:{VAR}">Новостройка по соседству</p></div></div>')
S['gap']=sec('gap',PAPER,INK,head('Ценовой разрыв','Готовая «трёшка» у нас на 42% дешевле входа в новостройку по соседству')+f'''
{legend}
<div style="display:flex;flex-direction:column;gap:0px">{rows}</div>
<p style="font-size:30px;line-height:1.45;color:{VAR};width:1500px">Покупатель получает 3-комнатную квартиру в том же районе сразу, а не в 2027–2029 году, и за 18 млн вместо 30,9+ млн ₽.</p>
{footer(5,'Цены LEGENDA — данные агрегаторов новостроек, июнь 2026; наш объект — финмодель')}''','Главный аргумент ликвидности: разница с новостройкой почти вдвое.',layout='display:flex;flex-direction:column;gap:40px')
# 6 market
def num_item(n,text):
    return (f'<div style="display:flex;gap:24px;align-items:start;border-top:2px solid {RULE};padding:24px 0px 0px 0px">'
            f'<p style="font-size:40px;font-weight:700;color:{BRICK};width:56px;font-variant-numeric:tabular-nums">{n}</p>'
            f'<p style="font-size:30px;line-height:1.45;flex:1">{text}</p></div>')
S['market']=sec('market',DEEP,INK,head('Анализ рынка','В радиусе 20 минут пешком нет квартир с нормальным ремонтом за 18 млн ₽')+f'''
<div style="display:flex;gap:64px">
<div style="flex:1;display:flex;flex-direction:column;gap:24px">
{num_item(1,'Все квартиры в выборке — <b>без нормального ремонта</b>.')}
{num_item(2,'Даже за 20 млн ₽ продают квартиры со старым «бабушкинским» ремонтом.')}
{num_item(3,'Первые этажи не рассматриваем: продаются хуже и дешевле.')}
</div>
<div style="width:620px;display:flex;flex-direction:column;gap:20px;background:{PAPER};padding:40px;border-radius:6px;border-top:4px solid {BRICK}">
<p style="font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{BRICK}">Вывод</p>
<p style="font-size:30px;line-height:1.45">Квартира с качественным ремонтом за 18 млн ₽ станет лучшим предложением в локации — на 10% дешевле аналогов без ремонта.</p>
<p style="font-size:24px;line-height:1.4;color:{VAR}">Срок продажи — 2 месяца, заложен с запасом.</p>
</div>
</div>
<p style="font-size:24px;line-height:1.4;color:{VAR}">Выборка ЦИАН: 2–3-комнатные квартиры до 25 млн ₽, кирпичные и монолитные дома, не дальше 20 минут пешком от объекта · [число объявлений] · [дата выгрузки]</p>
{footer(6,'Источник: выборка объявлений ЦИАН')}''','Рынок вокруг — только без ремонта. Мы заходим в пустую нишу.')
# 7 object
def trow(k,v,bold=False):
    return f'<tr><td style="color:{VAR}">{k}</td><td style="text-align:right">{v}</td></tr>'
S['object']=sec('object',PAPER,INK,head('Объект','3-комнатная квартира без ремонта у Севкабель Порта')+f'''
<div style="display:flex;gap:64px;align-items:start">
<div style="flex:1;display:flex;flex-direction:column"><table style="font-size:30px;color:{INK};">
<tr><th style="width:55%;text-align:left;color:{VAR}">Параметр</th><th style="width:45%;text-align:right;color:{VAR}">Значение</th></tr>
{trow('Цена покупки','13 500 000 ₽',True)}
{trow('Состояние','без ремонта')}
{trow('Площадь','[__ м²]')}
{trow('Этаж','[__ из __], не первый')}
{trow('Дом','[тип, год постройки]')}
{trow('Цена за м² при покупке','[__ ₽]')}
</table></div>
<div style="width:560px;display:flex;flex-direction:column;gap:16px;background:{INK};padding:40px;border-radius:6px">
<p style="font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{BRICK_D}">Цель продажи</p>
<p style="font-size:64px;font-weight:700;letter-spacing:-0.02em;color:{PAPER};font-variant-numeric:tabular-nums;white-space:nowrap">18 000 000 ₽</p>
<p style="font-size:30px;line-height:1.45;color:{NMUTED}">После ремонта с меблировкой. Прирост стоимости — 4,5 млн ₽, или 33% к цене покупки.</p>
</div>
</div>
{footer(7,'Объявление: ЦИАН, spb.cian.ru/sale/flat/332631758')}''','Карточка объекта. Плейсхолдеры в квадратных скобках — заполнить из объявления.')
# 8 smeta
S['smeta']=sec('smeta',DEEP,INK,head('Смета','Качественный бюджетный ремонт с меблировкой — 900 тыс. ₽')+f'''
<div style="display:flex;gap:64px;align-items:start">
<div style="flex:1;display:flex;flex-direction:column"><table style="font-size:28px;color:{INK};">
<tr><th style="width:68%;text-align:left;color:{VAR}">Статья</th><th style="width:32%;text-align:right;color:{VAR}">Сумма, ₽</th></tr>
<tr><td>Демонтаж и черновые работы</td><td style="text-align:right">[__]</td></tr>
<tr><td>Электрика и сантехника</td><td style="text-align:right">[__]</td></tr>
<tr><td>Отделка: полы, стены, потолки</td><td style="text-align:right">[__]</td></tr>
<tr><td>Санузел: плитка и сантехника</td><td style="text-align:right">[__]</td></tr>
<tr><td>Кухня и техника</td><td style="text-align:right">[__]</td></tr>
<tr><td>Мебель и декор</td><td style="text-align:right">[__]</td></tr>
<tr><td>Резерв на непредвиденное</td><td style="text-align:right">[__]</td></tr>
<tr style="background:{PAPER}"><td>Итого</td><td style="text-align:right">900 000</td></tr>
</table></div>
<div style="width:520px;display:flex;flex-direction:column;gap:32px">
{figure('6,25%','от бюджета проекта','900 тыс. ₽ из 14,4 млн ₽ — ремонт даёт +4,5 млн ₽ к цене', size=64)}
{figure('2 мес.','срок ремонта','Включая меблировку — квартира продаётся «заезжай и живи»', size=64)}
</div>
</div>
{footer(8,'Смета команды проекта')}''','Разбивку сметы по статьям вставить из детальной сметы; итог 900 тыс. — из финмодели.')
# 9 waterfall
H=380; SC=H/18.0; BW=130; GAPX=56; X0=0
wf=[('Продажа',0,18.0,INK,'18,0'),('Покупка',4.5,18.0,VAR,'−13,5'),('Ремонт',3.6,4.5,VAR,'−0,9'),('Налог 13%',3.015,3.6,VAR,'−0,59'),('Прибыль',0,3.015,BRICK,'3,0')]
CH=H+140
pins=''
for i,(lab,lo,hi,c,val) in enumerate(wf):
    x=X0+i*(BW+GAPX); top=round(H-hi*SC)+60; h=max(4,round((hi-lo)*SC))
    rad='4px 4px 0px 0px' if lo==0 else '4px'
    pins+=f'<div style="position:absolute;left:{x}px;top:{top}px;width:{BW}px;height:{h}px;background:{c};border-radius:{rad}"></div>'
    pins+=f'<p style="position:absolute;left:{x-20}px;top:{top-48}px;width:{BW+40}px;font-size:30px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums;color:{INK}">{val}</p>'
    pins+=f'<p style="position:absolute;left:{x-20}px;top:{H+60+16}px;width:{BW+40}px;font-size:24px;text-align:center;color:{VAR}">{lab}</p>'
pins+=f'<div style="position:absolute;left:0px;top:{H+60}px;width:{5*BW+4*GAPX}px;height:2px;background:{VAR}"></div>'
wfw=5*BW+4*GAPX
S['waterfall']=sec('waterfall',PAPER,INK,head('Финансовая модель','Из 18 млн ₽ выручки 3 млн ₽ остаётся чистой прибылью')+f'''
<div style="display:flex;gap:96px;align-items:end">
<div style="position:relative;width:{wfw}px;height:{CH}px">{pins}</div>
<div style="flex:1;display:flex;flex-direction:column;gap:24px;padding:0px 0px 60px 0px">
<p style="font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{VAR}">Деление прибыли 50 / 50</p>
<div style="display:flex;gap:2px"><div style="flex:1;height:72px;background:{BRICK};border-radius:4px 0px 0px 4px"></div><div style="flex:1;height:72px;background:{HARBOR};border-radius:0px 4px 4px 0px"></div></div>
<div style="display:flex;gap:32px">
<div style="flex:1;display:flex;flex-direction:column;gap:6px"><p style="font-size:24px;color:{VAR}">Инвестор</p><p style="font-size:40px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap">1 507 500 ₽</p></div>
<div style="flex:1;display:flex;flex-direction:column;gap:6px"><p style="font-size:24px;color:{VAR}">Команда</p><p style="font-size:40px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap">1 507 500 ₽</p></div>
</div>
<p style="font-size:24px;line-height:1.4;color:{VAR}">Налог — 13% с разницы цены продажи и покупки: (18,0 − 13,5) × 13% = 585 000 ₽.</p>
</div>
</div>
{footer(9,'Млн ₽. Финансовая модель проекта')}''','Водопад: продажа минус покупка, ремонт и налог — 3,015 млн чистыми, делим пополам.',layout='display:flex;flex-direction:column;gap:32px')
# 10 returns
S['returns']=sec('returns',DEEP,INK,head('Доходность','Инвестор получает 10,5% за 4 месяца — 31,4% годовых')+f'''
<table style="font-size:30px;color:{INK};">
<tr><th style="width:40%;text-align:left;color:{VAR}">Показатель</th><th style="width:30%;text-align:right;color:{VAR}">Проект целиком</th><th style="width:30%;text-align:right;color:{BRICK}">Инвестор</th></tr>
<tr><td>Вложения</td><td style="text-align:right">14 400 000 ₽</td><td style="text-align:right">14 400 000 ₽</td></tr>
<tr><td>Чистая прибыль</td><td style="text-align:right">3 015 000 ₽</td><td style="text-align:right">1 507 500 ₽</td></tr>
<tr><td>Возврат через 4 месяца</td><td style="text-align:right">17 415 000 ₽</td><td style="text-align:right">15 907 500 ₽</td></tr>
<tr><td>ROI за срок проекта</td><td style="text-align:right">20,94%</td><td style="text-align:right">10,47%</td></tr>
<tr style="background:{PAPER}"><td>ROI в пересчёте на год</td><td style="text-align:right">62,81%</td><td style="text-align:right;color:{BRICK}">31,41%</td></tr>
</table>
<p style="font-size:30px;line-height:1.45;color:{VAR};width:1500px">Инвестор финансирует 100% бюджета — покупку и ремонт. Команда отвечает за поиск объекта, ремонт и продажу. Прибыль делится поровну.</p>
{footer(10,'ROI годовых = ROI за срок × 12 / 4 мес. Финансовая модель проекта')}''','Годовая доходность — простой пересчёт, без реинвестирования.')
# 11 timeline
MW=311
def gbar(label, start, length, color, txt):
    return (f'<div style="display:flex;align-items:center">'
            f'<p style="width:420px;font-size:30px">{label}</p>'
            f'<div style="position:relative;width:{4*MW}px;height:72px">'
            f'<div style="position:absolute;left:{round(start*MW)+2}px;top:0px;width:{round(length*MW)-4}px;height:72px;background:{color};border-radius:4px"></div>'
            f'<p style="position:absolute;left:{round(start*MW)+24}px;top:16px;width:{round(length*MW)-40}px;font-size:24px;font-weight:600;color:{PAPER}">{txt}</p>'
            f'</div></div>')
months=''.join(f'<p style="width:{MW}px;font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{VAR};border-left:2px solid {RULE};padding:0px 0px 0px 16px">Месяц {i}</p>' for i in range(1,5))
S['timeline']=sec('timeline',PAPER,INK,head('Сроки','4 месяца от покупки до возврата денег инвестору')+f'''
<div style="display:flex;flex-direction:column;gap:24px">
<div style="display:flex"><div style="width:420px"></div>{months}</div>
{gbar('Покупка', 0, 0.25, INK, '')}
{gbar('Ремонт и меблировка', 0, 2, BRICK, 'Ремонт с мебелью · 2 месяца')}
{gbar('Экспозиция и продажа', 2, 2, HARBOR, 'Продажа · 2 месяца')}
{gbar('Расчёт с инвестором', 3.75, 0.25, INK, '')}
</div>
<div style="flex:1"></div>
<p style="font-size:30px;line-height:1.45;color:{VAR};width:1500px">Срок продажи в 2 месяца заложен с запасом: сопоставимых предложений с ремонтом в локации нет. Сценарии с продажей за 6 и 8 месяцев — на следующем слайде.</p>
{footer(11,'Финансовая модель проекта')}''','Ремонт 2 месяца, продажа 2 месяца.')
# 12 sensitivity
import math
buy=13.5e6; inv=14.4e6
def roi(s,m):
    net=s-inv-(s-buy)*0.13; ip=net/2; return ip, ip/inv*12/m*100
def bin_(r):
    return 0 if r<10 else 1 if r<15 else 2 if r<20 else 3 if r<30 else 4
CW=300
hdr=(f'<div style="display:flex;gap:4px">'
     f'<p style="width:300px;font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{VAR}">Цена продажи</p>'
     f'<p style="width:340px;font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{VAR}">Прибыль инвестора</p>'
     + ''.join(f'<p style="width:{CW}px;font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{VAR};text-align:center">Срок {m} мес.</p>' for m in (4,6,8))+'</div>')
grid=''
for s in (16e6,17e6,18e6,19e6):
    ip,_=roi(s,4)
    cells=''
    for m in (4,6,8):
        _,r=roi(s,m); b=bin_(r)
        base = (s==18e6 and m==4)
        border=f'border:4px solid {INK};' if base else ''
        lab=f'{r:.1f}'.replace('.',',')+'%' + (' · база' if base else '')
        cells+=f'<div style="width:{CW}px;height:88px;background:{HEAT[b]};{border}border-radius:4px;display:flex;align-items:center;justify-content:center"><p style="font-size:30px;font-weight:700;color:{HEAT_TXT[b]};font-variant-numeric:tabular-nums">{lab}</p></div>'
    sb='700' if s==18e6 else '400'
    grid+=(f'<div style="display:flex;gap:4px;align-items:center">'
           f'<p style="width:300px;font-size:30px;font-weight:{sb};font-variant-numeric:tabular-nums">{s/1e6:.0f} млн ₽</p>'
           f'<p style="width:340px;font-size:30px;font-weight:{sb};font-variant-numeric:tabular-nums">{round(ip/1000):,} тыс. ₽</p>'.replace(',', ' ')
           + cells + '</div>')
leg=''.join(f'<div style="display:flex;gap:10px;align-items:center"><div style="width:28px;height:28px;background:{HEAT[i]};border-radius:4px"></div><p style="font-size:24px;color:{VAR}">{t}</p></div>' for i,t in enumerate(['до 10%','10–15%','15–20%','20–30%','30% и выше']))
S['sensitivity']=sec('sensitivity',PAPER,INK,head('Чувствительность','Даже при продаже за 16 млн ₽ и сроке 8 месяцев инвестор в плюсе')+f'''
<div style="display:flex;flex-direction:column;gap:12px">{hdr}{grid}</div>
<div style="display:flex;gap:32px;align-items:center"><p style="font-size:24px;color:{VAR}">Годовая доходность инвестора:</p>{leg}</div>
{footer(12,'Расчёт по формулам финмодели: налог 13% с разницы цен, прибыль 50/50')}''','Матрица: цена продажи × срок проекта. База обведена.',layout='display:flex;flex-direction:column;gap:40px')
# 13 breakeven statement
S['breakeven']=sec('breakeven',BRICK,PAPER,f'''<p style="font-size:24px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{PAPER}">Запас прочности</p>
<h2 style="font-family:{SERIF};font-size:120px;font-weight:600;line-height:1.05;letter-spacing:-0.02em;color:{PAPER}">Цена может упасть на 19% — и инвестор всё равно вернёт свои деньги</h2>
<p style="font-size:30px;line-height:1.45;color:{PAPER};width:1300px">Точка безубыточности для инвестора — продажа за 14,53 млн ₽ вместо 18,0 млн ₽. Это всего на 1 млн ₽ выше цены покупки квартиры без ремонта.</p>
{footer(13,'Расчёт: (14,4 млн − 13% × 13,5 млн) / 0,87 = 14,53 млн ₽').replace(VAR,PAPER)}''','Главный слайд для риск-профиля инвестора.',layout='display:flex;flex-direction:column;justify-content:space-between;gap:40px')
# 14 risks
def rrow(a,b,c):
    return f'<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>'
S['risks']=sec('risks',DEEP,INK,head('Риски','Риски и как мы их закрываем')+f'''
<table style="font-size:26px;line-height:1.35;color:{INK}">
<tr><th style="width:26%;text-align:left;color:{VAR}">Риск</th><th style="width:37%;text-align:left;color:{VAR}">Влияние на инвестора</th><th style="width:37%;text-align:left;color:{VAR}">Что делаем</th></tr>
{rrow('Продажа дольше плана','Срок 6 мес. — 20,9% годовых вместо 31,4%','Цена на 10% ниже аналогов без ремонта; готовность к заезду')}
{rrow('Цена продажи ниже','16 млн ₽ — прибыль 638 тыс. ₽ вместо 1,51 млн ₽','Запас до безубыточности — 19%')}
{rrow('Перерасход сметы','Каждые +100 тыс. ₽ — минус 50 тыс. ₽','Фиксированная смета, резерв внутри бюджета')}
{rrow('Налог по шкале 15%','Ставка 15% на доход свыше 2,4 млн ₽ — минус 21 тыс. ₽','Уточняем с бухгалтером до сделки')}
{rrow('Расходы вне модели','Комиссия агента, ЖКУ на 4 мес.: [__ ₽]','Добавить в модель до подписания')}
</table>
{footer(14,'Расчёты — по формулам финмодели')}''','Показываем риски сами — это повышает доверие.')
# 15 structure
def col(title, lines, color):
    lis=''.join(f'<li>{l}</li>' for l in lines)
    return (f'<div style="flex:1;display:flex;flex-direction:column;gap:20px;border-top:4px solid {color};padding:32px 0px 0px 0px">'
            f'<h3 style="font-size:40px;font-weight:700;color:{PAPER}">{title}</h3><ul style="font-size:30px;line-height:1.5;color:{PAPER}">{lis}</ul></div>')
S['structure']=sec('structure',INK,PAPER,head('Структура сделки','Инвестор даёт капитал, команда — результат',dark=True)+f'''
<div style="display:flex;gap:64px">
{col('Инвестор',['Вносит 14,4 млн ₽ — 100% бюджета','Получает вложения + 50% прибыли','Через 4 месяца: 15,9 млн ₽','Оформление прав: [договор / залог / собственность]'],BRICK_D)}
{col('Команда',['Нашла объект и провела анализ рынка','Ведёт ремонт, меблировку и продажу','Получает 50% прибыли — 1,51 млн ₽','Отчёт инвестору: [периодичность]'],HARBOR_D)}
</div>
<div style="flex:1"></div>
<p style="font-size:30px;line-height:1.45;color:{NMUTED}"><span style="color:{PAPER}"><b>Следующие шаги:</b></span> просмотр объекта и проверка документов → инвестиционный договор → сделка покупки → старт ремонта.</p>
{footer(15,'Контакты: [имя, телефон, Telegram]',dark=True)}''','Финал: роли сторон и следующий шаг.')
order=['cover','deal','location','legenda','gap','market','object','smeta','waterfall','returns','timeline','sensitivity','breakeven','risks','structure']
for k in order:
    open(f'{ROOT}/project/slides/{k}.html','w').write(S[k])
deck={"v":4,"createdOnFiles":{"v":1,"at":datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')},"lists":"css","title":"Флиппинг 3к у Севкабеля","order":order,"cover":"cover",
 "sections":{"s1":{"description":"Суть предложения","start":"cover"},"s2":{"description":"Локация и соседний ЖК LEGENDA","start":"location"},"s3":{"description":"Анализ рынка, объект и смета","start":"market"},"s4":{"description":"Финансовая модель, доходность и сроки","start":"waterfall"},"s5":{"description":"Чувствительность, риски и структура сделки","start":"sensitivity"}},
 "faces":{"playfair-display":{"family":"Playfair Display","href":"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap"},"manrope":{"family":"Manrope","href":"https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap"}},"designSystems":[]}
json.dump(deck,open(f'{ROOT}/project/deck.json','w'),ensure_ascii=False,indent=1)
print('ok', {k:len(S[k]) for k in order})
