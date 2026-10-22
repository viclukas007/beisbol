"""Normalize both schedule sheets and the captured results into data/schedule.json.

Every game keeps the cell it came from (sourceCell) so the server can update an
existing database without duplicating games. Results are only written when the
results sheet has them; games without a result keep whatever the database has.
"""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

base = Path(__file__).parent
raw = json.loads((base / 'data/schedule-source.json').read_text(encoding='utf-8'))
seed = json.loads((base / 'data/seed.json').read_text(encoding='utf-8'))
normalize = lambda value: unicodedata.normalize('NFC', str(value)).strip().casefold()
teams = {normalize(team['name']): team['id'] for team in seed['teams']}
for name in raw['teams']:
    if normalize(name) not in teams:
        raise ValueError(f'Team not found in seed: {name}')
# Codes used in column A of the results sheet. Unknown codes stop the import.
CODES = {'cap': ('completed', ''), 'ff': ('completed', 'Forfeit'), 'susp luz': ('postponed', 'Suspendido por luz')}


def cells(row):
    return {re.sub(r'\d', '', cell['cell']): cell for cell in row}


def parse_time(value):
    text = str(value).strip()
    if not re.fullmatch(r'\d{2}:\d{2}', text):
        raise ValueError(f'Unexpected time: {text}')
    return text


games, notes, by_cell = [], [], {}
for turn, sheet_name in enumerate(raw['scheduleSheets'], start=1):
    for row in raw['sheets'][sheet_name]['rows']:
        values = {column: cell['value'] for column, cell in cells(row).items()}
        if values.get('B') == 'NOTA':
            notes.append(str(values.get('C', '')).strip())
            continue
        if not str(values.get('B', '')).startswith('Jornada ') or not values.get('F') or not values.get('G'):
            continue
        home, away = teams[normalize(values['F'])], teams[normalize(values['G'])]
        if home == away:
            raise ValueError(f'A team cannot play itself: {sheet_name} row {row[0]["cell"]}')
        game = {'turn': turn, 'round': int(re.search(r'\d+', values['B']).group()), 'date': values['C'], 'time': parse_time(values['E']), 'homeTeamId': home, 'awayTeamId': away, 'notes': str(values.get('H', '') or '').strip(), 'status': None, 'homeScore': None, 'awayScore': None, 'homeHits': None, 'awayHits': None, 'homeErrors': None, 'awayErrors': None, 'code': None, 'sourceCell': f"{sheet_name}!{cells(row)['B']['cell']}", 'resultCell': None}
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(game['date'])):
            raise ValueError(f'Unexpected date in {game["sourceCell"]}: {game["date"]}')
        games.append(game)
        by_cell[game['sourceCell']] = game


def number(cell, label):
    if cell is None:
        return None
    value = cell['value']
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if not isinstance(value, int) or value < 0 or value > 9999:
        raise ValueError(f'{label} in {cell["cell"]} must be an integer between 0 and 9999, got {value!r}')
    return value


results, codes = 0, {}
for row in raw['sheets'][raw['resultsSheet']]['rows']:
    columns = cells(row)
    reference = columns.get('B', {}).get('formula', '')
    match = re.fullmatch(r"='([^']+)'!B(\d+)", reference)
    if not match:
        continue
    source_cell = f'{match.group(1)}!B{match.group(2)}'
    game = by_cell.get(source_cell)
    if not game:
        raise ValueError(f'Result row {columns["B"]["cell"]} points to an unknown game: {source_cell}')
    if game['resultCell']:
        raise ValueError(f'Game {source_cell} has two result rows')
    game['resultCell'] = f"{raw['resultsSheet']}!{columns['B']['cell']}"
    for column, key in (('F', 'homeTeamId'), ('N', 'awayTeamId')):
        if column in columns and teams.get(normalize(columns[column]['value'])) != game[key]:
            raise ValueError(f'Team mismatch between {game["sourceCell"]} and {columns[column]["cell"]}')
    code = str(columns['A']['value']).strip() if 'A' in columns else ''
    home_score, away_score = number(columns.get('G'), 'Home score'), number(columns.get('K'), 'Away score')
    if (home_score is None) != (away_score is None):
        raise ValueError(f'Only one score captured in {game["resultCell"]}')
    if code:
        if code.casefold() not in CODES:
            raise ValueError(f'Unknown result code {code!r} in {game["resultCell"]}. Add it to CODES before importing.')
        status, annotation = CODES[code.casefold()]
        codes[code.casefold()] = codes.get(code.casefold(), 0) + 1
        game['code'] = code
    elif home_score is not None:
        status, annotation = 'completed', ''
    else:
        continue
    if status == 'completed' and home_score is None:
        raise ValueError(f'Code {code!r} requires both scores in {game["resultCell"]}')
    if status != 'completed' and home_score is not None:
        raise ValueError(f'Code {code!r} cannot carry a score in {game["resultCell"]}')
    game['status'] = status
    game['homeScore'], game['awayScore'] = home_score, away_score
    if status == 'completed':
        game['homeHits'], game['awayHits'] = number(columns.get('H'), 'Home hits'), number(columns.get('L'), 'Away hits')
        game['homeErrors'], game['awayErrors'] = number(columns.get('I'), 'Home errors'), number(columns.get('M'), 'Away errors')
        results += 1
    if annotation:
        game['notes'] = ' · '.join(part for part in [game['notes'], annotation] if part)

turns = {}
for turn, sheet_name in enumerate(raw['scheduleSheets'], start=1):
    own = [g for g in games if g['turn'] == turn]
    turns[str(turn)] = {'sheet': sheet_name, 'gameCount': len(own), 'rounds': sorted({g['round'] for g in own}), 'start': min(g['date'] for g in own), 'end': max(g['date'] for g in own)}
metadata = {'season': '2026-2027', 'league': 'Liga de Sóftbol Nocturna Varonil', 'club': 'Club Campestre de Yucatán A.C.', 'sheets': raw['scheduleSheets'], 'resultsSheet': raw['resultsSheet'], 'turns': turns, 'gameCount': len(games), 'resultCount': results, 'codes': codes, 'notes': notes}
result = {'source': raw['source'], 'sha256': hashlib.sha256((base / raw['source']).read_bytes()).hexdigest(), 'metadata': metadata, 'games': games}
(base / 'data/schedule.json').write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
print(json.dumps(metadata, ensure_ascii=True))
