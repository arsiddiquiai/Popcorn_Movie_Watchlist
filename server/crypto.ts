/**
 * AES-256-GCM encryption for BYOK (Bring Your Own Key) — encrypts a user's
 * personal Anthropic/OpenAI/Gemini API key before it is stored, and decrypts
 * it only at the moment a request needs it.
 *
 * Chosen over Supabase's pgsodium/Vault: pgsodium is deprecated for new
 * Supabase projects (and its availability can't be verified with only the
 * anon key this codebase has). Application-level encryption also keeps the
 * ciphertext meaningless to the database layer entirely — a full RLS bypass
 * or a raw table dump leaks nothing usable without BYOK_ENCRYPTION_KEY, which
 * has no database counterpart at all.
 *
 * GCM is authenticated encryption: a tampered or truncated ciphertext fails
 * to decrypt rather than silently returning garbage bytes as a "valid" key.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit, the size GCM is designed for
const KEY_LENGTH = 32 // 256-bit

function loadKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY
  if (!raw) throw new Error('BYOK_ENCRYPTION_KEY is not configured on the server.')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `BYOK_ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes (got ${key.length}). ` +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    )
  }
  return key
}

/** Stored format: iv:authTag:ciphertext, each base64, colon-joined — plain
 *  text so it's trivially inspectable in the SQL editor as "yes, this is
 *  ciphertext" without needing to know the encoding to tell. */
export function encryptSecret(plaintext: string): string {
  const key = loadKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/** Throws if BYOK_ENCRYPTION_KEY is wrong or the ciphertext was tampered
 *  with — GCM's authentication tag check fails closed, never returns a
 *  wrong-but-plausible plaintext. */
export function decryptSecret(stored: string): string {
  const key = loadKey()
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Malformed encrypted value (expected iv:authTag:ciphertext).')
  const [ivB64, authTagB64, ciphertextB64] = parts

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()])
  return plaintext.toString('utf8')
}
