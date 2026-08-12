export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      instagram_targets: {
        Row: {
          id: string;
          instagram_id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          is_private: boolean;
          is_verified: boolean;
          following_count: number;
          follower_count: number;
          last_scanned_at: string | null;
          next_scan_at: string | null;
          scan_interval_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instagram_id: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_private?: boolean;
          is_verified?: boolean;
          following_count?: number;
          follower_count?: number;
          last_scanned_at?: string | null;
          next_scan_at?: string | null;
          scan_interval_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instagram_id?: string;
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_private?: boolean;
          is_verified?: boolean;
          following_count?: number;
          follower_count?: number;
          last_scanned_at?: string | null;
          next_scan_at?: string | null;
          scan_interval_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          target_id: string;
          email: string;
          plan: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          target_id: string;
          email: string;
          plan?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          target_id?: string;
          email?: string;
          plan?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      follow_snapshots: {
        Row: {
          id: string;
          target_id: string;
          snapshot_type: string;
          account_ids: string[];
          account_usernames: string[];
          captured_at: string;
          scan_id: string;
        };
        Insert: {
          id?: string;
          target_id: string;
          snapshot_type: string;
          account_ids: string[];
          account_usernames: string[];
          captured_at?: string;
          scan_id: string;
        };
        Update: {
          id?: string;
          target_id?: string;
          snapshot_type?: string;
          account_ids?: string[];
          account_usernames?: string[];
          captured_at?: string;
          scan_id?: string;
        };
        Relationships: [];
      };
      follow_events: {
        Row: {
          id: string;
          target_id: string;
          event_type: string;
          instagram_id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          is_verified: boolean;
          detected_at: string;
          confirmed: boolean;
          previous_snapshot_id: string | null;
          current_snapshot_id: string;
        };
        Insert: {
          id?: string;
          target_id: string;
          event_type: string;
          instagram_id: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_verified?: boolean;
          detected_at?: string;
          confirmed?: boolean;
          previous_snapshot_id?: string | null;
          current_snapshot_id: string;
        };
        Update: {
          id?: string;
          target_id?: string;
          event_type?: string;
          instagram_id?: string;
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_verified?: boolean;
          detected_at?: string;
          confirmed?: boolean;
          previous_snapshot_id?: string | null;
          current_snapshot_id?: string;
        };
        Relationships: [];
      };
      scans: {
        Row: {
          id: string;
          target_id: string;
          status: string;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          provider: string;
          api_cost: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_id: string;
          status?: string;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          provider?: string;
          api_cost?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          target_id?: string;
          status?: string;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          provider?: string;
          api_cost?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
