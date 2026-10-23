export const CAMPAIGN_LINKS={
 tickets:'https://www.zeffy.com/en-US/ticketing/ron-clark-academy-parents-fall-fundraiser--2026',
 share:'https://wearercap.org/events/2026/fall-raffle/share/',
 raffleDetails:'https://wearercap.org/events/2026/fall-raffle/',
 trunkDetails:'https://wearercap.org/events/2026/trunk-or-treat/',
 volunteer:'https://www.signupgenius.com/go/10C0E4EADAD28A0FEC43-66825818-trunk',
 committees:'https://wearercap.org/board/#committees',
 membership:'https://www.paypal.com/ncp/payment/EWP8R298MW83A',
 bingo:'https://wearercap.org/rcap-capsule/#/e/bingo-night',
 chickfila:'https://wearercap.org/rcap-capsule/#/e/chick-fil-a-spirit-night',
 survey:'https://wearercap.org/feedback/rb-karaoke',
 calendar:'https://wearercap.org/rca-calendar-2026-2027.pdf'
};
export function campaignLinks(html,issue='current',signedLinks={}) {
 return html.replace(/href="([^"]+)"/g,(all,url)=>{
  const decoded=url.replace(/&amp;/g,'&').replace(/&quot;/g,'\"').replace(/&#39;/g,"'");
  if(Object.hasOwn(signedLinks,decoded))return `href="${signedLinks[decoded].replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`;
  const key=Object.keys(CAMPAIGN_LINKS).find(k=>CAMPAIGN_LINKS[k]===url);
  return key?`href="https://wearercap.org/api/campaign-activity?link=${key}&amp;issue=${encodeURIComponent(issue)}"`:all;
 });
}
