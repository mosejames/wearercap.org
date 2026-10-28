const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; };
export function studentCard(student, showTickets = false, isOverall = false, weekNumber = 1) {
  const item = el('li', 'rr-student-card');
  const info = el('div');
  info.append(el('h3', null, student.name), el('p', null, `Class of ${student.classOf || 'not given'} · ${student.house || 'House not given'}`));
  const standing = el('div', 'rr-standing');
  if (showTickets) standing.append(el('strong', null, `${student.amount.toLocaleString('en-US')} tickets`));
  standing.append(el(showTickets ? 'span' : 'strong', null, showTickets ? `No. ${student.rank} ${isOverall ? 'overall' : 'in Week ' + weekNumber}` : `No. ${student.rank} raffle star`));
  if (!showTickets) standing.append(el('span', null, isOverall ? 'Overall' : `Week ${weekNumber}`));
  item.append(info, standing);
  return item;
}
