"""Extract only the three required fields; raw CRM contacts never enter public data."""
import csv
import json
import sys
from datetime import datetime

with open(sys.argv[1], encoding="utf-8-sig", newline="") as source:
    reader = csv.reader(source, delimiter=";", strict=True)
    header = next(reader)
    columns = [header.index(name) for name in ("ID", "Стадия", "Дата создания")]
    records = [["ID", "Стадия", "Дата создания"]]
    for row in reader:
        if not row:
            continue
        if len(row) != len(header) or not row[0].strip().isdigit():
            raise ValueError("CRM record has an invalid ID or column count")
        record = [row[i].strip() for i in columns]
        datetime.strptime(record[2], "%d.%m.%Y %H:%M:%S")
        if not record[1]:
            raise ValueError("CRM record has no stage")
        records.append(record)
json.dump({"rows": records, "columns": len(header)}, sys.stdout, ensure_ascii=False)
