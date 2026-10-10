/** RCAP Living Playbook. Deploy as owner; all requests independently verify
 * Supabase membership. Only these registered generated records can be written.
 * Original editable playbooks and other Drive files are never modified.
 */
const PB_URL = 'https://kcsrtwwpnekqdrfgcfys.supabase.co';
const PB_RECORDS = {
  uniform: '1kIe4ZpWdI-mIWNsVITuJpNWo4ETXYZTMaD5O5x2zEtU',
  raffle: '1UyWDH2Ei1FhnTBfL_1AAZyACC7GiTZxMsoWHsrqHVfU',
  marcom: '1Zffu5ifTkIGyKacSSw5m4r4xy1A18JDUUPCQn1XfevU',
  men: '1_ep0M2T5GsZi7oleUeIM7tsP3eIBefepcgFRje-R6pY',
  trunk: '1hjAJ7bpy0m-N8hEtBG5YKjWGP_L-epIKgJQw32u7g8Y'
};
const PB_SECTIONS = {purpose:'Purpose',perspective:'Perspective',people:'People',provision:'Provision',plan:'Plan',pass:'Pass It On'};
function doGet() { return pbJson({ok:true,service:'RCAP Living Playbook Drive updater'}); }
function doPost(e) {
  let lock;
  try {
    const input = JSON.parse(e.postData.contents);
    const target = PB_RECORDS[input.committee];
    if (!target || !input.token || !input.key) throw new Error('Access required');
    lock=LockService.getScriptLock();lock.waitLock(20000);
    // The fixed Supabase origin and server-held membership list are the authority.
    const response = UrlFetchApp.fetch(PB_URL+'/rest/v1/rpc/rcap_playbook',{
      method:'post',contentType:'application/json',headers:{apikey:input.key,Authorization:'Bearer '+input.token},
      payload:JSON.stringify({p_action:'drive_export',p_payload:{committee:input.committee}}),muteHttpExceptions:true
    });
    if(response.getResponseCode()!==200)throw new Error('Access required');
    const record=JSON.parse(response.getContentText());
    if(record.committee.record_id!==target)throw new Error('Record mismatch');
    const doc=DocumentApp.openById(target),body=doc.getBody();
    // Only generated records are replaceable; previous versions remain in Docs history.
    body.clear();
    pbHeading(body,record.committee.name+' | Living Record',DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph('RCAP • School year 2026-27');
    body.appendParagraph('Generated from the committee website. Contribute and discuss on the website; keep free-form notes in the original editable playbook. This generated record is refreshed when members save or choose Save record to Drive.');
    body.appendParagraph('Website: https://wearercap.org/committee-playbook/?committee='+input.committee);
    body.appendParagraph('Committee folder: https://drive.google.com/drive/folders/'+record.committee.folder_id);
    body.appendParagraph('Original editable playbook: https://docs.google.com/document/d/'+record.committee.doc_id+'/edit');
    body.appendParagraph('Record refreshed: '+new Date(record.exported_at).toISOString());
    Object.keys(PB_SECTIONS).forEach(function(section){
      pbHeading(body,PB_SECTIONS[section],DocumentApp.ParagraphHeading.HEADING1);
      const entries=record.entries.filter(function(x){return x.section===section;});
      if(!entries.length)body.appendParagraph('This chapter is ready for the committee’s experience.');
      entries.forEach(function(x){
        pbHeading(body,x.question_text,DocumentApp.ParagraphHeading.HEADING2);
        body.appendParagraph(x.author_name+' • '+x.kind+' • '+(x.agreed?'Group agreement':'Contribution, not a group decision')+' • '+new Date(x.updated_at).toISOString());
        body.appendParagraph(x.content);
        record.comments.filter(function(c){return c.entry_id===x.id;}).forEach(function(c){body.appendParagraph('Reply from '+c.author_name+' ('+new Date(c.created_at).toISOString()+'): '+c.content);});
      });
      const questions=record.questions.filter(function(q){return q.section===section;});
      if(questions.length){pbHeading(body,'Questions that grew from the conversation',DocumentApp.ParagraphHeading.HEADING2);questions.forEach(function(q){body.appendParagraph(q.title);});}
    });
    pbHeading(body,'What’s next',DocumentApp.ParagraphHeading.HEADING1);
    if(!record.actions.length)body.appendParagraph('Choose the first useful steps together.');
    record.actions.forEach(function(a){pbHeading(body,a.title,DocumentApp.ParagraphHeading.HEADING2);body.appendParagraph('Owner: '+(a.owner_name||'To agree')+' | Due: '+(a.due_date||'To agree')+' | Status: '+a.status);body.appendParagraph('Done when: '+(a.done_when||'To agree'));});
    pbHeading(body,'Earlier contributions and decisions',DocumentApp.ParagraphHeading.HEADING1);
    if(!record.history.length)body.appendParagraph('Earlier versions will appear here when contributions or agreements change.');
    record.history.forEach(function(h){const x=h.snapshot;pbHeading(body,x.question_text,DocumentApp.ParagraphHeading.HEADING2);body.appendParagraph(x.author_name+' • earlier version preserved '+h.saved_at+' • '+(x.agreed?'Previously agreed':'Contribution'));body.appendParagraph(x.content);});
    body.appendParagraph('We are not telling next year’s committee what to do. We are giving them a better place to start.');
    doc.saveAndClose();
    return pbJson({ok:true,doc_url:'https://docs.google.com/document/d/'+target+'/edit',synced_at:new Date().toISOString()});
  }catch(error){return pbJson({ok:false,error:'Drive record could not be updated. Your website contributions remain saved.'});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
function pbHeading(body,text,style){return body.appendParagraph(text).setHeading(style);}
function pbJson(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
