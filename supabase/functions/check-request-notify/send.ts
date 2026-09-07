type Job = {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
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
export async function sendNotice(
  job: Job,
  config: Config,
  request: typeof fetch = fetch,
) {
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
  } else {
    if (!config.emailKey) throw new Error("Email service is not configured.");
    response = await request("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.emailKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `rcap-check-${job.id}`,
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [job.recipient],
        subject: job.subject,
        text: job.body,
        ...(job.attachments ? { attachments: job.attachments } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
  }
  if (!response.ok)
    throw new Error(`Notification provider returned ${response.status}`);
}
