import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../vault/vault.css';
import './m3.css';

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('M³ Vault rendering failed', error); }
  render() {
    return this.state.failed
      ? <main className="shell page"><h1>Something slipped.</h1><p>The vault could not draw this page. Reload and it should come back; nothing you added is lost.</p><button className="btn primary" onClick={() => window.location.reload()}>Reload</button></main>
      : this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode><Boundary><App /></Boundary></StrictMode>,
);
