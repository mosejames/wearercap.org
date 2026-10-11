export const REPORT_URL='https://docs.google.com/document/d/1piDV7MlTP6Sbb1USMNvLDgX0kvovzXpDVMhEZs5hLIk/edit';
export const FOLDER_URL='https://drive.google.com/drive/folders/17dYF3_FPx_tMTbyLvxKg3CBuyGwiERNV';
export const SECTIONS=[
 {id:'evening',name:'The evening',title:'Take us back to the evening.',intro:'The emails tell us what was planned. You can tell us what actually happened.',questions:[
  {id:'flow',title:'How did the evening unfold?',help:'Actual start and finish, arrival, food and drinks, karaoke, and cleanup. A few sentences are enough.',placeholder:'We opened the doors at…'},
  {id:'attendance',title:'How many people came?',help:'Add the RSVP count, actual turnout, and how you counted. An estimate is useful if you label it.',placeholder:'We had ___ RSVPs. About ___ people attended, based on…'},
  {id:'people',title:'Who made it happen?',help:'Who handled setup, welcoming, hosting, vendors, equipment, and breakdown?',placeholder:'Setup: …  Hosting: …  Cleanup: …'},
  {id:'equipment',title:'What did you use for sound and lyrics?',help:'Was it the rolling Promethean board? Add cables, connection steps, who operated it, and any backup or issues.',placeholder:'The DJ connected…'}]},
 {id:'money',name:'The money',title:'Help us close the money trail.',intro:'An approved request is different from a completed payment. Share what you can verify; Latasha can finish the ledger.',questions:[
  {id:'approval',title:'What budget was actually approved?',help:'Add the amount and where approval is recorded. The planning proposal still needs confirmation.',placeholder:'The approved budget was… Approval is in…'},
  {id:'food',title:'Can you clear up the catering request?',help:'The reimbursement email subject and body give different amounts. What should RCAP reimburse, and was it paid?',placeholder:'The correct reimbursement is…'},
  {id:'decor',title:'Does the décor receipt belong to this event?',help:'The Royalty Seating receipt shows a prior-year service date. Confirm the event/year or explain the correction needed.',placeholder:'This is the right invoice because…'},
  {id:'overage',title:'What happened with the proposed overage split?',help:'Was a personal contribution or reimbursement reduction actually completed? Give the amounts and people, or mark it pending.',placeholder:'We agreed… What actually happened was…'}]},
 {id:'learning',name:'Next time',title:'Give the next team a head start.',intro:'This is the part the next organizer will be grateful to find.',questions:[
  {id:'facilities',title:'What is the correct school notification process?',help:'Who needs to approve it, add it to the calendar, and notify cleaning/security? Confirm contacts and lead time, or name who can confirm.',placeholder:'First contact… Then… Allow ___ days…'},
  {id:'lessons',title:'What should we keep, change, or prepare differently?',help:'Best moment, delays, vendor recommendations, food portions, leftovers, seating, décor to reuse, and advice you would give yourself.',placeholder:'Keep… Change… Before next time…'},
  {id:'materials',title:'What else should go in the archive?',help:'Add links to invitation graphics, the run of show, RSVP totals, equipment instructions, or other useful materials.',placeholder:'The final invitation is at…'}]}
];
export const QUESTIONS=SECTIONS.flatMap(s=>s.questions.map(q=>({...q,section:s.name})));
export const VENDORS=[{id:'dj',name:'DJ / karaoke'},{id:'catering',name:'Moe’s catering'},{id:'bartender',name:'Amaysing Mixers Elite'},{id:'decor',name:'Royalty Seating décor'}];
export const EMPTY={answers:{},vendors:{},name:'',finalNote:''};
export function progress(draft){return QUESTIONS.filter(q=>draft.answers?.[q.id]?.status&&draft.answers[q.id].status!=='unanswered').length;}
export function unresolved(draft){return QUESTIONS.filter(q=>!draft.answers?.[q.id]?.status||['unanswered','pending','unknown'].includes(draft.answers[q.id].status));}
export function moneyFlags(draft,reference={}){const flags=[];for(const v of VENDORS){const row=draft.vendors?.[v.id]||{};if(row.cost!==''&&row.cost!=null&&reference[v.id]!=null&&Number(row.cost)!==Number(reference[v.id]))flags.push(`${v.name}: the cost differs from the archived record. Review the evidence before changing the closeout total.`);if(['paid','reimbursed'].includes(row.status)&&(!row.date||!row.evidence?.trim()))flags.push(`${v.name}: add a payment date and evidence or leave it for reconciliation.`);}return flags;}
export function validateDraft(d){if(!d||typeof d!=='object'||Array.isArray(d))return false;if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80)return false;return JSON.stringify(d).length<=50000;}
