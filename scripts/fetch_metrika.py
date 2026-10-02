"""Сборщик Яндекс.Метрики для вкладки «Маркетинг» дашборда.

Запускается GitHub Actions раз в сутки. Токен берётся из переменной окружения METRIKA_TOKEN
(GitHub Secret) и никуда не записывается. Результат — data/metrika.json:
  days:   { "YYYY-MM-DD": {"visits": n, "users": n} }            — с 2024-01-01 по вчера
  months: { "YYYY-MM": {"visits": n, "users": n, "sources": {"<источник>": visits}} }
  goals:  { "<id>": {"name": "...", "months": {"YYYY-MM": conversions}} }  — цели счётчика, если есть
"""
import json, os, sys, urllib.parse, urllib.request, datetime as dt

COUNTER = os.environ.get("METRIKA_COUNTER", "32072156")
TOKEN = os.environ.get("METRIKA_TOKEN", "")
START = "2024-01-01"
OUT = "data/metrika.json"
if not TOKEN:
    print("METRIKA_TOKEN не задан — пропускаю", file=sys.stderr); sys.exit(0)

def api(path, params):
    url = "https://api-metrika.yandex.net" + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": "OAuth " + TOKEN})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))

def stat(params):
    base = {"ids": COUNTER, "date1": START, "date2": "yesterday", "accuracy": "full", "limit": 10000}
    base.update(params)
    out, offset = [], 1
    while True:
        base["offset"] = offset
        d = api("/stat/v1/data", base)
        out += d.get("data", [])
        if len(d.get("data", [])) < base["limit"]:
            return out
        offset += base["limit"]

result = {"generated_at": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"), "counter": COUNTER, "days": {}, "months": {}, "goals": {}}

for row in stat({"metrics": "ym:s:visits,ym:s:users", "dimensions": "ym:s:date", "sort": "ym:s:date"}):
    d = row["dimensions"][0]["name"]
    v, u = row["metrics"]
    result["days"][d] = {"visits": int(v), "users": int(u)}
    m = d[:7]
    mo = result["months"].setdefault(m, {"visits": 0, "users": 0, "sources": {}})
    mo["visits"] += int(v); mo["users"] += int(u)

# источники трафика по месяцам: последний значимый источник (поиск, реклама, переходы по ссылкам, прямые…)
for row in stat({"metrics": "ym:s:visits", "dimensions": "ym:s:month,ym:s:lastsignTrafficSource", "sort": "ym:s:month"}):
    m = row["dimensions"][0]["name"][:7]
    src = row["dimensions"][1]["name"] or "Не определено"
    mo = result["months"].setdefault(m, {"visits": 0, "users": 0, "sources": {}})
    mo["sources"][src] = mo["sources"].get(src, 0) + int(row["metrics"][0])

# utm_source по месяцам — отдельно, чтобы видеть блогеров и рекламные кампании
for row in stat({"metrics": "ym:s:visits", "dimensions": "ym:s:month,ym:s:UTMSource", "sort": "ym:s:month"}):
    m = row["dimensions"][0]["name"][:7]
    src = row["dimensions"][1]["name"]
    if not src: continue
    mo = result["months"].setdefault(m, {"visits": 0, "users": 0, "sources": {}})
    mo.setdefault("utm", {})[src] = mo.get("utm", {}).get(src, 0) + int(row["metrics"][0])

# цели счётчика: конверсии по месяцам
try:
    goals = api("/management/v1/counter/%s/goals" % COUNTER, {}).get("goals", [])
except Exception as e:
    goals = []; print("цели недоступны:", e, file=sys.stderr)
for g in goals[:20]:
    gid = str(g["id"])
    try:
        rows = stat({"metrics": "ym:s:goal%sreaches" % gid, "dimensions": "ym:s:month", "sort": "ym:s:month"})
    except Exception as e:
        print("цель", gid, "ошибка:", e, file=sys.stderr); continue
    result["goals"][gid] = {"name": g.get("name", gid), "months": {r["dimensions"][0]["name"][:7]: int(r["metrics"][0]) for r in rows}}

os.makedirs("data", exist_ok=True)
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("записано", OUT, "дней:", len(result["days"]), "месяцев:", len(result["months"]), "целей:", len(result["goals"]))
