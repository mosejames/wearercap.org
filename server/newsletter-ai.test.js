import{describe,it,expect,vi,beforeEach}from'vitest';
vi.mock('./newsletter-console.js',()=>({newsletterRpc:vi.fn()}));
vi.mock('./london-stories/storage.js',()=>({objectRequest:vi.fn(),encrypt:vi.fn(),decrypt:vi.fn()}));
import aiAction,{aiRequest,cleanAiResult,SCHOOL_CALENDAR}from'./newsletter-ai';import{newsletterRpc}from'./newsletter-console';import{objectRequest}from'./london-stories/storage';
const now=new Date('2026-10-25T12:00:00Z'),source='https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/';
const idea={title:'A holiday planning note',pitch:'Help families plan',timing:'Before the holiday',date:'2026-11-11',category:'Holiday',outline:['Confirm school arrangements'],sources:[{title:'Federal holidays',url:source}]};
const response=ideas=>({output:[{type:'web_search_call',action:{sources:[{url:source+'?utm_source=openai'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({message:'Useful ideas',ideas})}]}]});
beforeEach(()=>vi.clearAllMocks());
describe('calendar-aware editorial assistant',()=>{
 it('uses the public calendar and fresh search without storing responses or including private submissions',()=>{const request=aiRequest('Useful ideas',now);expect(request.store).toBe(false);expect(request.tool_choice).toBe('required');expect(request.input[0].content[1].file_url).toBe(SCHOOL_CALENDAR);expect(request.instructions).toContain('2026-10-25');expect(request.instructions).toContain('nonpartisan');expect(JSON.stringify(request)).not.toContain('OPENAI_API_KEY');});
 it('keeps only sourced suggestions with relevant dates',()=>{const result=cleanAiResult(response([idea,{...idea,title:'Unverified',sources:[{title:'Invented',url:'https://fake.example/date'}]},{...idea,date:'2027-05-01'},{...idea,date:'2026-99-01'}]),now);expect(result.ideas).toHaveLength(1);expect(result.ideas[0].sources[0].url).toBe(source.replace(/\/$/,''));});
 it('does not accept school-calendar citations as evidence of external holiday dates',()=>{expect(()=>cleanAiResult(response([{...idea,sources:[{title:'School calendar',url:SCHOOL_CALENDAR}]}]),now)).toThrow('sourced');});
 it('allows a brief clarifying question without treating rejected sources as valid ideas',()=>{expect(cleanAiResult(response([]),now,true).ideas).toEqual([]);expect(()=>cleanAiResult(response([{...idea,sources:[]}]),now,true)).toThrow();});
 it('requires invited-editor access before reading the cache or invoking AI',async()=>{newsletterRpc.mockRejectedValue(Error('Sign in'));await expect(aiAction({},{action:'ideaSuggestions'})).rejects.toThrow('Sign in');expect(objectRequest).not.toHaveBeenCalled();});
});
