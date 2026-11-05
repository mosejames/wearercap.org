// Reuse the official outlined wordmark; remove the small descriptor for icon legibility.
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const source = await readFile('public/brand/we-are-rcap-reversed.svg','utf8');
const paths = [...source.matchAll(/<path\b[^>]*\/>/g)].map(m=>m[0]);
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" width="430" height="193" viewBox="0 0 430 193">${body}</svg>`;
async function bounds(body) {
 const {info}=await sharp(Buffer.from(wrap(body))).trim().toBuffer({resolveWithObject:true});
 return {x:-info.trimOffsetLeft,y:-info.trimOffsetTop,w:info.width,h:info.height};
}
const letters = await Promise.all([0,1,3,4,5].map(async index=>({path:paths[index],box:await bounds(paths[index])})));
const main = paths.slice(6,10).join('');
const box = await bounds(main);
const scale = 2.5, width = 400;
const gap = (width-letters.reduce((sum,l)=>sum+l.box.w*scale,0))/4.6;
let x=56;
const heading = letters.map(({path,box},index)=>{const part=`<g transform="translate(${x} 172) scale(${scale}) translate(${-box.x} ${-box.y})">${path}</g>`;x+=box.w*scale+gap*[1,1.6,1,1,0][index];return part;}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="We Are RCAP"><rect width="512" height="512" fill="#14315b"/>${heading}<g transform="translate(56 238) scale(${width/box.w}) translate(${-box.x} ${-box.y})">${main}</g></svg>`;
await writeFile('public/app-assets/we-are-rcap-icon.svg',svg);
for(const size of [180,192,512]) await sharp(Buffer.from(svg)).resize(size).png().toFile(`public/app-assets/we-are-rcap-${size}.png`);
const safe = await sharp(Buffer.from(svg)).resize(448).png().toBuffer();
await sharp({create:{width:512,height:512,channels:4,background:'#14315b'}}).composite([{input:safe,left:32,top:32}]).png().toFile('public/app-assets/we-are-rcap-maskable.png');
