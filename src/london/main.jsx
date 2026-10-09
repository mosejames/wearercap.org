import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './london.css';
class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main><h1>The album needs a moment.</h1><p>Please reload to try again.</p><button onClick={() => window.location.reload()}>Reload</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<StrictMode><Boundary><App /></Boundary></StrictMode>);
