import React from 'react';

export default function PhotoProgress({ label, progress }) {
  return <div className="photo-progress">
    <span className="photo-progress-deck" aria-hidden="true"><i/><i/><i/></span>
    <div>
      <strong role="status">{label}</strong>
      <progress aria-label={label} max={1} value={progress}/>
    </div>
  </div>;
}
