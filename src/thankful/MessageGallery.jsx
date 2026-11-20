import React, { useEffect, useRef, useState } from 'react';

const BUCKET = 'thankful-message-photos';

function GratitudeCard({ photo, author, message, prompt }) {
  return <article className="gratitude-card">
    {photo && <div className="gratitude-image">
      <img className="gratitude-photo" src={photo} alt="" loading="lazy"/>
      <img className="gratitude-logo" src="/images/we-are-rcap-logo.png" alt="We Are RCAP" width="42"/>
    </div>}
    <div className="gratitude-copy">
      <span className="small">{prompt}</span>
      <p>{message}</p>
      <strong>{author}</strong>
    </div>
  </article>;
}

export function MessageComposer({ card, client, onBusy, onGallery }) {
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submission = useRef(null);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function submit(event) {
    event.preventDefault();
    if (busy || !client || !photo || !author.trim() || !message.trim()) {
      setError(client ? 'Add a photo, your name and a message.' : 'Submissions are temporarily unavailable.');
      return;
    }
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const draft = submission.current ??= { id: crypto.randomUUID(), uploaded: false };
      const photoPath = `${draft.id}/photo`;
      if (!draft.uploaded) {
        const { error: uploadError } = await client.storage.from(BUCKET).upload(photoPath, photo);
        if (uploadError && String(uploadError.statusCode) !== '409' && !['Duplicate', 'ResourceAlreadyExists', 'KeyAlreadyExists'].includes(uploadError.code)) {
          throw uploadError;
        }
        draft.uploaded = true;
      }
      const { error: writeError } = await client.from('thankful_messages').insert({
        id: draft.id, prompt: card[0], author: author.trim(), message: message.trim(),
      });
      if (writeError && writeError.code !== '23505') throw writeError;
      setSent(true);
    } catch {
      setError('Your card couldn’t be submitted. Please try again.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return <>
    {sent ? <><p role="status">Your card was submitted. It will appear in the gallery after RCAP reviews it.</p>
      <button type="button" className="button" onClick={onGallery}>View gallery</button></> :
      <form className="message-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Your name<input required value={author} maxLength={60} onChange={event => setAuthor(event.target.value)}/></label>
          <label>Your message<textarea required value={message} maxLength={300} rows={4} onChange={event => setMessage(event.target.value)}/></label>
          <small>{message.length}/300</small>
          <label>Add a photo <span className="hint">JPEG, PNG or WebP · Up to 8 MB</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => {
              const file = event.target.files[0];
              if (!file) return;
              if (!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024) {
                event.target.value = '';
                setPhoto(null);
                setPhotoUrl('');
                setError('Choose a JPEG, PNG or WebP photo under 8 MB.');
                return;
              }
              submission.current = null;
              setPhoto(file);
              setError('');
            }}/>
          </label>
          <label className="consent"><input type="checkbox" required/><span>I have permission to share this photo publicly, including a parent or guardian’s permission for any child shown.</span></label>
          <button type="submit" className="button">{busy ? 'Submitting…' : 'Submit card for review'}</button>
        </fieldset>
      </form>}
    {error && <p className="error" role="alert">{error}</p>}
    {(author || message || photoUrl) && <div className="card-preview"><h2>Your card</h2>
      <GratitudeCard photo={photoUrl} author={author || 'Your name'} message={message || 'Your message will appear here.'} prompt={card[0]}/>
    </div>}
  </>;
}

export function MessageGallery({ client }) {
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: queryError } = await client.from('thankful_messages')
          .select('id,prompt,author,message').order('created_at', { ascending: false }).limit(60);
        if (queryError) throw queryError;
        if (!active) return;
        if (!data.length) { setCards([]); return; }
        const { data: urls, error: storageError } = await client.storage.from(BUCKET)
          .createSignedUrls(data.map(card => `${card.id}/photo`), 3600);
        if (storageError) throw storageError;
        if (active) setCards(data.map((card, index) => ({ ...card, photo: urls[index]?.signedUrl })).filter(card => card.photo));
      } catch {
        if (active) setError(true);
      }
    }
    void load();
    return () => { active = false; };
  }, [client]);

  if (error) return <p role="alert">The gallery couldn’t load. Please try again later.</p>;
  if (!cards) return <p role="status">Loading cards…</p>;
  if (!cards.length) return <p>No published cards yet.</p>;
  return <div className="gratitude-grid">{cards.map(card => <GratitudeCard key={card.id} {...card}/>)}</div>;
}
