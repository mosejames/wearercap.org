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
  headlineY:gold?157:165,headlineSize:gold?54:58,
  bylineY:gold?334:105,byline,bylineSize:byline.length>80?17:byline.length>55?19:23,
  supportY:gold?406:374,supportX:gold?210:600,
  ticket:gold?{x:290,y:460,w:390,h:38}:{x:813,y:475,w:340,h:90},
 };
}
export function wrapName(text,maxChars) {
 const words=text.split(/\s+/);const lines=[];let line='';
 for(const original of words){const pieces=original.match(new RegExp(`.{1,${maxChars}}`,'g'))||[''];for(const word of pieces){if(line && `${line} ${word}`.length>maxChars){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;}}
 if(line)lines.push(line);return lines;
}
