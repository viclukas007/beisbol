"""Read the schedule sheets and the results sheet from the league workbook.

Usage: python read_schedule.py ["ROL 2026-2027 LISTO V11.xlsx"]

Writes data/schedule-source.json with the raw cell values of Primera Vuelta,
Segunda Vuelta and Captura de Resultados. For the results sheet the formulas of
column B are kept so every result row can be traced to its schedule row.
"""
import json
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path

import openpyxl

base = Path(__file__).parent
source = base / (sys.argv[1] if len(sys.argv) > 1 else 'ROL 2026-2027 LISTO V11.xlsx')
SCHEDULE_SHEETS = ['Primera Vuelta', 'Segunda Vuelta']
RESULTS_SHEET = 'Captura de Resultados'


def clean(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        return unicodedata.normalize('NFC', value)
    return value


def read_rows(sheet, formulas=None, formula_columns=()):
    rows = []
    for row in sheet.iter_rows():
        cells = []
        for cell in row:
            if cell.value is None:
                continue
            entry = {'cell': cell.coordinate, 'value': clean(cell.value)}
            if formulas is not None and cell.column_letter in formula_columns:
                raw = formulas[cell.coordinate].value
                if isinstance(raw, str) and raw.startswith('='):
                    entry['formula'] = raw
            cells.append(entry)
        if cells:
            rows.append(cells)
    return rows


values = openpyxl.load_workbook(source, data_only=True)
formulas = openpyxl.load_workbook(source, data_only=False)
print('Sheets:', json.dumps(values.sheetnames, ensure_ascii=True))
for name in SCHEDULE_SHEETS + [RESULTS_SHEET]:
    if name not in values.sheetnames:
        raise ValueError(f'Sheet not found: {name}')
teams = [clean(row[2]) for row in values['Equipos'].iter_rows(min_row=6, max_col=3, values_only=True) if row[2]]
sheets = {name: {'rows': read_rows(values[name])} for name in SCHEDULE_SHEETS}
sheets[RESULTS_SHEET] = {'rows': read_rows(values[RESULTS_SHEET], formulas[RESULTS_SHEET], 'B')}
result = {'source': source.name, 'teams': teams, 'scheduleSheets': SCHEDULE_SHEETS, 'resultsSheet': RESULTS_SHEET, 'sheets': sheets}
(base / 'data' / 'schedule-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
for name, sheet in sheets.items():
    games = sum(1 for row in sheet['rows'] if any(c['cell'].startswith('B') and str(c['value']).startswith('Jornada ') for c in row))
    print(f'{name}: {len(sheet["rows"])} rows, {games} game rows')
print('Teams:', json.dumps(teams, ensure_ascii=True))
