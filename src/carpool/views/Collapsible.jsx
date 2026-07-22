import { useEffect, useRef, useState } from 'react';

// A tap-to-open section header for the approved parent view. The approved page
// is one long scroll (your family, families near you, groups, start a group);
// wrapping each part in one of these lets a parent keep the whole thing on one
// page while collapsing what they are not using. Purely presentational: it
// renders a header button and, when open, its children. It owns no data and
// changes no behaviour of what it wraps.
//
// Two modes:
//   UNCONTROLLED (default): owns its open state, seeded from sessionStorage so
//     a section stays open across the in-session refetch remounts this app does
//     a lot (edit family, reload family, a collapsed heavy section unmounting
//     and coming back). The parent passes only `defaultOpen`.
//   CONTROLLED: pass `open` and `onToggle` and the parent owns the state. Used
//     for "Start a group", which another control (the suggested-crew button)
//     needs to force open. Controlled mode does not touch sessionStorage; the
//     owner decides.
// The switch is presence of `open`: controlled when `open !== undefined`.

export function collapseStorageKey(id) {
  return `carpool.collapse.${id}`;
}

// sessionStorage access throws in private-mode/quota/disabled situations, and
// the property access itself can throw synchronously, so every touch is
// guarded. A failed read falls back to defaultOpen; a failed write is dropped.
export function readStoredOpen(id, defaultOpen) {
  try {
    const raw = window.sessionStorage.getItem(collapseStorageKey(id));
    if (raw === null) return defaultOpen;
    return raw === '1';
  } catch {
    return defaultOpen;
  }
}

export function writeStoredOpen(id, open) {
  try {
    window.sessionStorage.setItem(collapseStorageKey(id), open ? '1' : '0');
  } catch {
    // Nothing to do: an unpersisted open state is a cosmetic loss, not a bug.
  }
}

export default function Collapsible({
  title,
  count = null,
  defaultOpen = false,
  open,
  onToggle,
  children,
  id,
}) {
  const controlled = open !== undefined;

  // Seed once from storage. In controlled mode this state is inert (isOpen
  // reads `open`), so seeding it is harmless.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(() => readStoredOpen(id, defaultOpen));
  const isOpen = controlled ? open : uncontrolledOpen;

  // A section a parent already opened must survive a remount. When the wrapped
  // content or the whole approved view remounts, the fresh mount seeds from
  // storage above; this keeps storage current with the live state in case an
  // ancestor never unmounted but storage was cleared elsewhere.
  const firstRun = useRef(true);
  useEffect(() => {
    if (controlled) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    writeStoredOpen(id, uncontrolledOpen);
  }, [controlled, id, uncontrolledOpen]);

  function handleToggle() {
    if (controlled) {
      onToggle?.(!isOpen);
      return;
    }
    setUncontrolledOpen((prev) => !prev);
  }

  const headId = `${id}-head`;
  const bodyId = `${id}-body`;
  // 0 and null both mean "no badge": an empty section shows its own empty state
  // once opened, so a "· 0" on the header would only add noise.
  const showCount = count != null && count > 0;

  return (
    <div className="cp-collapse">
      {/* The toggle is wrapped in an h2 so these stay real headings: a screen
          reader user can still jump section to section by heading, which the
          old <h3> section labels allowed and a bare button would have lost.
          The h2 carries no visual weight of its own; the button owns the look. */}
      <h2 className="cp-collapse-heading">
        <button
          type="button"
          id={headId}
          className="cp-collapse-head cp-label cp-label--bar"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={handleToggle}
        >
          <span className="cp-collapse-title">{title}</span>
          {showCount && <span className="cp-collapse-count">· {count}</span>}
          {/* A filled chevron disc, not a bare glyph: the old 12px triangle
              read as decoration and got missed (Mose, 2026-07-20). The disc
              plus the pressable bar treatment below make it unmistakably a
              thing you open. Points down when closed (there is more below),
              flips up when open. */}
          <span
            className={`cp-collapse-chevron${isOpen ? ' cp-collapse-chevron--open' : ''}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" focusable="false">
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </h2>
      {isOpen && (
        <div id={bodyId} role="region" aria-labelledby={headId} className="cp-collapse-body">
          {children}
        </div>
      )}
    </div>
  );
}
