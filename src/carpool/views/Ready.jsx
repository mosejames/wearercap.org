import React from 'react';
import { supabase } from '../supabaseClient.js';

export default function Ready() {
  return (
    <div className="carpool-shell">
      <h1>Carpool</h1>
      <p>You're approved. Your family profile and the map arrive in Phase 2.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
