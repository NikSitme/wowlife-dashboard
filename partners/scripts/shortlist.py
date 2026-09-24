#!/usr/bin/env python3
"""Пересобирает shortlist.md (кандидаты приоритета A по стратегиям) из candidates/all.json. Запускать после merge."""
import collections, datetime, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, "candidates", "all.json"), encoding="utf-8"))
st = json.load(open(os.path.join(ROOT, "strategies.json"), encoding="utf-8"))
names = {s["id"]: s["name"] for s in st["strategies"]}
A = [r for r in d if r.get("priority") == "A"]
nB = sum(1 for r in d if r.get("priority") == "B"); nC = sum(1 for r in d if r.get("priority") == "C")
rated = sum(1 for r in d if r.get("rating"))
by = collections.defaultdict(list)
for r in A:
    by[str(r["strategy"]).split("|")[0]].append(r)
out = [f"# Шорт-лист: кандидаты приоритета A (обновлено {datetime.date.today():%d.%m.%Y})", "",
       f"Всего кандидатов: {len(d)} (A — {len(A)}, B — {nB}, C — {nC}); рейтинг подтверждён по сниппетам Яндекс Карт/2ГИС/Zoon у {rated}. "
       "Полный список — `candidates/all.csv`, просмотрщик с фильтрами по городу, стратегии и наборам — `index.html`.", "",
       "Приоритет A = подтверждённый рейтинг ≥4.7 при ≥50 отзывов, либо сильный бренд из подборок 2025–26 при отсутствии цифры. "
       "Кандидаты с подтверждённым рейтингом < 4.5 или закрывшиеся переведены в C. 🎁 — уже продают свои подарочные сертификаты. "
       "«Наборы» — в какие наборы сайта кандидат ложится.", ""]
for sid in [s["id"] for s in st["strategies"]]:
    rows = by.get(sid)
    if not rows:
        continue
    rows.sort(key=lambda r: (-(r.get("rating") or 0), -(r.get("reviews") or 0)))
    out += [f"## {names[sid]} ({len(rows)})", "", "| Кандидат | Город | Рейтинг | Цена от | Наборы | Что |", "|---|---|---|---|---|---|"]
    for r in rows:
        rt = (f"{r['rating']}" + (f" ({r['reviews']})" if r.get("reviews") else "")
              + (f" {r['rating_source']}" if r.get("rating_source") and r["rating_source"] != "yandex" else "")) if r.get("rating") else "—"
        pr = f"{r['price_from']:,}".replace(",", " ") + " ₽" if r.get("price_from") else "—"
        nm = (f"[{r['name']}]({r['website']})" if r.get("website") else r["name"]) + (" 🎁" if r.get("gift_cert_ready") else "")
        if r.get("social"):
            nm += f" · [соцсети]({r['social']})" + (f" {r['followers']}" if r.get("followers") else "")
        sets = ", ".join(x for x in (r.get("set_fit") or "").split(";") if x and x != "Универсальные")
        out.append(f"| {nm} | {r.get('city', '')} | {rt} | {pr} | {sets} | {(r.get('what') or '')[:100]} |")
    out.append("")
out += ["## Отсеяны после проверки рейтинга (были A/B, теперь C)", ""]
for r in sorted(d, key=lambda r: (r.get("rating") or 9)):
    if r.get("priority") == "C" and ((r.get("rating") is not None and r["rating"] < 4.5) or (r.get("note") and "закрыл" in r["note"].lower())):
        out.append(f"- {r['name']} ({r.get('city', '')}): {r.get('rating') or '—'}{' (' + str(r['reviews']) + ')' if r.get('reviews') else ''} "
                   f"{r.get('rating_source') or ''}{' — ' + r['note'] if r.get('note') else ''}")
open(os.path.join(ROOT, "shortlist.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print(f"shortlist.md: {len(d)} кандидатов, A={len(A)}")
