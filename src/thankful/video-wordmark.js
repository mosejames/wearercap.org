const LOGO = '/images/we-are-rcap-logo.png';
const FONT_URL = '/presentations/_player/fonts/archivo-latin-900-normal.woff2';
// The transparent gap between ARE and RCAP in the original PNG.
const LINE_SPLIT = 589 / 880;
let fontReady;

export async function loadVideoWordmark(ctx, width, height, duration) {
  const logo = new Image();
  logo.src = LOGO;
  fontReady ??= new FontFace('RCAP video', `url("${FONT_URL}")`, { weight: '900' })
    .load().then((font) => document.fonts.add(font))
    .catch((error) => { fontReady = undefined; throw error; });
  await Promise.all([logo.decode(), fontReady]);

  const markWidth = Math.round(width * .24);
  const scale = markWidth / logo.naturalWidth;
  const markHeight = logo.naturalHeight * scale;
  const x = Math.round(width * .07);
  const y = height - Math.round(height * .14) - markHeight;
  const split = Math.round(logo.naturalHeight * LINE_SPLIT);
  const lineY = y + split * scale;
  const lineHeight = markHeight - split * scale;
  const rollDuration = Math.min(.48, duration * .2);
  const firstRoll = Math.min(2.4, duration * .32);
  const secondRoll = duration >= 10 ? Math.min(6.5, duration * .62) : Infinity;

  // Match the visible cap height of the original artwork's third line.
  ctx.font = '900 100px "RCAP video"';
  const capHeight = ctx.measureText('H').actualBoundingBoxAscent;
  const font = `900 ${(265 * scale * 100) / capHeight}px "RCAP video"`;
  ctx.font = font;
  const words = ['THANKFUL.', 'GRATEFUL.'].map((text) => ({
    text, left: ctx.measureText(text).actualBoundingBoxLeft,
  }));
  const baseline = y + markHeight - 8 * scale;

  function drawLine(index, offset) {
    if (index === 0) {
      ctx.drawImage(logo, 0, split, logo.naturalWidth, logo.naturalHeight - split,
        x, lineY + offset, markWidth, lineHeight);
      return;
    }
    const word = words[index - 1];
    ctx.font = font;
    ctx.fillStyle = '#fff';
    ctx.fillText(word.text, x + word.left, baseline + offset);
  }

  return (seconds) => {
    if (seconds < firstRoll) {
      ctx.drawImage(logo, x, y, markWidth, markHeight);
      return;
    }

    ctx.drawImage(logo, 0, 0, logo.naturalWidth, split, x, y, markWidth, split * scale);
    const index = seconds >= secondRoll ? 1 : 0;
    const start = index === 1 ? secondRoll : firstRoll;
    const progress = Math.min(1, (seconds - start) / rollDuration);
    const offset = lineHeight * (progress * progress * (3 - 2 * progress));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, lineY, width - x * 2, lineHeight);
    ctx.clip();
    if (progress < 1) drawLine(index, -offset);
    drawLine(index + 1, lineHeight - offset);
    ctx.restore();
  };
}
