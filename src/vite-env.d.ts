/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_TMDB_API_KEY: string
  /** Base URL used for auth email redirects (e.g. password reset). Falls back to window.location.origin if unset. */
  readonly VITE_APP_URL?: string
}
