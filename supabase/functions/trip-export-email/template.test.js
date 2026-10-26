// @vitest-environment node
import {expect,it} from 'vitest';
import {emailContent} from './template.js';
it('delivers separate photo and video buttons with fresh receipt checks and escaped trip text',()=>{
 const value=emailContent({destination:'A <trip>',cohort:'2035',count:123,url:'https://wearercap.org/trip-vault/?trip=verification-trip&archive='+'a'.repeat(64),expires:'2030-01-01T12:00:00Z',hasVideos:true});
 expect(value.html).toContain('Download photos ZIP');expect(value.html).toContain('Download videos');expect(value.html).toContain('export-file');expect(value.html).toContain('export-video');expect(value.html).toContain('A &lt;trip&gt;');expect(value.text).toContain('123 visible photos');expect(value.html).not.toContain('nyc-vault');
});
it('omits a video download button when no video folder was configured',()=>{expect(emailContent({destination:'Trip',cohort:'2035',count:1,url:'https://wearercap.org/trip-vault/?trip=trip&archive='+'a'.repeat(64),expires:'2030',hasVideos:false}).html).not.toContain('Download videos');});
