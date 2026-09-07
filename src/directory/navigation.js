export function go(view = "", id = "", params = {}, anchor = "") {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = anchor;
  if (view) url.searchParams.set("view", view);
  if (id) url.searchParams.set("id", id);
  for (const [key, value] of Object.entries(params))
    if (value) url.searchParams.set(key, value);
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
