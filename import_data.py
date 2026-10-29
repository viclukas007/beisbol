"""Transform the read-only Excel snapshot into the initial application seed."""
from pathlib import Path
import json
import re
import unicodedata
import hashlib

base = Path(__file__).parent
source = json.loads((base / 'workbook-source.json').read_text(encoding='utf-8'))
keys = ['jj', 'ab', 'hits', 'singles', 'doubles', 'triples', 'hr', 'rbi', 'avg', 'ip', 'er', 'bb', 'k', 'era', 'w', 'l']
colors = ['#23634f', '#c57a26', '#526aac', '#65519b', '#397b84', '#315f8e', '#7c5e47', '#9a4554', '#3c7c9b', '#bc7250', '#607942', '#ac9650', '#997256', '#6a7d94', '#9a668b', '#507b65']
teams, players, rounds, differences = [], [], [], []
master = {}
for row in source['sheets'][1]['rows'][1:]:
    cells = {re.sub(r'\d', '', c['cell']): c for c in row}
    master[(str(cells.get('A', {}).get('value')), str(cells.get('B', {}).get('value')))] = cells

def stats(cells):
    return {key: cells.get(chr(67 + i), {}).get('value', 0) or 0 for i, key in enumerate(keys)}

for idx, sheet in enumerate(source['sheets'][2:]):
    team_id = idx + 1
    teams.append({'id': team_id, 'name': sheet['sheet'], 'color': colors[idx]})
    current_round, slot = 0, 0
    for row in sheet['rows']:
        cells = {re.sub(r'\d', '', c['cell']): c for c in row}
        name = cells.get('A', {}).get('value')
        if isinstance(name, str) and '--- JORNADA' in name:
            current_round = int(re.search(r'JORNADA\s+(\d+)', name).group(1))
            slot = 0
            continue
        if cells.get('B', {}).get('value') != sheet['sheet'] or not isinstance(name, str) or name == 'Nombre':
            continue
        slot += 1
        player_id = team_id * 100 + slot
        origin = f"{sheet['sheet']}!{cells['A']['cell']}"
        if current_round == 0:
            value = stats(cells)
            players.append({'id': player_id, 'teamId': team_id, 'name': unicodedata.normalize('NFC', name.strip()), 'originalName': name, 'placeholder': bool(re.fullmatch(r'Jugador\s+\d+', name.strip(), re.I)), 'sourceCell': origin, 'stats': value})
            linked = master.get((name, sheet['sheet']))
            if linked and stats(linked) != value:
                differences.append({'player': name, 'team': sheet['sheet'], 'kind': 'master_vs_team'})
        else:
            rounds.append({'playerId': player_id, 'round': current_round, 'stats': stats(cells), 'sourceCell': origin})

qualified_ab = sum(p['stats']['ab'] for p in players) / len(players)
report = {'teams': len(teams), 'rosterSlots': len(players), 'namedPlayers': sum(not p['placeholder'] for p in players), 'placeholderSlots': sum(p['placeholder'] for p in players), 'roundRows': len(rounds), 'roundsWithActivity': sorted({r['round'] for r in rounds if any(r['stats'][k] for k in ['jj', 'ab', 'ip'])}), 'masterDifferences': differences, 'minimumAb': qualified_ab, 'minimumIp': (lambda ip: sum(ip) / len(ip) if ip else 0)([p['stats']['ip'] for p in players if p['stats']['ip'] > 0]), 'eraInnings': 7}
seed = {'source': source['source'], 'sha256': hashlib.sha256((base / source['source']).read_bytes()).hexdigest(), 'metadata': report, 'teams': teams, 'players': players, 'rounds': rounds}
(base / 'data').mkdir(exist_ok=True)
(base / 'data' / 'seed.json').write_text(json.dumps(seed, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(base / 'data' / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=True))
