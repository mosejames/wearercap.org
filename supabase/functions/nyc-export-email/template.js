export const VIDEO_DOWNLOAD_URL = 'https://www.dropbox.com/scl/fo/k20wxmg2ovm48e5n7snbn/AHTX3tkn4_p3hTDTaGhIRZs?rlkey=y0aeth9f4gdi48cjeeauadnl4&dl=1';
export function emailContent({url,count}) {
 const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text = `Thank you for being part of our Class of 2029 NYC adventure!

Your ZIP with ${count} photos is ready. Both groups are included.

Download all photos (ZIP):
${url}

Download videos:
${VIDEO_DOWNLOAD_URL}

The photo link expires in 48 hours. Videos download separately from the NYC Dropbox folder in their original format.

With gratitude,
RCAP`;
 const button = (label,href) => `<p><a href="${escape(href)}" style="display:inline-block;background:#f0b323;color:#1a2a56;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none">${label}</a></p>`;
 const html = `<div style="font-family:Arial,sans-serif;color:#1a2a56;max-width:560px;margin:auto;padding:24px"><h1 style="font-size:26px">Your NYC memories are ready 🗽</h1><p>Thank you for being part of our Class of 2029 NYC adventure!</p><p>Your ZIP includes ${count} photos from both groups.</p>${button('Download all photos (ZIP)',url)}${button('Download videos',VIDEO_DOWNLOAD_URL)}<p>The photo link expires in 48 hours. Videos download separately from the NYC Dropbox folder in their original format.</p><p>With gratitude,<br>RCAP</p></div>`;
 return {text,html};
}
