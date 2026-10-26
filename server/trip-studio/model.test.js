import {describe,expect,it} from 'vitest';
import {initialRegistry,newDraft,readiness,messageFor} from '../../src/trip-studio/model.js';
import {cleanDraft,saveDraft} from './model.js';
describe('private trip draft boundaries',()=>{
  it('seeds only DC with no inferred dates, cohort, timezone or video links',()=>{
    const r=initialRegistry();expect(r.trips).toHaveLength(1);expect(r.trips[0]).toMatchObject({destination:'Washington, DC',start:'',end:'',cohort:'',timezone:'',videoUploadUrl:'',videoDownloadUrl:'',status:'draft',visibility:'private'});
  });
  it.each([{status:'active'},{visibility:'public'},{id:'nyc-2026'},{id:'london-2028'}])('rejects publication or existing-vault edits: %j',patch=>{
    expect(()=>cleanDraft({...initialRegistry().trips[0],...patch})).toThrow();
  });
  it('keeps incomplete trips editable without pretending they are ready',()=>{
    const d=cleanDraft(initialRegistry().trips[0]);expect(readiness(d)).toContain('Class year');expect(readiness(d)).toContain('Trip dates');
    expect(saveDraft(initialRegistry(),d,0,'2026-10-26T16:00:00Z')).toMatchObject({revision:1,trips:[{status:'draft',updatedAt:'2026-10-26T16:00:00Z'}]});
  });
  it('rejects stale writes without mutating the previous version',()=>{
    const r=initialRegistry();expect(()=>saveDraft(r,r.trips[0],2)).toThrow(/Another save/);expect(r.revision).toBe(0);
  });
  it('prevents duplicate draft slugs and existing vault link collisions',()=>{
    const r=initialRegistry();r.trips[0].slug='dc-2030';
    expect(()=>saveDraft(r,{...newDraft('11111111-1111-1111-1111-111111111111','Boston'),slug:'dc-2030'},0)).toThrow(/already uses/);
    expect(()=>cleanDraft({...r.trips[0],slug:'nyc-vault'})).toThrow(/existing vault/);
  });
  it.each([{start:'2026-02-30'},{start:'2026-10-30',end:'2026-10-20'},{timezone:'Fake/Zone'},{cohort:'year'},{colors:{navy:'red'}},{logo:'data:image/svg+xml;base64,AAA'},{hero:'https://example.org/image.jpg'},{videoUploadUrl:'javascript:alert(1)'},{videoDownloadUrl:'https://user:pass@example.org/'},{exportDays:0},{recipientBinding:'true'}])('rejects unsafe or invalid settings: %j',patch=>{
    expect(()=>cleanDraft({...initialRegistry().trips[0],...patch})).toThrow();
  });
  it('ignores client-invented group, permissions and timestamps',()=>{
    const d=cleanDraft({...initialRegistry().trips[0],groups:['Not a group'],adminEmails:['anyone'],updatedAt:'fake'});
    expect(d.groups).toEqual(['Group A','Group AA','Mixed']);expect(d.adminEmails).toBeUndefined();expect(d.updatedAt).toBe('');
  });
  it('uses placeholders until launch and respects feature settings in messages',()=>{
    const d=initialRegistry().trips[0];expect(messageFor(d,'Active trip','Families')).toContain('[class year]');expect(messageFor(d,'Active trip','Families')).toContain('[trip link available after launch]');
    d.features.videos=false;d.features.remember=false;const m=messageFor(d,'Active trip','Chaperones');expect(m).not.toContain('Share videos');expect(m).not.toContain('remembered');expect(m).toContain('No scholar names');
  });
});
