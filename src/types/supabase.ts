export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      code_versions: {
        Row: {
          comments: string | null
          created_at: string
          id: number
          url: string
          version: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: number
          url: string
          version: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: number
          url?: string
          version?: number
        }
        Relationships: []
      }
      group_suscriber: {
        Row: {
          active: boolean
          group: number
          id: number
          user: number
        }
        Insert: {
          active?: boolean
          group: number
          id?: number
          user: number
        }
        Update: {
          active?: boolean
          group?: number
          id?: number
          user?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_suscriber_group_fkey"
            columns: ["group"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_suscriber_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: number
          deleted_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by: number
          deleted_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: number
          deleted_at?: string | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_groups: {
        Row: {
          group_id: number
          id: string
          photo_id: string
        }
        Insert: {
          group_id: number
          id?: string
          photo_id: string
        }
        Update: {
          group_id?: number
          id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_groups_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string
          group: number | null
          id: string
          photo_url: string | null
          title: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          group?: number | null
          id?: string
          photo_url?: string | null
          title?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          group?: number | null
          id?: string
          photo_url?: string | null
          title?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_group_fkey"
            columns: ["group"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      pixie: {
        Row: {
          brightness: number | null
          created_at: string
          created_by: number | null
          id: number
          mac: string
          name: string | null
          pictures_on_queue: number | null
        }
        Insert: {
          brightness?: number | null
          created_at?: string
          created_by?: number | null
          id?: number
          mac: string
          name?: string | null
          pictures_on_queue?: number | null
        }
        Update: {
          brightness?: number | null
          created_at?: string
          created_by?: number | null
          id?: number
          mac?: string
          name?: string | null
          pictures_on_queue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pixie_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spotify_credentials: {
        Row: {
          id: number
          spotify_id: string
          spotify_secret: string
          spotify_token: string | null
          user: number
        }
        Insert: {
          id?: number
          spotify_id: string
          spotify_secret: string
          spotify_token?: string | null
          user: number
        }
        Update: {
          id?: number
          spotify_id?: string
          spotify_secret?: string
          spotify_token?: string | null
          user?: number
        }
        Relationships: [
          {
            foreignKeyName: "spotify_credentials_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      urls: {
        Row: {
          id: number
          keyURL: string
          valueURL: string | null
        }
        Insert: {
          id?: number
          keyURL: string
          valueURL?: string | null
        }
        Update: {
          id?: number
          keyURL?: string
          valueURL?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: number
          password: string | null
          telegram_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          password?: string | null
          telegram_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          password?: string | null
          telegram_id?: string | null
          username?: string
        }
        Relationships: []
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
