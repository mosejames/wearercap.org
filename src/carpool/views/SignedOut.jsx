import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function SignedOut() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  async function sendLink(e) {
    e.preventDefault();
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/carpool/` },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="carpool-shell">
      <h1>RCA Carpool</h1>
      <p>Sign in with your email to find carpool families near you.</p>
      {status === 'sent' ? (
        <p>Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={sendLink}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      )}
      {status === 'error' && <p role="alert">Could not send link: {message}</p>}
    </div>
  );
}
