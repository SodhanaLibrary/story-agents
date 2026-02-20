import crypto from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

/**
 * Hash a password using scrypt
 * @param {string} password - Plain text password
 * @returns {string} - Salt + hash as hex (salt is first 32 hex chars)
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
  return salt.toString("hex") + hash.toString("hex");
}

/**
 * Verify a password against a stored hash
 * @param {string} password - Plain text password
 * @param {string} stored - Stored value (salt + hash in hex)
 * @returns {boolean}
 */
export function verifyPassword(password, stored) {
  if (!stored || stored.length < SALT_LEN * 2 + KEY_LEN * 2) return false;
  const salt = Buffer.from(stored.slice(0, SALT_LEN * 2), "hex");
  const hash = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
  const expected = stored.slice(SALT_LEN * 2);
  return hash.toString("hex") === expected;
}
