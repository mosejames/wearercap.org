import {expect,it,vi} from 'vitest';
import {heroPrompt,generateHero} from './hero.js';
it('uses the approved fixed style without sending vault photos or contributor fields',()=>{const prompt=heroPrompt({destination:'Paris',landmarks:'Eiffel Tower',season:'Spring',setting:'Morning',photos:['private-photo'],contributor:'Private Name'});expect(prompt).toContain('Eiffel Tower');expect(prompt).toContain('No people');expect(prompt).not.toContain('private-photo');expect(prompt).not.toContain('Private Name');});
it('rejects oversized prompts before generation',()=>{expect(()=>heroPrompt({destination:'x'.repeat(81),landmarks:'',season:'',setting:''})).toThrow('Check destination');});
it('fails clearly when generation is not configured',async()=>{vi.stubEnv('OPENAI_API_KEY','');try{await expect(generateHero({},'admin@example.test')).rejects.toMatchObject({status:503});}finally{vi.unstubAllEnvs();}});
