const form = document.querySelector('#tribute');
const canvas = document.querySelector('#preview');
const context = canvas.getContext('2d');
const fields = Object.fromEntries(
  Array.from(form.elements).filter(element => element.id).map(element => [element.id, element])
);
const status = document.querySelector('#status');
const position = document.querySelector('#position');
const logo = new Image();
const flag = new Image();
let photo = null;
let photoUrl = '';
const gold = '#f8b432';
const cream = '#fff5e5';
const frame = { x: 233, y: 477, width: 614, height: 760 };

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
    const fit = fields.crop.value === 'contain' ? Math.min : Math.max;
    const scale = fit(width / photo.naturalWidth, height / photo.naturalHeight);
    const drawnWidth = photo.naturalWidth * scale;
    const drawnHeight = photo.naturalHeight * scale;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.drawImage(photo, x + (width - drawnWidth) / 2,
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
  if (logo.naturalWidth) context.drawImage(logo, 414, 205, 252, 252 * logo.naturalHeight / logo.naturalWidth);
  text('NOVEMBER 11  /  VETERANS DAY', 356, 29, 'system-ui', gold, '700');
  drawPhoto();
  text(fields.veteran.value.trim() || 'Veteran’s name', 1354, 96, 'Georgia, serif', cream);
  text(fields.service.value.trim(), 1456, 40, 'system-ui', gold, '650');
  const student = fields.student.value.trim();
  const relationship = fields.relationship.value.trim();
  const year = fields.year.value.trim();
  const relation = student && relationship ? `${relationship} to ${student}` : student || relationship;
  const family = [relation, year && `Class of ${year}`].filter(Boolean).join(', ');
  text(family || 'Relationship to RCA student · Class year', fields.service.value.trim() ? 1530 : 1466,
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
  position.hidden = true;
  draw();
  if (!file) return;
  const url = URL.createObjectURL(file);
  photoUrl = url;
  const image = new Image();
  image.onload = () => {
    if (photoUrl !== url) return;
    photo = image;
    position.hidden = false;
    draw();
  };
  image.onerror = () => {
    if (photoUrl !== url) return;
    fields.photo.value = '';
    status.textContent = 'This photo could not be opened. Try a JPG or PNG.';
  };
  image.src = url;
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
