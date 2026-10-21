// Shared coordinates and copy keep the browser preview and saved card aligned.
export function frameLayout(frame, scholar, family) {
 const gold=frame==='gold';
 const name=scholar||'your scholar';
 const byline=scholar&&family?`From ${name} & the ${family} family`:scholar?`From ${name}`:'From your scholar & family';
 return {
  gold, photo:gold?{x:800,y:50,w:350,h:530}:{x:30,y:40,w:515,h:550},
  background:gold?'golden-ticket-v1.jpg':'autumn-postcard-v1.jpg',
  ink:gold?'#102a49':'#fff5df',accent:gold?'#102a49':'#ffc342',
  x:gold?145:600,w:gold?550:535,brandY:gold?116:62,
  headlineY:gold?145:165,headlineSize:gold?50:58,
  bylineY:gold?316:105,byline,bylineSize:byline.length>80?13:byline.length>55?18:21,
  supportY:gold?456:566,supportX:gold?213:860,
  supportLines:['Supporting RCAP’s efforts.'],
  ticketLabel:gold?'Buy $1 raffle tickets':'$1 RAFFLE TICKETS',
  supportSize:18,supportLeading:25,
  ticket:gold?{x:213,y:410,w:463,h:40}:{x:795,y:448,w:360,h:90},
 };
}
export function wrapName(text,maxChars) {
 const words=text.split(/\s+/);const lines=[];let line='';
 for(const original of words){const pieces=original.match(new RegExp(`.{1,${maxChars}}`,'g'))||[''];for(const word of pieces){if(line && `${line} ${word}`.length>maxChars){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}}
 if(line)lines.push(line);return lines;
}
