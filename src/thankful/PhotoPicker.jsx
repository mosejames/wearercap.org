import React from 'react';

export default function PhotoPicker({ className, children, onPick, onError }) {
  return <label className={`photo-picker ${className}`}>
    {children}
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.currentTarget.files[0];
      event.currentTarget.value = '';
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024) {
        onError('Choose a JPEG, PNG or WebP photo under 8 MB.');
        return;
      }
      onPick(file);
    }}/>
  </label>;
}
