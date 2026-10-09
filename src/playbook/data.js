export const COMMITTEES = [
  { id: 'marcom', name: 'Marketing & Communications', short: 'Marketing', description: 'Make the message matter.', folder: '1pXeiND1zX83ZHRVeAohCoGDl6E2VMhPz', doc: '18fBYlX6HVZb4TuAuOYfvvd-4rRkideEkGnYvgCUTuxU', symbol: '✳' },
  { id: 'men', name: 'Men of RCAP', short: 'Men of RCAP', description: 'Show up. Build something lasting.', folder: '1I9vwzU5uj76AJEwdnsawxpQyltT_9zts', doc: '1Ciz10tVUmgZ4pqUHDuuZbW1OCGslcRowO4eCVgxhWf8', symbol: '↗' },
  { id: 'trunk', name: 'Trunk or Treat', short: 'Trunk or Treat', description: 'A little magic. A lot of teamwork.', folder: '1fXwtQP9MtLyXCdFhA25o42ey-WKZniOS', doc: '1reeVoeYFcCQbyg9QaGNEnF5fNNePxxoKenIZ1lnDNnA', symbol: '✦' },
];
export const PS = [
  { id: 'purpose', name: 'Purpose', line: 'Start with why.', icon: '◎' },
  { id: 'perspective', name: 'Perspective', line: 'Experience is a gift.', icon: '◒' },
  { id: 'people', name: 'People', line: 'Everyone brings something.', icon: '◌' },
  { id: 'provision', name: 'Provision', line: 'Know what you have.', icon: '◇' },
  { id: 'plan', name: 'Plan', line: 'Give good intentions a next step.', icon: '↗' },
  { id: 'pass', name: 'Pass It On', line: 'Leave a better starting point.', icon: '✳' },
];
const sectionQuestions = {
 purpose: [
 ['why', 'What difference is this group here to make?', 'Who do we serve, and what do we want them to experience?'],
 ['scope', 'What belongs to us, and what belongs to someone else?', 'Think about responsibilities, partner organizations and where our role begins and ends.'],
 ['success', 'At the end of the year, what would make us proud?', 'Choose one or two results we can actually observe or measure.'],
 ],
 perspective: [
 ['keep', 'What should we never have to learn the hard way again?', 'Share something that worked, why it worked, and what the next team should keep.'],
 ['change', 'What was harder than it needed to be?', 'What happened, what got in the way, and what could we try differently?'],
 ['fresh', 'What are we seeing with fresh eyes?', 'New members: what are you wondering? Returning members: what context would help?'],
 ],
 people: [
 ['roles', 'Who is bringing what to the table?', 'Capture names, preferred contacts, skills, interests and small jobs people can own. A roster link is welcome.'],
 ['leadership', 'Who will help this group move forward?', 'Confirm a lead or interim lead, a learning partner if useful, and how leadership will be settled if still open.'],
 ['norms', 'How do we want working together to feel?', 'How will we make decisions, handle disagreements, communicate and meet? Include our channel and next meeting details.'],
 ['welcome', 'How will someone new find their place?', 'Give them a voice, a clear first task and a person to learn alongside.'],
 ],
 provision: [
 ['have', 'What do we already have that the next team should know about?', 'Supplies, equipment, vendor relationships and borrowed items. Where are they, who has access, and what must be returned?'],
 ['need', 'What would make this work easier?', 'Be specific about what is missing, broken or wearing out. Include quantity, size, timing, likely cost and who can follow up.'],
 ['budget', 'What does the work really cost?', 'Requested and approved budgets, currency, estimates versus actual spending, funding sources and how the numbers were built.'],
 ['responsibility', 'Who should provide or pay for what we need?', 'Who operates the activity, who benefits, and what have the parties agreed to provide? Record questions as questions until confirmed.'],
 ['receipts', 'How will we keep the money trail clear?', 'Who approves spending? How do reimbursement and receipts work? Link the receipt folder.'],
 ],
 plan: [
 ['dates', 'What needs to happen, and when should we start?', 'Planning start, event dates or active period, approvals, communications, shifts, delivery and cleanup.'],
 ['first', 'What are the next two to four useful steps?', 'For each: what is the action, who owns it, when is it due, and what does done look like? Add it to What’s next.'],
 ['workflow', 'How does the work move from beginning to end?', 'Describe how a request, recurring task or volunteer shift moves through the group.'],
 ['risks', 'What could get in our way?', 'Dependencies, backup plans and help or decisions needed. Who should respond, by when, and who will follow up?'],
 ],
 pass: [
 ['results', 'What did we make happen?', 'Return to our success measures. What did we deliver, and what evidence or results should we leave?'],
 ['lessons', 'What would you tell yourself before doing this again?', 'What should the next group keep, change or start earlier? Capture lessons while they are fresh.'],
 ['trail', 'Where can the next team find everything?', 'Link timelines, templates, budgets, actual costs, receipts, inventory, bin photos, storage instructions, vendor contacts and key decisions.'],
 ['open', 'What is still unfinished?', 'Open tasks, risks, unpaid costs and promises. Add a next action, owner and due date for each.'],
 ['handoff', 'Who is ready to carry this forward?', 'Who is learning the role? What should they know first, and when should they start? Record the incoming lead, handoff date, folder access contact and who reviewed it together.'],
 ],
};
export const QUESTIONS = PS.flatMap(p => sectionQuestions[p.id].map(([key,title,help])=>({id:`${p.id}-${key}`,section:p.id,title,help})));
export function nextQuestion(questions, entries, userId, currentId) {
 const current=questions.findIndex(q=>q.id===currentId);
 const ordered=[...questions.slice(current+1),...questions.slice(0,current+1)];
 return ordered.find(q=>!entries.some(e=>e.question_id===q.id&&e.author_id===userId)) || ordered[0];
}
export function suggestedFollowups(entry) {
 const text=entry.content.toLowerCase(); const questions=[];
 if (/need|buy|bags?|suppl|cost|budget|equip|broken|repair|ice|storage/.test(text)) {
  questions.push({section:'provision',title:'What exactly is needed, in what quantity or size, and by when?'});
  questions.push({section:'provision',title:'Who should provide or pay for this, and has that responsibility been confirmed?'});
 }
 if (/hard|late|long|time|delay|setup|set.up|earlier/.test(text)) questions.push({section:'plan',title:'How much time should next year’s team allow, and what can be prepared beforehand?'});
 if (/store|storage|box|boxes|tree|equipment|suppl/.test(text)) questions.push({section:'pass',title:'Where will this be stored, and who can help the next team access it?'});
 if (!questions.length) questions.push({section:entry.section,title:'What practical detail would help the next team put this insight to use?'});
 return questions.slice(0,3);
}
export const docUrl=id=>`https://docs.google.com/document/d/${id}/edit`;
export const folderUrl=id=>`https://drive.google.com/drive/folders/${id}`;
