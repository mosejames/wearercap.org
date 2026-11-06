/* Homepage entry only. Explicit section links and individual tools keep their destinations. */
(function () {
  var location = window.location;
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;
  var params = new URLSearchParams(location.search);
  var choice = params.get('view');
  var key = 'rcap-site-view-v1';
  var preference = null;
  try { preference = window.localStorage.getItem(key); } catch (_) {}
  if (choice === 'full') {
    try { window.localStorage.setItem(key, 'full'); } catch (_) {}
    return;
  }
  if (choice === 'app') {
    try { window.localStorage.removeItem(key); } catch (_) {}
  } else {
    var navigator = window.navigator;
    var mobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent || '')
      || (/Macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1)
      || !!(navigator.userAgentData && navigator.userAgentData.mobile);
    if (!mobile || preference === 'full' || location.hash) return;
  }
  params.delete('view');
  var query = params.toString();
  location.replace('/app/' + (query ? '?' + query : ''));
})();
