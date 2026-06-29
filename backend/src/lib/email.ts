import nodemailer from "nodemailer";
import { env } from "../env";
import { normalizeBaseUrl } from "./public-url";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    })
  : null;

/**
 * Helper to dispatch emails. If SMTP is not configured, it logs the email to console instead.
 */
async function dispatchEmail(to: string | string[], subject: string, text: string, html: string) {
  const isResend = env.SMTP_HOST === "smtp.resend.com" && !!env.SMTP_PASS;

  if (!isResend && !transporter) {
    // eslint-disable-next-line no-console
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}\n\n${text}`);
    return;
  }

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
          to: Array.isArray(to) ? to : [to],
          subject,
          text,
          html,
        }),
      });
      if (!res.ok) {
        console.error("Resend API failed:", await res.text());
      }
      return;
    }

    if (!transporter) return;

    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailLayout(title: string, innerHtml: string, ctaUrl?: string, ctaText?: string) {
  const ctaButton = ctaUrl && ctaText ? `
    <div style="text-align: center; margin-top: 32px; margin-bottom: 32px;">
      <a href="${ctaUrl}" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
        ${ctaText}
      </a>
    </div>
  ` : '';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #334155; line-height: 1.6;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #2563eb; padding: 32px 24px; text-align: center; background-image: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Sprint Tickets</h1>
        </div>
        <div style="padding: 40px 32px; font-size: 16px;">
          <h2 style="margin-top: 0; margin-bottom: 24px; color: #0f172a; font-size: 20px; font-weight: 600;">${title}</h2>
          <div style="color: #475569;">
            ${innerHtml}
          </div>
          ${ctaButton}
        </div>
        <div style="background-color: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 13px; color: #64748b;">
          <p style="margin: 0;">This is an automated notification from Sprint Tickets.</p>
        </div>
      </div>
    </div>
  `;
}

function getAppBaseUrl(appUrl?: string) {
  return normalizeBaseUrl(appUrl ?? env.APP_URL);
}

export async function sendReportNotificationEmail(
  recipientEmails: string[],
  submitterName: string,
  projectName?: string | null,
  reportDate?: Date,
  appUrl?: string,
) {
  if (recipientEmails.length === 0) return;

  const dateStr = reportDate ? reportDate.toLocaleDateString() : new Date().toLocaleDateString();
  const contextStr = projectName ? ` for project "${projectName}"` : "";
  const subject = `New Daily Report Submitted: ${submitterName}`;
  const text = `${submitterName} has submitted a new daily progress report${contextStr} for ${dateStr}. Please log in to the dashboard to review it.`;
  const innerHtml = `<p><strong>${escapeHtml(submitterName)}</strong> has submitted a new daily progress report${escapeHtml(contextStr)} for <strong>${dateStr}</strong>.</p>`;
  const appBaseUrl = getAppBaseUrl(appUrl);
  const html = emailLayout("New Daily Report", innerHtml, appBaseUrl, "Review Report");

  await dispatchEmail(recipientEmails, subject, text, html);
}

export async function sendDirectMessageEmail(
  recipientEmail: string,
  senderName: string,
  messageContent: string,
  appUrl?: string,
) {
  const subject = `New direct message from ${senderName}`;
  const text = `You have a new message from ${senderName}:\n\n"${messageContent}"\n\nLog in to the dashboard to reply.`;
  const innerHtml = `<p>You have a new message from <strong>${escapeHtml(senderName)}</strong>:</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; font-style: italic;">
      ${escapeHtml(messageContent)}
    </div>`;
  const html = emailLayout("New Message", innerHtml, getAppBaseUrl(appUrl), "Reply in Dashboard");

  await dispatchEmail(recipientEmail, subject, text, html);
}

export async function sendTaskCommentEmail(
  recipientEmails: string[],
  taskTitle: string,
  commenterName: string,
  commentContent: string,
  appUrl?: string,
) {
  if (recipientEmails.length === 0) return;

  const subject = `New comment on task: ${taskTitle}`;
  const text = `${commenterName} commented on task "${taskTitle}":\n\n"${commentContent}"\n\nLog in to the dashboard to view and reply.`;
  const innerHtml = `<p><strong>${escapeHtml(commenterName)}</strong> commented on task "<strong>${escapeHtml(taskTitle)}</strong>":</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; font-style: italic;">
      ${escapeHtml(commentContent)}
    </div>`;
  const html = emailLayout("Task Comment", innerHtml, getAppBaseUrl(appUrl), "View Task");

  await dispatchEmail(recipientEmails, subject, text, html);
}

export async function sendReviewCommentEmail(
  recipientEmails: string[],
  reviewTitle: string,
  commenterName: string,
  commentContent: string,
  appUrl?: string,
) {
  if (recipientEmails.length === 0) return;

  const subject = `New comment on review request: ${reviewTitle}`;
  const text = `${commenterName} commented on review request "${reviewTitle}":\n\n"${commentContent}"\n\nLog in to the dashboard to view and reply.`;
  const innerHtml = `<p><strong>${escapeHtml(commenterName)}</strong> commented on review request "<strong>${escapeHtml(reviewTitle)}</strong>":</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; font-style: italic;">
      ${escapeHtml(commentContent)}
    </div>`;
  const appBaseUrl = getAppBaseUrl(appUrl);
  const html = emailLayout("Review Update", innerHtml, `${appBaseUrl}/dashboard/reviews`, "View Review");

  await dispatchEmail(recipientEmails, subject, text, html);
}

export async function sendReviewCreatedEmail(
  recipientEmails: string[],
  reviewTitle: string,
  submitterName: string,
  appUrl?: string,
) {
  if (recipientEmails.length === 0) return;

  const subject = `New review request: ${reviewTitle}`;
  const text = `${submitterName} has requested your review on "${reviewTitle}".\n\nLog in to the dashboard to view and approve it.`;
  const innerHtml = `<p><strong>${escapeHtml(submitterName)}</strong> has requested your review on "<strong>${escapeHtml(reviewTitle)}</strong>".</p>`;
  const html = emailLayout(
    "Review Requested",
    innerHtml,
    `${getAppBaseUrl(appUrl)}/dashboard/reviews/pending`,
    "Review Now",
  );

  await dispatchEmail(recipientEmails, subject, text, html);
}

export async function sendPasswordResetEmail(recipientEmail: string, resetUrl: string, fullName?: string | null) {
  const name = fullName?.trim();
  const greeting = name ? `Hello ${escapeHtml(name)}` : "Hello";
  const subject = "Reset your Sprint Tickets password";
  const text = [
    `${greeting},`,
    "",
    "We received a request to reset your Sprint Tickets password.",
    "Use the link below to choose a new password:",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const innerHtml = `
    <p>We received a request to reset your Sprint Tickets password.</p>
    <p style="font-size: 14px; color: #64748b; margin-top: 24px; word-break: break-all;">If the button does not work, use this link:<br />${resetUrl}</p>
    <p style="font-size: 14px; color: #64748b;">If you did not request this, you can ignore this email.</p>
  `;
  const html = emailLayout(greeting + ",", innerHtml, resetUrl, "Reset Password");

  await dispatchEmail(recipientEmail, subject, text, html);
}
