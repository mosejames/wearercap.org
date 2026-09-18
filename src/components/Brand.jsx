import React from 'react';

// Shared, outlined artwork keeps the wordmark and descriptor together at every size.
export default function Brand({ reversed = false, weAre = false, width = 180 }) {
  return <img className="rcap-wordmark" src={`/brand/${weAre ? 'we-are-rcap' : 'rcap'}${reversed ? '-reversed' : ''}.svg`}
    alt={`${weAre ? 'We are ' : ''}RCAP. Ron Clark Academy Parents`}
    style={{ display: 'block', width, maxWidth: '100%', height: 'auto', flexShrink: 0 }} />;
}
