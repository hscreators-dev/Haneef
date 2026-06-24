import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!client) {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("Twilio credentials not configured in .env");
    client = twilio(sid, token);
  }
  return client;
}

/**
 * Send OTP via Twilio SMS.
 * Phone number must include country code, e.g. "+919876543210"
 */
export async function sendSMS(to: string, otp: string): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER not set in .env");

  // Normalise: ensure leading +
  const toNorm = to.startsWith("+") ? to : `+91${to.replace(/\D/g, "").slice(-10)}`;

  const message = await getClient().messages.create({
    body: `Your FabricLink verification code is: ${otp}. Valid for ${process.env.OTP_EXPIRES_MINUTES ?? 10} minutes. Do not share this OTP.`,
    from,
    to: toNorm,
  });

  console.log(`📱 SMS sent to ${toNorm} | SID: ${message.sid}`);
}
