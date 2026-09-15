import { useEffect, useRef, useState } from 'react';
import { X, Camera, Check } from 'lucide-react';
import { HOUSES, GRADES, validate, toPayload, formatPhoneInput, wallName, friendlyError } from '../model.js';
import { preparePhoto } from '../api.js';
import { Avatar } from './Chip.jsx';

/* One screen, not a wizard. A bottom sheet on phone, a centred card on
   desktop. The same component edits an existing RSVP: `mine` prefills it and
   adds the cancel path at the bottom. */
export default function Sheet({ event, initial, mine, onSubmit, onCancelRsvp, onClose }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const panel = useRef(null);
  const editing = !!(mine && mine.status === 'going');

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('rv-locked');
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      html.classList.remove('rv-locked');
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const toggleGrade = (g) =>
    set('grades', form.grades.includes(g) ? form.grades.filter((x) => x !== g) : [...form.grades, g]);

  async function pickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      const blob = await preparePhoto(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setPhotoError(err.message || 'Could not use that photo.');
    }
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = panel.current && panel.current.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    setBusy(true);
    setFailure('');
    try {
      await onSubmit(toPayload(form), photo && photo.blob);
    } catch (err) {
      setFailure(friendlyError(err));
      setBusy(false);
    }
  }

  async function doCancel() {
    setBusy(true);
    setFailure('');
    try {
      await onCancelRsvp();
    } catch (err) {
      setFailure(friendlyError(err));
      setBusy(false);
    }
  }

  const preview = {
    wall_name: wallName(form.full_name) || 'You',
    house: form.house,
    photo_url: photo ? photo.url : mine && mine.photo_url,
  };

  return (
    <div className="rv-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="rv-sheet" ref={panel} onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="rv-sheet-title">
        <div className="rv-sheet-grab" aria-hidden="true" />
        <header className="rv-sheet-head">
          <h2 id="rv-sheet-title">{editing ? 'Your RSVP' : 'Add your name'}</h2>
          <button type="button" className="rv-icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <label className="rv-field">
          <span>Your name</span>
          <input
            value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
            autoComplete="name" placeholder="First and last" aria-invalid={!!errors.full_name}
          />
          {errors.full_name && <em>{errors.full_name}</em>}
        </label>

        <div className="rv-row">
          <label className="rv-field">
            <span>Phone</span>
            <input
              value={form.phone} onChange={(e) => set('phone', formatPhoneInput(e.target.value))}
              type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(404) 555-0199" aria-invalid={!!errors.phone}
            />
            {errors.phone && <em>{errors.phone}</em>}
          </label>
          <label className="rv-field">
            <span>Email</span>
            <input
              value={form.email} onChange={(e) => set('email', e.target.value)}
              type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" aria-invalid={!!errors.email}
            />
            {errors.email && <em>{errors.email}</em>}
          </label>
        </div>
        <p className="rv-hint">Never shown on the page. We use them to send your link.</p>

        <fieldset className="rv-field">
          <legend>Your house</legend>
          <div className="rv-chips">
            {HOUSES.map((h) => (
              <button
                type="button" key={h.key} className={`rv-pill${form.house === h.key ? ' on' : ''}`}
                onClick={() => set('house', h.key)} aria-pressed={form.house === h.key}
              >
                <i style={{ background: h.color }} />{h.name}
              </button>
            ))}
          </div>
          {errors.house && <em>{errors.house}</em>}
        </fieldset>

        <fieldset className="rv-field">
          <legend>Your student's grade</legend>
          <div className="rv-chips">
            {GRADES.map((g) => (
              <button
                type="button" key={g} className={`rv-pill rv-grade${form.grades.includes(g) ? ' on' : ''}`}
                onClick={() => toggleGrade(g)} aria-pressed={form.grades.includes(g)}
              >
                {g}th
              </button>
            ))}
          </div>
          {errors.grades && <em>{errors.grades}</em>}
        </fieldset>

        {event.allow_plus_one && (
          <div className="rv-field">
            <label className="rv-toggle">
              <input type="checkbox" checked={form.bringing} onChange={(e) => set('bringing', e.target.checked)} />
              <span className="rv-switch" aria-hidden="true" />
              <span>Coming as a pair?</span>
            </label>
            <p className="rv-hint rv-hint-tight">Your spouse or your student's other parent. Every other RCA parent gets their own spot on the wall, so send them the link.</p>
            {form.bringing && (
              <label className="rv-field rv-sub">
                <span>Their name</span>
                <input
                  value={form.plus_one_name} onChange={(e) => set('plus_one_name', e.target.value)}
                  autoComplete="off" placeholder="First and last" aria-invalid={!!errors.plus_one_name}
                />
                {errors.plus_one_name && <em>{errors.plus_one_name}</em>}
              </label>
            )}
          </div>
        )}

        <div className="rv-field rv-photo">
          <Avatar person={preview} size={56} />
          <label className="rv-photo-btn">
            <Camera size={17} />
            <span>{preview.photo_url ? 'Change photo' : 'Add a photo'}</span>
            <input type="file" accept="image/*" onChange={pickPhoto} />
          </label>
          <span className="rv-hint">Optional. Shows on the wall.</span>
          {photoError && <em>{photoError}</em>}
        </div>

        {failure && <p className="rv-failure" role="alert">{failure}</p>}

        <button className="rv-cta rv-cta-block" disabled={busy}>
          {busy ? 'Saving' : editing ? <><Check size={18} /> Save changes</> : "I'm in"}
        </button>

        {editing && (
          <div className="rv-cancel">
            {confirmCancel ? (
              <>
                <span>Take your name off the wall?</span>
                <button type="button" className="rv-link danger" onClick={doCancel} disabled={busy}>Yes, cancel</button>
                <button type="button" className="rv-link" onClick={() => setConfirmCancel(false)} disabled={busy}>Keep it</button>
              </>
            ) : (
              <button type="button" className="rv-link" onClick={() => setConfirmCancel(true)}>Can't make it? Cancel your RSVP</button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
