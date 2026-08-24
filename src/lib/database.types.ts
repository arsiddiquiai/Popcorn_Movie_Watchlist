// Hand-written to match supabase/migrations exactly. If the Supabase CLI
// is ever wired up, `supabase gen types typescript` output can replace
// this file directly — the shape (Database.public.Tables.<table>.Row /
// Insert / Update) matches what it generates.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type WatchlistStatus = 'want' | 'watched' | 'dropped'
export type AiSessionMode = 'pick' | 'bridge' | 'taste' | 'assistant'
export type AiProvider = 'anthropic' | 'openai' | 'gemini'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          theme_pref: string
          reduced_motion: boolean
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          theme_pref?: string
          reduced_motion?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          theme_pref?: string
          reduced_motion?: boolean
          created_at?: string
        }
        Relationships: []
      }
      movies_cache: {
        Row: {
          tmdb_id: number
          title: string
          poster_path: string | null
          backdrop_path: string | null
          release_year: number | null
          runtime_minutes: number | null
          genres: string[] | null
          overview: string | null
          tmdb_rating: number | null
          original_language: string | null
          trailer_key: string | null
          credits: Json | null
          cached_at: string | null
        }
        Insert: {
          tmdb_id: number
          title: string
          poster_path?: string | null
          backdrop_path?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          genres?: string[] | null
          overview?: string | null
          tmdb_rating?: number | null
          original_language?: string | null
          trailer_key?: string | null
          credits?: Json | null
          cached_at?: string | null
        }
        Update: {
          tmdb_id?: number
          title?: string
          poster_path?: string | null
          backdrop_path?: string | null
          release_year?: number | null
          runtime_minutes?: number | null
          genres?: string[] | null
          overview?: string | null
          tmdb_rating?: number | null
          original_language?: string | null
          trailer_key?: string | null
          credits?: Json | null
          cached_at?: string | null
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number
          status: WatchlistStatus
          added_at: string
          watched_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id: number
          status?: WatchlistStatus
          added_at?: string
          watched_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number
          status?: WatchlistStatus
          added_at?: string
          watched_at?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number
          score: number
          reason_tags: string[] | null
          review_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id: number
          score: number
          reason_tags?: string[] | null
          review_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number
          score?: number
          reason_tags?: string[] | null
          review_text?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ai_sessions: {
        Row: {
          id: string
          user_id: string
          mode: AiSessionMode
          mood_text: string | null
          energy_level: number | null
          minutes_available: number | null
          company: string | null
          tier: number | null
          recommended_tmdb_id: number | null
          reason_text: string | null
          accepted: boolean | null
          /** mode=bridge only: the film an equivalent was asked for. */
          source_tmdb_id: number | null
          /** mode=bridge only: requested industry/language, as typed. */
          target: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          mode: AiSessionMode
          mood_text?: string | null
          energy_level?: number | null
          minutes_available?: number | null
          company?: string | null
          tier?: number | null
          recommended_tmdb_id?: number | null
          reason_text?: string | null
          accepted?: boolean | null
          source_tmdb_id?: number | null
          target?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          mode?: AiSessionMode
          mood_text?: string | null
          energy_level?: number | null
          minutes_available?: number | null
          company?: string | null
          tier?: number | null
          recommended_tmdb_id?: number | null
          reason_text?: string | null
          accepted?: boolean | null
          source_tmdb_id?: number | null
          target?: string | null
          created_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          id: string
          user_id: string | null
          message: string
          /** Optional reply-to address the submitter typed in the form. */
          contact_email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          message: string
          contact_email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          message?: string
          contact_email?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          id: string
          user_id: string
          provider: AiProvider
          /** AES-256-GCM ciphertext (iv:tag:data, base64). Never plaintext,
           *  and never selected by the browser — there is no select policy. */
          encrypted_key: string
          model_pref: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: AiProvider
          encrypted_key: string
          model_pref?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: AiProvider
          encrypted_key?: string
          model_pref?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicTables = Database['public']['Tables']

export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']

export type Profile = Tables<'profiles'>
export type MovieCache = Tables<'movies_cache'>
export type WatchlistItem = Tables<'watchlist_items'>
export type Rating = Tables<'ratings'>
export type AiSession = Tables<'ai_sessions'>
export type Feedback = Tables<'feedback'>
export type UserApiKey = Tables<'user_api_keys'>
