import {
  findOrCreateUser,
  getUserById,
  getUserByEmail,
  createUserWithEmail,
  verifyEmailByToken,
  setUserPassword,
  checkUserPassword,
  createPasswordResetToken,
  getUserByPasswordResetToken,
} from "../../src/services/storyRepository.js";
import { setContext as setPromptContext } from "../../src/services/promptLogger.js";
import { createLogger } from "../../src/utils/logger.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.js";

const logger = createLogger("AuthRoutes");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Register auth routes.
 * @param {import('express').Application} app
 */
export function registerAuthRoutes(app) {
  app.get("/api/v1/auth/verify", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res
          .status(401)
          .json({ valid: false, error: "No user ID provided" });
      }

      const user = await getUserById(userId);
      if (!user) {
        return res.status(401).json({ valid: false, error: "User not found" });
      }

      const safeUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        plan: user.plan || "free",
        hasPassword: !!user.password_hash,
      };
      logger.info(`Session verified for user: ${user.email} (ID: ${user.id})`);
      res.json({ valid: true, user: safeUser });
    } catch (error) {
      logger.error("Error verifying session:", error.message);
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  app.post("/api/v1/auth/google", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ error: "Credential is required" });
      }

      const base64Url = credential.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(Buffer.from(base64, "base64").toString());

      const user = await findOrCreateUser({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });

      setPromptContext({ userId: user.id });
      logger.info(`User logged in: ${user.email} (ID: ${user.id})`);

      res.json({ user, token: credential });
    } catch (error) {
      logger.error("Error authenticating:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- Email signup -----
  app.post("/api/v1/auth/signup", async (req, res) => {
    try {
      const { email, name, password } = req.body || {};
      if (!email || typeof email !== "string" || !password || typeof password !== "string") {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const result = await createUserWithEmail({
        email: email.trim(),
        name: (name || "").trim() || undefined,
        password,
      });
      if (result.error === "EMAIL_EXISTS") {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      const { user, verificationToken } = result;
      const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(verificationToken)}`;
      logger.info(`Signup: ${user.email} – verification link: ${verifyUrl}`);
      sendVerificationEmail(user.email, verifyUrl).catch((err) =>
        logger.error("Verification email failed:", err.message)
      );
      res.status(201).json({
        message: "Account created. Please check your email to verify your account.",
        userId: user.id,
        verifyUrl: process.env.NODE_ENV === "development" ? verifyUrl : undefined,
      });
    } catch (error) {
      logger.error("Signup error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- Verify email (GET for link click) -----
  app.get("/api/v1/auth/verify-email", async (req, res) => {
    try {
      const token = req.query.token;
      if (!token) {
        return res.status(400).json({ error: "Verification token is required" });
      }
      const result = await verifyEmailByToken(token);
      if (result.user) {
        logger.info(`Email verified: ${result.user.email}`);
        return res.json({
          verified: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
          },
        });
      }
      if (result.error === "expired") {
        return res.status(400).json({
          error: "Verification link has expired. Please sign up again or request a new verification email.",
        });
      }
      return res.status(400).json({
        error: "Invalid verification link. Please use the link from your email or sign up again.",
      });
    } catch (error) {
      logger.error("Verify email error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- Login with email/password -----
  app.post("/api/v1/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (!user.password_hash) {
        return res.status(401).json({ error: "This account uses Google sign-in. Please sign in with Google." });
      }
      if (!checkUserPassword(user, password)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      setPromptContext({ userId: user.id });
      logger.info(`User logged in: ${user.email} (ID: ${user.id})`);
      const safeUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role || "user",
        plan: user.plan || "free",
        hasPassword: true,
        emailVerified: !!user.email_verified,
      };
      res.json({ user: safeUser });
    } catch (error) {
      logger.error("Login error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- Change password (authenticated) -----
  app.post("/api/v1/auth/change-password", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }
      const user = await getUserById(userId);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!user.password_hash) {
        return res.status(400).json({ error: "This account uses Google sign-in and has no password to change." });
      }
      if (!checkUserPassword(user, currentPassword)) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      await setUserPassword(userId, newPassword);
      logger.info(`Password changed for user ${userId}`);
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      logger.error("Change password error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- Forgot password -----
  app.post("/api/v1/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }
      const result = await createPasswordResetToken(email);
      if (result.error === "USER_NOT_FOUND") {
        return res.json({ message: "If an account exists with this email, you will receive a reset link." });
      }
      const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(result.token)}`;
      logger.info(`Forgot password: ${email} – reset link: ${resetUrl}`);
      sendPasswordResetEmail(email, resetUrl).catch((err) =>
        logger.error("Password reset email failed:", err.message)
      );
      res.json({
        message: "If an account exists with this email, you will receive a password reset link.",
        resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined,
      });
    } catch (error) {
      logger.error("Forgot password error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ----- Reset password (with token from email) -----
  app.post("/api/v1/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const user = await getUserByPasswordResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }
      await setUserPassword(user.id, newPassword);
      logger.info(`Password reset for user ${user.id}`);
      res.json({ message: "Password has been reset. You can now sign in." });
    } catch (error) {
      logger.error("Reset password error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
