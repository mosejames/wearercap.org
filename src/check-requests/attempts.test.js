// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { rpc, upload, mime } = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), mime: vi.fn() }));
vi.mock("../carpool/supabaseClient.js", () => ({ supabase: { rpc, storage: { from: () => ({ upload }) } } }));
vi.mock("./model.js", async (original) => ({ ...await original(), receiptMime: mime }));
import { submit } from "./api.js";
import { errorCategory } from "./attempts.js";
function draft() {
  return { id: crypto.randomUUID(), request_type: "reimbursement", phone: "4045550123", delivery: "zelle", zelle_contact: "secret@example.test", archive_email: "private@example.test", items: [{ date: "2026-11-01", vendor: "Private vendor", description: "Private expense", amount: "10", receipts: [{ name: "secret-receipt.pdf", file: new Blob(["secret receipt contents"]) }] }] };
}
const user = { id: crypto.randomUUID() };
const events = () => rpc.mock.calls.filter(([fn]) => fn === "cr_log_attempt").map(([,args]) => args.p_event);
const diagnostic = (value = { error: null }) => ({ abortSignal: vi.fn(() => Promise.resolve(value)) });
beforeEach(() => {
  rpc.mockReset(); upload.mockReset(); mime.mockReset();
  mime.mockResolvedValue("application/pdf"); upload.mockResolvedValue({ error: null });
  rpc.mockImplementation((fn) => fn === "cr_log_attempt" ? diagnostic() : Promise.resolve({ data: { reference: 42 }, error: null }));
});
afterEach(() => vi.useRealTimers());
it("records underlying upload failure before any insert, keeping the existing public error", async () => {
  upload.mockResolvedValue({ error: { statusCode: "413", message: "private", code: "secret@example.test" } });
  await expect(submit(draft(), user, vi.fn())).rejects.toThrow("A receipt could not be uploaded. Check your connection and try again.");
  expect(rpc.mock.calls.some(([fn]) => fn === "cr_action")).toBe(false);
  expect(events().filter(e => e.outcome === "failed")).toEqual([expect.objectContaining({ stage: "upload", error_code: "http_413", reference: null })]);
});
it("logs DB failure after its RPC and preserves the exact thrown object and saved upload", async () => {
  const error = { code: "23514", message: "private constraint details" };
  rpc.mockImplementation(fn => fn === "cr_log_attempt" ? diagnostic() : Promise.resolve({ error }));
  const d = draft();
  await expect(submit(d, user, vi.fn())).rejects.toBe(error);
  expect(d.items[0].receipts[0].path).toBeTruthy();
  const calls = rpc.mock.calls.map(([fn]) => fn);
  expect(calls.at(-2)).toBe("cr_action"); expect(calls.at(-1)).toBe("cr_log_attempt");
  expect(events().at(-1)).toMatchObject({ stage: "submit", outcome: "failed", error_code: "23514", reference: null });
});
it.each(["error response", "throw"])("ignores independent logging %s on success and on failure", async mode => {
  const error = new Error("private DB error");
  let failSubmission = false;
  rpc.mockImplementation(fn => {
    if (fn !== "cr_log_attempt") return Promise.resolve(failSubmission ? { error } : { data: { reference: 42 } });
    if (mode === "throw") throw Error("private logger token");
    return diagnostic({ error: { message: "private logger error" } });
  });
  await expect(submit(draft(), user, vi.fn())).resolves.toEqual({ reference: 42 });
  failSubmission = true;
  await expect(submit(draft(), user, vi.fn())).rejects.toBe(error);
});
it("bounds stalled logging even if cancellation is ignored", async () => {
  vi.useFakeTimers();
  rpc.mockImplementation(fn => fn === "cr_log_attempt" ? { abortSignal: () => new Promise(() => {}) } : Promise.resolve({ data: { reference: 42 } }));
  const pending = submit(draft(), user, vi.fn());
  await vi.runAllTimersAsync();
  expect(rpc.mock.calls.filter(([fn]) => fn === "cr_log_attempt")).toHaveLength(1);
  await expect(pending).resolves.toEqual({ reference: 42 });
});
it("correlates retries across draft edits, uses a new attempt, and reuses uploaded receipts", async () => {
  const d = draft();
  rpc.mockImplementationOnce(() => diagnostic());
  // First submission fails after uploading; second succeeds.
  let failed = false;
  rpc.mockImplementation(fn => {
    if (fn === "cr_log_attempt") return diagnostic();
    if (!failed) { failed = true; return Promise.resolve({ error: { code: "40001" } }); }
    return Promise.resolve({ data: { reference: 42 } });
  });
  await expect(submit(d, user, vi.fn())).rejects.toEqual({ code: "40001" });
  await submit({ ...d, purpose: "edited" }, user, vi.fn());
  expect(upload).toHaveBeenCalledTimes(1);
  const all = events();
  expect(new Set(all.map(e => e.correlation_id)).size).toBe(1);
  expect(new Set(all.map(e => e.attempt_id)).size).toBe(2);
  expect(all.at(-1)).toMatchObject({ stage: "submit", outcome: "succeeded", reference: 42 });
  await submit(draft(), user, vi.fn());
  expect(events().at(-1).correlation_id).not.toBe(all[0].correlation_id);
});
it("logs preparation and rejected upload errors without leaking payloads or inventing a reference", async () => {
  const d = draft(); d.reference = 999;
  mime.mockRejectedValueOnce(new Error("secret-receipt.pdf token private@example.test"));
  await expect(submit(d, user, vi.fn())).rejects.toThrow("secret-receipt.pdf");
  expect(events().at(-1)).toMatchObject({ stage: "prepare", error_code: "unknown", reference: null });
  upload.mockRejectedValueOnce(new TypeError("secret URL and token"));
  await expect(submit(d, user, vi.fn())).rejects.toBeInstanceOf(TypeError);
  expect(events().at(-1).error_code).toBe("network_or_client");
  const json = JSON.stringify(events());
  for (const privateText of ["secret", "private", "receipt.pdf", user.id, d.id, "999", "Private vendor", "Private expense"]) expect(json).not.toContain(privateText);
  expect(events().every(e => Object.keys(e).sort().join() === "attempt_id,correlation_id,error_code,outcome,reference,sequence,stage")).toBe(true);
});
it("uses an exact code allowlist", () => {
  expect(errorCategory({ code: "23514: private data" })).toBe("unknown");
  expect(errorCategory({ code: "23514" })).toBe("23514");
  expect(errorCategory({ name: "AbortError" })).toBe("aborted");
});

it("reuses the first receipt after a later upload fails, then completes a retry", async () => {
  const d = draft();
  d.items[0].receipts.push({ name: "second-private.pdf", file: new Blob(["private"]) });
  upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { status: 503 } });
  await expect(submit(d, user, vi.fn())).rejects.toThrow("A receipt could not be uploaded");
  const path = d.items[0].receipts[0].path;
  expect(path).toBeTruthy(); expect(d.items[0].receipts[1].path).toBeUndefined();
  await submit(d, user, vi.fn());
  expect(upload).toHaveBeenCalledTimes(3);
  expect(d.items[0].receipts[0].path).toBe(path);
});
