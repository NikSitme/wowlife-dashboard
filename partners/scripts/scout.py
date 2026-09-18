#!/usr/bin/env python3
"""
WOWlife partner scout — поиск потенциальных партнёров по стратегиям.

Команды:
  search   — прогнать стратегии по Яндекс Картам (Geosearch API) и/или 2ГИС (Places API),
             отбросить текущих партнёров, сохранить кандидатов в candidates/maps_<strategy>.json
  merge    — собрать все candidates/*.json в candidates/all.json + all.csv (с проверкой исключений)
  check    — проверить список названий на совпадение с текущими партнёрами

Примеры:
  export YANDEX_GEOSEARCH_KEY=...   # https://developer.tech.yandex.ru/ → «Поиск по организациям»
  export DGIS_KEY=...               # https://dev.2gis.ru/ → Places API (даёт рейтинг и число отзывов)
  python3 scripts/scout.py search --strategy relax --city msk
  python3 scripts/scout.py search --group A            # все стратегии группы A, оба города
  python3 scripts/scout.py merge
  python3 scripts/scout.py check "Банный клуб X" "Термы Y"

Ограничения: Яндекс Geosearch API отдаёт название/адрес/сайт/телефон/рубрики, но НЕ рейтинг.
Рейтинг и число отзывов подтягиваются из 2ГИС (если задан DGIS_KEY) — как прокси качества.
Точный рейтинг Яндекс Карт затем проверяется вручную по ссылке yandex_maps_url в кандидате.
"""
import argparse, csv, datetime, difflib, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRATEGIES = os.path.join(ROOT, "strategies.json")
EXCLUDE = os.path.join(ROOT, "exclude_names.txt")
CAND_DIR = os.path.join(ROOT, "candidates")

TRANSLIT = {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i","й":"i","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"c","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"}
# служебные и родовые слова: не участвуют в сравнении названий
STOP = {"ооо","ип","клуб","студия","школа","центр","компания","club","studio","school","the","спб","мск","москва","санкт","петербург",
        "spb","msk","moscow","и","and","&","ресторан","restaurant","стрелковый","гончарная","гончарный","парусная","парусный","конный",
        "кск","глэмпинг","глемпинг","glamping","флоатинг","floating","аэротруба","картинг","karting","катер","яхт","фотостудия","отель",
        "hotel","база","отдыха","загородный","спа","spa","парк","park","тур","tour","travel","тревел","мастерская","арт","art","прокат",
        "аренда","комплекс","кулинарная","кулинарный","организация","surf","сёрф","серф","серфинг","wake","вейк","академия","лаборатория","lab","пространство","салон","бар","bar","кафе","cafe","россия","russia","official"}

STATUS_RX = re.compile(r"(не работа\w*|не сотрудн\w*|закрыл\w*|не записыва\w*|неактуальн\w*|не актуальн\w*|временно|выключ\w+ на сайте|"
                       r"работа\w* (только )?по старым сертификатам|карточк\w+ скрыт\w+|более не работа\w*|записыва\w+ в исключительн\w+ случа\w+).*$")

def norm(name: str) -> str:
    s = name.lower().replace("ё", "е")
    s = re.sub(r"[\(\[].*?[\)\]]", " ", s)          # скобки
    s = re.split(r"\s[-–—]\s", s)[0]                  # « - не работаем»
    s = STATUS_RX.sub(" ", s)                          # статусные пометки без дефиса
    s = re.sub(r"[^a-zа-я0-9 ]+", " ", s)
    alltoks = [t for t in s.split() if len(t) > 1 or t.isascii() and t.isalpha()]
    toks = [t for t in alltoks if t not in STOP]
    if not toks:                                        # название целиком из «родовых» слов (Surf Club, Гончарная студия №1)
        toks = alltoks
    toks = ["".join(TRANSLIT.get(ch, ch) for ch in t) for t in toks]
    return " ".join(sorted(toks))

ALIASES = os.path.join(ROOT, "aliases.txt")

def load_exclude():
    with open(EXCLUDE, encoding="utf-8") as f:
        names = [l.strip() for l in f if l.strip()]
    ex = {norm(n): n for n in names if norm(n)}
    if os.path.exists(ALIASES):
        for line in open(ALIASES, encoding="utf-8"):
            if "=>" in line and not line.startswith("#"):
                alias, target = (x.strip() for x in line.split("=>", 1))
                if norm(alias):
                    ex[norm(alias)] = target
    return ex

def _tokset(n):
    return set(n.split())

def is_excluded(name, ex):
    n = norm(name)
    if not n:
        return None
    if n in ex:
        return ex[n]
    nt = _tokset(n)
    for k, orig in ex.items():
        kt = _tokset(k)
        if len(k) >= 7 and len(n) >= 7 and len(kt) >= 2 and len(nt) >= 2 and (f" {k} " in f" {n} " or f" {n} " in f" {k} "):
            return orig
        if nt and kt and (nt == kt or (len(nt & kt) >= 2 and len(nt & kt) / len(nt | kt) >= 0.6)):
            return orig
        if difflib.SequenceMatcher(None, n, k).ratio() >= 0.88:
            return orig
    return None

def maybe_excluded(name, ex):
    """слабое сходство (для ручной проверки), когда строгое совпадение не найдено"""
    n = norm(name); nt = _tokset(n)
    best = None
    for k, orig in ex.items():
        kt = _tokset(k)
        r = difflib.SequenceMatcher(None, n, k).ratio()
        if (nt & kt and len(nt & kt) / len(nt | kt) >= 0.4) or r >= 0.75:
            best = orig if best is None else best
    return best

def http_json(url, retries=3):
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "wowlife-scout/1.0"}), timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa
            if i == retries - 1:
                print(f"  ! {e} — {url[:120]}", file=sys.stderr)
                return None
            time.sleep(2 * (i + 1))

def yandex_search(text, city, key, results=50):
    """Yandex Geosearch API: https://yandex.ru/dev/geosearch/doc/ru/"""
    q = urllib.parse.urlencode({"apikey": key, "text": f"{text}, {city['name']}", "lang": "ru_RU", "type": "biz",
                                "ll": city["ll"], "spn": city["spn"], "rspn": 1, "results": results})
    data = http_json(f"https://search-maps.yandex.ru/v1/?{q}")
    out = []
    for f in (data or {}).get("features", []):
        p = f.get("properties", {}); meta = p.get("CompanyMetaData", {})
        if not meta:
            continue
        lon, lat = f.get("geometry", {}).get("coordinates", [None, None])
        out.append({
            "name": meta.get("name"), "address": meta.get("address"), "website": meta.get("url"),
            "phone": (meta.get("Phones") or [{}])[0].get("formatted"),
            "categories": [c.get("name") for c in meta.get("Categories", [])],
            "hours": (meta.get("Hours") or {}).get("text"),
            "yandex_id": meta.get("id"),
            "yandex_maps_url": f"https://yandex.ru/maps/org/{meta.get('id')}" if meta.get("id") else None,
            "lat": lat, "lon": lon,
        })
    return out

def dgis_search(text, city, key, page_size=10):
    """2GIS Places API: https://docs.2gis.com/ru/api/search/places/overview — даёт рейтинг и отзывы."""
    lon, lat = city["ll"].split(",")
    q = urllib.parse.urlencode({"q": f"{text}", "key": key, "point": f"{lon},{lat}", "radius": 40000,
                                "page_size": page_size, "locale": "ru_RU",
                                "fields": "items.reviews,items.point,items.contact_groups,items.rubrics,items.address_name,items.schedule"})
    data = http_json(f"https://catalog.api.2gis.com/3.0/items?{q}")
    out = []
    for it in ((data or {}).get("result") or {}).get("items", []):
        rv = it.get("reviews") or {}
        site = None
        for g in it.get("contact_groups", []) or []:
            for c in g.get("contacts", []):
                if c.get("type") == "website":
                    site = c.get("url") or c.get("value")
        out.append({"name": it.get("name"), "address": it.get("address_name"),
                    "website": site, "rating": rv.get("general_rating"), "reviews": rv.get("general_review_count"),
                    "categories": [r.get("name") for r in it.get("rubrics", [])],
                    "dgis_id": it.get("id"), "dgis_url": f"https://2gis.ru/firm/{it.get('id')}" if it.get("id") else None})
    return out

def cmd_search(args):
    cfg = json.load(open(STRATEGIES, encoding="utf-8"))
    ykey, dkey = os.environ.get("YANDEX_GEOSEARCH_KEY"), os.environ.get("DGIS_KEY")
    if not ykey and not dkey:
        sys.exit("Нужен YANDEX_GEOSEARCH_KEY и/или DGIS_KEY в окружении")
    ex = load_exclude()
    cities = [args.city] if args.city else list(cfg["cities"])
    strategies = [s for s in cfg["strategies"] if (not args.strategy or s["id"] == args.strategy) and (not args.group or s["group"] == args.group)]
    minr, minv = cfg["quality"]["min_rating"], cfg["quality"]["min_reviews"]
    os.makedirs(CAND_DIR, exist_ok=True)
    today = datetime.date.today().isoformat()
    for s in strategies:
        found, seen = [], set()
        for ck in cities:
            city = cfg["cities"][ck]
            for q in s["queries"]:
                print(f"[{s['id']}] {city['name']}: {q}")
                rows = []
                if ykey:
                    rows += yandex_search(q, city, ykey, results=args.results)
                if dkey:
                    drows = dgis_search(q, city, dkey, page_size=min(args.results, 10))
                    # объединяем по нормализованному названию: рейтинг из 2ГИС дописываем к яндексовским
                    by = {norm(r["name"] or ""): r for r in drows}
                    for r in rows:
                        d = by.pop(norm(r["name"] or ""), None)
                        if d:
                            r.update({k: d[k] for k in ("rating", "reviews", "dgis_url") if d.get(k) is not None})
                    rows += list(by.values())
                for r in rows:
                    key = norm(r.get("name") or "")
                    if not key or key in seen:
                        continue
                    seen.add(key)
                    r.update({"city": city["name"], "strategy": s["id"], "query": q, "found_at": today,
                              "excluded_as": is_excluded(r["name"], ex)})
                    rating, reviews = r.get("rating"), r.get("reviews")
                    r["priority"] = ("A" if rating and reviews and rating >= minr and reviews >= minv
                                     else "B" if rating and rating >= minr else "C")
                    found.append(r)
                time.sleep(args.sleep)
        keep = [r for r in found if not r["excluded_as"]]
        dropped = len(found) - len(keep)
        path = os.path.join(CAND_DIR, f"maps_{s['id']}.json")
        json.dump(keep, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"  -> {path}: {len(keep)} кандидатов (исключено текущих партнёров: {dropped})")

def cmd_merge(args):
    ex = load_exclude()
    allrows, seen = [], {}
    for fn in sorted(os.listdir(CAND_DIR)):
        if not fn.endswith(".json") or fn == "all.json":
            continue
        try:
            rows = json.load(open(os.path.join(CAND_DIR, fn), encoding="utf-8"))
        except Exception as e:
            print(f"! {fn}: {e}", file=sys.stderr); continue
        for r in rows:
            if not isinstance(r, dict) or not r.get("name"):
                continue
            r.setdefault("source_file", fn)
            r["excluded_as"] = is_excluded(r["name"], ex)
            r["maybe_partner"] = None if r["excluded_as"] else maybe_excluded(r["name"], ex)
            key = (norm(r["name"]), (r.get("city") or "")[:3])
            if key in seen:  # объединяем дубли: дописываем стратегии
                prev = seen[key]
                st = set(str(prev.get("strategy", "")).split("|")) | {str(r.get("strategy", ""))}
                prev["strategy"] = "|".join(sorted(x for x in st if x))
                for k, v in r.items():
                    if prev.get(k) in (None, "", []) and v not in (None, "", []):
                        prev[k] = v
                continue
            seen[key] = r
            allrows.append(r)
    kept = [r for r in allrows if not r["excluded_as"]]
    order = {"A": 0, "B": 1, "C": 2}
    kept.sort(key=lambda r: (order.get(r.get("priority"), 3), -(r.get("rating") or 0), -(r.get("reviews") or 0)))
    json.dump(kept, open(os.path.join(CAND_DIR, "all.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    cols = ["priority", "name", "city", "strategy", "category", "rating", "reviews", "price_from", "website",
            "what", "why", "gift_cert_ready", "visual_score", "yandex_maps_query", "yandex_maps_url", "source", "confidence", "maybe_partner", "status", "comment"]
    with open(os.path.join(CAND_DIR, "all.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader()
        for r in kept:
            w.writerow({k: r.get(k, "") for k in cols})
    excl = [r for r in allrows if r["excluded_as"]]
    print(f"all.json/all.csv: {len(kept)} кандидатов; отброшено как текущие партнёры: {len(excl)}")
    for r in excl:
        print(f"  - {r['name']}  ≈  {r['excluded_as']}")
    mb = [r for r in kept if r.get("maybe_partner")]
    if mb:
        print(f"проверить вручную (похожи на партнёров): {len(mb)}")
        for r in mb:
            print(f"  ? {r['name']}  ~  {r['maybe_partner']}")

def cmd_check(args):
    ex = load_exclude()
    for n in args.names:
        hit = is_excluded(n, ex)
        print(f"{'ПАРТНЁР ' if hit else 'новый   '} {n}" + (f"  ≈ {hit}" if hit else ""))

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search"); s.add_argument("--strategy"); s.add_argument("--group"); s.add_argument("--city", choices=["msk", "spb"])
    s.add_argument("--results", type=int, default=25); s.add_argument("--sleep", type=float, default=0.3); s.set_defaults(fn=cmd_search)
    m = sub.add_parser("merge"); m.set_defaults(fn=cmd_merge)
    c = sub.add_parser("check"); c.add_argument("names", nargs="+"); c.set_defaults(fn=cmd_check)
    a = ap.parse_args(); a.fn(a)
