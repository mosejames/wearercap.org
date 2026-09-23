import { it, expect, vi } from "vitest";
import { sendNotice } from "../../supabase/functions/check-request-notify/send.ts";
const config = {
  emailKey: "test",
  emailFrom: "RCAP <test@example.test>",
  smsSid: "test-sid",
  smsToken: "test-token",
  smsFrom: "+15005550006",
  smsService: "",
};
it("routes phone updates to SMS without depending on email", async () => {
  const f = vi.fn().mockResolvedValue({ ok: true });
  await sendNotice(
    {
      id: "test",
      channel: "sms",
      recipient: "+15005550001",
      body: "Request updated",
      subject: "Update",
    },
    { ...config, emailKey: "" },
    f,
  );
  expect(f.mock.calls[0][0]).toContain("api.twilio.com");
  expect(new URLSearchParams(f.mock.calls[0][1].body).get("To")).toBe(
    "+15005550001",
  );
});
it("keeps existing email notifications working", async () => {
  const f = vi.fn().mockResolvedValue({ ok: true });
  await sendNotice(
    {
      id: "test",
      channel: "email",
      recipient: "test@example.test",
      body: "Request updated",
      subject: "Update",
    },
    config,
    f,
  );
  expect(f.mock.calls[0][0]).toContain("api.resend.com");
  expect(f.mock.calls[0][1].headers["Idempotency-Key"]).toBe("rcap-check-test");
});
it("fails clearly when text service is unavailable", async () => {
  const f = vi.fn();
  await expect(
    sendNotice(
      { channel: "sms", recipient: "+15005550001" },
      { ...config, smsToken: "" },
      f,
    ),
  ).rejects.toThrow("not configured");
  expect(f).not.toHaveBeenCalled();
});
it("sends the PDF as an attachment with a stable retry key", async () => {
  const request = vi.fn().mockResolvedValue({ ok: true });
  await sendNotice(
    {
      id: "archive-part-1",
      channel: "email",
      recipient: "rcaparents+check-requests@ronclarkacademy.com",
      subject: "RCAP archive",
      body: "Save the attached record.",
      attachments: [{ filename: "RCAP-123.pdf", content: "cGRm" }],
    },
    config,
    request,
  );
  const options = request.mock.calls[0][1];
  expect(JSON.parse(options.body).attachments[0].filename).toBe("RCAP-123.pdf");
  expect(options.headers["Idempotency-Key"]).toBe("rcap-check-archive-part-1");
});
it("sends the board notice as one email with every address on To and Reply-To set", async () => {
  const f = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ id: "re_123" }) });
  const board = [
    "treasurer@example.test",
    "officers@example.test",
    "chair@example.test",
  ];
  const result = await sendNotice(
    {
      id: "group",
      channel: "email",
      recipient: board.join(", "),
      recipients: board,
      reply_to: "officers@example.test",
      body: "Request submitted",
      subject: "RCAP request #12: submitted",
    },
    config,
    f,
  );
  expect(f).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(f.mock.calls[0][1].body);
  expect(payload.to).toEqual(board);
  expect(payload.reply_to).toBe("officers@example.test");
  expect(result).toEqual({ providerId: "re_123", failed: [] });
});
it("still reaches the good addresses when Resend refuses one", async () => {
  const f = vi.fn(async (_url, options) => {
    const to = JSON.parse(options.body).to;
    if (to.length > 1 || to[0] === "bad@example") return { ok: false, status: 422 };
    return { ok: true, json: async () => ({ id: "re_" + to[0] }) };
  });
  const result = await sendNotice(
    {
      id: "group",
      channel: "email",
      recipient: "a@example.test, bad@example, c@example.test",
      recipients: ["a@example.test", "bad@example", "c@example.test"],
      body: "x",
      subject: "y",
    },
    config,
    f,
  );
  expect(f).toHaveBeenCalledTimes(4);
  expect(result.failed).toEqual(["bad@example"]);
  expect(f.mock.calls[1][1].headers["Idempotency-Key"]).toBe("rcap-check-group-0");
});
it("fails the group email only when every address is refused", async () => {
  const f = vi.fn().mockResolvedValue({ ok: false, status: 422 });
  await expect(
    sendNotice(
      {
        id: "group",
        channel: "email",
        recipient: "a, b",
        recipients: ["a@x.test", "b@x.test"],
        body: "x",
        subject: "y",
      },
      config,
      f,
    ),
  ).rejects.toThrow("422");
});
it("does not add Reply-To to requester emails", async () => {
  const f = vi.fn().mockResolvedValue({ ok: true });
  await sendNotice(
    { id: "t", channel: "email", recipient: "parent@example.test", body: "b", subject: "s" },
    config,
    f,
  );
  const payload = JSON.parse(f.mock.calls[0][1].body);
  expect(payload.to).toEqual(["parent@example.test"]);
  expect(payload.reply_to).toBeUndefined();
});
