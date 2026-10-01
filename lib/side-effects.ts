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

export async function sendReceiptEmail(to: string, cc: string | null, orderNumber: string, stage: number) {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM || `no-reply@${domain}`;
  if (!key || !domain || key.includes("placeholder")) {
    console.log(`[mailgun:skip] to=${to} order=${orderNumber}`);
    return;
  }
  const form = new URLSearchParams();
  form.set("from", `Zedu Egret Store <${from}>`);
  form.set("to", to);
  if (cc && cc.toLowerCase() !== to.toLowerCase()) form.append("cc", cc);
  form.set("subject", `Order ${orderNumber} fulfilled - Stage ${stage}`);
  form.set("text", `Hi,\n\nYour Stage ${stage} verification order ${orderNumber} is FULFILLED.\n\n- Zedu Egret Store`);
  await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`api:${key}`).toString("base64") },
    body: form,
  }).catch((e) => console.error("[mailgun:error]", e));
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
