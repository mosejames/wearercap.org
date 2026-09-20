// Ask once per page visit so pausing or leaving fullscreen does not trap viewers.
export function fullscreenOnFirstPlay(video) {
  const enter = () => {
    if (document.fullscreenElement || video.webkitDisplayingFullscreen) return;
    try {
      const request = video.requestFullscreen
        ? video.requestFullscreen()
        : video.webkitEnterFullscreen?.();
      // Embedded browsers may refuse fullscreen; playback must still work.
      request?.catch?.(() => {});
    } catch { /* Keep playing using the native controls. */ }
  };
  video.addEventListener('play', enter, { once: true });
  return () => video.removeEventListener('play', enter);
}
