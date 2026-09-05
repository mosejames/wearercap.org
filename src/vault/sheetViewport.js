// iOS keyboards resize/pan the visual viewport without resizing fixed overlays.
export function followSheetViewport(element, browser = window) {
  const viewport = browser.visualViewport;
  const update = () => {
    element.style.top = `${viewport?.offsetTop ?? 0}px`;
    element.style.height = `${viewport?.height ?? browser.innerHeight}px`;
  };
  update();
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  browser.addEventListener('resize', update);
  return () => {
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    browser.removeEventListener('resize', update);
  };
}
