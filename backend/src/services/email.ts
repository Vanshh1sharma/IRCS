import { Resend } from "resend";

export type VerificationEmail = {
  recipient: string;
  verificationUrl: string;
};

export type EmailDeliveryResult = {
  delivered: boolean;
};

const SUBJECT = "Verify your email - Indian Red Cross Society - NIET";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] ?? character);
}

export async function sendVerificationEmail(email: VerificationEmail): Promise<EmailDeliveryResult> {
  if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() !== "resend") return { delivered: false };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { delivered: false };

  const verificationUrl = escapeHtml(email.verificationUrl);
  const text = [
    "Verify your email - Indian Red Cross Society - NIET",
    "",
    "This is an email verification message for your IRCS-NIET application.",
    `Click this link to verify your email: ${email.verificationUrl}`,
    "",
    "This link expires according to the server-side verification token expiry.",
    "Email verification does not mean that your application has been approved.",
    "If you did not submit this application, you can ignore this email.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f7f8;color:#1f2933;font-family:Arial,sans-serif;line-height:1.6">
    <main style="max-width:600px;margin:32px auto;padding:32px;background:#ffffff">
      <h1 style="margin-top:0;color:#8b1e2d;font-size:24px">Verify your email</h1>
      <p>This is an email verification message for your IRCS-NIET application.</p>
      <p><a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#8b1e2d;color:#ffffff;text-decoration:none">Verify email address</a></p>
      <p>This link expires according to the server-side verification token expiry.</p>
      <p>Email verification does not mean that your application has been approved.</p>
      <p>If you did not submit this application, you can ignore this email.</p>
      <p style="color:#667085;font-size:13px">Indian Red Cross Society - NIET</p>
    </main>
  </body>
</html>`;

  try {
    const result = await new Resend(apiKey).emails.send({
      from,
      to: email.recipient,
      subject: SUBJECT,
      text,
      html,
    });
    return { delivered: !result.error };
  } catch {
    return { delivered: false };
  }
}
