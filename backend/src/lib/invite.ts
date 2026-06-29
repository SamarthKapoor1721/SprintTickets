import nodemailer from "nodemailer";

import { env } from "../env";
import { normalizeBaseUrl } from "./public-url";

type InviteEmailResult = {
  sent: boolean;
  error: string | null;
};

type InviteEmailArgs = {
  to: string;
  fullName?: string | null;
  onboardingUrl: string;
};

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransportConfigError() {
  if (env.SMTP_URL) {
    return null;
  }

  const missing: string[] = [];
  if (!env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!env.SMTP_USER) missing.push("SMTP_USER");
  if (!env.SMTP_PASS) missing.push("SMTP_PASS");

  if (missing.length === 0) {
    return null;
  }

  return `Email delivery is not configured. Missing ${missing.join(", ")} (or set SMTP_URL).`;
}

function getTransport() {
  if (transport) {
    return transport;
  }

  if (env.SMTP_URL) {
    transport = nodemailer.createTransport(env.SMTP_URL);
    return transport;
  }

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    return transport;
  }

  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOnboardingUrl(token: string, appUrl = env.APP_URL) {
  const url = new URL("/auth/onboard", normalizeBaseUrl(appUrl));
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendOnboardingInvite({
  to,
  fullName,
  onboardingUrl,
}: InviteEmailArgs): Promise<InviteEmailResult> {
  const isResend = env.SMTP_HOST === "smtp.resend.com" && !!env.SMTP_PASS;
  const mailer = getTransport();
  if (!isResend && !mailer) {
    return {
      sent: false,
      error: getTransportConfigError() ?? "Email delivery is not configured",
    };
  }

  const name = fullName?.trim();
  const greeting = name ? `Hello ${escapeHtml(name)}` : "Hello";
  const subject = "You are invited to Sprint Tickets";
  const text = [
    `${greeting},`,
    "",
    "An administrator created an account for you in Sprint Tickets.",
    "Use this link to activate your account and set your password:",
    onboardingUrl,
    "",
    "If you did not expect this email, you can ignore it.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>${greeting},</p>
      <p>An administrator created an account for you in Sprint Tickets.</p>
      <p>
        <a href="${onboardingUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">
          Activate your account
        </a>
      </p>
      <p style="word-break: break-all;">If the button does not work, use this link:<br />${onboardingUrl}</p>
      <p>If you did not expect this email, you can ignore it.</p>
    </div>
  `;

  try {
    if (isResend && env.SMTP_PASS) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SMTP_PASS}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to,
          subject,
          text,
          html,
        }),
      });
      if (!res.ok) throw new Error(`Resend API error: ${await res.text()}`);
      return { sent: true, error: null };
    }

    if (!mailer) throw new Error("Email delivery is not configured");

    await mailer.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    return { sent: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invite email";
    return { sent: false, error: message };
  }
}
