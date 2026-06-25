import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new Error("Gmail credentials not configured in .env");

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, otp: string): Promise<void> {
  const fromName = process.env.EMAIL_FROM_NAME ?? "Garm";
  const user     = process.env.GMAIL_USER!;
  const expires  = process.env.OTP_EXPIRES_MINUTES ?? "10";

  const html = `
    <div style="font-family:DM Sans,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#F8F7F5;border-radius:16px;">
      <div style="background:#0D0D0D;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <span style="color:#fff;font-size:22px;">🔐</span>
      </div>
      <h2 style="margin:0 0 8px;color:#0D0D0D;font-size:20px;font-weight:700;">Your Garm OTP</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Use the code below to sign in. It expires in <strong>${expires} minutes</strong>.
      </p>
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:12px;color:#0D0D0D;font-family:monospace;">${otp}</p>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
        If you didn't request this, you can safely ignore this email.<br/>
        Never share this OTP with anyone.
      </p>
    </div>
  `;

  const info = await getTransporter().sendMail({
    from:    `"${fromName}" <${user}>`,
    to,
    subject: `${otp} — Your Garm verification code`,
    html,
    text:    `Your Garm OTP is: ${otp}. It expires in ${expires} minutes.`,
  });

  console.log(`📧 Email sent to ${to} | MessageId: ${info.messageId}`);
}
