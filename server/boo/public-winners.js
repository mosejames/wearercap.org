// Keep the public transport whitelist separate from all authenticated payloads.
export function publicWinnerFields(data) {
  const rows = data?.winners;
  if (!Array.isArray(rows) || rows.length !== 3) return { winners: [] };
  const places = new Set();
  for (const row of rows) {
    if (!Number.isInteger(row.place) || row.place < 1 || row.place > 3 || places.has(row.place) || typeof row.name !== 'string' || row.name.length < 2 || row.name.length > 40 || !Number.isInteger(row.points) || row.points < 0) return { winners: [] };
    places.add(row.place);
  }
  return { winners: rows.map(({ place, name, points }) => ({ place, name, points })).sort((a,b)=>a.place-b.place) };
}
