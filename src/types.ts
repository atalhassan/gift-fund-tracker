// Generated from the staging Supabase project (MCP generate_typescript_types)
// on 2026-07-12. Regenerate after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      fund_members: {
        Row: {
          created_at: string | null
          fund_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fund_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          fund_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_members_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_share_links: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          fund_id: string
          id: string
          max_uses: number | null
          revoked: boolean
          role: string
          token: string
          use_count: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          fund_id: string
          id?: string
          max_uses?: number | null
          revoked?: boolean
          role?: string
          token?: string
          use_count?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          fund_id?: string
          id?: string
          max_uses?: number | null
          revoked?: boolean
          role?: string
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fund_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_share_links_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      funds: {
        Row: {
          created_at: string | null
          currency: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funds_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          created_by: string
          description: string | null
          fund_id: string
          id: string
          occurred_at: string
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          fund_id: string
          id?: string
          occurred_at?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          fund_id?: string
          id?: string
          occurred_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fund_balances: {
        Row: {
          balance: number | null
          fund_id: string | null
          initial_amount: number | null
          last_activity: string | null
          total_credit: number | null
          total_expense: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_fund_member: { Args: { f_id: string }; Returns: boolean }
      is_fund_owner: { Args: { f_id: string }; Returns: boolean }
      redeem_share_link: { Args: { link_token: string }; Returns: string }
      shares_fund_with: { Args: { other: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  Name extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[Name]["Row"]

export type TablesInsert<Name extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][Name]["Insert"]

export type TablesUpdate<Name extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][Name]["Update"]

// ---------------------------------------------------------------------------
// App-level aliases. The check constraints on role/type don't survive type
// generation (they come back as plain string), so narrow them here.
// ---------------------------------------------------------------------------

export type Role = "owner" | "collaborator"
export type TxType = "credit" | "expense"

export type Profile = Tables<"profiles">
export type Fund = Tables<"funds">
export type FundMember = Omit<Tables<"fund_members">, "role"> & { role: Role }
export type FundShareLink = Tables<"fund_share_links">
export type Transaction = Omit<Tables<"transactions">, "type"> & { type: TxType }
export type FundBalance = Tables<"fund_balances">
