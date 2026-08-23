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
          monitoring_enabled: boolean;
          monitoring_interval_hours: number;
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
          monitoring_enabled?: boolean;
          monitoring_interval_hours?: number;
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
          monitoring_enabled?: boolean;
          monitoring_interval_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          target_id: string | null;
          user_id: string | null;
          email: string;
          plan: string;
          tier: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          active: boolean;
          user_paused: boolean;
          removed_at: string | null;
          scan_credit_auto_limit: number | null;
          scan_credit_consent_at: string | null;
          pending_scan_credit_reservation_id: string | null;
          scan_credit_blocked_at: string | null;
          scan_credit_required: number | null;
          spike_threshold: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          target_id?: string | null;
          user_id?: string | null;
          email: string;
          plan?: string;
          tier?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          active?: boolean;
          user_paused?: boolean;
          removed_at?: string | null;
          scan_credit_auto_limit?: number | null;
          scan_credit_consent_at?: string | null;
          pending_scan_credit_reservation_id?: string | null;
          scan_credit_blocked_at?: string | null;
          scan_credit_required?: number | null;
          spike_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          target_id?: string | null;
          user_id?: string | null;
          email?: string;
          plan?: string;
          tier?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          active?: boolean;
          user_paused?: boolean;
          removed_at?: string | null;
          scan_credit_auto_limit?: number | null;
          scan_credit_consent_at?: string | null;
          pending_scan_credit_reservation_id?: string | null;
          scan_credit_blocked_at?: string | null;
          scan_credit_required?: number | null;
          spike_threshold?: number;
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
          invalidated_at: string | null;
          invalidated_reason: string | null;
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
          invalidated_at?: string | null;
          invalidated_reason?: string | null;
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
          invalidated_at?: string | null;
          invalidated_reason?: string | null;
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
          suspect: boolean;
          profiles_returned: number;
          actor_id: string | null;
          run_id: string | null;
          target_count: number;
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
          suspect?: boolean;
          profiles_returned?: number;
          actor_id?: string | null;
          run_id?: string | null;
          target_count?: number;
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
          suspect?: boolean;
          profiles_returned?: number;
          actor_id?: string | null;
          run_id?: string | null;
          target_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_events: {
        Row: {
          id: string;
          target_id: string;
          follow_event_id: string;
          subscriber_email: string;
          channel: string;
          sent_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          target_id: string;
          follow_event_id: string;
          subscriber_email: string;
          channel?: string;
          sent_at?: string;
          status?: string;
        };
        Update: {
          id?: string;
          target_id?: string;
          follow_event_id?: string;
          subscriber_email?: string;
          channel?: string;
          sent_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          email: string;
          username: string | null;
          target_id: string | null;
          relationship: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          username?: string | null;
          target_id?: string | null;
          relationship?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string | null;
          target_id?: string | null;
          relationship?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      one_time_purchases: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          target_id: string | null;
          credits: number;
          consumed: number;
          stripe_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          target_id?: string | null;
          credits?: number;
          consumed?: number;
          stripe_session_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          target_id?: string | null;
          credits?: number;
          consumed?: number;
          stripe_session_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      scan_credit_wallets: {
        Row: {
          user_id: string;
          included_balance: number;
          purchased_balance: number;
          included_allowance: number;
          refresh_at: string;
          tier: string;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          included_balance?: number;
          purchased_balance?: number;
          included_allowance?: number;
          refresh_at?: string;
          tier?: string;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          included_balance?: number;
          purchased_balance?: number;
          included_allowance?: number;
          refresh_at?: string;
          tier?: string;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scan_credit_ledger: {
        Row: {
          id: string;
          user_id: string;
          target_id: string | null;
          scan_id: string | null;
          entry_type: string;
          reason: string;
          included_delta: number;
          purchased_delta: number;
          status: string;
          idempotency_key: string;
          reversal_of: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_id?: string | null;
          scan_id?: string | null;
          entry_type: string;
          reason: string;
          included_delta?: number;
          purchased_delta?: number;
          status?: string;
          idempotency_key: string;
          reversal_of?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_id?: string | null;
          scan_id?: string | null;
          entry_type?: string;
          reason?: string;
          included_delta?: number;
          purchased_delta?: number;
          status?: string;
          idempotency_key?: string;
          reversal_of?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      sync_scan_credit_wallet: {
        Args: {
          p_user_id: string;
          p_tier: string;
          p_allowance: number;
          p_stripe_subscription_id: string;
        };
        Returns: Array<{
          included_balance: number;
          purchased_balance: number;
          included_allowance: number;
          refresh_at: string;
        }>;
      };
      grant_purchased_scan_credits: {
        Args: {
          p_user_id: string;
          p_units: number;
          p_idempotency_key: string;
          p_reason?: string;
        };
        Returns: Array<{
          granted: boolean;
          included_balance: number;
          purchased_balance: number;
          refresh_at: string;
        }>;
      };
      reserve_scan_credits: {
        Args: {
          p_user_id: string;
          p_units: number;
          p_target_id: string;
          p_reason: string;
          p_idempotency_key: string;
        };
        Returns: Array<{
          reserved: boolean;
          reservation_id: string | null;
          included_balance: number;
          purchased_balance: number;
          refresh_at: string | null;
        }>;
      };
      complete_scan_credit_reservation: {
        Args: { p_reservation_id: string; p_scan_id?: string | null };
        Returns: boolean;
      };
      refund_scan_credit_reservation: {
        Args: { p_reservation_id: string; p_reason?: string };
        Returns: Array<{
          refunded: boolean;
          included_balance: number;
          purchased_balance: number;
          refresh_at: string | null;
        }>;
      };
    };
    Enums: Record<string, never>;
  };
}
