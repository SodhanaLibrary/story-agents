import nodemailer from "nodemailer";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("Email");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
// Gmail App Passwords are 16 chars; env may have spaces (e.g. "abcd efgh ijkl mnop") – strip them
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s/g, "");
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || "noreply@localhost";
const APP_NAME = process.env.APP_NAME || "Epic Woven";

/**
 * Whether email sending is configured (SMTP credentials present).
 */
export function isEmailConfigured() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!isEmailConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Send verification email after signup.
 * @param {string} to - Recipient email
 * @param {string} verifyUrl - Full URL to verify (e.g. https://app.example.com/verify-email?token=...)
 * @returns {Promise<boolean>} - true if sent, false if skipped (no config) or failed
 */
export async function sendVerificationEmail(to, verifyUrl) {
  if (!isEmailConfigured()) {
    logger.warn("Email not configured (SMTP_HOST/SMTP_USER/SMTP_PASS). Verification email not sent.");
    return false;
  }
  const transport = getTransporter();
  if (!transport) return false;
  try {
    const from = SMTP_HOST && SMTP_HOST.includes("gmail.com") ? SMTP_USER : MAIL_FROM;
    await transport.sendMail({
      from: from || MAIL_FROM,
      to,
      subject: `Verify your ${APP_NAME} account`,
      text: `Welcome! Please verify your email by opening this link:\n\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
      html: `
        <p>Welcome! Please verify your email by clicking the link below.</p>
        <p><a href="${verifyUrl}" style="color: #e8b86d;">Verify my email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      `.trim(),
    });
    logger.info(`Verification email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error("Failed to send verification email:", err.message);
    if (err.response) logger.error("SMTP response:", err.response);
    if (err.code) logger.error("SMTP code:", err.code);
    return false;
  }
}

/**
 * Send password reset email.
 * @param {string} to - Recipient email
 * @param {string} resetUrl - Full URL to reset password
 * @returns {Promise<boolean>} - true if sent, false if skipped or failed
 */
export async function sendPasswordResetEmail(to, resetUrl) {
  if (!isEmailConfigured()) {
    logger.warn("Email not configured. Password reset email not sent.");
    return false;
  }
  const transport = getTransporter();
  if (!transport) return false;
  try {
    const from = SMTP_HOST && SMTP_HOST.includes("gmail.com") ? SMTP_USER : MAIL_FROM;
    await transport.sendMail({
      from: from || MAIL_FROM,
      to,
      subject: `Reset your ${APP_NAME} password`,
      text: `You requested a password reset. Open this link to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      html: `
        <p>You requested a password reset. Click the link below to set a new password.</p>
        <p><a href="${resetUrl}" style="color: #e8b86d;">Reset password</a></p>
        <p>Or copy this link: ${resetUrl}</p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      `.trim(),
    });
    logger.info(`Password reset email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error("Failed to send password reset email:", err.message);
    if (err.response) logger.error("SMTP response:", err.response);
    if (err.code) logger.error("SMTP code:", err.code);
    return false;
  }
}
