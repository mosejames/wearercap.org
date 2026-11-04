import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import GoogleReturn from './GoogleReturn.jsx';
import './engine.css';
import './dc.css';
createRoot(document.getElementById('root')).render(<React.StrictMode>{new URLSearchParams(location.search).get('auth_callback')==='1'?<GoogleReturn/>:<App/>}</React.StrictMode>);
