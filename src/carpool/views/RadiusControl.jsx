import { useEffect, useRef, useState } from 'react';
import { setFamilyRadius } from '../family.js';

// The personal-radius slider (migration 0009, Phase A). A quick preference that
// lives in the family summary so a parent can widen or tighten who they see
// without entering the full edit form. null = the adaptive default (auto-widen
// where families are spread out); a number is the explicit cap. Range is the
// same [1, 25] the families CHECK constraint enforces; 25 is the metro cap.
const MIN = 1;
const MAX = 25;
// Where the slider thumb rests while on the adaptive default: the 3-mile base
// the adaptive logic starts from. Moving it from here sets a personal value.
const BASE = 3;

export default function RadiusControl({ family, onSaved }) {
  const [radius, setRadius] = useState(family.radius_miles ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // A range input fires onChange continuously as it is dragged, so debounce the
  // write and the parent's refetch to the last resting value rather than every
  // intermediate tick.
  const commitRef = useRef(null);
  const mountedRef = useRef(true);
  // The slider can unmount within the 350ms debounce (a parent nudges it then
  // taps Edit, which swaps this whole card out). Cancel the pending write and
  // stop any setState from a write that resolves after we are gone.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (commitRef.current) clearTimeout(commitRef.current);
    };
  }, []);

  function commit(value, previous) {
    if (commitRef.current) clearTimeout(commitRef.current);
    commitRef.current = setTimeout(async () => {
      if (mountedRef.current) { setSaving(true); setError(''); }
      try {
        await setFamilyRadius(family.user_id, value);
        if (mountedRef.current) onSaved?.(value);
      } catch (err) {
        // The optimistic value was shown the moment the thumb moved; on a
        // failed write put it back so the slider never reads a number the
        // database did not accept.
        if (mountedRef.current) {
          setRadius(previous);
          setError(err.message ?? 'Could not save your radius. Please try again.');
        }
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    }, 350);
  }

  function handleSlider(e) {
    const value = Number(e.target.value);
    const previous = radius;
    setRadius(value);
    commit(value, previous);
  }

  function useAutomatic() {
    const previous = radius;
    setRadius(null);
    commit(null, previous);
  }

  const isAuto = radius == null;
  const sliderValue = isAuto ? BASE : radius;

  return (
    <div className="cp-radius">
      <label className="cp-field-label" htmlFor="family-radius">Show families within</label>
      <div className="cp-radius-row">
        <input
          id="family-radius"
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={sliderValue}
          onChange={handleSlider}
          aria-describedby="family-radius-help"
        />
        <span className="cp-radius-value" aria-live="polite">
          {isAuto ? 'Automatic' : `${radius} mi`}
        </span>
      </div>
      <p id="family-radius-help" className="cp-help">
        Show me families within this many miles. Leave it on the suggestion to let it widen automatically where families are spread out.
      </p>
      {!isAuto && (
        <button type="button" className="cp-btn cp-btn--quiet" onClick={useAutomatic}>
          Use the suggested default
        </button>
      )}
      {saving && <p className="cp-item-meta">Saving your radius</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
