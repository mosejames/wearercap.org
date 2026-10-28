import { describe, expect, it } from 'vitest';
import { studentCard } from './raffleStudentCard.js';
const student = { name: 'Example S.', classOf: '2030', house: 'Rêveur', amount: 987, rank: 2 };
describe('raffle student count visibility', () => {
  it('keeps weekly recognition free of ticket counts and comparison bars', () => {
    const card = studentCard(student, false, false, 3);
    expect(card.textContent).toContain('No. 2 raffle star');
    expect(card.textContent).toContain('Week 3');
    expect(card.textContent).not.toContain('987');
    expect(card.querySelector('.rr-star-track')).toBeNull();
  });
  it('keeps overall recognition free of ticket counts', () => {
    const card = studentCard(student, false, true);
    expect(card.textContent).toContain('Overall');
    expect(card.textContent).not.toContain('987');
  });
  it('reveals ticket counts only when explicitly requested for lookup', () => {
    expect(studentCard(student, true, true).textContent).toContain('987 tickets');
    expect(studentCard(student, true, false, 3).textContent).toContain('No. 2 in Week 3');
  });
});
