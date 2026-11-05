import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import HolderIntake, { HolderRequestActions } from './HolderIntake.jsx';
import * as db from './data.js';
vi.mock('./data.js', () => ({ holderAction: vi.fn() }));
let root, container;
const props = { token: 'private-test', holder: { house: 'amistad' }, bins: [{ id: 'bin1', code: 'AMI-1', name: 'House bin', retired: false }], reload: vi.fn() };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); db.holderAction.mockResolvedValue({ status: 'fulfilled' });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async node => act(async () => root.render(node || <HolderIntake {...props} />));
const click = async text => act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === text).click());
const submit = async () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
it('records a count with no identity, inventory deduction, or text and resets for the next entry', async () => {
  await render(); await submit();
  const first = db.holderAction.mock.calls[0][2];
  expect(first).toMatchObject({ qty: 1, parentName: '', contact: '', deduct: false, sendText: false, binId: '' });
  expect(container.querySelector('[role=status]').textContent).toContain('Ready for the next');
  await submit(); expect(db.holderAction.mock.calls[1][2].key).not.toBe(first.key);
});
it('keeps the same save key on a failed save so retry cannot duplicate the giveaway', async () => {
  db.holderAction.mockRejectedValueOnce(new Error('Connection interrupted'));
  await render(); await submit(); const key = db.holderAction.mock.calls[0][2].key;
  expect(container.querySelector('[role=alert]').textContent).toContain('Connection interrupted');
  await submit(); expect(db.holderAction.mock.calls[1][2].key).toBe(key);
});
it('defaults assisted requests to holder coordination and leaves confirmation unchecked', async () => {
  await render(); await click('Request for a family');
  expect(container.querySelector('input[value=holder]').checked).toBe(true);
  expect([...container.querySelectorAll('input[type=checkbox]')].find(i => i.parentElement.textContent.includes('Send confirmation')).checked).toBe(false);
  expect(container.textContent).toContain('No stock yet. Put on waitlist');
});
it('does not allow a waitlisted request to be marked handed over', async () => {
  await render(<HolderRequestActions token={props.token} request={{ id: 'r1', status: 'open', item_type: 'polo', qty: 1, parent_name: 'Family' }} reload={props.reload} />);
  const finish = [...container.querySelectorAll('button')].find(b => b.textContent === 'Mark handed over');
  expect(finish.disabled).toBe(true);
  expect(container.textContent).toContain('Waiting for stock');
});
it('completes an existing request by its ID rather than recording a second giveaway', async () => {
  await render(<HolderRequestActions token={props.token} request={{ id: 'r1', status: 'assigned', item_type: 'polo', qty: 1, parent_name: 'Family' }} reload={props.reload} />);
  await click('Mark handed over');
  expect(db.holderAction).toHaveBeenCalledWith(props.token, 'complete', expect.objectContaining({ requestId: 'r1', sendText: false }));
});
