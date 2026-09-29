import zipfile
import xml.etree.ElementTree as ET
import json
from pathlib import Path

base = Path(__file__).parent
source = next(base.glob('*.xlsx'))
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source) as z:
    strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
    workbook = ET.fromstring(z.read('xl/workbook.xml'))
    relations = {x.attrib['Id']: x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = []
    for sheet in workbook.find('m:sheets', ns):
        target = relations[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        root = ET.fromstring(z.read(target.lstrip('/') if target.startswith('/') else 'xl/' + target))
        rows = []
        for row in root.findall('m:sheetData/m:row', ns):
            cells = []
            for cell in row:
                value = cell.find('m:v', ns)
                formula = cell.find('m:f', ns)
                val = value.text if value is not None else None
                if cell.attrib.get('t') == 's' and val is not None:
                    val = strings[int(val)]
                elif cell.attrib.get('t') == 'inlineStr':
                    val = ''.join(cell.find('m:is', ns).itertext())
                elif val is not None and cell.attrib.get('t') not in ('str', 'e', 'b'):
                    val = float(val) if '.' in val else int(val)
                if val is not None or formula is not None:
                    cells.append({'cell': cell.attrib['r'], 'value': val, 'formula': formula.text if formula is not None else None})
            if cells:
                rows.append(cells)
        sheets.append({'sheet': sheet.attrib['name'], 'rows': rows})
output = {'source': source.name, 'sheets': sheets}
(base / 'workbook-source.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
for sheet in sheets:
    first = [{c['cell'].rstrip('0123456789'): c['value'] for c in row} for row in sheet['rows'][:32]]
    names = [r.get('A') for r in first[1:23] if isinstance(r.get('A'), str) and r.get('B') == sheet['sheet']]
    print(json.dumps({'sheet': sheet['sheet'], 'rows': len(sheet['rows']), 'roster_count': len(names), 'labels': [{k:v for k,v in r.items() if k in ['A','B','C','S','T','U']} for r in first[22:28]]}, ensure_ascii=True))
master = sheets[1]
real = [row for row in master['rows'][1:] if isinstance(row[0]['value'], str) and row[0]['value'].strip()]
print('Master named players:', len(real))
