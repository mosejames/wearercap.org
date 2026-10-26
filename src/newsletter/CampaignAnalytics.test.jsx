import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
vi.mock('./api.js',()=>({supabase:{auth:{getSession:vi.fn(async()=>({data:{session:{access_token:'test'}}}))}}}));
import CampaignAnalytics,{AnalyticsSummary,linkClicks} from './CampaignAnalytics.jsx';
let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it('counts only newsletter clicks and explains generic destinations',()=>{
 const data={counts:{newsletterView:4,newsletter_tickets:3,newsletter_link:2,created:90,ticketClick:70},days:7,byDay:[]};
 expect(linkClicks(data.counts)).toBe(5);
 const html=renderToStaticMarkup(<AnalyticsSummary data={data}/>);
 expect(html).toContain('Buy raffle tickets');expect(html).toContain('Other newsletter links');expect(html).toContain('Gmail email opens are not tracked');expect(html).not.toContain('Photo cards');
});
it('opens the chosen issue only, changes reporting window and restores focus',async()=>{
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>({counts:{newsletterView:0},days:30,byDay:[],issue:{title:'Selected issue'}})}));vi.stubGlobal('fetch',fetcher);
 await act(async()=>root.render(<CampaignAnalytics issueId="chosen-issue" issueTitle="Selected issue"/>));
 const trigger=host.querySelector('button');await act(async()=>trigger.click());
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({action:'report',issueId:'chosen-issue',days:30});
 expect(document.querySelector('[role=dialog]').textContent).toContain('No tracked activity for this newsletter');
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='7 days').click());
 expect(JSON.parse(fetcher.mock.calls[1][1].body).days).toBe(7);
 await act(async()=>document.querySelector('[aria-label="Close analytics"]').click());expect(document.activeElement).toBe(trigger);
});
it('shows a report error rather than invented zero activity',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({error:'Unavailable'})})));
 await act(async()=>root.render(<CampaignAnalytics issueId="chosen-issue"/>));await act(async()=>host.querySelector('button').click());
 expect(document.querySelector('[role=alert]').textContent).toBe('Unavailable');expect(document.body.textContent).not.toContain('No tracked activity');
});
