// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./main.jsx";

vi.mock("./api.js", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
  loadRequests: vi.fn().mockResolvedValue([]),
  loadStaff: vi.fn().mockResolvedValue([]),
  submit: vi.fn(),
  act: vi.fn(),
  details: vi.fn(),
  receiptUrl: vi.fn(),
  archiveUrl: vi.fn(),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  history.replaceState(null, "", "/");
});

it("asks a signed-out reviewer to sign in instead of showing a blank new request", async () => {
  history.replaceState(
    null,
    "",
    "/check-requests/#request/7d40ca03-9127-4f61-a1d8-ca2f1c378454",
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
  expect(host.textContent).toContain("Sign in to view this request");
  // Cellphone sign-in comes first on a request link. The treasurer opened an
  // email link, signed in by email, and landed in a second account; the
  // cellphone is the identity everyone's access is set up on.
  expect(host.querySelector('input[type="tel"]')).not.toBeNull();
  expect(host.textContent).toContain("Use email instead");
  expect(location.hash).toBe("#request/7d40ca03-9127-4f61-a1d8-ca2f1c378454");
});
