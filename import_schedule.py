"""Normalize the confirmed Primera Vuelta sheet without inferring reschedules."""
from pathlib import Path
from datetime import datetime, timedelta
import json
import re
import hashlib
import unicodedata

base = Path(__file__).parent
raw = json.loads((base / 'data/schedule-source.json').read_text(encoding='utf-8'))
seed = json.loads((base / 'data/seed.json').read_text(encoding='utf-8'))
normalize = lambda value: unicodedata.normalize('NFC', value).strip().casefold()
teams = {normalize(team['name']): team['id'] for team in seed['teams']}
games, notes = [], []
for row in raw['rows']:
    values = {re.sub(r'\d', '', cell['cell']): cell['value'] for cell in row}
    if values.get('B') == 'NOTA':
        notes.append(values.get('C', ''))
    if not str(values.get('B', '')).startswith('Jornada ') or not values.get('F') or not values.get('G'):
        continue
    day = (datetime(1899, 12, 30) + timedelta(days=values['C'])).date().isoformat()
    time = str(values['E']).strip()
    if not re.fullmatch(r'\d{2}:\d{2}', time):
        raise ValueError(f'Unexpected time: {time}')
    home, away = teams[normalize(values['F'])], teams[normalize(values['G'])]
    if home == away:
        raise ValueError('A team cannot play itself')
    origin = f"{raw['sheet']}!{row[0]['cell']}"
    games.append({'round': int(re.search(r'\d+', values['B']).group()), 'date': day, 'time': time, 'homeTeamId': home, 'awayTeamId': away, 'notes': str(values.get('H', '')).strip(), 'status': 'scheduled', 'sourceCell': origin})
metadata = {'season': '2026-2027', 'league': 'Liga de Sóftbol Nocturna Varonil', 'club': 'Club Campestre de Yucatán A.C.', 'sheet': raw['sheet'], 'confirmedTurn': 1, 'secondTurnConfirmed': False, 'gameCount': len(games), 'rounds': sorted({game['round'] for game in games}), 'start': min(game['date'] for game in games), 'end': max(game['date'] for game in games), 'notes': notes}
result = {'source': raw['source'], 'sha256': hashlib.sha256((base / raw['source']).read_bytes()).hexdigest(), 'metadata': metadata, 'games': games}
(base / 'data/schedule.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(metadata, ensure_ascii=True))
