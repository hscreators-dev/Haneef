import nodemailer from "nodemailer";

// ─── Email delivery — any SMTP host, not just Gmail ───────────────────────────
// Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS for any provider (your own
// mail server, Brevo, Mailgun, Zoho, etc.). Gmail still works as a shortcut via
// GMAIL_USER + GMAIL_APP_PASSWORD. With nothing configured (dev), the code is
// logged to the console so you can test without any account.

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  // 1) Generic SMTP (preferred — works with any provider or your own server)
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: (process.env.SMTP_SECURE ?? (process.env.SMTP_PORT === "465" ? "true" : "false")) === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      // Never let a broken/unreachable SMTP host hang the login request —
      // fail fast so send-otp can fall back (dev code) quickly.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    return transporter;
  }
  // 2) Gmail shortcut
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    return transporter;
  }
  // 3) Not configured — dev console fallback
  return null;
}

export async function sendEmail(to: string, otp: string): Promise<void> {
  const fromName = process.env.EMAIL_FROM_NAME ?? "Garm";
  const fromAddr = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? process.env.GMAIL_USER ?? "no-reply@garm.app";
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

  const tx = getTransporter();
  if (!tx) {
    // No SMTP configured — dev fallback so login is testable without an account.
    console.log(`\n📧 [Email:console] to ${to}: Your ${fromName} code is ${otp} (expires ${expires} min)\n`);
    return;
  }

  const info = await tx.sendMail({
    from:    `"${fromName}" <${fromAddr}>`,
    to,
    subject: `${otp} — Your Garm verification code`,
    html,
    text:    `Your Garm OTP is: ${otp}. It expires in ${expires} minutes.`,
  });

  console.log(`📧 Email sent to ${to} | MessageId: ${info.messageId}`);
}
