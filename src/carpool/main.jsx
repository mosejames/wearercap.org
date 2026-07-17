import React from 'react';
import { createRoot } from 'react-dom/client';
import './carpool.css';

function Placeholder() {
  return (
    <div className="carpool-shell">
      <h1>Carpool</h1>
      <p>Coming online.</p>
    </div>
  );
}

createRoot(document.getElementById('carpool-root')).render(<Placeholder />);
