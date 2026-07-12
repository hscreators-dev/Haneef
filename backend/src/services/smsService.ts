// ─── SMS delivery — provider-agnostic (no Twilio lock-in) ─────────────────────
// Pick your gateway with SMS_PROVIDER. You are NOT tied to Twilio — use a
// cheaper/free-tier provider (MSG91, Fast2SMS), your own relay (`http`), or
// Twilio if you already have it. In development with nothing configured it
// falls back to `console` so you can test without any account.
//
//   SMS_PROVIDER = console | http | msg91 | fast2sms | twilio   (default: console)
//   SMS_API_URL  = your gateway endpoint (for http/msg91/fast2sms)
//   SMS_API_KEY  = auth key / token for that gateway
//   SMS_SENDER   = sender/brand id (where the provider needs one)
//
// "http" contract (your own API): POST JSON { to, message, code } with header
// Authorization: Bearer <SMS_API_KEY>. Build a tiny relay behind that and you
// can forward to any carrier without touching this app again.

const APP_NAME = process.env.OTP_APP_NAME ?? "Garm";
const EXPIRES = process.env.OTP_EXPIRES_MINUTES ?? "10";

function otpMessage(otp: string): string {
  return `Your ${APP_NAME} verification code is ${otp}. Valid for ${EXPIRES} minutes. Do not share this code with anyone.`;
}

function normalizePhone(raw: string): string {
  const cc = (process.env.OTP_DEFAULT_COUNTRY_CODE ?? "91").replace(/\D/g, "");
  const s = String(raw ?? "").trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+" + cc + digits;
  return "+" + digits;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`SMS gateway ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
}

/** Send an OTP over SMS via the configured provider. */
export async function sendSMS(to: string, otp: string): Promise<void> {
  const provider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const toNorm = normalizePhone(to);
  const key = process.env.SMS_API_KEY ?? "";

  switch (provider) {
    case "console":
      console.log(`\n📱 [SMS:console] to ${toNorm}: ${otpMessage(otp)}\n`);
      return;

    case "msg91":
      await postJson(process.env.SMS_API_URL ?? "https://control.msg91.com/api/v5/otp",
        { mobile: toNorm.replace("+", ""), otp, sender: process.env.SMS_SENDER ?? APP_NAME.slice(0, 6).toUpperCase() },
        { authkey: key });
      return;

    case "fast2sms": {
      const r = await fetch(process.env.SMS_API_URL ?? "https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: { authorization: key, "Content-Type": "application/json" },
        body: JSON.stringify({ route: "otp", variables_values: otp, numbers: toNorm.replace(/^\+91/, "").replace("+", "") }),
      });
      if (!r.ok) throw new Error(`fast2sms ${r.status}`);
      return;
    }

    case "twilio": {
      // Dynamic import so the twilio package is only needed if you actually use it.
      const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER;
      if (!sid || !token || !from) throw new Error("Twilio credentials not configured");
      const twilio = (await import("twilio")).default;
      await twilio(sid, token).messages.create({ body: otpMessage(otp), from, to: toNorm });
      return;
    }

    case "http":
    default: {
      const url = process.env.SMS_API_URL;
      if (!url) throw new Error("SMS_API_URL not set for the 'http' SMS provider");
      await postJson(url, { to: toNorm, message: otpMessage(otp), code: otp }, { Authorization: `Bearer ${key}` });
      return;
    }
  }
}
