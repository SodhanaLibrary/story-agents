import config from "../../src/config.js";
import {
  getUserById,
  userBelongsToAnyOrg,
  updateUserPlan,
} from "../../src/services/storyRepository.js";
import {
  getBillingConfig,
  getCurrentCycleBounds,
  getUsageForBilling,
  getIncludedUsageSum,
  getTotalTokensUsedByUser,
} from "../../src/services/promptLogger.js";
import {
  createOrder as razorpayCreateOrder,
  verifyPaymentSignature,
  markPaymentCaptured,
} from "../../src/services/razorpayService.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("BillingRoutes");

const FREE_TOKEN_LIMIT = config.plans?.freeTokenLimit ?? 1_000_000;

/**
 * Register billing and Razorpay routes.
 * @param {import('express').Application} app
 */
export function registerBillingRoutes(app) {
  app.get("/api/v1/plans/status", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = await getUserById(userId);
      const plan = user?.plan || "free";
      const inTeam = await userBelongsToAnyOrg(userId);
      const used =
        plan === "free" && !inTeam
          ? await getTotalTokensUsedByUser(userId)
          : 0;
      const limit = FREE_TOKEN_LIMIT;
      res.json({
        plan,
        inTeam: !!inTeam,
        freeTokensUsed: used,
        freeTokensLimit: limit,
        upgradeRequired:
          plan === "free" && !inTeam && used >= limit,
        proPriceCents: config.plans?.proPriceCents ?? 1900,
        proCurrency: config.plans?.proCurrency ?? "USD",
      });
    } catch (error) {
      logger.error("Error fetching plans status:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/v1/razorpay/create-order", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = await getUserById(userId);
      if (user?.plan === "pro") {
        return res.status(400).json({ error: "Already on Pro plan" });
      }
      const order = await razorpayCreateOrder(userId);
      res.json(order);
    } catch (error) {
      if (error.message?.includes("Razorpay keys not configured")) {
        return res.status(503).json({ error: "Payments not configured" });
      }
      logger.error("Error creating Razorpay order:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/v1/razorpay/verify", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;
      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({ error: "Missing payment details" });
      }
      if (
        !verifyPaymentSignature(
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        )
      ) {
        return res.status(400).json({ error: "Invalid payment signature" });
      }
      const payment = await markPaymentCaptured(
        razorpay_order_id,
        razorpay_payment_id,
      );
      if (!payment || payment.userId !== userId) {
        return res
          .status(400)
          .json({ error: "Order not found or already used" });
      }
      await updateUserPlan(userId, "pro");
      res.json({ success: true, plan: "pro" });
    } catch (error) {
      logger.error("Error verifying Razorpay payment:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/billing/cycle", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const billingConfig = await getBillingConfig();
      const { start, end, resetDate } = getCurrentCycleBounds(
        billingConfig.cycleDayOfMonth,
      );
      const usedIncluded = await getIncludedUsageSum(userId, start, end);

      res.json({
        includedLimitUsd: billingConfig.includedLimitUsd,
        usedIncludedUsd: Math.round(usedIncluded * 100) / 100,
        resetDate,
        cycleStart: start,
        cycleEnd: end,
        onDemandUsd: 0,
      });
    } catch (error) {
      logger.error("Error fetching billing cycle:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/billing/usage", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      let { startDate, endDate, period } = req.query;
      const billingConfig = await getBillingConfig();

      if (period === "1d" || period === "7d" || period === "30d") {
        const end = new Date();
        const start = new Date();
        if (period === "1d") start.setDate(start.getDate() - 1);
        else if (period === "7d") start.setDate(start.getDate() - 7);
        else start.setDate(start.getDate() - 30);
        startDate = start.toISOString().slice(0, 10);
        endDate = end.toISOString().slice(0, 10);
      }

      if (!startDate || !endDate) {
        const { start, end } = getCurrentCycleBounds(
          billingConfig.cycleDayOfMonth,
        );
        startDate = startDate || start;
        endDate = endDate || end;
      }

      const filterUserId = req.query.team !== "true" ? userId : null;
      const entries = await getUsageForBilling({
        startDate,
        endDate,
        userId: filterUserId,
      });

      const teamSpend = entries.reduce((sum, e) => sum + (e.cost || 0), 0);

      res.json({
        entries,
        teamSpend: Math.round(teamSpend * 100) / 100,
        startDate,
        endDate,
      });
    } catch (error) {
      logger.error("Error fetching billing usage:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/billing/usage/export", async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      let { startDate, endDate, period } = req.query;
      const billingConfig = await getBillingConfig();

      if (period === "1d" || period === "7d" || period === "30d") {
        const end = new Date();
        const start = new Date();
        if (period === "1d") start.setDate(start.getDate() - 1);
        else if (period === "7d") start.setDate(start.getDate() - 7);
        else start.setDate(start.getDate() - 30);
        startDate = start.toISOString().slice(0, 10);
        endDate = end.toISOString().slice(0, 10);
      }
      if (!startDate || !endDate) {
        const { start, end } = getCurrentCycleBounds(
          billingConfig.cycleDayOfMonth,
        );
        startDate = startDate || start;
        endDate = endDate || end;
      }

      const entries = await getUsageForBilling({
        startDate,
        endDate,
        userId,
      });
      const header = "Date,User,Type,Model,Tokens,Cost\n";
      const rows = entries.map(
        (e) =>
          `${e.date},${e.userEmail},${e.type},${e.model},${e.tokens},${e.cost?.toFixed(2) ?? "0.00"}`,
      );
      const csv = header + rows.join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=usage-${startDate}-to-${endDate}.csv`,
      );
      res.send(csv);
    } catch (error) {
      logger.error("Error exporting usage CSV:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
