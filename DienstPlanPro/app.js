'use strict';
const content=document.getElementById('content');

/* ------------------------------------------------------------------
   Hilfsfunktionen: Speicher, Format, Protokolle
------------------------------------------------------------------ */
const load=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v===null?fallback:v}catch(e){return fallback}};
const isQuotaError=e=>!!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014);
/* Speichern: Ist der Browserspeicher voll, werden zuerst die Protokolle gekürzt und es wird ein zweites Mal versucht. */
const save=(key,value,quiet=false)=>{const text=JSON.stringify(value);
 try{localStorage.setItem(key,text)}catch(e){
  if(!isQuotaError(e))throw e;
  try{if(!freeStorageSpace(key))throw e;localStorage.setItem(key,text)}catch(e2){if(!quiet)setTimeout(handleStorageFull,0);throw e2}}};
function freeStorageSpace(exceptKey){let freed=false;
 try{if(exceptKey!=='dienstplanAuditLog'&&auditLog.length>300){auditLog=auditLog.slice(0,300);localStorage.setItem('dienstplanAuditLog',JSON.stringify(auditLog));freed=true}}catch(e){}
 try{if(exceptKey!=='dienstplanExportLog'&&exportLog.length>200){exportLog=exportLog.slice(0,200);localStorage.setItem('dienstplanExportLog',JSON.stringify(exportLog));freed=true}}catch(e){}
 return freed}
const STORAGE_LIMIT=5*1024*1024;
function storageUsed(){try{return Object.keys(localStorage).filter(k=>k.startsWith('dienstplan')).reduce((s,k)=>s+(localStorage.getItem(k)||'').length,0)}catch(e){return 0}}
/* Konnte eine Änderung nicht gespeichert werden, wird der zuletzt gespeicherte Stand neu geladen,
   damit Anzeige und gespeicherte Daten nicht auseinanderlaufen. */
let appReady=false;// erst nach dem Start neu laden, sonst entstünde beim Start eine Schleife
function handleStorageFull(){
 if(!appReady){if(typeof toast==='function')toast('Browserspeicher voll – Änderungen können nicht gespeichert werden.');return}
 try{sessionStorage.setItem('dienstplanStorageFull',String(Date.now()))}catch(e){}location.reload()}

const makeId=()=>((window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));
/* Datumsformat (Einstellungen): dmy = 31.12.2026 · iso = 2026-12-31 · mdy = 12/31/2026 · long = 31. Dezember 2026 */
let dateFormat=['dmy','iso','mdy','long'].includes(localStorage.getItem('dienstplanDateFormat'))?localStorage.getItem('dienstplanDateFormat'):'dmy';
const pad2=n=>String(n).padStart(2,'0');
function fmt(d){const D=pad2(d.getDate()),M=pad2(d.getMonth()+1),Y=d.getFullYear();switch(dateFormat){case 'iso':return `${Y}-${M}-${D}`;case 'mdy':return `${M}/${D}/${Y}`;case 'long':return d.toLocaleDateString(LOC(),{day:'numeric',month:'long',year:'numeric'});default:return `${D}.${M}.${Y}`}}
function fmtShort(d){const D=pad2(d.getDate()),M=pad2(d.getMonth()+1);switch(dateFormat){case 'iso':return `${M}-${D}`;case 'mdy':return `${M}/${D}`;case 'long':return d.toLocaleDateString(LOC(),{day:'numeric',month:'short'});default:return `${D}.${M}.`}}
const weekdayName=(d,style='long')=>d.toLocaleDateString(LOC(),{weekday:style});
const fmtWithWeekday=d=>weekdayName(d)+', '+fmt(d);
const fmtShortWd=d=>weekdayName(d,'short')+' '+fmtShort(d);
const fmtIsoDate=iso=>fmt(new Date(iso+'T12:00:00'));
const fmtDateTime=ts=>{const d=new Date(ts);return fmt(d)+' '+pad2(d.getHours())+':'+pad2(d.getMinutes())};
const monthName=d=>d.toLocaleDateString(LOC(),{month:'long',year:'numeric'});
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=n=>String(n||'').trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'??';
const icon=(name,cls='')=>`<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
function validDateInput(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&+String(v).slice(0,4)>=2000&&+String(v).slice(0,4)<=2099&&!Number.isNaN(new Date(v+'T12:00:00').getTime())}
const DATE_RANGE_MSG='Bitte ein gültiges Datum zwischen 2000 und 2099 wählen.';
function isoDate(date){return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function weekStart(d){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-(x.getDay()+6)%7);return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function isoWeek(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil(((x-y)/86400000+1)/7)}
function durationHours(start,end){if(!start||!end)return 0;const [a,b]=start.split(':').map(Number),[c,e]=end.split(':').map(Number);let m=(c*60+e)-(a*60+b);if(m<=0)m+=1440;return m/60}
const WEEKDAYS=LANG==='en'?['MON','TUE','WED','THU','FRI','SAT','SUN']:['MO','DI','MI','DO','FR','SA','SO'];
let toastTimer=null;
/* Meldungen unten rechts: bleiben je nach Textlänge 5–15 Sekunden sichtbar,
   pausieren, solange die Maus darüber ist, und schließen sich per Klick. */
let toastLeft=0,toastStart=0;
const toastHide=()=>{clearTimeout(toastTimer);document.getElementById('toast').classList.remove('show')};
const toastRun=ms=>{clearTimeout(toastTimer);toastLeft=ms;toastStart=Date.now();toastTimer=setTimeout(toastHide,ms)};
const toast=m=>{const t=document.getElementById('toast');t.textContent=m;t.title='Klicken zum Schließen';t.classList.add('show');toastRun(Math.min(15000,Math.max(5000,4000+String(m||'').length*70)))};
{const t=document.getElementById('toast');if(t){t.addEventListener('click',toastHide);
 t.addEventListener('mouseenter',()=>{if(!t.classList.contains('show'))return;clearTimeout(toastTimer);toastLeft=Math.max(1500,toastLeft-(Date.now()-toastStart))});
 t.addEventListener('mouseleave',()=>{if(t.classList.contains('show'))toastRun(Math.max(1500,toastLeft))})}}

/* Datei speichern: in der claude.ai-Vorschau über die Download-Funktion des Viewers, lokal als normaler Download. */
let lastExportSize=0;
async function saveFile(filename,data,mime){
 const blob=data instanceof Blob?data:new Blob([data],{type:mime});lastExportSize=blob.size;
 try{
  if(window.claude&&typeof window.claude.use==='function'){
   const dl=await Promise.race([window.claude.use('downloads'),new Promise(r=>setTimeout(()=>r(null),1500))]);
   if(dl){await dl.save({filename,data:typeof data==='string'?data:blob});return true;}
  }
 }catch(e){if(e&&e.code==='declined')return false;console.warn('Download über Viewer nicht möglich',e)}
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
 return true;
}
/* Zellen, die Excel als Formel ausführen würde (=, @, +/- mit Text), bekommen ein ' vorangestellt. Telefonnummern wie +43 … bleiben unverändert. */
function csvSafe(v){const s=String(v??'');return (/^[=@\t\r]/.test(s)||(/^[+\-]/.test(s)&&/[^0-9\s.,:\/()+\-]/.test(s)))?"'"+s:s}
function downloadCsv(rows,fileName){
 const csv='﻿'+rows.map(line=>line.map(v=>'"'+csvSafe(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 lastExportSize=new Blob([csv]).size;
 return saveFile(fileName,csv,'text/csv;charset=utf-8;');
}
/* Minimaler ZIP-Writer (ohne Kompression) für echte .xlsx-Dateien */
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC_TABLE[(c^u8[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function makeZip(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 files.forEach(f=>{const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);
  const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,0,true);lh.setUint16(12,0x21,true);lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,name.length,true);lh.setUint16(28,0,true);
  parts.push(new Uint8Array(lh.buffer),name,data);
  const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,0,true);ch.setUint16(14,0x21,true);ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,name.length,true);ch.setUint32(42,offset,true);
  central.push(new Uint8Array(ch.buffer),name);offset+=30+name.length+data.length;});
 const csize=central.reduce((s,p)=>s+p.length,0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,csize,true);end.setUint32(16,offset,true);
 return new Blob([...parts,...central,new Uint8Array(end.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const xmlEsc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
function makeXlsx(sheetName,rows){
 const col=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${rows[0].map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.min(42,Math.max(10,...rows.slice(0,200).map(r=>String(r[i]??'').length+2)))}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{const ref=col(ci)+(ri+1);return typeof v==='number'&&isFinite(v)?`<c r="${ref}"${ri===0?' s="1"':''}><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"${ri===0?' s="1"':''}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/></worksheet>`;
 return makeZip([
  {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
  {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
  {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName.slice(0,31))}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xmlEsc(sheetName.slice(0,31))}'!$A$1:$${col(rows[0].length-1)}$${rows.length}</definedName></definedNames></workbook>`},
  {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
  {name:'xl/worksheets/sheet1.xml',data:sheet},
  {name:'xl/styles.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F6F6"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>'}
 ]);
}
/* Minimaler PDF-Writer: Tabelle im Querformat (Helvetica, Seitenumbruch, Kopfzeile je Seite) */
function makePdf(title,subtitle,headers,rows,widths){
 const W=842,H=595,M=36,LH=15,toCp=s=>{let out='';for(const ch of String(s??'')){const c=ch.codePointAt(0);const map={0x20AC:0x80,0x2013:0x96,0x2014:0x97,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x201E:0x84,0x2022:0x95,0x2026:0x85,0x2192:0x3E};const v=c<256?c:(map[c]||0x3F);out+=v===0x28||v===0x29||v===0x5C?'\\'+String.fromCharCode(v):v>126||v<32?'\\'+v.toString(8).padStart(3,'0'):String.fromCharCode(v)}return out};
 const total=widths.reduce((a,b)=>a+b,0),cw=widths.map(w=>w/total*(W-2*M)),fit=(t,w,size)=>{t=String(t??'');const max=Math.floor(w/(size*0.5));return t.length>max?t.slice(0,Math.max(1,max-1))+'…':t};
 const pages=[];let y,ops;const perPage=Math.floor((H-2*M-70)/LH);
 for(let p=0;p===0||p*perPage<rows.length;p++){ops=[];y=H-M;
  ops.push(`BT /F2 16 Tf ${M} ${y-14} Td (${toCp(title)}) Tj ET`);ops.push(`BT /F1 9 Tf 0.4 0.45 0.5 rg ${M} ${y-30} Td (${toCp(subtitle+` · Seite ${p+1}/${Math.max(1,Math.ceil(rows.length/perPage))}`)}) Tj ET`);
  y-=56;ops.push(`0.902 0.965 0.965 rg ${M} ${y-4} ${W-2*M} ${LH} re f`);let x=M;headers.forEach((h,i)=>{ops.push(`BT /F2 8.5 Tf 0.1 0.15 0.17 rg ${x+3} ${y} Td (${toCp(fit(h,cw[i]-6,8.5))}) Tj ET`);x+=cw[i]});y-=LH;
  rows.slice(p*perPage,(p+1)*perPage).forEach((r,ri)=>{if(ri%2)ops.push(`0.97 0.98 0.98 rg ${M} ${y-4} ${W-2*M} ${LH} re f`);let x2=M;r.forEach((v,i)=>{ops.push(`BT /F1 8.5 Tf 0.15 0.2 0.22 rg ${x2+3} ${y} Td (${toCp(fit(v,cw[i]-6,8.5))}) Tj ET`);x2+=cw[i]});y-=LH});
  ops.push(`BT /F1 7.5 Tf 0.55 0.6 0.62 rg ${M} ${M-12} Td (${toCp('DienstPlan Pro · erstellt am '+fmtDateTime(Date.now())+' von '+currentUserName())}) Tj ET`);
  pages.push(ops.join('\n'));}
 const objs=[];const add=s=>{objs.push(s);return objs.length};
 add('<< /Type /Catalog /Pages 2 0 R >>');add('PAGES');add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const kids=pages.map(c=>{const cs=add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);return add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cs} 0 R >>`)});
 objs[1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;
 let out='%PDF-1.4\n%âãÏÓ\n';const offs=[];objs.forEach((o,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const xref=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n${offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const u8=new Uint8Array(out.length);for(let i=0;i<out.length;i++)u8[i]=out.charCodeAt(i)&0xFF;
 return new Blob([u8],{type:'application/pdf'});
}
function safeFileName(name){return (name||'report').toLowerCase().replace(/[^a-z0-9äöüß]+/gi,'-').replace(/^-|-$/g,'')}
function downloadTableRow(table,row,reportName){
 const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim()).filter(h=>h&&!/^aktion/i.test(h));
 const values=[...row.children].map(x=>x.innerText.trim().replace(/\s+/g,' ')).slice(0,headers.length);
 downloadCsv([headers,values],safeFileName(reportName)+'.csv');
 logExport(reportName+' (Einzelzeile)','CSV',1,'Erfolgreich');
 toast('Report wurde heruntergeladen.');
}


/* Eigene Dialoge statt confirm()/prompt() – funktionieren auch in eingebetteten Vorschauen. */
function dialogBase(title,bodyHtml,okLabel,danger){
 return new Promise(resolve=>{
  const layer=document.createElement('div');layer.className='modal-backdrop app-dialog';
  layer.innerHTML=`<div class="modal" role="alertdialog" aria-modal="true"><h2>${escapeHtml(title)}</h2>${bodyHtml}<div class="btn-row modal-actions"><button type="button" class="btn" data-dlg="cancel">Abbrechen</button><button type="button" class="btn ${danger?'danger-solid':'primary'}" data-dlg="ok">${escapeHtml(okLabel)}</button></div></div>`;
  document.body.appendChild(layer);
  const input=layer.querySelector('input');
  const done=v=>{layer.remove();document.removeEventListener('keydown',key,true);resolve(v)};
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();done(null)}else if(e.key==='Enter'){e.preventDefault();done(input?input.value:true)}};
  document.addEventListener('keydown',key,true);
  layer.addEventListener('click',e=>{if(e.target===layer)done(null);const b=e.target.closest('[data-dlg]');if(b)done(b.dataset.dlg==='ok'?(input?input.value:true):null)});
  setTimeout(()=>(input||layer.querySelector('[data-dlg="ok"]')).focus(),20);
 });
}
const ask=(message,okLabel)=>dialogBase('Bitte bestätigen',`<p class="dialog-text">${escapeHtml(message)}</p>`,okLabel||(/lösch|zurücksetzen/i.test(message)?'Löschen':'Bestätigen'),/lösch|zurücksetzen/i.test(message)).then(v=>!!v);
const askText=(label,value='')=>dialogBase(label,`<input class="input dialog-input" type="text" value="${escapeHtml(value)}" maxlength="60">`,'Speichern',false).then(v=>v===null?'':String(v));

/* Audit- und Export-Protokoll (lokal) */
let auditLog=load('dienstplanAuditLog',[]);auditLog=Array.isArray(auditLog)?auditLog.filter(x=>x&&typeof x==='object'):[];
let exportLog=load('dienstplanExportLog',[]);exportLog=Array.isArray(exportLog)?exportLog.filter(x=>x&&typeof x==='object'):[];
function currentUserName(){return staff.find(p=>p[8]===currentUserId)?.[0]||'Unbekannt'}
function audit(action,area,detail,extra={}){
 auditLog.unshift({id:makeId(),ts:Date.now(),user:currentUserName(),role:currentRole,action,area,detail:String(detail||''),title:extra.title||'',object:extra.object||'',before:extra.before??'',after:extra.after??''});
 auditLog=auditLog.slice(0,1500);try{save('dienstplanAuditLog',auditLog,true)}catch(e){try{auditLog=auditLog.slice(0,100);save('dienstplanAuditLog',auditLog,true)}catch(e2){console.warn(e2)}}
}
function logExport(report,format,rows,status,extra={}){
 exportLog.unshift({id:makeId(),ts:Date.now(),user:currentUserName(),role:currentRole,report,format,rows,status,range:extra.range||'',size:extra.size||(status==='Verweigert'?0:lastExportSize)});lastExportSize=0;
 exportLog=exportLog.slice(0,1000);try{save('dienstplanExportLog',exportLog,true)}catch(e){try{exportLog=exportLog.slice(0,100);save('dienstplanExportLog',exportLog,true)}catch(e2){console.warn(e2)}}
}
/* Smartphone: Tabellenzeilen antippen öffnet alle Spalten lesbar. */
function bindMobileTableDetails(){
 if(document.getElementById('mobile-table-detail'))return;
 const layer=document.createElement('div');layer.id='mobile-table-detail';layer.className='modal-backdrop mobile-table-detail';layer.hidden=true;
 layer.innerHTML='<section class="modal mobile-table-detail-card" role="dialog" aria-modal="true" aria-labelledby="mobile-table-detail-title"><div class="panel-head"><h2 id="mobile-table-detail-title">Details</h2><button class="icon-btn" type="button" data-close-mobile-detail aria-label="Schließen">×</button></div><div class="mobile-table-detail-content"></div></section>';
 document.body.appendChild(layer);
 layer.addEventListener('click',e=>{if(e.target===layer||e.target.closest('[data-close-mobile-detail]'))layer.hidden=true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')layer.hidden=true});
 document.addEventListener('click',e=>{
  if(!window.matchMedia('(max-width: 700px)').matches)return;
  if(e.target.closest('button,a,input,select,label,summary'))return;
  const row=e.target.closest('.table-wrap tbody tr');if(!row||!row.closest('#content')||row.closest('table.cardify'))return;
  const table=row.closest('table');const headers=[...table.querySelectorAll('thead th')];const cells=[...row.children];
  if(!cells.length||row.querySelector('.empty-note'))return;
  const entries=headers.map((h,i)=>({label:h.textContent.trim(),value:cells[i]?.innerHTML||'—'})).filter(x=>x.label&&!/^aktion/i.test(x.label));
  if(!entries.length)return;
  layer.querySelector('#mobile-table-detail-title').textContent=(cells[0]?.textContent||'Eintrag').trim().slice(0,80)||'Details';
  const detail=layer.querySelector('.mobile-table-detail-content');
  detail.innerHTML=entries.map(x=>`<div class="mobile-detail-field"><b>${escapeHtml(x.label)}</b><div>${x.value}</div></div>`).join('');
  const actions=document.createElement('div');actions.className='mobile-detail-actions';
  const addAction=(label,fn,kind='')=>{const b=document.createElement('button');b.type='button';b.className='btn '+kind;b.textContent=label;b.onclick=()=>{layer.hidden=true;fn()};actions.appendChild(b)};
  const page=currentPage;
  if(page==='Dienstzeiten'){
   const edit=row.querySelector('[data-edit-shift]'),del=row.querySelector('[data-delete-shift]');
   if(edit)addAction('Bearbeiten',()=>edit.click());if(del)addAction('Löschen',()=>del.click(),'danger');
  }else if(page==='Kontakte'){
   const edit=row.querySelector('[data-edit-employee]'),del=row.querySelector('[data-remove-employee]');
   if(edit)addAction('Bearbeiten',()=>edit.click());if(del)addAction('Löschen',()=>del.click(),'danger');
  }else if(page==='Team Berechtigungen'){
   const edit=row.querySelector('[data-edit-role]'),del=row.querySelector('[data-delete-role]');
   if(edit)addAction('Bearbeiten',()=>edit.click());if(del)addAction('Löschen',()=>del.click(),'danger');
  }else if(['Berichte / Export','Audit Log','Export Audit'].includes(page)){
   addAction('Report herunterladen',()=>downloadTableRow(table,row,page),'primary');
  }
  if(actions.children.length)detail.appendChild(actions);
  layer.hidden=false;
 });
}

/* ------------------------------------------------------------------
   Zustand und Stammdaten
------------------------------------------------------------------ */
let currentPage='Dashboard',currentView='Woche',currentDate=new Date(),currentRole='Teamleiter',selectedMobileDate='';
let expandedMonthView=localStorage.getItem('dienstplanExpandedMonthView')==='1';
// Arbeitstage im Dienstplan: 5 = Mo–Fr, 6 = Mo–Sa, 7 = Mo–So (Bereitschaft immer Mo–So).
let dutyDays=[5,6,7].includes(Number(localStorage.getItem('dienstplanDutyDays')))?Number(localStorage.getItem('dienstplanDutyDays')):6;
let roles=(()=>{const saved=load('dienstplanRoles',null);if(Array.isArray(saved)&&saved.every(x=>typeof x==='string'))return saved;return ['Mitarbeiter','Teamleiter','Abteilungsleiter','Deputy','Admin','Lohnverrechnung','Bereitschaftsadmin']})();
const safePhoto=v=>typeof v==='string'&&/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/.test(v)?v:'';
let staff=(()=>{try{const v=JSON.parse(localStorage.getItem('dienstplanStaff')||'null');if(Array.isArray(v))return v.filter(s=>Array.isArray(s)&&typeof s[0]==='string').map(s=>[s[0],s[1]||initials(s[0]),s[2]||'Noch nicht eingeteilt',s[3]||'—',s[4]||'blue',s[5]||'Team Nord',s[6]||'',s[7]||'',s[8]||'',safePhoto(s[9]),s[10]||'Mitarbeiter']);}catch(e){console.warn('Alte Mitarbeiterdaten werden ignoriert.',e)}return [
 ['Max Mustermann','MM','Frühdienst','06:00–14:00','blue','Team Nord','max@example.at','0664 100 1001'],
 ['Anna Beispiel','AB','Spätdienst','14:00–22:00','green','Team Nord','anna@example.at','0664 100 1002'],
 ['Thomas Berger','TB','Tagdienst','08:00–16:00','blue','Team Süd','thomas@example.at','0664 100 1003'],
 ['Lisa Huber','LH','Bereitschaft','00:00–24:00','amber','Team Süd','lisa@example.at','0664 100 1004'],
 ['Paul Wagner','PW','Nachtdienst','22:00–06:00','green','Team Nord','paul@example.at','0664 100 1005']
];})();
staff.forEach((person,i)=>{if(!person[8])person[8]='emp-'+i+'-'+String(person[0]).toLowerCase().replace(/[^a-z0-9]+/g,'-')});
let teams=(()=>{const v=load('dienstplanTeams',null);if(Array.isArray(v))return v.filter(t=>t&&typeof t==='object'&&t.id&&typeof t.name==='string').map(t=>({...t,memberIds:Array.isArray(t.memberIds)?t.memberIds:[]}));return [
 {id:'team-nord',name:'Team Nord',memberIds:staff.filter(x=>(x[5]||'Team Nord')==='Team Nord').map(x=>x[8]),leaderId:staff.find(x=>x[0]==='Max Mustermann')?.[8]||'',deputyId:staff.find(x=>x[0]==='Anna Beispiel')?.[8]||''},
 {id:'team-sued',name:'Team Süd',memberIds:staff.filter(x=>x[5]==='Team Süd').map(x=>x[8]),leaderId:staff.find(x=>x[0]==='Thomas Berger')?.[8]||'',deputyId:staff.find(x=>x[0]==='Lisa Huber')?.[8]||''}
]})();
teams.forEach(t=>{t.memberIds=Array.isArray(t.memberIds)?t.memberIds.filter(Boolean):[]});
staff.forEach(person=>{person[8]=person[8]||makeId();});
teams.forEach(t=>{if(!t.memberIds.length)t.memberIds=staff.filter(x=>(x[5]||'Team Nord')===t.name).map(x=>x[8]);});

let currentUserId=staff[0]?.[8]||'';
function persistTeams(){save('dienstplanTeams',teams)}
/* Abteilungen: fassen Teams zusammen und haben eine Abteilungsleitung */
let departments=(()=>{const v=load('dienstplanDepartments',[]);if(!Array.isArray(v))return [];const seen=new Set();
 return v.filter(d=>d&&typeof d==='object'&&d.id&&typeof d.name==='string').map(d=>({id:String(d.id),name:d.name.slice(0,60),headId:typeof d.headId==='string'?d.headId:'',color:/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:'#0068A8',teamIds:(Array.isArray(d.teamIds)?d.teamIds:[]).map(String).filter(id=>!seen.has(id)&&seen.add(id))}))})();
function persistDepartments(){save('dienstplanDepartments',departments)}
const deptOfTeam=t=>t?departments.find(d=>d.teamIds.includes(t.id)):null;
/* Abteilungsleitung mit eigener Abteilung sieht nur deren Teams; ohne Zuordnung weiterhin alle Teams */
function headDeptTeams(){if(currentRole!=='Abteilungsleiter')return null;const mine=departments.filter(d=>d.headId===currentUserId);if(!mine.length)return null;const ids=new Set(mine.flatMap(d=>d.teamIds));return teams.filter(t=>ids.has(t.id))}
function persistStaff(){save('dienstplanStaff',staff)}
function persistAssignments(){save('dienstplanAssignments',assignments)}
function teamNames(){return teams.map(t=>t.name)}
function teamByName(name){return teams.find(t=>t.name===name)}
function teamById(id){return teams.find(t=>t.id===id)}
function canManageTeam(name){
 if(currentRole==='Admin')return true;
 if(!['Teamleiter','Deputy'].includes(currentRole))return false;
 const t=teamByName(name);if(!t)return false;
 return currentRole==='Teamleiter'?t.leaderId===currentUserId:t.deputyId===currentUserId;
}
function manageableTeams(area){const ar=area||(currentPage==='Bereitschaft'?'Bereitschaft':currentPage==='Dienstzeiten'?'Dienstzeiten':'Dienstplan');if(!canEdit(ar))return [];return currentRole==='Admin'?teams:teams.filter(t=>canManageTeam(t.name))}
/* Teameinstellungen: Diensttausch an/aus, wer eigene Dienste/Bereitschaften selbst eintragen darf */
function teamSettings(t){const v=t&&t.settings&&typeof t.settings==='object'?t.settings:{},ids=x=>Array.isArray(x)?x.filter(y=>typeof y==='string'):[],mode=x=>['none','all','selected'].includes(x)?x:'none';
 return {swap:v.swap!==false,selfDuty:mode(v.selfDuty),selfDutyIds:ids(v.selfDutyIds),selfStandby:mode(v.selfStandby),selfStandbyIds:ids(v.selfStandbyIds)}}
function selfEditAllowed(teamName,area,uid=currentUserId){const t=teamByName(teamName);if(!t||!t.memberIds.includes(uid)||!['Dienstplan','Bereitschaft'].includes(area))return false;
 const st=teamSettings(t),m=area==='Bereitschaft'?st.selfStandby:st.selfDuty,ids=area==='Bereitschaft'?st.selfStandbyIds:st.selfDutyIds;return m==='all'||(m==='selected'&&ids.includes(uid))}
const areaOf=a=>a&&a.kind==='Bereitschaft'?'Bereitschaft':'Dienstplan';
const managesTeam=(teamName,area)=>canEdit(area)&&canManageTeam(teamName);
function canEditEntry(teamName,employee,area){if(managesTeam(teamName,area))return true;return employee===currentUserName()&&selfEditAllowed(teamName,area)}
const selfOnly=(teamName,area)=>!managesTeam(teamName,area)&&selfEditAllowed(teamName,area);
function entryTeams(area){const ar=area||(currentPage==='Bereitschaft'?'Bereitschaft':'Dienstplan'),managed=manageableTeams(ar);return [...managed,...teams.filter(t=>!managed.includes(t)&&selfEditAllowed(t.name,ar))]}
function settingsTeams(){if(currentRole==='Admin')return teams;if(currentRole==='Abteilungsleiter')return headDeptTeams()||teams;if(currentRole==='Teamleiter')return teams.filter(t=>t.leaderId===currentUserId);if(currentRole==='Deputy')return teams.filter(t=>t.deputyId===currentUserId);return []}
function absenceTeams(){
 if(['Lohnverrechnung','Bereitschaftsadmin'].includes(currentRole))return [];
 return ['Abteilungsleiter','Admin'].includes(currentRole)?teams:teams.filter(t=>currentUserTeamNames().includes(t.name));
}
function absenceTeamFor(person){return person&&teams.find(t=>(Array.isArray(t.memberIds)&&t.memberIds.includes(person[8]))||t.name===(person[5]||''));}
function canCreateAbsenceFor(person){
 if(!person||['Lohnverrechnung','Bereitschaftsadmin'].includes(currentRole))return false;
 const team=absenceTeamFor(person);
 return ['Abteilungsleiter','Admin'].includes(currentRole)||(!!team&&absenceTeams().some(t=>t.id===team.id));
}
function currentUserTeamNames(){
 const person=staff.find(p=>p[8]===currentUserId);
 let assigned=teams.filter(t=>t.leaderId===currentUserId||t.deputyId===currentUserId||(Array.isArray(t.memberIds)&&t.memberIds.includes(currentUserId)));
 if(!assigned.length&&person&&person[5])assigned=teams.filter(t=>t.name===person[5]);
 return assigned.map(t=>t.name);
}
function canSeeStandbyInDutyPlan(a){if(['Admin','Abteilungsleiter'].includes(currentRole))return true;return currentUserTeamNames().includes(a.team)}

let calendarTeams=[],onlyConflicts=false;
const calTeamOk=team=>!calendarTeams.length||calendarTeams.includes(team);
let calendarTeamFilter='Alle Teams',calendarMemberFilter='Alle Mitarbeiter',mobileCalendarFiltersOpen=false;
let reportFrom='',reportTo='';
let mobileFocusEmp='';
let editingDutyId=null;
let assignments=(()=>{const v=load('dienstplanAssignments',[]);const T=/^\d\d:\d\d$/;return Array.isArray(v)?v.filter(a=>a&&typeof a==='object'&&typeof a.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(a.date)).map(a=>{if(a.start&&!T.test(a.start))a.start='';if(a.end&&!T.test(a.end))a.end='';['employee','team','shift'].forEach(k=>{if(a[k]!=null&&typeof a[k]!=='string')a[k]=String(a[k])});return a}):[]})();
const navItems=['Dashboard','Dienstplan','Bereitschaft','Bereitschaft verwalten','Dienstzeiten','Kontakte','Berichte / Export','Administration','Team Berechtigungen','Audit Log','Export Audit','Einstellungen'];
/* Berechtigungen: pro Rolle und Bereich „N“ (kein Zugriff), „R“ (Lesen) oder „E“ (Bearbeiten).
   Die Matrix unter „Team Berechtigungen“ steuert Navigation und Bearbeitungsrechte. */
const PERM_AREAS=['Dashboard','Dienstplan','Bereitschaft','Dienstzeiten','Kontakte','Berichte / Export','Administration','Bereitschaft verwalten','Team Berechtigungen','Audit Log','Export Audit','Einstellungen'];
const DEFAULT_PERMS={
 'Admin':Object.fromEntries(PERM_AREAS.map(a=>[a,'E'])),
 'Teamleiter':{'Dashboard':'E','Dienstplan':'E','Bereitschaft':'E','Dienstzeiten':'E','Kontakte':'R','Berichte / Export':'E','Administration':'E','Einstellungen':'E'},
 'Deputy':{'Dashboard':'E','Dienstplan':'E','Bereitschaft':'E','Dienstzeiten':'E','Kontakte':'R','Berichte / Export':'E','Administration':'E','Einstellungen':'E'},
 'Abteilungsleiter':{'Dashboard':'E','Dienstplan':'E','Bereitschaft':'E','Dienstzeiten':'E','Kontakte':'R','Berichte / Export':'E','Administration':'E','Audit Log':'R','Einstellungen':'E'},
 'Mitarbeiter':{'Dashboard':'R','Dienstplan':'R','Bereitschaft':'R','Kontakte':'R','Einstellungen':'E'},
 'Lohnverrechnung':{'Dashboard':'R','Dienstplan':'R','Bereitschaft':'R','Kontakte':'R','Berichte / Export':'E','Einstellungen':'E'},
 'Bereitschaftsadmin':{'Bereitschaft':'E','Kontakte':'R','Einstellungen':'E'}
};
const BASE_PERMS={'Dashboard':'R','Dienstplan':'R','Bereitschaft':'R','Kontakte':'R','Einstellungen':'E'};
let permissions=(()=>{const v=load('dienstplanPermissions',null);return v&&typeof v==='object'?v:{}})();
// einmalig: gespeicherte Rechte um „Administration“ für Teamleitung, Deputy und Abteilungsleitung ergänzen
try{if(!localStorage.getItem('dienstplanPermMig2')){['Teamleiter','Deputy','Abteilungsleiter'].forEach(r=>{if(permissions[r]&&typeof permissions[r]==='object'&&(permissions[r].Administration||'N')==='N')permissions[r].Administration='E'});localStorage.setItem('dienstplanPermMig2','1');if(Object.keys(permissions).length)localStorage.setItem('dienstplanPermissions',JSON.stringify(permissions))}}catch(_){}
function permsFor(role){const p=permissions[role]||DEFAULT_PERMS[role]||BASE_PERMS;return Object.fromEntries(PERM_AREAS.map(a=>[a,role==='Admin'?'E':(a==='Einstellungen'?'E':(p[a]||'N'))]))}
function perm(area,role=currentRole){return permsFor(role)[area]||'N'}
const canView=area=>perm(area)!=='N';
const canEdit=area=>perm(area)==='E';
function persistPermissions(){save('dienstplanPermissions',permissions)}
// Kompatibilität: Liste der sichtbaren Seiten je Rolle (früher fest hinterlegt)
const roleNavigation=new Proxy({},{get:(_,role)=>typeof role==='string'?PERM_AREAS.filter(a=>perm(a,role)!=='N'):undefined});
function allowedPages(){return PERM_AREAS.filter(a=>perm(a)!=='N')}
function applyRoleNavigation(){
 const allowed=allowedPages();
 document.querySelectorAll('#main-nav .nav-item').forEach(button=>{button.hidden=!allowed.includes(button.dataset.page);button.classList.toggle('active',button.dataset.page===currentPage);});
 const adminLabel=document.querySelector('#main-nav .admin-label');
 if(adminLabel)adminLabel.hidden=!allowed.some(p=>['Administration','Bereitschaft verwalten','Team Berechtigungen','Audit Log','Export Audit'].includes(p));
 const crumb=document.getElementById('crumb');if(crumb)crumb.textContent=currentPage;
 const workspaceLabel=document.querySelector('#main-nav').previousElementSibling;
 if(workspaceLabel)workspaceLabel.hidden=!allowed.some(p=>['Dashboard','Dienstplan','Bereitschaft','Dienstzeiten','Kontakte','Berichte / Export'].includes(p));
 // Zähler in der Navigation
 const counts={};// keine Zahlen neben den Menüpunkten – nur Symbol und Text
 document.querySelectorAll('#main-nav .nav-item').forEach(b=>{let c=b.querySelector('.nav-count');const v=counts[b.dataset.page];if(v===undefined){if(c)c.remove();return}if(!c){c=document.createElement('span');c.className='nav-count';b.appendChild(c)}c.textContent=v});
}
let defaults=load('dienstplanDefaults',{Dienstplan:'Woche',Bereitschaft:'Monat'});
let shiftTypes=(v=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&typeof x.name==='string'&&typeof x.team==='string').map(x=>({...x,start:/^\d\d:\d\d$/.test(x.start)?x.start:'08:00',end:/^\d\d:\d\d$/.test(x.end)?x.end:'16:00'})):null)(load('dienstplanShiftTypes',null))||[
 {id:1,team:'Team Nord',name:'1A Dienst',start:'06:00',end:'14:12',color:'blue'},
 {id:2,team:'Team Nord',name:'2A Dienst',start:'14:00',end:'22:12',color:'green'},
 {id:3,team:'Team Süd',name:'Tagdienst',start:'08:00',end:'16:00',color:'amber'}
];
// Bereitschaftsgruppen und -zeiten sind bewusst unabhängig von Dienstzeiten.
let standbyGroups=(()=>{const v=load('dienstplanStandbyGroups',[]);return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[]})();
let standbyTimes=(()=>{const v=load('dienstplanStandbyTimes',[]);return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[]})();
function persistStandbyConfig(){save('dienstplanStandbyGroups',standbyGroups);save('dienstplanStandbyTimes',standbyTimes)}

/* Einmalige Demo-Neuanlage: ersetzt alte Teams/Kontakte und erzeugt eine vollständige Beispieldatenbasis. */
const DEMO_DATA_VERSION='teams10-v3';
if(localStorage.getItem('dienstplanDemoDataVersion')!==DEMO_DATA_VERSION){
 const firstNames=['Alex','Sarah','Daniel','Julia','Michael','Laura','Stefan','Nina','Markus','Sophie','David','Lisa','Patrick','Anna','Florian','Eva','Thomas','Miriam','Martin','Lea','Andreas','Katharina','Simon','Johanna','Christian','Theresa','Fabian','Melanie','Tobias','Elena','Dominik','Clara','Manuel','Lena','Philipp','Marie','Jakob','Hannah','Sebastian','Amelie','Benjamin','Valentina','Raphael','Paula','Matthias','Isabella','Felix','Emilia','Jonas','Victoria'];
 const lastNames=['Gruber','Huber','Bauer','Wagner','Müller','Pichler','Steiner','Moser','Mayer','Hofer','Leitner','Berger','Fuchs','Eder','Winkler','Schmid','Reiter','Auer','Fischer','Schwarz','Wolf','Lang','Brunner','Baumgartner','Haas','Binder','Lechner','Wallner','Holzer','Weber','Koller','Aigner','Wimmer','Egger','Graf','Kern','Lindner','Platzer','Strasser','Riegler','Maier','Ebner','Hofmann','Zach','Kogler','Hauser','Sommer','Nagl','Frank','Kaiser'];
 const teamLabels=['Nord','Süd','Ost','West','Zentrum','Nordost','Nordwest','Südost','Südwest','Innenstadt'];
 staff=[];teams=[];assignments=[];
 const makePerson=(idx,label,role)=>{const n=firstNames[idx%firstNames.length]+' '+lastNames[(idx*7)%lastNames.length];const id='demo-emp-'+String(idx+1).padStart(3,'0');staff.push([n,initials(n),'Noch nicht eingeteilt','—','blue','Team '+label,`${firstNames[idx%firstNames.length].toLowerCase()}.${lastNames[(idx*7)%lastNames.length].toLowerCase().replace(/ü/g,'ue').replace(/ö/g,'oe').replace(/ä/g,'ae')}@example.at`,`+43 660 ${String(1000000+idx*137).slice(-7)}`,id,'',role]);return id;};
 const colors=['#3974c6','#24966b','#e09a2d','#9b69c8','#dc6475','#159da8','#596579','#d95f20','#7b8f32','#263d75'];
 for(let i=0;i<10;i++){const label=teamLabels[i],ids=Array.from({length:5},(_,j)=>makePerson(i*5+j,label,j===0?(i===0?'Admin':'Teamleiter'):j===1?'Deputy':'Mitarbeiter'));teams.push({id:'demo-team-'+String(i+1).padStart(2,'0'),name:'Team '+label,memberIds:ids,leaderId:ids[0],deputyId:i===6?'':ids[1],standbyColor:colors[i]});}
 shiftTypes=[];for(let i=0;i<10;i++){const team=teams[i].name;shiftTypes.push({id:2001+i*3,team,name:'Tagdienst',start:'07:00',end:'15:00',color:colors[i]});shiftTypes.push({id:2002+i*3,team,name:'Frühdienst',start:'06:00',end:'14:00',color:'#159da8'});shiftTypes.push({id:2003+i*3,team,name:'Spätdienst',start:'14:00',end:'22:00',color:'#263d75'});}
 standbyGroups=[{id:'demo-standby-group',name:'Team-Bereitschaft'}];standbyTimes=[{id:'demo-standby-day',groupId:'demo-standby-group',name:'Tagesbereitschaft',start:'07:00',end:'19:00',color:'#159da8'},{id:'demo-standby-night',groupId:'demo-standby-group',name:'Nachtbereitschaft',start:'19:00',end:'07:00',color:'#263d75'}];
 const base=weekStart(new Date());let aid=1;
 for(let day=0;day<35;day++){const date=addDays(base,day);const dow=(date.getDay()+6)%7;const dateStr=isoDate(date);for(let i=0;i<10;i++){const team=teams[i],members=team.memberIds.map(id=>staff.find(x=>x[8]===id));if(dow<5){for(let j=0;j<5;j++){const person=members[j];if((day+j+i)%17===0){assignments.push({id:'demo-a-'+aid++,kind:'Dienstplan',team:team.name,employee:person[0],shift:'Urlaub',start:'',end:'',date:dateStr,isAbsence:true,note:'',color:'#d69b38'});continue;}const late=(j+day)%4===3;assignments.push({id:'demo-a-'+aid++,kind:'Dienstplan',team:team.name,employee:person[0],shift:late?'Spätdienst':'Tagdienst',start:late?'14:00':'07:00',end:late?'22:00':'15:00',color:late?'#263d75':colors[i],date:dateStr});}}else if(dow===5){const person=members[day%5];assignments.push({id:'demo-a-'+aid++,kind:'Dienstplan',team:team.name,employee:person[0],shift:'Frühdienst',start:'06:00',end:'14:00',color:'#159da8',date:dateStr});}
  if(!(i===1&&day===16)&&!(i===6&&day===23)){const standbyPerson=members[Math.floor(day/7)%5];assignments.push({id:'demo-a-'+aid++,kind:'Bereitschaft',team:team.name,employee:standbyPerson[0],shift:'Tagesbereitschaft',groupId:standbyGroups[0].id,groupName:standbyGroups[0].name,start:'07:00',end:'19:00',color:colors[i],date:dateStr});}}}
 currentUserId=staff[0]?.[8]||'';auditLog=[];exportLog=[];
 localStorage.setItem('dienstplanDemoDataVersion',DEMO_DATA_VERSION);['dienstplanDemoSession','dienstplanNotifications','dienstplanAuditLog','dienstplanExportLog'].forEach(k=>localStorage.removeItem(k));
 persistStaff();persistTeams();persistAssignments();save('dienstplanShiftTypes',shiftTypes);persistStandbyConfig();
}

/* Ergänzung 11/2026: neues „Team Donau“ (Teamleiter, Deputy, 8 Mitarbeiter) einmalig zu den
   bestehenden Daten hinzufügen. Vorhandene Daten bleiben unverändert; wird das Team später gelöscht,
   kommt es nicht wieder. Nach „Demo-Daten zurücksetzen“ wird es erneut angelegt. */
if(!localStorage.getItem('dienstplanAddTeamDonau')){
 try{
  if(!teams.some(t=>t.name==='Team Donau')&&teams.length<20){
   const people=[['Bernhard Pfeiffer','Teamleiter'],['Sandra Kofler','Deputy'],['Lukas Gartner','Mitarbeiter'],['Verena Zauner','Mitarbeiter'],['Moritz Reisinger','Mitarbeiter'],['Carina Pölzl','Mitarbeiter'],['Niklas Hackl','Mitarbeiter'],['Sabine Kraus','Mitarbeiter'],['Elias Danninger','Mitarbeiter'],['Jana Fellner','Mitarbeiter']];
   const mail=n=>n.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/\s+/g,'.')+'@example.at';
   const ids=people.map(([n,role],i)=>{const existing=staff.find(x=>x[0].toLowerCase()===n.toLowerCase());if(existing)return existing[8];
    let id='donau-emp-'+String(i+1).padStart(2,'0');if(staff.some(x=>x[8]===id))id=makeId();
    staff.push([n,initials(n),'Noch nicht eingeteilt','—','blue','Team Donau',mail(n),`+43 660 ${2000100+i*113}`,id,'',role]);return id});
   const color='#b5487d';
   teams.push({id:teams.some(t=>t.id==='team-donau')?makeId():'team-donau',name:'Team Donau',memberIds:ids,leaderId:ids[0],deputyId:ids[1],standbyColor:color});
   let nextId=Math.max(3000,...shiftTypes.map(x=>+x.id||0))+1;
   [['Tagdienst','07:00','15:00',color],['Frühdienst','06:00','14:00','#159da8'],['Spätdienst','14:00','22:00','#263d75']].forEach(([name,start,end,c])=>{if(!shiftTypes.some(x=>x.team==='Team Donau'&&x.name===name))shiftTypes.push({id:nextId++,team:'Team Donau',name,start,end,pause:0,color:c})});
   persistStaff();persistTeams();save('dienstplanShiftTypes',shiftTypes);
   auditLog.unshift({id:makeId(),ts:Date.now(),user:'System',role:'Admin',action:'Erstellt',area:'Administration',detail:`Team Donau mit ${ids.length} Personen angelegt (Teamleiter ${people[0][0]}, Deputy ${people[1][0]})`,title:'Team erstellt',object:'Team Donau',before:'',after:`${ids.length} Mitglieder`});try{save('dienstplanAuditLog',auditLog,true)}catch(e){}
  }
  localStorage.setItem('dienstplanAddTeamDonau','1');
 }catch(e){console.warn('Team Donau konnte nicht angelegt werden.',e)}
}

/* ------------------------------------------------------------------
   Benachrichtigungen
------------------------------------------------------------------ */
let notifications=(()=>{const saved=load('dienstplanNotifications',[]);return Array.isArray(saved)?saved.filter(n=>n&&n.id&&n.recipientId):[]})();
function persistNotifications(){save('dienstplanNotifications',notifications)}
function relevantNotifications(){return notifications.filter(n=>n.recipientId===currentUserId&&n.recipientRole===currentRole).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));}
function refreshNotifications(){
 const list=document.getElementById('notification-list');if(!list)return;
 const items=relevantNotifications(),unread=items.filter(n=>!n.read).length,badge=document.getElementById('notification-count');
 badge.textContent=unread>99?'99+':String(unread);badge.hidden=unread===0;
 document.getElementById('notification-summary').textContent=unread?`${unread} ungelesen`:'Keine ungelesenen Meldungen';
 document.getElementById('notification-read-all').disabled=unread===0;
 const delAll=document.getElementById('notification-delete-all');if(delAll)delAll.disabled=items.length===0;
 list.innerHTML=items.length?items.map(n=>{const target=n.targetPage==='Bereitschaft'?'Bereitschaft':'Dienstplan';return `<article class="notification-item ${n.read?'is-read':'is-unread'}" data-notification-open="${escapeHtml(n.id)}" role="button" tabindex="0" aria-label="${escapeHtml(n.title)} – ${n.swapId?'Diensttausch öffnen':'in '+target+' anzeigen'}"><span class="notification-dot" aria-hidden="true"></span><div class="notification-copy"><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.message)}</p><small>${fmtDateTime(n.createdAt||Date.now())} · ${n.swapId?'Diensttausch öffnen':'Zum Eintrag in '+target}</small></div><span class="notification-actions">${n.read?'':`<button type="button" class="notification-mark-read" data-notification-read="${escapeHtml(n.id)}" aria-label="Als gelesen markieren" title="Als gelesen markieren">✓</button>`}<button type="button" class="notification-delete" data-notification-delete="${escapeHtml(n.id)}" aria-label="Benachrichtigung löschen" title="Benachrichtigung löschen">${icon('trash')}</button></span></article>`}).join(''):'<div class="notification-empty">Du hast noch keine Benachrichtigungen.</div>';
}
function createAssignmentNotifications(items,{absence=false}={}){
 const created=[];
 for(const item of items){
  const team=teamByName(item.team);if(!team)continue;
  const isStandby=item.kind==='Bereitschaft';
  const dateText=fmt(new Date(item.date+'T12:00:00'));
  const timeText=item.start&&item.end?` · ${item.start}–${item.end} Uhr`:'';
  const typeText=absence?'Abwesenheit':(isStandby?'Bereitschaft':'Dienst');
  const details=`${item.employee} · ${item.team}${item.groupName?' · '+item.groupName:''} · ${item.shift||typeText} · ${dateText}${timeText}`;
  const targetPage=absence?'Dienstplan':(isStandby?'Bereitschaft':'Dienstplan');
  const add=(recipientId,recipientRole,title,message)=>{if(!recipientId)return;const pr=myNotifyPrefs(recipientId);if(recipientRole==='Mitarbeiter'||title.includes('für dich')){if(!pr.own)return}else if(absence?!pr.absence:!pr.team)return;created.push({id:makeId(),recipientId,recipientRole,title,message,createdAt:Date.now(),read:false,assignmentId:item.id,targetPage,targetDate:item.date});};
  if(!absence){const emp=staff.find(x=>x[0]===item.employee);if(emp)add(emp[8],emp[10]||'Mitarbeiter',isStandby?'Neue Bereitschaft für dich':'Neue Einteilung für dich',details);}
  add(team.leaderId,'Teamleiter',absence?'Neue Abwesenheit':(isStandby?'Neue Bereitschaft im Team':'Neuer Dienst im Team'),details);
  add(team.deputyId,'Deputy',absence?'Neue Abwesenheit':(isStandby?'Neue Bereitschaft im Team':'Neuer Dienst im Team'),details);
 }
 if(created.length){notifications.push(...created);try{save('dienstplanNotifications',notifications,true)}catch(e){notifications.splice(-created.length,created.length);console.warn('Benachrichtigungen konnten nicht gespeichert werden.',e)}}
 refreshNotifications();
}
const notificationTrigger=document.getElementById('notification-trigger');
const notificationPanel=document.getElementById('notification-panel');
notificationTrigger.onclick=()=>{const open=notificationPanel.hidden;notificationPanel.hidden=!open;notificationTrigger.setAttribute('aria-expanded',open?'true':'false');if(open)refreshNotifications()};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.notification-wrap,.app-dialog')){notificationPanel.hidden=true;notificationTrigger.setAttribute('aria-expanded','false')}});
/* Benachrichtigungen löschen (nur die eigenen) */
const isMine=n=>n.recipientId===currentUserId&&n.recipientRole===currentRole;
{const readAll=document.getElementById('notification-read-all');if(readAll&&!document.getElementById('notification-delete-all')){const box=document.createElement('div');box.className='notification-head-actions';readAll.replaceWith(box);box.appendChild(readAll);
 const del=document.createElement('button');del.type='button';del.className='notification-read-all notification-delete-all';del.id='notification-delete-all';del.textContent='Alle löschen';box.appendChild(del);
 del.onclick=async e=>{e.stopPropagation();const n=notifications.filter(isMine).length;if(!n)return;if(!await ask(`Alle ${n} Benachrichtigungen löschen?`,'Löschen'))return;notifications=notifications.filter(x=>!isMine(x));persistNotifications();refreshNotifications();toast('Alle Benachrichtigungen gelöscht.')}}}
document.getElementById('notification-read-all').onclick=()=>{let changed=false;notifications.forEach(n=>{if(n.recipientId===currentUserId&&n.recipientRole===currentRole&&!n.read){n.read=true;changed=true}});if(changed)persistNotifications();refreshNotifications()};
function openNotification(id){
 const item=notifications.find(n=>n.id===id&&n.recipientId===currentUserId&&n.recipientRole===currentRole);if(!item)return;
 if(!item.read){item.read=true;persistNotifications();}
 if(item.swapId){notificationPanel.hidden=true;notificationTrigger.setAttribute('aria-expanded','false');refreshNotifications();openSwapCenter(item.swapId);return}
 const page=['Dienstplan','Bereitschaft'].includes(item.targetPage)?item.targetPage:'Dienstplan';
 notificationPanel.hidden=true;notificationTrigger.setAttribute('aria-expanded','false');
 go(page);
 if(item.targetDate){const date=new Date(item.targetDate+'T12:00:00');if(!Number.isNaN(date.getTime())){currentDate=date;selectedMobileDate=item.targetDate;render();}}
}
document.getElementById('notification-list').addEventListener('click',e=>{
 const delButton=e.target.closest('[data-notification-delete]');
 if(delButton){e.stopPropagation();const id=delButton.dataset.notificationDelete;const before=notifications.length;notifications=notifications.filter(n=>!(n.id===id&&isMine(n)));if(notifications.length!==before){persistNotifications();refreshNotifications();toast('Benachrichtigung gelöscht.')}return;}
 const readButton=e.target.closest('[data-notification-read]');
 if(readButton){e.stopPropagation();const item=notifications.find(n=>n.id===readButton.dataset.notificationRead&&n.recipientId===currentUserId&&n.recipientRole===currentRole);if(item){item.read=true;persistNotifications();refreshNotifications()}return;}
 const row=e.target.closest('[data-notification-open]');if(row)openNotification(row.dataset.notificationOpen);
});
document.getElementById('notification-list').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-notification-open]')){e.preventDefault();openNotification(e.target.dataset.notificationOpen)}});


/* ------------------------------------------------------------------
   Mein Konto – öffnet sich über den Avatar oben rechts
------------------------------------------------------------------ */
const accountBtn=document.getElementById('top-avatar'),accountPanel=document.getElementById('account-panel');
let accountTab='konto';
function resizeImage(file,size=160){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const img=new Image();img.onerror=rej;img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=size;const k=Math.max(size/img.width,size/img.height),w=img.width*k,h=img.height*k;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,size,size);g.drawImage(img,(size-w)/2,(size-h)/2,w,h);res(c.toDataURL('image/jpeg',.85))};img.src=r.result};r.readAsDataURL(file)})}
function renderAccountPanel(){
 const me=staff.find(p=>p[8]===currentUserId);
 if(!me){accountPanel.innerHTML=`<div class="acc-empty"><p>Nicht angemeldet.</p><button class="btn primary" id="acc-login">Anmelden</button></div>`;document.getElementById('acc-login').onclick=()=>{closeAccount();openLogin()};return}
 const np=myNotifyPrefs(),tog=(id,on)=>`<button type="button" class="toggle ${on?'on':''}" id="${id}" role="switch" aria-checked="${on}"></button>`;
 const teamsTxt=currentUserTeamNames().join(', ')||'Ohne Team';
 accountPanel.innerHTML=`
  <div class="acc-head">
   <div class="acc-photo">${avatarHtml(me[0],teamColor(teamByName(currentUserTeamNames()[0]))||'#14A1A9',64)}<label class="acc-photo-btn" title="Profilbild ändern" aria-label="Profilbild ändern">${icon('upload')}<input type="file" id="acc-photo-input" accept="image/*" hidden></label></div>
   <div class="acc-id"><b>${escapeHtml(me[0])}</b><small>${escapeHtml(currentRole)} · ${escapeHtml(teamsTxt)}</small>${me[9]?`<button type="button" class="link-btn" id="acc-photo-remove">Profilbild entfernen</button>`:`<small class="muted">Tippe auf das Symbol, um ein Profilbild hochzuladen.</small>`}</div>
   <button type="button" class="icon-btn acc-close" id="acc-close" aria-label="Schließen">×</button>
  </div>
  <div class="segmented acc-tabs" role="tablist"><button type="button" role="tab" data-acc-tab="konto" class="${accountTab==='konto'?'active':''}">${icon('users')}Konto</button><button type="button" role="tab" data-acc-tab="notify" class="${accountTab==='notify'?'active':''}">${icon('bell')}Benachrichtigungen</button></div>
  <div class="acc-body">${accountTab==='konto'?`
   <p class="acc-sub">Deine Kontaktdaten – sichtbar für dein Team unter „Kontakte“.</p>
   <label class="field">E-Mail<input type="email" id="account-email" value="${escapeHtml(me[6]||'')}" autocomplete="email"></label>
   <label class="field">Bereitschaftsnummer<input type="text" inputmode="tel" id="account-phone" value="${escapeHtml(me[7]||'')}" autocomplete="tel"></label>
   <button class="btn primary acc-save" id="account-save">Kontaktdaten speichern</button>`:`
   <p class="acc-sub">Welche Meldungen du über die Glocke oben rechts erhältst.</p>
   <div class="setting-row"><div><b>Neue Einteilungen für mich</b><small>Dienste und Bereitschaften, die für dich angelegt werden</small></div>${tog('notify-own',np.own)}</div>
   <div class="setting-row"><div><b>Neue Dienste in meinen Teams</b><small>Nur für Teamleiter und Deputys</small></div>${tog('notify-team',np.team)}</div>
   <div class="setting-row"><div><b>Abwesenheiten in meinen Teams</b><small>Urlaub, Arztbesuch, Berufsschule …</small></div>${tog('notify-absence',np.absence)}</div>`}
  </div>
  <div class="acc-foot"><button type="button" class="btn ghost" id="acc-settings">${icon('gear')}Einstellungen</button><button type="button" class="btn" id="switch-user">${icon('refresh')}Benutzer wechseln</button></div>`;
 document.getElementById('acc-close').onclick=closeAccount;
 accountPanel.querySelectorAll('[data-acc-tab]').forEach(b=>b.onclick=()=>{accountTab=b.dataset.accTab;renderAccountPanel()});
 document.getElementById('switch-user').onclick=()=>{closeAccount();openLogin()};
 document.getElementById('acc-settings').onclick=()=>{closeAccount();go('Einstellungen')};
 const inp=document.getElementById('acc-photo-input');inp.onchange=async()=>{const f=inp.files[0];if(!f)return;if(!f.type.startsWith('image/')){toast('Bitte eine Bilddatei wählen.');return}try{me[9]=await resizeImage(f);persistStaff();audit('Geändert','Kontakte',me[0],{title:'Profilbild geändert',object:me[0]});updateSignedInUser();render();renderAccountPanel();toast('Profilbild gespeichert.')}catch(e){toast('Das Bild konnte nicht gelesen werden.')}};
 const rm=document.getElementById('acc-photo-remove');if(rm)rm.onclick=()=>{me[9]='';persistStaff();audit('Gelöscht','Kontakte',me[0],{title:'Profilbild entfernt',object:me[0]});updateSignedInUser();render();renderAccountPanel();toast('Profilbild entfernt.')};
 const as=document.getElementById('account-save');if(as)as.onclick=()=>{const before=`${me[6]||'—'} · ${me[7]||'—'}`;me[6]=document.getElementById('account-email').value.trim();me[7]=document.getElementById('account-phone').value.trim();persistStaff();audit('Geändert','Kontakte',me[0],{title:'Kontaktdaten geändert',object:me[0],before,after:`${me[6]||'—'} · ${me[7]||'—'}`});if(currentPage==='Kontakte')render();toast('Kontaktdaten gespeichert.')};
 ['own','team','absence'].forEach(k=>{const el=document.getElementById('notify-'+k);if(el)el.onclick=()=>{const on=!el.classList.contains('on');el.classList.toggle('on',on);el.setAttribute('aria-checked',on);np[k]=on;notifyPrefs[currentUserId]=np;save('dienstplanNotifyPrefs',notifyPrefs);toast('Einstellungen gespeichert.')}});
}
function openAccount(tab){if(tab)accountTab=tab;renderAccountPanel();accountPanel.hidden=false;accountBtn.setAttribute('aria-expanded','true');notificationPanel.hidden=true;document.body.classList.add('account-open')}
function closeAccount(){accountPanel.hidden=true;accountBtn.setAttribute('aria-expanded','false');document.body.classList.remove('account-open')}
document.getElementById('back-dashboard').onclick=()=>go('Dashboard');
accountBtn.onclick=()=>accountPanel.hidden?openAccount():closeAccount();
document.addEventListener('pointerdown',e=>{if(!accountPanel.hidden&&!e.target.closest('.account-wrap'))closeAccount()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!accountPanel.hidden)closeAccount()});
/* ------------------------------------------------------------------
   Navigation, Seitenleiste, Design
------------------------------------------------------------------ */
function go(page){
 if(!allowedPages().includes(page)){toast('Dieser Navigationspunkt ist für deine Benutzergruppe nicht freigegeben.');return;}
 
 currentPage=page;try{sessionStorage.setItem('dienstplanPage',page)}catch(e){}
 if(page==='Dienstplan'||page==='Bereitschaft'){currentView=defaults[page]||'Woche';if(page==='Bereitschaft'&&currentView==='Team')currentView='Woche';currentDate=new Date();selectedMobileDate='';}
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
 document.getElementById('crumb').textContent=page;render();closeMobileNav();window.scrollTo(0,0);
}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
const mobileNavButton=document.getElementById('mobile-menu');
const closeMobileNav=()=>{document.getElementById('sidebar').classList.remove('open');mobileNavButton.setAttribute('aria-expanded','false');};
mobileNavButton.setAttribute('aria-expanded','false');mobileNavButton.setAttribute('aria-controls','sidebar');
mobileNavButton.onclick=()=>{const opened=document.getElementById('sidebar').classList.toggle('open');mobileNavButton.setAttribute('aria-expanded',opened?'true':'false');};
document.addEventListener('pointerdown',e=>{if(window.matchMedia('(max-width: 700px)').matches&&!e.target.closest('#sidebar')&&!e.target.closest('#mobile-menu'))closeMobileNav();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileNav()});
// Rechtsklick nur im Kalender unterdrücken (verhindert Konflikte mit dem Markieren per Ziehen).
document.addEventListener('contextmenu',e=>{if(e.target.closest('.calendar-card'))e.preventDefault()});

const sidebar=document.getElementById('sidebar');
document.querySelectorAll('#main-nav .nav-item').forEach(item=>{item.title=item.dataset.page;item.setAttribute('aria-label',item.dataset.page);});
const sidebarCollapse=document.getElementById('sidebar-collapse');
const setSidebarArrow=collapsed=>{sidebarCollapse.title=collapsed?'Menü ausklappen':'Menü einklappen';sidebarCollapse.setAttribute('aria-label',sidebarCollapse.title);};
// Tablet & kleine Laptops: Seitenleiste automatisch auf Symbole verkleinern, damit mehr Platz bleibt
const sidebarAuto=()=>window.innerWidth>700&&window.innerWidth<=1180;
let sidebarManual=false;
if(localStorage.getItem('dienstplanSidebarCollapsed')==='1'||sidebarAuto()){sidebar.classList.add('collapsed');setSidebarArrow(true);}
window.addEventListener('resize',()=>{if(sidebarManual||window.innerWidth<=700)return;const c=sidebarAuto()||localStorage.getItem('dienstplanSidebarCollapsed')==='1';sidebar.classList.toggle('collapsed',c);setSidebarArrow(c)});
sidebarCollapse.onclick=()=>{sidebarManual=true;const collapsed=sidebar.classList.toggle('collapsed');localStorage.setItem('dienstplanSidebarCollapsed',collapsed?'1':'0');setSidebarArrow(collapsed);};

// [Farbe, Hover, dunkle Variante, Farbe im Dunkelmodus]
const ACCENTS={turquoise:['#14A1A9','#0e8a91','#0b7f86','#14A1A9'],navy:['#0068A8','#00588f','#004d7d','#2f8fd1']};
const ACCENT_LABEL={turquoise:'Türkis',navy:'Blau'};
const systemDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
function applyTheme(mode){
 if(!['light','dark','system'].includes(mode))mode='light';
 localStorage.setItem('dienstplanTheme',mode);
 const dark=mode==='dark'||(mode==='system'&&!!systemDark&&systemDark.matches);
 document.body.classList.toggle('dark-mode',dark);
 const t=document.querySelector('#theme-toggle use');if(t)t.setAttribute('href',dark?'#i-sun':'#i-moon');
 applyAccentColor(localStorage.getItem('dienstplanAccentColor')||'turquoise');
}
if(systemDark&&systemDark.addEventListener)systemDark.addEventListener('change',()=>{if(localStorage.getItem('dienstplanTheme')==='system')applyTheme('system')});
function applyAccentColor(key){
 if(!ACCENTS[key])key='turquoise';localStorage.setItem('dienstplanAccentColor',key);
 const dark=document.body.classList.contains('dark-mode'),[base,hov,d,darkC]=ACCENTS[key],c=dark?darkC:base,h=dark&&darkC!==base?base:hov,st=document.body.style;
 const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)).join(',');
 st.setProperty('--accent-color',c);st.setProperty('--accent-hover',h);st.setProperty('--accent-dark',dark?`color-mix(in srgb,${c} 55%,#fff)`:d);
 st.setProperty('--accent-soft',dark?`rgba(${rgb},.18)`:`color-mix(in srgb,${c} 11%,#fff)`);st.setProperty('--accent-ring',`rgba(${rgb},.2)`);
 document.body.classList.toggle('navy-accent',key==='navy');
}
function applyFontScale(v){if(!['small','normal','large'].includes(v))v='normal';localStorage.setItem('dienstplanFontScale',v);document.documentElement.style.zoom=window.matchMedia('(max-width: 700px)').matches?'':{small:'0.92',normal:'',large:'1.1'}[v];}
function applyCompact(on){localStorage.setItem('dienstplanCompact',on?'1':'0');document.body.classList.toggle('compact',!!on);}
applyTheme(localStorage.getItem('dienstplanTheme')||'light');
applyFontScale(localStorage.getItem('dienstplanFontScale')||'normal');
applyCompact(false);
document.getElementById('theme-toggle').onclick=()=>{applyTheme(document.body.classList.contains('dark-mode')?'light':'dark');render();};
function updateTopDate(){document.getElementById('top-date').textContent=fmtShortWd(new Date())+' · KW '+isoWeek(new Date())}
updateTopDate();

/* ------------------------------------------------------------------
   Anmeldung (Demo)
------------------------------------------------------------------ */
let hasSession=false;
function updateSignedInUser(){
 const person=staff.find(x=>x[8]===currentUserId);
 const name=person?person[0]:'Benutzer wählen';
 document.querySelector('.profile-copy b').textContent=name;
 const face=person&&person[9]?`<img src="${escapeHtml(person[9])}" alt="">`:escapeHtml(initials(name));
 document.querySelector('.avatar').innerHTML=face;
 document.querySelector('.top-avatar').innerHTML=face;
 if(!document.getElementById('account-panel').hidden)renderAccountPanel();
 document.getElementById('role-label').textContent=currentRole+(currentUserTeamNames()[0]?' · '+currentUserTeamNames()[0]:'');
}
let loginSel={userId:'',role:''};
function openLogin(){
 const modal=document.getElementById('login-modal'),list=document.getElementById('login-user-list'),search=document.getElementById('login-user-search'),chips=document.getElementById('login-role-chips');
 loginSel={userId:currentUserId||staff[0]?.[8]||'',role:''};
 const userRole=id=>{const p=staff.find(x=>x[8]===id);return p&&roles.includes(p[10])?p[10]:(roles[0]||'Mitarbeiter')};
 loginSel.role=hasSession&&loginSel.userId===currentUserId?currentRole:userRole(loginSel.userId);
 const drawRoles=()=>{chips.innerHTML=roles.map(r=>`<button type="button" class="${r===loginSel.role?'active':''}" data-login-role="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('');chips.querySelectorAll('[data-login-role]').forEach(b=>b.onclick=()=>{loginSel.role=b.dataset.loginRole;drawRoles()})};
 const drawUsers=()=>{const q=(search.value||'').trim().toLowerCase();const items=staff.filter(x=>!q||x[0].toLowerCase().includes(q)||(x[10]||'').toLowerCase().includes(q)||teams.some(t=>t.memberIds.includes(x[8])&&t.name.toLowerCase().includes(q)));
  list.innerHTML=items.map(x=>{const t=teams.find(t=>t.memberIds.includes(x[8]));return `<button type="button" role="option" aria-selected="${x[8]===loginSel.userId}" class="login-user ${x[8]===loginSel.userId?'selected':''}" data-login-user="${escapeHtml(x[8])}">${avatarHtml(x[0],teamColor(t),38)}<span><b>${escapeHtml(x[0])}</b><small>${escapeHtml(t?.name||'Ohne Team')}</small></span><em class="${(x[10]||'')==='Admin'?'admin':''}">${escapeHtml(x[10]||'Mitarbeiter')}</em></button>`}).join('')||'<div class="empty-note">Kein Benutzer gefunden.</div>';
  list.querySelectorAll('[data-login-user]').forEach(b=>{b.onclick=()=>{loginSel.userId=b.dataset.loginUser;loginSel.role=userRole(loginSel.userId);drawUsers();drawRoles()};b.ondblclick=()=>document.getElementById('login-form').requestSubmit()});
  list.querySelector('.selected')?.scrollIntoView({block:'nearest'});};
 search.value='';search.oninput=()=>{drawUsers();const first=list.querySelector('[data-login-user]');if(first&&!list.querySelector('.selected')){loginSel.userId=first.dataset.loginUser;loginSel.role=userRole(loginSel.userId);drawUsers();drawRoles()}};
 drawUsers();drawRoles();
 const today=isoDate(new Date()),todays=assignments.filter(a=>a.date===today&&!a.isAbsence&&(a.kind==='Dienstplan'||a.kind==='Bereitschaft'));
 document.getElementById('login-hero-stats').textContent=`${teams.length} Teams · ${staff.length} Mitarbeiter · alle Schichten auf einen Blick.`;
 const d=todays.find(a=>a.kind==='Dienstplan'),sb=todays.find(a=>a.kind==='Bereitschaft');
 document.getElementById('login-hero-card').innerHTML=[d?`<div><i></i><span><b>${escapeHtml(d.shift)} · ${d.start}–${d.end}</b><small>${escapeHtml(d.team)} · ${todays.filter(a=>a.kind==='Dienstplan'&&a.team===d.team).length} Mitarbeiter</small></span></div>`:'',sb?`<div><i></i><span><b>Bereitschaft · ${sb.start}–${sb.end}</b><small>${escapeHtml(sb.employee)} · ${escapeHtml(sb.team)}</small></span></div>`:''].join('');
 document.getElementById('login-close').hidden=!hasSession;
 modal.hidden=false;if(!window.matchMedia('(pointer: coarse)').matches)setTimeout(()=>search.focus(),30);
}
document.getElementById('profile-menu').onclick=e=>{e.stopPropagation();openLogin()};
document.querySelector('.profile').addEventListener('click',()=>openLogin());
document.getElementById('login-close').onclick=()=>{if(hasSession)document.getElementById('login-modal').hidden=true};
document.getElementById('login-modal').addEventListener('keydown',e=>{if(e.key==='Escape'&&hasSession)document.getElementById('login-modal').hidden=true});
document.getElementById('login-form').onsubmit=e=>{
 e.preventDefault();
 const user=staff.find(x=>x[8]===loginSel.userId),role=loginSel.role;
 if(!user||!roles.includes(role)){toast('Bitte Benutzer und Rolle auswählen.');return}
 currentUserId=user[8];currentRole=role;hasSession=true;
 save('dienstplanDemoSession',{userId:currentUserId,role:currentRole});
 updateSignedInUser();
 calendarTeams=currentUserTeamNames().slice(0,1);calendarTeamFilter=calendarTeams[0]||'Alle Teams';calendarMemberFilter='Alle Mitarbeiter';
 if(!allowedPages().includes(currentPage))currentPage=allowedPages()[0]||'Einstellungen';
 refreshNotifications();
 document.getElementById('login-modal').hidden=true;
 toast('Angemeldet als '+user[0]+' · '+role);
 render();
};
function restoreDemoSession(){
 const session=load('dienstplanDemoSession',null);
 if(session&&staff.some(x=>x[8]===session.userId)&&roles.includes(session.role)){currentUserId=session.userId;currentRole=session.role;updateSignedInUser();return true}
 updateSignedInUser();return false;
}

/* Globale Suche (Strg K): Seiten, Mitarbeiter, Teams und Dienstzeiten */
function openGlobalSearch(){
 if(document.getElementById('global-search'))return;
 const layer=document.createElement('div');layer.className='modal-backdrop search-layer';layer.id='global-search';
 layer.innerHTML=`<div class="search-box" role="dialog" aria-modal="true" aria-label="Suche"><label class="search-input">${icon('search')}<input type="search" placeholder="Mitarbeiter, Team, Dienst oder Seite suchen …" autocomplete="off"><kbd>Esc</kbd></label><div class="search-results"></div><div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> auswählen</span><span><kbd>Enter</kbd> öffnen</span></div></div>`;
 document.body.appendChild(layer);
 const input=layer.querySelector('input'),res=layer.querySelector('.search-results');let items=[],sel=0;
 const close=()=>{layer.remove();document.removeEventListener('keydown',key,true)};
 const build=()=>{const q=input.value.trim().toLowerCase();const out=[];
  allowedPages().forEach(p=>{if(!q||p.toLowerCase().includes(q))out.push({group:'Seiten',label:p,sub:'Seite öffnen',ic:'grid',run:()=>go(p)})});
  if(q){
   staff.filter(p=>p[0].toLowerCase().includes(q)||(p[6]||'').toLowerCase().includes(q)).slice(0,8).forEach(p=>{const t=teams.find(t=>t.memberIds.includes(p[8]));out.push({group:'Mitarbeiter',label:p[0],sub:`${p[10]||'Mitarbeiter'} · ${t?.name||'Ohne Team'}${p[7]?' · '+p[7]:''}`,ic:'users',run:()=>{if(allowedPages().includes('Dienstplan')){calendarTeams=t?[t.name]:[];calendarMemberFilter=p[0];go('Dienstplan')}else go('Kontakte')}})});
   teams.filter(t=>t.name.toLowerCase().includes(q)).forEach(t=>out.push({group:'Teams',label:t.name,sub:`${t.memberIds.length} Mitarbeiter · im Dienstplan anzeigen`,ic:'build',run:()=>{calendarTeams=[t.name];calendarMemberFilter='Alle Mitarbeiter';go(allowedPages().includes('Dienstplan')?'Dienstplan':'Kontakte')}}));
   shiftTypes.filter(x=>x.name.toLowerCase().includes(q)).slice(0,6).forEach(x=>out.push({group:'Dienstzeiten',label:`${x.name} (${x.start}–${x.end})`,sub:x.team,ic:'clock',run:()=>go(allowedPages().includes('Dienstzeiten')?'Dienstzeiten':'Dienstplan')}));
  }
  items=out.slice(0,24);sel=Math.min(sel,Math.max(0,items.length-1));
  let last='';res.innerHTML=items.length?items.map((it,i)=>{const h=it.group!==last?`<div class="search-group">${it.group}</div>`:'';last=it.group;return h+`<button type="button" class="search-item ${i===sel?'active':''}" data-i="${i}">${icon(it.ic)}<span><b>${escapeHtml(it.label)}</b><small>${escapeHtml(it.sub)}</small></span></button>`}).join(''):'<div class="empty-note">Keine Treffer.</div>';
  res.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const it=items[+b.dataset.i];close();it.run()});
 };
 const key=e=>{if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sel=(sel+(e.key==='ArrowDown'?1:-1)+items.length)%Math.max(1,items.length);build();res.querySelector('.active')?.scrollIntoView({block:'nearest'})}else if(e.key==='Enter'&&items[sel]){e.preventDefault();const it=items[sel];close();it.run()}};
 document.addEventListener('keydown',key,true);
 layer.addEventListener('click',e=>{if(e.target===layer)close()});
 input.oninput=()=>{sel=0;build()};build();setTimeout(()=>input.focus(),20);
}
document.getElementById('global-search-btn').onclick=openGlobalSearch;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){if(!document.getElementById('login-modal').hidden)return;e.preventDefault();openGlobalSearch()}});

/* ------------------------------------------------------------------
   Gemeinsame Bausteine
------------------------------------------------------------------ */
const pageKicker={'Dashboard':'ÜBERSICHT','Dienstplan':'PLANUNG','Bereitschaft':'RUFBEREITSCHAFT','Dienstzeiten':'PLANUNG','Kontakte':'TEAM','Berichte / Export':'AUSWERTUNG','Einstellungen':'PERSÖNLICH','Bereitschaft verwalten':'ADMINISTRATION · BEREITSCHAFT'};
function heading(title,sub,actions=''){return `<div class="page-heading"><div><div class="eyebrow">${pageKicker[currentPage]||'VERWALTUNG'}</div><h1>${title}</h1><p class="sub">${sub}</p></div><div class="btn-row">${actions}</div></div>`}
function teamColor(t){if(!t)return '#14A1A9';return /^#[0-9a-f]{6}$/i.test(t.standbyColor||'')?t.standbyColor:(shiftHexColor(shiftTypes.find(s=>s.team===t.name)?.color)||'#14A1A9')}
function avatarHtml(name,color,size=30){const p=staff.find(x=>x[0]===name);return `<span class="av" style="--c:${color};width:${size}px;height:${size}px;font-size:${Math.round(size*.36)}px">${p&&p[9]?`<img src="${escapeHtml(p[9])}" alt="">`:escapeHtml(initials(name))}</span>`}
function shiftHexColor(value){
 const map={blue:'#3974c6',green:'#24966b',amber:'#e09a2d',red:'#dc6475',purple:'#9b69c8',teal:(localStorage.getItem('dienstplanAccentColor')==='navy'?'#004d7d':'#159da8')};
 return map[value]||(/^#[0-9a-f]{6}$/i.test(value||'')?value:'#3974c6');
}
function assignmentColor(a){if(a.isAbsence)return '#d69b38';return a.kind==='Bereitschaft'?(teamByName(a.team)?.standbyColor||a.color||'#159da8'):(a.color||'blue')}
function colorWithAlpha(hex,alpha){
 if(document.body.classList.contains('dark-mode')&&alpha<=.15)alpha=.34;
 const c=shiftHexColor(hex);const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);
 return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------
   Kalender: Dienstplan & Bereitschaft
------------------------------------------------------------------ */
// Wie viele Einträge pro Tag direkt sichtbar sind, hängt von der Bildschirmhöhe ab (große Monitore zeigen mehr).
function entryLimit(){const h=window.innerHeight||800;if(currentView==='Woche')return Math.max(4,Math.floor((h-330)/68));if(currentView==='Monat'){const weeks=Math.ceil((new Date(currentDate.getFullYear(),currentDate.getMonth()+1,0).getDate()+6)/7);return Math.max(2,Math.floor(((h-330)/weeks-34)/50))}return 99}
let resizeTimer=null;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if((currentPage==='Dienstplan'||currentPage==='Bereitschaft')&&!document.querySelector('.modal-backdrop:not([hidden])'))render()},250)});
function calDays(){return currentPage==='Bereitschaft'?7:dutyDays}
/* Konflikte: Dienst + ganztägige Abwesenheit oder überlappende untertägige Abwesenheit am selben Tag */
const shiftMulti=s=>!s||s.multi!==false;// Standard: Dienst darf mehrfach am Tag besetzt werden
function timeSpan(a){const m=t=>{const [h,mm]=String(t).split(':').map(Number);return h*60+(mm||0)};if(!a.start||!a.end)return [0,1440];const s=m(a.start);let e=m(a.end);if(e<=s)e+=1440;return [s,e]}
/* Konflikte: Dienst oder Bereitschaft an einem Abwesenheitstag sowie Dienste, die über Mitternacht in den nächsten Dienst hineinreichen. */
function computeConflicts(list=assignments){
 const by={};list.forEach(a=>{if(a.kind==='Dienstplan'||a.kind==='Bereitschaft'){(by[a.employee+'|'+a.date]=by[a.employee+'|'+a.date]||[]).push(a)}});
 const ids=new Set();
 Object.values(by).forEach(items=>{const work=items.filter(a=>!a.isAbsence),abs=items.filter(a=>a.isAbsence);if(!work.length||!abs.length)return;
  abs.forEach(x=>{if(x.shift==='Urlaub 1/2 Tag')return;const partial=x.start&&x.end;work.forEach(w=>{let overlap=!partial;if(partial){const [xs,xe]=timeSpan(x),[ws,we]=timeSpan(w);overlap=xs<we&&ws<xe}if(overlap){ids.add(w.id);ids.add(x.id)}})})});
 list.forEach(a=>{if(a.kind!=='Dienstplan'||a.isAbsence||!a.start||!a.end)return;const [s,e]=timeSpan(a);if(e<=1440)return;
  const next=isoDate(addDays(new Date(a.date+'T12:00:00'),1));(by[a.employee+'|'+next]||[]).forEach(n=>{if(n.kind!=='Dienstplan'||n.isAbsence||!n.start)return;if(timeSpan(n)[0]<e-1440){ids.add(a.id);ids.add(n.id)}})});
 return ids;
}
/* Rückgängig (Strg Z) für Änderungen im Kalender */
let undoStack=[];
function pushUndo(label){undoStack.push({label,data:JSON.stringify(assignments)});if(undoStack.length>25)undoStack.shift();}
function undoLast(){const last=undoStack.pop();if(!last){toast('Nichts zum Rückgängigmachen.');return}assignments=JSON.parse(last.data);persistAssignments();audit('Geändert','Dienstplan','Rückgängig: '+last.label,{title:'Änderung rückgängig gemacht',object:last.label});toast('Rückgängig: '+last.label);render()}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&(currentPage==='Dienstplan'||currentPage==='Bereitschaft')&&!e.target.closest('input,textarea,select,[contenteditable]')&&document.getElementById('login-modal').hidden){e.preventDefault();undoLast()}});
function weekHoursOf(name,ws){const a=isoDate(ws),b=isoDate(addDays(ws,6));return assignments.filter(x=>x.employee===name&&x.kind==='Dienstplan'&&!x.isAbsence&&x.date>=a&&x.date<=b).reduce((s,x)=>s+netHours(x),0)}
function netHours(a){const st=shiftTypes.find(s=>s.team===a.team&&s.name===a.shift);return Math.max(0,durationHours(a.start,a.end)-((st&&+st.pause)||0)/60)}
function standbyGapRanges(teamName,dates){const out=[];let cur=null;dates.forEach(date=>{const has=assignments.some(a=>a.kind==='Bereitschaft'&&a.team===teamName&&a.date===date);if(!has){if(cur&&cur.to===isoDate(addDays(new Date(date+'T12:00:00'),-1)))cur.to=date;else{cur={from:date,to:date};out.push(cur)}}});return out}

function calendar(){
 const isDuty=currentPage==='Dienstplan',title=isDuty?'Dienstplan':'Bereitschaft',d=new Date(currentDate),first=new Date(d.getFullYear(),d.getMonth(),1),last=new Date(d.getFullYear(),d.getMonth()+1,0);
 const n=calDays();
 const views=isDuty?['Tag','Woche','Monat','Team']:['Tag','Woche','Monat','Zeitleiste'];
 if(!views.includes(currentView))currentView='Woche';
 const ws=weekStart(d),we=addDays(ws,n-1);
 const kw=`<span class="kw-pill">KW ${isoWeek(ws)}</span>`;
 const range=(currentView==='Woche'||currentView==='Team'||currentView==='Zeitleiste')?`${fmt(ws)} – ${fmt(we)} ${kw}`:currentView==='Monat'?monthName(d):fmtWithWeekday(d);
 const conflicts=computeConflicts();buildWpIndex();
 const visible=assignments.filter(a=>{const kindMatches=!isDuty?a.kind==='Bereitschaft':(a.kind==='Dienst'||a.kind==='Abwesenheit'||a.kind==='Dienstplan'||a.kind==='Arbeitsort')||(a.kind==='Bereitschaft'&&canSeeStandbyInDutyPlan(a));return kindMatches&&calTeamOk(a.team)&&(calendarMemberFilter==='Alle Mitarbeiter'||a.employee===calendarMemberFilter)&&(!onlyConflicts||conflicts.has(a.id))&&!wpMerged(a)});
 const byDate={};visible.forEach(a=>{(byDate[a.date]=byDate[a.date]||[]).push(a)});
 const dayEntries=date=>(byDate[date]||[]).slice().sort((a,b)=>(a.kind==='Bereitschaft'?-1:0)-(b.kind==='Bereitschaft'?-1:0)||(a.start||'').localeCompare(b.start||''));
 const movable=a=>!a.isAbsence&&a.kind!=='Arbeitsort'&&canEditEntry(a.team,a.employee,areaOf(a))||(a.kind==='Arbeitsort'&&managesTeam(a.team,'Dienstplan'));
 const actionsMenu=a=>`<details class="duty-actions"><summary aria-label="Dienstaktionen" title="Dienstaktionen">⋯</summary><div class="duty-actions-menu">${a.isAbsence||a.kind==='Arbeitsort'?'':`<button type="button" data-edit-duty="${a.id}">Bearbeiten</button>`}${movable(a)&&a.kind!=='Arbeitsort'?`<button type="button" data-copy-duty="${a.id}">Auf nächsten Tag kopieren</button>`:''}${canSwapDuty(a)?`<button type="button" data-swap-duty="${a.id}">${icon('refresh')}Dienst tauschen</button>`:''}${wpFor(a)?`<button type="button" data-edit-wp="${wpFor(a).id}">Arbeitsort ändern</button><button type="button" data-delete-duty="${wpFor(a).id}">Arbeitsort entfernen</button>`:''}<button type="button" class="danger-text" data-delete-duty="${a.id}">Löschen</button></div></details>`;
 const dayCard=a=>`<div class="calendar-assignment ${a.kind==='Bereitschaft'?'standby-assignment ':''}${a.isAbsence?'absence-assignment ':''}${a.kind==='Arbeitsort'?'workplace-assignment ':''}${conflicts.has(a.id)?'conflict ':''}" ${movable(a)?`draggable="true" data-drag-id="${a.id}"`:''} title="${escapeHtml(a.employee)} · ${escapeHtml(a.shift)}${conflicts.has(a.id)?' · Konflikt':''}" style="--shift-color:${shiftHexColor(assignmentColor(a))}">${conflicts.has(a.id)&&!a.isAbsence?'<span class="conflict-indicator">⚠ Konflikt</span>':''}${a.kind==='Bereitschaft'?'<span class="standby-indicator">◷ Bereitschaft</span>':a.kind==='Arbeitsort'?`<span class="workplace-indicator">⌂ ${escapeHtml(a.shift)}</span>`:''}<b>${escapeHtml(a.employee)}</b><span class="ca-shift">${a.isAbsence?'Abwesenheit: ':''}${escapeHtml(a.shift)}</span>${a.start&&a.end?`<span class="ca-time">${a.start}–${a.end}</span>`:''}${wpHint(wpFor(a))}${swapPill(a)}${a.note?`<div class="absence-note"><span class="absence-note-label">Bemerkung</span><span>${escapeHtml(a.note)}</span></div>`:''}<small>${escapeHtml(a.team)}${a.groupName?' · '+escapeHtml(a.groupName):''}</small>${actionsMenu(a)}</div>`;
 const dayStack=date=>{const entries=dayEntries(date);
  if(currentView==='Monat'&&expandedMonthView)return entries.map(dayCard).join('');
  const limit=entryLimit(),shown=entries.slice(0,limit),remaining=entries.length-shown.length;
  return shown.map(dayCard).join('')+(remaining>0?`<button type="button" class="calendar-more" data-open-day="${date}" aria-label="${remaining} weitere Einträge am ${date} anzeigen">+${remaining} weitere</button>`:'');};
 const agendaCard=a=>`<div class="mobile-agenda-card ${a.kind==='Bereitschaft'?'standby-assignment':''} ${a.isAbsence?'absence-assignment':''} ${conflicts.has(a.id)?'conflict':''}" style="--shift-color:${shiftHexColor(assignmentColor(a))}"><div class="mobile-agenda-time">${a.start||'—'}<small>${a.end||''}</small></div><div class="mobile-agenda-content">${a.kind==='Bereitschaft'?'<span class="standby-indicator">◷ Bereitschaft</span>':''}<b>${a.kind==='Arbeitsort'?escapeHtml(a.shift)+' (Arbeitsort)':escapeHtml(a.shift)}</b><span>${escapeHtml(a.employee)}</span>${wpHint(wpFor(a))}${swapPill(a)}<small>${escapeHtml(a.team)}${a.groupName?' · '+escapeHtml(a.groupName):''}</small></div>${actionsMenu(a)}</div>`;
 const todayIso=isoDate(new Date());
 const shownTeams=teams.filter(t=>calTeamOk(t.name));
 let body='';
 if(currentView==='Woche'){
  body=`<div class="week-grid compact-week cal-cols mobile-hide-calendar" style="--cols:${n}">`;
  for(let i=0;i<n;i++){const x=addDays(ws,i),date=isoDate(x);body+=`<div class="day-head ${date===todayIso?'today':''}">${WEEKDAYS[i]}<b>${x.getDate()}</b></div>`;}
  for(let i=0;i<n;i++){const date=isoDate(addDays(ws,i));body+=`<div class="week-day-cell ${date===todayIso?'today':''}" data-calendar-day="${date}" data-drop-date="${date}">${dayStack(date)||'<span class="calendar-empty">—</span>'}</div>`;}
  body+='</div>';
  const selected=selectedMobileDate&&selectedMobileDate>=isoDate(ws)&&selectedMobileDate<=isoDate(we)?selectedMobileDate:(isoDate(d)>=isoDate(ws)&&isoDate(d)<=isoDate(we)?isoDate(d):isoDate(ws));
  body+=`<div class="mobile-agenda-view mobile-week-view"><div class="mobile-date-strip cal-cols" style="--cols:${n}">${Array.from({length:n},(_,i)=>{const x=addDays(ws,i),date=isoDate(x);return `<button type="button" class="mobile-date-button ${date===selected?'selected':''} ${date===todayIso?'is-today':''}" data-mobile-date="${date}"><small>${WEEKDAYS[i]}</small><b>${x.getDate()}</b>${dayEntries(date).length?'<i></i>':''}</button>`}).join('')}</div><div class="mobile-agenda-heading"><b>${fmtWithWeekday(new Date(selected+'T12:00:00'))}</b><span>${dayEntries(selected).length} Einträge</span></div><div class="mobile-agenda-list">${dayEntries(selected).length?dayEntries(selected).map(agendaCard).join(''):'<div class="mobile-agenda-empty">Keine Einträge für diesen Tag.</div>'}</div></div>`;
 }else if(currentView==='Monat'){
  const firstDow=(first.getDay()+6)%7,offset=firstDow<n?firstDow:0;
  body=`<div class="month-grid cal-cols mobile-hide-calendar" style="--cols:${n}">`+WEEKDAYS.slice(0,n).map(x=>`<div class="month-head">${x}</div>`).join('');
  for(let i=0;i<offset;i++)body+='<div class="month-cell is-blank"></div>';
  for(let day=1;day<=last.getDate();day++){const x=new Date(d.getFullYear(),d.getMonth(),day);if((x.getDay()+6)%7>=n)continue;const date=isoDate(x);body+=`<div class="month-cell ${date===todayIso?'today':''}" data-calendar-day="${date}" data-drop-date="${date}"><div class="date">${day}</div>${dayStack(date)}</div>`;}
  body+='</div>';
  const monthKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const selected=selectedMobileDate&&selectedMobileDate.startsWith(monthKey)?selectedMobileDate:isoDate(d);
  const mobileDays=[];for(let day=1;day<=last.getDate();day++){const x=new Date(d.getFullYear(),d.getMonth(),day);if((x.getDay()+6)%7<n)mobileDays.push(x)}
  body+=`<div class="mobile-agenda-view mobile-month-view"><div class="mobile-month-overview"><div class="mobile-month-title"><div><span>MONATSÜBERSICHT</span><b>${monthName(d)}</b></div><small>${visible.filter(a=>a.date.startsWith(monthKey)).length} Einträge im Monat</small></div><div class="mobile-month-grid cal-cols" style="--cols:${n}">${WEEKDAYS.slice(0,n).map(x=>`<span class="mobile-month-weekday">${x}</span>`).join('')}${Array.from({length:offset},()=>'<span class="mobile-month-blank"></span>').join('')}${mobileDays.map(x=>{const date=isoDate(x),count=dayEntries(date).length;return `<button type="button" class="mobile-month-day ${date===selected?'selected':''} ${date===todayIso?'is-today':''} ${count?'has-entries':''}" data-mobile-date="${date}"><span>${x.getDate()}</span>${count?`<i>${count>9?'9+':count}</i>`:''}</button>`}).join('')}</div></div><div class="mobile-month-selected-day"><div class="mobile-agenda-heading"><div><span>GEWÄHLTER TAG</span><b>${fmtWithWeekday(new Date(selected+'T12:00:00'))}</b></div><span class="mobile-month-entry-count">${dayEntries(selected).length} ${dayEntries(selected).length===1?'Eintrag':'Einträge'}</span></div><div class="mobile-agenda-list">${dayEntries(selected).length?dayEntries(selected).map(agendaCard).join(''):'<div class="mobile-agenda-empty">Keine Einträge für diesen Tag.</div>'}</div></div></div>`;
 }else if(currentView==='Team'||currentView==='Zeitleiste'){
  const editArea=isDuty?'Dienstplan':'Bereitschaft',isWorkItem=a=>isDuty?(a.kind==='Dienstplan'&&!a.isAbsence):a.kind==='Bereitschaft';
  const sbOn=(t,date)=>assignments.find(a=>a.kind==='Bereitschaft'&&a.team===t.name&&a.date===date);
  const sbHours=(name)=>{const a0=isoDate(ws),b0=isoDate(addDays(ws,6));return assignments.filter(x=>x.employee===name&&x.kind==='Bereitschaft'&&x.date>=a0&&x.date<=b0).reduce((s2,x)=>s2+durationHours(x.start,x.end),0)};
  const dates=Array.from({length:n},(_,i)=>isoDate(addDays(ws,i)));
  let rows='';
  shownTeams.forEach(t=>{
   const allMembers=staff.filter(p=>t.memberIds.includes(p[8]));
   let members=calendarMemberFilter==='Alle Mitarbeiter'?allMembers:allMembers.filter(p=>p[0]===calendarMemberFilter);
   if(onlyConflicts)members=members.filter(p=>dates.some(date=>dayEntries(date).some(a=>a.employee===p[0])));
   if(!members.length)return;
   const color=teamColor(t),manage=canManageTeam(t.name)&&canEdit(editArea);
   rows+=`<div class="tm-row tm-team"><div class="tm-name"><i class="dot" style="--c:${color}"></i><b>${escapeHtml(t.name)}</b><small>${allMembers.length} Mitarbeiter</small></div>${dates.map(date=>{if(!isDuty){const sb=sbOn(t,date);return sb?`<div class="tm-cov sb-ok ${date===todayIso?'today':''}">${icon('check')}<span>${escapeHtml(sb.employee.split(' ')[0])}</span></div>`:`<div class="tm-cov ${date===todayIso?'today':''}">${manage?`<button type="button" class="sb-gap" data-gap-team="${escapeHtml(t.name)}" data-gap-from="${date}" data-gap-to="${date}" title="Unbesetzt – jetzt einteilen">${icon('alert')}Lücke</button>`:`<span class="sb-gap">${icon('alert')}Lücke</span>`}</div>`}const c=allMembers.filter(p=>assignments.some(a=>a.date===date&&a.employee===p[0]&&a.kind==='Dienstplan'&&!a.isAbsence)).length;const pct=allMembers.length?Math.round(c/allMembers.length*100):0;return `<div class="tm-cov ${date===todayIso?'today':''}"><span class="cov-bar"><i style="width:${pct}%" class="${pct>=80?'ok':pct>=50?'mid':'low'}"></i></span>${c}/${allMembers.length}</div>`}).join('')}</div>`;
   members.forEach(p=>{
    const idx=staff.indexOf(p),role=t.leaderId===p[8]?'Teamleiter':t.deputyId===p[8]?'Deputy':'Mitarbeiter',hrs=isDuty?weekHoursOf(p[0],ws):sbHours(p[0]);
    rows+=`<div class="tm-row"><div class="tm-name tm-person">${avatarHtml(p[0],color,32)}<div><b>${escapeHtml(p[0])}</b><small>${role} · ${isDuty?`${hrs.toLocaleString(LOC(),{maximumFractionDigits:1})} h/Woche`:`◷ ${dates.filter(dt=>assignments.some(a=>a.kind==='Bereitschaft'&&a.employee===p[0]&&a.date===dt)).length} Tage`}</small></div></div>${dates.map(date=>{const items=dayEntries(date).filter(a=>a.employee===p[0]);return `<div class="tm-cell ${date===todayIso?'today':''}" data-drop-date="${date}" data-drop-emp="${escapeHtml(p[0])}" data-drop-team="${escapeHtml(t.name)}">${items.map(dayCard).join('')}${(manage||(p[8]===currentUserId&&selfEditAllowed(t.name,editArea)))&&!onlyConflicts&&!items.some(isWorkItem)&&(isDuty||!sbOn(t,date))?`<button type="button" class="tm-add" data-quick-add="${date}" data-team="${escapeHtml(t.name)}" data-emp="${idx}" title="${isDuty?'Dienst':'Bereitschaft'} für ${escapeHtml(p[0])} am ${date} anlegen" aria-label="${isDuty?'Dienst':'Bereitschaft'} anlegen">+</button>`:''}</div>`}).join('')}</div>`;
   });
  });
  body=`<div class="team-matrix-scroll"><div class="team-matrix" style="--cols:${n}"><div class="tm-row tm-head"><div class="tm-name">Mitarbeiter</div>${dates.map((date,i)=>`<div class="${date===todayIso?'today':''}">${WEEKDAYS[i]}<b>${fmtShort(new Date(date+'T12:00:00'))}</b></div>`).join('')}</div>${rows||`<div class="empty-note">${onlyConflicts?'Keine Konflikte in dieser Woche. 🎉':'Keine Mitarbeiter für diesen Filter.'}</div>`}</div></div>`;
  // Handy: kompakte Wochenübersicht + Details zum gewählten Tag
  const selDay=selectedMobileDate&&dates.includes(selectedMobileDate)?selectedMobileDate:(dates.includes(todayIso)?todayIso:dates[0]);
  const abbr=a=>{if(a.kind==='Arbeitsort')return a.shift==='Homeoffice'?'HO':'BÜ';const nn=String(a.shift||'').replace(/[^A-Za-zÄÖÜäöüß0-9]/g,'');return (nn.slice(0,2)||'•')};
  const legendMap=new Map();
  const tileFor=items=>{const duty=items.find(a=>a.kind==='Dienstplan'&&!a.isAbsence),abs=items.find(a=>a.isAbsence),sb=items.find(a=>a.kind==='Bereitschaft'),wp=items.find(a=>a.kind==='Arbeitsort')||(duty&&wpFor(duty));const main=abs||duty;let html='';if(main){legendMap.set(abbr(main),main.shift);html=`<span class="mt-tile ${abs?'is-absence':''} ${conflicts.has(main.id)?'is-conflict':''}" style="--shift-color:${shiftHexColor(assignmentColor(main))}">${escapeHtml(abbr(main))}</span>`}else if(!sb)html='<span class="mt-empty"></span>';if(sb){html+=`<i class="mt-sb" style="--c:${shiftHexColor(assignmentColor(sb))}" title="Bereitschaft"></i>`;if(!main)html=`<span class="mt-tile is-standby" style="--shift-color:${shiftHexColor(assignmentColor(sb))}">◷</span>`+html}if(wp&&wp.shift==='Homeoffice')html+='<i class="mt-ho" title="Homeoffice">⌂</i>';return html};
  let mWeek='',mDay='';
  shownTeams.forEach(t=>{
   const allMembers=staff.filter(p=>t.memberIds.includes(p[8]));
   const members=calendarMemberFilter==='Alle Mitarbeiter'?allMembers:allMembers.filter(p=>p[0]===calendarMemberFilter);
   if(!members.length)return;
   const color=teamColor(t),manage=canManageTeam(t.name)&&canEdit(editArea);
   const cov=date=>!isDuty?(sbOn(t,date)?1:0):allMembers.filter(p=>assignments.some(a=>a.date===date&&a.employee===p[0]&&a.kind==='Dienstplan'&&!a.isAbsence)).length;
   mWeek+=`<div class="mt-team"><div class="mt-team-name"><i class="dot" style="--c:${color}"></i>${escapeHtml(t.name)}</div><div class="mt-grid cal-cols" style="--cols:${n}"><span class="mt-corner"></span>${dates.map(date=>{const c=cov(date),pct=allMembers.length?c/allMembers.length:0;return isDuty?`<button type="button" class="mt-cov ${date===selDay?'sel':''} ${pct>=.8?'ok':pct>=.5?'mid':'low'}" data-mobile-date="${date}">${c}/${allMembers.length}</button>`:`<button type="button" class="mt-cov ${date===selDay?'sel':''} ${c?'ok':'low'}" data-mobile-date="${date}">${c?'✓':'!'}</button>`}).join('')}${members.map(p=>{const short=p[0].split(' ');return `<span class="mt-name">${escapeHtml(short[0])} ${escapeHtml((short[1]||'').charAt(0))}.</span>${dates.map(date=>{const items=visible.filter(a=>a.date===date&&a.employee===p[0]);return `<button type="button" class="mt-cell ${date===selDay?'sel':''} ${date===todayIso?'is-today':''}" data-mobile-date="${date}" data-focus-emp="${escapeHtml(p[0])}" aria-label="${escapeHtml(p[0])} ${date}">${tileFor(items)}</button>`}).join('')}`}).join('')}</div></div>`;
   const c=cov(selDay),selSb=!isDuty&&sbOn(t,selDay);
   mDay+=`<div class="md-team"><div class="md-team-head"><span><i class="dot" style="--c:${color}"></i><b>${escapeHtml(t.name)}</b></span>${isDuty?`<span class="md-cov ${c/allMembers.length>=.8?'ok':c/allMembers.length>=.5?'mid':'low'}">${c}/${allMembers.length}</span>`:selSb?`<span class="md-cov ok">${escapeHtml(selSb.employee)}</span>`:`<span class="md-cov low">Lücke</span>`}</div>${members.map(p=>{const idx=staff.indexOf(p),role=t.leaderId===p[8]?'Teamleiter':t.deputyId===p[8]?'Deputy':'Mitarbeiter';const items=dayEntries(selDay).filter(a=>a.employee===p[0]);const hasDuty=items.some(isWorkItem)||(!isDuty&&!!selSb);return `<div class="md-person ${mobileFocusEmp===p[0]?'focus':''}" data-emp-card="${escapeHtml(p[0])}"><div class="md-person-head">${avatarHtml(p[0],color,32)}<div><b>${escapeHtml(p[0])}</b><small>${role}</small></div>${(manage||(p[8]===currentUserId&&selfEditAllowed(t.name,editArea)))&&!hasDuty?`<button type="button" class="btn small" data-quick-add="${selDay}" data-team="${escapeHtml(t.name)}" data-emp="${idx}">${isDuty?'＋ Dienst':'＋ Bereitschaft'}</button>`:''}</div>${items.length?`<div class="md-entries">${items.map(agendaCard).join('')}</div>`:'<div class="md-free">Kein Eintrag</div>'}</div>`}).join('')}</div>`;
  });
  const legend=[...legendMap.entries()].slice(0,8).map(([k,v])=>`<span><b>${escapeHtml(k)}</b> ${escapeHtml(v)}</span>`).join('');
  body+=`<div class="mobile-team-view"><div class="mt-head"><b>Wochenübersicht</b><small>Tippe auf einen Tag oder ein Feld, um Details zu sehen.</small></div><div class="mt-days cal-cols" style="--cols:${n}"><span class="mt-corner"></span>${dates.map((date,i)=>`<button type="button" class="mt-day ${date===selDay?'sel':''} ${date===todayIso?'is-today':''}" data-mobile-date="${date}"><small>${WEEKDAYS[i]}</small><b>${new Date(date+'T12:00:00').getDate()}</b></button>`).join('')}</div>${mWeek||'<div class="empty-note">Keine Mitarbeiter für diesen Filter.</div>'}<div class="mt-legend">${legend}<span><i class="mt-sb" style="--c:#159da8"></i> Bereitschaft</span><span><span class="mt-tile is-absence mini">U</span> Abwesenheit</span></div><div class="md-heading"><b>${escapeHtml(fmtWithWeekday(new Date(selDay+'T12:00:00')))}</b></div>${mDay}</div>`;
 }else{
  const date=isoDate(d),entries=dayEntries(date);body=`<div class="day-assignment-list" data-drop-date="${date}">${entries.length?entries.map(a=>`<div class="day-assignment-row">${dayCard(a)}</div>`).join(''):'<div class="empty-note">Für diesen Tag sind noch keine Dienste eingetragen.</div>'}</div>`;
 }
 const managerWorkplace=['Admin','Teamleiter','Abteilungsleiter'].includes(currentRole);
 const canAdd=entryTeams().length>0,canManageAny=manageableTeams().length>0;
  const actionsRaw=isDuty?`${canRequestSwap()?`<button class="btn" id="swap-new-btn">${icon('refresh')}Diensttausch</button>`:''}<button class="btn" id="add-workplace">${icon('home')}Arbeitsort</button>${absenceTeams().length?`<button class="btn" id="add-absence">${icon('travel','ic-fill')}Abwesenheit</button>`:''}${canManageAny&&manageableTeams('Dienstplan').some(t=>shiftTypes.some(s=>s.team===t.name))?`<button class="btn" id="duty-rotation">${icon('spark')}Rotation automatisch planen</button>`:''}${canAdd?`<button class="btn primary" id="add">${icon('plus')}Eintrag erstellen</button>`:''}`:`${canManageAny&&standbyTimes.length?`<button class="btn" id="auto-rotation">${icon('spark')}Rotation automatisch planen</button>`:''}${canAdd?`<button class="btn primary" id="add">${icon('plus')}Bereitschaft einteilen</button>`:''}`;
 // Mobil: Aktionen im Dienstplan unter einem Button „Aktionen“ zusammenfassen
 const actions=actionsRaw?`<span class="dp-actions">${actionsRaw}</span><button type="button" class="btn dp-actions-toggle" id="dp-actions-toggle" aria-haspopup="dialog">Aktionen${icon('down','dp-act-caret')}</button>`:actionsRaw;
 const sub=isDuty?((currentView==='Monat')?monthName(d):`KW ${isoWeek(ws)} · ${fmt(ws)} – ${fmt(we)}`):(currentView==='Zeitleiste'||currentView==='Woche'?`KW ${isoWeek(ws)} · ${fmt(ws)} – ${fmt(we)}${currentView==='Zeitleiste'?' · Wer hat wann Bereitschaft?':''}`:currentView==='Monat'?`${monthName(d)} · Rotationsübersicht aller Teams`:fmtWithWeekday(d));
 // Bereitschaft: Wer ist jetzt erreichbar? Lücken im Monat?
 let nowBlock='';
 if(!isDuty){
  const nowList=assignments.filter(a=>a.kind==='Bereitschaft'&&a.date===todayIso&&calTeamOk(a.team));
  const monthDays=Array.from({length:last.getDate()},(_,i)=>isoDate(new Date(d.getFullYear(),d.getMonth(),i+1)));
  const gapDays=shownTeams.reduce((s,t)=>s+standbyGapRanges(t.name,monthDays).reduce((x,r)=>x+Math.round((new Date(r.to)-new Date(r.from))/864e5)+1,0),0);
  const showAll=window.__showAllStandby===true;
  nowBlock=`<div class="now-head"><b>Jetzt in Bereitschaft</b>${gapDays?`<span class="pill gap-pill">${icon('alert')}${gapDays} ${gapDays===1?'Lücke':'Lücken'} im ${d.toLocaleDateString(LOC(),{month:'long'})}</span>`:`<span class="pill ok-pill">${icon('check')}Alle Tage besetzt</span>`}${nowList.length>5?`<button type="button" class="link-btn push-right" id="toggle-now">${showAll?'weniger anzeigen':`${Math.min(5,nowList.length)} von ${nowList.length} angezeigt · alle`}</button>`:''}</div>
  <div class="now-cards">${nowList.length?(showAll?nowList:nowList.slice(0,5)).map(a=>{const p=staff.find(x=>x[0]===a.employee),c=teamColor(teamByName(a.team));return `<div class="now-card" style="--c:${c}">${avatarHtml(a.employee,c,38)}<div><b>${escapeHtml(a.employee)}</b><small>${escapeHtml(a.team)}</small><em>bis ${a.end} Uhr</em></div>${p&&p[7]?`<a class="icon-btn call-btn" href="tel:${escapeHtml(p[7].replace(/\s+/g,''))}" title="${escapeHtml(p[7])}" aria-label="${escapeHtml(a.employee)} anrufen">${icon('phone')}</a>`:''}</div>`}).join(''):'<div class="empty-note">Heute ist niemand in Bereitschaft eingetragen.</div>'}</div>`;
 }
 const memberOptions=staff.filter(s=>!calendarTeams.length||teams.some(t=>calendarTeams.includes(t.name)&&t.memberIds.includes(s[8]))).map(s=>`<option value="${escapeHtml(s[0])}">`).join('');
 const filterbar=`<div class="cal-filterbar">
  <label class="search-field">${icon('search')}<input id="member-filter" type="search" list="calendar-member-options" placeholder="Mitarbeiter suchen …" value="${calendarMemberFilter==='Alle Mitarbeiter'?'':escapeHtml(calendarMemberFilter)}" autocomplete="off"><datalist id="calendar-member-options"><option value="Alle Mitarbeiter"></option>${memberOptions}</datalist></label>
  ${teamFilterDropdown()}
  ${isDuty?`<button type="button" class="chip ${onlyConflicts?'active warn':''}" id="only-conflicts">${icon('alert')}Nur Konflikte${conflicts.size?` · ${[...conflicts].filter(id=>{const a=assignments.find(x=>x.id===id);return a&&!a.isAbsence&&calTeamOk(a.team)}).length}`:''}</button>`:''}
  ${calendarMemberFilter!=='Alle Mitarbeiter'||calendarTeams.length||onlyConflicts?`<button type="button" class="link-btn" id="reset-calendar-filters">Filter zurücksetzen</button>`:''}
  <div class="legend push-right"><span><i class="dot" style="--c:#3974c6"></i>Dienst</span><span><i class="lg-standby"></i>Bereitschaft</span><span><i class="lg-absence">Abw.</i>Abwesenheit</span><span>${icon('home')}Homeoffice</span></div>
 </div>`;
 const tip=isDuty&&canAdd?`<div class="cal-tip"><span>Tipp: Einträge per Drag &amp; Drop verschieben · ${currentView==='Team'?'„+“ in leerer Zelle = Dienst anlegen':'Mehrere Tage per Ziehen markieren = Arbeitsort'} · Strg Z = rückgängig</span>${undoStack.length?`<button type="button" class="btn small" id="undo-btn">${icon('undo')}Rückgängig (${undoStack.length})</button>`:''}</div>`:(!isDuty&&canAdd?`<div class="cal-tip"><span>${currentView==='Zeitleiste'?'Tipp: Bereitschaft auf eine andere Person ziehen = Tausch/Vertretung · „+“ = einteilen · „Lücke“ anklicken = Tag besetzen · Strg Z = rückgängig':''}</span>${undoStack.length?`<button type="button" class="btn small" id="undo-btn">${icon('undo')}Rückgängig (${undoStack.length})</button>`:''}</div>`:'');
 const controls=`<div class="calendar-toolbar"><div class="calendar-nav"><button class="btn" id="prev" aria-label="Zurück">‹</button><strong>${range}</strong><button class="btn" id="next" aria-label="Weiter">›</button><button class="btn" id="today">Heute</button></div><div class="view-switch">${views.map(v=>`<button data-view="${v}" class="${currentView===v?'active':''}">${v}</button>`).join('')}</div></div>`;
 return `${heading(title,sub,actions)}${nowBlock}
 <div class="calendar-shell ${!isDuty?'panel standby-shell':''}">${controls}${filterbar}<div class="calendar-card ${currentView==='Monat'?'month-compact-card':''} view-${currentView.toLowerCase()}"><div class="calendar-scroll">${body}</div></div>${tip}</div>
 <div class="modal-backdrop" id="day-details-modal" hidden><div class="modal day-details-modal"><div class="panel-head"><div><h2 id="day-details-title">Dienste des Tages</h2><p class="small muted" id="day-details-subtitle"></p></div><button class="icon-btn" id="close-day-details" type="button" aria-label="Schließen">×</button></div><div id="day-details-list" class="day-assignment-list"></div><div class="btn-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="close-day-details-bottom" type="button">Schließen</button></div></div></div>
 <div class="modal-backdrop" id="workplace-modal" hidden><div class="modal wp-modal" role="dialog" aria-modal="true" aria-labelledby="wp-title"><div class="wp-head"><span class="wp-head-icon" id="wp-head-icon">${icon('home')}</span><div><h2 id="wp-title">${managerWorkplace?'Arbeitsort eintragen':'Meinen Arbeitsort eintragen'}</h2><p class="small muted">${managerWorkplace?'Wird beim jeweiligen Dienst als Hinweis angezeigt.':'Nur dein eigener Arbeitsort wird geändert · erscheint als Hinweis bei deinem Dienst.'}</p></div><button class="icon-btn" id="close-workplace" type="button" aria-label="Schließen">×</button></div>
 <form id="workplace-form" class="wp-form" novalidate>
  ${managerWorkplace?`<div class="wp-field"><span class="wp-label">Mitarbeiter</span>${personPicker({id:'workplace-employee',people:[...staff].sort((a,b)=>a[0].localeCompare(b[0],'de')).map(p=>({name:p[0],sub:teams.filter(t=>t.memberIds.includes(p[8])).map(t=>t.name).join(', ')||p[5]||'',color:teamColor(teamByName(p[5]))})),value:currentUserName()})}</div>`:`<div class="wp-me">${avatarHtml(currentUserName(),'var(--accent-color)',36)}<div><b>${escapeHtml(currentUserName())}</b><small>Dein Arbeitsort</small></div></div>`}
  <div class="wp-field"><span class="wp-label">Arbeitsort</span><div class="wp-types" role="radiogroup" aria-label="Arbeitsort">
   <label class="wp-type"><input type="radio" name="wp-type" value="Homeoffice" checked><span class="wp-type-card"><span class="wp-type-ic">${icon('home')}</span><b>Homeoffice</b><small>Arbeiten von zu Hause</small><i class="wp-type-check">${icon('check')}</i></span></label>
   <label class="wp-type"><input type="radio" name="wp-type" value="Büro"><span class="wp-type-card"><span class="wp-type-ic">${icon('build')}</span><b>Büro</b><small>Arbeiten vor Ort</small><i class="wp-type-check">${icon('check')}</i></span></label>
  </div><input type="hidden" id="workplace-type" value="Homeoffice"></div>
  <div class="wp-field"><span class="wp-label">Zeitraum</span>
   <div class="wp-range"><label><small>Von</small><input type="date" id="workplace-date-from" value="${isoDate(new Date())}" required></label><span class="wp-range-arrow" aria-hidden="true">→</span><label><small>Bis</small><input type="date" id="workplace-date-to" value="${isoDate(new Date())}" required></label></div>
   <div class="wp-quick"><button type="button" class="chip" data-wp-quick="today">Heute</button><button type="button" class="chip" data-wp-quick="tomorrow">Nächster Werktag</button><button type="button" class="chip" data-wp-quick="week">Diese Woche</button><button type="button" class="chip" data-wp-quick="next">Nächste Woche</button></div>
   <small class="wp-note">Arbeitsorte werden nur von Montag bis Freitag eingetragen.</small>
  </div>
  <div class="wp-summary" id="workplace-summary" aria-live="polite"></div>
  <div class="btn-row modal-actions wp-actions"><button type="button" class="btn ghost danger-text" id="workplace-remove">${icon('trash')}Im Zeitraum entfernen</button><span class="wp-actions-right"><button type="button" class="btn" id="cancel-workplace">Abbrechen</button><button type="submit" class="btn primary">${icon('check')}Speichern</button></span></div>
 </form></div></div>
 <div class="modal-backdrop" id="absence-modal" hidden><div class="modal"><div class="panel-head"><h2>Abwesenheit eintragen</h2><button class="icon-btn" id="close-absence" type="button" aria-label="Schließen">×</button></div><form id="absence-form"><label>Mitarbeiter auswählen<select id="absence-employee" required></select></label><label>Abwesenheit<select id="absence-type" required><option value="">Bitte auswählen</option><option value="Urlaub">Urlaub</option><option value="Urlaub 1/2 Tag">Urlaub 1/2 Tag</option><option value="Gleittag">Gleittag</option><option value="Sonderurlaub">Sonderurlaub</option><option value="Berufsschule">Berufsschule</option><option value="Abwesend">Abwesend</option><option value="Abwesend untertägig">Abwesend untertägig</option><option value="Arztbesuch">Arztbesuch</option></select></label><div class="form-two" id="absence-time-fields" hidden><label>Von Uhrzeit<input type="time" id="absence-start"></label><label>Bis Uhrzeit<input type="time" id="absence-end"></label></div><div class="form-two"><label>Datum von<input type="date" id="absence-date-from" value="${isoDate(new Date())}" required></label><label>Datum bis<input type="date" id="absence-date-to"></label></div><p class="small muted">Ohne „Datum bis“ gilt die Abwesenheit nur für einen Tag.</p><div class="absence-note-field"><label for="absence-note">Bemerkung <span>(optional)</span></label><textarea id="absence-note" rows="3" placeholder="Zusätzliche Information oder Hinweis …"></textarea><small>Die Bemerkung wird beim Mitarbeiter im Dienstplan angezeigt.</small></div><div class="btn-row modal-actions"><button type="button" class="btn" id="cancel-absence">Abbrechen</button><button type="submit" class="btn primary">Abwesenheit speichern</button></div></form></div></div>
 <div class="modal-backdrop" id="duty-modal" hidden><div class="modal"><div class="panel-head"><h2>${!isDuty?'Bereitschaft einteilen':'Neuen Dienst einteilen'}</h2><button class="icon-btn" id="close-duty" type="button" aria-label="Schließen">×</button></div><form id="duty-form"><label>Team<select id="duty-team" required>${entryTeams().map(t=>`<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('')}</select></label><label>Mitarbeiter auswählen<select id="duty-employee" required></select></label>${!isDuty?`<label>Bereitschaftsgruppe<select id="duty-standby-group" required></select></label>`:''}<label>${!isDuty?'Bereitschaftszeit auswählen':'Dienst auswählen'}<select id="duty-shift" required></select></label><div class="form-two" id="duty-time-override" hidden><label>Beginn für diesen Eintrag<input type="time" id="duty-start-time"></label><label>Ende für diesen Eintrag<input type="time" id="duty-end-time"></label></div><p class="small muted" id="duty-time-hint" hidden>Die Uhrzeiten gelten nur für diesen Eintrag und ändern die hinterlegte Dienstzeit nicht.</p><div class="form-two"><label>Datum von<input type="date" id="duty-date-from" value="${isoDate(new Date())}" required></label><label>Datum bis<input type="date" id="duty-date-to" value="${isoDate(new Date())}" required></label></div><p class="small muted">Der Eintrag wird an jedem Tag im Zeitraum angelegt (inkl. Start- und Enddatum).</p><div class="btn-row modal-actions"><button type="button" class="btn" id="cancel-duty">Abbrechen</button><button type="submit" class="btn primary">${!isDuty?'Bereitschaft einteilen':'Dienst einteilen'}</button></div></form></div></div>`;
}
/* Formular-Dialog: liefert das Formular-Element zurück (oder null bei Abbruch) */
function formDialog(title,inner,okLabel='Speichern',sub=''){
 return new Promise(resolve=>{
  const layer=document.createElement('div');layer.className='modal-backdrop app-dialog';
  layer.innerHTML=`<form class="modal form-dialog" role="dialog" aria-modal="true"><div class="panel-head"><div><h2>${escapeHtml(title)}</h2>${sub?`<p class="small muted">${sub}</p>`:''}</div><button type="button" class="icon-btn" data-dlg="cancel" aria-label="Schließen">×</button></div>${inner}<div class="btn-row modal-actions"><button type="button" class="btn" data-dlg="cancel">Abbrechen</button><button type="submit" class="btn primary">${escapeHtml(okLabel)}</button></div></form>`;
  document.body.appendChild(layer);const form=layer.querySelector('form');
  const done=v=>{layer.remove();document.removeEventListener('keydown',key,true);resolve(v)};
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();const open=layer.querySelector('details.team-dd[open]');if(open){open.open=false;return}done(null)}};document.addEventListener('keydown',key,true);
  layer.addEventListener('click',e=>{if(e.target===layer||e.target.closest('[data-dlg="cancel"]'))done(null)});
  form.onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());data.__form=form;done(data)};
  if(!window.matchMedia('(pointer: coarse)').matches)setTimeout(()=>form.querySelector('input,select,button[type=submit]')?.focus(),20);
 });
}
const fullDayAbsent=(name,date)=>assignments.some(a=>a.isAbsence&&a.employee===name&&a.date===date&&!a.start&&a.shift!=='Urlaub 1/2 Tag');
async function moveAssignment(id,date,emp){
 const item=assignments.find(a=>String(a.id)===String(id));if(!item||!date)return;
 const target=emp||item.employee;if(item.date===date&&target===item.employee)return;
 if(!canEditEntry(item.team,item.employee,areaOf(item))||(target!==item.employee&&!managesTeam(item.team,areaOf(item)))){toast(selfEditAllowed(item.team,areaOf(item))?'Du darfst nur deine eigenen Einträge verschieben.':'Du darfst Einträge dieses Teams nicht bearbeiten.');return}
 const team=teamByName(item.team),person=staff.find(p=>p[0]===target);
 if(!person||!team||!team.memberIds.includes(person[8])){toast('Einträge können nur innerhalb des eigenen Teams verschoben werden.');return}
 if(item.kind!=='Arbeitsort'&&assignments.some(a=>a!==item&&a.employee===target&&a.date===date&&a.kind===item.kind&&!a.isAbsence)){toast(`${target} hat am ${fmtIsoDate(date)} bereits ${item.kind==='Bereitschaft'?'eine Bereitschaft':'einen Dienst'}.`);return}
 if(item.kind!=='Arbeitsort'&&fullDayAbsent(target,date)&&!await ask(`${target} ist am ${fmtIsoDate(date)} abwesend. Trotzdem verschieben?`,'Verschieben'))return;
 pushUndo('Verschieben');
 const before=`${item.employee} · ${fmtIsoDate(item.date)}`;item.employee=target;item.date=date;persistAssignments();
 audit('Geändert',item.kind==='Bereitschaft'?'Bereitschaft':'Dienstplan',`${item.shift} verschoben`,{title:(item.kind==='Bereitschaft'?'Bereitschaft':item.kind==='Arbeitsort'?'Arbeitsort':'Dienst')+' verschoben',object:item.shift,before,after:`${target} · ${fmtIsoDate(date)}`});
 if(item.kind!=='Arbeitsort')createAssignmentNotifications([item]);
 toast('Eintrag verschoben. Strg Z macht es rückgängig.');render();
}
async function copyToNextDay(id){
 const item=assignments.find(a=>String(a.id)===String(id));if(!item)return;
 if(!canEditEntry(item.team,item.employee,areaOf(item))){toast('Du darfst diesen Eintrag nicht kopieren.');return}
 let next=addDays(new Date(item.date+'T12:00:00'),1);if(item.kind!=='Bereitschaft')while((next.getDay()+6)%7>=dutyDays)next=addDays(next,1);
 const date=isoDate(next);
 if(assignments.some(a=>a.employee===item.employee&&a.date===date&&a.kind===item.kind&&!a.isAbsence)){toast(`${item.employee} hat am ${fmtIsoDate(date)} bereits einen Eintrag.`);return}
 pushUndo('Kopieren');const copy={...item,id:makeId(),date};assignments.push(copy);persistAssignments();
 audit('Erstellt',item.kind==='Bereitschaft'?'Bereitschaft':'Dienstplan',`${item.employee} · ${item.shift} · ${fmtIsoDate(date)}`,{title:'Eintrag kopiert',object:`${item.employee} · ${item.shift}`,before:fmtIsoDate(item.date),after:fmtIsoDate(date)});
 createAssignmentNotifications([copy]);toast('Auf '+fmtIsoDate(date)+' kopiert.');render();
}
async function swapStandby(teamName,ids){
 const items=ids.map(id=>assignments.find(a=>String(a.id)===String(id))).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));if(!items.length)return;
 const t=teamByName(teamName);const cur=items[0].employee;const members=staff.filter(p=>t&&t.memberIds.includes(p[8])&&p[0]!==cur);
 const from=items[0].date,to=items[items.length-1].date;
 const res=await formDialog('Bereitschaft tauschen / Vertretung',`<label>Vertretung durch<select name="emp" required>${members.map(p=>`<option value="${escapeHtml(p[0])}">${escapeHtml(p[0])}${items.some(a=>fullDayAbsent(p[0],a.date))?' (teilweise abwesend)':''}</option>`).join('')}</select></label><div class="form-two"><label>Von<input type="date" name="from" value="${from}" min="${from}" max="${to}" required></label><label>Bis<input type="date" name="to" value="${to}" min="${from}" max="${to}" required></label></div>`,'Übernehmen',`${escapeHtml(cur)} · ${fmtIsoDate(from)}${from!==to?' – '+fmtIsoDate(to):''}`);
 if(!res)return;if(res.to<res.from){toast('Das Enddatum darf nicht vor dem Startdatum liegen.');return}
 const affected=items.filter(a=>a.date>=res.from&&a.date<=res.to);
 const clash=affected.find(a=>assignments.some(x=>x.kind==='Bereitschaft'&&x.employee===res.emp&&x.date===a.date));if(clash){toast(`${res.emp} hat am ${fmtIsoDate(clash.date)} bereits eine Bereitschaft.`);return}
 pushUndo('Bereitschaft tauschen');affected.forEach(a=>{a.employee=res.emp});persistAssignments();
 audit('Geändert','Bereitschaft',`${cur} → ${res.emp}`,{title:'Bereitschaft getauscht',object:`${teamName} · ${fmtIsoDate(res.from)}${res.from!==res.to?' – '+fmtIsoDate(res.to):''}`,before:cur,after:res.emp});
 createAssignmentNotifications(affected);toast(`${affected.length} ${affected.length===1?'Tag':'Tage'} an ${res.emp} übergeben.`);render();
}
/* Teamauswahl als Dropdown (mehrere Teams wählbar) – zeigt nur Teams, für die man Berechtigungen hat */
function teamDropdown(list,pre){
 return `<div class="field-label">Teams</div><details class="team-dd"><summary><span class="team-dd-text"></span>${icon('down')}</summary><div class="team-dd-panel">
  ${list.length>1?`<label class="check team-dd-all"><input type="checkbox" data-dd-all><span>Alle meine Teams</span></label>`:''}
  ${list.map(t=>`<label class="check"><input type="checkbox" name="team:${escapeHtml(t.name)}" data-dd-team="${escapeHtml(t.name)}" ${pre.includes(t.name)?'checked':''}><i class="dot" style="--c:${teamColor(t)}"></i><span>${escapeHtml(t.name)}</span></label>`).join('')}</div></details>`;
}
function bindTeamDropdown(){
 const layer=[...document.querySelectorAll('.app-dialog')].pop(),dd=layer?.querySelector('.team-dd');if(!dd)return;
 const boxes=[...dd.querySelectorAll('[data-dd-team]')],all=dd.querySelector('[data-dd-all]'),text=dd.querySelector('.team-dd-text');
 const update=()=>{const sel=boxes.filter(b=>b.checked).map(b=>b.dataset.ddTeam);
  text.textContent=!sel.length?'Team auswählen …':sel.length===boxes.length&&boxes.length>1?`Alle meine Teams (${sel.length})`:sel.length>2?`${sel.slice(0,2).join(', ')} +${sel.length-2}`:sel.join(', ');
  text.classList.toggle('muted',!sel.length);
  if(all){all.checked=sel.length===boxes.length;all.indeterminate=sel.length>0&&sel.length<boxes.length}
  // Dienste anzeigen, die es in den gewählten Teams gibt
  layer.querySelectorAll('[data-shift-teams]').forEach(l=>{const ts=l.dataset.shiftTeams.split('|');l.hidden=sel.length>0&&!ts.some(x=>sel.includes(x))})};
 boxes.forEach(b=>b.addEventListener('change',update));
 if(all)all.addEventListener('change',()=>{boxes.forEach(b=>b.checked=all.checked);update()});
 layer.addEventListener('click',e=>{if(dd.open&&!e.target.closest('.team-dd'))dd.open=false});
 dd.addEventListener('keydown',e=>{if(e.key==='Escape'&&dd.open){e.stopPropagation();dd.open=false;dd.querySelector('summary').focus()}});
 update();
}
async function autoRotation(){
 const teamsAvail=manageableTeams('Bereitschaft');if(!teamsAvail.length||!standbyTimes.length)return;
 const d=new Date(currentDate),from=isoDate(new Date(d.getFullYear(),d.getMonth(),1)),to=isoDate(new Date(d.getFullYear(),d.getMonth()+1,0));
 const pre=calendarTeams.length?calendarTeams:teamsAvail.map(t=>t.name);
 const dlg=formDialog('Rotation automatisch planen',`${teamDropdown(teamsAvail,pre)}
  <div class="form-two"><label>Von<input type="date" name="from" value="${from}" required></label><label>Bis<input type="date" name="to" value="${to}" required></label></div>
  <div class="form-two"><label>Wechsel<select name="mode"><option value="week">Wöchentlich (montags)</option><option value="day">Täglich</option></select></label><label>Bereitschaftszeit<select name="time">${standbyTimes.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)} (${x.start}–${x.end})</option>`).join('')}</select></label></div>
  <label class="check"><input type="checkbox" name="keep" checked><span>Bestehende Einträge behalten – nur Lücken füllen</span></label>
  <p class="small muted">Die Reihenfolge setzt dort fort, wo die letzte Bereitschaft vor dem Zeitraum endete. Ganztägig abwesende Personen werden für diesen Tag automatisch vertreten.</p>`,'Rotation erstellen','Verteilt die Bereitschaft gleichmäßig auf alle Teammitglieder.');
 bindTeamDropdown();const res=await dlg;
 if(!res)return;
 const chosen=teamsAvail.filter(t=>res['team:'+t.name]);if(!chosen.length){toast('Bitte mindestens ein Team wählen.');return}
 if(res.to<res.from){toast('Das Enddatum darf nicht vor dem Startdatum liegen.');return}
 const st=standbyTimes.find(x=>String(x.id)===res.time),group=standbyGroups.find(g=>g.id===st?.groupId);if(!st)return;
 const keep=!!res.keep,dates=[];for(let c=new Date(res.from+'T12:00:00');isoDate(c)<=res.to;c=addDays(c,1))dates.push(isoDate(c));
 if(dates.length>366){toast('Bitte einen Zeitraum von höchstens 366 Tagen auswählen.');return}
 pushUndo('Rotation');const created=[];
 chosen.forEach(t=>{
  const members=staff.filter(p=>t.memberIds.includes(p[8])).map(p=>p[0]);if(!members.length)return;
  if(!keep)assignments=assignments.filter(a=>!(a.kind==='Bereitschaft'&&a.team===t.name&&a.date>=res.from&&a.date<=res.to));
  const prev=assignments.filter(a=>a.kind==='Bereitschaft'&&a.team===t.name&&a.date<res.from).sort((a,b)=>b.date.localeCompare(a.date))[0];
  let idx=prev&&members.includes(prev.employee)?members.indexOf(prev.employee)+1:0,lastKey=null;
  dates.forEach(date=>{
   const key=res.mode==='week'?isoDate(weekStart(new Date(date+'T12:00:00'))):date;
   if(lastKey!==null&&key!==lastKey)idx++;lastKey=key;
   if(assignments.some(a=>a.kind==='Bereitschaft'&&a.team===t.name&&a.date===date))return;
   let who=null;for(let k=0;k<members.length;k++){const cand=members[(idx+k)%members.length];if(!fullDayAbsent(cand,date)&&!assignments.some(a=>a.kind==='Bereitschaft'&&a.employee===cand&&a.date===date)){who=cand;break}}
   if(!who)return;
   const item={id:makeId(),kind:'Bereitschaft',team:t.name,employee:who,shift:st.name,groupId:group?.id||'',groupName:group?.name||'',start:st.start,end:st.end,color:t.standbyColor||'#159da8',date};
   assignments.push(item);created.push(item);
  });
 });
 persistAssignments();
 audit('Erstellt','Bereitschaft',`${created.length} Einträge · ${chosen.map(t=>t.name).join(', ')}`,{title:'Rotation automatisch geplant',object:`${fmtIsoDate(res.from)} – ${fmtIsoDate(res.to)}`,after:`${created.length} Bereitschaften angelegt`});
 createAssignmentNotifications(created);
 toast(created.length?`${created.length} Bereitschaften wurden eingeteilt.`:'Keine Lücken gefunden – nichts zu tun.');render();
}

/* Dienstplan: Schichtrotation automatisch planen.
   Jedes Teammitglied bekommt an jedem Arbeitstag einen Dienst; die gewählten Dienste wechseln
   wöchentlich oder täglich der Reihe nach durch. Die Reihenfolge hängt am Kalender (Woche bzw. Tag),
   dadurch schließen aufeinanderfolgende Zeiträume nahtlos aneinander an. */
async function dutyRotation(){
 const teamsAvail=manageableTeams('Dienstplan').filter(t=>shiftTypes.some(s=>s.team===t.name));if(!teamsAvail.length)return;
 const d=new Date(currentDate),from=isoDate(new Date(d.getFullYear(),d.getMonth(),1)),to=isoDate(new Date(d.getFullYear(),d.getMonth()+1,0));
 const pre=calendarTeams.length?calendarTeams.filter(n=>teamsAvail.some(t=>t.name===n)):teamsAvail.map(t=>t.name);
 const names=[...new Set(shiftTypes.filter(s=>teamsAvail.some(t=>t.name===s.team)).map(s=>s.name))];
 const shiftLabel=n=>{const x=shiftTypes.find(s=>s.name===n&&teamsAvail.some(t=>t.name===s.team));return x?`${escapeHtml(n)} <small class="muted">${x.start}–${x.end}${shiftMulti(x)?'':' · 1× pro Tag'}</small>`:escapeHtml(n)};
 const dayNames=['Mo','Di','Mi','Do','Fr','Sa','So'].slice(0,dutyDays).join(', ');
 const dlg=formDialog('Rotation automatisch planen',`${teamDropdown(teamsAvail,pre)}
  <fieldset class="team-checks"><legend>Dienste im Wechsel (in dieser Reihenfolge)</legend><div class="check-grid">${names.map(n=>`<label class="check" data-shift-teams="${escapeHtml(teamsAvail.filter(t=>shiftTypes.some(x=>x.team===t.name&&x.name===n)).map(t=>t.name).join('|'))}"><input type="checkbox" name="shift:${escapeHtml(n)}" checked><span>${shiftLabel(n)}</span></label>`).join('')}</div></fieldset>
  <div class="form-two"><label>Von<input type="date" name="from" value="${from}" required></label><label>Bis<input type="date" name="to" value="${to}" required></label></div>
  <label>Wechsel<select name="mode"><option value="week">Wöchentlich (montags)</option><option value="day">Täglich</option></select></label>
  <label class="check"><input type="checkbox" name="keep" checked><span>Bestehende Einträge behalten – nur Lücken füllen</span></label>
  <p class="small muted">Jedes Teammitglied bekommt an jedem Arbeitstag (${dayNames}) einen Dienst; die Dienste wechseln der Reihe nach. Bei Urlaub, Gleittag, Sonderurlaub, Berufsschule oder „Abwesend“ bekommt die Person keinen Dienst, und die Dienste dieses Tages werden unter den Anwesenden neu verteilt, damit jede Schicht gleichmäßig besetzt bleibt. Jeder Dienst wird pro Tag mindestens einmal besetzt; Dienste, die laut Dienstzeiten nur einmal pro Tag vorkommen dürfen, genau einmal. Tage, an denen jemand schon einen Dienst hat, bleiben unverändert.</p>`,'Rotation erstellen','Verteilt die Dienste gleichmäßig im Wechsel auf alle Teammitglieder.');
 bindTeamDropdown();const res=await dlg;
 if(!res)return;
 const chosen=teamsAvail.filter(t=>res['team:'+t.name]);if(!chosen.length){toast('Bitte mindestens ein Team wählen.');return}
 const picked=names.filter(n=>res['shift:'+n]);if(!picked.length){toast('Bitte mindestens einen Dienst wählen.');return}
 if(!validDateInput(res.from)||!validDateInput(res.to)){toast(DATE_RANGE_MSG);return}
 if(res.to<res.from){toast('Das Enddatum darf nicht vor dem Startdatum liegen.');return}
 const dates=[];for(let c=new Date(res.from+'T12:00:00');isoDate(c)<=res.to;c=addDays(c,1)){if(dates.length>366)break;if((c.getDay()+6)%7<dutyDays)dates.push(isoDate(c))}
 if(Math.round((new Date(res.to+'T12:00:00')-new Date(res.from+'T12:00:00'))/86400000)+1>366){toast('Bitte einen Zeitraum von höchstens 366 Tagen auswählen.');return}
 if(!dates.length){toast('Im gewählten Zeitraum liegen keine Arbeitstage.');return}
 const keep=!!res.keep,inRange=a=>a.kind==='Dienstplan'&&!a.isAbsence&&a.date>=res.from&&a.date<=res.to&&chosen.some(t=>t.name===a.team);
 const removing=keep?0:assignments.filter(inRange).length;
 if(removing&&!await ask(`${removing} bestehende Dienste im Zeitraum werden ersetzt. Fortfahren?`,'Ersetzen'))return;
 pushUndo('Rotation');if(!keep)assignments=assignments.filter(a=>!inRange(a));
 const created=[],noShift=[];let absent=0,overlap=0,shortRest=0,moved=0,unfilled=0,dayFree=0;
 const ROTATION_ABSENCES=['Urlaub','Gleittag','Sonderurlaub','Berufsschule','Abwesend'];
 const rotationAbsent=(name,date)=>fullDayAbsent(name,date)||assignments.some(a=>a.isAbsence&&a.employee===name&&a.date===date&&ROTATION_ABSENCES.includes(a.shift));
 const ANCHOR=Date.UTC(2024,0,1);// Montag – fester Bezugspunkt für die Reihenfolge
 const period=date=>{const t=new Date(date+'T12:00:00');const base=res.mode==='week'?weekStart(t):t;return Math.floor((Date.UTC(base.getFullYear(),base.getMonth(),base.getDate())-ANCHOR)/(res.mode==='week'?604800000:86400000))};
 const duty=(name,date)=>assignments.filter(a=>a.employee===name&&a.date===date&&a.kind==='Dienstplan'&&!a.isAbsence&&a.start&&a.end);
 const dayOff=(date,o)=>isoDate(addDays(new Date(date+'T12:00:00'),o));
 chosen.forEach(t=>{
  const shifts=picked.map(n=>shiftTypes.find(s=>s.team===t.name&&s.name===n)).filter(Boolean);if(!shifts.length){noShift.push(t.name);return}
  const members=staff.filter(p=>t.memberIds.includes(p[8])).map(p=>p[0]);
  dates.forEach(date=>{const p=period(date),n=shifts.length,cap=k=>shiftMulti(shifts[k])?Infinity:1;
   const fits=(name,sh)=>{const [ns,ne]=timeSpan(sh);return !(duty(name,dayOff(date,-1)).some(a=>timeSpan(a)[1]-1440>ns)||(ne>1440&&duty(name,dayOff(date,1)).some(a=>timeSpan(a)[0]<ne-1440)))};
   const fixed=new Array(n).fill(0),people=[];let dayAbsent=0;
   members.forEach((name,i)=>{
    const ex=duty(name,date);
    if(ex.length){const k=shifts.findIndex(sh=>ex.some(a=>a.team===t.name&&a.shift===sh.name));if(k>=0)fixed[k]++;return}// bereits eingeteilt: zählt zur Besetzung
    const away=rotationAbsent(name,date);if(away){absent++;dayAbsent++}
    people.push({name,pref:((i+p)%n+n)%n,away});
   });
   /* Verteilung eines Tages:
      1. jeder Dienst wird mindestens einmal besetzt (bevorzugt von Personen, die ihn laut Rotation ohnehin hätten),
      2. alle anderen bekommen ihren Rotationsdienst – ist dieser nur einmal pro Tag erlaubt und schon besetzt,
         einen mehrfach besetzbaren Dienst; gibt es keinen, haben sie an diesem Tag frei,
      3. mehrfach besetzbare Dienste werden möglichst gleich stark besetzt. */
   const planDay=list=>{const counts=[...fixed],asg=new Map(),off=list.length?((p%list.length)+list.length)%list.length:0,rot=[...list.slice(off),...list.slice(0,off)];let unf=0,free=0;
    for(let k=0;k<n;k++){if(counts[k]>0)continue;
     const open=rot.filter(x=>!asg.has(x)&&fits(x.name,shifts[k]));
     const c=open.find(x=>x.pref===k)||open.sort((a,b)=>rot.filter(y=>!asg.has(y)&&y.pref===b.pref).length-rot.filter(y=>!asg.has(y)&&y.pref===a.pref).length)[0];
     if(!c){unf++;continue}asg.set(c,k);counts[k]++}
    rot.forEach(x=>{if(asg.has(x))return;let k=x.pref;
     if(!(counts[k]<cap(k)&&fits(x.name,shifts[k]))){const alt=shifts.map((sh,j)=>j).filter(j=>cap(j)===Infinity&&fits(x.name,shifts[j])).sort((a,b)=>counts[a]-counts[b])[0];if(alt===undefined){free++;return}k=alt}
     asg.set(x,k);counts[k]++});
    const multi=shifts.map((sh,j)=>j).filter(j=>cap(j)===Infinity);
    for(let guard=0;multi.length>1&&guard<list.length*n;guard++){
     let hi=multi[0],lo=multi[0];multi.forEach(j=>{if(counts[j]>counts[hi])hi=j;if(counts[j]<counts[lo])lo=j});
     if(counts[hi]-counts[lo]<=1)break;
     const cands=rot.filter(x=>asg.get(x)===hi&&fits(x.name,shifts[lo]));if(!cands.length)break;
     const c=cands[((p%cands.length)+cands.length)%cands.length];// wechselt von Tag zu Tag
     asg.set(c,lo);counts[hi]--;counts[lo]++}
    return {asg,unf,free}};
   const present=people.filter(x=>!x.away),result=planDay(present);
   unfilled+=result.unf;dayFree+=result.free;
   if(dayAbsent){const base=planDay(people).asg;present.forEach(x=>{if(result.asg.has(x)&&base.get(x)!==result.asg.get(x))moved++})}// Änderungen gegenüber einem Tag ohne Abwesende
   const plan=present.filter(x=>result.asg.has(x)).map(x=>({name:x.name,k:result.asg.get(x)}));
   // Wöchentlicher Wechsel: entsteht durch eine Umverteilung weniger als 11 Std. Ruhezeit zum Vortag,
   // wird mit einer Person getauscht, bei der beide Dienste passen (Besetzung bleibt gleich).
   if(res.mode==='week'&&n>1){const restShort=(name,sh)=>{const ns=timeSpan(sh)[0];return duty(name,dayOff(date,-1)).some(a=>1440+ns-timeSpan(a)[1]<660)};
    plan.forEach(x=>{if(!restShort(x.name,shifts[x.k]))return;const y=plan.find(y=>y!==x&&y.k!==x.k&&!restShort(x.name,shifts[y.k])&&!restShort(y.name,shifts[x.k])&&fits(x.name,shifts[y.k])&&fits(y.name,shifts[x.k]));if(y){const t=x.k;x.k=y.k;y.k=t}})}
   plan.forEach(({name,k})=>{const sh=shifts[k],[ns]=timeSpan(sh);
    const item={id:makeId(),kind:'Dienstplan',team:t.name,employee:name,shift:sh.name,groupId:'',groupName:'',start:sh.start,end:sh.end,color:shiftHexColor(sh.color||'teal'),date};
    assignments.push(item);created.push(item);
    // Ruhezeit zum Vortag unter 11 Stunden? (nur Hinweis)
    if(duty(name,dayOff(date,-1)).some(a=>1440+ns-timeSpan(a)[1]<660))shortRest++;
   });
  });
 });
 persistAssignments();
 audit('Erstellt','Dienstplan',`${created.length} Einträge · ${chosen.map(t=>t.name).join(', ')} · ${picked.join(' / ')}`,{title:'Dienst-Rotation automatisch geplant',object:`${fmtIsoDate(res.from)} – ${fmtIsoDate(res.to)}`,after:`${created.length} Dienste angelegt${moved?`, ${moved} wegen Abwesenheit umverteilt`:''}`});
 createAssignmentNotifications(created);
 const extra=[absent?`${absent}× abwesend`:'',overlap?`${overlap}× Überschneidung`:'',dayFree?`${dayFree}× dienstfrei (kein passender Dienst mehr frei)`:'',noShift.length?`ohne passende Dienste: ${noShift.join(', ')}`:''].filter(Boolean).join(' · ');
 toast(created.length?`${created.length} Dienste wurden eingeteilt.${extra?' Ausgelassen: '+extra+'.':''}${moved?` ${moved} ${moved===1?'Dienst wurde':'Dienste wurden'} wegen Abwesenheit umverteilt.`:''}${unfilled?` Achtung: ${unfilled}× blieb ein Dienst unbesetzt (zu wenige Personen).`:''}${shortRest?` Hinweis: ${shortRest}× weniger als 11 Std. Ruhezeit zum Vortag.`:''}`:`Keine freien Plätze gefunden – nichts zu tun.${extra?' Ausgelassen: '+extra+'.':''}`);render();
}

/* Handy: Tabellen werden zu Karten – jede Zelle bekommt ihre Spaltenüberschrift als Label */
function labelTables(){
 content.querySelectorAll('.table-wrap table').forEach(t=>{
  if(t.closest('.perm-table,.employee-directory-table-wrap'))return;
  t.classList.add('cardify');
  const hs=[...t.querySelectorAll('thead th')].map(th=>th.classList.contains('cb-col')?'':th.textContent.trim());
  t.querySelectorAll('tbody tr').forEach(tr=>{let i=0;[...tr.children].forEach(td=>{const span=+td.getAttribute('colspan')||1;if(span===1&&hs[i]&&!td.dataset.label)td.dataset.label=hs[i];i+=span})});
 });
}
/* Team-Filter als Dropdown mit Suche (Dienstplan & Bereitschaft) */
let teamDd={open:false,q:''};
function teamFilterDropdown(){
 const sel=calendarTeams.filter(n=>teams.some(t=>t.name===n));
 const label=!sel.length?'Alle Teams':sel.length===1?sel[0]:sel.length===2?sel.join(', '):sel.length+' Teams';
 const dot=sel.length===1?`<i class="dot" style="--c:${teamColor(teamByName(sel[0]))}"></i>`:'';
 return `<div class="team-dd ${teamDd.open?'open':''}" id="team-dd"><button type="button" class="chip ${sel.length?'active':''} team-dd-btn" id="team-dd-btn" aria-haspopup="listbox" aria-expanded="${teamDd.open}" title="${escapeHtml(sel.join(', ')||'Alle Teams')}">${icon('users')}${dot}<span class="team-dd-label">${escapeHtml(label)}</span>${icon('down','team-dd-caret')}</button>
  <div class="team-dd-panel" id="team-dd-panel" ${teamDd.open?'':'hidden'}><label class="team-dd-search">${icon('search')}<input type="search" id="team-dd-q" placeholder="Team suchen …" autocomplete="off" value="${escapeHtml(teamDd.q)}"></label>
  <div class="team-dd-list" role="listbox" aria-multiselectable="true"><button type="button" class="team-dd-opt all ${sel.length?'':'on'}" data-team-opt="__all" role="option" aria-selected="${!sel.length}"><span class="team-dd-check">${icon('check')}</span>Alle Teams</button>
  ${teams.map(t=>`<button type="button" class="team-dd-opt ${sel.includes(t.name)?'on':''}" data-team-opt="${escapeHtml(t.name)}" data-q="${escapeHtml(t.name.toLowerCase())}" role="option" aria-selected="${sel.includes(t.name)}"><span class="team-dd-check">${icon('check')}</span><i class="dot" style="--c:${teamColor(t)}"></i><span class="team-dd-name">${escapeHtml(t.name)}</span><small>${t.memberIds.length}</small></button>`).join('')}
  <div class="team-dd-empty" hidden>Kein Team gefunden</div></div>
  ${sel.length?`<div class="team-dd-foot"><span>${sel.length} ausgewählt</span><button type="button" class="link-btn" data-team-opt="__all">Auswahl aufheben</button></div>`:''}</div></div>`;
}
let teamDdDocBound=false;
function bindTeamDropdown(){
 const dd=document.getElementById('team-dd');if(!dd)return;
 const btn=dd.querySelector('#team-dd-btn'),panel=dd.querySelector('#team-dd-panel'),q=dd.querySelector('#team-dd-q');
 const filter=()=>{const v=q.value.trim().toLowerCase();teamDd.q=q.value;let n=0;
  dd.querySelectorAll('.team-dd-opt[data-q]').forEach(o=>{const hit=!v||o.dataset.q.includes(v);o.hidden=!hit;if(hit)n++});
  dd.querySelector('.team-dd-opt.all').hidden=!!v;dd.querySelector('.team-dd-empty').hidden=n>0};
 const place=()=>{panel.style.left='';panel.style.right='';const r=panel.getBoundingClientRect();if(r.right>window.innerWidth-8){panel.style.left='auto';panel.style.right='0'}if(panel.getBoundingClientRect().left<8){panel.style.right='auto';panel.style.left=(8-dd.getBoundingClientRect().left)+'px'}};
 const open=(focus=true)=>{teamDd.open=true;dd.classList.add('open');panel.hidden=false;btn.setAttribute('aria-expanded','true');filter();place();if(focus&&!isTouchDevice())q.focus({preventScroll:true})};
 const close=()=>{teamDd.open=false;teamDd.q='';dd.classList.remove('open');panel.hidden=true;btn.setAttribute('aria-expanded','false')};
 btn.onclick=e=>{e.stopPropagation();teamDd.open?close():open()};
 q.oninput=filter;
 const opts=()=>[...dd.querySelectorAll('.team-dd-opt')].filter(o=>!o.hidden);
 q.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();opts()[0]?.focus()}else if(e.key==='Enter'){e.preventDefault();const o=dd.querySelector('.team-dd-opt[data-q]:not([hidden])');o&&o.click()}else if(e.key==='Escape'){e.stopPropagation();close();btn.focus()}};
 dd.querySelector('.team-dd-list').onkeydown=e=>{const list=opts(),i=list.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){e.preventDefault();list[Math.min(list.length-1,i+1)]?.focus()}else if(e.key==='ArrowUp'){e.preventDefault();i<=0?q.focus():list[i-1].focus()}else if(e.key==='Escape'){e.stopPropagation();close();btn.focus()}};
 dd.querySelectorAll('[data-team-opt]').forEach(o=>o.onclick=e=>{e.stopPropagation();const v=o.dataset.teamOpt;
  if(v==='__all')calendarTeams=[];else calendarTeams=calendarTeams.includes(v)?calendarTeams.filter(t=>t!==v):[...calendarTeams.filter(n=>teams.some(t=>t.name===n)),v];
  calendarTeamFilter=calendarTeams[0]||'Alle Teams';
  if(calendarMemberFilter!=='Alle Mitarbeiter'&&calendarTeams.length&&!staff.some(s=>s[0]===calendarMemberFilter&&teams.some(t=>calendarTeams.includes(t.name)&&t.memberIds.includes(s[8]))))calendarMemberFilter='Alle Mitarbeiter';
  const keep=teamDd.q,focusName=v,y=window.scrollX,sy=window.scrollY,ls=dd.querySelector('.team-dd-list').scrollTop;
  render();window.scrollTo(y,sy);
  const nd=document.getElementById('team-dd');if(!nd)return;teamDd.q=keep;
  bindTeamDropdownOpen(nd,ls,focusName)});
 if(teamDd.open)open(false);
 if(!teamDdDocBound){teamDdDocBound=true;
  document.addEventListener('pointerdown',e=>{if(!teamDd.open)return;const d=document.getElementById('team-dd');if(d&&d.contains(e.target))return;teamDd.open=false;teamDd.q='';if(d){d.classList.remove('open');d.querySelector('#team-dd-panel').hidden=true;d.querySelector('#team-dd-btn').setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&teamDd.open){const d=document.getElementById('team-dd');teamDd.open=false;teamDd.q='';if(d){d.classList.remove('open');d.querySelector('#team-dd-panel').hidden=true}}})}
}
// Touch-Geräte (Handy/Tablet): Suchfeld nicht automatisch fokussieren, sonst öffnet sich die Bildschirmtastatur
const isTouchDevice=()=>window.matchMedia('(pointer: coarse)').matches||('ontouchstart' in window&&window.matchMedia('(max-width: 1024px)').matches);
function bindTeamDropdownOpen(nd,listScroll,focusName){
 const q=nd.querySelector('#team-dd-q');q.value=teamDd.q;q.dispatchEvent(new Event('input'));
 const l=nd.querySelector('.team-dd-list');l.scrollTop=listScroll;
 const o=[...nd.querySelectorAll('[data-team-opt]')].find(x=>x.dataset.teamOpt===focusName&&x.classList.contains('team-dd-opt'));const wasTyping=document.activeElement===q;if(isTouchDevice()&&!wasTyping){o&&o.focus({preventScroll:true})}else (o||q).focus({preventScroll:true});
}
function bindCalendarExtras(){
 bindTeamDropdown();
 const oc=document.getElementById('only-conflicts');if(oc)oc.onclick=()=>{onlyConflicts=!onlyConflicts;render()};
 const ub=document.getElementById('undo-btn');if(ub)ub.onclick=undoLast;
 const tn=document.getElementById('toggle-now');if(tn)tn.onclick=()=>{window.__showAllStandby=!window.__showAllStandby;render()};
 const ar=document.getElementById('auto-rotation');if(ar)ar.onclick=autoRotation;
 const dr=document.getElementById('duty-rotation');if(dr)dr.onclick=dutyRotation;
 content.querySelectorAll('[data-gap-team]').forEach(b=>b.onclick=()=>{openDutyModalFor({team:b.dataset.gapTeam,date:b.dataset.gapFrom});document.getElementById('duty-date-to').value=b.dataset.gapTo});
 content.querySelectorAll('[data-swap-team]').forEach(b=>b.onclick=()=>swapStandby(b.dataset.swapTeam,b.dataset.swapIds.split(',').filter(Boolean)));
 // Drag & Drop: Einträge auf einen anderen Tag (oder in der Team-Ansicht zu einer anderen Person) ziehen
 let dragId=null;
 content.querySelectorAll('[data-drag-id]').forEach(el=>{
  el.addEventListener('dragstart',e=>{dragId=el.dataset.dragId;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId)}catch(_){}el.classList.add('dragging');content.classList.add('is-dragging')});
  el.addEventListener('dragend',()=>{el.classList.remove('dragging');content.classList.remove('is-dragging');content.querySelectorAll('.drop-hover').forEach(x=>x.classList.remove('drop-hover'))});
 });
 content.querySelectorAll('[data-drop-date]').forEach(cell=>{
  cell.addEventListener('dragover',e=>{if(!dragId)return;e.preventDefault();e.dataTransfer.dropEffect='move';cell.classList.add('drop-hover')});
  cell.addEventListener('dragleave',e=>{if(!cell.contains(e.relatedTarget))cell.classList.remove('drop-hover')});
  cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('drop-hover');const id=dragId;dragId=null;if(id)moveAssignment(id,cell.dataset.dropDate,cell.dataset.dropEmp)});
 });
}

/* ------------------------------------------------------------------
   Bereitschaft verwalten (Admin)
------------------------------------------------------------------ */
function standbyManagementPage(){
 if(!canView('Bereitschaft verwalten'))return `${heading('Zugriff nicht möglich','Diese Seite ist ausschließlich für Administratoren verfügbar.')}`;
 const groupCount=standbyGroups.length,timeCount=standbyTimes.length;
 return `${heading('Bereitschaft verwalten','Gruppen, Zeitfenster und Teamfarben – unabhängig von den regulären Dienstzeiten.')}
 <div class="stats stats-2"><div class="stat-card"><div><div class="stat-label">Gruppen</div><div class="stat-value">${groupCount}</div><div class="stat-note">Organisatorische Bereiche</div></div><div class="stat-icon">${icon('sliders')}</div></div><div class="stat-card"><div><div class="stat-label">Bereitschaftszeiten</div><div class="stat-value">${timeCount}</div><div class="stat-note">Zeitfenster gesamt</div></div><div class="stat-icon">${icon('clock')}</div></div></div>
 <div class="standby-management-layout">
  <section class="panel"><div class="card-kicker">SCHRITT 1</div><h2>Bereitschaftsgruppe anlegen</h2><p class="sub">Ein organisatorischer Bereich, z. B. ein Standort oder Fachbereich.</p><form id="standby-group-form" class="stack-form"><label>Name der Gruppe<input id="standby-group-name" required maxlength="60" placeholder="z. B. Rufbereitschaft Nord"></label><div class="btn-row end"><button class="btn primary" type="submit">＋ Gruppe erstellen</button></div></form></section>
  <section class="panel"><div class="card-kicker">SCHRITT 2</div><h2>Bereitschaftszeit hinzufügen</h2><p class="sub">Eine benannte Zeitspanne innerhalb einer Gruppe. Über Mitternacht ist möglich.</p><form id="standby-time-form" class="stack-form"><label>Zugehörige Gruppe<select id="standby-time-group" required ${groupCount?'':'disabled'}>${standbyGroups.map(g=>`<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join('')||'<option value="">Zuerst eine Gruppe erstellen</option>'}</select></label><label>Bezeichnung<input id="standby-time-name" required maxlength="60" placeholder="z. B. Nachtbereitschaft" ${groupCount?'':'disabled'}></label><div class="form-two"><label>Beginn<input id="standby-time-start" type="time" value="00:00" required ${groupCount?'':'disabled'}></label><label>Ende<input id="standby-time-end" type="time" value="23:59" required ${groupCount?'':'disabled'}></label></div><div class="btn-row end"><button class="btn primary" type="submit" ${groupCount?'':'disabled'}>＋ Bereitschaftszeit hinzufügen</button></div></form></section>
 </div>
 <section class="panel"><div class="panel-head"><div><h2>Gruppen und Zeiten im Überblick</h2><p class="sub">Zeitfenster auf einer 24-Stunden-Skala.</p></div><span class="pill">${groupCount} Gruppen · ${timeCount} Zeiten</span></div>
 ${groupCount?standbyGroups.map(g=>{const times=standbyTimes.filter(t=>t.groupId===g.id);const segs=times.flatMap(t=>{const s=durationHoursStart(t.start),e=durationHoursStart(t.end);const c=shiftHexColor(t.color||'#159da8');return e>s?[[s,e,c,t.name]]:[[s,24,c,t.name],[0,e,c,'']]});return `<article class="standby-group-row"><div class="standby-group-head"><div><b>${escapeHtml(g.name)}</b><small>${times.length} ${times.length===1?'Zeitfenster':'Zeitfenster'}</small></div><button class="btn danger" type="button" data-delete-standby-group="${escapeHtml(g.id)}">Gruppe löschen</button></div><div class="day-scale"><div class="day-scale-labels">${[0,3,6,9,12,15,18,21,24].map(h=>`<span>${String(h).padStart(2,'0')}</span>`).join('')}</div><div class="day-scale-bar">${segs.map(([s,e,c,name])=>`<i style="left:${s/24*100}%;width:${(e-s)/24*100}%;background:${c}">${escapeHtml(name)}</i>`).join('')}</div></div><div class="standby-time-chips">${times.map(t=>`<span class="standby-time-chip"><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.start)} – ${escapeHtml(t.end)} Uhr${durationHoursStart(t.end)<=durationHoursStart(t.start)?' (+1 Tag)':''}</small><button type="button" class="chip-x" data-delete-standby-time="${escapeHtml(t.id)}" title="Zeitfenster löschen" aria-label="Zeitfenster ${escapeHtml(t.name)} löschen">×</button></span>`).join('')||'<span class="muted small">Noch keine Zeiten zugeordnet.</span>'}</div></article>`}).join(''):'<div class="empty-note">Derzeit sind noch keine Gruppen angelegt. Erstelle zuerst eine Bereitschaftsgruppe.</div>'}</section>
 <section class="panel"><div class="panel-head"><div><h2>Bereitschaftsfarben je Team</h2><p class="sub">Diese Farbe wird für alle Bereitschaftseinträge des Teams verwendet.</p></div></div><div class="standby-team-color-list">${teams.map(t=>`<label class="standby-team-color-row"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(t.standbyColor||'')?t.standbyColor:'#159da8'}" data-standby-team-color="${escapeHtml(t.id)}" aria-label="Bereitschaftsfarbe für ${escapeHtml(t.name)}"><span><b>${escapeHtml(t.name)}</b><small>${escapeHtml(t.standbyColor||'#159da8')}</small></span></label>`).join('')}</div></section>`;
}
function durationHoursStart(hhmm){const [h,m]=String(hhmm||'0:0').split(':').map(Number);return h+(m||0)/60}

/* ------------------------------------------------------------------
   Dashboards
------------------------------------------------------------------ */
function scopeTeams(){
 if(['Admin','Abteilungsleiter','Lohnverrechnung'].includes(currentRole))return teams;
 const mine=teams.filter(t=>currentUserTeamNames().includes(t.name));return mine.length?mine:teams;
}

/* ==================================================================
   Dashboard – Baukasten aus Kacheln (Widgets)
   ------------------------------------------------------------------
   Neue Ansicht hinzufügen: in DASH_WIDGETS einen Eintrag ergänzen:
     { id, title, desc, size:'tile'|'half'|'full', lead:true (nur Leitungsrollen),
       hidden:true (standardmäßig ausgeblendet), render(ctx) → HTML, action(ctx) → Klick (optional) }
   Neue Widgets erscheinen automatisch im Dialog „Dashboard anpassen“ und werden bei
   bestehenden Layouts an ihrer Standardposition eingefügt.
================================================================== */
const isLeadDash=()=>currentRole!=='Mitarbeiter';
const ABSENCE_FULLDAY=['Urlaub','Gleittag','Sonderurlaub','Berufsschule','Abwesend'];
let dashLayouts=load('dienstplanDashLayout',{});if(!dashLayouts||typeof dashLayouts!=='object'||Array.isArray(dashLayouts))dashLayouts={};
const dashKey=()=>(currentUserId||'-')+'|'+(isLeadDash()?'lead':'emp');

/* Offene Punkte (nur Leitungsrollen) – jeder Punkt weiß, wohin er führt */
function dashIssues(scope){
 const issues=[],inScope=a=>scope.some(t=>t.name===a.team);
 scope.forEach(t=>{
  if(!t.leaderId)issues.push({level:'warn',icon:'users',title:`${t.name} ohne Teamleiter`,text:'In der Teamverwaltung festlegen',page:'Administration',team:t.id});
  if(!t.deputyId)issues.push({level:'warn',icon:'users',title:`${t.name} ohne Deputy`,text:'Stellvertretung in der Teamverwaltung festlegen',page:'Administration',team:t.id});});
 const horizon=Array.from({length:14},(_,i)=>isoDate(addDays(new Date(),i)));
 scope.forEach(t=>{const gaps=horizon.filter(date=>!assignments.some(a=>a.date===date&&a.team===t.name&&a.kind==='Bereitschaft'));
  if(gaps.length)issues.push({level:'crit',icon:'moon',title:`${t.name}: ${gaps.length} ${gaps.length===1?'Tag':'Tage'} ohne Bereitschaft`,text:'Erster offener Tag: '+fmt(new Date(gaps[0]+'T12:00:00')),page:'Bereitschaft',view:'Woche',date:gaps[0],teamName:t.name})});
 const ids=computeConflicts(),hits=assignments.filter(a=>!a.isAbsence&&ids.has(a.id)&&horizon.includes(a.date)&&inScope(a)).sort((a,b)=>a.date.localeCompare(b.date));
 if(hits.length)issues.unshift({level:'crit',icon:'cal',title:`${hits.length} Überschneidung${hits.length===1?'':'en'}`,text:'Dienst oder Bereitschaft trifft auf Abwesenheit oder einen anderen Dienst (nächste 14 Tage)',page:'Dienstplan',view:'Woche',date:hits[0].date,teamName:hits[0].team,conflicts:true});
 const usedPct=Math.round(storageUsed()/STORAGE_LIMIT*100);
 if(usedPct>=80&&currentRole==='Admin')issues.unshift({level:usedPct>=95?'crit':'warn',icon:'alert',title:`Browserspeicher zu ${usedPct} % belegt`,text:'Unter Einstellungen alte Einträge archivieren',page:'Einstellungen',anchor:'set-data'});
 return issues;
}
function openIssue(x){
 if(!allowedPages().includes(x.page)){toast('Dieser Bereich ist für deine Benutzergruppe nicht freigegeben.');return}
 if(x.page==='Administration'&&x.team){adminOpenTeam=x.team}
 go(x.page);
 if(x.page==='Dienstplan'||x.page==='Bereitschaft'){
  if(x.view)currentView=x.view;
  if(x.teamName){calendarTeams=[x.teamName];calendarTeamFilter=x.teamName}
  if(x.conflicts)onlyConflicts=true;
  if(x.date){currentDate=new Date(x.date+'T12:00:00');selectedMobileDate=x.date}
  render();
 }
 if(x.anchor)setTimeout(()=>document.getElementById(x.anchor)?.scrollIntoView({behavior:'smooth',block:'start'}),60);
}
/* Kachel-Klick: Dienstplan bzw. Bereitschaft immer in der Wochenansicht öffnen */
function goView(page,view,f={}){go(page);if(currentPage!==page)return;currentView=view;currentDate=new Date();selectedMobileDate='';
 if(f.teams){calendarTeams=f.teams;calendarTeamFilter=f.teams[0]||'Alle Teams'}
 if(f.member!==undefined)calendarMemberFilter=f.member||'Alle Mitarbeiter';
 onlyConflicts=false;render()}

/* Alle Daten, die die Widgets brauchen, einmal pro Aufbau berechnen */
function dashCtx(){
 buildWpIndex();
 const me=staff.find(s=>s[8]===currentUserId),name=me?.[0]||'',today=isoDate(new Date());
 const byTime=(a,b)=>a.date.localeCompare(b.date)||(a.start||'').localeCompare(b.start||'');
 const mine=assignments.filter(a=>a.employee===name);
 const upcoming=mine.filter(a=>!a.isAbsence&&a.date>=today&&(a.kind==='Dienstplan'||a.kind==='Bereitschaft')).sort(byTime);
 const duties=upcoming.filter(a=>a.kind==='Dienstplan'),standbys=upcoming.filter(a=>a.kind==='Bereitschaft');
 const lead=isLeadDash();
 const scope=lead?scopeTeams():teams.filter(t=>currentUserTeamNames().includes(t.name));
 const scopeNames=new Set(scope.map(t=>t.name)),members=new Set(staff.filter(s=>scope.some(t=>t.memberIds.includes(s[8]))).map(s=>s[0]));
 const absSeen=new Set(),absences=assignments.filter(a=>a.isAbsence&&a.date===today&&(scopeNames.has(a.team)||members.has(a.employee))).filter(a=>{const k=a.employee+'|'+a.shift+'|'+(a.start||'');if(absSeen.has(k))return false;absSeen.add(k);return true}).sort((a,b)=>a.employee.localeCompare(b.employee));
 const ws=weekStart(new Date()),wsIso=isoDate(ws),weIso=isoDate(addDays(ws,6));
 const weekHours=mine.filter(a=>a.kind==='Dienstplan'&&!a.isAbsence&&a.date>=wsIso&&a.date<=weIso).reduce((s,a)=>s+netHours(a),0);
 const todays=assignments.filter(a=>a.date===today&&scopeNames.has(a.team));
 return {me,name,today,mine,duties,standbys,lead,scope,scopeNames,absences,weekHours,ws,
  teamDuties:todays.filter(a=>a.kind==='Dienstplan'&&!a.isAbsence).sort((a,b)=>(a.start||'').localeCompare(b.start||'')||a.employee.localeCompare(b.employee)),
  teamStandbys:todays.filter(a=>a.kind==='Bereitschaft'),
  memberCount:new Set(scope.flatMap(t=>t.memberIds)).size,
  issues:lead?dashIssues(scope):[]};
}
const dashDay=iso=>new Date(iso+'T12:00:00');
const daysUntil=iso=>Math.round((dashDay(iso)-dashDay(isoDate(new Date())))/86400000);
const inDaysText=n=>n<=0?'heute':n===1?'morgen':`in ${n} Tagen`;
/* Externer Link „Mein Porsche Cockpit“ – nur Admin kann ihn in der Administration festlegen/ändern */
let cockpitLink=(()=>{const v=load('dienstplanCockpitLink',{});return v&&typeof v==='object'?v:{}})();
function normalizeUrl(raw){let u=String(raw||'').trim();if(!u)return '';if(!/^[a-z][a-z0-9+.-]*:/i.test(u))u='https://'+u;try{const x=new URL(u);if(!['http:','https:'].includes(x.protocol))return null;if(!x.hostname||!x.hostname.includes('.')&&x.hostname!=='localhost')return null;return x.href}catch(e){return null}}
function cockpitHost(){try{return new URL(cockpitLink.url).hostname.replace(/^www\./,'')}catch(e){return ''}}
function openCockpitLink(){
 if(!cockpitLink.url){toast(currentRole==='Admin'?'Für „Mein Porsche Cockpit“ ist noch kein Link hinterlegt. Du kannst ihn unter Einstellungen → Links festlegen.':'Für „Mein Porsche Cockpit“ ist noch kein Link hinterlegt. Bitte wende dich an einen Admin.');return}
 const a=document.createElement('a');a.href=cockpitLink.url;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();
}
async function editCockpitLink(){
 if(currentRole!=='Admin'){toast('Nur Admins können diesen Link ändern.');return}
 const res=await formDialog('Link „Mein Porsche Cockpit“',`<label class="field">Adresse (URL)<input type="text" name="url" inputmode="url" autocomplete="url" spellcheck="false" placeholder="https://…" value="${escapeHtml(cockpitLink.url||'')}"></label><p class="small muted" style="margin:8px 0 0">Ein Klick auf die Kachel „Mein Porsche Cockpit“ im Dashboard öffnet diese Seite in einem neuen Tab – für alle Benutzer. Leer lassen und speichern entfernt den Link.</p>`,'Speichern','Nur für Admins. Der Link lässt sich jederzeit hier ändern.');
 if(!res)return;
 const url=normalizeUrl(res.url);
 if(url===null){toast('Bitte eine gültige Adresse eingeben, z. B. https://beispiel.at');return editCockpitLink()}
 const before=cockpitLink.url||'—';
 cockpitLink=url?{url,by:currentUserName(),at:Date.now()}:{};save('dienstplanCockpitLink',cockpitLink);
 audit(url?(before==='—'?'Erstellt':'Geändert'):'Gelöscht','Administration','Link „Mein Porsche Cockpit“',{title:'Dashboard-Link geändert',object:'Mein Porsche Cockpit',before,after:url||'—'});
 toast(url?'Link gespeichert.':'Link entfernt.');render();
}
function statTile({label,value,note,ic,tone=''}){return `<div class="stat-card dash-stat"><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div><div class="stat-icon ${tone}">${icon(ic,ic==='travel'?'ic-fill':'')}</div></div>`}
/* zusammenhängende Bereitschaftstage zu Blöcken zusammenfassen */
function standbyRuns(list){const runs=[];list.forEach(a=>{const last=runs[runs.length-1];if(last&&last.team===a.team&&daysUntil(a.date)-daysUntil(last.to)===1){last.to=a.date;last.items.push(a)}else if(!(last&&last.to===a.date))runs.push({from:a.date,to:a.date,team:a.team,items:[a]})});return runs}

const DASH_WIDGETS=[
 {id:'today',title:'Heute',desc:'Dein heutiger Dienst in der Akzentfarbe',size:'full',render:c=>{
  const abs=c.mine.find(a=>a.isAbsence&&a.date===c.today),duty=c.duties.filter(a=>a.date===c.today),sb=c.standbys.find(a=>a.date===c.today);
  const main=duty.length?`<b>${duty.map(a=>`${escapeHtml(a.shift)} · ${a.start}–${a.end}`).join(' / ')}</b><small>${escapeHtml(duty[0].team)}${sb?` · Bereitschaft ${sb.start}–${sb.end}`:''}</small>`
   :abs?`<b>${escapeHtml(abs.shift)}</b><small>${abs.start?`${abs.start}–${abs.end} · `:''}${escapeHtml(abs.team||'')}</small>`
   :sb?`<b>Bereitschaft · ${sb.start}–${sb.end}</b><small>${escapeHtml(sb.team)}</small>`
   :`<b>Kein Dienst eingetragen</b><small>Genieße deinen freien Tag.</small>`;
  return `<div class="today-hero"><span>HEUTE</span>${main}</div>`}},
 {id:'kDuties',title:'Kommende Dienste',desc:'Anzahl deiner nächsten Dienste · Klick öffnet den Dienstplan (Woche)',size:'tile',
  render:c=>statTile({label:'Kommende Dienste',value:c.duties.length,note:c.duties[0]?'Nächster: '+fmtShortWd(dashDay(c.duties[0].date)):'Keine Dienste geplant',ic:'cal'}),action:()=>goView('Dienstplan','Woche')},
 {id:'kStandby',title:'Kommende Bereitschaften',desc:'Anzahl deiner nächsten Bereitschaften · Klick öffnet die Bereitschaft (Woche)',size:'tile',
  render:c=>statTile({label:'Kommende Bereitschaften',value:c.standbys.length,note:c.standbys[0]?'Nächste: '+fmtShortWd(dashDay(c.standbys[0].date)):'Keine Bereitschaft geplant',ic:'moon'}),action:()=>goView('Bereitschaft','Woche',{teams:[],member:''})},
 {id:'kAbsence',title:'Aktuelle Abwesenheiten',desc:'Wer heute fehlt · Klick zeigt Details',size:'tile',
  render:c=>{const n=new Set(c.absences.map(a=>a.employee)).size;return statTile({label:'Aktuelle Abwesenheiten',value:n,note:n?escapeHtml([...new Set(c.absences.map(a=>a.shift))].slice(0,2).join(', ')):'Niemand abwesend',ic:'travel',tone:'amber'})},action:c=>absencePopup(c)},
 {id:'kIssues',title:'Offene Punkte',desc:'Automatisch erkannte Lücken & Konflikte · Klick zeigt Details',size:'tile',lead:true,
  render:c=>statTile({label:'Offene Punkte',value:c.issues.length,note:c.issues.length?`${c.issues.filter(i=>i.level==='crit').length} kritisch`:'Alles erledigt',ic:'alert',tone:'red'}),action:c=>issuesPopup(c)},
{id:'kSwaps',title:'Diensttausch',desc:'Offene Tauschanfragen an dich und von dir · Klick öffnet die Übersicht',size:'tile',
  render:c=>{const inc=swapsIncoming().length,out=swapsOutgoing().length;return statTile({label:'Diensttausch',value:inc,note:inc?(inc===1?'Anfrage wartet auf dich':'Anfragen warten auf dich'):out?`${out} eigene ${out===1?'Anfrage':'Anfragen'} offen`:'Keine offenen Anfragen',ic:'refresh',tone:inc?'amber':''})},action:()=>openSwapCenter()},
 {id:'kHours',title:'Mein Porsche Cockpit',desc:'Ich@Porsche – Übersicht: Homeoffice- & Bürotage',size:'tile',
  render:c=>statTile({label:'Mein Porsche Cockpit',value:'Ich@Porsche',note:'Übersicht: Homeoffice- & Bürotage',ic:'external',tone:'cockpit'}),action:c=>openCockpitLink()},
 {id:'kTeamDuty',title:'Heute im Dienst',desc:'Besetzung deiner Teams heute',size:'tile',lead:true,hidden:true,
  render:c=>{const on=new Set(c.teamDuties.map(a=>a.employee)).size,pct=c.memberCount?Math.round(on/c.memberCount*100):0;return statTile({label:'Heute im Dienst',value:`${on}<small> / ${c.memberCount}</small>`,note:`${pct} % Besetzung`,ic:'users'})},action:()=>goView('Dienstplan','Team')},
 {id:'kTeamStandby',title:'Bereitschaft heute',desc:'Bereitschaften deiner Teams heute',size:'tile',lead:true,hidden:true,
  render:c=>{const missing=c.scope.length-new Set(c.teamStandbys.map(a=>a.team)).size;return statTile({label:'Bereitschaft heute',value:c.teamStandbys.length,note:missing>0?`${missing} Team(s) ohne Bereitschaft`:'Alle Teams besetzt',ic:'moon'})},action:()=>goView('Bereitschaft','Woche')},
 {id:'kWorkplace',title:'Büro & Homeoffice',desc:'Deine eingetragenen Büro- und Homeoffice-Tage in diesem Monat · Klick zeigt deinen Dienstplan',size:'half',
  render:c=>{const m=c.today.slice(0,7),mine=c.mine.filter(a=>a.kind==='Arbeitsort'&&a.date.slice(0,7)===m),office=new Set(mine.filter(a=>a.shift==='Büro').map(a=>a.date)).size,home=new Set(mine.filter(a=>a.shift==='Homeoffice').map(a=>a.date)).size;
   const total=office+home,po=total?Math.round(office/total*100):0;
   return `<div class="stat-card dash-stat wp-card"><div class="wp-head"><span class="stat-label">Büro &amp; Homeoffice</span><span class="wp-month">${icon('cal')}${monthName(new Date())}</span></div>
    <div class="wp-grid"><div class="wp-box office"><span class="wp-ic">${icon('build')}</span><span class="wp-num"><b>${office}</b><small>${office===1?'Tag':'Tage'} Büro</small></span></div><div class="wp-box home"><span class="wp-ic">${icon('home')}</span><span class="wp-num"><b>${home}</b><small>${home===1?'Tag':'Tage'} Homeoffice</small></span></div></div>
    ${total?`<div class="wp-bar" role="img" aria-label="${po} % Büro, ${100-po} % Homeoffice"><i style="width:${po}%"></i></div><div class="wp-legend"><span><i class="o"></i>${po} % Büro</span><span><i class="h"></i>${100-po} % Homeoffice</span></div>`:`<div class="wp-empty">Diesen Monat noch keine Arbeitsorte eingetragen</div>`}</div>`},
  action:c=>goView('Dienstplan','Woche',{teams:currentUserTeamNames().length?currentUserTeamNames():[],member:c.name})},
 {id:'myDuties',title:'Meine Dienste',desc:'Montag bis Freitag, 5 Tage ab heute',size:'half',render:c=>{
  const days=[];let d=new Date();d.setHours(12,0,0,0);while((d.getDay()+6)%7>4)d=addDays(d,1);
  while(days.length<5){if((d.getDay()+6)%7<5)days.push(isoDate(d));d=addDays(d,1)}
  const rows=days.map((iso,i)=>{const dt=dashDay(iso),wd=(dt.getDay()+6)%7,items=c.mine.filter(a=>a.date===iso&&a.kind==='Dienstplan'&&!a.isAbsence).sort((a,b)=>(a.start||'').localeCompare(b.start||'')),abs=c.mine.find(a=>a.date===iso&&a.isAbsence);
   const sep=i>0&&wd===0?`<div class="dash-week-sep">Nächste Woche</div>`:'';
   const date=`<div class="dash-day"><b>${WEEKDAYS[wd]}</b><small>${fmtShort(dt)}</small>${iso===c.today?'<em>Heute</em>':''}</div>`;
   const body=items.length?items.map(a=>`<div class="dash-duty" style="--c:${shiftHexColor(assignmentColor(a))}"><div><b>${escapeHtml(a.shift)}</b><small>${escapeHtml(a.team)}</small>${wpHint(wpFor(a),'on-light')}${swapPill(a)}</div><span class="employee-time-pill">${a.start}–${a.end}</span></div>`).join('')
    :abs?`<div class="dash-duty is-absence"><div><b>${escapeHtml(abs.shift)}</b><small>Abwesenheit${abs.start?` · ${abs.start}–${abs.end}`:''}</small></div></div>`
    :`<div class="dash-duty is-free"><div><b>Kein Dienst</b><small>Frei</small></div></div>`;
   return `${sep}<div class="dash-day-row ${iso===c.today?'is-today':''}">${date}<div class="dash-day-items">${body}</div></div>`}).join('');
  return `<section class="panel dash-panel"><div class="panel-head"><div><h2>Meine Dienste</h2><p class="sub">Montag bis Freitag · ab heute</p></div><button class="btn" data-go="Dienstplan">Dienstplan öffnen</button></div>${rows}</section>`}},
 {id:'myStandby',title:'Meine Bereitschaften',desc:'Aktuelle und nächste Bereitschaft',size:'half',render:c=>{
  const runs=standbyRuns(c.mine.filter(a=>a.kind==='Bereitschaft'&&a.date>=isoDate(addDays(new Date(),-31))).sort((a,b)=>a.date.localeCompare(b.date)));
  const cur=runs.find(r=>r.from<=c.today&&r.to>=c.today),next=runs.find(r=>r.from>c.today);
  const range=r=>r.from===r.to?fmtShortWd(dashDay(r.from)):`${fmtShortWd(dashDay(r.from))} – ${fmtShortWd(dashDay(r.to))}`;
  const block=(r,label,cls)=>{const a=r.items.find(x=>x.date===c.today)||r.items[0];return `<div class="dash-sb ${cls}"><div class="dash-sb-label">${label}</div><b>${range(r)}</b><small>${escapeHtml(r.team)} · ${a.start}–${a.end}${a.groupName?' · '+escapeHtml(a.groupName):''}</small></div>`};
  const html=(cur?block(cur,'Du hast Bereitschaft','is-now'):'')+(next?block(next,`Nächste Bereitschaft · ${inDaysText(daysUntil(next.from))}`,''):'')||'<div class="employee-empty">Keine Bereitschaft geplant.</div>';
  return `<section class="panel dash-panel dash-standby"><div class="panel-head"><h2>Meine Bereitschaften</h2><button class="btn" data-go="Bereitschaft">Bereitschaft öffnen</button></div>${html}</section>`}},
 {id:'teamToday',title:'Heute im Dienst (Teams)',desc:'Liste aller Dienste deiner Teams heute',size:'half',lead:true,render:c=>{
  const d=c.teamDuties;return `<section class="panel dash-panel"><div class="panel-head"><div><h2>Heute im Dienst</h2><p class="sub">${fmtWithWeekday(new Date())}</p></div><button class="btn" data-go="Dienstplan">Dienstplan öffnen</button></div>
  ${d.length?d.slice(0,8).map(a=>`<div class="schedule-row"><div class="schedule-time">${a.start}–${a.end}</div><div class="person">${avatarHtml(a.employee,teamColor(teamByName(a.team)),32)}<div><b>${escapeHtml(a.employee)}</b><small>${escapeHtml(a.shift)}</small></div></div><span class="pill" style="--c:${teamColor(teamByName(a.team))}">${escapeHtml(a.team)}</span></div>`).join('')+(d.length>8?`<div class="more-line">+ ${d.length-8} weitere · <button class="link-btn" data-go="Dienstplan">alle anzeigen</button></div>`:''):'<div class="empty-note">Heute sind keine Dienste eingetragen.</div>'}</section>`}},
 {id:'standbyToday',title:'Bereitschaft heute (Teams)',desc:'Wer heute erreichbar ist – mit Anruf-Button',size:'half',lead:true,render:c=>{
  const s=c.teamStandbys;return `<section class="panel dash-panel"><div class="panel-head"><div><h2>Bereitschaft heute</h2><p class="sub">Direkt erreichbar</p></div><span class="pill teal">${s.length} aktiv</span></div>
  ${s.length?s.slice(0,6).map(a=>{const p=staff.find(x=>x[0]===a.employee);return `<div class="schedule-row standby-row"><div class="person">${avatarHtml(a.employee,teamColor(teamByName(a.team)),34)}<div><b>${escapeHtml(a.employee)}</b><small>${escapeHtml(a.team)} · ${a.start}–${a.end}</small></div></div>${p&&p[7]?`<a class="btn small" href="tel:${escapeHtml(p[7].replace(/\s+/g,''))}">Anrufen</a>`:''}</div>`}).join('')+(s.length>6?`<div class="more-line">+ ${s.length-6} weitere · <button class="link-btn" data-go="Bereitschaft">alle anzeigen</button></div>`:''):'<div class="empty-note">Heute ist keine Bereitschaft eingetragen.</div>'}</section>`}},
 {id:'weekLoad',title:'Wochenauslastung',desc:'Dienste, Bereitschaften und Abwesenheiten je Tag',size:'half',lead:true,render:c=>{
  const dates=Array.from({length:7},(_,i)=>isoDate(addDays(c.ws,i))),stats=dates.map(date=>{const it=assignments.filter(a=>a.date===date&&c.scopeNames.has(a.team));return {date,d:it.filter(a=>a.kind==='Dienstplan'&&!a.isAbsence).length,s:it.filter(a=>a.kind==='Bereitschaft').length,a:it.filter(a=>a.isAbsence).length}}),max=Math.max(1,...stats.map(x=>x.d+x.s+x.a));
  return `<section class="panel dash-panel"><div class="panel-head"><div><h2>Wochenauslastung KW ${isoWeek(c.ws)}</h2><p class="sub">Dienste, Bereitschaften und Abwesenheiten</p></div></div>
   <div class="week-bars">${stats.map((x,i)=>`<div class="week-bar ${x.date===c.today?'today':''}" title="${x.d} Dienste · ${x.s} Bereitschaften · ${x.a} Abwesenheiten"><div class="week-bar-stack"><i class="a" style="height:${x.a/max*100}%"></i><i class="s" style="height:${x.s/max*100}%"></i><i class="d" style="height:${x.d/max*100}%"></i></div><b>${x.d+x.s}</b><span>${WEEKDAYS[i]}</span></div>`).join('')}</div>
   <div class="legend"><span><i class="dot" style="--c:var(--accent-color)"></i>Dienste</span><span><i class="dot" style="--c:#7fcfd3"></i>Bereitschaft</span><span><i class="dot" style="--c:#f0c27a"></i>Abwesend</span></div></section>`}}
];
function dashWidgetsForRole(){return DASH_WIDGETS.filter(w=>!w.lead||isLeadDash())}
/* ---------- Freies Raster ----------
   Das Dashboard ist ein Raster mit 12 Spalten (Tablet 6, Handy 2). Jede Ansicht hat eine Spalte (x)
   und eine Reihenfolge von oben nach unten (k). Beim Aufbau „fällt“ jede Ansicht in ihren Spalten so weit
   nach oben, bis sie auf eine andere trifft – dadurch lässt sie sich überall hinschieben, ohne dass Löcher entstehen. */
const DASH_ROW=8,DASH_GAP=16;
let dashEditing=false,dashDraft=null,dashResizeBound=false;
const dashCols=width=>width>=720?12:width>=440?6:2;
function dashW(size,cols){if(size==='full')return cols;if(size==='half')return cols>=12?6:cols;return cols>=12?3:cols>=6?2:1}// Kacheln bleiben immer klein (¼ bzw. ⅓ der Breite)
const dashSize=id=>DASH_WIDGETS.find(w=>w.id===id)?.size||'tile';
const DASH_DEFAULT={
 emp:[['today',0],['kDuties',0],['kStandby',3],['kAbsence',6],['kHours',9],['myDuties',0],['myStandby',6],['kWorkplace',6],['kSwaps',6]],
 lead:[['today',0],['kDuties',0],['kStandby',3],['kAbsence',6],['kIssues',9],['myDuties',0],['myStandby',6],['kWorkplace',6],['kHours',6],['kSwaps',9],['kTeamDuty',9],['kTeamStandby',6],['teamToday',0],['standbyToday',6],['weekLoad',0]]};
function dashHidden(){
 const avail=dashWidgetsForRole(),ids=avail.map(w=>w.id),saved=dashLayouts[dashKey()];
 if(!saved)return avail.filter(w=>w.hidden).map(w=>w.id);
 const known=Array.isArray(saved.known)?saved.known:(Array.isArray(saved.order)?saved.order:[]),hidden=(Array.isArray(saved.hidden)?saved.hidden:[]).filter(id=>ids.includes(id));
 avail.forEach(w=>{if(!known.includes(w.id)&&w.hidden&&!hidden.includes(w.id))hidden.push(w.id)});// neue Ansicht mit Standard „aus“
 return hidden;
}
/* Reihenfolge → Positionen: bei 12 Spalten mit den Standardspalten, sonst von links nach rechts aufgefüllt */
function dashFlow(seq,cols){const out={};let cur=0;seq.forEach(([id,x],k)=>{const w=dashW(dashSize(id),cols);let xx;
 if(cols===12&&x!=null&&x+w<=12)xx=x;else{if(cur+w>cols)cur=0;xx=cur;cur=(cur+w)%cols}out[id]={x:xx,k}});return out}
function dashDefaultPositions(cols){const ids=dashWidgetsForRole().map(w=>w.id),def=DASH_DEFAULT[isLeadDash()?'lead':'emp'].filter(([id])=>ids.includes(id));
 ids.forEach(id=>{if(!def.some(([d])=>d===id))def.push([id,0])});return dashFlow(def,cols)}
function dashPositions(cols){
 const saved=dashLayouts[dashKey()],ids=dashWidgetsForRole().map(w=>w.id);let pos;
 const okPos=o=>{if(!o||typeof o!=='object'||Array.isArray(o))return null;const r={};Object.entries(o).forEach(([id,p])=>{if(ids.includes(id)&&p&&typeof p==='object'&&Number.isFinite(p.x)&&Number.isFinite(p.k))r[id]={x:p.x,k:p.k}});return Object.keys(r).length?r:null};
 const sp=saved&&typeof saved==='object'&&saved.pos&&typeof saved.pos==='object'?saved.pos:{},own=okPos(sp[cols]),big=okPos(sp[12]);
 if(own)pos=own;
 else if(big){const seq=Object.entries(big).filter(([id])=>ids.includes(id)).sort((a,b)=>a[1].k-b[1].k||a[1].x-b[1].x).map(([id])=>[id,null]);pos=dashFlow(seq,cols)}
 else if(Array.isArray(saved?.order))pos=dashFlow([...new Set(saved.order)].filter(id=>ids.includes(id)).map(id=>[id,null]),cols);// ältere Speicherung (nur Reihenfolge)
 else pos=dashDefaultPositions(cols);
 const max=Math.max(0,...Object.values(pos).map(p=>p.k||0));let extra=1;
 const def=DASH_DEFAULT[isLeadDash()?'lead':'emp'];
 ids.forEach(id=>{if(pos[id])return;// neu hinzugekommene Ansicht: hinter ihren Standard-Vorgänger, sonst unten anhängen
  const i=def.findIndex(([d])=>d===id),prev=i>0?def.slice(0,i).reverse().find(([d])=>pos[d]):null;
  if(prev){const dx=def[i][1];pos[id]={x:cols===12?dx:Math.min(cols-dashW(dashSize(id),cols),Math.round(dx*cols/12)),k:pos[prev[0]].k+0.5}}else pos[id]={x:0,k:max+extra++}});
 Object.keys(pos).forEach(id=>{if(!ids.includes(id))delete pos[id]});
 return pos;
}
function saveDashLayout({hidden,cols,pos}){
 const prev=dashLayouts[dashKey()]||{},next={hidden:hidden??dashHidden(),known:dashWidgetsForRole().map(w=>w.id),pos:prev.pos&&typeof prev.pos==='object'&&!Array.isArray(prev.pos)?{...prev.pos}:{}};
 if(pos){if(cols===12)next.pos={};next.pos[cols]=pos}// Änderungen am großen Bildschirm gelten auch für Tablet/Handy
 dashLayouts[dashKey()]=next;save('dienstplanDashLayout',dashLayouts);
}
/* Ansichten in ihre Spalten fallen lassen */
function dashPack(items,cols){
 items.sort((a,b)=>a.k-b.k||a.x-b.x);const placed=[];
 items.forEach(it=>{it.x=Math.max(0,Math.min(cols-it.w,Math.round(it.x)));let y=0;placed.forEach(p=>{if(p.x<it.x+it.w&&it.x<p.x+p.w)y=Math.max(y,p.y+p.h)});it.y=y;placed.push(it)});
 return items;
}
function dashLayoutGrid(root,pos,{animate=false,skip=null}={}){
 const cols=dashCols(root.clientWidth);root.style.setProperty('--cols',cols);root.dataset.cols=cols;
 const els=[...root.querySelectorAll('.dash-w')],gap=parseFloat(getComputedStyle(root).columnGap)||DASH_GAP;
 const before=animate?new Map(els.map(el=>[el,el.getBoundingClientRect()])):null;
 const keepY=window.scrollY;root.style.minHeight=root.offsetHeight+'px';// Seite darf beim Messen nicht kürzer werden
 root.classList.remove('dash-sized');
 els.forEach(el=>{el.style.gridColumn=`span ${dashW(el.dataset.size,cols)}`;el.style.gridRow='auto'});
 const items=els.map(el=>{const p=pos[el.dataset.widget]||{x:0,k:1e6};return {el,id:el.dataset.widget,size:el.dataset.size,w:dashW(el.dataset.size,cols),x:p.x,k:p.k,h:Math.max(1,Math.ceil((el.firstElementChild.offsetHeight+gap)/DASH_ROW))}});
 dashPack(items,cols);
 // Alle kleinen Kacheln gleich groß machen (gleiche Höhe wie die höchste, z. B. „Mein Porsche Cockpit“), dann noch einmal fallen lassen
 const tiles=items.filter(i=>i.size==='tile');if(tiles.length){const h=Math.max(...tiles.map(i=>i.h));tiles.forEach(i=>i.h=h)}
 items.forEach(i=>i.k=i.y+(i.x/100));dashPack(items,cols);
 items.forEach(i=>{i.el.style.gridColumn=`${i.x+1} / span ${i.w}`;i.el.style.gridRow=`${i.y+1} / span ${i.h}`});
 root.classList.add('dash-sized');root.style.minHeight='';if(Math.abs(window.scrollY-keepY)>1)window.scrollTo(window.scrollX,keepY);
 if(before)items.forEach(i=>{if(i.el===skip)return;const a=before.get(i.el),b=i.el.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;if(!dx&&!dy)return;
  i.el.style.transition='none';i.el.style.transform=`translate(${dx}px,${dy}px)`;i.el.getBoundingClientRect();i.el.style.transition='transform .2s ease';i.el.style.transform='';setTimeout(()=>{i.el.style.transition=''},220)});
 return {cols,items};
}
const dashCurrentPos=()=>{const root=document.getElementById('dash');const cols=dashCols(root?.clientWidth||1200);return {cols,pos:dashEditing&&dashDraft&&dashDraft.cols===cols?dashDraft.pos:dashPositions(cols)}};

function dashboard(){
 const c=dashCtx(),hidden=dashHidden(),visible=dashWidgetsForRole().filter(w=>!hidden.includes(w.id));
 const colored=!visible.some(w=>w.id==='today');// ohne „Heute“ erscheinen die kleinen Kacheln in der Akzentfarbe
 const grip=`<span class="dash-handle" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>`;
 const wrap=w=>`<div class="dash-w dash-${w.size}" data-widget="${w.id}" data-size="${w.size}" ${w.action?'data-dash-action tabindex="0" role="button"':''}>${w.render(c)}${grip}</div>`;
 const body=visible.map(wrap).join('');
 const tools=`<button class="btn" id="dash-customize">${icon('sliders')}Dashboard anpassen</button>`;
 const head=c.lead?heading('Guten Tag, '+escapeHtml(c.name.split(' ')[0]||''),'Das passiert heute in '+(c.scope.length===teams.length?'allen '+teams.length+' Teams':'deinen Teams')+'.',dashEditing?'':(manageableTeams('Dienstplan').length?`<button class="btn primary" data-go="Dienstplan">＋ Dienst einteilen</button>`:'')+tools)
  :heading('Hallo '+escapeHtml(c.name.split(' ')[0]||''),'Hier findest du deine persönlichen Dienste und Bereitschaften.',dashEditing?'':tools);
 const bar=dashEditing?`<div class="dash-editbar"><div><b>${icon('edit')}Ansicht bearbeiten</b><small>Kacheln und Bereiche frei an eine andere Stelle ziehen. Am Handy: kurz gedrückt halten oder am Griff ziehen.</small></div><div class="btn-row"><button class="btn ghost" id="dash-edit-reset">${icon('refresh')}Standard wiederherstellen</button><button class="btn" id="dash-edit-cancel">Abbrechen</button><button class="btn primary" id="dash-edit-save">${icon('check')}Speichern</button></div></div>`:'';
 return `${head}${bar}<div class="dash dash-grid ${colored?'dash-colored':''} ${dashEditing?'dash-editing':''}" id="dash">${body||'<div class="empty-note">Alle Ansichten sind ausgeblendet. Über „Dashboard anpassen“ kannst du sie wieder einblenden.</div>'}</div>`;
}

/* Einfacher Info-Dialog (ohne Formular) */
function infoDialog(title,sub,html){
 const layer=document.createElement('div');layer.className='modal-backdrop app-dialog';
 layer.innerHTML=`<div class="modal form-dialog dash-dialog" role="dialog" aria-modal="true"><div class="panel-head"><div><h2>${escapeHtml(title)}</h2>${sub?`<p class="small muted">${sub}</p>`:''}</div><button type="button" class="icon-btn" data-dlg="close" aria-label="Schließen">×</button></div><div class="dash-dialog-body">${html}</div><div class="btn-row modal-actions"><button type="button" class="btn" data-dlg="close">Schließen</button></div></div>`;
 document.body.appendChild(layer);
 const close=()=>{layer.remove();document.removeEventListener('keydown',key,true)};
 const key=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};document.addEventListener('keydown',key,true);
 layer.addEventListener('click',e=>{if(e.target===layer||e.target.closest('[data-dlg="close"]'))close()});
 setTimeout(()=>layer.querySelector('[data-dlg="close"]')?.focus(),20);
 return {layer,close};
}
function absencePopup(c){
 const until=a=>{let d=a.date;for(let i=0;i<60;i++){const n=isoDate(addDays(dashDay(d),1));if(assignments.some(x=>x.isAbsence&&x.employee===a.employee&&x.shift===a.shift&&x.date===n))d=n;else break}return d};
 const persons=new Set(c.absences.map(a=>a.employee)).size;
 const rows=c.absences.map(a=>{const to=until(a),t=teamByName(a.team),full=!a.start;
  return `<div class="dash-abs-row">${avatarHtml(a.employee,teamColor(t),36)}<div class="dash-abs-main"><b>${escapeHtml(a.employee)}</b><small>${escapeHtml(a.team||'')}${a.note?' · '+escapeHtml(a.note):''}</small></div><div class="dash-abs-type"><span class="abs-pill ${ABSENCE_FULLDAY.includes(a.shift)?'':'partial'}">${escapeHtml(a.shift)}</span><small>${full?(to>a.date?'bis '+fmtShortWd(dashDay(to)):'ganztägig'):`${a.start}–${a.end}`}</small></div></div>`}).join('');
 infoDialog('Aktuelle Abwesenheiten',`${fmtWithWeekday(new Date())} · ${persons} ${persons===1?'Person':'Personen'} abwesend`,rows||'<div class="employee-empty">Heute ist niemand abwesend.</div>');
}
function issuesPopup(c){
 const rows=c.issues.map((x,i)=>{const ok=allowedPages().includes(x.page);return `<button type="button" class="dash-issue ${x.level}" data-issue="${i}" ${ok?'':'disabled'}><span class="issue-icon">${icon(x.icon)}</span><span class="dash-issue-main"><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.text)}${ok?'':' · keine Berechtigung'}</small></span>${ok?`<span class="dash-issue-go">${icon('chev')}</span>`:''}</button>`}).join('');
 const crit=c.issues.filter(i=>i.level==='crit').length;
 const {layer,close}=infoDialog('Offene Punkte',c.issues.length?`${c.issues.length} offen · ${crit} kritisch · Antippen führt direkt zur betroffenen Stelle`:'Automatisch erkannte Lücken & Konflikte',rows||'<div class="employee-empty">Alles erledigt – keine offenen Punkte. 🎉</div>');
 layer.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>{const x=c.issues[+b.dataset.issue];close();openIssue(x)});
}

/* Dashboard anpassen: was angezeigt wird */
async function customizeDashboard(){
 const hidden=dashHidden(),list=dashWidgetsForRole(),sizeLabel={tile:'Kachel',half:'Bereich',full:'Banner'};
 const row=w=>`<div class="dash-cfg-row" data-cfg="${w.id}"><label class="check"><input type="checkbox" name="w:${w.id}" ${hidden.includes(w.id)?'':'checked'}><span><b>${escapeHtml(w.title)}</b><small class="muted block">${escapeHtml(w.desc||'')}</small></span></label><span class="pill">${sizeLabel[w.size]}</span></div>`;
 const dlg=formDialog('Dashboard anpassen',`<div class="dash-cfg-list">${list.map(row).join('')}</div>
  <div class="dash-cfg-actions"><button type="button" class="btn" id="dash-cfg-edit">${icon('edit')}Ansicht bearbeiten</button><button type="button" class="btn ghost" id="dash-cfg-reset">${icon('refresh')}Standard wiederherstellen</button></div>
  <p class="small muted">Häkchen = Ansicht wird angezeigt. Über „Ansicht bearbeiten“ verschiebst du Kacheln und Bereiche frei an jede Stelle.</p>`,'Speichern','Wähle aus, was du auf deinem Dashboard siehst.');
 const layer=[...document.querySelectorAll('.app-dialog')].pop();let reset=false,toEdit=false;
 layer.querySelector('#dash-cfg-reset').onclick=()=>{reset=true;list.forEach(w=>{layer.querySelector(`[name="w:${w.id}"]`).checked=!w.hidden});toast('Standard ausgewählt – mit „Speichern“ übernehmen.')};
 layer.querySelector('#dash-cfg-edit').onclick=()=>{toEdit=true;layer.querySelector('form').requestSubmit()};
 const res=await dlg;if(!res)return;
 const newHidden=list.filter(w=>!res['w:'+w.id]).map(w=>w.id);
 if(reset){delete dashLayouts[dashKey()];}
 saveDashLayout({hidden:newHidden});
 if(toEdit){startDashEdit();return}
 toast(reset?'Standard wiederhergestellt.':'Dashboard gespeichert.');render();
}
function startDashEdit(){const root=document.getElementById('dash'),cols=dashCols(root?.clientWidth||1200);dashEditing=true;dashDraft={cols,pos:dashPositions(cols)};render()}
function endDashEdit(saveIt){
 if(saveIt&&dashDraft){saveDashLayout({cols:dashDraft.cols,pos:dashDraft.pos});toast('Ansicht gespeichert.')}
 dashEditing=false;dashDraft=null;render();
}

let dashDrag=null;
function bindDashboard(){
 const root=document.getElementById('dash');if(!root)return;
 const byId=id=>document.getElementById(id);
 if(byId('dash-customize'))byId('dash-customize').onclick=customizeDashboard;
 if(byId('dash-edit'))byId('dash-edit').onclick=startDashEdit;
 if(byId('dash-edit-cancel'))byId('dash-edit-cancel').onclick=()=>endDashEdit(false);
 if(byId('dash-edit-save'))byId('dash-edit-save').onclick=()=>endDashEdit(true);
 if(byId('dash-edit-reset'))byId('dash-edit-reset').onclick=()=>{const cols=dashCols(root.clientWidth);dashDraft={cols,pos:dashDefaultPositions(cols)};dashLayoutGrid(root,dashDraft.pos,{animate:true})};
 const {pos}=dashCurrentPos();dashLayoutGrid(root,pos);
 // Schriften/Bilder können Höhen noch ändern → kurz danach erneut ausrichten
 setTimeout(()=>{if(document.getElementById('dash')===root&&!dashDrag)dashLayoutGrid(root,dashCurrentPos().pos)},120);
 if(!dashResizeBound){dashResizeBound=true;let t=0;window.addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(()=>{const r=document.getElementById('dash');if(!r||dashDrag)return;
  if(dashEditing&&dashDraft&&dashDraft.cols!==dashCols(r.clientWidth)){const cols=dashCols(r.clientWidth);dashDraft={cols,pos:dashPositions(cols)}}
  dashLayoutGrid(r,dashCurrentPos().pos)},120)})}
 const c=dashCtx();
 root.querySelectorAll('[data-dash-action]').forEach(el=>{const w=DASH_WIDGETS.find(x=>x.id===el.dataset.widget);
  const run=()=>{if(dashEditing)return;w.action(c)};
  el.addEventListener('click',e=>{if(e.target.closest('a,button,input,select'))return;run()});
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();run()}})});
 if(!dashEditing)return;
 root.querySelectorAll('.dash-w').forEach(el=>el.addEventListener('pointerdown',e=>{
  if(e.button!==0||dashDrag)return;
  const onHandle=!!e.target.closest('.dash-handle'),sx=e.clientX,sy=e.clientY,mouse=e.pointerType==='mouse';
  if(mouse||onHandle)e.preventDefault();
  let started=false;
  const cleanup=()=>{clearTimeout(timer);el.classList.remove('dash-press');window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',cleanup);window.removeEventListener('pointercancel',cleanup)};
  const go=()=>{if(started)return;started=true;cleanup();dashStartDrag(el,sx,sy)};
  const mv=ev=>{const d=Math.hypot(ev.clientX-sx,ev.clientY-sy);if(mouse||onHandle){if(d>4)go()}else if(d>8)cleanup()};// Touch: bewegen ohne Halten = scrollen
  const timer=(mouse||onHandle)?0:setTimeout(go,320);
  if(!mouse&&!onHandle)el.classList.add('dash-press');
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',cleanup);window.addEventListener('pointercancel',cleanup);
  if(onHandle&&!mouse)go();
 }));
}
function dashStartDrag(el,x,y){
 const root=document.getElementById('dash');if(!root||!dashDraft)return;
 const cols=dashCols(root.clientWidth),rr=root.getBoundingClientRect(),er=el.getBoundingClientRect();
 const gap=parseFloat(getComputedStyle(root).columnGap)||DASH_GAP,colW=(rr.width-gap*(cols-1))/cols,step=colW+gap;
 // aktuelle Lage als Ausgangspunkt (k = tatsächliche Zeile)
 const lay=dashLayoutGrid(root,dashDraft.pos);const base={};lay.items.forEach(i=>{base[i.id]={x:i.x,k:i.y+i.x/100}});
 Object.keys(dashDraft.pos).forEach(id=>{if(!base[id])base[id]=dashDraft.pos[id]});
 const me=lay.items.find(i=>i.el===el),grabCol=Math.max(0,Math.min(me.w-1,Math.floor((x-er.left)/step))),grabDy=y-er.top;
 const ghost=el.cloneNode(true);ghost.className+=' dash-ghost';ghost.removeAttribute('data-widget');Object.assign(ghost.style,{width:er.width+'px',height:(er.height-gap)+'px',left:er.left+'px',top:er.top+'px',gridColumn:'',gridRow:''});
 document.body.appendChild(ghost);el.classList.add('dash-placeholder');document.body.classList.add('dash-drag-active');
 if(navigator.vibrate)try{navigator.vibrate(12)}catch(_){}
 let last='',cur=base;
 dashDrag={el,ghost,y,raf:0};
 const place=(px,py)=>{const r=root.getBoundingClientRect(),col=Math.floor((px-r.left)/step)-grabCol,xx=Math.max(0,Math.min(cols-me.w,col)),k=(py-grabDy-r.top)/DASH_ROW-0.5;
  const key=xx+'|'+Object.entries(base).filter(([id,b])=>id!==me.id&&b.k<k).length;if(key===last)return;last=key;// nur neu ordnen, wenn sich die Lage wirklich ändert
  cur={...base,[me.id]:{x:xx,k}};dashLayoutGrid(root,cur,{animate:true,skip:null})};
 const move=ev=>{const d=dashDrag;if(!d)return;d.y=ev.clientY;ghost.style.left=(ev.clientX-(x-er.left))+'px';ghost.style.top=(ev.clientY-grabDy)+'px';place(ev.clientX,ev.clientY)};
 const scroll=()=>{const d=dashDrag;if(!d)return;const edge=70;if(d.y<edge)window.scrollBy(0,-14);else if(d.y>window.innerHeight-edge)window.scrollBy(0,14);d.raf=requestAnimationFrame(scroll)};
 const stopTouch=ev=>{if(dashDrag)ev.preventDefault()};
 const finish=commit=>{const d=dashDrag;if(!d)return;cancelAnimationFrame(d.raf);
  window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',esc,true);document.removeEventListener('touchmove',stopTouch);
  ghost.remove();el.classList.remove('dash-placeholder');document.body.classList.remove('dash-drag-active');dashDrag=null;
  const res=dashLayoutGrid(root,commit?cur:dashDraft.pos,{animate:true});
  if(commit){const p={};res.items.forEach(i=>{p[i.id]={x:i.x,k:i.y+i.x/100}});Object.keys(dashDraft.pos).forEach(id=>{if(!p[id])p[id]=dashDraft.pos[id]});dashDraft={cols,pos:p}}};
 const up=()=>finish(true),cancel=()=>finish(false),esc=ev=>{if(ev.key==='Escape'){ev.stopPropagation();finish(false)}};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',esc,true);
 document.addEventListener('touchmove',stopTouch,{passive:false});
 dashDrag.raf=requestAnimationFrame(scroll);
}

/* ------------------------------------------------------------------
   Einstellungen
------------------------------------------------------------------ */
let notifyPrefs=load('dienstplanNotifyPrefs',{});
function myNotifyPrefs(id=currentUserId){return Object.assign({own:true,team:true,absence:true},notifyPrefs[id]||{})}
function settings(){
 const seg=(id,opts,cur)=>`<div class="segmented" id="${id}">${opts.map(([v,l])=>`<button type="button" data-v="${v}" class="${String(cur)===String(v)?'active':''}">${l}</button>`).join('')}</div>`;
 const tog=(id,on)=>`<button type="button" class="toggle ${on?'on':''}" id="${id}" role="switch" aria-checked="${on}"></button>`;
 const theme=localStorage.getItem('dienstplanTheme')||'light',acc=localStorage.getItem('dienstplanAccentColor')||'turquoise',fs=localStorage.getItem('dienstplanFontScale')||'normal',compact=localStorage.getItem('dienstplanCompact')==='1';
 const used=Object.keys(localStorage).filter(k=>k.startsWith('dienstplan')).reduce((s,k)=>s+(localStorage.getItem(k)||'').length,0);
 const sections=[['set-cal','cal','Kalender'],['set-look','sun','Darstellung'],['set-lang','grid','Sprache & Datum'],...(currentRole==='Admin'?[['link-admin','external','Links']]:[]),['set-data','download','Daten & Sicherung']];
 const preview=(k,label)=>`<button type="button" class="theme-card ${theme===k?'active':''}" data-theme="${k}"><span class="theme-prev ${k}"><i></i><span><i></i><i></i><i></i></span></span><span class="theme-card-foot"><b>${label}</b>${theme===k?'<em>Aktiv</em>':''}</span></button>`;
 const dfOpts=['dmy','iso','mdy','long'].map(k=>{const keep=dateFormat;dateFormat=k;const ex=fmt(new Date(2026,11,31));dateFormat=keep;const label={dmy:LANG==='en'?'DD.MM.YYYY':'TT.MM.JJJJ',iso:LANG==='en'?'YYYY-MM-DD':'JJJJ-MM-TT',mdy:LANG==='en'?'MM/DD/YYYY':'MM/TT/JJJJ',long:LANG==='en'?'Written out':'Ausgeschrieben'}[k];return `<option value="${k}" ${dateFormat===k?'selected':''}>${label}  ·  ${ex}</option>`}).join('');
 return `${heading('Einstellungen','Arbeitsumgebung, Darstellung und Daten anpassen.')}
 <div class="settings-layout">
  <nav class="panel settings-nav">${sections.map(([id,ic,l],i)=>`<a href="#${id}" class="nav-item ${i===0?'active':''}" data-settings-jump="${id}">${icon(ic)}<em>${l}</em></a>`).join('')}</nav>
  <div class="settings-main">
   <section class="settings-card" id="set-cal"><h2>Kalender</h2><p class="sub">Änderungen werden sofort übernommen.</p>
    <div class="setting-row"><div><b>Standardansicht Dienstplan</b><small>Beim Öffnen anzeigen</small></div>${seg('def-dienstplan',[['Tag','Tag'],['Woche','Woche'],['Monat','Monat'],['Team','Team']],defaults.Dienstplan||'Woche')}</div>
    <div class="setting-row"><div><b>Standardansicht Bereitschaft</b><small>Beim Öffnen anzeigen</small></div>${seg('def-bereitschaft',[['Woche','Woche'],['Monat','Monat'],['Zeitleiste','Zeitleiste']],defaults.Bereitschaft||'Monat')}</div>
    <div class="setting-row"><div><b>Wochenende im Dienstplan</b><small>Welche Tage Woche, Monat und Team-Ansicht zeigen. Bereitschaft zeigt immer Mo–So.</small></div>${seg('duty-days',[[5,'Mo–Fr'],[6,'Mo–Sa'],[7,'Mo–So']],dutyDays)}</div>
    <div class="setting-row"><div><b>Darstellung der Einträge</b><small>Kompakt = Monatsansicht mit „+X weitere“ · Erweitert = Monatsansicht zeigt alle Einträge</small></div>${seg('entry-density',[['compact','Kompakt'],['expanded','Erweitert']],expandedMonthView?'expanded':'compact')}</div>
   </section>
   <section class="settings-card" id="set-look"><h2>Darstellung</h2><p class="sub">Änderungen werden sofort als Vorschau übernommen.</p>
    <div class="theme-cards">${preview('light','Hell')}${preview('dark','Dunkel')}${preview('system','System')}</div>
    <div class="setting-row"><div><b>Akzentfarbe</b><small>Für Buttons, Markierungen und aktive Elemente</small></div><div class="swatch-row" id="accent-color-mode">${Object.entries(ACCENTS).map(([k,c])=>`<button type="button" class="accent-option ${acc===k?'active':''}" data-accent="${k}" style="--sw:${c[0]}" aria-pressed="${acc===k}"><i></i>${ACCENT_LABEL[k]}</button>`).join('')}</div></div>
    <div class="setting-row"><div><b>Schriftgröße</b><small>Bessere Lesbarkeit auf großen Bildschirmen</small></div>${seg('font-scale',[['small','Klein'],['normal','Normal'],['large','Groß']],fs)}</div>
   </section>
   <section class="settings-card" id="set-lang"><h2>Sprache &amp; Datum</h2><p class="sub">Änderungen werden sofort übernommen.</p>
    <div class="setting-row"><div><b>Sprache</b><small>Sprache der gesamten Oberfläche.</small></div><select class="form-select" id="language-select" data-no-translate><option value="de">Deutsch</option><option value="en">English</option></select></div>
    <div class="setting-row"><div><b>Datumsformat</b><small>So werden Datumswerte in der App und in Exporten angezeigt.</small></div><select class="form-select" id="date-format-select" data-no-translate>${dfOpts}</select></div>
    <div class="date-preview"><span>Beispiel:</span> <b>${escapeHtml(fmtWithWeekday(new Date()))}</b></div>
   </section>
   ${currentRole==='Admin'?`<section class="settings-card link-admin" id="link-admin"><div class="panel-head"><div><h2>${icon('external')}Links &amp; Weiterleitungen</h2><p class="sub">Ziele der Link-Kacheln im Dashboard. Nur Admins sehen und ändern diesen Bereich.</p></div></div>
  <div class="link-row"><span class="link-ic">${icon('external')}</span><div class="link-txt"><b>Mein Porsche Cockpit</b><small>Kachel „Ich@Porsche“ · Übersicht: Homeoffice- &amp; Bürotage</small>${cockpitLink.url?`<a href="${escapeHtml(cockpitLink.url)}" target="_blank" rel="noopener noreferrer" class="link-url">${escapeHtml(cockpitLink.url)}</a><small class="muted">Zuletzt geändert von ${escapeHtml(cockpitLink.by||'—')}${cockpitLink.at?' am '+escapeHtml(fmtWithWeekday(new Date(cockpitLink.at))):''}</small>`:'<span class="pill amber">Noch kein Link hinterlegt</span>'}</div>
  <div class="btn-row">${cockpitLink.url?`<button type="button" class="btn small" id="cockpit-link-test">${icon('external')}Öffnen</button>`:''}<button type="button" class="btn small primary" id="cockpit-link-edit">${icon('edit')}${cockpitLink.url?'Ändern':'Link festlegen'}</button></div></div></section>`:''}
   <section class="settings-card" id="set-data"><h2>Daten &amp; Sicherung</h2><p class="sub">Alle Daten liegen lokal in diesem Browser. Sichere sie regelmäßig.</p>
    <div class="info-box">${icon('download')}Letzte Sicherung: <b>${localStorage.getItem('dienstplanLastBackup')?fmtDateTime(+localStorage.getItem('dienstplanLastBackup')):'noch nie'}</b> · Speicher belegt: ${(used/1048576).toLocaleString(LOC(),{maximumFractionDigits:1})} MB von ~5 MB</div>
    ${used>=STORAGE_LIMIT*0.8?`<div class="info-box warn">${icon('alert')}Der Browserspeicher ist zu ${Math.round(used/STORAGE_LIMIT*100)} % belegt. Archiviere alte Einträge, damit neue Einträge weiter gespeichert werden können.</div>`:''}
    <div class="btn-row"><button class="btn primary" id="backup-export">Sicherung herunterladen (.json)</button><label class="btn" for="backup-import">Sicherung einspielen</label><input type="file" id="backup-import" accept="application/json,.json" hidden>${currentRole==='Admin'?'<button class="btn danger push-right" id="reset-demo">Demo-Daten zurücksetzen</button>':''}</div>
    ${currentRole==='Admin'?`<div class="setting-row"><div><b>Alte Einträge archivieren</b><small>Einträge, die älter als 12 Monate sind, werden als CSV-Datei gespeichert und danach aus dem Browser entfernt. Das schafft Platz für neue Einträge.</small></div><button class="btn" id="archive-old">Archivieren …</button></div>`:''}
   </section>
  </div>
 </div>`;
}
/* Sicherung prüfen, bevor irgendetwas gelöscht wird */
function validateBackup(text){
 const fail=reason=>({ok:false,reason});let parsed;
 try{parsed=JSON.parse(text)}catch(_){return fail('Sie enthält kein gültiges JSON.')}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return fail('Unbekanntes Format.');
 if(parsed.app!=null&&parsed.app!=='DienstPlan Pro')return fail('Sie stammt nicht aus DienstPlan Pro.');
 const d=parsed.data;if(!d||typeof d!=='object'||Array.isArray(d))return fail('Der Datenteil fehlt.');
 const entries=[],values={};
 for(const [k,v] of Object.entries(d)){
  if(!k.startsWith('dienstplan'))continue;
  if(typeof v!=='string')return fail('Der Eintrag „'+k+'“ ist beschädigt.');
  try{values[k]=JSON.parse(v)}catch(_){values[k]=v}// einfache Einstellungen werden als Text gespeichert
  entries.push([k,v]);
 }
 for(const k of ['dienstplanStaff','dienstplanTeams','dienstplanAssignments']){if(!Array.isArray(values[k]))return fail(k in values?'Der Eintrag „'+k+'“ ist beschädigt.':'Mitarbeitende, Teams oder Einträge fehlen.')}
 if(!values.dienstplanStaff.length||!values.dienstplanTeams.length)return fail('Sie enthält keine Mitarbeitenden oder Teams.');
 if(!values.dienstplanStaff.every(x=>Array.isArray(x)&&typeof x[0]==='string'))return fail('Die Mitarbeiterliste ist beschädigt.');
 if(!values.dienstplanTeams.every(x=>x&&typeof x==='object'&&x.id!=null&&typeof x.name==='string'))return fail('Die Teamliste ist beschädigt.');
 if(!values.dienstplanAssignments.every(x=>x&&typeof x==='object'))return fail('Die Einträge sind beschädigt.');
 let date='';const t=Date.parse(parsed.exportedAt||'');if(!isNaN(t))date=fmt(new Date(t));
 return {ok:true,entries,info:{date,staff:values.dienstplanStaff.length,teams:values.dienstplanTeams.length,entries:values.dienstplanAssignments.length}};
}
function bindSettings(){
 const cle=document.getElementById('cockpit-link-edit');if(cle)cle.onclick=editCockpitLink;
 const clt=document.getElementById('cockpit-link-test');if(clt)clt.onclick=openCockpitLink;
 const segBind=(id,fn)=>{const el=document.getElementById(id);if(!el)return;el.querySelectorAll('button').forEach(b=>b.onclick=()=>{el.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));fn(b.dataset.v)})};
 const togBind=(id,fn)=>{const el=document.getElementById(id);if(!el)return;el.onclick=()=>{const on=!el.classList.contains('on');el.classList.toggle('on',on);el.setAttribute('aria-checked',on);fn(on)}};
 const saved=()=>toast('Einstellungen gespeichert.');
 segBind('def-dienstplan',v=>{defaults.Dienstplan=v;save('dienstplanDefaults',defaults);saved()});
 segBind('def-bereitschaft',v=>{defaults.Bereitschaft=v;save('dienstplanDefaults',defaults);saved()});
 segBind('duty-days',v=>{dutyDays=Number(v)||6;localStorage.setItem('dienstplanDutyDays',String(dutyDays));saved()});
 segBind('entry-density',v=>{expandedMonthView=v==='expanded';localStorage.setItem('dienstplanExpandedMonthView',expandedMonthView?'1':'0');saved()});
 content.querySelectorAll('.theme-card').forEach(b=>b.onclick=()=>{applyTheme(b.dataset.theme);render()});
 content.querySelectorAll('[data-accent]').forEach(b=>b.onclick=()=>{applyAccentColor(b.dataset.accent);render()});
 segBind('font-scale',v=>{applyFontScale(v);saved()});
 const langSel=document.getElementById('language-select');langSel.value=LANG;langSel.onchange=()=>{localStorage.setItem('dienstplanLang',langSel.value);try{sessionStorage.setItem('dienstplanPage','Einstellungen');sessionStorage.setItem('dienstplanAfterReload','set-lang')}catch(e){}toast(langSel.value==='en'?'Switching language …':'Sprache wird gewechselt …');setTimeout(()=>location.reload(),350)};
 const dfSel=document.getElementById('date-format-select');dfSel.onchange=()=>{dateFormat=dfSel.value;localStorage.setItem('dienstplanDateFormat',dateFormat);updateTopDate();render();toast(LANG==='en'?'Date format saved.':'Datumsformat gespeichert.')};
 content.querySelectorAll('[data-settings-jump]').forEach(a=>a.onclick=e=>{e.preventDefault();content.querySelectorAll('[data-settings-jump]').forEach(x=>x.classList.toggle('active',x===a));document.getElementById(a.dataset.settingsJump)?.scrollIntoView({behavior:'smooth',block:'start'})});
 document.getElementById('backup-export').onclick=()=>{
  const data={app:'DienstPlan Pro',version:DEMO_DATA_VERSION,exportedAt:new Date().toISOString(),data:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('dienstplan')).map(k=>[k,localStorage.getItem(k)]))};
  const text=JSON.stringify(data,null,1);
  saveFile(`dienstplan-sicherung-${isoDate(new Date())}.json`,text,'application/json');
  localStorage.setItem('dienstplanLastBackup',String(Date.now()));logExport('Datensicherung','JSON',Object.keys(data.data).length,'Erfolgreich',{size:text.length});toast('Sicherung heruntergeladen.');render();
 };
 document.getElementById('backup-import').onchange=e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=async()=>{e.target.value='';
   const check=validateBackup(String(reader.result||''));
   if(!check.ok){toast('Die Datei ist keine gültige DienstPlan-Sicherung. '+check.reason+' Deine Daten wurden nicht verändert.');return}
   const info=check.info;
   if(!await ask(`Sicherung einspielen?${info.date?' Stand: '+info.date+'.':''} Enthalten: ${info.staff} Mitarbeitende, ${info.teams} Teams, ${info.entries} Einträge. Die aktuellen Daten in diesem Browser werden ersetzt.`,'Einspielen'))return;
   // Aktuellen Stand merken, damit bei einem Fehler nichts verloren geht
   const before=Object.keys(localStorage).filter(k=>k.startsWith('dienstplan')).map(k=>[k,localStorage.getItem(k)]);
   try{before.forEach(([k])=>localStorage.removeItem(k));check.entries.forEach(([k,v])=>localStorage.setItem(k,v));location.reload();}
   catch(err){Object.keys(localStorage).filter(k=>k.startsWith('dienstplan')).forEach(k=>localStorage.removeItem(k));before.forEach(([k,v])=>{try{localStorage.setItem(k,v)}catch(_){}});
    toast(isQuotaError(err)?'Die Sicherung ist zu groß für den Speicher dieses Browsers. Deine bisherigen Daten wurden wiederhergestellt.':'Die Sicherung konnte nicht eingespielt werden. Deine bisherigen Daten wurden wiederhergestellt.')}
  };
  reader.readAsText(file);
 };
 const archive=document.getElementById('archive-old');if(archive)archive.onclick=async()=>{
  const cut=new Date();cut.setFullYear(cut.getFullYear()-1);const cutIso=isoDate(cut);
  const old=assignments.filter(a=>a.date&&a.date<cutIso);
  if(!old.length){toast('Keine Einträge älter als 12 Monate.');return}
  if(!await ask(`${old.length} Einträge vor dem ${fmt(cut)} werden als CSV-Datei gespeichert und danach aus diesem Browser entfernt. Fortfahren?`,'Archivieren'))return;
  const sorted=[...old].sort((a,b)=>a.date.localeCompare(b.date));
  const ok=await downloadCsv([ENTRY_HEAD,...sorted.map(entryRow)],`dienstplan-archiv-bis-${cutIso}.csv`);
  if(ok===false){toast('Archivierung abgebrochen.');return}
  logExport('Archiv','CSV',old.length,'Erfolgreich',{range:'bis '+fmt(cut)});
  const keep=new Set(old.map(a=>a.id));assignments=assignments.filter(a=>!keep.has(a.id));undoStack=[];
  persistAssignments();audit('Gelöscht','Dienstplan',`${old.length} Einträge vor dem ${fmt(cut)} archiviert`,{title:'Alte Einträge archiviert'});
  toast(`${old.length} Einträge archiviert.`);render()};
 const reset=document.getElementById('reset-demo');if(reset)reset.onclick=async()=>{if(!await ask('Alle Daten in diesem Browser löschen und die Demo-Daten neu erzeugen?'))return;Object.keys(localStorage).filter(k=>k.startsWith('dienstplan')&&!['dienstplanTheme','dienstplanAccentColor','dienstplanLang','dienstplanDateFormat','dienstplanFontScale','dienstplanCompact'].includes(k)).forEach(k=>localStorage.removeItem(k));location.reload();};
}

/* ------------------------------------------------------------------
   Dienstzeiten
------------------------------------------------------------------ */
let shiftTeamChip='Alle',editingShiftId=null;
const SHIFT_SWATCHES=['#3974c6','#24966b','#e09a2d','#9b69c8','#dc6475','#159da8','#596579','#d95f20','#7b8f32','#263d75','#e2b5ca','#20242d'];
function shiftTimes(){
 const editable=manageableTeams('Dienstzeiten');
 const visibleTeams=editable.length?editable:teams.filter(t=>currentRole==='Admin'||currentUserTeamNames().includes(t.name));
 if(!visibleTeams.length)return `${heading('Dienstzeiten','Für dich sind keine Teams zur Bearbeitung zugeordnet.')}<section class="settings-card"><p>Bitte wende dich an die Administration.</p></section>`;
 if(shiftTeamChip!=='Alle'&&!visibleTeams.some(t=>t.name===shiftTeamChip))shiftTeamChip='Alle';
 const canEditAny=editable.length>0;
 return `${heading('Dienstzeiten','Schichtmodelle pro Team – stehen beim Einteilen als Auswahl zur Verfügung.',canEditAny?`<button class="btn primary" id="new-shift">${icon('plus')}Dienstzeit erstellen</button>`:'')}
 <div class="split-layout ${canEditAny?'':'no-side'}">
  <section class="panel flush">
   <div class="panel-toolbar"><label class="search-field">${icon('search')}<input id="shift-search" type="search" placeholder="Dienstzeit suchen …"></label><div class="chip-row" id="shift-team-chips"><button type="button" class="chip ${shiftTeamChip==='Alle'?'active':''}" data-shift-team="Alle">Alle Teams</button>${visibleTeams.map(t=>`<button type="button" class="chip ${shiftTeamChip===t.name?'active':''}" data-shift-team="${escapeHtml(t.name)}">${escapeHtml(t.name.replace(/^Team\s+/,''))}</button>`).join('')}</div><span class="muted small push-right" id="shift-count"></span></div>
   <div class="table-wrap borderless shift-times-table-wrap"><table><thead><tr><th>Bezeichnung</th><th>Zeit</th><th>Dauer</th><th class="hide-sm scale-head"><span>00</span><span>12</span><span>24</span></th><th class="hide-sm">Genutzt</th><th>Aktionen</th></tr></thead><tbody id="shift-rows"></tbody></table></div>
  </section>
  ${canEditAny?`<aside class="panel side-editor" id="shift-editor">
   <div class="panel-head"><h2 id="shift-modal-title">Neue Dienstzeit</h2><button type="button" class="icon-btn" id="close-shift" aria-label="Zurücksetzen" title="Zurücksetzen">×</button></div>
   <form id="shift-form" class="stack-form"><input type="hidden" id="shift-id">
    <label>Team<select id="shift-team" required>${editable.map(t=>`<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('')}</select></label>
    <label>Bezeichnung<input id="shift-name" placeholder="z. B. 1A Dienst" required maxlength="60"></label>
    <div class="form-two"><label>Beginn<input type="time" class="big-time" id="shift-start" value="06:00" required></label><label>Ende<input type="time" class="big-time" id="shift-end" value="14:12" required></label></div>
    <div class="form-two"><label>Pause<select id="shift-pause">${[0,15,20,30,45,60].map(m=>`<option value="${m}">${m} Min.</option>`).join('')}</select></label><label>Netto<output id="shift-duration" class="net-box"></output></label></div>
    <label class="check shift-multi"><input type="checkbox" id="shift-multi" checked><span>Mehrfach am Tag besetzbar<small class="muted block">Aus: Dieser Dienst wird pro Tag und Team nur einer Person zugeteilt. Bei „Rotation automatisch planen“ wird jeder Dienst mindestens einmal besetzt.</small></span></label>
    <div class="shift-color-field"><label for="shift-color">Farbe</label><div class="shift-color-presets">${SHIFT_SWATCHES.map(c=>`<button type="button" class="color-swatch" data-color="${c}" style="--swatch:${c}" aria-label="Farbe ${c}" title="${c}"></button>`).join('')}<label class="color-swatch custom" title="Eigene Farbe wählen"><input type="color" id="shift-color" value="#3974c6" aria-label="Eigene Farbe wählen"></label></div></div>
    <div class="field-label">Vorschau</div><div class="shift-color-preview" id="shift-color-preview"><b id="shift-preview-name">${escapeHtml(currentUserName())}</b><span id="shift-preview-line">Dienst · 06:00–14:12</span></div>
    <div class="btn-row end"><button type="button" class="btn" id="cancel-shift">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>
   </form>
  </aside>`:''}
 </div>
 <div id="shift-modal" hidden></div>`;
}
function renderShiftRows(){
 const body=document.getElementById('shift-rows');if(!body)return;
 const editable=manageableTeams('Dienstzeiten'),visibleTeams=editable.length?editable:teams.filter(t=>currentRole==='Admin'||currentUserTeamNames().includes(t.name));
 const q=(document.getElementById('shift-search').value||'').toLowerCase();
 const rows=shiftTypes.filter(x=>visibleTeams.some(t=>t.name===x.team)&&(shiftTeamChip==='Alle'||x.team===shiftTeamChip)&&(!q||x.name.toLowerCase().includes(q)||x.team.toLowerCase().includes(q))).sort((a,b)=>a.team.localeCompare(b.team)||a.start.localeCompare(b.start));
 document.getElementById('shift-count').textContent=rows.length+' Modelle';
 const usage={};assignments.forEach(a=>{if(a.kind==='Dienstplan'&&!a.isAbsence){const k=a.team+'|'+a.shift;usage[k]=(usage[k]||0)+1}});
 let last='',html='';
 rows.forEach(x=>{
  if(x.team!==last){last=x.team;const t=teamByName(x.team);html+=`<tr class="group-row"><td colspan="6"><i class="dot" style="--c:${teamColor(t)}"></i> <b>${escapeHtml(x.team)}</b> <span class="muted">· ${rows.filter(r=>r.team===x.team).length} Modelle</span></td></tr>`}
  const canE=editable.some(t=>t.name===x.team),h=durationHours(x.start,x.end),pause=+x.pause||0,net=Math.max(0,h*60-pause),color=shiftHexColor(x.color),s=durationHoursStart(x.start),e=durationHoursStart(x.end),segs=e>s?[[s,e]]:[[s,24],[0,e]];
  html+=`<tr class="${editingShiftId===x.id?'is-editing':''}"><td><span class="shift-color-tag" style="--shift-color:${color}"><i></i>${escapeHtml(x.name)}</span>${shiftMulti(x)?'':' <span class="pill" title="Nur einmal pro Tag und Team">1× pro Tag</span>'}</td><td>${x.start} – ${x.end}${e<=s?' <span class="pill">über Mitternacht</span>':''}</td><td>${Math.floor(net/60)} Std. ${Math.round(net%60)} Min.${pause?`<small class="muted block">inkl. ${pause} Min. Pause abgezogen</small>`:''}</td><td class="hide-sm"><div class="mini-scale">${segs.map(([a,b])=>`<i style="left:${a/24*100}%;width:${(b-a)/24*100}%;background:${color}"></i>`).join('')}</div></td><td class="hide-sm muted">${usage[x.team+'|'+x.name]||0}×</td><td class="nowrap row-actions">${canE?`<button class="icon-btn" data-edit-shift="${x.id}" title="Bearbeiten" aria-label="Bearbeiten">${icon('edit')}</button><button class="icon-btn" data-copy-shift="${x.id}" title="Duplizieren" aria-label="Duplizieren">${icon('copy')}</button><button class="icon-btn danger" data-delete-shift="${x.id}" title="Löschen" aria-label="Löschen">${icon('trash')}</button>`:'<span class="muted">—</span>'}</td></tr>`;
 });
 body.innerHTML=html||'<tr><td colspan="6" class="empty-note">Für diese Auswahl sind noch keine Dienstzeiten angelegt.</td></tr>';
 body.querySelectorAll('[data-edit-shift]').forEach(b=>b.onclick=()=>openShift(+b.dataset.editShift,true));
 body.querySelectorAll('[data-copy-shift]').forEach(b=>b.onclick=()=>{const x=shiftTypes.find(s=>s.id===+b.dataset.copyShift);if(!x)return;const copy={...x,id:Date.now(),name:x.name+' (Kopie)'};shiftTypes.push(copy);save('dienstplanShiftTypes',shiftTypes);audit('Erstellt','Dienstzeiten',`${copy.team} · ${copy.name}`,{title:'Dienstzeit dupliziert',object:copy.team,after:`${copy.name} ${copy.start}–${copy.end}`});renderShiftRows();openShift(copy.id);toast('Dienstzeit dupliziert.')});
 body.querySelectorAll('[data-delete-shift]').forEach(b=>b.onclick=async()=>{const id=+b.dataset.deleteShift;const target=shiftTypes.find(x=>x.id===id);if(!target||!manageableTeams('Dienstzeiten').some(t=>t.name===target.team)){toast('Du darfst diese Dienstzeit nicht löschen.');return}if(await ask(`Dienstzeit „${target.name}“ wirklich löschen?`)){shiftTypes=shiftTypes.filter(x=>x.id!==id);save('dienstplanShiftTypes',shiftTypes);audit('Gelöscht','Dienstzeiten',`${target.team} · ${target.name} (${target.start}–${target.end})`,{title:'Dienstzeit gelöscht',object:target.team,before:`${target.name} ${target.start}–${target.end}`});if(editingShiftId===id)openShift();renderShiftRows();toast('Dienstzeit gelöscht.')}});
}
function openShift(id,user=false){
 const form=document.getElementById('shift-form');if(!form)return;
 const x=shiftTypes.find(s=>s.id===id);if(x&&!manageableTeams('Dienstzeiten').some(t=>t.name===x.team)){toast('Du darfst diese Dienstzeit nicht bearbeiten.');return}
 editingShiftId=x?x.id:null;
 document.getElementById('shift-modal-title').textContent=x?`${x.name} bearbeiten`:'Neue Dienstzeit';
 document.getElementById('shift-id').value=x?x.id:'';
 document.getElementById('shift-team').value=x?x.team:(shiftTeamChip!=='Alle'&&manageableTeams('Dienstzeiten').some(t=>t.name===shiftTeamChip)?shiftTeamChip:(manageableTeams('Dienstzeiten')[0]?.name||''));
 document.getElementById('shift-name').value=x?x.name:'';
 document.getElementById('shift-start').value=x?x.start:'06:00';
 document.getElementById('shift-end').value=x?x.end:'14:12';
 document.getElementById('shift-pause').value=String(x?(+x.pause||0):30);
 const mc=document.getElementById('shift-multi');if(mc)mc.checked=x?shiftMulti(x):true;
 document.getElementById('shift-color').value=x?shiftHexColor(x.color):'#3974c6';updateShiftColorPreview();renderShiftRows();
 if(!user)return;
 if(window.matchMedia('(max-width: 1100px)').matches)document.getElementById('shift-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
 if(!x&&!window.matchMedia('(max-width: 700px), (pointer: coarse)').matches)document.getElementById('shift-name').focus();
}
function updateShiftColorPreview(){
 const input=document.getElementById('shift-color'),preview=document.getElementById('shift-color-preview');if(!input||!preview)return;
 const c=shiftHexColor(input.value);preview.style.setProperty('--shift-color',c);
 document.querySelectorAll('#shift-editor .color-swatch[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color.toLowerCase()===c.toLowerCase()));
 const st=document.getElementById('shift-start').value,en=document.getElementById('shift-end').value,pause=+document.getElementById('shift-pause').value||0;
 document.getElementById('shift-preview-line').textContent=`${document.getElementById('shift-name').value||'Dienst'} · ${st}–${en}`;
 const m=Math.max(0,Math.round(durationHours(st,en)*60)-pause),s=durationHoursStart(st),e=durationHoursStart(en);
 document.getElementById('shift-duration').textContent=`${Math.floor(m/60)} Std. ${m%60} Min.${e<=s?' · endet am Folgetag':''}`;
}
function bindShiftTimes(){
 renderShiftRows();
 document.getElementById('shift-search').oninput=renderShiftRows;
 content.querySelectorAll('[data-shift-team]').forEach(b=>b.onclick=()=>{shiftTeamChip=b.dataset.shiftTeam;content.querySelectorAll('[data-shift-team]').forEach(x=>x.classList.toggle('active',x===b));renderShiftRows()});
 const nb=document.getElementById('new-shift');if(nb)nb.onclick=()=>openShift(undefined,true);
 const form=document.getElementById('shift-form');if(!form)return;
 ['shift-color','shift-name','shift-start','shift-end','shift-pause'].forEach(id=>document.getElementById(id).addEventListener('input',updateShiftColorPreview));
 document.getElementById('shift-pause').addEventListener('change',updateShiftColorPreview);
 const colorInput=document.getElementById('shift-color');
 document.querySelectorAll('#shift-editor .color-swatch[data-color]').forEach(b=>b.onclick=()=>{colorInput.value=b.dataset.color;updateShiftColorPreview()});
 document.getElementById('close-shift').onclick=document.getElementById('cancel-shift').onclick=()=>openShift();
 openShift(editingShiftId&&shiftTypes.some(s=>s.id===editingShiftId)?editingShiftId:undefined);
 form.onsubmit=e=>{e.preventDefault();const id=+document.getElementById('shift-id').value;const chosenTeam=document.getElementById('shift-team').value;if(!manageableTeams('Dienstzeiten').some(t=>t.name===chosenTeam)){toast('Du darfst nur Dienstzeiten deiner zugeordneten Teams bearbeiten.');return}
  const item={id:id||Date.now(),team:chosenTeam,name:document.getElementById('shift-name').value.trim(),start:document.getElementById('shift-start').value,end:document.getElementById('shift-end').value,pause:+document.getElementById('shift-pause').value||0,multi:document.getElementById('shift-multi')?.checked!==false,color:shiftHexColor(document.getElementById('shift-color').value)};
  if(!item.name)return;if(item.start===item.end){toast('Beginn und Ende dürfen nicht gleich sein.');return}
  if(shiftTypes.some(x=>x.id!==item.id&&x.team===item.team&&x.name.toLowerCase()===item.name.toLowerCase())){toast('Diese Bezeichnung gibt es in diesem Team bereits.');return}
  const old=shiftTypes.find(x=>x.id===id);
  if(id)shiftTypes=shiftTypes.map(x=>x.id===id?item:x);else shiftTypes.push(item);save('dienstplanShiftTypes',shiftTypes);
  if(old&&old.name!==item.name){assignments.forEach(a=>{if(a.kind==='Dienstplan'&&a.team===old.team&&a.shift===old.name)a.shift=item.name});persistAssignments()}
  audit(id?'Geändert':'Erstellt','Dienstzeiten',`${item.team} · ${item.name} (${item.start}–${item.end})`,{title:id?'Dienstzeit geändert':'Dienstzeit erstellt',object:item.team,before:old?`${old.name} ${old.start}–${old.end}${shiftMulti(old)?'':' · 1× pro Tag'}`:'',after:`${item.name} ${item.start}–${item.end}${item.multi?'':' · 1× pro Tag'}`});
  editingShiftId=item.id;renderShiftRows();openShift(item.id);toast('Dienstzeit gespeichert.')};
}

/* ------------------------------------------------------------------
   Kontakte
------------------------------------------------------------------ */
let contactRoleFilter='Alle';
function contactsPage(){
 const counts=roles.map(r=>[r,staff.filter(s=>(s[10]||'Mitarbeiter')===r).length]).filter(x=>x[1]);
 return `${heading('Mitarbeiter &amp; Kontakte',`${staff.length} Personen in ${teams.length} Teams`,`<button class="btn" id="export-contacts">CSV exportieren</button>${canEdit('Kontakte')?'<button class="btn primary" id="new-employee">＋ Mitarbeiter hinzufügen</button>':''}`)}
 <section class="panel"><div class="table-toolbar"><input class="input" id="employee-search" type="search" placeholder="Name, Team, Telefon oder E-Mail …"><div class="chip-row">${[['Alle',staff.length],...counts].map(([r,c])=>`<button type="button" class="chip ${contactRoleFilter===r?'active':''}" data-role-filter="${escapeHtml(r)}">${escapeHtml(r)} · ${c}</button>`).join('')}</div></div>
 <div class="table-wrap employee-directory-table-wrap"><table><thead><tr><th>Mitarbeiter</th><th>Rolle</th><th>Teams</th><th>Telefon</th><th>E-Mail</th><th>Aktion</th></tr></thead><tbody id="employee-rows"></tbody></table></div></section>
 <div class="modal-backdrop" id="employee-modal" hidden><div class="modal"><div class="panel-head"><h2 id="employee-modal-title">Mitarbeiter hinzufügen</h2><button class="icon-btn" id="close-employee" type="button" aria-label="Schließen">×</button></div><form id="employee-form"><input type="hidden" id="employee-index"><label>Vor- und Nachname<input id="employee-name" required placeholder="Max Mustermann"></label><label>Benutzerrolle<select id="employee-role" required>${roles.map(r=>`<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('')}</select></label><div class="photo-row"><div class="employee-photo-preview" id="employee-photo-preview"><span>Foto</span></div><label class="btn" for="employee-photo">Profilbild wählen</label><input id="employee-photo" type="file" accept="image/*" hidden></div><fieldset class="team-checks"><legend>Teams zuordnen</legend><div id="employee-team" class="check-grid"></div></fieldset><label>E-Mail<input type="email" id="employee-email" placeholder="name@example.at"></label><label>Telefon<input id="employee-phone" placeholder="+43 660 …"></label><div class="btn-row modal-actions"><button type="button" class="btn" id="cancel-employee">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form></div></div>`;
}
function renderEmployees(){
 const body=document.getElementById('employee-rows');if(!body)return;
 const q=(document.getElementById('employee-search').value||'').toLowerCase();
 const rows=staff.map((s,i)=>({s,i,teamsText:teams.filter(t=>t.memberIds.includes(s[8])).map(t=>t.name).join(', ')||s[5]||''})).filter(x=>(contactRoleFilter==='Alle'||(x.s[10]||'Mitarbeiter')===contactRoleFilter)&&[x.s[0],x.teamsText,x.s[6],x.s[7]].join(' ').toLowerCase().includes(q));
 body.innerHTML=rows.map(({s,i,teamsText})=>{const color=teamColor(teams.find(t=>t.memberIds.includes(s[8])));return `<tr><td><div class="person">${avatarHtml(s[0],color,36)}<b>${escapeHtml(s[0])}</b></div></td><td><span class="role-pill">${escapeHtml(s[10]||'Mitarbeiter')}</span></td><td>${escapeHtml(teamsText||'—')}</td><td>${s[7]?`<a class="contact-link" href="tel:${escapeHtml(s[7].replace(/\s+/g,''))}">${escapeHtml(s[7])}</a>`:'—'}</td><td>${s[6]?`<a class="contact-link" href="mailto:${escapeHtml(s[6])}">${escapeHtml(s[6])}</a>`:'—'}</td><td class="nowrap">${canEdit('Kontakte')?`<button class="btn small" data-edit-employee="${i}">Bearbeiten</button> <button class="btn small danger" data-remove-employee="${i}">Löschen</button>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="6" class="empty-note">Keine Mitarbeiter gefunden.</td></tr>';
 body.querySelectorAll('[data-edit-employee]').forEach(b=>b.onclick=()=>openEmployee(+b.dataset.editEmployee));
 body.querySelectorAll('[data-remove-employee]').forEach(b=>b.onclick=async()=>{const i=+b.dataset.removeEmployee;const removed=staff[i];if(!removed)return;if(removed[8]===currentUserId){toast('Du kannst dich nicht selbst löschen.');return}if(await ask(`Mitarbeiter „${removed[0]}“ wirklich löschen?`)){staff.splice(i,1);teams.forEach(t=>{t.memberIds=t.memberIds.filter(id=>id!==removed[8]);if(t.leaderId===removed[8])t.leaderId='';if(t.deputyId===removed[8])t.deputyId='';});persistStaff();persistTeams();audit('Gelöscht','Kontakte',removed[0]);renderEmployees();toast('Mitarbeiter gelöscht.')}});
}
let employeePhotoData='';
function openEmployee(i){
 const s=Number.isInteger(i)?staff[i]:null;
 document.getElementById('employee-modal-title').textContent=s?'Mitarbeiter bearbeiten':'Mitarbeiter hinzufügen';
 document.getElementById('employee-index').value=s?i:'';
 document.getElementById('employee-name').value=s?s[0]:'';
 document.getElementById('employee-role').value=s?(s[10]||'Mitarbeiter'):'Mitarbeiter';
 const memberships=s?teams.filter(t=>t.memberIds.includes(s[8])).map(t=>t.name):[];
 document.getElementById('employee-team').innerHTML=teamNames().map(t=>`<label class="check"><input type="checkbox" value="${escapeHtml(t)}" ${memberships.includes(t)?'checked':''}><span>${escapeHtml(t)}</span></label>`).join('');
 document.getElementById('employee-email').value=s?(s[6]||''):'';
 document.getElementById('employee-phone').value=s?(s[7]||''):'';
 employeePhotoData=s?(s[9]||''):'';document.getElementById('employee-photo-preview').innerHTML=employeePhotoData?`<img src="${escapeHtml(employeePhotoData)}" alt="Profilbild-Vorschau">`:'<span>Foto</span>';document.getElementById('employee-photo').value='';
 document.getElementById('employee-modal').hidden=false;
}
function bindContacts(){
 const search=document.getElementById('employee-search');if(!search)return;
 renderEmployees();search.oninput=renderEmployees;
 content.querySelectorAll('[data-role-filter]').forEach(b=>b.onclick=()=>{contactRoleFilter=b.dataset.roleFilter;content.querySelectorAll('[data-role-filter]').forEach(x=>x.classList.toggle('active',x===b));renderEmployees()});
 document.getElementById('export-contacts').onclick=()=>{const rows=[['Name','Rolle','Teams','Telefon','E-Mail'],...staff.map(s=>[s[0],s[10]||'Mitarbeiter',teams.filter(t=>t.memberIds.includes(s[8])).map(t=>t.name).join(', '),s[7],s[6]])];downloadCsv(rows,'kontakte.csv');logExport('Kontakte','CSV',staff.length,'Erfolgreich');toast('Kontakte exportiert.')};
 if(!canEdit('Kontakte'))return;
 const add=document.getElementById('new-employee'),form=document.getElementById('employee-form'),modal=document.getElementById('employee-modal');
 const photoInput=document.getElementById('employee-photo');photoInput.onchange=()=>{const file=photoInput.files&&photoInput.files[0];if(!file)return;if(!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)){toast('Bitte ein Bild im Format JPG, PNG, GIF oder WebP auswählen.');photoInput.value='';return}const reader=new FileReader();reader.onload=()=>{employeePhotoData=safePhoto(String(reader.result||''));document.getElementById('employee-photo-preview').innerHTML=`<img src="${escapeHtml(employeePhotoData)}" alt="Profilbild-Vorschau">`};reader.readAsDataURL(file)};
 add.onclick=()=>openEmployee();
 const closeModal=()=>{modal.hidden=true;form.reset();employeePhotoData='';document.getElementById('employee-index').value=''};
 document.getElementById('close-employee').onclick=closeModal;document.getElementById('cancel-employee').onclick=closeModal;
 form.onsubmit=e=>{
  e.preventDefault();
  const name=document.getElementById('employee-name').value.trim(),index=document.getElementById('employee-index').value;
  if(!name){toast('Bitte einen Mitarbeiternamen eingeben.');return}
  if(staff.some((s,i)=>s[0].toLowerCase()===name.toLowerCase()&&String(i)!==index)){toast('Ein Mitarbeiter mit diesem Namen existiert bereits.');return}
  const selectedTeams=[...document.querySelectorAll('#employee-team input:checked')].map(o=>o.value);
  const old=index!==''?staff[Number(index)]:null;
  const item=[name,initials(name),old?.[2]||'Noch nicht eingeteilt',old?.[3]||'—',old?.[4]||'blue',selectedTeams[0]||'',document.getElementById('employee-email').value.trim(),document.getElementById('employee-phone').value.trim(),old?.[8]||makeId(),employeePhotoData,document.getElementById('employee-role').value];
  if(old&&old[0]!==name){assignments.forEach(a=>{if(a.employee===old[0])a.employee=name});persistAssignments();}
  if(old)staff[Number(index)]=item;else staff.push(item);
  teams.forEach(t=>{t.memberIds=t.memberIds.filter(id=>id!==item[8]);if(selectedTeams.includes(t.name))t.memberIds.push(item[8]);if(!t.memberIds.includes(t.leaderId))t.leaderId='';if(!t.memberIds.includes(t.deputyId))t.deputyId='';});
  try{persistStaff();persistTeams();}catch(err){console.error(err);handleStorageFull();return}
  audit(old?'Geändert':'Erstellt','Kontakte',`${name} · ${item[10]}${selectedTeams.length?' · '+selectedTeams.join(', '):''}`);
  modal.hidden=true;
  if(item[8]===currentUserId){currentRole=item[10];save('dienstplanDemoSession',{userId:currentUserId,role:currentRole});updateSignedInUser();applyRoleNavigation();}
  renderEmployees();toast('Mitarbeiter gespeichert.');
 };
}

/* ------------------------------------------------------------------
   Abwesenheit, Dienst einteilen, Arbeitsort
------------------------------------------------------------------ */
function bindAbsenceModal(){
 const modal=document.getElementById('absence-modal'),form=document.getElementById('absence-form');if(!modal||!form)return;
 const employee=document.getElementById('absence-employee'),type=document.getElementById('absence-type'),timeFields=document.getElementById('absence-time-fields');
 const dateFrom=document.getElementById('absence-date-from'),dateTo=document.getElementById('absence-date-to');
 const allowedTeams=absenceTeams();
 const eligibleStaff=staff.filter(s=>['Abteilungsleiter','Admin'].includes(currentRole)||allowedTeams.some(t=>(Array.isArray(t.memberIds)&&t.memberIds.includes(s[8]))||t.name===(s[5]||'')));
 employee.innerHTML='<option value="">Bitte Mitarbeiter wählen</option>'+eligibleStaff.map(s=>`<option value="${escapeHtml(s[0])}">${escapeHtml(s[0])} · ${escapeHtml(absenceTeamFor(s)?.name||s[5]||'Ohne Team')}</option>`).join('');
 const ownPerson=eligibleStaff.find(s=>s[8]===currentUserId);employee.value=ownPerson?ownPerson[0]:'';
 const updateTime=()=>{const show=['Abwesend untertägig','Arztbesuch'].includes(type.value);timeFields.hidden=!show;timeFields.querySelectorAll('input').forEach(input=>{input.required=show;if(!show)input.value='';});};type.onchange=updateTime;updateTime();
 dateFrom.onchange=()=>{if(dateFrom.value&&(!dateTo.value||dateTo.value<dateFrom.value))dateTo.value=dateFrom.value;};
 const close=()=>{modal.hidden=true;form.reset();dateFrom.value=isoDate(new Date());dateTo.value='';updateTime()};document.getElementById('close-absence').onclick=close;document.getElementById('cancel-absence').onclick=close;
 form.onsubmit=e=>{e.preventDefault();const person=staff.find(x=>x[0]===employee.value),kind=type.value,from=dateFrom.value,to=dateTo.value||from;
  if(!person||!kind||!from){toast('Bitte Mitarbeiter, Abwesenheitsart und Startdatum auswählen.');return;}
  if(!canCreateAbsenceFor(person)){toast('Du kannst Abwesenheiten nur für Mitarbeiter deines eigenen Teams eintragen.');return;}
  if(!validDateInput(from)||!validDateInput(to)){toast(DATE_RANGE_MSG);return;}
  if(to<from){toast('Das Enddatum darf nicht vor dem Startdatum liegen.');return;}
  const first=new Date(from+'T12:00:00'),last=new Date(to+'T12:00:00'),days=Math.round((last-first)/86400000)+1;if(days>366){toast('Der Zeitraum darf höchstens 366 Tage umfassen.');return;}
  let start='',end='';if(['Abwesend untertägig','Arztbesuch'].includes(kind)){start=document.getElementById('absence-start').value;end=document.getElementById('absence-end').value;if(!start||!end){toast('Bitte die Uhrzeit eintragen.');return;}if(end<=start){toast('Die Endzeit muss nach der Beginnzeit liegen.');return;}}
  const note=document.getElementById('absence-note').value.trim(),created=[];
  for(let i=0;i<days;i++){const d=addDays(first,i);created.push({id:makeId(),kind:'Dienstplan',team:absenceTeamFor(person)?.name||person[5]||'Ohne Team',employee:person[0],shift:kind,start,end,date:isoDate(d),isAbsence:true,note,color:'#d69b38'});}
  pushUndo('Abwesenheit');assignments.push(...created);try{persistAssignments();}catch(err){assignments.splice(-created.length,created.length);toast('Speichern im Browser nicht möglich.');return;}
  audit('Erstellt','Abwesenheit',`${person[0]} · ${kind} · ${fmt(first)}${days>1?' – '+fmt(last):''}`);
  createAssignmentNotifications(created,{absence:true});close();toast(days===1?'Abwesenheit wurde eingetragen.':`Abwesenheit für ${days} Tage wurde eingetragen.`);render();
 };
}
function bindDutyModal(){
 const team=document.getElementById('duty-team'),employee=document.getElementById('duty-employee'),shift=document.getElementById('duty-shift'),standbyGroup=document.getElementById('duty-standby-group'),form=document.getElementById('duty-form'),modal=document.getElementById('duty-modal');
 const close=document.getElementById('close-duty'),cancel=document.getElementById('cancel-duty');
 const timeBox=document.getElementById('duty-time-override'),startTime=document.getElementById('duty-start-time'),endTime=document.getElementById('duty-end-time'),timeHint=document.getElementById('duty-time-hint');
 if(!team||!employee||!shift||!form||!modal){console.error('Dienstformular konnte nicht initialisiert werden.');return}
 function refresh(){
  const t=team.value,selectedTeam=teamByName(t);
  const own=selectedTeam&&selfOnly(t,currentPage==='Bereitschaft'?'Bereitschaft':'Dienstplan');
  const people=staff.map((s,i)=>({s,i})).filter(x=>selectedTeam?selectedTeam.memberIds.includes(x.s[8])&&(!own||x.s[8]===currentUserId):false);
  employee.innerHTML=people.length?(own?'':'<option value="">Bitte Mitarbeiter wählen</option>')+people.map(x=>`<option value="${x.i}">${escapeHtml(x.s[0])}</option>`).join(''):'<option value="">Keine Mitarbeiter in diesem Team</option>';
  if(currentPage==='Bereitschaft'&&standbyGroup){const keep=standbyGroup.value;standbyGroup.innerHTML=standbyGroups.length?standbyGroups.map(g=>`<option value="${g.id}">${escapeHtml(g.name)}</option>`).join(''):'<option value="">Keine Bereitschaftsgruppen angelegt</option>';if(standbyGroups.some(g=>g.id===keep))standbyGroup.value=keep;standbyGroup.onchange=refreshShifts;}
  refreshShifts();
 }
 function refreshShifts(){
  const t=team.value;
  const types=currentPage==='Bereitschaft'?standbyTimes.filter(x=>!standbyGroup||x.groupId===standbyGroup.value):shiftTypes.filter(x=>x.team===t);
  shift.innerHTML=types.length?'<option value="">Bitte auswählen</option>'+types.map(x=>`<option value="${x.id}">${escapeHtml(x.name)} (${x.start}–${x.end})</option>`).join(''):`<option value="">${currentPage==='Bereitschaft'?'Keine Bereitschaftszeiten für diese Gruppe angelegt':'Keine Dienstzeiten für dieses Team angelegt'}</option>`;
  updateTimeFields();
 }
 function updateTimeFields(){const source=currentPage==='Bereitschaft'?standbyTimes:shiftTypes;const service=source.find(x=>String(x.id)===String(shift.value));if(timeBox)timeBox.hidden=!service;if(timeHint)timeHint.hidden=!service;if(service){startTime.value=service.start;endTime.value=service.end;}}
 shift.onchange=updateTimeFields;
 if(!entryTeams().length){team.innerHTML='<option value="">Kein Team zugewiesen</option>';team.disabled=true;}
 team.onchange=refresh;refresh();
 const title=modal.querySelector('.panel-head h2'),defaultTitle=title.textContent;
 const closeModal=()=>{modal.hidden=true;form.reset();editingDutyId=null;title.textContent=defaultTitle;refresh()};
 close.onclick=closeModal;cancel.onclick=closeModal;
 // „Bis“ folgt „Von“, solange nur ein Tag gewählt ist oder „Bis“ davor läge
 const dFrom=document.getElementById('duty-date-from'),dTo=document.getElementById('duty-date-to');
 if(dFrom&&dTo){dFrom.addEventListener('focus',()=>{dFrom.dataset.prev=dFrom.value});dFrom.addEventListener('change',()=>{const v=dFrom.value;if(v&&(!dTo.value||dTo.value<v||dTo.value===dFrom.dataset.prev))dTo.value=v;dFrom.dataset.prev=v})}
 form.onsubmit=async e=>{
  e.preventDefault();
  const person=staff[Number(employee.value)],service=(currentPage==='Bereitschaft'?standbyTimes:shiftTypes).find(x=>String(x.id)===String(shift.value));
  const dateFrom=document.getElementById('duty-date-from').value,dateTo=document.getElementById('duty-date-to').value||dateFrom;
  if(!person||!teamByName(team.value)?.memberIds.includes(person[8])){toast('Bitte einen Mitarbeiter auswählen, der diesem Team zugeordnet ist.');return}
  const fArea=currentPage==='Bereitschaft'?'Bereitschaft':'Dienstplan';
  if(!canEditEntry(team.value,person[0],fArea)){toast(selfEditAllowed(team.value,fArea)?'Du darfst nur deine eigenen Einträge anlegen und bearbeiten.':'Du darfst nur Teams bearbeiten, für die du als Teamleiter oder Deputy zugeordnet bist.');return}
  if(editingDutyId){const orig=assignments.find(a=>String(a.id)===String(editingDutyId));if(orig&&!canEditEntry(orig.team,orig.employee,areaOf(orig))){toast('Du darfst diesen Eintrag nicht bearbeiten.');return}}
  if(!service){toast(currentPage==='Bereitschaft'?'Bitte zuerst als Admin eine Bereitschaftsgruppe und Bereitschaftszeit anlegen.':'Bitte zuerst unter „Dienstzeiten“ eine Dienstzeit für dieses Team anlegen.');return}
  if(!dateFrom){toast('Bitte ein Startdatum auswählen.');return}
  if(!validDateInput(dateFrom)||!validDateInput(dateTo)){toast(DATE_RANGE_MSG);return}
  const startDate=new Date(dateFrom+'T12:00:00'),endDate=new Date(dateTo+'T12:00:00');
  if(Number.isNaN(startDate.getTime())||Number.isNaN(endDate.getTime())||startDate>endDate){toast('Das Enddatum darf nicht vor dem Startdatum liegen.');return}
  const dates=[];let dayCount=0,skipped=0;const multiDay=dateTo!==dateFrom;
  for(const cursor=new Date(startDate);cursor<=endDate;cursor.setDate(cursor.getDate()+1)){if(++dayCount>366){toast('Bitte einen Zeitraum von höchstens 366 Tagen auswählen.');return}
   // Bei mehreren Tagen nur die eingestellten Arbeitstage belegen (Bereitschaft immer Mo–So)
   if(multiDay&&currentPage!=='Bereitschaft'&&(cursor.getDay()+6)%7>=dutyDays){skipped++;continue}
   dates.push(isoDate(cursor))}
  if(!dates.length){toast('Im gewählten Zeitraum liegen keine Arbeitstage.');return}
  if(editingDutyId!==null&&dates.length>1){toast('Beim Bearbeiten bitte nur einen Tag wählen.');return}
  const customStart=startTime?.value||service.start,customEnd=endTime?.value||service.end;if(!customStart||!customEnd){toast('Bitte Beginn und Ende festlegen.');return}
  if(currentPage!=='Bereitschaft'&&customStart===customEnd){toast('Beginn und Ende dürfen nicht gleich sein.');return}
  const group=currentPage==='Bereitschaft'?standbyGroups.find(g=>g.id===standbyGroup?.value):null;
  for(const date of dates){const conflicts=assignments.filter(a=>a.employee===person[0]&&a.date===date&&String(a.id)!==String(editingDutyId));
   if(conflicts.some(a=>a.kind===currentPage&&!a.isAbsence)){toast(`${person[0]} hat am ${fmt(new Date(date+'T12:00:00'))} bereits ${currentPage==='Bereitschaft'?'eine Bereitschaft':'einen Dienst'}.`);return}
   const abs=conflicts.find(a=>a.isAbsence&&!['Abwesend untertägig','Arztbesuch','Urlaub 1/2 Tag'].includes(a.shift));
   if(abs&&!await ask(`${person[0]} ist am ${fmt(new Date(date+'T12:00:00'))} abwesend (${abs.shift}). Trotzdem einteilen?`))return;
   if(currentPage!=='Bereitschaft'&&!shiftMulti(service)){const taken=assignments.find(a=>a.kind==='Dienstplan'&&!a.isAbsence&&a.team===team.value&&a.date===date&&a.shift===service.name&&a.employee!==person[0]&&String(a.id)!==String(editingDutyId));
    if(taken&&!await ask(`${service.name} ist nur einmal pro Tag vorgesehen und am ${fmt(new Date(date+'T12:00:00'))} bereits mit ${taken.employee} besetzt. Trotzdem einteilen?`))return;}
   if(currentPage!=='Bereitschaft'){// Überschneidung mit Diensten am Vortag / Folgetag (über Mitternacht)
    const [ns,ne]=timeSpan({start:customStart,end:customEnd}),dayIso=o=>isoDate(addDays(new Date(date+'T12:00:00'),o));
    const others=o=>assignments.filter(a=>a.employee===person[0]&&a.date===dayIso(o)&&a.kind==='Dienstplan'&&!a.isAbsence&&a.start&&a.end&&String(a.id)!==String(editingDutyId));
    const clash=others(-1).find(a=>timeSpan(a)[1]-1440>ns)||(ne>1440?others(1).find(a=>timeSpan(a)[0]<ne-1440):null);
    if(clash&&!await ask(`${person[0]} hat am ${fmt(new Date(clash.date+'T12:00:00'))} bereits ${clash.shift} (${clash.start}–${clash.end}). Die Zeiten überschneiden sich. Trotzdem einteilen?`))return;}}
  const additions=dates.map(date=>({id:makeId(),kind:currentPage,team:team.value,employee:person[0],shift:service.name,groupId:group?.id||'',groupName:group?.name||'',start:customStart,end:customEnd,color:currentPage==='Bereitschaft'?(teamByName(team.value)?.standbyColor||'#159da8'):shiftHexColor(service.color||'teal'),date}));
  const previousAssignments=assignments.map(a=>({...a}));
  const wasEditing=editingDutyId!==null;
  pushUndo(wasEditing?'Bearbeiten':'Einteilen');
  if(wasEditing){const existing=assignments.find(a=>String(a.id)===String(editingDutyId));if(!existing){toast('Der Eintrag wurde nicht gefunden.');return}Object.assign(existing,additions[0],{id:existing.id});}
  else assignments.push(...additions);
  try{persistAssignments();}catch(err){assignments=previousAssignments;toast('Speichern im Browser nicht möglich.');console.error(err);return}
  audit(wasEditing?'Geändert':'Erstellt',currentPage,`${person[0]} · ${service.name} ${customStart}–${customEnd} · ${fmt(startDate)}${dates.length>1?' – '+fmt(endDate)+' ('+dates.length+' Tage)':''}`);
  if(!wasEditing)createAssignmentNotifications(additions);editingDutyId=null;
  modal.hidden=true;toast(wasEditing?'Eintrag wurde aktualisiert.':(dates.length===1&&!skipped?'Eintrag wurde erfolgreich angelegt.':`${dates.length} ${dates.length===1?'Eintrag wurde':'Einträge wurden'} angelegt${skipped?` (${skipped} ${skipped===1?'freier Tag':'freie Tage'} ausgelassen)`:''}.`));render();
 };
}
function openDutyModalFor({team,empIndex,date}){
 const m=document.getElementById('duty-modal');if(!m)return;
 if(!entryTeams().length){toast('Du bist keinem Team als Teamleiter oder Deputy zugewiesen.');return;}
 const t=document.getElementById('duty-team');
 if(team&&entryTeams().some(x=>x.name===team)){t.value=team;}
 t.dispatchEvent(new Event('change'));
 if(empIndex!==undefined)document.getElementById('duty-employee').value=String(empIndex);
 if(date){document.getElementById('duty-date-from').value=date;document.getElementById('duty-date-to').value=date;}
 m.hidden=false;
}
function openEditDuty(id){
 const item=assignments.find(a=>String(a.id)===String(id));
 if(!item){toast('Der Eintrag wurde nicht gefunden.');return}
 if(!canEditEntry(item.team,item.employee,areaOf(item))){toast('Du darfst Einträge dieses Teams nicht bearbeiten.');return}
 const modal=document.getElementById('duty-modal');if(!modal){toast('Bearbeiten ist auf dieser Seite nicht verfügbar.');return}
 if((item.kind==='Bereitschaft')!==(currentPage==='Bereitschaft')){toast(item.kind==='Bereitschaft'?'Bereitschaften bitte unter „Bereitschaft“ bearbeiten.':'Dienste bitte im Dienstplan bearbeiten.');return}
 editingDutyId=item.id;
 const team=document.getElementById('duty-team');team.value=item.team;team.disabled=false;team.dispatchEvent(new Event('change'));
 document.getElementById('duty-employee').value=String(staff.findIndex(p=>p[0]===item.employee));
 if(item.kind==='Bereitschaft'){const group=document.getElementById('duty-standby-group');if(group){group.value=item.groupId||'';group.dispatchEvent(new Event('change'));}}
 const service=(item.kind==='Bereitschaft'?standbyTimes:shiftTypes).find(x=>(item.kind==='Bereitschaft'?x.groupId===item.groupId:x.team===item.team)&&x.name===item.shift);
 if(service){const sel=document.getElementById('duty-shift');sel.value=String(service.id);sel.dispatchEvent(new Event('change'));document.getElementById('duty-start-time').value=item.start;document.getElementById('duty-end-time').value=item.end;}
 document.getElementById('duty-date-from').value=item.date;document.getElementById('duty-date-to').value=item.date;
 modal.querySelector('.panel-head h2').textContent='Eintrag bearbeiten';
 modal.hidden=false;
}
/* ------------------------------------------------------------------
   Personenauswahl mit Suche (z. B. Arbeitsort, Diensttausch)
------------------------------------------------------------------ */
function personPicker({id,name='',people,value='',placeholder='Person auswählen',empty='Keine Person gefunden',noneLabel=''}){
 if(noneLabel)people=[{name:'',label:noneLabel,sub:'',none:true},...people];
 const cur=people.find(p=>p.name===value&&(value!==''||p.none));
 const row=p=>p.none?`<span class="pp-none">–</span><span class="pp-txt"><b class="muted">${escapeHtml(p.label)}</b></span>`:`${avatarHtml(p.name,p.color||'var(--accent-color)',30)}<span class="pp-txt"><b>${escapeHtml(p.name)}</b>${p.sub?`<small>${escapeHtml(p.sub)}</small>`:''}</span>`;
 return `<div class="pp" data-pp="${id}"><input type="hidden" id="${id}" ${name?`name="${name}"`:''} value="${escapeHtml(cur?cur.name:'')}">
  <button type="button" class="pp-btn" aria-haspopup="listbox" aria-expanded="false">${cur?row(cur):`<span class="pp-txt"><b class="muted">${escapeHtml(placeholder)}</b></span>`}${icon('down','pp-caret')}</button>
  <div class="pp-panel" hidden><label class="team-dd-search">${icon('search')}<input type="search" class="pp-q" placeholder="Name oder Team suchen …" autocomplete="off"></label>
  <div class="pp-list" role="listbox">${people.map(p=>`<button type="button" class="pp-opt ${cur&&cur.name===p.name?'on':''}" role="option" data-pp-val="${escapeHtml(p.name)}" data-q="${escapeHtml(((p.label||p.name)+' '+(p.sub||'')).toLowerCase())}">${row(p)}${p.badge?`<em class="pp-badge">${escapeHtml(p.badge)}</em>`:''}<span class="pp-check">${icon('check')}</span></button>`).join('')}<div class="team-dd-empty" hidden>${escapeHtml(empty)}</div></div></div></div>`;
}
function bindPersonPicker(root){
 root.querySelectorAll('.pp').forEach(pp=>{if(pp.dataset.bound)return;pp.dataset.bound='1';
  const btn=pp.querySelector('.pp-btn'),panel=pp.querySelector('.pp-panel'),q=pp.querySelector('.pp-q'),hidden=pp.querySelector('input[type=hidden]');
  const opts=()=>[...pp.querySelectorAll('.pp-opt')].filter(o=>!o.hidden);
  const filter=()=>{const v=q.value.trim().toLowerCase();let n=0;pp.querySelectorAll('.pp-opt').forEach(o=>{const hit=!v||o.dataset.q.includes(v);o.hidden=!hit;if(hit)n++});pp.querySelector('.team-dd-empty').hidden=n>0};
  const place=()=>{const r=btn.getBoundingClientRect(),vh=window.innerHeight,vw=window.innerWidth,below=vh-r.bottom-12,above=r.top-12,list=pp.querySelector('.pp-list');
   const want=Math.min(330,Math.max(below,above));list.style.maxHeight=Math.max(120,want-60)+'px';
   const h=panel.offsetHeight,w=Math.min(Math.max(r.width,260),vw-16);
   panel.style.width=w+'px';panel.style.left=Math.max(8,Math.min(r.left,vw-w-8))+'px';
   panel.style.top=(below>=h||below>=above?r.bottom+6:Math.max(8,r.top-h-6))+'px'};
  const onScroll=e=>{if(panel.hidden)return;if(panel.contains(e.target))return;close()};
  const open=()=>{panel.hidden=false;pp.classList.add('open');btn.setAttribute('aria-expanded','true');q.value='';filter();place();window.addEventListener('scroll',onScroll,true);window.addEventListener('resize',place);q.focus({preventScroll:true});const on=pp.querySelector('.pp-opt.on');if(on){const l=pp.querySelector('.pp-list');l.scrollTop=Math.max(0,on.offsetTop-l.offsetTop-80)}};
  const close=()=>{panel.hidden=true;pp.classList.remove('open');btn.setAttribute('aria-expanded','false');window.removeEventListener('scroll',onScroll,true);window.removeEventListener('resize',place)};
  btn.onclick=e=>{e.preventDefault();panel.hidden?open():close()};
  q.oninput=()=>{filter();place()};
  q.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();opts()[0]?.focus()}else if(e.key==='Enter'){e.preventDefault();opts()[0]?.click()}else if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close();btn.focus()}};
  panel.onkeydown=e=>{const l=opts(),i=l.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();l[Math.min(l.length-1,i+1)]?.focus()}else if(e.key==='ArrowUp'){e.preventDefault();i<=0?q.focus():l[i-1].focus()}else if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close();btn.focus()}};
  pp.querySelectorAll('.pp-opt').forEach(o=>o.onclick=e=>{e.preventDefault();setPersonPicker(pp,o.dataset.ppVal);close();btn.focus({preventScroll:true})});
  document.addEventListener('pointerdown',e=>{if(panel.hidden||pp.contains(e.target))return;close();
   // Klick auf den abgedunkelten Hintergrund schließt nur die Auswahl, nicht gleich das ganze Fenster
   if(e.target.classList&&e.target.classList.contains('modal-backdrop')){const stop=ev=>{ev.stopPropagation();ev.preventDefault()};document.addEventListener('click',stop,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',stop,true),400)}},true);
 });
}
function setPersonPicker(pp,val){if(typeof pp==='string')pp=document.querySelector(`[data-pp="${pp}"]`);if(!pp)return;
 const o=[...pp.querySelectorAll('.pp-opt')].find(x=>x.dataset.ppVal===val);if(!o)return;const hidden=pp.querySelector('input[type=hidden]');
 pp.querySelectorAll('.pp-opt').forEach(x=>x.classList.toggle('on',x===o));
 const btn=pp.querySelector('.pp-btn');btn.innerHTML=o.innerHTML.replace(/<em class="pp-badge">.*?<\/em>/,'').replace(/<span class="pp-check">.*?<\/span>$/,'')+icon('down','pp-caret');
 if(hidden.value!==val){hidden.value=val;hidden.dispatchEvent(new Event('change',{bubbles:true}))}}

/* ------------------------------------------------------------------
   Diensttausch: Anfrage an Kollegin/Kollegen (ein oder mehrere Tage)
   – getauscht wird erst nach Bestätigung durch die angefragte Person
------------------------------------------------------------------ */
const SWAP_ROLES=['Mitarbeiter','Deputy','Admin'];
const SWAP_STATUS={offen:'Offen',angenommen:'Getauscht',abgelehnt:'Abgelehnt',zurückgezogen:'Zurückgezogen',ungültig:'Nicht mehr möglich'};
const swapSnap=a=>({id:a.id,date:String(a.date),shift:String(a.shift??''),start:String(a.start||''),end:String(a.end||''),team:String(a.team??'')});
let swaps=(()=>{const v=load('dienstplanSwaps',[]);if(!Array.isArray(v))return [];
 const snapOk=x=>x&&typeof x==='object'&&typeof x.date==='string';
 return v.filter(x=>x&&typeof x==='object'&&x.id&&typeof x.from==='string'&&typeof x.to==='string'&&Object.prototype.hasOwnProperty.call(SWAP_STATUS,x.status)).map(x=>{
  // ältere Anfragen (ein Dienst) in das neue Format übernehmen
  if(!Array.isArray(x.give)){x.give=snapOk(x.a)?[{...x.a,id:x.aId}]:[];x.take=snapOk(x.b)?[{...x.b,id:x.bId}]:[]}
  x.give=(Array.isArray(x.give)?x.give:[]).filter(snapOk);x.take=(Array.isArray(x.take)?x.take:[]).filter(snapOk);return x}).filter(x=>x.give.length)})();
function persistSwaps(){save('dienstplanSwaps',swaps)}
const swapOpenFor=id=>swaps.find(x=>x.status==='offen'&&[...x.give,...x.take].some(d=>String(d.id)===String(id)));
const swapEnabled=teamName=>teamSettings(teamByName(teamName)).swap;
const canRequestSwap=()=>SWAP_ROLES.includes(currentRole)&&swapTeamsOf(currentUserName()).length>0;
const swapTeamsOf=name=>{const p=staff.find(x=>x[0]===name);return p?teams.filter(t=>t.memberIds.includes(p[8])&&teamSettings(t).swap).map(t=>t.name):[]};
function swapColleagues(teamFilter){const me=currentUserName(),mine=swapTeamsOf(me).filter(t=>!teamFilter||t===teamFilter);
 return staff.filter(p=>p[0]!==me&&SWAP_ROLES.includes(p[10]||'Mitarbeiter')&&teams.some(t=>mine.includes(t.name)&&t.memberIds.includes(p[8]))).sort((x,y)=>x[0].localeCompare(y[0],'de'))}
function canSwapDuty(a){return canRequestSwap()&&!!a&&a.kind==='Dienstplan'&&!a.isAbsence&&a.employee===currentUserName()&&a.date>=isoDate(new Date())&&!swapOpenFor(a.id)&&swapColleagues(a.team).length>0}
function swapPill(a){if(!a||a.kind!=='Dienstplan'||a.isAbsence)return '';const x=swapOpenFor(a.id);if(!x)return '';return `<span class="swap-pill" title="Tausch zwischen ${escapeHtml(x.from)} und ${escapeHtml(x.to)} wartet auf Bestätigung">${icon('refresh')}Tausch angefragt</span>`}
const swapDate=d=>fmt(new Date(d+'T12:00:00'));
const swapRange=list=>{if(!list.length)return '';const d=list.map(x=>x.date).sort();return d[0]===d[d.length-1]?swapDate(d[0]):`${swapDate(d[0])} – ${swapDate(d[d.length-1])}`};
const swapText=list=>list.length===1?`„${list[0].shift}“ am ${swapDate(list[0].date)}`:`${list.length} Dienste (${swapRange(list)})`;
/* Prüft den gesamten Tausch – liefert eine Liste von Gründen (leer = möglich) */
function swapProblems(give,take,from,to){
 const out=[],today=isoDate(new Date()),find=id=>assignments.find(x=>String(x.id)===String(id));
 if(!give.length)return ['An diesem Tag hast du keinen Dienst, den du tauschen kannst.'];
 {const off=[...new Set([...give,...take].map(d=>d.team))].filter(n=>!swapEnabled(n));if(off.length)return [`Diensttausch ist im ${off.join(', ')} deaktiviert.`]}
 const A=give.map(d=>find(d.id)),B=take.map(d=>find(d.id));
 if(A.some((a,i)=>!a||a.employee!==from||a.isAbsence||a.date!==give[i].date))out.push('Ein angefragter Dienst wurde inzwischen geändert oder gelöscht.');
 if(B.some((b,i)=>!b||b.employee!==to||b.isAbsence||b.date!==take[i].date))out.push('Ein Gegendienst wurde inzwischen geändert oder gelöscht.');
 if(out.length)return out;
 if([...A,...B].some(x=>x.date<today))out.push('Ein Dienst liegt bereits in der Vergangenheit.');
 const moving=new Set([...A,...B]);
 const after=(name,gain)=>{const by={};assignments.forEach(x=>{if(x.kind==='Dienstplan'&&!x.isAbsence&&x.employee===name&&!moving.has(x))by[x.date]=(by[x.date]||0)+1});gain.forEach(x=>{by[x.date]=(by[x.date]||0)+1});return by};
 const chk=(name,gain)=>{const by=after(name,gain);[...new Set(gain.map(x=>x.date))].sort().forEach(d=>{if(by[d]>1)out.push(`${name} hätte am ${swapDate(d)} zwei Dienste.`);if(fullDayAbsent(name,d))out.push(`${name} ist am ${swapDate(d)} abwesend.`)})};
 chk(to,A);chk(from,B);
 return [...new Set(out)];
}
function swapListHtml(list,label,empty){
 return `<div class="swap-duty ${list.length?'':'is-none'}"><span class="swap-duty-label">${label}${list.length>1?` · ${list.length}`:''}</span>${list.length?list.map(x=>{const c=shiftTypes.find(st=>st.team===x.team&&st.name===x.shift);return `<div class="swap-line" style="--c:${shiftHexColor(c?.color||'blue')}"><b>${escapeHtml(x.shift)}</b><small>${escapeHtml(fmtShortWd(new Date(x.date+'T12:00:00')))}${x.start?` · ${escapeHtml(x.start)}–${escapeHtml(x.end)}`:''}</small></div>`}).join(''):`<b>${escapeHtml(empty)}</b><small>Dienst wird nur übernommen</small>`}</div>`}
function notifySwap(name,title,message,sw,date){const p=staff.find(x=>x[0]===name);if(!p)return;
 notifications.push({id:makeId(),recipientId:p[8],recipientRole:p[10]||'Mitarbeiter',title,message,createdAt:Date.now(),read:false,swapId:sw.id,targetPage:'Dienstplan',targetDate:date});
 try{save('dienstplanNotifications',notifications,true)}catch(e){notifications.pop();console.warn('Benachrichtigung konnte nicht gespeichert werden.',e)}}
/* Neue Tauschanfrage – nur Kollegin/Kollege und Datum wählen (weitere Tage optional) */
async function openSwapRequest(preId){
 if(!SWAP_ROLES.includes(currentRole)){toast('Diensttausch-Anfragen können Mitarbeiter, Deputies und Admins stellen.');return}
 if(!canRequestSwap()){toast('Der Diensttausch ist in deinen Teams deaktiviert.');return}
 const me=currentUserName(),today=isoDate(new Date()),pre=preId?assignments.find(x=>String(x.id)===String(preId)):null;
 if(pre&&swapOpenFor(pre.id)){toast('Für diesen Dienst läuft bereits eine Tauschanfrage.');return}
 const cols=swapColleagues();if(!cols.length){toast('In deinen Teams gibt es niemanden, mit dem du tauschen kannst.');return}
 const myTeams=swapTeamsOf(me);
 const mineOn=(date,to)=>{const tt=myTeams.filter(t=>swapTeamsOf(to).includes(t));return assignments.filter(x=>x.kind==='Dienstplan'&&!x.isAbsence&&x.employee===me&&x.date===date&&tt.includes(x.team))};
 const theirsOn=(date,to)=>{const tt=myTeams.filter(t=>swapTeamsOf(to).includes(t));return assignments.filter(x=>x.kind==='Dienstplan'&&!x.isAbsence&&x.employee===to&&x.date===date&&tt.includes(x.team))};
 const startDate=pre?pre.date:(()=>{const n=assignments.filter(x=>x.kind==='Dienstplan'&&!x.isAbsence&&x.employee===me&&x.date>=today&&myTeams.includes(x.team)&&!swapOpenFor(x.id)).sort((a,b)=>a.date.localeCompare(b.date))[0];return n?n.date:today})();
 const first=cols.find(p=>theirsOn(startDate,p[0]).length)||cols[0];
 const people=cols.map(p=>({name:p[0],sub:swapTeamsOf(p[0]).filter(t=>myTeams.includes(t)).join(', '),color:teamColor(teamByName(p[5]))}));
 const inner=`<div class="swap-req">
  <div class="wp-field"><span class="wp-label">Mit wem möchtest du tauschen?</span>${personPicker({id:'swap-to',name:'to',people,value:first[0]})}</div>
  <div class="swap-cols"><div class="wp-field"><span class="wp-label">Datum <small class="muted">– Tage antippen</small></span><div class="scal" id="swap-cal"></div></div>
  <div class="wp-field swap-right"><span class="wp-label">Auswahl</span><div class="swap-dates" id="swap-dates"></div></div></div>
  <div class="wp-summary swap-sum-wide" id="swap-sum" aria-live="polite"></div>
  <label class="wp-field"><span class="wp-label">Nachricht <small class="muted">(optional)</small></span><input name="note" maxlength="200" placeholder="z. B. Grund für den Tausch" autocomplete="off"></label>
  <p class="small muted swap-hint">${icon('alert')}Getauscht wird erst, wenn deine Kollegin bzw. dein Kollege die Anfrage bestätigt.</p></div>`;
 const pendIn=swapsIncoming().length;
 const dlg=formDialog('Diensttausch anfragen',inner,'Anfrage senden',`Wähle die Person und den Tag – deine Dienste an diesem Tag werden getauscht. <button type="button" class="link-btn" id="swap-open-center">${pendIn?`${pendIn} ${pendIn===1?'Anfrage wartet':'Anfragen warten'} auf dich`:'Anfragen &amp; Verlauf ansehen'}</button>`);
 const layer=[...document.querySelectorAll('.app-dialog')].pop(),$=sel=>layer.querySelector(sel),submit=$('button[type=submit]');
 $('.modal').classList.add('swap-modal');bindPersonPicker(layer);
 $('#swap-open-center')?.addEventListener('click',()=>{layer.querySelector('[data-dlg="cancel"]').click();openSwapCenter()});
 let dates=[startDate],give=[],take=[];
 const dutyTxt=x=>`<b>${escapeHtml(x.shift)}</b><small>${escapeHtml(x.start)}–${escapeHtml(x.end)}</small>`;
 let calMonth=(()=>{const d=new Date(startDate+'T12:00:00');return new Date(d.getFullYear(),d.getMonth(),1,12)})();
 const maxDay=isoDate(addDays(new Date(),180));
 const drawCal=()=>{const to=$('#swap-to').value,y=calMonth.getFullYear(),m=calMonth.getMonth(),first=new Date(y,m,1,12),lead=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  const minM=new Date(new Date().getFullYear(),new Date().getMonth(),1,12),canPrev=calMonth>minM,canNext=isoDate(new Date(y,m+1,1,12))<=maxDay;
  const myDays=new Map();assignments.forEach(x=>{if(x.kind==='Dienstplan'&&!x.isAbsence&&x.employee===me&&myTeams.includes(x.team)&&x.date.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)){if(!myDays.has(x.date))myDays.set(x.date,x)}});
  const theirDays=new Set(assignments.filter(x=>x.kind==='Dienstplan'&&!x.isAbsence&&x.employee===to&&x.date.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).map(x=>x.date));
  let cells='';const tIso=today,skipTo=(()=>{if(!(y===new Date().getFullYear()&&m===new Date().getMonth()))return 1;const t=new Date();const wd=(t.getDay()+6)%7;return Math.max(1,t.getDate()-wd)})();
  const lead2=skipTo>1?0:lead;for(let i=0;i<lead2;i++)cells+='<span class="scal-blank"></span>';
  for(let d=skipTo;d<=days;d++){const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,mine=myDays.get(iso),sel=dates.includes(iso),past=iso<today,busy=mine&&swapOpenFor(mine.id),ok=mine&&!past&&!busy&&iso<=maxDay;
   const label=`${fmtWithWeekday(new Date(iso+'T12:00:00'))}${mine?` · ${mine.shift} ${mine.start}–${mine.end}`:' · kein Dienst'}${busy?' · bereits angefragt':''}`;
   cells+=`<button type="button" class="scal-day ${sel?'on':''} ${ok?'has':''} ${iso===today?'today':''} ${busy?'busy':''}" data-scal="${iso}" ${ok||sel?'':'disabled'} aria-pressed="${sel}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><span class="scal-n">${d}</span>${mine?`<span class="scal-shift" style="--c:${shiftHexColor(assignmentColor(mine))}">${escapeHtml(mine.shift.slice(0,1))}</span>`:''}${theirDays.has(iso)&&ok?'<i class="scal-them" aria-hidden="true"></i>':''}</button>`}
  $('#swap-cal').innerHTML=`<div class="scal-head"><button type="button" class="icon-btn" data-scal-nav="-1" ${canPrev?'':'disabled'} aria-label="Voriger Monat">${icon('chev')}</button><b>${escapeHtml(monthName(calMonth))}</b><button type="button" class="icon-btn scal-next" data-scal-nav="1" ${canNext?'':'disabled'} aria-label="Nächster Monat">${icon('chev')}</button></div>
   <div class="scal-grid">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>`<span class="scal-wd">${w}</span>`).join('')}${cells}</div>
   <div class="scal-legend"><span><i class="scal-shift lg">D</i>Dein Dienst</span><span><i class="scal-them lg"></i>${escapeHtml(to.split(' ')[0])} hat Dienst</span><span><i class="scal-sel lg"></i>Ausgewählt</span></div>`;
  $('#swap-cal').querySelectorAll('[data-scal-nav]').forEach(b=>b.onclick=()=>{calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+ +b.dataset.scalNav,1,12);drawCal()});
  $('#swap-cal').querySelectorAll('[data-scal]').forEach(b=>b.onclick=()=>{const iso=b.dataset.scal;if(dates.includes(iso))dates=dates.filter(x=>x!==iso);else{if(dates.length>=14){toast('Höchstens 14 Tage pro Anfrage.');return}dates=[...dates,iso].sort()}draw()})};
 const draw=()=>{const to=$('#swap-to').value;give=[];take=[];
  drawCal();
  $('#swap-dates').innerHTML=dates.length?dates.map(d=>{const m=d>=today?mineOn(d,to):[],t=d>=today?theirsOn(d,to):[];give.push(...m);take.push(...t);
   const busy=[...m,...t].some(x=>swapOpenFor(x.id));
   const one=l=>l.map(x=>`<b>${escapeHtml(x.shift)}</b> <small>${escapeHtml(x.start)}–${escapeHtml(x.end)}</small>`).join('<br>');
   return `<div class="swap-day ${busy?'is-busy':''}"><div class="swap-day-top"><span class="swap-day-date"><b>${escapeHtml(fmtShortWd(new Date(d+'T12:00:00')))}</b></span><button type="button" class="swap-x" data-swap-del="${d}" aria-label="Tag entfernen">×</button></div>
    <div class="swap-day-line"><span class="swap-give">${m.length?one(m):'<em>Kein Dienst</em>'}</span><span class="swap-arrow sm">${icon('refresh')}</span><span class="swap-take">${t.length?one(t):`<em>${escapeHtml(to.split(' ')[0])} hat frei</em>`}</span></div>${busy?'<small class="swap-opt-why">'+icon('alert')+'Bereits angefragt</small>':''}</div>`}).join(''):'<div class="swap-empty">Tippe links im Kalender auf einen Tag mit deinem Dienst.</div>';
  $('#swap-dates').querySelectorAll('[data-swap-del]').forEach(b=>b.onclick=()=>{dates=dates.filter(x=>x!==b.dataset.swapDel);draw()});
  summary()};
 const summary=()=>{const to=$('#swap-to').value,box=$('#swap-sum');
  let pr=[];
  if(!dates.length)pr.push('Bitte im Kalender mindestens einen Tag auswählen.');
  if(dates.some(d=>!d||d<today))pr.push('Bitte nur heutige oder zukünftige Tage wählen.');
  if(new Set(dates).size!==dates.length)pr.push('Ein Tag ist doppelt ausgewählt.');
  if(dates.some(d=>d&&d>=today&&!mineOn(d,to).length))pr.push(`Du hast am ${dates.filter(d=>d&&d>=today&&!mineOn(d,to).length).map(swapDate).join(', ')} keinen Dienst, den du tauschen kannst.`);
  if([...give,...take].some(x=>swapOpenFor(x.id)))pr.push('Für einen der Dienste läuft bereits eine Tauschanfrage.');
  if(!pr.length)pr=swapProblems(give.map(swapSnap),take.map(swapSnap),me,to);
  submit.disabled=pr.length>0;
  box.className='wp-summary'+(pr.length?' warn':'');
  box.innerHTML=pr.length?`${icon('alert')}<div>${pr.slice(0,4).map(x=>`<span class="block">${escapeHtml(x)}</span>`).join('')}</div>`:`<span class="wp-sum-ic">${icon('refresh')}</span><div><b>${take.length?`Tausch mit ${escapeHtml(to)}`:`${escapeHtml(to)} übernimmt deinen Dienst`}</b><small>Du gibst ${give.length} ${give.length===1?'Dienst':'Dienste'} ab${take.length?` und übernimmst ${take.length}`:''} · ${escapeHtml(to)} muss bestätigen.</small></div>`};
 $('#swap-to').addEventListener('change',draw);
 draw();
 const res=await dlg;if(!res)return;
 const to=$('#swap-to').value,G=give.map(swapSnap),T=take.map(swapSnap);
 const pr=swapProblems(G,T,me,to);if(pr.length){toast(pr[0]);return}
 if([...G,...T].some(d=>swapOpenFor(d.id))){toast('Für einen der Dienste läuft bereits eine Tauschanfrage.');return}
 const toP=staff.find(p=>p[0]===to);
 const sw={id:makeId(),status:'offen',from:me,fromId:currentUserId,to,toId:toP?.[8]||'',give:G,take:T,note:String(res.note||'').trim().slice(0,200),createdAt:Date.now(),decidedAt:0};
 swaps.push(sw);
 try{persistSwaps()}catch(e){swaps.pop();toast('Die Anfrage konnte nicht gespeichert werden.');return}
 notifySwap(to,'Anfrage: Diensttausch',`${me} möchte ${swapText(G)} mit dir tauschen${T.length?` – im Tausch gegen ${swapText(T)}`:' (ohne Gegendienst)'}.${sw.note?' Nachricht: '+sw.note:''}`,sw,G[0].date);
 audit('Erstellt','Dienstplan',`Tauschanfrage ${me} → ${to} · ${G.length} ${G.length===1?'Dienst':'Dienste'}${T.length?' gegen '+T.length:''} · ${swapRange([...G,...T])}`,{title:'Diensttausch angefragt'});
 refreshNotifications();toast(`Anfrage an ${to} gesendet. Getauscht wird erst nach der Bestätigung.`);render();
}
/* Teameinstellungen liegen jetzt in der Administration */
function openTeamSettings(teamName){const t=teamName&&teamByName(teamName);adminOpenTeam=t?t.id:'';go('Administration')}
function decideSwap(id,accept){
 const sw=swaps.find(x=>x.id===id&&x.status==='offen');if(!sw)return false;
 const me=currentUserName();if(sw.to!==me){toast('Nur die angefragte Person kann den Tausch bestätigen.');return false}
 const when=swapText(sw.give);
 if(!accept){sw.status='abgelehnt';sw.decidedAt=Date.now();persistSwaps();notifySwap(sw.from,'Diensttausch abgelehnt',`${me} hat deine Anfrage (${when}) abgelehnt. Deine Dienste bleiben unverändert.`,sw,sw.give[0].date);audit('Geändert','Dienstplan',`Tauschanfrage von ${sw.from} abgelehnt · ${swapRange(sw.give)}`,{title:'Diensttausch abgelehnt'});refreshNotifications();toast('Anfrage abgelehnt.');render();return true}
 const pr=swapProblems(sw.give,sw.take,sw.from,sw.to);
 if(pr.length){sw.status='ungültig';sw.decidedAt=Date.now();persistSwaps();notifySwap(sw.from,'Diensttausch nicht möglich',`Der Tausch mit ${me} (${when}) konnte nicht durchgeführt werden: ${pr[0]}`,sw,sw.give[0].date);refreshNotifications();toast('Tausch nicht möglich: '+pr[0]);render();return true}
 pushUndo('Diensttausch');const before=JSON.stringify(assignments),find=d=>assignments.find(x=>String(x.id)===String(d.id));
 sw.give.forEach(d=>{find(d).employee=sw.to});sw.take.forEach(d=>{find(d).employee=sw.from});
 try{persistAssignments()}catch(e){assignments=JSON.parse(before);toast('Der Tausch konnte nicht gespeichert werden.');return false}
 sw.status='angenommen';sw.decidedAt=Date.now();
 const ids=new Set([...sw.give,...sw.take].map(d=>String(d.id)));
 swaps.forEach(x=>{if(x!==sw&&x.status==='offen'&&[...x.give,...x.take].some(d=>ids.has(String(d.id)))){x.status='ungültig';x.decidedAt=Date.now();notifySwap(x.from,'Diensttausch nicht mehr möglich',`Deine Anfrage (${swapText(x.give)}) ist hinfällig, weil einer der Dienste bereits getauscht wurde.`,x,x.give[0].date)}});
 persistSwaps();
 notifySwap(sw.from,'Diensttausch bestätigt',`${me} hat den Tausch bestätigt und übernimmt ${swapText(sw.give)}.${sw.take.length?` Du übernimmst ${swapText(sw.take)}.`:''}`,sw,sw.give[0].date);
 const tn=[...new Set([...sw.give,...sw.take].map(d=>d.team))];
 const leads=new Set();tn.forEach(n=>{const t=teamByName(n);if(t)[t.leaderId,t.deputyId].filter(Boolean).forEach(id=>leads.add(id))});
 leads.forEach(id=>{const p=staff.find(x=>x[8]===id);if(p&&p[0]!==sw.from&&p[0]!==sw.to)notifySwap(p[0],'Dienst im Team getauscht',`${sw.from} ↔ ${sw.to} · ${swapText(sw.give)}${sw.take.length?' gegen '+swapText(sw.take):''}`,sw,sw.give[0].date)});
 audit('Geändert','Dienstplan',`Dienst getauscht: ${sw.from} ↔ ${sw.to} · ${swapText(sw.give)}${sw.take.length?' gegen '+swapText(sw.take):''}`,{title:'Diensttausch bestätigt'});
 refreshNotifications();toast('Dienst getauscht. '+sw.from+' wurde benachrichtigt.');render();return true;
}
function withdrawSwap(id){const sw=swaps.find(x=>x.id===id&&x.status==='offen');if(!sw||sw.from!==currentUserName())return false;
 sw.status='zurückgezogen';sw.decidedAt=Date.now();persistSwaps();
 notifications=notifications.filter(n=>!(n.swapId===id&&!n.read&&n.title==='Anfrage: Diensttausch'));persistNotifications();
 audit('Geändert','Dienstplan',`Tauschanfrage an ${sw.to} zurückgezogen · ${swapRange(sw.give)}`,{title:'Diensttausch zurückgezogen'});
 refreshNotifications();toast('Anfrage zurückgezogen.');render();return true}
const swapsIncoming=()=>{const me=currentUserName();return swaps.filter(x=>x.status==='offen'&&x.to===me)};
const swapsOutgoing=()=>{const me=currentUserName();return swaps.filter(x=>x.status==='offen'&&x.from===me)};
function openSwapCenter(focusId){
 const me=currentUserName();
 const card=(sw,mode)=>{const other=mode==='in'?sw.from:sw.to;
  const left=mode==='in'?sw.take:sw.give,right=mode==='in'?sw.give:sw.take;
  const lLabel=mode==='hist'?escapeHtml(sw.from)+' gibt ab':'Du gibst ab',rLabel=mode==='hist'?escapeHtml(sw.to)+' gibt ab':'Du übernimmst';
  return `<div class="swap-card ${sw.id===focusId?'is-focus':''}" data-swap="${escapeHtml(sw.id)}"><div class="swap-card-head">${avatarHtml(other,teamColor(teamByName(sw.give[0]?.team)),34)}<div><b>${mode==='in'?`${escapeHtml(other)} fragt dich an`:mode==='out'?`Anfrage an ${escapeHtml(other)}`:`${escapeHtml(sw.from)} ↔ ${escapeHtml(sw.to)}`}</b><small>${fmtDateTime(sw.createdAt)}</small></div><span class="swap-status s-${sw.status==='angenommen'?'ok':sw.status==='offen'?'open':'no'}">${SWAP_STATUS[sw.status]}</span></div>
   <div class="swap-pair">${mode==='hist'?swapListHtml(sw.give,lLabel,'—')+`<span class="swap-arrow">${icon('refresh')}</span>`+swapListHtml(sw.take,rLabel,'Kein Gegendienst'):swapListHtml(left,lLabel,'Kein Gegendienst')+`<span class="swap-arrow">${icon('refresh')}</span>`+swapListHtml(right,rLabel,'—')}</div>
   ${sw.note?`<p class="swap-note">„${escapeHtml(sw.note)}“</p>`:''}
   ${mode==='in'?`<div class="btn-row swap-actions"><button type="button" class="btn" data-swap-no="${escapeHtml(sw.id)}">Ablehnen</button><button type="button" class="btn primary" data-swap-yes="${escapeHtml(sw.id)}">${icon('check')}Annehmen &amp; tauschen</button></div>`:mode==='out'?`<div class="btn-row swap-actions"><span class="small muted">Wartet auf Bestätigung durch ${escapeHtml(other)}</span><button type="button" class="btn ghost" data-swap-back="${escapeHtml(sw.id)}">Zurückziehen</button></div>`:''}</div>`};
 const histAll=()=>swaps.filter(x=>x.status!=='offen'&&(x.from===me||x.to===me)).sort((a,b)=>(b.decidedAt||b.createdAt||0)-(a.decidedAt||a.createdAt||0));
 const focusSw=focusId&&swaps.find(x=>x.id===focusId);
 let tab=focusSw&&focusSw.status!=='offen'?'hist':'open';
 const line=x=>`<span class="swap-hline"><i class="dot" style="--c:${shiftHexColor(shiftTypes.find(st=>st.team===x.team&&st.name===x.shift)?.color||'blue')}"></i><b>${escapeHtml(x.shift)}</b><small>${escapeHtml(fmtShortWd(new Date(x.date+'T12:00:00')))} · ${escapeHtml(x.start)}–${escapeHtml(x.end)}</small></span>`;
 const hrow=sw=>{const mineOut=sw.from===me,other=mineOut?sw.to:sw.from,cls=sw.status==='angenommen'?'ok':'no',n=`${sw.give.length} ⇄ ${sw.take.length||0}`;
  return `<details class="swap-hrow ${sw.id===focusId?'is-focus':''}" data-swap="${escapeHtml(sw.id)}" ${sw.id===focusId?'open':''}><summary>${avatarHtml(other,teamColor(teamByName(sw.give[0]?.team)),30)}<span class="swap-hmain"><b>${mineOut?'Du → ':''}${escapeHtml(other)}${mineOut?'':' → dich'}</b><small>${sw.take.length?`${n} Dienste`:`${sw.give.length} ${sw.give.length===1?'Dienst':'Dienste'} übernommen`} · ${escapeHtml(swapRange([...sw.give,...sw.take]))}</small></span><span class="swap-status s-${cls}">${SWAP_STATUS[sw.status]}</span><small class="swap-hdate">${fmtDateTime(sw.decidedAt||sw.createdAt)}</small>${icon('down','swap-hcaret')}</summary>
   <div class="swap-hdetail"><div><span class="swap-hlbl">${escapeHtml(sw.from)} gibt ab</span>${sw.give.map(line).join('')}</div><div><span class="swap-hlbl">${escapeHtml(sw.to)} gibt ab</span>${sw.take.length?sw.take.map(line).join(''):'<span class="swap-hline"><small>Kein Gegendienst</small></span>'}</div>${sw.note?`<p class="swap-note">„${escapeHtml(sw.note)}“</p>`:''}</div></details>`};
 const draw=()=>{const inc=swapsIncoming(),out=swapsOutgoing(),hist=histAll();
  const tabs=`<div class="te-tabs swap-tabs" role="tablist"><button type="button" role="tab" data-swap-tab="open" class="${tab==='open'?'active':''}" aria-selected="${tab==='open'}">Offene Anfragen <span class="te-n">${inc.length+out.length}</span></button><button type="button" role="tab" data-swap-tab="hist" class="${tab==='hist'?'active':''}" aria-selected="${tab==='hist'}">Verlauf <span class="te-n">${hist.length}</span></button></div>`;
  if(tab==='hist')return `${tabs}<div class="swap-hist">${hist.length?hist.slice(0,40).map(hrow).join(''):'<div class="empty-note">Noch keine abgeschlossenen Tauschanfragen.</div>'}</div>${hist.length>40?`<p class="small muted">Es werden die letzten 40 Einträge angezeigt.</p>`:''}`;
  return `${tabs}${canRequestSwap()?`<button type="button" class="btn primary swap-new" id="swap-new">${icon('plus')}Neue Tauschanfrage</button>`:''}
  <section class="swap-sec"><h3>Anfragen an dich <span class="pill">${inc.length}</span></h3>${inc.length?inc.map(x=>card(x,'in')).join(''):'<div class="empty-note">Keine offenen Anfragen an dich.</div>'}</section>
  <section class="swap-sec"><h3>Deine Anfragen <span class="pill">${out.length}</span></h3>${out.length?out.map(x=>card(x,'out')).join(''):'<div class="empty-note">Du hast keine offenen Anfragen.</div>'}</section>`};
 const {layer,close}=infoDialog('Diensttausch','Anfragen bestätigen, ablehnen oder zurückziehen. Getauscht wird erst nach Bestätigung.',draw());
 layer.querySelector('.modal').classList.add('swap-center');
 const body=layer.querySelector('.dash-dialog-body');
 const bind=()=>{body.querySelectorAll('[data-swap-yes]').forEach(b=>b.onclick=()=>{decideSwap(b.dataset.swapYes,true);body.innerHTML=draw();bind()});
  body.querySelectorAll('[data-swap-no]').forEach(b=>b.onclick=async()=>{if(!await ask('Anfrage wirklich ablehnen?','Ablehnen'))return;decideSwap(b.dataset.swapNo,false);body.innerHTML=draw();bind()});
  body.querySelectorAll('[data-swap-back]').forEach(b=>b.onclick=async()=>{if(!await ask('Anfrage zurückziehen?','Zurückziehen'))return;withdrawSwap(b.dataset.swapBack);body.innerHTML=draw();bind()});
  const nb=body.querySelector('#swap-new');if(nb)nb.onclick=()=>{close();openSwapRequest()};
  body.querySelectorAll('[data-swap-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.swapTab;body.innerHTML=draw();bind();body.querySelector(`[data-swap-tab="${tab}"]`)?.focus()});
  const f=focusId&&body.querySelector(`[data-swap="${CSS.escape(focusId)}"]`);if(f)f.scrollIntoView({block:'nearest'})};
 bind();
}
/* Arbeitsort als Hinweis am Dienst: Index je Person und Tag */
let WPX={wp:new Map(),duty:new Set()};
function buildWpIndex(){const wp=new Map(),duty=new Set();assignments.forEach(a=>{const k=a.date+'|'+a.employee;if(a.kind==='Arbeitsort')wp.set(k,a);else if(a.kind==='Dienstplan'&&!a.isAbsence)duty.add(k)});WPX={wp,duty};return WPX}
const wpFor=a=>a&&a.kind==='Dienstplan'&&!a.isAbsence?WPX.wp.get(a.date+'|'+a.employee)||null:null;
const wpMerged=a=>a.kind==='Arbeitsort'&&WPX.duty.has(a.date+'|'+a.employee);// steht bereits als Hinweis beim Dienst
const wpHint=(wp,cls='')=>wp?`<span class="wp-hint ${wp.shift==='Homeoffice'?'is-home':'is-office'} ${cls}" title="Arbeitsort: ${escapeHtml(wp.shift)}">${icon(wp.shift==='Homeoffice'?'home':'build')}${escapeHtml(wp.shift)}</span>`:'';
/* Mobil: Aktionen-Menü im Dienstplan und in der Bereitschaft */
function openDutyActionsSheet(){
 const src=[...document.querySelectorAll('.dp-actions > button')];if(!src.length)return;
 const desc={'swap-new-btn':'Dienst mit einer Kollegin oder einem Kollegen tauschen','add-workplace':'Homeoffice oder Büro eintragen','add-absence':'Urlaub, Krankenstand & Co. eintragen','duty-rotation':'Dienste im Wechsel automatisch verteilen','auto-rotation':'Bereitschaften im Wechsel automatisch verteilen','add':currentPage==='Bereitschaft'?'Neue Bereitschaft einteilen':'Neuen Dienst einteilen'};
 const layer=document.createElement('div');layer.className='modal-backdrop app-dialog dp-sheet-layer';
 layer.innerHTML=`<div class="dp-sheet" role="dialog" aria-modal="true" aria-labelledby="dp-sheet-title"><div class="dp-sheet-grip" aria-hidden="true"></div><div class="dp-sheet-head"><b id="dp-sheet-title">Aktionen</b><button type="button" class="icon-btn" data-sheet-close aria-label="Schließen">×</button></div>
  <div class="dp-sheet-list">${src.map((b,i)=>`<button type="button" class="dp-sheet-item ${b.classList.contains('primary')?'primary':''}" data-sheet-i="${i}"><span class="dp-sheet-ic">${b.querySelector('svg')?.outerHTML||''}</span><span class="dp-sheet-txt"><b>${escapeHtml(b.textContent.trim())}</b><small>${escapeHtml(desc[b.id]||'')}</small></span>${icon('chev','dp-sheet-chev')}</button>`).join('')}</div></div>`;
 const close=()=>{layer.classList.remove('show');document.removeEventListener('keydown',key,true);setTimeout(()=>layer.remove(),180)};
 const key=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};
 layer.addEventListener('click',e=>{if(e.target===layer)close()});
 layer.querySelectorAll('[data-sheet-close]').forEach(b=>b.onclick=close);
 layer.querySelectorAll('[data-sheet-i]').forEach(b=>b.onclick=()=>{const t=src[+b.dataset.sheetI];close();setTimeout(()=>t&&t.click(),60)});
 document.addEventListener('keydown',key,true);document.body.appendChild(layer);
 requestAnimationFrame(()=>layer.classList.add('show'));
 setTimeout(()=>layer.querySelector('.dp-sheet-item')?.focus(),60);
}
/* Arbeitsort-Eingabemaske */
function openWorkplaceModal({from,to,type,employee}={}){
 const m=document.getElementById('workplace-modal');if(!m)return;
 const today=isoDate(new Date());from=from||today;to=to||from;
 document.getElementById('workplace-date-from').value=from;document.getElementById('workplace-date-to').value=to;
 if(employee)setPersonPicker('workplace-employee',employee);
 const t=type||'Homeoffice';m.querySelectorAll('[name="wp-type"]').forEach(r=>r.checked=r.value===t);document.getElementById('workplace-type').value=t;
 m.hidden=false;m.dispatchEvent(new Event('wp-refresh'));
 if(!window.matchMedia('(pointer: coarse)').matches)setTimeout(()=>m.querySelector('[name="wp-type"]:checked')?.focus(),30);
}
function bindWorkplaceModal(m,form){
 const $=id=>document.getElementById(id),manager=['Admin','Teamleiter','Abteilungsleiter'].includes(currentRole);
 bindPersonPicker(m);
 const person=()=>manager?staff.find(p=>p[0]===$('workplace-employee')?.value):staff.find(p=>p[8]===currentUserId);
 const days=()=>{const from=$('workplace-date-from').value,to=$('workplace-date-to').value||from;if(!validDateInput(from)||!validDateInput(to)||to<from)return null;
  const out=[];let c=new Date(from+'T12:00:00');const last=new Date(to+'T12:00:00');
  while(c<=last&&out.length<400){const wd=c.getDay();if(wd!==0&&wd!==6)out.push(isoDate(c));c=addDays(c,1)}return out};
 const refresh=()=>{const type=form.querySelector('[name="wp-type"]:checked')?.value||'Homeoffice';$('workplace-type').value=type;
  $('wp-head-icon').innerHTML=icon(type==='Homeoffice'?'home':'build');$('wp-head-icon').dataset.type=type;
  const d=days(),p=person(),box=$('workplace-summary');
  if(!d){box.className='wp-summary warn';box.innerHTML=`${icon('alert')}<span>Bitte einen gültigen Zeitraum wählen („Bis“ darf nicht vor „Von“ liegen).</span>`;return}
  if(!d.length){box.className='wp-summary warn';box.innerHTML=`${icon('alert')}<span>Am Wochenende kann kein Arbeitsort eingetragen werden. Bitte einen Tag von Montag bis Freitag wählen.</span>`;$('workplace-remove').disabled=true;return}
  const name=p?.[0]||'',withDuty=d.filter(x=>assignments.some(a=>a.kind==='Dienstplan'&&!a.isAbsence&&a.employee===name&&a.date===x)).length,existing=d.filter(x=>assignments.some(a=>a.kind==='Arbeitsort'&&a.employee===name&&a.date===x)).length;
  const range=d.length===1?fmtWithWeekday(new Date(d[0]+'T12:00:00')):`${fmtShortWd(new Date(d[0]+'T12:00:00'))} – ${fmtShortWd(new Date(d[d.length-1]+'T12:00:00'))}`;
  box.className='wp-summary';box.innerHTML=`<span class="wp-sum-ic">${icon(type==='Homeoffice'?'home':'build')}</span><div><b>${escapeHtml(type)} · ${d.length} ${d.length===1?'Tag':'Tage'}</b><small>${escapeHtml(range)}</small><small>${withDuty?`Bei ${withDuty===d.length?(d.length===1?'dem':'allen')+' Dienst'+(d.length===1?'':'en'):withDuty+' von '+d.length+' Tagen'} als Hinweis sichtbar.`:'An diesen Tagen ist noch kein Dienst eingetragen.'}${existing?` ${existing} ${existing===1?'Tag wird':'Tage werden'} überschrieben.`:''}</small></div>`;
  $('workplace-remove').disabled=!existing;
 };
 const close=()=>{m.hidden=true};
 m.addEventListener('wp-refresh',refresh);
 ['close-workplace','cancel-workplace'].forEach(id=>{const b=$(id);if(b)b.onclick=close});
 m.addEventListener('click',e=>{if(e.target===m)close()});
 m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});
 form.querySelectorAll('[name="wp-type"]').forEach(r=>r.onchange=refresh);
 ['workplace-date-from','workplace-date-to','workplace-employee'].forEach(id=>{const el=$(id);if(el){el.addEventListener('change',refresh);el.addEventListener('input',refresh)}});
 $('workplace-date-from').addEventListener('change',()=>{const f=$('workplace-date-from'),t=$('workplace-date-to');if(f.value&&(!t.value||t.value<f.value)){t.value=f.value;refresh()}});
 form.querySelectorAll('[data-wp-quick]').forEach(b=>b.onclick=()=>{const t=new Date();t.setHours(12,0,0,0);let a=t,z=t;const q=b.dataset.wpQuick;
  if(q==='tomorrow'){a=addDays(t,1);while(a.getDay()===0||a.getDay()===6)a=addDays(a,1);z=a}else if(q==='week'){const ws=weekStart(t);a=ws;z=addDays(ws,4)}else if(q==='next'){const ws=addDays(weekStart(t),7);a=ws;z=addDays(ws,4)}
  $('workplace-date-from').value=isoDate(a);$('workplace-date-to').value=isoDate(z);refresh()});
 $('workplace-remove').onclick=async()=>{const p=person(),d=days();if(!p||!d)return;const set=new Set(d),hit=assignments.filter(a=>a.kind==='Arbeitsort'&&a.employee===p[0]&&set.has(a.date));if(!hit.length){toast('Im Zeitraum ist kein Arbeitsort eingetragen.');return}
  if(!await ask(`Arbeitsort von ${p[0]} an ${hit.length} ${hit.length===1?'Tag':'Tagen'} entfernen?`,'Entfernen'))return;
  pushUndo('Arbeitsort');const ids=new Set(hit.map(a=>a.id)),before=assignments;assignments=assignments.filter(a=>!ids.has(a.id));
  try{persistAssignments();audit('Gelöscht','Arbeitsort',`${p[0]} · ${hit.length} ${hit.length===1?'Tag':'Tage'}`);close();toast(hit.length===1?'Arbeitsort entfernt.':`Arbeitsort an ${hit.length} Tagen entfernt.`);render()}catch(err){assignments=before;toast('Entfernen nicht möglich.')}};
 form.onsubmit=e=>{e.preventDefault();const p=person();if(!p){toast('Der Mitarbeiter konnte nicht zugeordnet werden.');return}
  const from=$('workplace-date-from').value,to=$('workplace-date-to').value||from,type=$('workplace-type').value;
  if(!from||to<from){toast('Bitte einen gültigen Zeitraum auswählen.');return}
  if(!validDateInput(from)||!validDateInput(to)){toast(DATE_RANGE_MSG);return}
  if(Math.round((new Date(to+'T12:00:00')-new Date(from+'T12:00:00'))/86400000)+1>366){toast('Der Zeitraum darf höchstens 366 Tage umfassen.');return}
  const d=days();if(!d||!d.length){toast('Am Wochenende kann kein Arbeitsort eingetragen werden.');return}
  const team=absenceTeamFor(p)?.name||p[5]||'Ohne Team';pushUndo('Arbeitsort');const before=JSON.stringify(assignments);
  d.forEach(date=>{const entry=assignments.find(a=>a.kind==='Arbeitsort'&&a.employee===p[0]&&a.date===date);const color=type==='Homeoffice'?'#159da8':'#3979bd';if(entry){entry.shift=type;entry.team=team;entry.color=color}else assignments.push({id:makeId(),kind:'Arbeitsort',team,employee:p[0],shift:type,date,color,start:'',end:''})});
  try{persistAssignments();audit('Erstellt','Arbeitsort',`${p[0]} · ${type} · ${fmt(new Date(d[0]+'T12:00:00'))}${d.length>1?' – '+fmt(new Date(d[d.length-1]+'T12:00:00')):''}`);close();toast(d.length===1?'Arbeitsort gespeichert.':`Arbeitsort für ${d.length} Tage gespeichert.`);render()}
  catch(err){assignments=JSON.parse(before);toast('Arbeitsort konnte nicht gespeichert werden.');console.error(err)}};
}
function bindDutyActions(root=document){
 // Popover an document.body hängen, damit es nicht von Kalenderzellen abgeschnitten wird.
 root.querySelectorAll('.duty-actions').forEach(details=>{
  const summary=details.querySelector('summary'),menu=details.querySelector('.duty-actions-menu');
  if(!summary||!menu||details.dataset.bound==='1')return;
  details.dataset.bound='1';menu._dutyOwner=details;
  details.addEventListener('toggle',()=>{
   if(!details.open){if(menu.parentNode===document.body)details.appendChild(menu);menu.style.top='';menu.style.left='';return;}
   document.querySelectorAll('.duty-actions[open]').forEach(other=>{if(other!==details)other.open=false});
   if(menu.parentNode===details)document.body.appendChild(menu);
   requestAnimationFrame(()=>{if(!details.open||menu.parentNode!==document.body)return;const r=summary.getBoundingClientRect(),h=menu.offsetHeight,w=menu.offsetWidth;menu.style.top=Math.max(8,Math.min(window.innerHeight-h-8,r.bottom+4))+'px';menu.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.right-w))+'px';});
  });
 });
 const closeMenus=()=>document.querySelectorAll('.duty-actions[open]').forEach(details=>{const menu=[...document.body.children].find(m=>m._dutyOwner===details);if(menu)details.appendChild(menu);details.open=false;});
 if(!document.body.dataset.dutyOutsideCloseBound){
  document.body.dataset.dutyOutsideCloseBound='1';
  document.addEventListener('pointerdown',e=>{if(e.target.closest('.duty-actions, .duty-actions-menu'))return;closeMenus();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});
  window.addEventListener('scroll',closeMenus,true);
 }
 const menus=[...root.querySelectorAll('.duty-actions-menu')];
 menus.forEach(menu=>{
  menu.querySelectorAll('[data-copy-duty]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();closeMenus();copyToNextDay(b.dataset.copyDuty)});
  menu.querySelectorAll('[data-edit-duty]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();closeMenus();openEditDuty(b.dataset.editDuty);});
  menu.querySelectorAll('[data-swap-duty]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();closeMenus();document.getElementById('day-details-modal')?.setAttribute('hidden','');openSwapRequest(b.dataset.swapDuty)});
  menu.querySelectorAll('[data-edit-wp]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();closeMenus();const w=assignments.find(a=>String(a.id)===String(b.dataset.editWp));if(w){document.getElementById('day-details-modal')?.setAttribute('hidden','');openWorkplaceModal({from:w.date,to:w.date,type:w.shift,employee:w.employee})}});
  menu.querySelectorAll('[data-delete-duty]').forEach(b=>b.onclick=async e=>{
   e.preventDefault();e.stopPropagation();closeMenus();
   const id=b.dataset.deleteDuty,item=assignments.find(a=>String(a.id)===String(id));if(!item)return;
   const own=item.kind==='Arbeitsort'&&staff.find(p=>p[8]===currentUserId)?.[0]===item.employee;
   const absenceOk=item.isAbsence&&staff.some(p=>p[0]===item.employee&&canCreateAbsenceFor(p));
   if(!canManageTeam(item.team)&&!own&&!absenceOk&&!(!item.isAbsence&&item.kind!=='Arbeitsort'&&canEditEntry(item.team,item.employee,areaOf(item)))){toast('Du darfst Einträge dieses Teams nicht löschen.');return}
   if(!await ask(`${item.isAbsence?'Abwesenheit':item.kind==='Arbeitsort'?'Arbeitsort („'+item.shift+'“)':'Eintrag'} von ${item.employee} am ${fmt(new Date(item.date+'T12:00:00'))} wirklich löschen?`))return;
   pushUndo('Löschen');const before=assignments;assignments=assignments.filter(a=>String(a.id)!==String(id));
   try{persistAssignments();audit('Gelöscht',item.kind==='Bereitschaft'?'Bereitschaft':'Dienstplan',`${item.employee} · ${item.shift}${item.start?' '+item.start+'–'+item.end:''} · ${fmt(new Date(item.date+'T12:00:00'))}`);toast(item.kind==='Arbeitsort'?'Arbeitsort wurde entfernt.':'Eintrag wurde gelöscht.');document.getElementById('day-details-modal')?.setAttribute('hidden','');render()}
   catch(err){assignments=before;toast('Löschen nicht möglich.');console.error(err)}
  });
 });
}

/* ------------------------------------------------------------------
   Teamverwaltung
------------------------------------------------------------------ */
const MAX_TEAMS=20;// Teams können beliebig viele Mitglieder haben
let adminFilter='all',adminQuery='',adminOpenTeam='';
/* Wer darf was in der Administration? */
function adminCaps(){const ed=canEdit('Administration');
 return {all:currentRole==='Admin'||(currentRole==='Abteilungsleiter'&&!headDeptTeams()),dept:ed&&currentRole==='Admin',create:ed&&currentRole==='Admin',remove:ed&&currentRole==='Admin',structure:ed&&['Admin','Abteilungsleiter'].includes(currentRole),settings:ed,color:ed}}
function adminTeams(){return adminCaps().all?teams:settingsTeams()}
function adminDepartments(){return currentRole==='Admin'||(currentRole==='Abteilungsleiter'&&!headDeptTeams())?departments:currentRole==='Abteilungsleiter'?departments.filter(d=>d.headId===currentUserId):[]}
function teamRuleBadges(t){const st=teamSettings(t),lbl=m=>m==='all'?'alle':m==='selected'?(m==='selected'?'ausgewählte':''):'';
 return `<span class="ta-badge ${st.swap?'on':'off'}">${icon('refresh')}Tausch ${st.swap?'an':'aus'}</span>${st.selfDuty!=='none'?`<span class="ta-badge on">${icon('cal')}Dienste: ${lbl(st.selfDuty)}</span>`:''}${st.selfStandby!=='none'?`<span class="ta-badge on">${icon('moon')}Bereitschaft: ${lbl(st.selfStandby)}</span>`:''}`}
function administrationPage(){
 if(!canView('Administration'))return `${heading('Administration','Die Teamverwaltung ist für deine Benutzergruppe nicht freigegeben.')}<section class="settings-card"><p>Bitte über das Profilmenü mit einer berechtigten Rolle anmelden.</p></section>`;
 const caps=adminCaps(),mine=adminTeams();
 if(!mine.length)return `${heading('Administration','Hier verwaltest du die Einstellungen deiner Teams.')}<div class="empty-note">Dir ist derzeit kein Team als Teamleitung oder Deputy zugeordnet.</div>`;
 const members=new Set(mine.flatMap(t=>t.memberIds)),withLead=mine.filter(t=>t.leaderId).length,withDeputy=mine.filter(t=>t.deputyId).length,open=mine.filter(t=>!t.leaderId||!t.deputyId).length,swapOn=mine.filter(t=>teamSettings(t).swap).length,selfOn=mine.filter(t=>{const st=teamSettings(t);return st.selfDuty!=='none'||st.selfStandby!=='none'}).length;
 const q=adminQuery.toLowerCase();
 const list=mine.filter(t=>{const complete=t.leaderId&&t.deputyId;if(adminFilter==='complete'&&!complete)return false;if(adminFilter==='open'&&complete)return false;if(!q)return true;return t.name.toLowerCase().includes(q)||staff.some(p=>t.memberIds.includes(p[8])&&p[0].toLowerCase().includes(q))});
 const person=(id,label)=>{const p=staff.find(x=>x[8]===id);return `<div class="ta-person">${p?avatarHtml(p[0],'var(--accent-color)',26):'<span class="pp-none">–</span>'}<span><small>${label}</small><b class="${p?'':'muted'}">${p?escapeHtml(p[0]):'nicht besetzt'}</b></span></div>`};
 const cards=list.map(t=>{const mem=staff.filter(p=>t.memberIds.includes(p[8])),color=teamColor(t),complete=t.leaderId&&t.deputyId;
  return `<button type="button" class="ta-card" data-open-team="${escapeHtml(t.id)}" style="--team:${color}">
   <span class="ta-card-top"><span class="ta-mark">${escapeHtml(String(t.name).replace(/^Team\s+/,'').slice(0,2).toUpperCase())}</span><span class="ta-title"><b>${escapeHtml(t.name)}</b><small>${mem.length} ${mem.length===1?'Mitglied':'Mitglieder'}${deptOfTeam(t)?` · ${escapeHtml(deptOfTeam(t).name)}`:''}</small></span><span class="team-status ${complete?'complete':'incomplete'}">${complete?'Vollständig':!t.leaderId?'Teamleitung fehlt':'Deputy fehlt'}</span></span>
   <span class="ta-people">${person(t.leaderId,'Teamleitung')}${person(t.deputyId,'Deputy')}</span>
   <span class="ta-badges">${teamRuleBadges(t)}</span>
   <span class="ta-foot"><span class="avatar-stack">${mem.slice(0,7).map(p=>avatarHtml(p[0],color,26)).join('')}${mem.length>7?`<span class="more">+${mem.length-7}</span>`:''}</span><span class="ta-edit">${caps.settings?'Bearbeiten':'Ansehen'}${icon('chev')}</span></span></button>`});
 const cardHtml=t=>cards[list.indexOf(t)];
 const depts=adminDepartments(),grouped=depts.length>0;
 let body='';
 if(grouped){
  depts.forEach(d=>{const ts=list.filter(t=>d.teamIds.includes(t.id)),head=staff.find(p=>p[8]===d.headId);if(!ts.length&&(q||adminFilter!=='all'))return;
   body+=`<section class="dept-group" style="--dept:${d.color}"><div class="dept-head"><span class="dept-ic">${icon('build')}</span><div class="dept-title"><b>${escapeHtml(d.name)}</b><small>${d.teamIds.filter(id=>teams.some(t=>t.id===id)).length} Teams · ${new Set(teams.filter(t=>d.teamIds.includes(t.id)).flatMap(t=>t.memberIds)).size} Mitglieder</small></div>
    <div class="dept-lead">${head?avatarHtml(head[0],d.color,28):'<span class="pp-none">–</span>'}<span><small>Abteilungsleitung</small><b class="${head?'':'muted'}">${head?escapeHtml(head[0]):'nicht besetzt'}</b></span></div>${caps.dept?`<button type="button" class="btn small" data-edit-dept="${escapeHtml(d.id)}">${icon('edit')}Bearbeiten</button>`:''}</div>
    <div class="ta-grid">${ts.map(cardHtml).join('')||'<div class="empty-note">Dieser Abteilung sind noch keine Teams zugeordnet.</div>'}</div></section>`});
  const loose=list.filter(t=>!deptOfTeam(t));
  if(loose.length&&caps.all)body+=`<section class="dept-group dept-none"><div class="dept-head"><span class="dept-ic">${icon('users')}</span><div class="dept-title"><b>Ohne Abteilung</b><small>${loose.length} ${loose.length===1?'Team':'Teams'}</small></div></div><div class="ta-grid">${loose.map(cardHtml).join('')}</div></section>`;
 }else body=`${caps.dept?`<div class="dept-hint">${icon('build')}<div><b>Abteilungen</b><small>Fasse Teams zu Abteilungen zusammen und bestimme jeweils eine Abteilungsleitung.</small></div><button type="button" class="btn" id="create-dept-hint">${icon('plus')}Abteilung anlegen</button></div>`:''}<div class="ta-grid" id="team-admin-list">${cards.join('')||'<div class="empty-note">Keine Teams gefunden.</div>'}</div>`;
 if(grouped&&!body)body='<div class="empty-note">Keine Teams gefunden.</div>';
 return `${heading('Administration',caps.all?(grouped?'Abteilungen, Teams, Verantwortliche und Teamregeln an einem Ort.':'Teams, Verantwortliche, Mitglieder und Teamregeln an einem Ort.'):currentRole==='Abteilungsleiter'?`Deine ${depts.length===1?'Abteilung':'Abteilungen'} mit ${mine.length} Teams.`:`Einstellungen für ${mine.length===1?'dein Team':'deine '+mine.length+' Teams'}.`,`${caps.dept?`<button class="btn" id="create-dept">${icon('build')}Abteilung anlegen</button>`:''}${caps.create?`<button class="btn primary" id="create-team">${icon('plus')}Team anlegen</button>`:''}`)}
 <div class="stats ta-stats">
  <div class="stat-card"><div><div class="stat-label">${caps.all?'Teams':'Deine Teams'}</div><div class="stat-value">${mine.length}</div><div class="stat-note">${members.size} Mitglieder${adminDepartments().length?` · ${adminDepartments().length} ${adminDepartments().length===1?'Abteilung':'Abteilungen'}`:''}</div></div></div>
  <div class="stat-card"><div><div class="stat-label">Teamleitung &amp; Deputy</div><div class="stat-value">${Math.min(withLead,withDeputy)} / ${mine.length}</div><div class="meter ${open?'warn':''}"><i style="width:${mine.length?(mine.length-open)/mine.length*100:0}%"></i></div></div></div>
  <div class="stat-card"><div><div class="stat-label">Diensttausch aktiv</div><div class="stat-value">${swapOn} / ${mine.length}</div><div class="meter"><i style="width:${mine.length?swapOn/mine.length*100:0}%"></i></div></div></div>
  <div class="stat-card"><div><div class="stat-label">Selbst eintragen</div><div class="stat-value">${selfOn}</div><div class="stat-note">${selfOn===1?'Team erlaubt':'Teams erlauben'} eigene Einträge</div></div></div>
 </div>
 <div class="list-toolbar ta-toolbar"><label class="search-field">${icon('search')}<input id="team-search" type="search" placeholder="Team oder Person suchen …" value="${escapeHtml(adminQuery)}"></label><div class="chip-row"><button type="button" class="chip ${adminFilter==='all'?'active':''}" data-team-filter="all">Alle · ${mine.length}</button><button type="button" class="chip ${adminFilter==='complete'?'active':''}" data-team-filter="complete">Vollständig</button><button type="button" class="chip ${adminFilter==='open'?'active':''}" data-team-filter="open">Offen · ${open}</button></div></div>
 ${body}
`;
}
function bindAdministration(){
 const caps=adminCaps();
 const ts=document.getElementById('team-search');if(ts){let tm=0;ts.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{adminQuery=ts.value;const pos=ts.selectionStart;render();const n=document.getElementById('team-search');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}},180)}}
 content.querySelectorAll('[data-team-filter]').forEach(b=>b.onclick=()=>{adminFilter=b.dataset.teamFilter;render()});
 content.querySelectorAll('[data-open-team]').forEach(b=>b.onclick=()=>openTeamEditor(b.dataset.openTeam));
 content.querySelectorAll('[data-edit-dept]').forEach(b=>b.onclick=()=>openDeptEditor(b.dataset.editDept));
 ['create-dept','create-dept-hint'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=()=>openDeptEditor(null)});
 const create=document.getElementById('create-team');
 if(create)create.onclick=async()=>{if(!adminCaps().create)return;const name=(await askText('Name des neuen Teams:')).trim();if(!name)return;if(teams.length>=MAX_TEAMS){toast(`Es sind maximal ${MAX_TEAMS} Teams möglich.`);return}if(teams.some(t=>t.name.toLowerCase()===name.toLowerCase())){toast('Ein Team mit diesem Namen existiert bereits.');return}const t={id:makeId(),name:name.slice(0,60),memberIds:[],leaderId:'',deputyId:'',standbyColor:'#159da8'};teams.push(t);persistTeams();audit('Erstellt','Teams',t.name,{title:'Team angelegt',object:t.name});render();toast('Team angelegt.');openTeamEditor(t.id,'members')};
 if(adminOpenTeam){const id=adminOpenTeam;adminOpenTeam='';if(adminTeams().some(t=>t.id===id))setTimeout(()=>openTeamEditor(id),0)}
}
/* Abteilung anlegen / bearbeiten (nur Admin) */
function openDeptEditor(id){
 if(!adminCaps().dept){toast('Abteilungen kann nur ein Admin verwalten.');return}
 const ex=id?departments.find(d=>d.id===id):null;if(id&&!ex){toast('Die Abteilung wurde nicht gefunden.');return}
 const d={name:ex?ex.name:'',headId:ex?ex.headId:'',color:ex?ex.color:'#0068A8',teamIds:ex?[...ex.teamIds]:[]};const orig=JSON.stringify(d);
 const layer=document.createElement('div');layer.className='modal-backdrop app-dialog';
 const nameOf=pid=>staff.find(p=>p[8]===pid)?.[0]||'';
 const draw=()=>{const people=[...staff].filter(p=>(p[10]||'Mitarbeiter')==='Abteilungsleiter'||p[8]===d.headId).sort((a,b)=>a[0].localeCompare(b[0],'de')).map(p=>({name:p[0],sub:(p[10]||'Mitarbeiter')+(departments.some(x=>x.id!==id&&x.headId===p[8])?' · leitet bereits '+departments.filter(x=>x.id!==id&&x.headId===p[8]).map(x=>x.name).join(', '):'')}));
  const head=staff.find(p=>p[8]===d.headId);
  layer.innerHTML=`<div class="modal te-modal dept-modal" role="dialog" aria-modal="true" aria-labelledby="dp-title" style="--team:${d.color}">
  <div class="te-head"><span class="ta-mark">${icon('build')}</span><div><h2 id="dp-title">${ex?escapeHtml(d.name||'Abteilung'):'Abteilung anlegen'}</h2><p class="small muted">${d.teamIds.length} ${d.teamIds.length===1?'Team':'Teams'} · Leitung: ${escapeHtml(nameOf(d.headId)||'—')}</p></div><button class="icon-btn" type="button" data-dp-close aria-label="Schließen">×</button></div>
  <div class="te-body"><div class="te-sec">
   <label class="wp-field"><span class="wp-label">Name der Abteilung</span><input id="dp-name" value="${escapeHtml(d.name)}" maxlength="60" placeholder="z. B. Technik"></label>
   <div class="wp-field"><span class="wp-label">Farbe</span><div class="te-colors">${TEAM_COLORS.map(c=>`<button type="button" class="te-swatch ${c.toLowerCase()===d.color.toLowerCase()?'on':''}" style="--c:${c}" data-color="${c}" aria-label="Farbe ${c}">${icon('check')}</button>`).join('')}</div></div>
   <div class="wp-field"><span class="wp-label">Abteilungsleitung</span>${personPicker({id:'dp-head',people,value:nameOf(d.headId),noneLabel:'Nicht besetzt',placeholder:'Nicht besetzt',empty:'Keine Abteilungsleiter gefunden'})}
    ${people.length?`<small class="muted">Zur Auswahl stehen alle Personen mit der Rolle „Abteilungsleiter“.</small>`:`<small class="dept-note">${icon('alert')}Es gibt noch keine Person mit der Rolle „Abteilungsleiter“. Die Rolle vergibst du unter „Kontakte“.</small>`}</div>
   <div class="wp-field"><span class="wp-label">Teams dieser Abteilung <span class="pill teal" id="dp-count">${d.teamIds.length} ausgewählt</span></span>
    <div class="ts-list dept-teams">${teams.map(t=>{const other=departments.find(x=>x.id!==id&&x.teamIds.includes(t.id));return `<label class="ts-person"><input type="checkbox" data-dt="${escapeHtml(t.id)}" ${d.teamIds.includes(t.id)?'checked':''}><span class="swap-check-box">${icon('check')}</span><span class="ta-mark sm" style="--team:${teamColor(t)}">${escapeHtml(String(t.name).replace(/^Team\s+/,'').slice(0,2).toUpperCase())}</span><span class="pp-txt"><b>${escapeHtml(t.name)}</b><small>${t.memberIds.length} Mitglieder${other?` · derzeit in ${escapeHtml(other.name)} – wird verschoben`:''}</small></span></label>`}).join('')}</div></div>
  </div></div>
  <div class="te-foot">${ex?`<button type="button" class="btn ghost danger-text" id="dp-delete">${icon('trash')}Abteilung löschen</button>`:'<span></span>'}<span class="wp-actions-right"><button type="button" class="btn" data-dp-close>Abbrechen</button><button type="button" class="btn primary" id="dp-save">${icon('check')}${ex?'Speichern':'Anlegen'}</button></span></div></div>`;
  bind()};
 const close=async force=>{if(!force&&JSON.stringify(d)!==orig&&!await ask('Ungespeicherte Änderungen verwerfen?','Verwerfen'))return;layer.remove();document.removeEventListener('keydown',key,true)};
 const key=e=>{if(e.key!=='Escape'||layer.querySelector('.pp.open')||[...document.querySelectorAll('.app-dialog')].pop()!==layer)return;e.stopPropagation();close()};
 const bind=()=>{
  layer.querySelectorAll('[data-dp-close]').forEach(b=>b.onclick=()=>close());
  const nm=layer.querySelector('#dp-name');nm.oninput=()=>{d.name=nm.value};
  layer.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{d.color=b.dataset.color;draw()});
  bindPersonPicker(layer);
  layer.querySelector('#dp-head').addEventListener('change',e=>{d.headId=staff.find(p=>p[0]===e.target.value)?.[8]||'';draw()});
  layer.querySelectorAll('[data-dt]').forEach(c=>c.onchange=()=>{d.teamIds=c.checked?[...new Set([...d.teamIds,c.dataset.dt])]:d.teamIds.filter(x=>x!==c.dataset.dt);layer.querySelector('#dp-count').textContent=`${d.teamIds.length} ausgewählt`});
  const del=layer.querySelector('#dp-delete');if(del)del.onclick=async()=>{if(!await ask(`Abteilung „${ex.name}“ löschen? Die Teams bleiben erhalten und sind danach keiner Abteilung zugeordnet.`,'Löschen'))return;
   departments=departments.filter(x=>x.id!==ex.id);persistDepartments();audit('Gelöscht','Administration',`Abteilung ${ex.name}`,{title:'Abteilung gelöscht',object:ex.name});close(true);render();toast('Abteilung gelöscht.')};
  layer.querySelector('#dp-save').onclick=()=>{const name=d.name.trim();
   if(!name){toast('Bitte einen Namen für die Abteilung eingeben.');layer.querySelector('#dp-name').focus();return}
   if(departments.some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase())){toast('Eine Abteilung mit diesem Namen existiert bereits.');return}
   {const hp=staff.find(p=>p[8]===d.headId);if(hp&&(hp[10]||'Mitarbeiter')!=='Abteilungsleiter'&&d.headId!==(ex?ex.headId:'')){toast('Als Abteilungsleitung sind nur Personen mit der Rolle „Abteilungsleiter“ möglich.');return}}
   const snapD=JSON.stringify(departments),snapS=JSON.stringify(staff);
   try{
    departments.forEach(x=>{if(x.id!==id)x.teamIds=x.teamIds.filter(t=>!d.teamIds.includes(t))});
    let dep=ex;if(!dep){dep={id:makeId()};departments.push(dep)}
    Object.assign(dep,{name:name.slice(0,60),headId:d.headId,color:d.color,teamIds:d.teamIds.filter(t=>teams.some(x=>x.id===t))});
    const roleMsg='';
    persistDepartments();
    audit(ex?'Geändert':'Erstellt','Administration',`Abteilung ${dep.name} · ${dep.teamIds.length} Teams · Leitung: ${nameOf(dep.headId)||'—'}`,{title:ex?'Abteilung geändert':'Abteilung angelegt',object:dep.name});
    close(true);render();toast((ex?'Abteilung gespeichert.':'Abteilung angelegt.')+roleMsg);
   }catch(e){departments=JSON.parse(snapD);staff=JSON.parse(snapS);toast('Speichern nicht möglich.')}};
 };
 layer.addEventListener('mousedown',e=>{if(e.target===layer)layer.dataset.down='1'});
 layer.addEventListener('click',e=>{if(e.target===layer&&layer.dataset.down)close();delete layer.dataset.down});
 document.addEventListener('keydown',key,true);
 document.body.appendChild(layer);draw();
 setTimeout(()=>layer.querySelector('#dp-name')?.focus(),30);
}
const TEAM_COLORS=['#14A1A9','#0068A8','#2f8f5b','#d4880f','#c2412d','#8a4fbf','#d0508a','#596579','#1f3f7a','#7b8f32'];
function openTeamEditor(id,startTab){
 const t=teamById(id);if(!t||!adminTeams().includes(t)){toast('Dieses Team kannst du nicht öffnen.');return}
 const caps=adminCaps(),st=teamSettings(t);
 const d={name:t.name,color:teamColor(t),memberIds:[...t.memberIds],leaderId:t.leaderId||'',deputyId:t.deputyId||'',...st,selfDutyIds:[...st.selfDutyIds],selfStandbyIds:[...st.selfStandbyIds]};
 const orig=JSON.stringify(d);let tab=startTab||'general';
 const layer=document.createElement('div');layer.className='modal-backdrop app-dialog';
 const ro=x=>x?'':'disabled';
 const mem=()=>staff.filter(p=>d.memberIds.includes(p[8])).sort((a,b)=>a[0].localeCompare(b[0],'de'));
 const nameOf=id=>staff.find(p=>p[8]===id)?.[0]||'';
 const general=()=>`<div class="te-sec"><label class="wp-field"><span class="wp-label">Teamname</span><input id="te-name" value="${escapeHtml(d.name)}" maxlength="60" ${ro(caps.structure)}></label>
   <div class="wp-field"><span class="wp-label">Teamfarbe</span><div class="te-colors">${TEAM_COLORS.map(c=>`<button type="button" class="te-swatch ${c.toLowerCase()===d.color.toLowerCase()?'on':''}" style="--c:${c}" data-color="${c}" aria-label="Farbe ${c}" ${ro(caps.color)}>${icon('check')}</button>`).join('')}<label class="te-custom" title="Eigene Farbe"><input type="color" id="te-color" value="${/^#[0-9a-f]{6}$/i.test(d.color)?d.color:'#14a1a9'}" ${ro(caps.color)}><span>Eigene</span></label></div></div>
   <div class="te-two"><div class="wp-field"><span class="wp-label">Teamleitung</span>${caps.structure?personPicker({id:'te-lead',people:mem().map(p=>({name:p[0],sub:p[10]||'Mitarbeiter'})),value:nameOf(d.leaderId),noneLabel:'Nicht besetzt',placeholder:'Nicht besetzt'}):`<div class="wp-me">${d.leaderId?avatarHtml(nameOf(d.leaderId),'var(--accent-color)',30):''}<div><b>${escapeHtml(nameOf(d.leaderId)||'Nicht besetzt')}</b></div></div>`}</div>
   <div class="wp-field"><span class="wp-label">Deputy</span>${caps.structure?personPicker({id:'te-dep',people:mem().map(p=>({name:p[0],sub:p[10]||'Mitarbeiter'})),value:nameOf(d.deputyId),noneLabel:'Nicht besetzt',placeholder:'Nicht besetzt'}):`<div class="wp-me">${d.deputyId?avatarHtml(nameOf(d.deputyId),'var(--accent-color)',30):''}<div><b>${escapeHtml(nameOf(d.deputyId)||'Nicht besetzt')}</b></div></div>`}</div></div>
   ${caps.structure?'<small class="muted">Teamleitung und Deputy werden aus den Mitgliedern gewählt. Ein Deputy kann nur einem Team zugeordnet sein.</small>':'<small class="muted">Name, Verantwortliche und Mitglieder ändert die Administration.</small>'}</div>`;
 const members=()=>{if(!caps.structure){const m=mem();return `<div class="te-sec"><div class="te-mhead"><label class="team-dd-search">${icon('search')}<input type="search" id="te-mq" placeholder="Mitarbeiter suchen …"></label><span class="pill teal" id="te-mcount">${m.length} im Team</span></div>
   <div class="ts-list te-mlist te-ro">${m.map(p=>{const role=d.leaderId===p[8]?'Teamleitung':d.deputyId===p[8]?'Deputy':'';return `<div class="ts-person" data-q="${escapeHtml(p[0].toLowerCase())}">${avatarHtml(p[0],d.color,28)}<span class="pp-txt"><b>${escapeHtml(p[0])}</b><small>${escapeHtml(p[10]||'Mitarbeiter')}</small></span>${role?`<span class="pill ${role==='Deputy'?'blue':'teal'}">${role}</span>`:''}</div>`}).join('')||'<div class="empty-note">Noch keine Mitglieder.</div>'}</div>
   <small class="muted">${icon('lock')} Mitglieder kann nur die Administration (Admin/Abteilungsleitung) ändern.</small></div>`}
  const people=staff.slice().sort((a,b)=>Number(d.memberIds.includes(b[8]))-Number(d.memberIds.includes(a[8]))||a[0].localeCompare(b[0],'de'));
  return `<div class="te-sec"><div class="te-mhead"><label class="team-dd-search">${icon('search')}<input type="search" id="te-mq" placeholder="Mitarbeiter suchen …"></label><span class="pill teal" id="te-mcount">${d.memberIds.length} im Team</span></div>
   <div class="ts-list te-mlist">${people.map(p=>{const other=teams.filter(o=>o.id!==t.id&&o.memberIds.includes(p[8])).map(o=>o.name).join(', '),on=d.memberIds.includes(p[8]),role=d.leaderId===p[8]?'Teamleitung':d.deputyId===p[8]?'Deputy':'';
    return `<label class="ts-person" data-q="${escapeHtml(p[0].toLowerCase())}"><input type="checkbox" data-mem="${escapeHtml(p[8])}" ${on?'checked':''} ${ro(caps.structure)}><span class="swap-check-box">${icon('check')}</span>${avatarHtml(p[0],d.color,28)}<span class="pp-txt"><b>${escapeHtml(p[0])}</b><small>${escapeHtml(other?'auch in '+other:(p[10]||'Mitarbeiter'))}</small></span>${role?`<span class="pill ${role==='Deputy'?'blue':'teal'}">${role}</span>`:''}</label>`}).join('')}</div></div>`};
 const block=(key,title,desc,ic)=>{const mode=d[key],ids=d[key+'Ids'],m=mem();
  return `<section class="ts-block"><div class="ts-block-head"><span class="ts-ic">${icon(ic)}</span><div><b>${title}</b><small>${desc}</small></div></div>
   <div class="seg swap-mode ts-seg" role="radiogroup"><label><input type="radio" name="${key}" value="none" ${mode==='none'?'checked':''} ${ro(caps.settings)}><span>Niemand</span></label><label><input type="radio" name="${key}" value="all" ${mode==='all'?'checked':''} ${ro(caps.settings)}><span>Alle im Team</span></label><label><input type="radio" name="${key}" value="selected" ${mode==='selected'?'checked':''} ${ro(caps.settings)}><span>Ausgewählte</span></label></div>
   ${mode==='selected'?`<div class="ts-people"><div class="ts-list">${m.map(p=>`<label class="ts-person"><input type="checkbox" data-key="${key}" value="${escapeHtml(p[8])}" ${ids.includes(p[8])?'checked':''} ${ro(caps.settings)}><span class="swap-check-box">${icon('check')}</span>${avatarHtml(p[0],d.color,26)}<span class="pp-txt"><b>${escapeHtml(p[0])}</b></span></label>`).join('')||'<div class="empty-note">Noch keine Mitglieder.</div>'}</div></div>`:`<p class="ts-note">${mode==='all'?`Alle ${m.length} Mitglieder dürfen ihre eigenen Einträge anlegen, ändern und löschen.`:'Nur Teamleitung und Deputy tragen ein.'}</p>`}</section>`};
 const rules=()=>`<div class="te-sec"><section class="ts-block"><div class="ts-block-head"><span class="ts-ic">${icon('refresh')}</span><div><b>Diensttausch</b><small>Mitarbeiter können Dienste untereinander tauschen – erst nach Bestätigung der Kollegin bzw. des Kollegen.</small></div><label class="ts-switch"><input type="checkbox" id="ts-swap" ${d.swap?'checked':''} ${ro(caps.settings)}><span class="ts-track"><span></span></span><b class="sr-only">Diensttausch aktiv</b></label></div><p class="ts-note">${d.swap?'Aktiviert – der Button „Diensttausch“ ist im Dienstplan sichtbar.':'Deaktiviert – in diesem Team sind keine Tauschanfragen möglich.'}</p></section>
   ${block('selfDuty','Dienste selbst eintragen','Wer eigene Dienste im Dienstplan anlegen und bearbeiten darf.','cal')}
   ${block('selfStandby','Bereitschaft selbst eintragen','Wer eigene Bereitschaften anlegen und bearbeiten darf.','moon')}</div>`;
 const tabs=[['general','Allgemein'],['members','Mitglieder'],['rules','Teamregeln']];
 const draw=()=>{const body=tab==='general'?general():tab==='members'?members():rules();
  layer.innerHTML=`<div class="modal te-modal" role="dialog" aria-modal="true" aria-labelledby="te-title" style="--team:${d.color}">
  <div class="te-head"><span class="ta-mark">${escapeHtml(String(d.name||'?').replace(/^Team\s+/,'').slice(0,2).toUpperCase())}</span><div><h2 id="te-title">${escapeHtml(d.name||'Team')}</h2><p class="small muted">${deptOfTeam(t)?`${escapeHtml(deptOfTeam(t).name)} · `:''}${d.memberIds.length} Mitglieder · TL: ${escapeHtml(nameOf(d.leaderId)||'—')} · Deputy: ${escapeHtml(nameOf(d.deputyId)||'—')}</p></div><button class="icon-btn" type="button" data-te-close aria-label="Schließen">×</button></div>
  <div class="te-tabs" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" class="${tab===k?'active':''}" aria-selected="${tab===k}" data-te-tab="${k}">${l}${k==='members'?` <span class="te-n">${d.memberIds.length}</span>`:''}</button>`).join('')}</div>
  <div class="te-body">${body}</div>
  <div class="te-foot">${caps.remove?`<button type="button" class="btn ghost danger-text" id="te-delete">${icon('trash')}Team löschen</button>`:'<span></span>'}<span class="wp-actions-right"><button type="button" class="btn" data-te-close>${caps.settings?'Abbrechen':'Schließen'}</button>${caps.settings?`<button type="button" class="btn primary" id="te-save">${icon('check')}Speichern</button>`:''}</span></div></div>`;
  bind()};
 const close=async(force)=>{if(!force&&caps.settings&&JSON.stringify(d)!==orig&&!await ask('Ungespeicherte Änderungen verwerfen?','Verwerfen'))return;layer.remove();document.removeEventListener('keydown',key,true)};
 const key=e=>{if(e.key!=='Escape'||layer.querySelector('.pp.open')||[...document.querySelectorAll('.app-dialog')].pop()!==layer)return;e.stopPropagation();close()};
 const bind=()=>{
  layer.querySelectorAll('[data-te-close]').forEach(b=>b.onclick=()=>close());
  layer.querySelectorAll('[data-te-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.teTab;draw();layer.querySelector(`[data-te-tab="${tab}"]`)?.focus()});
  const nm=layer.querySelector('#te-name');if(nm)nm.oninput=()=>{d.name=nm.value;const h=layer.querySelector('#te-title');if(h)h.textContent=nm.value||'Team'};
  layer.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{d.color=b.dataset.color;draw()});
  const cc=layer.querySelector('#te-color');if(cc)cc.onchange=()=>{d.color=cc.value;draw()};
  bindPersonPicker(layer);
  const lp=layer.querySelector('#te-lead');if(lp)lp.addEventListener('change',()=>{const id=staff.find(p=>p[0]===lp.value)?.[8]||'';if(id&&id===d.deputyId)d.deputyId='';d.leaderId=id;draw()});
  const dp=layer.querySelector('#te-dep');if(dp)dp.addEventListener('change',()=>{const id=staff.find(p=>p[0]===dp.value)?.[8]||'';if(id&&teams.some(o=>o.id!==t.id&&o.deputyId===id)){toast('Ein Deputy kann nur einem einzigen Team zugeordnet werden.');draw();return}if(id&&id===d.leaderId)d.leaderId='';d.deputyId=id;draw()});
  const mq=layer.querySelector('#te-mq');if(mq)mq.oninput=()=>{const v=mq.value.trim().toLowerCase();layer.querySelectorAll('.te-mlist .ts-person').forEach(l=>l.hidden=!!v&&!l.dataset.q.includes(v))};
  if(caps.structure)layer.querySelectorAll('[data-mem]').forEach(c=>c.onchange=()=>{const id=c.dataset.mem;if(c.checked)d.memberIds=[...new Set([...d.memberIds,id])];else{d.memberIds=d.memberIds.filter(x=>x!==id);if(d.leaderId===id)d.leaderId='';if(d.deputyId===id)d.deputyId='';d.selfDutyIds=d.selfDutyIds.filter(x=>x!==id);d.selfStandbyIds=d.selfStandbyIds.filter(x=>x!==id)}
   layer.querySelector('#te-mcount').textContent=`${d.memberIds.length} im Team`;const n=layer.querySelector('.te-n');if(n)n.textContent=d.memberIds.length});
  const sw=layer.querySelector('#ts-swap');if(sw)sw.onchange=()=>{d.swap=sw.checked;draw()};
  layer.querySelectorAll('.ts-seg input').forEach(r=>r.onchange=()=>{d[r.name]=r.value;draw()});
  layer.querySelectorAll('.ts-person input[data-key]').forEach(c=>c.onchange=()=>{const k=c.dataset.key+'Ids';d[k]=c.checked?[...new Set([...d[k],c.value])]:d[k].filter(x=>x!==c.value)});
  const del=layer.querySelector('#te-delete');if(del)del.onclick=async()=>{if(!adminCaps().remove)return;if(!await ask(`Team „${t.name}“ wirklich löschen? Zugeordnete Dienstzeiten werden ebenfalls entfernt.`,'Löschen'))return;
   teams=teams.filter(x=>x.id!==t.id);shiftTypes=shiftTypes.filter(x=>x.team!==t.name);calendarTeams=calendarTeams.filter(x=>x!==t.name);departments.forEach(dp=>dp.teamIds=dp.teamIds.filter(x=>x!==t.id));persistTeams();persistDepartments();save('dienstplanShiftTypes',shiftTypes);audit('Gelöscht','Teams',t.name,{title:'Team gelöscht',object:t.name,before:`${t.memberIds.length} Mitglieder`});close(true);render();toast('Team gelöscht.')};
  const sv=layer.querySelector('#te-save');if(sv)sv.onclick=()=>{
   const c=adminCaps();if(!c.settings||!adminTeams().includes(t)){toast('Du darfst dieses Team nicht ändern.');return}
   const name=d.name.trim();
   if(c.structure){if(!name){toast('Bitte einen Teamnamen eingeben.');tab='general';draw();return}
    if(teams.some(o=>o.id!==t.id&&o.name.toLowerCase()===name.toLowerCase())){toast('Ein Team mit diesem Namen existiert bereits.');tab='general';draw();return}
    if(d.leaderId&&d.leaderId===d.deputyId){toast('Teamleitung und Deputy müssen verschiedene Personen sein.');return}
    if(d.deputyId&&teams.some(o=>o.id!==t.id&&o.deputyId===d.deputyId)){toast('Ein Deputy kann nur einem einzigen Team zugeordnet werden.');return}}
   const memSet=new Set(c.structure?d.memberIds:t.memberIds);
   const snap=JSON.stringify(t);const before=`${t.name} · ${t.memberIds.length} Mitglieder · TL: ${nameOf(t.leaderId)||'—'} · DP: ${nameOf(t.deputyId)||'—'}`;
   try{
    if(c.structure){
     if(name!==t.name){const old=t.name;assignments.forEach(a=>{if(a.team===old)a.team=name});shiftTypes.forEach(x=>{if(x.team===old)x.team=name});staff.forEach(p=>{if(p[5]===old)p[5]=name});calendarTeams=calendarTeams.map(x=>x===old?name:x);persistAssignments();save('dienstplanShiftTypes',shiftTypes);persistStaff();t.name=name}
     t.memberIds=[...d.memberIds];t.leaderId=d.leaderId;t.deputyId=d.deputyId}
    if(c.color)t.standbyColor=d.color;
    t.settings={swap:d.swap,selfDuty:d.selfDuty,selfDutyIds:d.selfDutyIds.filter(x=>memSet.has(x)),selfStandby:d.selfStandby,selfStandbyIds:d.selfStandbyIds.filter(x=>memSet.has(x))};
    persistTeams();
   }catch(e){Object.assign(t,JSON.parse(snap));toast('Speichern nicht möglich.');return}
   const lbl=m=>({none:'niemand',all:'alle',selected:'ausgewählte'})[m];
   audit('Geändert','Teams',t.name,{title:'Team geändert',object:t.name,before,after:`${t.name} · ${t.memberIds.length} Mitglieder · TL: ${nameOf(t.leaderId)||'—'} · DP: ${nameOf(t.deputyId)||'—'} · Tausch ${d.swap?'an':'aus'} · Dienste selbst: ${lbl(d.selfDuty)} · Bereitschaft selbst: ${lbl(d.selfStandby)}`});
   close(true);toast(`${t.name} gespeichert.`);render()};
 };
 layer.addEventListener('mousedown',e=>{if(e.target===layer)layer.dataset.down='1'});
 layer.addEventListener('click',e=>{if(e.target===layer&&layer.dataset.down)close();delete layer.dataset.down});
 document.addEventListener('keydown',key,true);
 document.body.appendChild(layer);draw();
 setTimeout(()=>layer.querySelector('.te-tabs button.active')?.focus(),30);
}

/* ------------------------------------------------------------------
   Berichte / Export
------------------------------------------------------------------ */
let reportTeam='Alle Teams',reportMember='Alle Mitarbeiter',reportKinds=['Dienst','Bereitschaft','Abwesenheit','Arbeitsort'],reportSel=new Set(),reportPage=0;
const REPORT_PAGE=25;
const kindLabel=a=>a.isAbsence?'Abwesenheit':a.kind==='Dienstplan'?'Dienst':a.kind;
function reportRows(){
 return assignments.filter(a=>(reportTeam==='Alle Teams'||a.team===reportTeam)&&(reportMember==='Alle Mitarbeiter'||a.employee===reportMember)&&reportKinds.includes(kindLabel(a))&&(!reportFrom||a.date>=reportFrom)&&(!reportTo||a.date<=reportTo)&&(['Admin','Abteilungsleiter','Lohnverrechnung'].includes(currentRole)||currentUserTeamNames().includes(a.team))).sort((a,b)=>b.date.localeCompare(a.date)||(a.start||'').localeCompare(b.start||'')||a.employee.localeCompare(b.employee));
}
const rangeText=()=>`${reportFrom?fmtIsoDate(reportFrom):'…'} – ${reportTo?fmtIsoDate(reportTo):'…'}`;
const entryRow=a=>[fmtIsoDate(a.date),a.employee,a.team,kindLabel(a),a.shift,a.groupName||'',a.start||'',a.end||'',a.start&&a.end&&!a.isAbsence?+netHours(a).toFixed(2):'',a.note||''];
const ENTRY_HEAD=['Datum','Mitarbeiter','Team','Art','Dienst','Gruppe','Beginn','Ende','Stunden (netto)','Bemerkung'];
function exportGuard(report,format){if(canEdit('Berichte / Export'))return true;logExport(report,format,0,'Verweigert',{range:rangeText()});toast('Keine Berechtigung zum Exportieren. Der Versuch wurde protokolliert.');return false}
function hoursPerEmployee(list){const map={};list.forEach(a=>{const m=map[a.employee]=map[a.employee]||{team:a.team,dn:0,dh:0,sn:0,sh:0,abs:0,vac:0};if(a.isAbsence){m.abs++;if(String(a.shift).startsWith('Urlaub'))m.vac+=a.shift==='Urlaub 1/2 Tag'?0.5:1}else if(a.kind==='Dienstplan'){m.dn++;m.dh+=netHours(a)}else if(a.kind==='Bereitschaft'){m.sn++;m.sh+=durationHours(a.start,a.end)}});return Object.entries(map).sort((a,b)=>a[1].team.localeCompare(b[1].team)||a[0].localeCompare(b[0]))}
const REPORT_TEMPLATES=[
 {id:'payroll',icon:'file',title:'Monatsbericht Lohnverrechnung',sub:'Stunden je Mitarbeiter · XLSX',run:list=>{const rows=hoursPerEmployee(list).map(([n,m])=>[n,m.team,m.dn,+m.dh.toFixed(2),m.sn,+m.sh.toFixed(2),m.vac,m.abs]);if(!rows.length)return 0;saveFile(`lohnverrechnung-${reportFrom}_${reportTo}.xlsx`,makeXlsx('Lohnverrechnung',[['Mitarbeiter','Team','Dienste','Dienststunden (netto)','Bereitschaften','Bereitschaftsstunden','Urlaubstage','Abwesenheitstage gesamt'],...rows]));return {n:rows.length,f:'XLSX'}}},
 {id:'standby',icon:'moon',title:'Bereitschaftsabrechnung',sub:'Bereitschaftsstunden je Team · PDF',run:list=>{const sb=list.filter(a=>a.kind==='Bereitschaft');const map={};sb.forEach(a=>{const k=a.team+'|'+a.employee;const m=map[k]=map[k]||{team:a.team,emp:a.employee,days:0,h:0};m.days++;m.h+=durationHours(a.start,a.end)});const rows=Object.values(map).sort((a,b)=>a.team.localeCompare(b.team)||a.emp.localeCompare(b.emp)).map(m=>[m.team,m.emp,m.days,m.h.toLocaleString(LOC(),{maximumFractionDigits:1})+' h']);if(!rows.length)return 0;const tot=Object.values(map).reduce((s,m)=>s+m.h,0);rows.push(['Gesamt','',sb.length,tot.toLocaleString(LOC(),{maximumFractionDigits:1})+' h']);saveFile(`bereitschaftsabrechnung-${reportFrom}_${reportTo}.pdf`,makePdf('Bereitschaftsabrechnung',`Zeitraum ${rangeText()} · ${reportTeam}`,['Team','Mitarbeiter','Tage','Stunden'],rows,[3,4,1.2,1.5]));return {n:rows.length,f:'PDF'}}},
 {id:'absence',icon:'plane',title:'Abwesenheitsübersicht',sub:'Urlaub & Abwesenheiten · CSV',run:list=>{const ab=list.filter(a=>a.isAbsence).sort((a,b)=>a.employee.localeCompare(b.employee)||a.date.localeCompare(b.date));if(!ab.length)return 0;downloadCsv([['Mitarbeiter','Team','Datum','Art','Von','Bis','Bemerkung'],...ab.map(a=>[a.employee,a.team,fmtIsoDate(a.date),a.shift,a.start||'',a.end||'',a.note||''])],`abwesenheiten-${reportFrom}_${reportTo}.csv`);return {n:ab.length,f:'CSV'}}},
 {id:'hours',icon:'clock',title:'Stunden je Mitarbeiter',sub:'Dienst- & Bereitschaftsstunden · CSV',run:list=>{const rows=hoursPerEmployee(list).map(([n,m])=>[n,m.team,m.dh.toLocaleString(LOC(),{maximumFractionDigits:2}),m.sh.toLocaleString(LOC(),{maximumFractionDigits:2}),m.abs]);if(!rows.length)return 0;downloadCsv([['Mitarbeiter','Team','Dienststunden','Bereitschaftsstunden','Abwesenheitstage'],...rows],`stunden-je-mitarbeiter-${reportFrom}_${reportTo}.csv`);return {n:rows.length,f:'CSV'}}}
];
function reportExportPage(){
 if(!reportFrom&&!reportTo){const d=new Date();reportFrom=isoDate(new Date(d.getFullYear(),d.getMonth(),1));reportTo=isoDate(new Date(d.getFullYear(),d.getMonth()+1,0));}
 const filtered=reportRows(),ids=new Set(filtered.map(a=>a.id));reportSel.forEach(id=>{if(!ids.has(id))reportSel.delete(id)});
 const pages=Math.max(1,Math.ceil(filtered.length/REPORT_PAGE));reportPage=Math.min(reportPage,pages-1);
 const shown=filtered.slice(reportPage*REPORT_PAGE,(reportPage+1)*REPORT_PAGE);
 const duties=filtered.filter(a=>a.kind==='Dienstplan'&&!a.isAbsence),sbs=filtered.filter(a=>a.kind==='Bereitschaft'),abs=filtered.filter(a=>a.isAbsence);
 const dutyHours=duties.reduce((s,a)=>s+netHours(a),0),standbyHours=sbs.reduce((s,a)=>s+durationHours(a.start,a.end),0),people=new Set(duties.map(a=>a.employee)).size;
 const vac=abs.filter(a=>String(a.shift).startsWith('Urlaub')).length;
 const nf=v=>v.toLocaleString(LOC(),{maximumFractionDigits:1});
 const d=new Date(),ws=weekStart(d),q={week:[isoDate(ws),isoDate(addDays(ws,6))],month:[isoDate(new Date(d.getFullYear(),d.getMonth(),1)),isoDate(new Date(d.getFullYear(),d.getMonth()+1,0))],last:[isoDate(new Date(d.getFullYear(),d.getMonth()-1,1)),isoDate(new Date(d.getFullYear(),d.getMonth(),0))]};
 const isQ=k=>reportFrom===q[k][0]&&reportTo===q[k][1];
 const members=staff.filter(s=>reportTeam==='Alle Teams'||teams.some(t=>t.name===reportTeam&&t.memberIds.includes(s[8])));
 const allChecked=shown.length&&shown.every(a=>reportSel.has(a.id));
 return `${heading('Berichte / Export','Auswertungen erstellen und Dienst- und Bereitschaftsdaten exportieren.',`<button class="btn" id="export-pdf">${icon('file')}PDF</button><button class="btn" id="export-xlsx">${icon('file')}Excel</button><button class="btn primary" id="export-all">${icon('download')}Alle exportieren (CSV)</button>`)}
 <section class="panel filter-panel report-filters">
  <span class="date-range">${icon('cal')}<input type="date" id="report-from" value="${reportFrom}" aria-label="Von"><span>–</span><input type="date" id="report-to" value="${reportTo}" aria-label="Bis"></span>
  <button type="button" class="chip ${isQ('week')?'active':''}" data-range="week">Diese Woche</button><button type="button" class="chip ${isQ('month')?'active':''}" data-range="month">Dieser Monat</button><button type="button" class="chip ${isQ('last')?'active':''}" data-range="last">Letzter Monat</button>
  <span class="vsep"></span>
  <select class="chip-select ${reportTeam!=='Alle Teams'?'active':''}" id="report-team"><option value="Alle Teams">Alle Teams</option>${teamNames().map(t=>`<option value="${escapeHtml(t)}" ${reportTeam===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select>
  <select class="chip-select ${reportMember!=='Alle Mitarbeiter'?'active':''}" id="report-member"><option value="Alle Mitarbeiter">Alle Mitarbeiter</option>${members.map(m=>`<option value="${escapeHtml(m[0])}" ${reportMember===m[0]?'selected':''}>${escapeHtml(m[0])}</option>`).join('')}</select>
  ${['Dienst','Bereitschaft','Abwesenheit','Arbeitsort'].map(k=>`<button type="button" class="chip ${reportKinds.includes(k)?'active':''}" data-kind="${k}">${k}</button>`).join('')}
 </section>
 <div class="stats">
  <div class="stat-card"><div><div class="stat-label">Einträge</div><div class="stat-value">${filtered.length.toLocaleString(LOC())}</div><div class="stat-note">im gewählten Zeitraum</div></div></div>
  <div class="stat-card"><div><div class="stat-label">Dienststunden</div><div class="stat-value">${nf(dutyHours)} h</div><div class="stat-note">Ø ${nf(people?dutyHours/people:0)} h je Mitarbeiter · netto</div></div></div>
  <div class="stat-card"><div><div class="stat-label">Bereitschaftsstunden</div><div class="stat-value">${nf(standbyHours)} h</div><div class="stat-note">${new Set(sbs.map(a=>a.team)).size} Teams · ${sbs.length} Einsätze</div></div></div>
  <div class="stat-card"><div><div class="stat-label">Abwesenheitstage</div><div class="stat-value">${abs.length}</div><div class="stat-note">${vac} Urlaub · ${abs.length-vac} Sonstige</div></div></div>
 </div>
 <div class="split-layout narrow-side">
  <section class="panel flush"><div class="panel-toolbar">${reportSel.size?`<b>${reportSel.size} ausgewählt</b><button class="btn small push-right" id="export-selection">${icon('download')}Auswahl exportieren</button><button class="btn small ghost" id="clear-selection">Auswahl aufheben</button>`:`<b>Einträge</b><span class="muted small push-right">${filtered.length} gefunden · Zeilen anhaken für einen Teil-Export</span>`}</div>
   <div class="table-wrap borderless"><table><thead><tr><th class="cb-col"><input type="checkbox" id="select-page" ${allChecked?'checked':''} aria-label="Alle auf dieser Seite auswählen"></th><th>Datum</th><th>Mitarbeiter</th><th>Team</th><th>Art</th><th>Dienst</th><th>Uhrzeit</th><th class="num">Std.</th></tr></thead><tbody>${shown.map(a=>`<tr class="${reportSel.has(a.id)?'is-selected':''}"><td class="cb-col"><input type="checkbox" data-sel="${a.id}" ${reportSel.has(a.id)?'checked':''} aria-label="Auswählen"></td><td><b>${escapeHtml(fmtIsoDate(a.date))}</b></td><td><span class="person">${avatarHtml(a.employee,teamColor(teamByName(a.team)),26)}${escapeHtml(a.employee)}</span></td><td>${escapeHtml(a.team)}</td><td><span class="pill kind-${kindLabel(a).toLowerCase()}">${kindLabel(a)}</span></td><td>${escapeHtml(a.shift||'—')}</td><td>${a.start?escapeHtml(a.start+'–'+a.end):'ganztägig'}</td><td class="num">${a.start&&a.end&&!a.isAbsence?nf(netHours(a)):'—'}</td></tr>`).join('')||'<tr><td colspan="8" class="empty-note">Keine Einträge für diese Filter gefunden.</td></tr>'}</tbody></table></div>
   <div class="pager"><span class="muted small">${filtered.length?`${reportPage*REPORT_PAGE+1}–${Math.min(filtered.length,(reportPage+1)*REPORT_PAGE)} von ${filtered.length.toLocaleString(LOC())}`:'0 Einträge'}</span><span class="btn-row"><button class="btn small" id="page-prev" ${reportPage?'':'disabled'} aria-label="Vorherige Seite">‹</button><button class="btn small" id="page-next" ${reportPage<pages-1?'':'disabled'} aria-label="Nächste Seite">›</button></span></div>
  </section>
  <aside class="side-stack"><div class="side-label">BERICHTSVORLAGEN</div>${REPORT_TEMPLATES.map(t=>`<button type="button" class="panel template-card" data-template="${t.id}"><span class="stat-icon">${icon(t.icon)}</span><span><b>${t.title}</b><small>${t.sub}</small></span><span class="icon-btn">${icon('download')}</span></button>`).join('')}<p class="muted small">Vorlagen verwenden den oben gewählten Zeitraum und Filter.</p></aside>
 </div>`;
}
function bindReports(){
 const from=document.getElementById('report-from'),to=document.getElementById('report-to');
 from.onchange=()=>{reportFrom=from.value;if(reportTo&&reportFrom>reportTo)reportTo=reportFrom;reportPage=0;render()};to.onchange=()=>{reportTo=to.value;reportPage=0;render()};
 content.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{const d=new Date();if(b.dataset.range==='week'){const ws=weekStart(d);reportFrom=isoDate(ws);reportTo=isoDate(addDays(ws,6));}else if(b.dataset.range==='month'){reportFrom=isoDate(new Date(d.getFullYear(),d.getMonth(),1));reportTo=isoDate(new Date(d.getFullYear(),d.getMonth()+1,0));}else{reportFrom=isoDate(new Date(d.getFullYear(),d.getMonth()-1,1));reportTo=isoDate(new Date(d.getFullYear(),d.getMonth(),0));}reportPage=0;render()});
 document.getElementById('report-team').onchange=e=>{reportTeam=e.target.value;if(reportMember!=='Alle Mitarbeiter'&&reportTeam!=='Alle Teams'&&!teams.some(t=>t.name===reportTeam&&staff.some(s=>s[0]===reportMember&&t.memberIds.includes(s[8]))))reportMember='Alle Mitarbeiter';reportPage=0;render()};
 document.getElementById('report-member').onchange=e=>{reportMember=e.target.value;reportPage=0;render()};
 content.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{const k=b.dataset.kind;reportKinds=reportKinds.includes(k)?reportKinds.filter(x=>x!==k):[...reportKinds,k];if(!reportKinds.length)reportKinds=[k];reportPage=0;render()});
 content.querySelectorAll('[data-sel]').forEach(cb=>cb.onchange=()=>{if(cb.checked)reportSel.add(cb.dataset.sel);else reportSel.delete(cb.dataset.sel);render()});
 const sp=document.getElementById('select-page');if(sp)sp.onchange=()=>{const shown=reportRows().slice(reportPage*REPORT_PAGE,(reportPage+1)*REPORT_PAGE);shown.forEach(a=>sp.checked?reportSel.add(a.id):reportSel.delete(a.id));render()};
 const pp=document.getElementById('page-prev');if(pp)pp.onclick=()=>{reportPage--;render()};const pn=document.getElementById('page-next');if(pn)pn.onclick=()=>{reportPage++;render()};
 const cs=document.getElementById('clear-selection');if(cs)cs.onclick=()=>{reportSel.clear();render()};
 const status=n=>n>1000?'Groß (>1.000 Zeilen)':'Erfolgreich';
 const es=document.getElementById('export-selection');if(es)es.onclick=()=>{if(!exportGuard('Auswahl','CSV'))return;const list=reportRows().filter(a=>reportSel.has(a.id));downloadCsv([ENTRY_HEAD,...list.map(entryRow)],`auswahl-${isoDate(new Date())}.csv`);logExport(`Auswahl (${list.length} Einträge)`,'CSV',list.length,status(list.length),{range:rangeText()});toast(`${list.length} Einträge exportiert.`)};
 document.getElementById('export-all').onclick=()=>{if(!exportGuard('Alle Einträge','CSV'))return;const list=reportRows();if(!list.length){toast('Keine Einträge zum Exportieren.');return}downloadCsv([ENTRY_HEAD,...list.map(entryRow)],`dienstplan-export-${reportFrom||'alle'}_${reportTo||''}.csv`);logExport('Alle Einträge','CSV',list.length,status(list.length),{range:rangeText()});toast(`${list.length} Einträge exportiert.`)};
 document.getElementById('export-xlsx').onclick=()=>{if(!exportGuard('Alle Einträge','XLSX'))return;const list=reportRows();if(!list.length){toast('Keine Einträge zum Exportieren.');return}saveFile(`dienstplan-export-${reportFrom}_${reportTo}.xlsx`,makeXlsx('Einträge',[ENTRY_HEAD,...list.map(entryRow)]));logExport('Alle Einträge','XLSX',list.length,status(list.length),{range:rangeText()});toast(`${list.length} Einträge exportiert.`)};
 document.getElementById('export-pdf').onclick=()=>{if(!exportGuard('Alle Einträge','PDF'))return;const list=reportRows();if(!list.length){toast('Keine Einträge zum Exportieren.');return}saveFile(`dienstplan-bericht-${reportFrom}_${reportTo}.pdf`,makePdf('Dienstplan – Bericht',`Zeitraum ${rangeText()} · ${reportTeam} · ${list.length} Einträge`,['Datum','Mitarbeiter','Team','Art','Dienst','Uhrzeit','Std.'],list.map(a=>[fmtIsoDate(a.date),a.employee,a.team,kindLabel(a),a.shift,a.start?a.start+'–'+a.end:'ganztägig',a.start&&!a.isAbsence?netHours(a).toLocaleString(LOC(),{maximumFractionDigits:1}):'—']),[1.4,2.6,1.8,1.4,2.2,1.5,0.8]));logExport('Alle Einträge','PDF',list.length,status(list.length),{range:rangeText()});toast(`${list.length} Einträge exportiert.`)};
 content.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{const t=REPORT_TEMPLATES.find(x=>x.id===b.dataset.template);const fmtName=t.sub.split('·').pop().trim();if(!exportGuard(t.title,fmtName))return;const res=t.run(reportRows());if(!res){toast('Keine Daten im Zeitraum.');return}logExport(t.title,res.f,res.n,'Erfolgreich',{range:rangeText()});toast(`„${t.title}“ wurde erstellt.`)});
}

/* ------------------------------------------------------------------
   Rollen, Audit Log, Export Audit
------------------------------------------------------------------ */
let roleSel='',permDraft=null;
const PERM_SHORT={'Abteilungsleiter':'Abteilungsl.','Lohnverrechnung':'Lohnverr.','Bereitschaftsadmin':'Bereitschaftsadm.'};
function rolesPage(){
 const editable=canEdit('Team Berechtigungen');
 if(!roles.includes(roleSel))roleSel=roles.find(r=>r!=='Admin')||roles[0];
 if(!permDraft)permDraft=Object.fromEntries(roles.map(r=>[r,permsFor(r)]));
 roles.forEach(r=>{if(!permDraft[r])permDraft[r]=permsFor(r)});
 const changes=roles.reduce((s,r)=>s+PERM_AREAS.filter(a=>permDraft[r][a]!==permsFor(r)[a]).length,0);
 const cell=(r,a)=>{const v=permDraft[r][a],locked=r==='Admin'||a==='Einstellungen'||!editable;return `<button type="button" class="perm ${v==='E'?'e':v==='R'?'r':'n'} ${permDraft[r][a]!==permsFor(r)[a]?'changed':''}" ${locked?'disabled':''} data-perm-role="${escapeHtml(r)}" data-perm-area="${escapeHtml(a)}" title="${escapeHtml(r)} · ${escapeHtml(a)}: ${v==='E'?'Bearbeiten':v==='R'?'Lesen':'Kein Zugriff'}">${v==='E'?icon('edit'):v==='R'?icon('eye'):'—'}</button>`};
 return `${heading('Rollen &amp; Berechtigungen','Wer darf was sehen und bearbeiten? Änderungen wirken sofort auf Navigation und Aktionen.',editable?`<button class="btn" id="dup-role">${icon('copy')}Rolle duplizieren</button><button class="btn primary" id="add-role">${icon('plus')}Neue Rolle</button>`:'')}
 <div class="split-layout left-side">
  <section class="panel roles-list"><div class="panel-head"><h2>Rollen</h2><span class="pill">${roles.length}</span></div>
   ${roles.map((r,i)=>`<div class="role-item ${r===roleSel?'active':''}" data-role-sel="${escapeHtml(r)}" role="button" tabindex="0"><span class="role-ic">${icon('shield')}</span><span class="role-txt"><b>${escapeHtml(r)}</b><small>${staff.filter(s=>(s[10]||'Mitarbeiter')===r).length} Personen</small></span>${r==='Admin'?`<span class="muted" title="Geschützt">${icon('lock')}</span>`:editable?`<span class="role-actions"><button type="button" class="icon-btn" data-edit-role="${i}" title="Umbenennen" aria-label="Umbenennen">${icon('edit')}</button><button type="button" class="icon-btn danger" data-delete-role="${i}" title="Löschen" aria-label="Löschen">${icon('trash')}</button></span>`:''}</div>`).join('')}
  </section>
  <section class="panel flush perm-card">
   <div class="panel-toolbar"><div><b class="title">Berechtigungsmatrix</b><small class="muted block">Klick auf ein Feld wechselt: — → Lesen → Bearbeiten</small></div><div class="perm-legend push-right"><span class="perm e static">${icon('edit')}</span>Bearbeiten<span class="perm r static">${icon('eye')}</span>Lesen</div>${changes?`<span class="pill warn-pill">${icon('alert')}${changes} ungespeicherte ${changes===1?'Änderung':'Änderungen'}</span><button class="btn small" id="perm-reset">Verwerfen</button>`:''}${editable?`<button class="btn primary small" id="perm-save" ${changes?'':'disabled'}>Speichern</button>`:''}</div>
   <div class="table-wrap borderless perm-table"><table><thead><tr><th>Bereich</th>${roles.map(r=>`<th class="${r===roleSel?'sel':''}" title="${escapeHtml(r)}">${escapeHtml(PERM_SHORT[r]||r)}</th>`).join('')}</tr></thead><tbody>${PERM_AREAS.map(a=>`<tr><td><b>${escapeHtml(a)}</b></td>${roles.map(r=>`<td class="${r===roleSel?'sel':''}">${cell(r,a)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="perm-note">${icon('alert')}<span>Datenumfang: <b>Teamleiter &amp; Deputy</b> bearbeiten nur <u>eigene Teams</u> · <b>Mitarbeiter</b> sehen nur eigene Einträge auf dem Dashboard · <b>Admin</b> ist geschützt und hat immer vollen Zugriff.</span></div>
  </section>
 </div>`;
}
function bindRoles(){
 const editable=canEdit('Team Berechtigungen');
 content.querySelectorAll('[data-role-sel]').forEach(el=>{el.onclick=e=>{if(e.target.closest('button'))return;roleSel=el.dataset.roleSel;render()};el.onkeydown=e=>{if(e.key==='Enter')el.click()}});
 if(!editable)return;
 content.querySelectorAll('[data-perm-role]').forEach(b=>b.onclick=()=>{const r=b.dataset.permRole,a=b.dataset.permArea,v=permDraft[r][a];permDraft[r][a]=v==='N'?'R':v==='R'?'E':'N';roleSel=r;render()});
 const rs=document.getElementById('perm-reset');if(rs)rs.onclick=()=>{permDraft=null;render()};
 const sv=document.getElementById('perm-save');if(sv)sv.onclick=()=>{const diffs=[];roles.forEach(r=>PERM_AREAS.forEach(a=>{const o=permsFor(r)[a],n=permDraft[r][a];if(o!==n)diffs.push({r,a,o,n})}));roles.forEach(r=>{if(r!=='Admin')permissions[r]={...permDraft[r]}});persistPermissions();const L={N:'—',R:'Lesen',E:'Bearbeiten'};diffs.forEach(d=>audit('Geändert','Berechtigungen',`${d.r} · ${d.a}`,{title:'Berechtigung geändert',object:`Rolle ${d.r}`,before:`${d.a}: ${L[d.o]}`,after:L[d.n]}));permDraft=null;toast('Berechtigungen gespeichert.');render()};
 document.getElementById('add-role').onclick=async()=>{const v=(await askText('Name der neuen Rolle:')||'').trim();if(!v)return;if(roles.includes(v)){toast('Diese Rolle gibt es bereits.');return}roles.push(v);permissions[v]={...BASE_PERMS};save('dienstplanRoles',roles);persistPermissions();if(permDraft)permDraft[v]=permsFor(v);roleSel=v;audit('Erstellt','Rollen',v,{title:'Rolle angelegt',object:v});render();toast('Rolle angelegt.')};
 document.getElementById('dup-role').onclick=async()=>{const src=roleSel;const v=(await askText('Name der Kopie von „'+src+'“:',src+' (Kopie)')||'').trim();if(!v)return;if(roles.includes(v)){toast('Diese Rolle gibt es bereits.');return}roles.push(v);permissions[v]={...(permDraft?.[src]||permsFor(src))};if(src==='Admin')permissions[v]=Object.fromEntries(PERM_AREAS.map(a=>[a,'E']));save('dienstplanRoles',roles);persistPermissions();if(permDraft)permDraft[v]=permsFor(v);roleSel=v;audit('Erstellt','Rollen',v,{title:'Rolle dupliziert',object:v,before:src,after:v});render();toast('Rolle angelegt.')};
 content.querySelectorAll('[data-edit-role]').forEach(b=>b.onclick=async()=>{const i=+b.dataset.editRole,old=roles[i];const value=(await askText('Rollenbezeichnung bearbeiten:',old)||'').trim();if(!value||value===old)return;if(roles.includes(value)){toast('Diese Rolle gibt es bereits.');return}roles[i]=value;staff.forEach(s=>{if(s[10]===old)s[10]=value});permissions[value]=permissions[old]||DEFAULT_PERMS[old]||{...BASE_PERMS};delete permissions[old];persistPermissions();persistStaff();save('dienstplanRoles',roles);if(currentRole===old){currentRole=value;save('dienstplanDemoSession',{userId:currentUserId,role:currentRole});updateSignedInUser();}permDraft=null;roleSel=value;audit('Geändert','Rollen',`${old} → ${value}`,{title:'Rolle umbenannt',object:value,before:old,after:value});render();toast('Rolle aktualisiert.')});
 content.querySelectorAll('[data-delete-role]').forEach(b=>b.onclick=async()=>{const i=+b.dataset.deleteRole,r=roles[i];if(r==='Admin')return;const used=staff.filter(s=>s[10]===r).length;if(used){toast(`Die Rolle ist noch ${used} Person(en) zugeordnet.`);return}if(await ask(`Rolle „${r}“ wirklich löschen?`)){roles.splice(i,1);delete permissions[r];persistPermissions();save('dienstplanRoles',roles);permDraft=null;audit('Gelöscht','Rollen',r,{title:'Rolle gelöscht',object:r});render();toast('Rolle gelöscht.')}});
}
let logQuery='',logAction='Alle',logRange='7',logUser='Alle',logArea='Alle',logLimit=100,expFormat='Alle',expStatus='Alle',expQuery='';
const AREA_ICON={'Dienstplan':'cal','Bereitschaft':'moon','Dienstzeiten':'clock','Kontakte':'users','Teams':'build','Rollen':'shield','Berechtigungen':'shield','Abwesenheit':'plane','Arbeitsort':'home','Bereitschaftsgruppen':'sliders','Bereitschaftszeiten':'clock','Teamfarben':'sliders'};
function fmtSize(b){if(!b)return '—';return b<1024?b+' B':b<1048576?Math.round(b/1024)+' KB':(b/1048576).toLocaleString(LOC(),{maximumFractionDigits:1})+' MB'}
function logPage(kind){return kind==='Audit Log'?auditPage():exportAuditPage()}
function auditPage(){
 const now=Date.now(),minTs=logRange==='Alle'?0:logRange==='1'?new Date(new Date().setHours(0,0,0,0)).getTime():now-(+logRange)*864e5;
 const inRange=auditLog.filter(x=>x.ts>=minTs);
 const list=inRange.filter(x=>(logAction==='Alle'||x.action===logAction)&&(logUser==='Alle'||x.user===logUser)&&(logArea==='Alle'||x.area===logArea)&&(!logQuery||JSON.stringify(x).toLowerCase().includes(logQuery.toLowerCase())));
 const users=[...new Set(auditLog.map(x=>x.user))].sort(),areas=[...new Set(auditLog.map(x=>x.area))].sort();
 const rangeLabel={'1':'Heute','7':'Letzte 7 Tage','30':'Letzte 30 Tage','Alle':'Gesamt'}[logRange];
 let lastDay='',html='';
 list.slice(0,logLimit).forEach(x=>{const day=isoDate(new Date(x.ts));if(day!==lastDay){lastDay=day;const cnt=list.filter(y=>isoDate(new Date(y.ts))===day).length;html+=`<div class="log-day"><b>${day===isoDate(new Date())?'Heute · ':''}${escapeHtml(fmtWithWeekday(new Date(x.ts)))}</b><span class="muted small">${cnt} Ereignisse</span></div>`}
  const t=new Date(x.ts),diff=x.before!==''&&x.before!==undefined&&x.after!==''?`<code class="diff">${escapeHtml(x.before)}<b> → </b>${escapeHtml(x.after)}</code>`:(x.after||x.detail)?`<code class="diff">${escapeHtml(x.after||x.detail)}</code>`:'';
  html+=`<article class="log-entry" data-log-id="${x.id}"><span class="log-time">${pad2(t.getHours())}:${pad2(t.getMinutes())}</span><span class="log-icon act-${String(x.action).toLowerCase()}">${icon(AREA_ICON[x.area]||(x.action==='Gelöscht'?'trash':x.action==='Erstellt'?'plus':'edit'))}</span><div class="log-body"><div class="log-title"><b>${escapeHtml(x.title||`${x.area}: ${x.action}`)}</b><span class="pill act-${String(x.action).toLowerCase()}">${escapeHtml(x.action)}</span></div><small class="muted">${escapeHtml(x.user)} (${escapeHtml(x.role)})${x.object?' · '+escapeHtml(x.object):x.detail&&!diff?'':' · '+escapeHtml(x.area)}</small>${diff}</div><button type="button" class="icon-btn" data-log-csv="${x.id}" title="Eintrag als CSV" aria-label="Eintrag als CSV">${icon('download')}</button></article>`});
 const top=Object.entries(inRange.reduce((m,x)=>(m[x.user]=(m[x.user]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
 return `${heading('Audit Log','Lückenlose Protokollierung aller Änderungen – automatisch erfasst.',`<button class="btn primary" id="export-log">${icon('download')}Log exportieren</button>`)}
 <section class="panel filter-panel"><label class="search-field">${icon('search')}<input id="log-search" type="search" placeholder="Suchen in Aktionen, Personen …" value="${escapeHtml(logQuery)}"></label>
  <select class="form-select" id="log-range"><option value="1" ${logRange==='1'?'selected':''}>Heute</option><option value="7" ${logRange==='7'?'selected':''}>Letzte 7 Tage</option><option value="30" ${logRange==='30'?'selected':''}>Letzte 30 Tage</option><option value="Alle" ${logRange==='Alle'?'selected':''}>Gesamt</option></select>
  <div class="chip-row">${['Alle','Erstellt','Geändert','Gelöscht'].map(a=>`<button type="button" class="chip ${logAction===a?'active':''}" data-log-action="${a}">${a==='Alle'?'Alle Aktionen':a}</button>`).join('')}</div>
  <select class="form-select" id="log-user"><option value="Alle">Alle Benutzer</option>${users.map(u=>`<option value="${escapeHtml(u)}" ${logUser===u?'selected':''}>${escapeHtml(u)}</option>`).join('')}</select>
  <select class="form-select" id="log-area"><option value="Alle">Alle Bereiche</option>${areas.map(u=>`<option value="${escapeHtml(u)}" ${logArea===u?'selected':''}>${escapeHtml(u)}</option>`).join('')}</select></section>
 <div class="split-layout narrow-side">
  <section class="panel log-list">${html||`<div class="empty-note">${auditLog.length?'Keine Einträge für diesen Filter.':'Noch keine Änderungen protokolliert. Lege z. B. einen Dienst an – er erscheint dann hier.'}</div>`}${list.length>logLimit?`<div class="btn-row center"><button class="btn" id="log-more">Weitere ${Math.min(100,list.length-logLimit)} laden</button></div>`:''}</section>
  <aside class="side-stack"><section class="panel"><h2>${rangeLabel}</h2>${['Erstellt','Geändert','Gelöscht'].map(a=>`<div class="stat-line"><span class="pill act-${a.toLowerCase()}">${a}</span><b>${inRange.filter(x=>x.action===a).length}</b></div>`).join('')}</section>
  <section class="panel"><h2>Aktivste Benutzer</h2>${top.length?top.map(([u,c])=>`<div class="stat-line">${avatarHtml(u,'#14A1A9',28)}<span class="grow">${escapeHtml(u)}</span><b>${c}</b></div>`).join(''):'<p class="muted small">Noch keine Aktivität.</p>'}</section></aside>
 </div>`;
}
function exportAuditPage(){
 const now=Date.now(),last30=exportLog.filter(x=>x.ts>=now-30*864e5),prev30=exportLog.filter(x=>x.ts<now-30*864e5&&x.ts>=now-60*864e5);
 const delta=prev30.length?Math.round((last30.length-prev30.length)/prev30.length*100):null;
 const rows30=last30.reduce((s,x)=>s+(+x.rows||0),0),denied=exportLog.filter(x=>x.status==='Verweigert').length;
 const fmtCount=exportLog.reduce((m,x)=>(m[x.format]=(m[x.format]||0)+1,m),{}),topF=Object.entries(fmtCount).sort((a,b)=>b[1]-a[1])[0];
 const formats=Object.keys(fmtCount).sort();
 const list=exportLog.filter(x=>(expFormat==='Alle'||x.format===expFormat)&&(expStatus==='Alle'||(expStatus==='Hinweis'?!['Erfolgreich','Verweigert'].includes(x.status):x.status===expStatus))&&(!expQuery||`${x.report} ${x.user}`.toLowerCase().includes(expQuery.toLowerCase())));
 const FC={CSV:'#3974c6',XLSX:'#1f9a63',PDF:'#d64550',JSON:'#596579',VCF:'#9b69c8'};
 const statusPill=s=>`<span class="pill ${s==='Erfolgreich'?'act-erfolgreich':s==='Verweigert'?'act-gelöscht':'act-hinweis'}">${escapeHtml(s)}</span>`;
 return `${heading('Export Audit','Jeder Download wird automatisch dokumentiert (DSGVO-Nachweis).',`<button class="btn" id="export-log">${icon('download')}Protokoll exportieren</button>`)}
 <div class="stats">
  <div class="stat-card"><div><div class="stat-label">Exporte (30 Tage)</div><div class="stat-value">${last30.length}</div><div class="stat-note">${delta===null?'Kein Vormonat zum Vergleich':`<span class="${delta>=0?'up':'down'}">${delta>=0?'+':''}${delta} %</span> ggü. Vormonat`}</div></div></div>
  <div class="stat-card"><div><div class="stat-label">Exportierte Zeilen</div><div class="stat-value">${rows30.toLocaleString(LOC())}</div><div class="stat-note">Ø ${last30.length?Math.round(rows30/last30.length).toLocaleString(LOC()):0} je Export</div></div></div>
  <div class="stat-card"><div><div class="stat-label">Verweigert</div><div class="stat-value">${denied}</div><div class="stat-note">fehlende Berechtigung</div></div></div>
  <div class="stat-card"><div><div class="stat-label">Häufigstes Format</div><div class="stat-value">${topF?escapeHtml(topF[0]):'—'}</div><div class="stat-note">${topF?Math.round(topF[1]/exportLog.length*100)+' % aller Exporte':'Noch kein Export'}</div></div></div>
 </div>
 <section class="panel flush"><div class="panel-toolbar"><label class="search-field">${icon('search')}<input id="exp-search" type="search" placeholder="Bericht oder Person …" value="${escapeHtml(expQuery)}"></label><div class="chip-row">${['Alle',...formats].map(f=>`<button type="button" class="chip ${expFormat===f?'active':''}" data-exp-format="${escapeHtml(f)}">${f==='Alle'?'Alle Formate':escapeHtml(f)}</button>`).join('')}</div><select class="form-select" id="exp-status"><option value="Alle">Status: alle</option>${['Erfolgreich','Verweigert','Hinweis'].map(s=>`<option value="${s}" ${expStatus===s?'selected':''}>${s}</option>`).join('')}</select></div>
 <div class="table-wrap borderless"><table><thead><tr><th>Zeitpunkt</th><th>Benutzer</th><th>Bericht</th><th>Zeitraum</th><th>Größe</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${list.slice(0,300).map(x=>`<tr><td class="muted">${fmtDateTime(x.ts)}</td><td><span class="person">${avatarHtml(x.user,'#14A1A9',26)}${escapeHtml(x.user)}</span></td><td class="wrap"><span class="file-cell"><span class="file-badge" style="--c:${FC[x.format]||'#596579'}">${escapeHtml(x.format)}</span><b>${escapeHtml(x.report)}</b></span></td><td>${escapeHtml(x.range||'—')}</td><td class="muted">${fmtSize(x.size)}</td><td>${statusPill(x.status)}</td><td><button class="icon-btn" data-download-row title="Protokollzeile als CSV" aria-label="Protokollzeile als CSV">${icon('download')}</button></td></tr>`).join('')||`<tr><td colspan="7" class="empty-note">${exportLog.length?'Keine Einträge für diesen Filter.':'Noch keine Exporte. Unter „Berichte / Export“ einen Export starten.'}</td></tr>`}</tbody></table></div></section>`;
}
function bindLogPage(){
 const isAudit=currentPage==='Audit Log';
 if(isAudit){
  const s=document.getElementById('log-search');s.onchange=()=>{logQuery=s.value;render()};s.onkeydown=e=>{if(e.key==='Enter'){logQuery=s.value;render()}};
  content.querySelectorAll('[data-log-action]').forEach(b=>b.onclick=()=>{logAction=b.dataset.logAction;render()});
  [['log-range',v=>logRange=v],['log-user',v=>logUser=v],['log-area',v=>logArea=v]].forEach(([id,f])=>{const el=document.getElementById(id);el.onchange=()=>{f(el.value);logLimit=100;render()}});
  const more=document.getElementById('log-more');if(more)more.onclick=()=>{logLimit+=100;render()};
  content.querySelectorAll('[data-log-csv]').forEach(b=>b.onclick=()=>{const x=auditLog.find(y=>y.id===b.dataset.logCsv);if(!x)return;downloadCsv([['Zeitpunkt','Benutzer','Rolle','Aktion','Bereich','Titel','Objekt','Vorher','Nachher','Details'],[fmtDateTime(x.ts),x.user,x.role,x.action,x.area,x.title,x.object,x.before,x.after,x.detail]],'audit-eintrag.csv');logExport('Audit Log (Einzelzeile)','CSV',1,'Erfolgreich');toast('Report wurde heruntergeladen.')});
 }else{
  const s=document.getElementById('exp-search');s.onchange=()=>{expQuery=s.value;render()};s.onkeydown=e=>{if(e.key==='Enter'){expQuery=s.value;render()}};
  content.querySelectorAll('[data-exp-format]').forEach(b=>b.onclick=()=>{expFormat=b.dataset.expFormat;render()});
  document.getElementById('exp-status').onchange=e=>{expStatus=e.target.value;render()};
 }
 document.getElementById('export-log').onclick=()=>{const data=isAudit?auditLog:exportLog;if(!data.length){toast('Das Protokoll ist leer.');return}const rows=isAudit?[['Zeitpunkt','Benutzer','Rolle','Aktion','Bereich','Titel','Objekt','Vorher','Nachher','Details'],...data.map(x=>[fmtDateTime(x.ts),x.user,x.role,x.action,x.area,x.title,x.object,x.before,x.after,x.detail])]:[['Zeitpunkt','Benutzer','Rolle','Bericht','Format','Zeilen','Zeitraum','Größe','Status'],...data.map(x=>[fmtDateTime(x.ts),x.user,x.role,x.report,x.format,x.rows,x.range,fmtSize(x.size),x.status])];downloadCsv(rows,safeFileName(currentPage)+'.csv');logExport(currentPage,'CSV',data.length,'Erfolgreich');toast('Protokoll exportiert.');if(!isAudit)render()};
}

/* ------------------------------------------------------------------
   Rendern
------------------------------------------------------------------ */
function bindStandbyAdmin(){
 const groupForm=document.getElementById('standby-group-form'),timeForm=document.getElementById('standby-time-form');
 if(groupForm)groupForm.onsubmit=e=>{e.preventDefault();const name=document.getElementById('standby-group-name').value.trim();if(!name)return;if(standbyGroups.some(g=>g.name.toLowerCase()===name.toLowerCase())){toast('Diese Bereitschaftsgruppe gibt es bereits.');return;}standbyGroups.push({id:makeId(),name});persistStandbyConfig();audit('Erstellt','Bereitschaftsgruppen',name);render();toast('Bereitschaftsgruppe hinzugefügt.');};
 if(timeForm)timeForm.onsubmit=e=>{e.preventDefault();const groupId=document.getElementById('standby-time-group').value,name=document.getElementById('standby-time-name').value.trim(),start=document.getElementById('standby-time-start').value,end=document.getElementById('standby-time-end').value;if(!standbyGroups.some(g=>g.id===groupId)||!name||!start||!end){toast('Bitte alle Angaben ausfüllen.');return;}if(start===end){toast('Beginn und Ende dürfen nicht gleich sein.');return}standbyTimes.push({id:makeId(),groupId,name,start,end,color:'#159da8'});persistStandbyConfig();audit('Erstellt','Bereitschaftszeiten',`${name} (${start}–${end})`);render();toast('Bereitschaftszeit hinzugefügt.');};
 content.querySelectorAll('[data-delete-standby-group]').forEach(b=>b.onclick=async()=>{const id=b.dataset.deleteStandbyGroup,g=standbyGroups.find(x=>x.id===id);if(!await ask('Bereitschaftsgruppe samt zugehörigen Bereitschaftszeiten löschen?'))return;standbyGroups=standbyGroups.filter(g=>g.id!==id);standbyTimes=standbyTimes.filter(t=>t.groupId!==id);persistStandbyConfig();audit('Gelöscht','Bereitschaftsgruppen',g?.name||id);render();toast('Bereitschaftsgruppe gelöscht.');});
 content.querySelectorAll('[data-delete-standby-time]').forEach(b=>b.onclick=async()=>{const t=standbyTimes.find(x=>x.id===b.dataset.deleteStandbyTime);if(!t||!await ask(`Zeitfenster „${t.name}“ löschen?`))return;standbyTimes=standbyTimes.filter(x=>x.id!==t.id);persistStandbyConfig();audit('Gelöscht','Bereitschaftszeiten',`${t.name} (${t.start}–${t.end})`);render();toast('Zeitfenster gelöscht.')});
 content.querySelectorAll('[data-standby-team-color]').forEach(input=>input.onchange=()=>{const team=teamById(input.dataset.standbyTeamColor);if(!team)return;team.standbyColor=input.value;persistTeams();audit('Geändert','Teamfarben',`${team.name} → ${input.value}`);render();toast('Bereitschaftsfarbe für '+team.name+' gespeichert.');});
}
function render(){
 if(currentPage!=='Dashboard'&&dashEditing){dashEditing=false;dashDraft=null}
 document.body.classList.toggle('settings-mode',currentPage==='Einstellungen');
 document.getElementById('top-avatar')?.classList.toggle('is-current',currentPage==='Einstellungen');
 applyRoleNavigation();refreshNotifications();
 if(!allowedPages().includes(currentPage))currentPage=allowedPages()[0]||'Dashboard';
 document.querySelectorAll('body > .duty-actions-menu').forEach(m=>m.remove());
 content.innerHTML=currentPage==='Dashboard'?dashboard():currentPage==='Dienstplan'||currentPage==='Bereitschaft'?calendar():currentPage==='Bereitschaft verwalten'?standbyManagementPage():currentPage==='Kontakte'?contactsPage():currentPage==='Berichte / Export'?reportExportPage():currentPage==='Einstellungen'?settings():currentPage==='Dienstzeiten'?shiftTimes():currentPage==='Administration'?administrationPage():currentPage==='Team Berechtigungen'?rolesPage():logPage(currentPage);
 if(currentPage==='Einstellungen')bindSettings();
 if(currentPage==='Dashboard')bindDashboard();
 if(currentPage==='Dienstzeiten'&&document.getElementById('shift-rows'))bindShiftTimes();
 if(currentPage==='Bereitschaft verwalten'){if(canEdit('Bereitschaft verwalten'))bindStandbyAdmin();else{content.querySelectorAll('.standby-management-layout form,[data-delete-standby-group],#create-standby-group').forEach(x=>x.hidden=true);content.querySelectorAll('.standby-management-layout input,.standby-management-layout select,input[type=color]').forEach(x=>x.disabled=true);const h=content.querySelector('.page-heading');if(h&&!content.querySelector('.readonly-note'))h.insertAdjacentHTML('afterend','<div class="readonly-note">'+icon('eye')+'Nur Lesezugriff – Änderungen sind deiner Rolle nicht erlaubt.</div>')}}
 if(currentPage==='Administration'&&canView('Administration'))bindAdministration();
 if(currentPage==='Kontakte')bindContacts();
 if(currentPage==='Berichte / Export')bindReports();
 if(currentPage==='Team Berechtigungen')bindRoles();
 if(['Audit Log','Export Audit'].includes(currentPage))bindLogPage();
 if(['Berichte / Export','Audit Log','Export Audit'].includes(currentPage))content.querySelectorAll('[data-download-row]').forEach(b=>b.onclick=()=>{const row=b.closest('tr');if(row)downloadTableRow(row.closest('table'),row,currentPage)});
 const isCal=currentPage==='Dienstplan'||currentPage==='Bereitschaft';
 if(isCal){bindDutyModal();bindDutyActions(content);bindCalendarExtras();}
 if(currentPage==='Dienstplan')bindAbsenceModal();
 content.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const date=b.dataset.goDate;go(b.dataset.go);if(date){currentDate=new Date(date+'T12:00:00');selectedMobileDate=date;render();}});
 content.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;selectedMobileDate='';render()});
 ['prev','next','today'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=()=>{if(id==='today'){currentDate=new Date();selectedMobileDate='';}else if(currentView==='Monat'){currentDate.setDate(1);currentDate.setMonth(currentDate.getMonth()+(id==='next'?1:-1));selectedMobileDate='';}else{currentDate.setDate(currentDate.getDate()+(id==='next'?1:-1)*(currentView==='Tag'?1:7));selectedMobileDate='';}render()}});
 const absenceAdd=document.getElementById('add-absence');if(absenceAdd)absenceAdd.onclick=()=>{bindAbsenceModal();document.getElementById('absence-modal').hidden=false};
 const dpAct=document.getElementById('dp-actions-toggle');if(dpAct)dpAct.onclick=openDutyActionsSheet;
 const swapNew=document.getElementById('swap-new-btn');if(swapNew)swapNew.onclick=()=>openSwapRequest();
 const workplaceAdd=document.getElementById('add-workplace'),workplaceModal=document.getElementById('workplace-modal'),workplaceForm=document.getElementById('workplace-form');
 if(workplaceAdd)workplaceAdd.onclick=()=>{const date=isoDate(currentDate);openWorkplaceModal({from:date,to:date})};
 if(workplaceModal&&workplaceForm)bindWorkplaceModal(workplaceModal,workplaceForm);

 const add=document.getElementById('add');if(add)add.onclick=()=>openDutyModalFor({date:isoDate(currentDate)});
 content.querySelectorAll('[data-quick-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();openDutyModalFor({team:b.dataset.team,empIndex:+b.dataset.emp,date:b.dataset.quickAdd})});
 // Kalender- und Berichtsfilter
 const teamFilterEl=document.getElementById('team-filter');if(teamFilterEl)teamFilterEl.onchange=()=>{calendarTeamFilter=teamFilterEl.value;const validNames=staff.filter(s=>calendarTeamFilter==='Alle Teams'||teams.some(t=>t.name===calendarTeamFilter&&t.memberIds.includes(s[8]))).map(s=>s[0]);if(calendarMemberFilter!=='Alle Mitarbeiter'&&!validNames.includes(calendarMemberFilter))calendarMemberFilter='Alle Mitarbeiter';render()};
 const memberFilterEl=document.getElementById('member-filter');if(memberFilterEl){const applyMemberFilter=()=>{const value=memberFilterEl.value.trim();if(!value||value==='Alle Mitarbeiter')calendarMemberFilter='Alle Mitarbeiter';else if(staff.some(s=>s[0]===value))calendarMemberFilter=value;else{toast('Kein Mitarbeiter mit diesem Namen gefunden.');return}render()};memberFilterEl.addEventListener('change',applyMemberFilter);memberFilterEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyMemberFilter()}})}
 const resetCalendarFilters=document.getElementById('reset-calendar-filters');if(resetCalendarFilters)resetCalendarFilters.onclick=()=>{calendarTeams=[];onlyConflicts=false;calendarMemberFilter='Alle Mitarbeiter';render()};
 // Tagesdetails
 const dayModal=document.getElementById('day-details-modal');
 const closeDayDetails=()=>{if(dayModal)dayModal.hidden=true};
 ['close-day-details','close-day-details-bottom'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=closeDayDetails});
 const openDayDetails=date=>{
  buildWpIndex();
  const entries=assignments.filter(a=>(currentPage==='Bereitschaft'?a.kind==='Bereitschaft':(a.kind==='Dienstplan'||a.kind==='Arbeitsort'||(a.kind==='Bereitschaft'&&canSeeStandbyInDutyPlan(a))))&&a.date===date&&!wpMerged(a)).filter(a=>calTeamOk(a.team)).filter(a=>calendarMemberFilter==='Alle Mitarbeiter'||a.employee===calendarMemberFilter).sort((a,b)=>(a.kind==='Bereitschaft'?-1:0)-(b.kind==='Bereitschaft'?-1:0)||(a.start||'').localeCompare(b.start||''));
  document.getElementById('day-details-title').textContent=fmtWithWeekday(new Date(date+'T12:00:00'));
  document.getElementById('day-details-subtitle').textContent=entries.length+' Einträge';
  document.getElementById('day-details-list').innerHTML=entries.length?entries.map(a=>`<div class="day-assignment-row"><div class="calendar-assignment ${a.kind==='Bereitschaft'?'standby-assignment':''} ${a.isAbsence?'absence-assignment':''} ${a.kind==='Arbeitsort'?'workplace-assignment':''}" style="--shift-color:${shiftHexColor(assignmentColor(a))}">${a.kind==='Bereitschaft'?'<span class="standby-indicator">◷ Bereitschaft</span>':a.kind==='Arbeitsort'?`<span class="workplace-indicator">⌂ ${escapeHtml(a.shift)}</span>`:''}<b>${escapeHtml(a.employee)}</b><span>${a.isAbsence?'Abwesenheit: ':''}${escapeHtml(a.shift)}${a.start?' · '+a.start+'–'+a.end:''}</span>${wpHint(wpFor(a))}${swapPill(a)}${a.note?`<div class="absence-note"><span class="absence-note-label">Bemerkung</span><span>${escapeHtml(a.note)}</span></div>`:''}<small>${escapeHtml(a.team)}${a.groupName?' · '+escapeHtml(a.groupName):''}</small><details class="duty-actions"><summary aria-label="Aktionen">⋯</summary><div class="duty-actions-menu">${a.isAbsence||a.kind==='Arbeitsort'?'':`<button type="button" data-edit-duty="${a.id}">Bearbeiten</button>`}${canSwapDuty(a)?`<button type="button" data-swap-duty="${a.id}">${icon('refresh')}Dienst tauschen</button>`:''}${wpFor(a)?`<button type="button" data-edit-wp="${wpFor(a).id}">Arbeitsort ändern</button><button type="button" data-delete-duty="${wpFor(a).id}">Arbeitsort entfernen</button>`:''}<button type="button" class="danger-text" data-delete-duty="${a.id}">Löschen</button></div></details></div></div>`).join(''):'<div class="empty-note">Für diesen Tag sind keine Einträge vorhanden.</div>';
  dayModal.hidden=false;bindDutyActions(dayModal);
 };
 content.querySelectorAll('[data-open-day]').forEach(b=>b.onclick=e=>{e.stopPropagation();openDayDetails(b.dataset.openDay)});
 content.querySelectorAll('[data-mobile-date]').forEach(b=>b.onclick=()=>{selectedMobileDate=b.dataset.mobileDate;currentDate=new Date(selectedMobileDate+'T12:00:00');mobileFocusEmp=b.dataset.focusEmp||'';render();if(mobileFocusEmp){const card=[...content.querySelectorAll('[data-emp-card]')].find(c=>c.dataset.empCard===mobileFocusEmp);if(card)card.scrollIntoView({behavior:'smooth',block:'center'})}});
 // Arbeitsort-Zeitraum per Ziehen über mehrere Kalendertage markieren.
 if(currentPage==='Dienstplan'&&(currentView==='Woche'||currentView==='Monat')){
  let dragStart=null,dragEnd=null,dragging=false;
  const cells=[...content.querySelectorAll('[data-calendar-day]')];
  const clearDrag=()=>cells.forEach(c=>c.classList.remove('workplace-range-selected'));
  cells.forEach(cell=>{
   cell.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||e.target.closest('button,details,a,input,select,[draggable="true"]'))return;dragStart=cell.dataset.calendarDay;dragEnd=dragStart;dragging=true;clearDrag();cell.classList.add('workplace-range-selected');});
   cell.addEventListener('pointerenter',()=>{if(!dragging)return;dragEnd=cell.dataset.calendarDay;clearDrag();const a=dragStart<dragEnd?dragStart:dragEnd,b=dragStart>dragEnd?dragStart:dragEnd;cells.forEach(c=>{const x=c.dataset.calendarDay;if(x>=a&&x<=b)c.classList.add('workplace-range-selected')})});
   cell.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;const from=dragStart<dragEnd?dragStart:dragEnd,to=dragStart>dragEnd?dragStart:dragEnd;clearDrag();if(from!==to)openWorkplaceModal({from,to,type:'Homeoffice'});dragStart=dragEnd=null;});
  });
  document.addEventListener('pointerup',()=>{if(dragging){dragging=false;clearDrag()}},{once:true});
 }
 if(window.matchMedia('(max-width: 700px)').matches){
  content.querySelectorAll('[data-calendar-day]').forEach(cell=>cell.addEventListener('click',e=>{if(e.target.closest('button,details,a,input,select'))return;openDayDetails(cell.dataset.calendarDay);}));
 }
 if(dayModal)dayModal.addEventListener('click',e=>{if(e.target===dayModal)closeDayDetails()});
 // Modale per Klick auf den Hintergrund schließen
 content.querySelectorAll('.modal-backdrop').forEach(m=>{if(m.id!=='day-details-modal'&&m.id!=='workplace-modal')m.addEventListener('click',e=>{if(e.target===m){const c=m.querySelector('[id^="cancel-"],[id^="close-"]');if(c)c.click();else m.hidden=true}})});
}

bindMobileTableDetails();
hasSession=restoreDemoSession();
if(hasSession)calendarTeams=currentUserTeamNames().slice(0,1);
// Nach einem Neuladen (z. B. Sprachwechsel) auf derselben Seite bleiben
let afterReload='';
try{const last=sessionStorage.getItem('dienstplanPage');if(hasSession&&last&&allowedPages().includes(last))currentPage=last;afterReload=sessionStorage.getItem('dienstplanAfterReload')||'';sessionStorage.removeItem('dienstplanAfterReload')}catch(e){}
refreshNotifications();
render();
try{if(Date.now()-(+sessionStorage.getItem('dienstplanStorageFull')||0)<15000)setTimeout(()=>toast('Browserspeicher voll – die letzte Änderung konnte nicht gespeichert werden. Bitte unter Einstellungen alte Einträge archivieren.'),80)}catch(e){}
if(hasSession&&afterReload){setTimeout(()=>{document.getElementById(afterReload)?.scrollIntoView({block:'start'});toast(LANG==='en'?'Language changed.':'Sprache geändert.')},60)}
if(!hasSession)openLogin();
appReady=true;

/* Datumsfelder auf 2000–2099 begrenzen */
function limitDateInputs(){document.querySelectorAll('input[type=date]').forEach(i=>{if(!i.min)i.min='2000-01-01';if(!i.max)i.max='2099-12-31'})}
{let ld=0;new MutationObserver(()=>{clearTimeout(ld);ld=setTimeout(limitDateInputs,0)}).observe(document.body,{childList:true,subtree:true});limitDateInputs();}
/* Tabellen nach jedem Neuzeichnen für das Handy beschriften */
{let lt=0;new MutationObserver(()=>{clearTimeout(lt);lt=setTimeout(labelTables,0)}).observe(content,{childList:true,subtree:true});labelTables();}
