export const COMMITTEES = [
  { id: 'raffle', name: 'Fall Raffle', short: 'Raffle', description: 'Build the excitement. Carry the learning forward.', folder: '1UhDKmZfOITk0Uj2YePQwaLBc-DFY-FA6', doc: '1161czHzH9NTMSRScxmUIeuwkClu56dkv4rrqzfplg04', symbol: '↗' },
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

const RAFFLE_HELP = {
 'purpose-why': 'What will raffle proceeds support, who benefits, and how will we explain that purpose to families?',
 'purpose-scope': 'What does the raffle team own? Confirm what the board, school, finance team, donors and other committees handle.',
 'purpose-success': 'Set a proposed net fundraising goal, participation goal and experience goal. Distinguish targets from approved commitments.',
 'perspective-keep': 'Which prizes, ticket offers, messages or sales moments worked before? Link results or explain what makes you think so.',
 'perspective-change': 'Where did prize collection, ticket sales, payment tracking or winner follow-up become harder than expected?',
 'perspective-fresh': 'What do new members or families need explained about the raffle? What assumptions should the team revisit?',
 'people-roles': 'Who can help with donor outreach, prize tracking, communications, sales, money reconciliation, the drawing and winner follow-up? Link the team roster.',
 'people-leadership': 'Who is the lead, who is learning alongside them, and who handles approvals when the lead is unavailable?',
 'people-norms': 'Choose your communication channel, meeting rhythm, decision process and next check-in. How will the team approve changes to prizes or messaging?',
 'people-welcome': 'Give each new volunteer a clear first task, a point person and the instructions they need for a sales shift or donor conversation.',
 'provision-have': 'List confirmed prizes, donor commitments, ticket supplies, sales tools, payment systems and approved communication channels. Link the inventory.',
 'provision-need': 'What prizes, printing, signs, supplies or help are missing? Include quantity, cost, timing and an owner to follow up.',
 'provision-budget': 'Separate gross sales from net proceeds. Capture prize costs, printing, payment fees, other expenses, approved budget and actual totals.',
 'provision-responsibility': 'For each prize or expense, who supplies it and who pays? Confirm donor commitments, restrictions, pickup arrangements and approval responsibilities.',
 'provision-receipts': 'Who approves spending and reconciles sales? Explain ticket-number tracking, cash handoff, payment records, deposits and receipt storage. Keep individual payment details in the approved finance system.',
 'plan-dates': 'Work backward from the drawing: prize confirmations, approval of the raffle rules and ticket offer, launch, reminders, sales cutoff, drawing, winner notification and prize pickup. Name who confirms required approvals before launch.',
 'plan-first': 'Choose two to four next actions, such as confirming a prize, agreeing the ticket offer or drafting the sales timeline. Add an owner, date and definition of done.',
 'plan-workflow': 'Describe the path from donor promise to prize delivery, and from ticket sale to reconciled entry, drawing, winner contact and completed pickup.',
 'plan-risks': 'What happens if a prize falls through, an entry or payment is unclear, sales are slow, a winner cannot be reached or the drawing needs to move? Name the person who decides and follows up.',
 'pass-results': 'Record gross sales, expenses, net proceeds, participation, prize delivery and progress toward the original goals. Link the final reconciliation.',
 'pass-lessons': 'Which prizes and messages connected with families? What timing, staffing or sales approach should the next raffle team keep or change?',
 'pass-trail': 'Link approved rules, donor outreach templates, prize inventory, sales calendar, ticket materials, financial summaries, winner handoff process and thank-you messages. Keep private buyer records in their approved system.',
 'pass-open': 'List outstanding prize pickups, donor thanks, expenses, reconciliations or promises. Give each one an owner, date and next action.',
 'pass-handoff': 'Name the incoming lead and handoff date. Confirm access to the folder, approved sales tools and finance contacts, and review the lessons and unfinished work together.'
};
export function questionsFor(committee) {
 return committee==='raffle' ? QUESTIONS.map(q=>({...q,help:RAFFLE_HELP[q.id]||q.help})) : QUESTIONS;
}
