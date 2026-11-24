"""Join the supplied basket population to immutable creation dates by deal ID.

The stdout stream is private build input. Only aggregate counts enter public JSON.
No payment date, status, contact or product-line filter changes the population.
"""
import csv
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path


def rows(path):
    with open(path, encoding="utf-8-sig", newline="") as source:
        reader = csv.reader(source, delimiter=";", strict=True)
        header = next(reader)
        for row in reader:
            if not row:
                continue
            if len(row) != len(header):
                raise ValueError("Basket CSV has an invalid column count")
            yield header, row


population = set()
duplicates = 0
for header, row in rows(sys.argv[1]):
    key = row[header.index("ID")].strip()
    if not key.isdigit():
        raise ValueError("Basket CSV has an invalid deal ID")
    if key in population:
        duplicates += 1
    population.add(key)

dates = {}
matched = []
for path in sys.argv[2:]:
    matches = 0
    unique_matches = set()
    for header, row in rows(path):
        key = row[header.index("ID")].strip()
        if key not in population:
            continue
        value = row[header.index("Дата создания")].strip()
        datetime.strptime(value, "%d.%m.%Y %H:%M:%S")
        if key in dates and dates[key] != value:
            raise ValueError("Conflicting creation timestamps for the same deal ID")
        dates[key] = value
        unique_matches.add(key)
        matches += 1
    matched.append({"file": Path(path).name, "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(), "matchedRows": matches, "matchedUnique": len(unique_matches)})

missing = len(population - dates.keys())
if missing:
    raise ValueError(f"Creation dates missing for {missing} basket IDs; publication refused")
json.dump({"rows": [["ID", "Дата создания"]] + [[key, dates[key]] for key in sorted(population, key=int)], "populationDuplicates": duplicates, "dateSources": matched}, sys.stdout, ensure_ascii=False)
