import { prepareImage } from './images.js';

export const isVideo = (file) => /^video\//i.test(file.contentType || file.type || '') || /\.(mp4|mov|webm)$/i.test(file.name || file.key || '');
export function videoFormat(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  const formats = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
  if (formats[ext]) return { ext, contentType: formats[ext] };
  const match = Object.entries(formats).find(([, mime]) => mime === file.type);
  if (match) return { ext: match[0], contentType: match[1] };
  throw new Error('Use an MP4, MOV, or WebM video.');
}

export async function prepareVideo(file) {
  const format = videoFormat(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(file);
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Video preview timed out. Try a shorter MP4 clip.')), 20000);
      video.onerror = () => reject(new Error('This browser cannot read this video. Export it as an H.264 MP4 and try again.'));
      video.onloadeddata = resolve;
      video.src = url;
      video.load();
    });
    clearTimeout(timer);
    if (!video.videoWidth || !video.videoHeight) throw new Error('This video has no readable picture.');
    const scale = Math.min(1, 1800 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .85));
    if (!blob) throw new Error('Could not make a video thumbnail.');
    const poster = await prepareImage(new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
    return { ...poster, ...format, name: file.name, orig: file, width: video.videoWidth, height: video.videoHeight,
      takenAt: file.lastModified ? new Date(file.lastModified) : null };
  } finally {
    clearTimeout(timer);
    video.onloadeddata = null; video.onerror = null;
    video.removeAttribute('src'); video.load();
    URL.revokeObjectURL(url);
  }
}
