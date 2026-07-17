import React from 'react';
import { supabase } from '../supabaseClient.js';

export default function Pending() {
  return (
    <div className="carpool-shell">
      <h1>You're on the list</h1>
      <p>
        Thanks for signing in. A carpool committee admin will approve your access
        shortly. You'll get an email when you're in.
      </p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
