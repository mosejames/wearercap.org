// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import NotificationPreferences from "./NotificationPreferences.jsx";
import { supabase } from "./api.js";
vi.mock("./api.js", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: { channel: "sms" }, error: null }),
  },
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("requires verified email for email preferences and saves a selection", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const user = { id: "u", phone: "+14045550123", phone_confirmed_at: "now" };
  await act(async () =>
    root.render(<NotificationPreferences user={user} onError={vi.fn()} />),
  );
  expect(host.querySelector('option[value="both"]').disabled).toBe(true);
  await act(async () =>
    root.render(
      <NotificationPreferences
        user={{
          ...user,
          email: "parent@example.test",
          email_confirmed_at: "now",
        }}
        onError={vi.fn()}
      />,
    ),
  );
  expect(host.querySelector('option[value="both"]').disabled).toBe(false);
  await act(async () => {
    const select = host.querySelector("select");
    select.value = "both";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(supabase.rpc).toHaveBeenCalledWith("cr_notification_preference", {
    p_channel: "both",
  });
  act(() => root.unmount());
  host.remove();
});
