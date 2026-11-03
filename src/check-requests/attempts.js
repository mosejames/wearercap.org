// Correlate retries within this page without sending the draft or request UUID.
// Bound memory; reloading or eviction starts a new correlation.
const correlations = new Map();
const codes = new Set([
  "23505", "23503", "23514", "42501", "P0001", "57014", "40001",
  "40P01", "PGRST301", "PGRST302", "PGRST003",
]);
export function errorCategory(error) {
  // Never inspect/copy message, details, hint, stack, URL, or arbitrary codes.
  if (codes.has(error?.code)) return error.code;
  if (error?.name === "AbortError") return "aborted";
  if (error?.name === "TypeError") return "network_or_client";
  const status = Number(error?.statusCode ?? error?.status);
  if ([400, 401, 403, 409, 413, 415, 429, 500, 502, 503, 504].includes(status))
    return `http_${status}`;
  return "unknown";
}
export function submissionAttempt(client, draftId) {
  let correlation = correlations.get(draftId);
  if (!correlation) {
    correlation = crypto.randomUUID();
    if (correlations.size >= 100) correlations.delete(correlations.keys().next().value);
    correlations.set(draftId, correlation);
  }
  const attempt = crypto.randomUUID();
  let sequence = 0;
  let failed = false;
  let budget = 1500;
  async function log(stage, outcome, error = null, reference = null) {
    if (outcome === "failed") failed = true;
    if (budget <= 0) return;
    const started = Date.now();
    const controller = new AbortController();
    let timer;
    try {
      // A separate HTTP RPC commits independently of cr_action. Time-bound it
      // even if a transport fails to honor cancellation. Never replace errors.
      await Promise.race([
        client.rpc("cr_log_attempt", {
          p_event: {
            correlation_id: correlation,
            attempt_id: attempt,
            sequence: ++sequence,
            stage,
            outcome,
            error_code: outcome === "failed" ? errorCategory(error) : null,
            reference: Number.isSafeInteger(reference) && reference > 0 ? reference : null,
          },
        }).abortSignal(controller.signal),
        new Promise((resolve) => {
          timer = setTimeout(() => { controller.abort(); resolve(); }, budget);
        }),
      ]);
    } catch {
      // No console fallback: SDK errors can contain private request information.
    } finally {
      clearTimeout(timer);
      budget -= Math.max(0, Date.now() - started);
    }
  }
  return { log, fail: (stage, error) => failed ? Promise.resolve() : log(stage, "failed", error) };
}
