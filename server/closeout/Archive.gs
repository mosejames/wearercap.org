/** RCAP-owned karaoke archive. Install and run only as rcaparents@ronclarkacademy.com.
 * Set CLOSEOUT_KEY and SUPABASE_ANON_KEY in Project Settings > Script properties.
 * Then run setupCloseout once and approve Google permissions yourself.
 * This script creates no web endpoint; a five-minute owner trigger pulls only submitted records.
 */
const CO_URL='https://kcsrtwwpnekqdrfgcfys.supabase.co';
const CO_DOC='1piDV7MlTP6Sbb1USMNvLDgX0kvovzXpDVMhEZs5hLIk';
const CO_FOLDER='17dYF3_FPx_tMTbyLvxKg3CBuyGwiERNV';
const CO_QUESTIONS={flow:['What happened','How the evening unfolded'],attendance:['Event at a glance','Approximate attendance (110 RSVPs)'],people:['What happened','People and responsibilities'],equipment:['Planning process','Equipment and connection instructions'],approval:['Budget and reconciliation','Approved allocation and evidence'],food:['Budget and reconciliation','Final catering cost and reimbursement'],overage:['Budget and reconciliation','Agreed overage split, settlement pending'],facilities:['Lessons for next time','School notification process'],lessons:['Lessons for next time','Keep, change and prepare'],materials:['Source register','Reusable materials and links']};
function coCall(action,payload){const p=PropertiesService.getScriptProperties();const key=p.getProperty('CLOSEOUT_KEY'),anon=p.getProperty('SUPABASE_ANON_KEY');if(!key||!anon)throw new Error('Set CLOSEOUT_KEY and SUPABASE_ANON_KEY in Script properties.');const r=UrlFetchApp.fetch(CO_URL+'/rest/v1/rpc/rcap_closeout_archive',{method:'post',contentType:'application/json',headers:{apikey:anon,Authorization:'Bearer '+anon},payload:JSON.stringify({p_action:action,p_key:key,p_payload:payload||{}}),muteHttpExceptions:true});if(r.getResponseCode()!==200)throw new Error('Archive request failed: '+r.getResponseCode()+' '+JSON.parse(r.getContentText()).message);return JSON.parse(r.getContentText());}
function coOwner(){if(Session.getEffectiveUser().getEmail().toLowerCase()!=='rcaparents@ronclarkacademy.com')throw new Error('Run under the RCAP organization account.');const folder=DriveApp.getFolderById(CO_FOLDER);if(folder.getOwner().getEmail().toLowerCase()!=='rcaparents@ronclarkacademy.com'||DriveApp.getFileById(CO_DOC).getOwner().getEmail().toLowerCase()!=='rcaparents@ronclarkacademy.com')throw new Error('Archive ownership must remain with RCAP.');return folder;}
function setupCloseout(){coOwner();const record=coCall('pull');if(record.event.doc_id!==CO_DOC||record.event.folder_id!==CO_FOLDER)throw new Error('The registered archive has changed.');if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='syncCloseout'))ScriptApp.newTrigger('syncCloseout').timeBased().everyMinutes(5).create();coCall('connected');syncCloseout();}
function coFile(folder,name,blob){const found=folder.getFilesByName(name);return found.hasNext()?found.next():folder.createFile(blob.setName(name));}
function syncCloseout(){const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;try{const folder=coOwner(),record=coCall('pull');if(record.event.doc_id!==CO_DOC||record.event.folder_id!==CO_FOLDER)throw new Error('Unexpected target.');record.submissions.forEach(s=>{const attachments=[];(s.receipt_ids||[]).forEach(id=>{const r=coCall('file',{id});const name='Closeout receipt '+r.id+' - '+r.name;let file;if(r.drive_id){file=DriveApp.getFileById(r.drive_id);if(file.getOwner().getEmail().toLowerCase()!=='rcaparents@ronclarkacademy.com')throw new Error('Receipt owner changed.');}else{file=coFile(folder,name,Utilities.newBlob(Utilities.base64Decode(r.base64),r.mime,name));coCall('ack_file',{id:r.id,drive_id:file.getId()});}attachments.push({name:r.name,url:file.getUrl(),id:file.getId()});});
 const archive=coFile(folder,'Closeout submission '+s.id+'.json',Utilities.newBlob(JSON.stringify({submission:s,attachments:attachments},null,2),'application/json'));
 const doc=DocumentApp.openById(CO_DOC),body=doc.getBody(),marker='Organizer follow-up completed · '+s.id;
 if(!body.getText().includes(marker)){
  const lines=['Organizer follow-up · '+s.author_name,new Date(s.created_at).toISOString()+' · submitted version '+s.revision,'Verified account: '+s.author_email,'Attributed organizer input. This supplements the source record; financial amounts remain subject to ledger reconciliation and final approval.'];
  Object.keys(CO_QUESTIONS).forEach(id=>{const q=CO_QUESTIONS[id],a=s.content.answers[id];lines.push('',q[0]+' · '+q[1]);if(!a){lines.push('Still open: no answer submitted.');return;}lines.push('Status: '+({confirmed:'Organizer answered',pending:'Needs follow-up',unknown:'Organizer does not know',unanswered:'Not answered'}[a.status]||'Unconfirmed')+(a.owner?' · Follow up: '+a.owner:''));if(a.text)lines.push(a.text);});
  lines.push('','Vendor payment confirmations');
  Object.keys(s.content.vendors||{}).forEach(id=>{const r=s.content.vendors[id],ref=record.event.reference[id];lines.push(id+': '+(r.status||'Not sure')+' · Gross cost: '+(r.cost||'Unconfirmed')+' · RCAP actually paid: '+(r.rcap_paid||'Unconfirmed')+' · Date: '+(r.date||'Unconfirmed'));if(r.evidence)lines.push(r.evidence);if(r.cost!==undefined&&r.cost!==''&&Number(r.cost)!==Number(ref))lines.push('RECONCILIATION NEEDED: organizer cost differs from the archived reference. No approved total has been changed.');if(['paid','reimbursed'].includes(r.status)&&(!r.date||!r.evidence))lines.push('RECONCILIATION NEEDED: payment date or supporting evidence is missing.');});
  if(s.content.finalNote)lines.push('','Additional note',s.content.finalNote);
  lines.push('','Supporting archive','Original submitted answers: '+archive.getUrl());attachments.forEach(f=>lines.push(f.name+': '+f.url));lines.push('',marker);
  // One append contains the entire block and final marker. A retry cannot mistake
  // a partially constructed series of paragraphs for a complete delivery.
  const paragraph=body.appendParagraph(lines.join('\n'));
  paragraph.editAsText().setBold(0,lines[0].length-1,true);
 }
 doc.saveAndClose();
 // Only acknowledge after both the source JSON and report are written.
 coCall('ack',{id:s.id,archive_id:archive.getId()});
 });}finally{lock.releaseLock();}}
