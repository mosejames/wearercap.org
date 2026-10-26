import './trip-stories.css';
import { tripSubmission, submitTripStory } from './tripStories.js';
const form = document.querySelector('#trip-form');
const input = document.querySelector('#trip-photo');
const photoPreview = document.querySelector('#photo-preview');
const photoName = document.querySelector('#photo-name');
const photoError = document.querySelector('#photo-error');
const status = document.querySelector('#form-status');
const error = document.querySelector('#form-error');
let photo, previewUrl;
const photoSelected = document.querySelector('#photo-selected');
const photoAction = document.querySelector('#photo-action-text');
function clearPhotoPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null; photo = null; photoPreview.hidden = true; photoPreview.removeAttribute('src');
  photoName.textContent = ''; photoSelected.hidden = true; photoAction.textContent = 'Choose a photo';
}
function clearPhoto() {
  clearPhotoPreview(); input.value = ''; photoError.textContent = '';
}
input.addEventListener('change', () => {
  const selected = input.files[0];
  if (!selected) return;
  photoError.textContent = '';
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(selected.type) && !/\.(jpe?g|png|webp|hei[cf])$/i.test(selected.name)) { photoError.textContent = 'Choose a JPG, PNG, WebP or HEIC photo.'; input.value = ''; return; }
  if (selected.size > 30 * 1024 * 1024) { photoError.textContent = 'Please choose a photo smaller than 30 MB.'; input.value = ''; return; }
  clearPhotoPreview();
  photo = selected; photoName.textContent = selected.name; photoSelected.hidden = false; photoAction.textContent = 'Change photo';
  if (!/hei[cf]/i.test(selected.type + selected.name)) { previewUrl = URL.createObjectURL(selected); photoPreview.src = previewUrl; photoPreview.hidden = false; }
});
photoPreview.addEventListener('error', () => { photoPreview.hidden = true; });
document.querySelector('#remove-photo').addEventListener('click', () => { clearPhoto(); input.focus(); });
async function call(action, payload) {
  const response = await fetch('/api/campaign-activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(result.error || 'We could not send that just yet. Your words are still here. Please try again.');
  return result;
}
const encode = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(Error('Could not read that photo. Please choose it again.')); reader.readAsDataURL(blob);
});
form.addEventListener('submit', async event => {
  event.preventDefault(); error.textContent = '';
  const fields = document.querySelector('#form-fields');
  try {
    const payload = tripSubmission(Object.fromEntries(new FormData(form)));
    fields.disabled = true;
    await submitTripStory(payload, photo, {
      call, encode, progress: message => { status.textContent = message; },
      prepare: async file => { const { prepareImage } = await import('../vault/images.js'); return prepareImage(file, { optimize: true }); },
    });
    form.hidden = true; document.querySelector('#trip-success').hidden = false; document.querySelector('#trip-success').focus(); clearPhoto();
  } catch (failure) { error.textContent = failure.message; error.focus(); }
  finally { fields.disabled = false; status.textContent = ''; }
});
document.querySelector('#share-another').addEventListener('click', () => {
  form.reset(); clearPhoto(); error.textContent = ''; document.querySelector('#trip-success').hidden = true; form.hidden = false; document.querySelector('#trip').focus();
});
