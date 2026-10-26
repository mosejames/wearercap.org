import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('./api',()=>({consoleCall:vi.fn()}));
import {consoleCall} from './api';
import IssueLifecycle from './IssueLifecycle';
let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.clearAllMocks();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const issue={id:'qa',title:'QA newsletter',status:'draft'};
const click=async text=>act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===text).click());
it('requires an explicit sent confirmation and only records it after success',async()=>{
 const changed=vi.fn();await act(async()=>root.render(<IssueLifecycle issue={issue} onChange={changed}/>));
 expect(consoleCall).not.toHaveBeenCalled();await click('Mark as sent');expect(consoleCall).not.toHaveBeenCalled();
 consoleCall.mockResolvedValue({plan:{sentAt:'2026-10-26T15:00:00Z'}});
 await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(consoleCall).toHaveBeenCalledWith('sent',expect.objectContaining({issueId:'qa',sentAt:expect.any(String)}));expect(changed).toHaveBeenCalled();
});
it('shows a save failure without claiming the email was sent',async()=>{
 consoleCall.mockRejectedValue(Error('Could not save'));
 await act(async()=>root.render(<IssueLifecycle issue={issue}/>));await click('Mark as sent');
 await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.querySelector('[role="alert"]').textContent).toBe('Could not save');expect(host.textContent).not.toContain('Email sent ');
});
it('offers restore in archive and protects a saved template from archive actions',async()=>{
 await act(async()=>root.render(<IssueLifecycle issue={issue} plan={{archivedAt:'2026-10-26'}}/>));expect(host.textContent).toContain('Restore newsletter');expect(host.textContent).not.toContain('Mark as sent');
 await act(async()=>root.render(<IssueLifecycle issue={issue} plan={{isTemplate:true}}/>));expect(host.textContent).toContain('Change template to draft');expect(host.textContent).not.toContain('Archive newsletter');
});
