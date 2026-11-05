import {describe,it,expect} from 'vitest';
import {easternToday,upcomingMonths,dateLabel,schoolDates} from './calendar.js';
import {visibleAlbums} from './albums.js';

describe('Family hub calendar',()=>{
 it('uses Atlanta midnight, including daylight saving changes',()=>{
  expect(easternToday(new Date('2026-11-06T03:59:00Z'))).toBe('2026-11-05');
  expect(easternToday(new Date('2026-11-06T05:00:00Z'))).toBe('2026-11-06');
  expect(easternToday(new Date('2027-03-15T03:59:00Z'))).toBe('2027-03-14');
  expect(easternToday(new Date('2027-03-15T04:00:00Z'))).toBe('2027-03-15');
 });
 it('keeps events through their final day and removes them the next day',()=>{
  const dates=[{start:'2026-11-05',end:'2026-11-06',title:'EXP'},{start:'2026-11-08',end:'2026-11-10',title:'DC trip'}];
  expect(upcomingMonths('2026-11-06',dates)[0].items.map(e=>e.title)).toEqual(['EXP','DC trip']);
  expect(upcomingMonths('2026-11-07',dates)[0].items.map(e=>e.title)).toEqual(['DC trip']);
 });
 it('moves an ongoing cross-year break into the current month',()=>{
  const dates=[{start:'2026-12-21',end:'2027-01-05',title:'Holiday break'},{start:'2027-01-13',end:'2027-01-13',title:'Bingo'}];
  const months=upcomingMonths('2027-01-01',dates);
  expect(months.map(m=>m.month)).toEqual(['2027-01']);
  expect(months[0].items[0].title).toBe('Holiday break');
  expect(upcomingMonths('2027-01-06',dates)[0].items.map(e=>e.title)).toEqual(['Bingo']);
 });
 it('orders months and dates and handles the end of the calendar',()=>{
  expect(upcomingMonths('2027-08-01')).toEqual([]);
  const months=upcomingMonths('2026-11-05');
  expect(months[0].month).toBe('2026-11');
  expect(months[0].items[0].title).toBe('RCA EXP');
  expect(schoolDates.every(e=>e.end>=e.start)).toBe(true);
 });
 it('labels single-day and cross-month ranges without shifting dates',()=>{
  expect(dateLabel({start:'2026-11-05',end:'2026-11-06'})).toBe('Nov 5–6');
  expect(dateLabel({start:'2026-12-21',end:'2027-01-05'})).toBe('Dec 21–Jan 5');
  expect(dateLabel({start:'2027-01-13',end:'2027-01-13'})).toBe('Wed, Jan 13');
 });
});
describe('Hub Capsule album links',()=>{
 it('excludes hidden, ambiguous, other-vault, and unsafe album links',()=>{
  const album={house:'rcap',hidden:false,title:'Bingo Night',slug:'bingo-night',starts_on:'2026-09-15'};
  const result=visibleAlbums([album,{...album,hidden:true},{...album,hidden:null},{...album,house:'amistad'},{...album,slug:'../private'}]);
  expect(result).toHaveLength(1);
  expect(result[0].href).toBe('/rcap-capsule/e/bingo-night');
 });
 it('accepts an empty response without inventing a fallback album',()=>{
  expect(visibleAlbums(null)).toEqual([]);
  expect(visibleAlbums([])).toEqual([]);
 });
});
