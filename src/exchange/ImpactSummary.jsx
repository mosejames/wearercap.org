import { useEffect, useState } from 'react';
import { impactTotals } from './data.js';

export default function ImpactSummary() {
  const [totals, setTotals] = useState(null);
  useEffect(() => { let live = true;
    impactTotals().then(data => { if (live) setTotals(data); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!totals) return null;
  return <section className="shell section impact-summary" aria-label="Uniform Exchange impact">
    <p className="kicker">Together, we keep uniforms moving</p>
    <h2 className="h2">{Number(totals.yearItems).toLocaleString()} uniform items rehomed this year</h2>
    <p>{Number(totals.yearTransactions).toLocaleString()} giveaway transactions. Every item gets another chapter.</p>
  </section>;
}
