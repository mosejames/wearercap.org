export const PHOTO_INPUT_MAX = 30 * 1024 * 1024;
export const VIDEO_MAX = 50 * 1024 * 1024;
export function fitImage(width, height, max = 1600) {
 const ratio = Math.min(1, max / Math.max(width,height));
 return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}
export async function optimizePhoto(file) {
 if(file.size > PHOTO_INPUT_MAX) throw new Error('Choose a photo under 30 MB.');
 const heic=/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
 if(!heic && !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP, or HEIC photo.');
 let source=file;
 if(heic) {const {heicTo}=await import('heic-to');source=await heicTo({blob:file,type:'image/jpeg',quality:.9});}
 const url=URL.createObjectURL(source), img=new Image();
 try {
  img.src=url;await img.decode();
  const {width,height}=fitImage(img.naturalWidth,img.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx) throw new Error('Your browser could not prepare this photo.');
  ctx.drawImage(img,0,0,width,height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));
  canvas.width=canvas.height=0;
  if(!blob || blob.size>5*1024*1024) throw new Error('This photo could not be made small enough. Please choose another.');
  return blob;
 } catch(e) {throw new Error(e.message || 'Could not read this photo. Try a JPG or PNG.');}
 finally {URL.revokeObjectURL(url);}
}
export function validateVideo(file) {
 if(!['video/mp4','video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video. Export iPhone videos as MP4 for best compatibility.');
 if(file.size>VIDEO_MAX) throw new Error('Choose a video under 50 MB.');
}
