import {Instagram} from 'lucide-react';
import {instagramAccount} from './instagram.js';
export default function PhotoCredit({photo}) {
  const account=instagramAccount(photo);
  return account ? <a className="l-instagram-credit" href={`https://www.instagram.com/${account}/`} title={`Shared on Instagram by @${account}`} aria-label={`Shared on Instagram by @${account}`} target="_blank" rel="noopener noreferrer"><Instagram size={13} aria-hidden="true"/>Instagram · @{account}</a> : <span className="l-photo-credit">With thanks to <b>{photo.uploaderName || 'a trip friend'}</b>{photo.team ? ` · ${photo.team}` : ''}</span>;
}
