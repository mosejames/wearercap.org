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
