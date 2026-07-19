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
      {onBack && <button className="cp-btn cp-btn--quiet cp-backlink" onClick={onBack}>← Back to my family</button>}
      <p className="cp-label cp-label--bar">Committee</p>
      <h1 className="cp-h1">Pending <span className="cp-hl">approvals.</span></h1>
      {loading && <p className="cp-loading">Loading the queue</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && pending.length === 0 && (
        <div className="cp-empty">
          <p>No one is waiting. All caught up.</p>
        </div>
      )}
      <ul className="carpool-nearby-list">
        {pending.map((m) => (
          <li key={m.user_id}>
            <p className="cp-item-name">{m.email}</p>
            <div className="cp-item-actions">
              <button className="cp-btn cp-btn--dark cp-btn--sm" onClick={() => approve(m.user_id)}>Approve</button>
            </div>
          </li>
        ))}
      </ul>
      <hr className="cp-rule" />
      <button className="cp-btn cp-btn--quiet" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
