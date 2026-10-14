import {startActivity} from '../london/activity.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Ready from './App.jsx';
createRoot(document.getElementById('root')).render(<StrictMode><Ready/></StrictMode>);

startActivity('airport');
