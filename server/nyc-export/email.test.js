import {describe,it,expect} from 'vitest';
import {emailContent,VIDEO_DOWNLOAD_URL} from '../../supabase/functions/nyc-export-email/template.js';
describe('NYC staff delivery email',()=>{
 it('offers both downloads in HTML and plain text',()=>{const url='https://wearercap.org/nyc-vault/?archive='+'a'.repeat(64);const {html,text}=emailContent({url,count:714});expect(html).toContain('Download all photos (ZIP)');expect(html).toContain('Download videos');expect(text).toContain(url);expect(text).toContain(VIDEO_DOWNLOAD_URL);expect(new URL(VIDEO_DOWNLOAD_URL).searchParams.get('dl')).toBe('1');expect(html).not.toContain('videos are not included');});
 it('escapes link attributes',()=>{const {html}=emailContent({url:'https://example.com/?x="<bad>&',count:714});expect(html).not.toContain('<bad>');expect(html).toContain('&quot;&lt;bad&gt;&amp;');});
});
