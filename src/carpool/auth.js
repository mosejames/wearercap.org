// Pure decision: given the current auth session and the user's member row
// (or null if none exists yet), which view should the app render?
export function resolveView(session, member) {
  if (!session) return 'signed-out';
  if (!member || member.approval !== 'approved') return 'pending';
  return member.role === 'admin' ? 'admin' : 'ready';
}
