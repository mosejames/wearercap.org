import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
await mkdir('public/app-assets',{recursive:true});
await sharp('public/images/rcap-community-smiles.jpg').extract({left:560,top:0,width:1100,height:1200}).resize(700,850,{fit:'cover'}).jpeg({quality:84}).toFile('public/app-assets/community.jpg');
const logo=await sharp('public/brand/we-are-rcap-reversed.svg').resize(330).png().toBuffer();
for(const size of [180,192,512]){
 const width=Math.round(size*.67);
 const artwork=await sharp('public/brand/we-are-rcap-reversed.svg').resize(width).png().toBuffer();
 const meta=await sharp(artwork).metadata();
 await sharp({create:{width:size,height:size,channels:4,background:'#14315b'}}).composite([{input:artwork,left:Math.round((size-width)/2),top:Math.round((size-meta.height)/2)}]).png().toFile(`public/app-assets/icon-${size}.png`);
}
await sharp('public/app-assets/icon-512.png').toFile('public/app-assets/icon-maskable.png');
const bg=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#14315b"/><circle cx="1180" cy="15" r="280" fill="#1a3d6c"/><rect x="64" y="249" width="44" height="5" rx="2" fill="#f7b32b"/><text x="64" y="331" fill="#ffffff" font-size="69" font-family="Arial" font-weight="bold" letter-spacing="-2">Your RCAP.</text><text x="64" y="409" fill="#f8c65d" font-size="72" font-family="Georgia" font-style="italic">Right here.</text><text x="66" y="475" fill="#d7e2ec" font-size="22" font-family="Arial">Newsletters. Resources. Memories.</text><text x="66" y="556" fill="#f8c65d" font-size="16" font-family="Arial" letter-spacing="3">WEARERCAP.ORG/APP</text></svg>`);
const photo=await sharp('public/app-assets/community.jpg').resize(420,510).composite([{input:Buffer.from('<svg width="420" height="510"><rect width="420" height="510" rx="24" fill="white"/></svg>'),blend:'dest-in'}]).png().toBuffer();
await sharp(bg).composite([{input:logo,left:64,top:54},{input:photo,left:716,top:60}]).jpeg({quality:92}).toFile('public/app-assets/share.jpg');
