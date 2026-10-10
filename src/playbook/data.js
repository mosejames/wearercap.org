export const COMMITTEES = [
  { id: 'uniform', name: 'Uniform Committee', short: 'Uniforms', description: 'Help every family find a good fit.', folder: '1EtdK_2DqIMAUsZoJz0pxTSfqkQvgzi-0', doc: '1oqqH5ehFXeAisZF_1NAez1AZyU1hJXShNawT1oIhCE4', symbol: '◇' },
  { id: 'raffle', name: 'Fall Raffle', short: 'Raffle', description: 'Build the excitement. Carry the learning forward.', folder: '1UhDKmZfOITk0Uj2YePQwaLBc-DFY-FA6', doc: '1161czHzH9NTMSRScxmUIeuwkClu56dkv4rrqzfplg04', symbol: '↗' },
  { id: 'marcom', name: 'Marketing & Communications', short: 'Marketing', description: 'Shape our voice. Build our team. Make the message matter.', folder: '1pXeiND1zX83ZHRVeAohCoGDl6E2VMhPz', doc: '18fBYlX6HVZb4TuAuOYfvvd-4rRkideEkGnYvgCUTuxU', symbol: '✳' },
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
 ['keep', 'What should we never have to learn the hard way again?', 'Bring useful experience from any team or project. Starting fresh? What good practice would you like us to try, and why?'],
 ['change', 'What was harder than it needed to be?', 'What has been difficult, or what friction do you want this new team to prevent? Suggest an approach we can test.'],
 ['fresh', 'What are we seeing with fresh eyes?', 'What could we create or do differently? Share a question, a bold idea or an assumption worth testing. New and returning voices belong here.'],
 ],
 people: [
 ['roles', 'Who is bringing what to the table?', 'Capture names, preferred contacts, skills, interests and small jobs people can own. A roster link is welcome.'],
 ['leadership', 'Who will help this group move forward?', 'Confirm a lead or interim lead, a learning partner if useful, and how leadership will be settled if still open.'],
 ['norms', 'How do we want working together to feel?', 'How will we make decisions, handle disagreements, communicate and meet? Include our channel and next meeting details.'],
 ['welcome', 'How will someone new find their place?', 'Give them a voice, a clear first task and a person to learn alongside.'],
 ],
 provision: [
 ['have', 'What do we already have that the next team should know about?', 'What skills, relationships, tools, supplies or support can we build with now? Starting from zero is useful context. Identify what we still need to create.'],
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
 ['results', 'What did we make happen?', 'As work unfolds, capture milestones and results. Just beginning? Describe the difference you hope to make and what evidence you will collect.'],
 ['lessons', 'What would you tell yourself before doing this again?', 'Capture lessons as you learn. Just beginning? Name an experiment, what you hope to learn and when we should revisit it.'],
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
 'perspective-keep': 'Which ideas from earlier raffles or other fundraisers could help? Starting fresh? Propose a prize, message or sales approach to test and explain why.',
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
 if(committee==='marcom')return QUESTIONS.map(q=>({...q,help:MARCOM_HELP[q.id]||q.help}));
 if(committee==='uniform')return QUESTIONS.map(q=>({...q,help:UNIFORM_HELP[q.id]||q.help}));
 return committee==='raffle' ? QUESTIONS.map(q=>({...q,help:RAFFLE_HELP[q.id]||q.help})) : QUESTIONS;
}

const UNIFORM_HELP = {
 'purpose-why':'How can the uniform swap help families feel prepared, welcome and supported? What experience do we want every family to have?',
 'purpose-scope':'Confirm what the committee handles for collecting, sorting, storing and sharing uniforms, and what belongs to the school or another team.',
 'purpose-success':'Choose observable goals, such as families served, usable items shared, fewer unmet size requests or an easier collection process.',
 'perspective-keep':'What collection, sorting or volunteer ideas should we build on? Use past swaps or propose a new approach to test if there is no history yet.',
 'perspective-change':'Where did condition checks, missing sizes, storage, pickup or communication become difficult? What would make it easier?',
 'perspective-fresh':'What do new families need explained about donating or finding uniforms? What assumptions should returning volunteers revisit?',
 'people-roles':'Who owns donations, condition checks, inventory, size sorting, storage, family communications, event setup and pickup?',
 'people-leadership':'Who is the chair, who is learning the role, and who can coordinate when the chair is unavailable?',
 'people-norms':'Agree your communication channel, meeting rhythm, decision process and next check-in. How will volunteers hand tasks to one another?',
 'people-welcome':'Give a new volunteer a point person and a clear first job, such as labeling bins, sorting one size or helping with pickup.',
 'provision-have':'List usable uniforms by type and size, racks, hangers, bins, signs and storage space. Where are they, and who has access?',
 'provision-need':'Which sizes or uniform items are in short supply? What racks, bags, labels or help do we need, in what quantity and by when?',
 'provision-budget':'Capture requested and approved costs for bins, hangers, cleaning, labels, transport or events, then compare estimates with actual spending.',
 'provision-responsibility':'Who supplies storage, cleaning materials, transport and missing items? Confirm what families, the school and the committee have agreed to provide.',
 'provision-receipts':'Who approves purchases, how are expenses reimbursed, and where do receipts and inventory records live?',
 'plan-dates':'Plan donation windows, sorting days, family communications, swap events, pickup times, cleanup and inventory checks.',
 'plan-first':'Choose two to four next steps. Name the owner, due date and definition of done for each, then add them to What’s next.',
 'plan-workflow':'Explain the journey from donated item through condition check, sorting, inventory, storage and family pickup. Confirm handling of unusable or unclaimed items.',
 'plan-risks':'What if a needed size is unavailable, storage fills up or a pickup is missed? Name the person who follows up and the backup plan.',
 'pass-results':'How many families and usable items did we serve? Which needs remain? Link summary inventory and results without including private family circumstances.',
 'pass-lessons':'What should next year’s team keep, change or start earlier about collection, sorting, events and communications?',
 'pass-trail':'Link inventory, bin labels and photos, storage instructions, collection messages, event checklists and key decisions. Keep family-specific requests in the approved private channel.',
 'pass-open':'List unfinished sorting, outstanding pickups, supply needs or storage issues. Add an owner, due date and next action.',
 'pass-handoff':'Name the incoming chair, handoff date and access contact. Review inventory, storage access, volunteer roles, lessons and unfinished work together.'
};
export function committeeInviteUrl(committee,origin) {
 const url=new URL(committee==='uniform'?'/uniform-playbook/':committee==='raffle'?'/raffle-playbook/':'/committee-playbook/',origin);
 url.searchParams.set('committee',committee);return url.href;
}
export function committeeInvitation(committeeName,email,url) {
 return `You’re invited to help build the ${committeeName} living playbook.\n\nHelp shape the team we want to be: our purpose, responsibilities, ideas and ways of working. No past committee experience is needed. Bring a first thought or a question, and build on one another’s ideas. Answer one question or keep going at your own pace.\n\nOpen: ${url}\nSign in with: ${email}\n\nYour contributions and replies will be shared with our committee and credited to your name.`;
}

const MARCOM_HELP = {
 'purpose-why':'This is our first year. What should Marketing & Communications make possible for RCAP and its families? What do we want people to understand, feel or do?',
 'purpose-scope':'Design our scope together. What should we own, support or refer elsewhere? Discuss event promotion, committee requests, storytelling and who approves school or RCAP messages. These are proposals until agreed.',
 'purpose-success':'What would a strong first year look like? Choose a few signs of clearer communication, participation or belonging, and agree how we will learn what is working.',
 'perspective-keep':'We do not need a past committee to begin. What communication, creative or volunteer experience can each person bring? What good practice should we try?',
 'perspective-change':'What communication gaps do families or committees experience today? What could this new team make simpler, clearer or more welcoming?',
 'perspective-fresh':'If we could build this team from scratch, what would we create? Bring ideas for our voice, channels, stories and ways to listen. What assumptions should we test?',
 'people-roles':'What strengths and interests does each person bring? Explore writing, design, photography, planning, outreach and coordination. Invite people to shape roles before assigning them.',
 'people-leadership':'How can the chair help people contribute and grow? Agree who coordinates, who is learning alongside them and who can help when someone is unavailable.',
 'people-norms':'What kind of creative team do we want to be? Agree how we share ideas, give feedback, make decisions and include different voices, plus our channel and meeting rhythm.',
 'people-welcome':'How will a new member feel welcome and useful? Offer a small first contribution, a point person and room to suggest something new.',
 'provision-have':'What can we build with now: people, skills, brand materials, photos, templates, approved channels and relationships? Identify access we need to confirm.',
 'provision-need':'What tools, training, creative support or information would help us begin? Separate essentials for our first project from ideas for later.',
 'provision-budget':'What might our proposed work cost? Estimate design, printing, tools or other needs. Distinguish ideas and requests from approved spending.',
 'provision-responsibility':'Who owns each channel, provides source information and approves publication? Confirm what RCAP, the school and requesting committees each handle.',
 'provision-receipts':'How will tool subscriptions, purchases and reimbursement be approved and recorded? Identify an owner and the receipt folder before spending.',
 'plan-dates':'What should we build first? Map a realistic first project, listening period, approval checkpoints and communication calendar together.',
 'plan-first':'Choose two to four small first steps: listen to families, draft our scope, gather assets or try a pilot message. Give each an owner, date and definition of done.',
 'plan-workflow':'Design a simple path from a committee request to a brief, draft, feedback, approval, publication and learning. Who owns each handoff?',
 'plan-risks':'What could overwhelm a new team? Discuss unclear requests, approval delays, missing information or too many channels. Set boundaries and a way to ask for help.',
 'pass-results':'As we begin, record small milestones and what we learn from our first projects. Which signs will tell us our communication is helping?',
 'pass-lessons':'What are our early experiments teaching us? Capture what to keep, change or test next, even while the team is still taking shape.',
 'pass-trail':'Create a useful home for our emerging scope, brand guidance, templates, calendar, approval process and decisions. Identify the owner of each resource.',
 'pass-open':'Which ideas, questions or decisions remain open? Keep promising ideas visible without treating them as commitments. Choose the next step when ready.',
 'pass-handoff':'How will someone else understand and carry forward the team we are building? Document roles, access contacts and the reasons behind our choices as we go.'
};
