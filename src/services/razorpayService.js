/**
 * Razorpay integration: create order for Pro plan ($19), verify payment.
 * Payouts to your bank account are configured in Razorpay Dashboard (Settings → Bank Account).
 */
import crypto from "crypto";
import Razorpay from "razorpay";
import config from "../config.js";
import { query } from "./database.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("Razorpay");

function getInstance() {
  const { keyId, keySecret } = config.razorpay;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys not configured (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Create a Razorpay order for Pro plan
 * @param {number} userId
 * @returns {Promise<{ orderId: string, amount: number, currency: string, keyId: string }>}
 */
export async function createOrder(userId) {
  const amount = config.plans.proPriceCents; // 1900 = $19 (cents)
  const currency = config.plans.proCurrency; // USD or INR
  const instance = getInstance();
  const order = await instance.orders.create({
    amount, // Razorpay: smallest unit (USD cents e.g. 1900 = $19, INR paise)
    currency,
    receipt: `user_${userId}_${Date.now()}`,
    notes: { user_id: String(userId) },
  });

  await query(
    "INSERT INTO payments (user_id, razorpay_order_id, amount, currency, status) VALUES (?, ?, ?, ?, 'created')",
    [userId, order.id, amount, currency]
  );

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: config.razorpay.keyId,
  };
}

/**
 * Verify Razorpay signature and return true if valid
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

/**
 * Mark payment as captured and return payment row (for upgrading user)
 * @param {string} orderId
 * @param {string} paymentId
 * @returns {Promise<{ userId: number } | null>}
 */
export async function markPaymentCaptured(orderId, paymentId) {
  const rows = await query(
    "SELECT id, user_id FROM payments WHERE razorpay_order_id = ? AND status = 'created' LIMIT 1",
    [orderId]
  );
  if (!rows.length) return null;
  await query(
    "UPDATE payments SET razorpay_payment_id = ?, status = 'captured' WHERE id = ?",
    [paymentId, rows[0].id]
  );
  return { userId: rows[0].user_id };
}
