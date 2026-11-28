"""Independent CSV -> published aggregate reconciliation; never prints CRM rows."""
import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

crm_file, basket_file, published_file, before_file = map(Path, sys.argv[1:5])
data = json.loads(published_file.read_text())
before = json.loads(before_file.read_text())
start, end = data['coverageStart'], data['coverageEnd']
excluded = {'Активации(Завершенные)': 'activationExcluded', 'Спам': 'spamExcluded',
            'Дубль': 'duplicateStageExcluded', 'Партнеры': 'partnerExcluded'}
keys = ['leads', 'activationExcluded', 'spamExcluded', 'duplicateStageExcluded', 'partnerExcluded', 'crmLeads', 'baskets']
daily = defaultdict(Counter)
source_counts = {}
for name, path in [('crm', crm_file), ('baskets', basket_file)]:
    ids, outside = set(), Counter()
    with path.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle, delimiter=';', strict=True)
        assert 'ID' in reader.fieldnames and 'Дата создания' in reader.fieldnames
        for row in reader:
            key = row['ID'].strip()
            assert key.isdigit() and key not in ids, 'Missing or duplicate entity ID'
            ids.add(key)
            day = datetime.strptime(row['Дата создания'], '%d.%m.%Y %H:%M:%S').strftime('%Y-%m-%d')
            if day < start:
                outside['beforeCoverage'] += 1
            elif day > end:
                outside['afterCutoff'] += 1
            elif name == 'baskets':
                daily[day]['baskets'] += 1
                daily[day]['leads'] += 1
            else:
                assert row['Стадия']
                rule = excluded.get(row['Стадия'])
                if rule:
                    daily[day][rule] += 1
                else:
                    daily[day]['crmLeads'] += 1
                    daily[day]['leads'] += 1
    source_counts[name] = {'inputUnique': len(ids), **outside}

expected, totals = {}, Counter()
day = datetime.strptime(start, '%Y-%m-%d')
while day.strftime('%Y-%m-%d') <= end:
    label = day.strftime('%Y-%m-%d')
    counts = {key: daily[label][key] for key in keys}
    expected[label] = counts
    assert data['days'][label] == counts, f'Daily mismatch {label}'
    assert counts['leads'] == counts['crmLeads'] + counts['baskets']
    totals.update(counts)
    day += timedelta(days=1)
assert set(data['days']) == set(expected)
for key in keys:
    assert data['totals'][key] == totals[key], f'Total mismatch {key}'
for source, counts in source_counts.items():
    for key, value in counts.items():
        assert data['sources'][source][key] == value, f'Source mismatch {source}/{key}'
history_changes = [day for day, counts in before['days'].items() if data['days'].get(day) != counts]
new_days = {day: counts for day, counts in expected.items() if day > before['coverageEnd']}
november = {key: sum(c[key] for day, c in expected.items() if day.startswith('2026-11-')) for key in keys}
print(json.dumps({'passed': True, 'through': end, 'daysChecked': len(expected),
                  'sources': source_counts, 'historicalChangedDays': history_changes,
                  'newDays': new_days, 'november': november}, ensure_ascii=False, indent=2))
