import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';

export default function AdminApprovals({ onBack = null }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPending = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('members')
      .select('user_id, email, created_at')
      .eq('approval', 'pending')
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setPending(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  async function approve(userId) {
    const { error } = await supabase
      .from('members')
      .update({ approval: 'approved' })
      .eq('user_id', userId);
    if (error) setError(error.message);
    else loadPending();
  }

  return (
    <div className="carpool-shell">
      {onBack && <button onClick={onBack}>← Back to my family</button>}
      <h1>Pending approvals</h1>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && pending.length === 0 && <p>No one waiting. All caught up.</p>}
      <ul>
        {pending.map((m) => (
          <li key={m.user_id}>
            {m.email}
            <button onClick={() => approve(m.user_id)}>Approve</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
