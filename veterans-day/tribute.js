const form = document.querySelector('#tribute');
const canvas = document.querySelector('#preview');
const context = canvas.getContext('2d');
const fields = Object.fromEntries(
  Array.from(form.elements).filter(element => element.id).map(element => [element.id, element])
);
const status = document.querySelector('#status');
const position = document.querySelector('#position');
const dragArea = document.querySelector('#photo-drag');
const dragHelp = document.querySelector('#drag-help');
const logo = new Image();
const flag = new Image();
let photo = null;
let photoUrl = '';
const gold = '#f8b432';
const cream = '#fff5e5';
const frame = { x: 225, y: 503, width: 630, height: 802 };
let drag = null;

function photoSize() {
  const fit = fields.crop.value === 'contain' ? Math.min : Math.max;
  const scale = fit(frame.width / photo.naturalWidth, frame.height / photo.naturalHeight)
    * Number(fields.zoom.value) / 100;
  return { width: photo.naturalWidth * scale, height: photo.naturalHeight * scale };
}

function text(value, y, size, family, color, weight = '') {
  if (!value) return;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.font = `${weight} ${size}px ${family}`.trim();
  while (context.measureText(value).width > 892 && size > 16) {
    size -= 1;
    context.font = `${weight} ${size}px ${family}`.trim();
  }
  context.fillText(value, 540, y, 892);
}

function drawPhoto() {
  const { x, y, width, height } = frame;
  context.fillStyle = '#102943';
  context.fillRect(x, y, width, height);
  if (photo) {
    const { width: drawnWidth, height: drawnHeight } = photoSize();
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.drawImage(photo, x + (width - drawnWidth) * Number(fields.horizontal.value) / 100,
      y + (height - drawnHeight) * Number(fields.vertical.value) / 100, drawnWidth, drawnHeight);
    context.restore();
  } else {
    text('Your photo here', y + height / 2, 37, 'system-ui', '#b9cadd');
  }
  context.strokeStyle = gold;
  context.lineWidth = 3;
  context.strokeRect(x, y, width, height);
}

function draw() {
  context.fillStyle = '#0b2039';
  context.fillRect(0, 0, 1080, 1920);
  if (flag.naturalWidth) context.drawImage(flag, 0, 0, 1080, 1920);
  const shading = context.createLinearGradient(0, 1080, 0, 1810);
  shading.addColorStop(0, 'transparent');
  shading.addColorStop(.58, '#06162cbb');
  shading.addColorStop(1, 'transparent');
  context.fillStyle = shading;
  context.fillRect(0, 1080, 1080, 730);
  context.strokeStyle = gold;
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(62, 157, 956, 1542, 12);
  context.stroke();
  if (logo.naturalWidth) context.drawImage(logo, 414, 230, 252, 252 * logo.naturalHeight / logo.naturalWidth);
  context.letterSpacing = '4px';
  text('NOVEMBER 11  /  VETERANS DAY', 371, 26, 'system-ui', gold, '700');
  context.letterSpacing = '0px';
  context.beginPath();
  context.moveTo(334, 441);
  context.lineTo(497, 441);
  context.moveTo(583, 441);
  context.lineTo(746, 441);
  context.stroke();
  context.fillStyle = gold;
  context.beginPath();
  context.moveTo(540, 420);
  context.quadraticCurveTo(543, 437, 561, 441);
  context.quadraticCurveTo(543, 445, 540, 462);
  context.quadraticCurveTo(537, 445, 519, 441);
  context.quadraticCurveTo(537, 437, 540, 420);
  context.fill();
  drawPhoto();
  text(fields.veteran.value.trim() || 'Veteran’s name', 1405, 112, 'Georgia, serif', cream);
  text(fields.service.value.trim(), 1503, 42, 'system-ui', gold, '650');
  const student = fields.student.value.trim();
  const relationship = fields.relationship.value.trim();
  const year = fields.year.value.trim();
  const relation = student && relationship ? `${relationship} to ${student}` : student || relationship;
  const family = [relation, year && `Class of ${year}`].filter(Boolean).join(', ');
  text(family || 'Relationship to RCA student · Class year', fields.service.value.trim() ? 1575 : 1510,
    32, 'system-ui', cream);
}

function storyFile() {
  draw();
  const name = fields.veteran.value.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(new File([blob], `RCAP-${name || 'Veterans-Day'}-Story.png`, {type:'image/png'}));
      else reject(new Error('PNG export failed'));
    }, 'image/png');
  });
}

fields.photo.addEventListener('change', () => {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  const file = fields.photo.files[0];
  photo = null;
  status.textContent = '';
  position.hidden = dragArea.hidden = dragHelp.hidden = true;
  fields.horizontal.value = 50;
  fields.vertical.value = 35;
  fields.zoom.value = 100;
  draw();
  if (!file) return;
  const url = URL.createObjectURL(file);
  photoUrl = url;
  const image = new Image();
  image.onload = () => {
    if (photoUrl !== url) return;
    photo = image;
    position.hidden = dragArea.hidden = dragHelp.hidden = false;
    draw();
  };
  image.onerror = () => {
    if (photoUrl !== url) return;
    fields.photo.value = '';
    status.textContent = 'This photo could not be opened. Try a JPG or PNG.';
  };
  image.src = url;
});

dragArea.addEventListener('pointerdown', event => {
  if (!photo || drag || event.button !== 0) return;
  const size = photoSize();
  const bounds = dragArea.getBoundingClientRect();
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    horizontal: Number(fields.horizontal.value),
    vertical: Number(fields.vertical.value),
    travelX: (frame.width - size.width) * bounds.width / frame.width,
    travelY: (frame.height - size.height) * bounds.height / frame.height,
  };
  dragArea.setPointerCapture(event.pointerId);
});

dragArea.addEventListener('pointermove', event => {
  if (event.pointerId !== drag?.id) return;
  if (Math.abs(drag.travelX) > 0.5) {
    fields.horizontal.value = drag.horizontal + (event.clientX - drag.x) * 100 / drag.travelX;
  }
  if (Math.abs(drag.travelY) > 0.5) {
    fields.vertical.value = drag.vertical + (event.clientY - drag.y) * 100 / drag.travelY;
  }
  draw();
});

dragArea.addEventListener('lostpointercapture', event => {
  if (event.pointerId === drag?.id) drag = null;
});

form.addEventListener('input', draw);
logo.onload = flag.onload = draw;
logo.src = '/brand/rcap-reversed.svg';
flag.src = '/veterans-day/flag.jpg';
draw();

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!photo) {
    status.textContent = 'Wait for the photo to appear in the preview, then try again.';
    return;
  }
  try {
    const file = await storyFile();
    const url = URL.createObjectURL(file);
    const link = Object.assign(document.createElement('a'), {href:url, download:file.name});
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = 'Story ready. You can send the PNG to RCAP.';
  } catch {
    status.textContent = 'The Story could not be downloaded. Try again.';
  }
});

const shareTest = new File([''], 'story.png', {type:'image/png'});
if (navigator.canShare?.({files:[shareTest]})) {
  fields.share.hidden = false;
  fields.share.addEventListener('click', async () => {
    if (!form.reportValidity() || !photo) return;
    try {
      const file = await storyFile();
      await navigator.share({files:[file], title:'RCAP Veterans Day Tribute'});
      status.textContent = 'Story shared.';
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'Sharing is unavailable. Use Download Story to save the PNG.';
    }
  });
}
