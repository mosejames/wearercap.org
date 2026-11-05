// Public family destinations only. Keep app categories and search in one registry.
// Stable destinations show current content without duplicating newsletters or galleries.
export const links = [
  { id:'newsletter', title:'RCAP Newsletters', detail:'The latest notes and every published issue.', href:'/newsletter', icon:'Newspaper', group:'updates', color:'gold' },
  { id:'calendar', title:'School Calendar', detail:'The official RCA 2026–2027 calendar.', href:'/rca-calendar-2026-2027.pdf', icon:'CalendarDays', group:'resources', color:'blue' },
  { id:'capsule', title:'RCAP Capsule', detail:'All-school memories. Find an album or add your own.', href:'/rcap-capsule/', icon:'Camera', group:'photos', color:'rose' },
  { id:'uniforms', title:'Uniform Exchange', detail:'Find, request, and pass along gently loved uniforms.', href:'/uniform-exchange/', icon:'Shirt', group:'resources', color:'green' },
  { id:'carpool', title:'Carpool', detail:'Connect with RCA families heading your way.', href:'/carpool/', icon:'Car', group:'resources', color:'blue' },
  { id:'volunteer', title:'Serve at EXP', detail:'Find a shift and see the EXP schedule.', href:'/invite/', icon:'HandHeart', group:'involved', color:'gold' },
  { id:'hours', title:'Log Volunteer Hours', detail:'Record your service in Track It Forward.', href:'https://www.trackitforward.com/site/the-ron-clark-academy', icon:'Clock', group:'involved', color:'green' },
  { id:'collective', title:'The RCAP Collective', detail:'Businesses, services, and talent in our community.', href:'/directory/', icon:'Users', group:'resources', color:'rose' },
  { id:'committee', title:'Find Your Place', detail:'Explore committees and tell us how you want to help.', href:'/committee-interest/', icon:'HeartHandshake', group:'involved', color:'gold' },
  { id:'tips', title:'One Thing I Wish I Knew', detail:'Parent tips, questions, and ideas for the board.', href:'/wish-i-knew/read/', icon:'Lightbulb', group:'resources', color:'gold' },
  { id:'howto', title:'How-to Guides', detail:'A little help using the RCAP family tools.', href:'/how-to/', icon:'BookOpen', group:'resources', color:'blue' },
  { id:'expguide', title:'What to Expect at EXP', detail:'Get to know the day before your first shift.', href:'/what-to-expect/', icon:'Compass', group:'involved', color:'green' },
  { id:'submit', title:'Share a Newsletter Story', detail:'Send news, photos, or a community highlight to RCAP.', href:'/newsletter/submit/', icon:'Send', group:'updates', color:'green' },
  { id:'raffle', title:'Fall Raffle Results', detail:'Drawings, winners, and the latest results.', href:'/events/2026/fall-raffle/results/', icon:'Ticket', group:'updates', color:'gold' },
  { id:'recap', title:'The RCAP Recap', detail:'Photos and one-word memories from our community.', href:'/rcap-recap/', icon:'Images', group:'photos', color:'gold' },
  { id:'amistad', title:'Amistad Vault', detail:'The Amistad house photo collection.', href:'/ami-vault/', icon:'Heart', group:'photos', color:'rose' },
  { id:'london', title:'Class of 2028: London', detail:'Memories from the London and Paris adventure.', href:'/2028-london/', icon:'Plane', group:'photos', color:'blue' },
  { id:'nyc', title:'NYC Trip Vault', detail:'Find memories from the New York adventure.', href:'/nyc-vault/', icon:'Building2', group:'photos', color:'green' },
  { id:'m3', title:'M³ Vault', detail:'Class of 2028 Mall Math Marathon memories.', href:'/m3-vault/', icon:'Camera', group:'photos', color:'gold' },
  { id:'board', title:'Your RCAP Board', detail:'Meet the parents helping make it all happen.', href:'/board/', icon:'Users', group:'contact', color:'blue' },
  { id:'email', title:'Email RCAP', detail:'hello@wearercap.org', href:'mailto:hello@wearercap.org', icon:'Mail', group:'contact', color:'gold' },
  { id:'instagram', title:'RCAP on Instagram', detail:'Follow along with @rcaparents.', href:'https://www.instagram.com/rcaparents/', icon:'Instagram', group:'contact', color:'rose' },
  { id:'checks', title:'Check Requests', detail:'Submit an RCAP reimbursement or payment request.', href:'/check-requests/', icon:'ClipboardList', group:'resources', color:'green' },
];
export const groups = {
  resources:{title:'Family resources', intro:'Less hunting. More helping. Your everyday RCAP tools, together.'},
  updates:{title:'Stay in the loop', intro:'News from our community, with a place for your story, too.'},
  photos:{title:'Our shared memories', intro:'The big moments. The little moments. The people who make it RCAP.'},
  involved:{title:'Find your place', intro:'There is a place for every parent. Start here.'},
  contact:{title:'Let’s connect', intro:'Your RCAP community is a tap away.'},
};
