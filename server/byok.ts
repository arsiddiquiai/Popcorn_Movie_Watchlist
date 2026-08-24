import { decryptSecret } from './crypto.ts'
import type { ProviderName } from './providers/types.ts'
import { getServiceClient } from './serviceClient.ts'

export interface UserProviderPreference {
  provider: ProviderName
  apiKey: string
  modelPref: string | null
}

/**
 * Looks up and decrypts a user's saved BYOK key, if any.
 *
 * Returns null on ANY problem — no row, a decryption failure (wrong/rotated
 * BYOK_ENCRYPTION_KEY, corrupted ciphertext), or SUPABASE_SERVICE_ROLE_KEY
 * missing entirely. Every one of those should behave identically to "the
 * user has no personal key": fall back to the shared key silently, never
 * fail the request over infrastructure the user has no way to fix from
 * their side. A key that fails at CALL time (bad credentials, provider
 * outage) is a different case, handled by the caller's try/fallback — this
 * function only handles "couldn't even get to try it."
 *
 * At most one row per user is expected — enforced by api/user-api-key.ts's
 * save flow deleting any existing row(s) before inserting — but this reads
 * defensively (most recent row, not .single()) rather than trusting that
 * invariant never breaks.
 */
export async function loadUserProviderPreference(userId: string): Promise<UserProviderPreference | null> {
  let service
  try {
    service = getServiceClient()
  } catch (err) {
    console.error('BYOK lookup skipped:', err instanceof Error ? err.message : err)
    return null
  }

  const { data, error } = await service
    .from('user_api_keys')
    .select('provider, encrypted_key, model_pref')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  const row = data[0]

  try {
    return {
      provider: row.provider as ProviderName,
      apiKey: decryptSecret(row.encrypted_key),
      modelPref: row.model_pref,
    }
  } catch (err) {
    console.error('BYOK decrypt failed, falling back to shared key:', err instanceof Error ? err.message : err)
    return null
  }
}
