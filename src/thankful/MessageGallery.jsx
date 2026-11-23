import React, { useEffect, useRef, useState } from 'react';
import SubmissionThanks from './SubmissionThanks.jsx';
import PhotoPicker from './PhotoPicker.jsx';

import SharingDetails, { readSharingDetails } from './SharingDetails.jsx';
import PhotoFrame, { exportPhoto, initialCrop, limitCrop } from './PhotoFrame.jsx';
import PhotoStory from './PhotoStory.jsx';

const BUCKET = 'thankful-message-photos';

function messageSize(message) {
  const length = message.length + (message.split('\n').length - 1) * 18;
  return { '--message-size': length > 210 ? '4.1cqi' : length > 125 ? '4.8cqi' : length > 75 ? '5.8cqi' : '7cqi' };
}

export function GratitudeCard({ photo, author, credit, message, prompt, onPhotoError }) {
  return <article className="gratitude-card live-card">
    {photo && <div className="gratitude-image">
      <img className="gratitude-photo" src={photo} alt="" loading="lazy" onError={onPhotoError}/>
      <img className="gratitude-logo" src="/images/we-are-rcap-logo.png" alt="We Are RCAP" width="42"/>
    </div>}
    <div className="gratitude-copy">
      {prompt && <span className="small">{prompt}</span>}
      <p className="gratitude-message" style={messageSize(message)}>{message}</p>
      <div className="gratitude-credit">
        <strong>{author}</strong>
        {credit && <small>{credit}</small>}
      </div>
    </div>
  </article>;
}

export function MessageComposer({ initialPhoto, card, client, onBusy, onGallery }) {
  const [photo, setPhoto] = useState(initialPhoto);
  const [photoUrl, setPhotoUrl] = useState('');
  const [sharingDetails, setSharingDetails] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedPhoto, setSavedPhoto] = useState(null);
  const [error, setError] = useState('');
  const submission = useRef(null);
  const imageRef = useRef(null);
  const [crop, setCrop] = useState(initialCrop);
  const starter = card[1];
  const limit = 299 - starter.length;

  useEffect(() => {
    const display = savedPhoto || photo;
    if (!display) return;
    const url = URL.createObjectURL(display);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo, savedPhoto]);

  async function submit(event) {
    event.preventDefault();
    const sharing = readSharingDetails(event.currentTarget);
    if (busy || !client || !photo || !sharing.speakerName || !message.trim()) {
      setError(client ? 'Add a photo, a signature and a message.' : 'Submissions are temporarily unavailable.');
      return;
    }
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      if (submission.current?.crop !== crop) submission.current = { id: crypto.randomUUID(), crop, uploaded: false };
      const draft = submission.current;
      const photoPath = `${draft.id}/photo`;
      if (!draft.uploaded) {
        draft.photo = await exportPhoto(imageRef.current, crop);
        const { error: uploadError } = await client.storage.from(BUCKET).upload(photoPath, draft.photo, { contentType: 'image/jpeg' });
        if (uploadError && String(uploadError.statusCode) !== '409' && !['Duplicate', 'ResourceAlreadyExists', 'KeyAlreadyExists'].includes(uploadError.code)) {
          throw uploadError;
        }
        draft.uploaded = true;
      }
      const { error: writeError } = await client.from('thankful_messages').insert({
        id: draft.id, prompt: card[0], author: sharing.speakerName, message: `${starter} ${message.trim()}`,
        houses: sharing.houses,
        class_years: sharing.classYears,
      });
      if (writeError && writeError.code !== '23505') throw writeError;
      setSharingDetails(sharing);
      setSavedPhoto(draft.photo);
      setSent(true);
    } catch {
      setError('Your card couldn’t be submitted. Please try again.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  const credit = sharingDetails ? [
    sharingDetails.houses.join(' & '),
    sharingDetails.classYears.length && `Class of ${sharingDetails.classYears.join(' & ')}`,
  ].filter(Boolean).join(' • ') : '';

  return <>
    {sent ? <><p role="status">Your card was submitted. It will appear in the gallery after RCAP reviews it.</p>
      <SubmissionThanks/>
      <button type="button" className="text-link" onClick={onGallery}>View gallery</button></> :
      <form className="message-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          {photoUrl && <>
            <div className="gratitude-card live-card">
              <PhotoFrame photo={photoUrl} imageRef={imageRef} crop={crop} onCrop={setCrop} disabled={busy}/>
              <img className="gratitude-logo" src="/images/we-are-rcap-logo.png" alt="We Are RCAP" width="42"/>
              <div className="gratitude-copy gratitude-compose" style={messageSize(`${starter} ${message}`)}>
                <label htmlFor="gratitude-message">{starter}…</label>
                <div className="message-writing">
                  <span aria-hidden="true">{message || 'Finish the thought'}{' '}</span>
                  <textarea id="gratitude-message" autoCapitalize="none" required value={message} maxLength={limit} rows={1} placeholder="Finish the thought" onChange={event => setMessage(event.target.value)}/>
                </div>
              </div>
            </div>
            <div className="photo-tools">
              <p className="hint">Drag to move · Pinch to zoom</p>
              <PhotoPicker className="text-link" onError={setError} onPick={file => {
                submission.current = null;
                setCrop(initialCrop);
                setPhoto(file);
                setError('');
              }}>Change photo</PhotoPicker>
            </div>
            <label className="photo-zoom">Zoom
              <input type="range" min="1" max="4" step=".01" value={crop.zoom}
                onChange={event => {
                  const zoom = Number(event.target.value);
                  setCrop(current => limitCrop(imageRef.current, { ...current, zoom }));
                }}/>
            </label>
            <SharingDetails photo/>
          <label className="consent"><input type="checkbox" required/><span>I have permission to share this photo publicly, including a parent or guardian’s permission for any child shown.</span></label>
          <button type="submit" className="button">{busy ? 'Submitting…' : 'Submit card for review'}</button>
          </>}
        </fieldset>
      </form>}
    {error && <p className="error" role="alert">{error}</p>}
    {sent && savedPhoto &&
      <PhotoStory photo={savedPhoto} author={sharingDetails.speakerName} credit={credit} message={`${starter} ${message.trim()}`}>
        <GratitudeCard photo={photoUrl} author={sharingDetails.speakerName} credit={credit} message={`${starter} ${message.trim()}`}/>
      </PhotoStory>}
  </>;
}

function PhotoGallery({ client }) {
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
  if (!cards.length) return <p>No published photo cards yet.</p>;
  return <div className="gratitude-grid">{cards.map(card => <GratitudeCard key={card.id} {...card}/>)}</div>;
}

function VideoGallery({ client }) {
  const [videos, setVideos] = useState([]);
  const [playing, setPlaying] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: queryError } = await client.from('thankful_published_videos')
          .select('path').order('published_at', { ascending: false }).limit(60);
        if (queryError) throw queryError;
        if (active) setVideos(data);
      } catch {
        if (active) setError('Published videos couldn’t load.');
      }
    }
    void load();
    return () => { active = false; };
  }, [client]);

  async function play(path) {
    setError('');
    const { data, error: signError } = await client.storage.from('thankful-at-rca').createSignedUrl(path, 300);
    if (signError) setError('This video is unavailable. Refresh the gallery to try again.');
    else setPlaying(current => ({ ...current, [path]: data.signedUrl }));
  }

  return <>
    {videos.length > 0 && <div className="gratitude-grid gallery-videos">
      {videos.map(({ path }, index) => <article key={path} className="moderation-card">
        {playing[path] ? <video className="moderation-preview" src={playing[path]} controls autoPlay playsInline/> :
          <button className="button" onClick={() => play(path)}>Play gratitude video {index + 1}</button>}
      </article>)}
    </div>}
    {error && <p role="alert">{error}</p>}
  </>;
}

export function MessageGallery({ client }) {
  return <><PhotoGallery client={client}/><VideoGallery client={client}/></>;
}
