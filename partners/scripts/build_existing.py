#!/usr/bin/env python3
"""Пересобирает existing_partners.csv и exclude_names.txt из данных дашборда (../index.html, блок ws-dashboard-data-partners).
Запускать после каждого обновления index.html:  python3 scripts/build_existing.py"""
import collections, csv, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, "..", "index.html"), encoding="utf-8").read()
m = re.search(r'<script id="ws-dashboard-data-partners" type="application/json">(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
CATS = [
 ("Спа/массаж/баня", r"thai|тай|spa|спа|shanti|благодар|бан[иья]|alpine|массаж|аюрвед|тепло по телу"),
 ("Флоатинг", r"флоатинг|float"),
 ("Мото/квадро/багги/снегоход", r"moto|мото|квадр|kvad|quad|снегоход|питбайк|surron|вездеход|kvadrotinger|neko"),
 ("Авто/дрифт/картинг/гонки", r"karting|картинг|drift|заноса|autodrom|race x|laptime|москвич|tesla|ev77|metaracing|lucky drive|контравар|автодром|primo|vegas"),
 ("Полёты/парашют/аэротруба/шар", r"fly|летим|летать|леты|аэро|параплан|парагуру|paragu|небо|прыж|cessna|авиа|шар|born2|энергия высоты|freezone|sky stream|мое небо|небесная|крыши|на высоте|prosto leti|vzletim|magicflight|мос-шарик|неботут|паралёт|досааф|путилово|углово"),
 ("Вода: яхты/катера/сап/сёрф/вейк/дайв", r"boat|катер|яхт|сап|sup|surf|сёрф|серф|wake|вейк|foil|dive|дайв|рыб|fishing|kayak|каяк|ладог|гавань|marine|волн|ветер|nekol|island|river|ривер|нева|smart|fiart|chapparal|tiffany|astramarine|bbq|моржев|плав|бассейн|горская|невский|первые линии"),
 ("Стрельба/тир/лук/фехтование/танк", r"стрел|тир|shoot|оруж|лук|fencing|танк|бтр|клад"),
 ("Конные/фермы/животные", r"кон|horse|кск|ферм|олен|бэмби|хаски|енот|альпак|зоо|океанариум"),
 ("Глэмпинг/загород/отели", r"глемп|глэмп|glamp|camp|кемп|отдых|усадьб|коттедж|отель|hotel|загород|хутор|избушк|village|ёлки|club|hippy|хоббит|аккала|tree|кивиниеми|norway|sun park|the park|villy"),
 ("Гончарка/творческие МК", r"гончар|керам|cerami|artista|артиста|art|арт|мастерск|handy|craft|швей|сошью|zuart|рису|украшен|rings|floral|флорист|diy|magichands|пряничн|свеч|карла|гутарн|graffin|lab of|figaro|цветомания|olfactory|главстудия|фигурный"),
 ("Кулинария/гастро/рестораны", r"кулинар|ресторан|кухн|italian|italica|nobel|ginza|amici|tao|rurik|bazar|лига бар|wine|cider|сидр|джелато|cookies|molecular|sushi|jean vallon|шоколад|хмечно|art du gout|чай|китчай|чае|osteria|kramer"),
 ("Фото/студии автопортрета", r"фото|photo|vkadre|reflect|селфи|mirror|сам снимай|aqua"),
 ("VR/квесты/игры/развлечения", r"vr|квест|игра|game|quiz|квиз|laser|лазер|matrix|адаптац|шоу|show|бильярд|боулинг|батут|каток|skate|padel|падел|tennis|теннис|сквош|ballers|rc club|улей|пальмира|space|pitpiter|double ride|rooms|twix|romantic|chain|lime stone|big foot|shonx|snow sport|наутилус|iris|айрис"),
 ("Экскурсии/музеи/театр/концерты", r"экскурс|тур\b|tour|travel|тревел|петербург|музе|театр|кино|концерт|планетар|lego|retro|песок|музык|слушай|свечах|ochey|follow|пешеход|город|вокруг света|скан|land|истори|с аней|double bus|ивент|eco-rent|dz putilovo|всмоле|rapt|adrionov|el capitan"),
 ("Здоровье/йога/растяжка/танцы/голос", r"йог|yoga|stretch|растяж|barre|shape|face|тренер|дом голоса|sp music|актёр|раскрепощ|искусство быть|яесмь|море внутри|журавл|шверт|dvinina|танц|impro|стилист|lookbox|makeup|rewax|brooms|аштанга|ломай|стихии|бореалис|zavodov|fresh|сенсориум|карибия|аквапарк|jet|роупджамп|ecos"),
]
INACTIVE = re.compile(r"не работа|не сотрудн|закрыл|не записываем|не актуальн|неактуальн|скрыты|выключены|временно|старым сертификат|исключительн|более не|ПартнерТест|Партнёр не указан|Номинальный|^Наборы|Доплата|Feedback|Частное лицо|ИП Викторов|Heattehnik|Виталий", re.I)
def cat(n):
    n = n.lower()
    for c, rx in CATS:
        if re.search(rx, n): return c
    return "Прочее"
g = collections.defaultdict(lambda: {"revenue": 0, "activations": 0, "cities": set(), "first": None, "last": None})
for r in data["rows"]:
    x = g[r["group"]]; x["revenue"] += r["revenue"]; x["activations"] += r["count"]; x["cities"].add(r["city"])
    x["first"] = min(x["first"] or r["date"], r["date"]); x["last"] = max(x["last"] or r["date"], r["date"])
rows = []
for name, x in g.items():
    status = "inactive" if INACTIVE.search(name) else ("stale" if x["last"] < "2026-03-01" else "active")
    clean = re.split(r"\s+[\-–—]\s+|\s*\(", name)[0].strip()
    rows.append(dict(partner=name, name_clean=clean, status=status, category=cat(name),
                     cities=";".join(sorted(c for c in x["cities"] if c != "Не определён")),
                     revenue=round(x["revenue"]), activations=x["activations"], first_activation=x["first"], last_activation=x["last"]))
rows.sort(key=lambda r: -r["revenue"])
with open(os.path.join(ROOT, "existing_partners.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
names = set(r["name_clean"] for r in rows if r["name_clean"])
extra = os.path.join(ROOT, "extra_partners.txt")   # партнёры из других источников (таблица Никиты и т.п.)
if os.path.exists(extra):
    for line in open(extra, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"):
            names.add(re.split(r"\s+[\-–—]\s+", line)[0].strip())
open(os.path.join(ROOT, "exclude_names.txt"), "w", encoding="utf-8").write("\n".join(sorted(names)) + "\n")
print(f"generated_at={data['generated_at']} partners={len(rows)} " + str(collections.Counter(r['status'] for r in rows)))
