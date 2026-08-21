import type { Session, User } from '@supabase/supabase-js'

export interface SignUpResult {
  error: string | null
  needsEmailConfirmation: boolean
}

export interface SignInResult {
  error: string | null
}

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, displayName?: string) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}
