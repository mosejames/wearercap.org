type Job = {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  // Group notices (the board list in cr_private.config.notify_to) carry every
  // address here; they go out as ONE email with all of them on the To line.
  recipients?: string[] | null;
  reply_to?: string | null;
  attachments?: Array<{ filename: string; content: string }>;
};
type Config = {
  emailKey: string;
  emailFrom: string;
  smsSid: string;
  smsToken: string;
  smsFrom: string;
  smsService: string;
};
// What happened to the email. `providerId` is Resend's id, used later to ask
// Resend whether it was delivered or bounced. `failed` lists addresses Resend
// refused outright; the rest of the group still received the email.
export type SendResult = { providerId: string | null; failed: string[] };

async function resendEmail(
  job: Job,
  to: string[],
  key: string,
  config: Config,
  request: typeof fetch,
) {
  return await request("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.emailKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to,
      subject: job.subject,
      text: job.body,
      ...(job.reply_to ? { reply_to: job.reply_to } : {}),
      ...(job.attachments ? { attachments: job.attachments } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
}

async function providerId(response: Response) {
  try {
    const data = await response.json();
    return typeof data?.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

export async function sendNotice(
  job: Job,
  config: Config,
  request: typeof fetch = fetch,
): Promise<SendResult> {
  let response: Response;
  if (job.channel === "sms") {
    if (!/^\+1\d{10}$/.test(job.recipient))
      throw new Error("Invalid text recipient.");
    if (
      !config.smsSid ||
      !config.smsToken ||
      !(config.smsFrom || config.smsService)
    )
      throw new Error("Text service is not configured.");
    const body = new URLSearchParams({ To: job.recipient, Body: job.body });
    if (config.smsService) body.set("MessagingServiceSid", config.smsService);
    else body.set("From", config.smsFrom);
    response = await request(
      `https://api.twilio.com/2010-04-01/Accounts/${config.smsSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${config.smsSid}:${config.smsToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(`Notification provider returned ${response.status}`);
    return { providerId: null, failed: [] };
  }
  if (!config.emailKey) throw new Error("Email service is not configured.");
  const to = job.recipients?.length ? job.recipients : [job.recipient];
  response = await resendEmail(job, to, `rcap-check-${job.id}`, config, request);
  if (response.ok) return { providerId: await providerId(response), failed: [] };
  // Resend refuses the whole message when one address is invalid (4xx). One
  // bad address must not cost everyone else the email, so retry one by one.
  if (to.length > 1 && response.status >= 400 && response.status < 500) {
    const failed: string[] = [];
    let first: string | null = null;
    for (const [i, address] of to.entries()) {
      const single = await resendEmail(
        job,
        [address],
        `rcap-check-${job.id}-${i}`,
        config,
        request,
      );
      if (single.ok) first ??= await providerId(single);
      else failed.push(address);
    }
    if (failed.length === to.length)
      throw new Error(`Notification provider returned ${response.status}`);
    return { providerId: first, failed };
  }
  throw new Error(`Notification provider returned ${response.status}`);
}

// Resend's latest event for a sent email: delivered, bounced, complained...
export async function deliveryStatus(
  id: string,
  config: Config,
  request: typeof fetch = fetch,
) {
  const response = await request(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${config.emailKey}` },
    signal: AbortSignal.timeout(15000),
  });
  // A send-only API key cannot read emails back. Say so once, then stop asking.
  if (response.status === 401 || response.status === 403) return "unavailable";
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data?.last_event === "string" ? data.last_event : null;
}
