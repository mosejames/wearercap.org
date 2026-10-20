import React from 'react';
import { createRoot } from 'react-dom/client';
import TripVault from './TripVault.jsx';
import { NYC } from './config.js';
import './trip.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><TripVault trip={NYC}/></React.StrictMode>);
