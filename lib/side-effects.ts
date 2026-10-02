export async function fetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "zedu-egret-checkout/1.0" },
    });
  } finally {
    clearTimeout(t);
  }
}

export type EmailStatus = "sent" | "skipped" | "failed";

export function receiptText(orderNumber: string, stage: number) {
  return (
    `Hi,\n\nYour Stage ${stage} verification order ${orderNumber} is FULFILLED.\n\n` +
    `Your name will be added to the contributors list for stage 2 group task, keep working on your individual task.\n\n` +
    `— Zedu Egret Store`
  );
}

export async function sendReceiptEmail(to: string, cc: string | null, orderNumber: string, stage: number): Promise<EmailStatus> {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM || `no-reply@${domain}`;
  if (!key || !domain || key.includes("placeholder") || domain.includes("example.com")) {
    console.log(`[mailgun:skip] to=${to} order=${orderNumber} (no live domain configured)`);
    return "skipped";
  }
  const form = new URLSearchParams();
  form.set("from", `Zedu Egret Store <${from}>`);
  form.set("to", to);
  if (cc && cc.toLowerCase() !== to.toLowerCase()) form.append("cc", cc);
  form.set("subject", `Order ${orderNumber} fulfilled - Stage ${stage}`);
  form.set("text", receiptText(orderNumber, stage));
  try {
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`api:${key}`).toString("base64") },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[mailgun:failed] status=${res.status} to=${to} order=${orderNumber} body=${body.slice(0, 300)}`);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("[mailgun:error]", e);
    return "failed";
  }
}

export function triggerContributorsBuild(payload: object) {
  const url = process.env.CONTRIBUTORS_WEBHOOK_URL;
  const token = process.env.CONTRIBUTORS_WEBHOOK_TOKEN;
  if (!url || !token) {
    console.log("[webhook:skip] contributors build not configured");
    return;
  }
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("[webhook:error]", e));
}
