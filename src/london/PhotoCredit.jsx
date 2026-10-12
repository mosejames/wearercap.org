import {Instagram} from 'lucide-react';
import {instagramCredits,storyContext} from './instagram.js';
export default function PhotoCredit({photo}) {
  const credits=instagramCredits(photo);
  return credits.length ? <div className="l-source-credits">{credits.length > 1 && <p className="l-small">Shared on Instagram by these accounts. One moment, with every source credited.</p>}{credits.map(({account,url})=><a key={account} className="l-instagram-credit" href={url} title={`Shared on Instagram by @${account}`} aria-label={`Shared on Instagram by @${account}`} target="_blank" rel="noopener noreferrer"><Instagram size={13} aria-hidden="true"/>Instagram · @{account}</a>)}{storyContext(photo) && <p className="l-small">{storyContext(photo)}</p>}</div> : <span className="l-photo-credit">With thanks to <b>{photo.uploaderName || 'a trip friend'}</b>{photo.team ? ` · ${photo.team}` : ''}</span>;
}
