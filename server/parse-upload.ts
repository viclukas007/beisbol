import ExcelJS from 'exceljs';
import {parentPort,workerData} from 'node:worker_threads';
const statKeys=['jj','ab','hits','singles','doubles','triples','hr','rbi','ip','er','bb','k','w','l'];
const originalKeys=['jj','ab','hits','singles','doubles','triples','hr','rbi','avg','ip','er','bb','k','era','w','l'];
const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string>={id:'playerId',idjugador:'playerId',playerid:'playerId',jugadorid:'playerId',nombre:'name',nombrejugador:'name',jugador:'name',name:'name',equipo:'team',team:'team',teamid:'team',idequipo:'team',socio:'member',member:'member',activo:'active',active:'active',jornada:'round',round:'round',h:'hits',hits:'hits',hitsconectados:'hits','1b':'singles','2b':'doubles','3b':'triples'};
for(const key of statKeys)aliases[key]=key;
function scalar(value:any):any {
  if(value===null||value===undefined)return '';
  if(typeof value!=='object')return value;
  if('formula' in value||'sharedFormula' in value){if(value.result===undefined)return {missingFormula:true};return scalar(value.result);}
  if(value.richText)return value.richText.map((part:any)=>part.text).join('');
  if(value.text!==undefined)return value.text;
  if(value.error)return {cellError:value.error};
  return '';
}
function fromTable(rows:any[][],sheet:string) {
  const headers=rows[0]?.map(h=>aliases[normalize(String(h))]??'')??[];
  if(!headers.includes('name')&&!headers.includes('playerId'))throw new Error(`${sheet}: falta una columna Nombre o ID_JUGADOR.`);
  const nonempty=headers.filter(Boolean);if(new Set(nonempty).size!==nonempty.length)throw new Error(`${sheet}: hay columnas repetidas.`);
  return rows.slice(1).flatMap((row,i)=>{
    if(row.every(v=>v===''||v===null||v===undefined))return [];
    const result:any={source:`${sheet}!${i+2}`};headers.forEach((h,j)=>{if(h)result[h]=scalar(row[j]);});return [result];
  });
}
function csvRows(text:string) {
  text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/,1)[0];const separator=first.split(';').length>first.split(',').length?';':',';
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted){quoted=false;}else if(!cell){quoted=true;}else throw new Error('CSV: comillas fuera de lugar.');}
    else if(!quoted&&ch===separator){row.push(cell);cell='';}
    else if(!quoted&&(ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=ch;
    if(rows.length>20001)throw new Error('El archivo admite hasta 20,000 filas.');
  }
  if(quoted)throw new Error('CSV: falta cerrar una comilla.');
  if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
try {
  const data=Buffer.from(workerData.data);
  let records:any[]=[];
  if(workerData.filename.toLowerCase().endsWith('.csv')) records=fromTable(csvRows(data.toString('utf8')),'CSV');
  else if(workerData.filename.toLowerCase().endsWith('.xlsx')) {
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(data);
    const teams=new Set(workerData.teams.map((s:string)=>normalize(s)));
    const originals=workbook.worksheets.filter(s=>teams.has(normalize(s.name)));
    if(originals.length) {
      for(const sheet of originals) {
        let round=0;
        sheet.eachRow((row,index)=>{
          const name=String(scalar(row.getCell(1).value));
          const marker=/---\s*JORNADA\s+(\d+)/i.exec(name);if(marker){round=Number(marker[1]);return;}
          if(normalize(String(scalar(row.getCell(2).value)))!==normalize(sheet.name)||!name.trim()||normalize(name)==='nombre')return;
          if(workerData.kind==='players'&&round!==0)return;
          if(workerData.kind==='stats'&&((workerData.scope==='rounds'&&round===0)||(workerData.scope==='accumulated'&&round!==0)))return;
          const result:any={name,team:sheet.name,round:round||'ACUMULADO',source:`${sheet.name}!A${index}`};
          originalKeys.forEach((key,i)=>{if(key!=='avg'&&key!=='era'){const value=scalar(row.getCell(i+3).value);result[key]=value===''?0:value;}});
          records.push(result);
        });
      }
    }else {
      const sheet=workbook.getWorksheet(workerData.kind==='players'?'Jugadores':'Estadisticas')??workbook.worksheets[0];
      if(!sheet||sheet.rowCount>20001||sheet.columnCount>40)throw new Error('La hoja debe tener hasta 20,000 filas y 40 columnas.');
      const rows:any[][]=[];sheet.eachRow({includeEmpty:true},row=>{const values:any[]=[];for(let col=1;col<=sheet.columnCount;col++)values.push(scalar(row.getCell(col).value));rows.push(values);});records=fromTable(rows,sheet.name);
    }
  }else throw new Error('Usa un archivo CSV o XLSX. Para archivos XLS, guarda primero como XLSX.');
  if(!records.length)throw new Error('El archivo no contiene registros para importar.');
  if(records.length>20000)throw new Error('El archivo admite hasta 20,000 registros.');
  parentPort!.postMessage({records});
}catch(e){parentPort!.postMessage({error:e instanceof Error?e.message:'No se pudo leer el archivo.'});}
