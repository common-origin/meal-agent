/**
 * Database Type Definitions
 * 
 * This file will be auto-generated from your Supabase schema.
 * For now, we'll define the basic structure manually.
 * 
 * To auto-generate in the future, run:
 * npx supabase gen types typescript --project-id migfbyyftwgidbkwwyst > src/lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      household_members: {
        Row: {
          id: string
          household_id: string
          user_id: string
          role: 'owner' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
      }
      family_settings: {
        Row: {
          id: string
          household_id: string
          total_servings: number
          adults: number
          kids: number
          kids_ages: number[]
          cuisines: string[]
          dietary_restrictions: string[]
          cooking_time_preference: string
          skill_level: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          total_servings?: number
          adults?: number
          kids?: number
          kids_ages?: number[]
          cuisines?: string[]
          dietary_restrictions?: string[]
          cooking_time_preference?: string
          skill_level?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          total_servings?: number
          adults?: number
          kids?: number
          kids_ages?: number[]
          cuisines?: string[]
          dietary_restrictions?: string[]
          cooking_time_preference?: string
          skill_level?: string
          created_at?: string
          updated_at?: string
        }
      }
      recipes: {
        Row: {
          id: string
          household_id: string
          title: string
          source_url: string | null
          source_domain: string
          source_chef: string | null
          time_mins: number
          serves: number
          tags: string[]
          ingredients: Json
          instructions: string[] | null
          cost_per_serve_est: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          title: string
          source_url?: string | null
          source_domain?: string
          source_chef?: string | null
          time_mins: number
          serves: number
          tags?: string[]
          ingredients: Json
          instructions?: string[] | null
          cost_per_serve_est?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          title?: string
          source_url?: string | null
          source_domain?: string
          source_chef?: string | null
          time_mins?: number
          serves?: number
          tags?: string[]
          ingredients?: Json
          instructions?: string[] | null
          cost_per_serve_est?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      meal_plans: {
        Row: {
          id: string
          household_id: string
          week_start: string
          meals: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          week_start: string
          meals: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          week_start?: string
          meals?: Json
          created_at?: string
          updated_at?: string
        }
      }
      shopping_lists: {
        Row: {
          id: string
          household_id: string
          week_start: string
          items: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          week_start: string
          items: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          week_start?: string
          items?: Json
          created_at?: string
          updated_at?: string
        }
      }
      pantry_preferences: {
        Row: {
          id: string
          household_id: string
          items: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          items?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          items?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      api_usage: {
        Row: {
          id: string
          household_id: string
          endpoint: string
          tokens_used: number | null
          cost_usd: number | null
          timestamp: string
        }
        Insert: {
          id?: string
          household_id: string
          endpoint: string
          tokens_used?: number | null
          cost_usd?: number | null
          timestamp?: string
        }
        Update: {
          id?: string
          household_id?: string
          endpoint?: string
          tokens_used?: number | null
          cost_usd?: number | null
          timestamp?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
