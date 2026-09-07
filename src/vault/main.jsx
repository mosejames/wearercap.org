import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './vault.css';

class VaultErrorBoundary extends Component {
  state = {failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.error('Vault rendering failed',error);}
  render(){return this.state.failed ? <main className="shell page"><h1>Let’s bring the memories back.</h1><p>The Vault couldn’t display this page. Please try loading it again.</p><button className="btn primary" onClick={()=>window.location.reload()}>Reload the Vault</button></main> : this.props.children;}
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <VaultErrorBoundary><App /></VaultErrorBoundary>
  </StrictMode>,
);
