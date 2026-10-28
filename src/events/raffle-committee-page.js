import overallData from './raffle-results.json';
import { findStudentsByName } from './raffleResults.js';
import { studentCard } from './raffleStudentCard.js';
const editions = Object.values(import.meta.glob('./raffle-weeks/*.json', { eager: true, import: 'default' })).sort((a,b) => b.period.id.localeCompare(a.period.id));
const $ = key => document.querySelector(`[data-rr="${key}"]`);
let lookupData = overallData;
let lookupOverall = true;
let weekNumber = 1;
const option = (value, text) => { const node = document.createElement('option'); node.value = value; node.textContent = text; return node; };
$('period').append(option('overall', 'Overall · latest posted totals'), ...editions.map((edition,index) => option(edition.period.id, `Week ${editions.length-index} · through ${edition.period.end}`)));
function updatePeriod() {
 const edition = editions.find(item => item.period.id === $('period').value);
 lookupOverall = !edition;
 lookupData = edition ? edition.results : overallData;
 weekNumber = edition ? editions.length - editions.indexOf(edition) : 1;
 $('snapshot-lookup').textContent = `Updated ${lookupData.asOf} Eastern. Posted results, not live tracking.`;
 $('lookup-note').textContent = lookupOverall ? 'Search by first name for overall tickets and standing.' : `Search by first name for Week ${weekNumber} tickets and standing.`;
 renderStudents();
}
function renderStudents() {
  const query = $('search').value.trim();
  const list = findStudentsByName(lookupData.students || [], query);
  $('students').replaceChildren(...list.map(student => studentCard(student, true, lookupOverall, weekNumber)));
  $('count').textContent = query.length < 2 ? 'Enter a first name to find a student.' : list.length ? `${list.length} ${list.length === 1 ? 'match' : 'matches'} found. Standing is based on ${lookupOverall ? 'all credited tickets' : 'tickets credited in this reporting period'}, not just these search results.` : 'No match yet. Check the first-name spelling. Newly credited tickets may appear in the next update.';
}
$('search').addEventListener('input', renderStudents);
renderStudents();

$('period').addEventListener('change', updatePeriod);
updatePeriod();
