// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import Account from "./Account.jsx";
import { supabase } from "./api.js";
vi.mock("./api.js", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("adds and verifies email on the existing user instead of creating another account", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <Account
        user={{ phone: "14045550123", email: "parent@example.test" }}
        onError={vi.fn()}
      />,
    ),
  );
  const submit = () =>
    host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await act(async () => submit());
  expect(supabase.auth.updateUser).toHaveBeenCalledWith(
    { email: "parent@example.test" },
    expect.any(Object),
  );
  expect(host.textContent).toContain("Email confirmation code");
  await act(async () => submit());
  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "email_change",
      email: "parent@example.test",
    }),
  );
  await act(async () => root.unmount());
  host.remove();
});
