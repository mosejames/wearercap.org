// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { supabase } from "./api.js";
import { App, SignIn } from "./main.jsx";

vi.mock("./api.js", () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
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
  expect(host.textContent).toContain("Use verified backup email");
  expect(location.hash).toBe("#request/7d40ca03-9127-4f61-a1d8-ca2f1c378454");
});

it("keeps a daily reminder link on the board sign-in path", async () => {
  history.replaceState(null, "", "/check-requests/#approvals");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
  expect(host.textContent).toContain("Board access is added to that number");
  expect(host.textContent).not.toContain("Continue to expenses");
  expect(location.hash).toBe("#approvals");
});

it("allows cellphone signup but never creates an account from backup email sign-in", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<SignIn onError={vi.fn()} />));
  expect(host.textContent).not.toContain("Google");
  const fill = async (value) => act(async () => {
    const input = host.querySelector("input");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const submit = async () => act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await fill("4045550123");
  await submit();
  expect(supabase.auth.signInWithOtp).toHaveBeenLastCalledWith({ phone: "+14045550123", options: { shouldCreateUser: true, channel: "sms" } });
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Use verified backup email").click());
  await fill("Parent@Example.test");
  await submit();
  expect(supabase.auth.signInWithOtp).toHaveBeenLastCalledWith({ email: "parent@example.test", options: { shouldCreateUser: false } });
});
