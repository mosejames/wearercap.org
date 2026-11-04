// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import Expectations from './Expectations.jsx';
import {newDraft,messageFor} from '../trip-studio/model.js';
import {cleanDraft,saveDraft} from '../../server/trip-studio/model.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
it('keeps Expectations optional for new and legacy drafts',()=>{const d=newDraft('dc-draft','Washington, DC');expect(d.expectations.enabled).toBe(false);delete d.expectations;expect(cleanDraft(d).expectations.enabled).toBe(false);});
it('saves editable multiline guidance and open-upload choice without losing either',()=>{const d=newDraft('dc-draft','Washington, DC');d.expectations={enabled:true,title:'Getting ready',content:'First paragraph.\n\nSecond paragraph.',uploadsOpen:true};const saved=saveDraft({revision:0,trips:[]},d,0);expect(saved.trips[0].expectations).toEqual(d.expectations);expect(messageFor(d,'Expectations','Families','local-link')).toContain('Preparation photos are welcome');});
it('hides both contribution choices when Expectations uploads are closed',()=>{const host=document.createElement('div'),root=createRoot(host);act(()=>root.render(<Expectations trip={{features:{videos:true},videoUploadUrl:'https://example.com',expectations:{enabled:true,title:'Getting ready',content:'Read this first.',uploadsOpen:false}}}/>));expect(host.textContent).toContain('Read this first.');expect(host.textContent).toContain('not open yet');expect(host.querySelector('input[type=file]')).toBeNull();expect(host.querySelector('button')).toBeNull();act(()=>root.unmount());});
it('opens the shared local uploader only when enabled',()=>{const host=document.createElement('div'),root=createRoot(host);act(()=>root.render(<Expectations trip={{slug:'washington-dc-2030',features:{videos:true},videoUploadUrl:'https://example.com',expectations:{enabled:true,title:'Getting ready',content:'Hello.',uploadsOpen:true}}}/>));expect(host.querySelector('input[type=file]')).not.toBeNull();expect(host.textContent).toContain('Send videos');act(()=>root.unmount());});
