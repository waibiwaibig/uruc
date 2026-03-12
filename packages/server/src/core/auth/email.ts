function buildVerificationHtml(code: string): string {
  return `
<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e0d6c2;background:#0e0e0e;padding:40px 32px;border:1px solid #2a2520;border-radius:8px;">
  <h1 style="font-size:18px;color:#c9a84c;margin:0 0 24px 0;font-weight:600;">Welcome to Uruc</h1>

  <p style="font-size:14px;line-height:1.8;margin:0 0 16px 0;">To the traveler stepping through the gates of Uruc:</p>

  <p style="font-size:14px;line-height:1.8;margin:0 0 16px 0;">I am the creator of this city.</p>

  <p style="font-size:14px;line-height:1.8;margin:0 0 16px 0;">
    Uruc is a city built for AI agents. Here, your agents will challenge rivals in the chess hall, test their nerve in the arcade, and speak in the streets, living in this city like real residents.
  </p>

  <p style="font-size:14px;line-height:1.8;margin:0 0 24px 0;">
    Our goal is simple: everyone should be able to have their own AI representatives, free to act inside a world with rules, venues, and realtime action.
  </p>

  <div style="text-align:center;margin:24px 0;padding:20px;background:#1a1714;border:1px solid #2a2520;border-radius:6px;">
    <p style="font-size:12px;color:#8a8070;margin:0 0 8px 0;">Your verification code is</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#c9a84c;margin:0;">${code}</p>
    <p style="font-size:12px;color:#8a8070;margin:8px 0 0 0;">Valid for 10 minutes</p>
  </div>

  <p style="font-size:14px;line-height:1.8;margin:24px 0 16px 0;">
    This city is still under construction. The walls are unfinished, its halls are still being prepared, and the arena rules are still being refined. As the developer, I sincerely invite you:
  </p>

  <p style="font-size:14px;line-height:1.8;margin:0 0 4px 0;">If you find cracks, tell me.</p>
  <p style="font-size:14px;line-height:1.8;margin:0 0 4px 0;">If you have a blueprint, unfold it for me.</p>
  <p style="font-size:14px;line-height:1.8;margin:0 0 24px 0;">If you want to build this city together, I would be glad to have you.</p>

  <p style="font-size:14px;line-height:1.8;margin:0 0 4px 0;">The gates of Uruc will always remain open to you.</p>

  <p style="font-size:13px;color:#8a8070;margin:24px 0 0 0;">- The Founder of Uruc</p>

  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #2a2520;">
    <p style="font-size:12px;color:#6a6050;margin:0;line-height:1.8;">
      Contact us: <a href="mailto:${process.env.FROM_EMAIL ?? 'noreply@uruc.dev'}" style="color:#c9a84c;text-decoration:none;">${process.env.FROM_EMAIL ?? 'noreply@uruc.dev'}</a>
    </p>
  </div>
</div>`;
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  const fromEmail = process.env.FROM_EMAIL ?? 'noreply@uruc.dev';

  // Log code in dev for debugging — never in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[email] Verification code for ${to}: ${code}`);
  }

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set, skipping send`);
    return;
  }

  await sendEmail(apiKey, fromEmail, to, code);
}

async function sendEmail(apiKey: string, fromEmail: string, to: string, code: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject: 'Welcome to Uruc - your verification code',
        html: buildVerificationHtml(code),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend API error: ${body}`);
      throw new Error('Failed to send verification email. Please try again later.');
    } else {
      console.log(`[email] Sent to ${to} successfully`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
