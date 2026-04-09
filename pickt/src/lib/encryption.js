/**
 * AES-256-GCM encryption for candidate PII.
 *
 * All PII fields in candidate_pii are encrypted at rest using this module.
 * The encryption key is stored in process.env.CANDIDATE_PII_KEY (64 hex chars = 32 bytes).
 *
 * Format: hex(iv[12] + authTag[16] + ciphertext[...])
 *
 * KEY ROTATION PROCEDURE:
 * 1. Set CANDIDATE_PII_KEY_V2 in env with the new 32-byte key (64 hex chars)
 * 2. Run: node scripts/rotate-pii-keys.js
 *    - Reads all rows with encryption_key_version < TARGET_VERSION
 *    - Decrypts with old key, re-encrypts with new key
 *    - Updates encryption_key_version
 * 3. Once all rows are migrated, swap CANDIDATE_PII_KEY to the new key
 * 4. Remove CANDIDATE_PII_KEY_V2
 *
 * NEVER log decrypted PII values. NEVER cache them outside of request scope.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * @param {number} version - Key version (1 = current, 2 = rotation target)
 * @returns {Buffer}
 */
function getKey(version = 1) {
  const envVar =
    version === 2 ? "CANDIDATE_PII_KEY_V2" : "CANDIDATE_PII_KEY";
  const hex = process.env[envVar];

  if (!hex) {
    throw new Error(
      `Missing encryption key: ${envVar}. ` +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  if (hex.length !== 64) {
    throw new Error(
      `${envVar} must be exactly 64 hex characters (32 bytes). Got ${hex.length}.`
    );
  }

  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * @param {string} plaintext
 * @returns {string} hex-encoded iv + authTag + ciphertext
 */
export function encrypt(plaintext) {
  if (plaintext == null) return null;

  const key = getKey(1);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString("hex");
}

/**
 * Decrypt a hex-encoded ciphertext.
 * @param {string} hex - Output of encrypt()
 * @param {number} keyVersion - Which key version to use for decryption
 * @returns {string} plaintext
 */
export function decrypt(hex, keyVersion = 1) {
  if (hex == null) return null;

  const key = getKey(keyVersion);
  const data = Buffer.from(hex, "hex");

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypt all PII fields in a candidate object.
 * @param {{ full_name: string, email: string, phone?: string, linkedin_url?: string, full_cv_text: string, cv_parsed_json?: object }} pii
 * @returns {object} Same shape with encrypted values
 */
export function encryptPii(pii) {
  return {
    full_name: encrypt(pii.full_name),
    email: encrypt(pii.email),
    phone: pii.phone ? encrypt(pii.phone) : null,
    linkedin_url: pii.linkedin_url ? encrypt(pii.linkedin_url) : null,
    full_cv_text: encrypt(pii.full_cv_text),
    cv_parsed_json: pii.cv_parsed_json
      ? encrypt(JSON.stringify(pii.cv_parsed_json))
      : null,
  };
}

/**
 * Decrypt all PII fields in a candidate row.
 * @param {object} row - Row from candidate_pii table
 * @returns {object} Decrypted PII
 */
export function decryptPii(row) {
  const v = row.encryption_key_version || 1;

  // Version 0 = unencrypted (migration pending)
  if (v === 0) {
    return {
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      linkedin_url: row.linkedin_url,
      full_cv_text: row.full_cv_text,
      cv_parsed_json: row.cv_parsed_json,
    };
  }

  return {
    full_name: decrypt(row.full_name, v),
    email: decrypt(row.email, v),
    phone: row.phone ? decrypt(row.phone, v) : null,
    linkedin_url: row.linkedin_url ? decrypt(row.linkedin_url, v) : null,
    full_cv_text: decrypt(row.full_cv_text, v),
    cv_parsed_json: row.cv_parsed_json
      ? JSON.parse(decrypt(row.cv_parsed_json, v))
      : null,
  };
}
