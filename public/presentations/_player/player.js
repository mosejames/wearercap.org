/* RCAP presentation player. Shared by every deck under /presentations/.
   Markup contract: <div class="deck-canvas"> holding one <section> per slide,
   each with an optional <aside> of speaker notes as its last child.
   Pinned children with data-build-in="rise|fade|pop" reveal one per click. */
(function () {
  const canvas = document.querySelector('.deck-canvas');
  const stage = document.querySelector('.deck-stage');
  if (!canvas || !stage) return;
  const slides = Array.from(canvas.querySelectorAll(':scope > section'));
  const count = slides.length;
  const $ = (s) => document.querySelector(s);
  const countEl = $('.deck-count');
  const progress = $('.deck-progress');
  const notes = $('.deck-notes');
  const notesBody = $('.deck-notes p');
  const notesBtn = $('[data-deck="notes"]');
  const help = $('.deck-help');
  let index = 0;
  let step = 0; // builds shown on the current slide

  const builds = (i) => Array.from(slides[i].querySelectorAll('[data-build-in]'));

  function fit() {
    const r = stage.getBoundingClientRect();
    const s = Math.min(r.width / 1920, r.height / 1080);
    canvas.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  function paintBuilds() {
    builds(index).forEach((el, n) => el.classList.toggle('is-pending', n >= step));
  }

  function show(i, atEnd) {
    index = Math.max(0, Math.min(count - 1, i));
    step = atEnd ? builds(index).length : 0;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === index));
    paintBuilds();
    if (countEl) countEl.textContent = (index + 1) + ' / ' + count;
    if (progress) progress.style.width = ((index + 1) / count * 100) + '%';
    const aside = slides[index].querySelector(':scope > aside');
    if (notesBody) notesBody.textContent = aside ? aside.textContent.trim() : 'No notes for this slide.';
    history.replaceState(null, '', '#' + (index + 1));
  }

  function next() {
    const b = builds(index);
    if (step < b.length) { step++; paintBuilds(); return; }
    if (index < count - 1) show(index + 1);
  }
  function prev() {
    if (step > 0) { step--; paintBuilds(); return; }
    if (index > 0) show(index - 1, true);
  }
  function toggleNotes(force) {
    const open = typeof force === 'boolean' ? force : !notes.classList.contains('is-open');
    notes.classList.toggle('is-open', open);
    if (notesBtn) notesBtn.setAttribute('aria-pressed', String(open));
  }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); show(0); break;
      case 'End': e.preventDefault(); show(count - 1, true); break;
      case 'f': case 'F': toggleFull(); break;
      case 'n': case 'N': toggleNotes(); break;
      case 'p': case 'P': document.body.classList.toggle('is-presenting'); setTimeout(fit, 50); break;
      case '?': help && help.classList.toggle('is-open'); break;
      case 'Escape': document.body.classList.remove('is-presenting'); help && help.classList.remove('is-open'); setTimeout(fit, 50); break;
      default: {
        const d = Number(e.key);
        if (Number.isInteger(d) && d >= 1 && d <= Math.min(9, count)) show(d - 1);
      }
    }
  });

  stage.addEventListener('click', (e) => {
    if (e.target.closest('a,button')) return;
    const r = stage.getBoundingClientRect();
    (e.clientX - r.left < r.width * 0.25) ? prev() : next();
  });

  let tx = null;
  stage.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
  });

  document.querySelectorAll('[data-deck]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const a = b.getAttribute('data-deck');
    if (a === 'prev') prev();
    if (a === 'next') next();
    if (a === 'notes') toggleNotes();
    if (a === 'full') toggleFull();
    if (a === 'help') help && help.classList.toggle('is-open');
  }));

  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));
  const start = parseInt((location.hash || '').slice(1), 10);
  fit();
  show(Number.isInteger(start) ? start - 1 : 0);
  if (new URLSearchParams(location.search).has('notes')) toggleNotes(true);
})();
