"""Read only the confirmed first round schedule from the supplied workbook."""
import json
import re
import zipfile
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

base = Path(__file__).parent
source = base / 'ROL 2026-2027 LISTO.xlsx'
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source) as archive:
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    sheets = list(workbook.find('m:sheets', ns))
    print('Sheets:', json.dumps([sheet.attrib['name'] for sheet in sheets], ensure_ascii=True))
    matches = [s for s in sheets if 'primera' in s.attrib['name'].lower()]
    if len(matches) != 1:
        raise ValueError('Identify the Primera vuelta sheet by its exact name before extraction.')
    sheet = matches[0]
    strings = [''.join(x.itertext()) for x in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', ns)] if 'xl/sharedStrings.xml' in archive.namelist() else []
    relations = {x.attrib['Id']: x.attrib['Target'] for x in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
    target = relations[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
    root = ET.fromstring(archive.read(target.lstrip('/') if target.startswith('/') else 'xl/' + target))
    styles = ET.fromstring(archive.read('xl/styles.xml'))
    formats = {int(x.attrib['numFmtId']): x.attrib['formatCode'] for x in styles.findall('m:numFmts/m:numFmt', ns)}
    style_formats = [int(x.attrib.get('numFmtId', 0)) for x in styles.find('m:cellXfs', ns)]
    rows = []
    for row in root.findall('m:sheetData/m:row', ns):
        cells = []
        for cell in row:
            value = cell.find('m:v', ns)
            val = value.text if value is not None else None
            if cell.attrib.get('t') == 's' and val is not None:
                val = unicodedata.normalize('NFC', strings[int(val)])
            elif cell.attrib.get('t') == 'inlineStr':
                val = ''.join(cell.find('m:is', ns).itertext())
            elif val is not None and cell.attrib.get('t') not in ('str', 'e', 'b'):
                val = float(val) if '.' in val else int(val)
            if val is not None:
                fmt = style_formats[int(cell.attrib.get('s', 0))]
                cells.append({'cell': cell.attrib['r'], 'value': val, 'numberFormat': formats.get(fmt, str(fmt))})
        if cells:
            rows.append(cells)
    result = {'source': source.name, 'sheet': sheet.attrib['name'], 'rows': rows, 'merges': [m.attrib['ref'] for m in root.findall('m:mergeCells/m:mergeCell', ns)]}
    (base / 'data' / 'schedule-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    for row in rows[:10]:
        print(json.dumps(row, ensure_ascii=True))
    print('Rows:', len(rows))
    game_rows = []
    for row in rows:
        values = {re.sub(r'\d', '', cell['cell']): cell['value'] for cell in row}
        if str(values.get('B', '')).startswith('Jornada ') and values.get('F') and values.get('G'):
            game_rows.append(values)
    dates = [(datetime(1899, 12, 30) + timedelta(days=row['C'])).date().isoformat() for row in game_rows]
    print(json.dumps({'games': len(game_rows), 'rounds': sorted({int(re.search(r'\d+', row['B']).group()) for row in game_rows}), 'start': min(dates), 'end': max(dates), 'notes': [row for row in game_rows if row.get('H')], 'tail': rows[-8:]}, ensure_ascii=True))
