import {describe,it,expect} from 'vitest';
import {QUESTIONS,nextQuestion,suggestedFollowups} from './data.js';
describe('questions at the member’s pace',()=>{
 it('skips your answered questions while preserving unanswered questions even when a teammate answered',()=>{const qs=QUESTIONS.slice(0,3);const entries=[{question_id:qs[1].id,author_id:'me'},{question_id:qs[2].id,author_id:'peer'}];expect(nextQuestion(qs,entries,'me',qs[0].id).id).toBe(qs[2].id);});
 it('returns to the beginning when every question has an answer',()=>{expect(nextQuestion(QUESTIONS,QUESTIONS.map(q=>({question_id:q.id,author_id:'me'})),'me',QUESTIONS.at(-1).id).id).toBe(QUESTIONS[0].id);});
 it('turns a resource observation into a question about responsibility rather than a decision',()=>{expect(suggestedFollowups({content:'We need bags of ice.',section:'provision'}).some(q=>q.title.includes('responsibility been confirmed'))).toBe(true);});
});

describe('committee invitations',()=>{
 it('links an invited person to the intended committee',async()=>{const {committeeInviteUrl,committeeInvitation}=await import('./data.js');const url=committeeInviteUrl('uniform','https://wearercap.org');expect(url).toBe('https://wearercap.org/uniform-playbook/?committee=uniform');expect(committeeInvitation('Uniform Committee','person@example.com',url)).toContain('Sign in with: person@example.com');});
});
