import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import crypto from "crypto";

export const runtime = "nodejs";

// Rate limit: 3 attempts per IP per 15 min, 2 per username per hour
const IP_LIMIT       = 3;
const IP_WINDOW_SEC  = 15 * 60;
const USR_LIMIT      = 2;
const USR_WINDOW_SEC = 60 * 60;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function checkIpLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const key = `ratelimit:forgot:ip:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, IP_WINDOW_SEC);
    if (count > IP_LIMIT) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfterSec: ttl > 0 ? ttl : IP_WINDOW_SEC };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch { return { allowed: true, retryAfterSec: 0 }; }
}

async function checkUsernameLimit(username: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const key = `ratelimit:forgot:usr:${username.toLowerCase()}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, USR_WINDOW_SEC);
    if (count > USR_LIMIT) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfterSec: ttl > 0 ? ttl : USR_WINDOW_SEC };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch { return { allowed: true, retryAfterSec: 0 }; }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIp(req);
    const ipCheck = await checkIpLimit(ip);
    if (!ipCheck.allowed) {
      const mins = Math.ceil(ipCheck.retryAfterSec / 60);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${mins} minute${mins > 1 ? "s" : ""}.` },
        { status: 429, headers: { "Retry-After": String(ipCheck.retryAfterSec) } }
      );
    }

    const { username } = await req.json();
    if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });

    // Per-username rate limit: max 2 attempts per hour
    const usrCheck = await checkUsernameLimit(username);
    if (!usrCheck.allowed) {
      const mins = Math.ceil(usrCheck.retryAfterSec / 60);
      return NextResponse.json(
        { error: `Too many attempts for this username. Try again in ${mins} minute${mins > 1 ? "s" : ""}.` },
        { status: 429, headers: { "Retry-After": String(usrCheck.retryAfterSec) } }
      );
    }

    // Artificial delay 300-600ms — prevents timing attacks
    await new Promise(r => setTimeout(r, 300 + Math.random() * 300));

    const admin = await prisma.admin.findUnique({ where: { username } });

    // Username not found
    if (!admin) {
      return NextResponse.json({ notFound: true });
    }

    // Username found but no email
    if (!admin.email) {
      return NextResponse.json({ noEmail: true });
    }

    // Generate token
    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    // ACID: invalidate old tokens + create new one atomically
    await prisma.$transaction([
      prisma.passwordReset.updateMany({ where: { adminId: admin.id, used: false }, data: { used: true } }),
      prisma.passwordReset.create({ data: { token, adminId: admin.id, expiresAt } }),
    ]);

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    // Mask email: yshaff040302@gmail.com → y***@gmail.com
    const [localPart, domain] = admin.email.split("@");
    const maskedEmail = localPart[0] + "***@" + domain;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "CodeSpace <noreply@yardansh.com>",
        replyTo: "noreply@yardansh.com",
        to:      [admin.email],
        subject: "Reset your CodeSpace password",
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reset your CodeSpace password</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:48px 16px 64px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:28px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <img src="https://cloud.yardansh.com/8MCWUj.png?raw=1" alt="CodeSpace" width="40" height="40"
                  style="display:block;width:40px;height:40px;border-radius:10px;border:0;">
              </td>
              <td style="padding-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:17px;font-weight:700;color:#f0f0f0;letter-spacing:0.1em;">
                CODESPACE
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#1a1a1a;border:2px solid #2e2e2e;border-radius:14px;overflow:hidden;">
          <div style="height:4px;background:linear-gradient(90deg,#4ecdc4 0%,#2bb5ac 100%);"></div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 32px 28px;">

            <!-- Heading -->
            <tr><td style="padding-bottom:22px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://cloud.yardansh.com/8MCWUj.png?raw=1" alt="CS" width="48" height="48"
                      style="display:block;width:48px;height:48px;border-radius:11px;border:1.5px solid #2e4444;">
                  </td>
                  <td style="padding-left:16px;vertical-align:middle;">
                    <p style="margin:0 0 3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.14em;color:#4ecdc4;text-transform:uppercase;">Password Reset</p>
                    <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:21px;font-weight:700;color:#f0f0f0;letter-spacing:-0.01em;">Reset your password</h1>
                  </td>
                </tr>
              </table>
            </td></tr>

            <!-- Body -->
            <tr><td style="padding-bottom:28px;">
              <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#bbb;line-height:1.7;">
                Hey <strong style="color:#f0f0f0;">${admin.username}</strong> 👋
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#888;line-height:1.7;">
                Someone requested a password reset for your CodeSpace account.
                Click the button below to set a new password.
                This link is valid for <strong style="color:#f5c542;">30 minutes</strong> only.
              </p>
            </td></tr>

            <!-- Button -->
            <tr><td style="padding-bottom:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#4ecdc4;border-radius:9px;">
                    <a href="${resetUrl}"
                      style="display:inline-block;padding:14px 34px;color:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.06em;">
                      Reset Password &nbsp;→
                    </a>
                  </td>
                </tr>
              </table>
            </td></tr>

            <!-- Divider -->
            <tr><td style="padding-bottom:22px;">
              <div style="height:1px;background:#252525;"></div>
            </td></tr>

            <!-- Copy link -->
            <tr><td>
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#555;text-transform:uppercase;">Or copy this link</p>
              <div style="background:#141414;border:1.5px solid #252525;border-radius:8px;padding:11px 14px;">
                <a href="${resetUrl}" style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#4ecdc4;word-break:break-all;text-decoration:none;line-height:1.6;">${resetUrl}</a>
              </div>
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#444;line-height:1.7;">
            If you didn't request this, you can safely ignore this email.<br>
            Your password won't change until you click the link above.
          </p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#333;">
            © ${new Date().getFullYear()} CodeSpace &nbsp;·&nbsp;
            <a href="https://codespace.yardansh.com" style="color:#3a3a3a;text-decoration:none;">codespace.yardansh.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }),
    });

    if (!res.ok) {
      console.error("Resend error:", await res.text());
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, maskedEmail });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}