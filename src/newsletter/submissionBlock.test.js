import {expect, it} from 'vitest';
import {submissionBlock} from './submissionBlock';

it('turns the submitted link and action into an editable story button without exposing private files or contacts', () => {
  expect(submissionBlock({id:'one',title:'Our volunteers',details:'Thank you.',linkUrl:'https://example.com/join',actionText:'Join the team',email:'private@example.com',attachments:[{key:'private-file'}]}))
    .toEqual({id:'submission-one',type:'story',heading:'Our volunteers',body:'Thank you.',button:{label:'Join the team',url:'https://example.com/join'}});
});
it('preserves older submissions and uses a useful default label for a link alone', () => {
  const item={id:'old',title:'Photos',details:'Our latest gathering.',links:'Another resource'};
  expect(submissionBlock(item).body).toBe('Our latest gathering.\n\nAnother resource');
  expect(submissionBlock(item).button).toBeUndefined();
  expect(submissionBlock({...item,linkUrl:'https://example.com/photos'}).button.label).toBe('Learn more');
});
