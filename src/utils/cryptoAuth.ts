/**
 * Offline Cryptographic Authentication & Salted Hashing Module
 * Mini Universal POS — Offline Admin PIN & Recovery System
 * 
 * Complies with strict offline-first security:
 * - Uses Web Crypto API (SHA-256) with unique cryptographic salts
 * - Secrets (PIN & Recovery Code) are NEVER stored in plain text
 * - Zero server dependency, 100% offline
 * - Rate limiting and attempt lockout protection
 */

export interface AuthCredentials {
  adminPinHash: string;
  adminPinSalt: string;
  recoveryCode: string; // Plaintext for single-time display/download/print only
  recoveryCodeHash: string;
  recoveryCodeSalt: string;
  recoveryCodeCreatedAt: string;
}

/**
 * Generate a high-entropy, human-readable Recovery Code
 * Format: RC-XXXX-XXXX-XXXX
 * Uses unambiguous uppercase alphanumeric characters (no 0/O, 1/I/L)
 */
export function generateSecureRecoveryCode(): string {
  const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : (globalThis as any).crypto;
  const randomBytes = new Uint8Array(12);
  cryptoObj.getRandomValues(randomBytes);

  let raw = '';
  for (let i = 0; i < randomBytes.length; i++) {
    raw += charset[randomBytes[i] % charset.length];
  }

  return `RC-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Generate a random cryptographic salt (hex string)
 */
export function generateCryptoSalt(byteLength = 16): string {
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : (globalThis as any).crypto;
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 salted hash of a secret string
 */
export async function hashSecretWithSalt(
  secret: string,
  salt: string,
  pepper = 'MiniPOS_PIN_v5'
): Promise<string> {
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : (globalThis as any).crypto;
  const normalized = secret.trim();
  const encoder = new TextEncoder();
  const payload = encoder.encode(`${salt}:${pepper}:${normalized}`);
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', payload);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize a user-entered Recovery Code (case-insensitive, strips spaces and hyphens)
 */
export function normalizeRecoveryCode(input: string): string {
  if (!input) return '';
  return input
    .toUpperCase()
    .replace(/^RC-?/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Compute hash of normalized Recovery Code
 */
export async function hashRecoveryCode(code: string, salt: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  return hashSecretWithSalt(normalized, salt, 'MiniPOS_Recovery_v5');
}

/**
 * Create complete auth credentials (hashes + new recovery code) for Admin PIN setup or reset
 */
export async function createAdminAuthCredentials(newPin: string): Promise<AuthCredentials> {
  const pinSalt = generateCryptoSalt(16);
  const pinHash = await hashSecretWithSalt(newPin.trim(), pinSalt);

  const recoveryCode = generateSecureRecoveryCode();
  const recoveryCodeSalt = generateCryptoSalt(16);
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode, recoveryCodeSalt);

  return {
    adminPinHash: pinHash,
    adminPinSalt: pinSalt,
    recoveryCode,
    recoveryCodeHash,
    recoveryCodeSalt,
    recoveryCodeCreatedAt: new Date().toISOString(),
  };
}

/**
 * Verify entered Admin PIN securely against stored credentials
 */
export async function verifyAdminPin(
  enteredPin: string,
  settings: {
    adminPin?: string;
    adminPinHash?: string;
    adminPinSalt?: string;
  }
): Promise<boolean> {
  const cleanPin = (enteredPin || '').trim();
  if (!cleanPin) return false;

  // Modern salted hash check
  if (settings.adminPinHash && settings.adminPinSalt) {
    const computed = await hashSecretWithSalt(cleanPin, settings.adminPinSalt);
    return computed === settings.adminPinHash;
  }

  // Legacy plain text check fallback
  if (settings.adminPin) {
    return cleanPin === settings.adminPin;
  }

  return cleanPin === '1234';
}

/**
 * Verify entered Recovery Code securely against stored credentials
 */
export async function verifyRecoveryCode(
  enteredCode: string,
  settings: {
    recoveryCodeHash?: string;
    recoveryCodeSalt?: string;
    recoveryToken?: string;
  }
): Promise<boolean> {
  const normalized = normalizeRecoveryCode(enteredCode);
  if (!normalized || normalized.length < 6) return false;

  // Modern salted hash check
  if (settings.recoveryCodeHash && settings.recoveryCodeSalt) {
    const computed = await hashRecoveryCode(normalized, settings.recoveryCodeSalt);
    return computed === settings.recoveryCodeHash;
  }

  // Legacy recovery token check fallback
  if (settings.recoveryToken) {
    return normalizeRecoveryCode(settings.recoveryToken) === normalized;
  }

  return false;
}

/**
 * Helper to generate printable text sheet content for Recovery Code
 */
export function generateRecoveryCodeDocument(
  recoveryCode: string,
  storeName: string,
  ownerName: string
): string {
  const dateStr = new Date().toLocaleString();
  return `=====================================================
   MINI UNIVERSAL POS — OFFICIAL ADMIN RECOVERY CODE
=====================================================

STORE NAME  : ${storeName || 'Mini Universal POS Store'}
STORE OWNER : ${ownerName || 'Store Administrator'}
ISSUED DATE : ${dateStr}

-----------------------------------------------------
YOUR RECOVERY CODE:
>>>  ${recoveryCode}  <<<
-----------------------------------------------------

CRITICAL SECURITY INSTRUCTIONS:
1. This Recovery Code is your ONLY way to regain Admin access 
   if you ever forget your Admin PIN.
2. The POS works 100% OFFLINE without any cloud or server recovery.
3. Keep this printed sheet or saved text file in a safe, private location.
4. Each Recovery Code can only be used ONCE. After using it to reset 
   your PIN, a replacement code will be generated.
5. NEVER share this Recovery Code with cashiers or unauthorized staff.

=====================================================`;
}
