export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_user_id: string;
          business_id: string;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          new_data: Json | null;
          previous_data: Json | null;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor_user_id: string;
          business_id: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          new_data?: Json | null;
          previous_data?: Json | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string;
          business_id?: string;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          new_data?: Json | null;
          previous_data?: Json | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_days: {
        Row: {
          business_date: string;
          business_id: string;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          id: string;
          opened_at: string;
          opened_by: string;
          reopen_reason: string | null;
          status: Database["public"]["Enums"]["business_day_status"];
        };
        Insert: {
          business_date: string;
          business_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: string;
          opened_at?: string;
          opened_by: string;
          reopen_reason?: string | null;
          status?: Database["public"]["Enums"]["business_day_status"];
        };
        Update: {
          business_date?: string;
          business_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          id?: string;
          opened_at?: string;
          opened_by?: string;
          reopen_reason?: string | null;
          status?: Database["public"]["Enums"]["business_day_status"];
        };
        Relationships: [
          {
            foreignKeyName: "business_days_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_members: {
        Row: {
          business_id: string;
          created_at: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_position_snapshots: {
        Row: {
          bank_ron: number;
          business_id: string;
          cash_ron: number;
          created_at: string;
          created_by: string;
          customer_receivables_ron: number;
          estimated_supplier_payables_ron: number;
          estimated_usd_payables_ron: number;
          id: string;
          net_business_value_ron: number;
          shop_inventory_ron: number;
          snapshot_date: string;
          supplier_payables_ron: number;
          supplier_payables_usd: number;
          total_assets_ron: number;
          usd_ron_rate: number | null;
          warehouse_inventory_ron: number;
        };
        Insert: {
          bank_ron: number;
          business_id: string;
          cash_ron: number;
          created_at?: string;
          created_by: string;
          customer_receivables_ron: number;
          estimated_supplier_payables_ron: number;
          estimated_usd_payables_ron: number;
          id?: string;
          net_business_value_ron: number;
          shop_inventory_ron: number;
          snapshot_date: string;
          supplier_payables_ron: number;
          supplier_payables_usd: number;
          total_assets_ron: number;
          usd_ron_rate?: number | null;
          warehouse_inventory_ron: number;
        };
        Update: {
          bank_ron?: number;
          business_id?: string;
          cash_ron?: number;
          created_at?: string;
          created_by?: string;
          customer_receivables_ron?: number;
          estimated_supplier_payables_ron?: number;
          estimated_usd_payables_ron?: number;
          id?: string;
          net_business_value_ron?: number;
          shop_inventory_ron?: number;
          snapshot_date?: string;
          supplier_payables_ron?: number;
          supplier_payables_usd?: number;
          total_assets_ron?: number;
          usd_ron_rate?: number | null;
          warehouse_inventory_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "business_position_snapshots_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          base_currency: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          timezone: string;
        };
        Insert: {
          base_currency?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          timezone: string;
        };
        Update: {
          base_currency?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      currency_reference_rates: {
        Row: {
          base_currency: string;
          business_id: string;
          created_at: string;
          created_by: string;
          effective_date: string;
          id: string;
          quote_currency: string;
          rate: number;
        };
        Insert: {
          base_currency: string;
          business_id: string;
          created_at?: string;
          created_by: string;
          effective_date: string;
          id?: string;
          quote_currency: string;
          rate: number;
        };
        Update: {
          base_currency?: string;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          effective_date?: string;
          id?: string;
          quote_currency?: string;
          rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "currency_reference_rates_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_credit_adjustments: {
        Row: {
          amount_ron: number;
          business_id: string;
          created_at: string;
          customer_credit_purchase_id: string;
          customer_id: string;
          id: string;
          sale_return_id: string;
        };
        Insert: {
          amount_ron: number;
          business_id: string;
          created_at?: string;
          customer_credit_purchase_id: string;
          customer_id: string;
          id?: string;
          sale_return_id: string;
        };
        Update: {
          amount_ron?: number;
          business_id?: string;
          created_at?: string;
          customer_credit_purchase_id?: string;
          customer_id?: string;
          id?: string;
          sale_return_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_credit_adjustments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_adjustments_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "customer_credit_adjustments_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_adjustments_purchase_business_fkey";
            columns: ["business_id", "customer_credit_purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchase_balances";
            referencedColumns: ["business_id", "purchase_id"];
          },
          {
            foreignKeyName: "customer_credit_adjustments_purchase_business_fkey";
            columns: ["business_id", "customer_credit_purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchases";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_adjustments_return_business_fkey";
            columns: ["business_id", "sale_return_id"];
            isOneToOne: false;
            referencedRelation: "sale_return_summaries";
            referencedColumns: ["business_id", "sale_return_id"];
          },
          {
            foreignKeyName: "customer_credit_adjustments_return_business_fkey";
            columns: ["business_id", "sale_return_id"];
            isOneToOne: false;
            referencedRelation: "sale_returns";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      customer_credit_purchases: {
        Row: {
          amount_ron: number;
          business_day_id: string | null;
          business_id: string;
          created_at: string;
          created_by: string;
          customer_id: string;
          description: string | null;
          due_date: string | null;
          entry_origin: string;
          id: string;
          opening_batch_id: string | null;
          purchase_date: string;
          reversal_of_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          sale_id: string | null;
        };
        Insert: {
          amount_ron: number;
          business_day_id?: string | null;
          business_id: string;
          created_at?: string;
          created_by: string;
          customer_id: string;
          description?: string | null;
          due_date?: string | null;
          entry_origin: string;
          id?: string;
          opening_batch_id?: string | null;
          purchase_date: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          sale_id?: string | null;
        };
        Update: {
          amount_ron?: number;
          business_day_id?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          customer_id?: string;
          description?: string | null;
          due_date?: string | null;
          entry_origin?: string;
          id?: string;
          opening_batch_id?: string | null;
          purchase_date?: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          sale_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_credit_purchases_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchase_balances";
            referencedColumns: ["purchase_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["customer_credit_purchase_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "returnable_sale_line_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      customer_payment_allocations: {
        Row: {
          amount_ron: number;
          business_id: string;
          created_at: string;
          customer_credit_purchase_id: string;
          id: string;
          payment_id: string;
        };
        Insert: {
          amount_ron: number;
          business_id: string;
          created_at?: string;
          customer_credit_purchase_id: string;
          id?: string;
          payment_id: string;
        };
        Update: {
          amount_ron?: number;
          business_id?: string;
          created_at?: string;
          customer_credit_purchase_id?: string;
          id?: string;
          payment_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payment_allocations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_customer_credit_purchase_id_fkey";
            columns: ["customer_credit_purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchase_balances";
            referencedColumns: ["purchase_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_customer_credit_purchase_id_fkey";
            columns: ["customer_credit_purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_customer_credit_purchase_id_fkey";
            columns: ["customer_credit_purchase_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["customer_credit_purchase_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_business_fkey";
            columns: ["business_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payment_summaries";
            referencedColumns: ["business_id", "payment_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_business_fkey";
            columns: ["business_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payment_summaries";
            referencedColumns: ["payment_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "customer_credit_purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchase_balances";
            referencedColumns: ["business_id", "purchase_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "customer_credit_purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchases";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      customer_payments: {
        Row: {
          allocation_strategy: string;
          amount_ron: number;
          business_day_id: string;
          business_id: string;
          created_at: string;
          created_by: string;
          customer_id: string;
          entry_origin: string;
          financial_account_id: string;
          id: string;
          idempotency_key: string;
          notes: string | null;
          payment_date: string;
          request_fingerprint: string;
          reversal_of_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
        };
        Insert: {
          allocation_strategy: string;
          amount_ron: number;
          business_day_id: string;
          business_id: string;
          created_at?: string;
          created_by: string;
          customer_id: string;
          entry_origin: string;
          financial_account_id: string;
          id?: string;
          idempotency_key: string;
          notes?: string | null;
          payment_date: string;
          request_fingerprint: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
        };
        Update: {
          allocation_strategy?: string;
          amount_ron?: number;
          business_day_id?: string;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          customer_id?: string;
          entry_origin?: string;
          financial_account_id?: string;
          id?: string;
          idempotency_key?: string;
          notes?: string | null;
          payment_date?: string;
          request_fingerprint?: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "customer_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "customer_payments_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "customer_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "customer_payment_summaries";
            referencedColumns: ["payment_id"];
          },
          {
            foreignKeyName: "customer_payments_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_sales: {
        Row: {
          active_closure_id: string | null;
          bank_sales_ron: number;
          business_day_id: string;
          business_id: string;
          cash_sales_ron: number;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string;
          credit_sales_ron: number;
          id: string;
          last_draft_at: string | null;
          last_draft_by: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["daily_sales_status"];
          total_sales_ron: number;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          active_closure_id?: string | null;
          bank_sales_ron: number;
          business_day_id: string;
          business_id: string;
          cash_sales_ron: number;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by: string;
          credit_sales_ron: number;
          id?: string;
          last_draft_at?: string | null;
          last_draft_by?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["daily_sales_status"];
          total_sales_ron: number;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          active_closure_id?: string | null;
          bank_sales_ron?: number;
          business_day_id?: string;
          business_id?: string;
          cash_sales_ron?: number;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string;
          credit_sales_ron?: number;
          id?: string;
          last_draft_at?: string | null;
          last_draft_by?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["daily_sales_status"];
          total_sales_ron?: number;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_sales_active_closure_business_fkey";
            columns: ["business_id", "active_closure_id"];
            isOneToOne: false;
            referencedRelation: "daily_sales_closures";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
        ];
      };
      daily_sales_closures: {
        Row: {
          bank_sales_ron: number;
          business_day_id: string;
          business_id: string;
          cash_sales_ron: number;
          close_sequence: number;
          closed_at: string;
          closed_by: string;
          credit_sales_ron: number;
          daily_sales_id: string;
          id: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          total_sales_ron: number;
        };
        Insert: {
          bank_sales_ron: number;
          business_day_id: string;
          business_id: string;
          cash_sales_ron: number;
          close_sequence: number;
          closed_at?: string;
          closed_by: string;
          credit_sales_ron: number;
          daily_sales_id: string;
          id?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          total_sales_ron: number;
        };
        Update: {
          bank_sales_ron?: number;
          business_day_id?: string;
          business_id?: string;
          cash_sales_ron?: number;
          close_sequence?: number;
          closed_at?: string;
          closed_by?: string;
          credit_sales_ron?: number;
          daily_sales_id?: string;
          id?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          total_sales_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "daily_sales_closures_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_closures_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_closures_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_closures_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_closures_daily_sales_id_fkey";
            columns: ["daily_sales_id"];
            isOneToOne: false;
            referencedRelation: "daily_sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_closures_daily_sales_id_fkey";
            columns: ["daily_sales_id"];
            isOneToOne: false;
            referencedRelation: "daily_sales_summaries";
            referencedColumns: ["daily_sales_id"];
          },
          {
            foreignKeyName: "daily_sales_closures_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_closures_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "daily_sales_closures_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_closures_sales_business_fkey";
            columns: ["business_id", "daily_sales_id"];
            isOneToOne: false;
            referencedRelation: "daily_sales";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "daily_sales_closures_sales_business_fkey";
            columns: ["business_id", "daily_sales_id"];
            isOneToOne: false;
            referencedRelation: "daily_sales_summaries";
            referencedColumns: ["business_id", "daily_sales_id"];
          },
        ];
      };
      damaged_stock_movements: {
        Row: {
          business_day_id: string;
          business_id: string;
          created_at: string;
          created_by: string;
          direction: string;
          id: string;
          movement_date: string;
          product_id: string;
          quantity: number;
          reversal_of_id: string | null;
          source_entity_id: string;
          source_entity_type: string;
          unit_cost_ron: number;
        };
        Insert: {
          business_day_id: string;
          business_id: string;
          created_at?: string;
          created_by: string;
          direction: string;
          id?: string;
          movement_date: string;
          product_id: string;
          quantity: number;
          reversal_of_id?: string | null;
          source_entity_id: string;
          source_entity_type: string;
          unit_cost_ron: number;
        };
        Update: {
          business_day_id?: string;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          direction?: string;
          id?: string;
          movement_date?: string;
          product_id?: string;
          quantity?: number;
          reversal_of_id?: string | null;
          source_entity_id?: string;
          source_entity_type?: string;
          unit_cost_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "damaged_stock_movements_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "damaged_stock_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_movements";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_categories_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount_ron: number;
          business_day_id: string;
          business_id: string;
          category_id: string;
          created_at: string;
          created_by: string;
          description: string;
          entry_origin: string;
          expense_date: string;
          financial_account_id: string;
          id: string;
          idempotency_key: string;
          request_fingerprint: string;
          reversal_of_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
        };
        Insert: {
          amount_ron: number;
          business_day_id: string;
          business_id: string;
          category_id: string;
          created_at?: string;
          created_by: string;
          description: string;
          entry_origin: string;
          expense_date: string;
          financial_account_id: string;
          id?: string;
          idempotency_key: string;
          request_fingerprint: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
        };
        Update: {
          amount_ron?: number;
          business_day_id?: string;
          business_id?: string;
          category_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string;
          entry_origin?: string;
          expense_date?: string;
          financial_account_id?: string;
          id?: string;
          idempotency_key?: string;
          request_fingerprint?: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "expenses_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "expenses_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "expenses_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "expenses_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_category_business_fkey";
            columns: ["business_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "expenses_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "expenses_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "expenses_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "expenses_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "expense_summaries";
            referencedColumns: ["expense_id"];
          },
          {
            foreignKeyName: "expenses_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_account_entries: {
        Row: {
          amount_ron: number;
          business_day_id: string | null;
          business_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          direction: Database["public"]["Enums"]["financial_entry_direction"];
          entry_date: string;
          entry_type: string;
          financial_account_id: string;
          id: string;
          idempotency_key: string | null;
          opening_batch_id: string | null;
          reversal_of_id: string | null;
          source_entity_id: string;
          source_entity_type: string;
        };
        Insert: {
          amount_ron: number;
          business_day_id?: string | null;
          business_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          direction: Database["public"]["Enums"]["financial_entry_direction"];
          entry_date: string;
          entry_type: string;
          financial_account_id: string;
          id?: string;
          idempotency_key?: string | null;
          opening_batch_id?: string | null;
          reversal_of_id?: string | null;
          source_entity_id: string;
          source_entity_type: string;
        };
        Update: {
          amount_ron?: number;
          business_day_id?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          direction?: Database["public"]["Enums"]["financial_entry_direction"];
          entry_date?: string;
          entry_type?: string;
          financial_account_id?: string;
          id?: string;
          idempotency_key?: string | null;
          opening_batch_id?: string | null;
          reversal_of_id?: string | null;
          source_entity_id?: string;
          source_entity_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_account_entries_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "financial_account_entries_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "financial_account_entries_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "financial_account_entries_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "financial_account_entries_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "financial_account_entries_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_entry_summaries";
            referencedColumns: ["entry_id"];
          },
        ];
      };
      financial_accounts: {
        Row: {
          business_id: string;
          created_at: string;
          currency: string;
          id: string;
          is_active: boolean;
          name: string;
          type: Database["public"]["Enums"]["financial_account_type"];
        };
        Insert: {
          business_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          type: Database["public"]["Enums"]["financial_account_type"];
        };
        Update: {
          business_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          type?: Database["public"]["Enums"]["financial_account_type"];
        };
        Relationships: [
          {
            foreignKeyName: "financial_accounts_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_exceptions: {
        Row: {
          business_day_id: string;
          business_id: string;
          created_at: string;
          created_by: string;
          exception_date: string;
          exception_type: string;
          id: string;
          idempotency_key: string;
          product_id: string;
          quantity: number;
          reason: string;
          request_fingerprint: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          source_location_id: string;
          total_cost_ron: number;
          unit_cost_ron: number;
        };
        Insert: {
          business_day_id: string;
          business_id: string;
          created_at?: string;
          created_by: string;
          exception_date: string;
          exception_type: string;
          id?: string;
          idempotency_key: string;
          product_id: string;
          quantity: number;
          reason: string;
          request_fingerprint: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          source_location_id: string;
          total_cost_ron: number;
          unit_cost_ron: number;
        };
        Update: {
          business_day_id?: string;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          exception_date?: string;
          exception_type?: string;
          id?: string;
          idempotency_key?: string;
          product_id?: string;
          quantity?: number;
          reason?: string;
          request_fingerprint?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          source_location_id?: string;
          total_cost_ron?: number;
          unit_cost_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_exceptions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_exceptions_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_exceptions_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      inventory_locations: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          type: Database["public"]["Enums"]["inventory_location_type"];
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          type: Database["public"]["Enums"]["inventory_location_type"];
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          type?: Database["public"]["Enums"]["inventory_location_type"];
        };
        Relationships: [
          {
            foreignKeyName: "inventory_locations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_stocktakes: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string;
          id: string;
          idempotency_key: string;
          notes: string | null;
          reason: string;
          request_fingerprint: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          shop_actual_value_ron: number;
          shop_difference_ron: number;
          shop_expected_value_ron: number;
          stocktake_date: string;
          warehouse_actual_value_ron: number;
          warehouse_difference_ron: number;
          warehouse_expected_value_ron: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          idempotency_key: string;
          notes?: string | null;
          reason: string;
          request_fingerprint: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          shop_actual_value_ron: number;
          shop_difference_ron: number;
          shop_expected_value_ron: number;
          stocktake_date: string;
          warehouse_actual_value_ron: number;
          warehouse_difference_ron: number;
          warehouse_expected_value_ron: number;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          idempotency_key?: string;
          notes?: string | null;
          reason?: string;
          request_fingerprint?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          shop_actual_value_ron?: number;
          shop_difference_ron?: number;
          shop_expected_value_ron?: number;
          stocktake_date?: string;
          warehouse_actual_value_ron?: number;
          warehouse_difference_ron?: number;
          warehouse_expected_value_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_stocktakes_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_transfer_lines: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          inventory_transfer_id: string;
          line_number: number;
          line_total_ron: number;
          line_total_usd: number | null;
          product_id: string;
          quantity: number;
          unit_cost_ron: number;
          unit_cost_usd: number | null;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          inventory_transfer_id: string;
          line_number: number;
          line_total_ron: number;
          line_total_usd?: number | null;
          product_id: string;
          quantity: number;
          unit_cost_ron: number;
          unit_cost_usd?: number | null;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          inventory_transfer_id?: string;
          line_number?: number;
          line_total_ron?: number;
          line_total_usd?: number | null;
          product_id?: string;
          quantity?: number;
          unit_cost_ron?: number;
          unit_cost_usd?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["business_id", "reversal_movement_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["business_id", "transfer_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movement_summaries";
            referencedColumns: ["business_id", "movement_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movements";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      inventory_value_movements: {
        Row: {
          amount_ron: number;
          business_day_id: string | null;
          business_id: string;
          created_at: string;
          created_by: string;
          destination_location_id: string | null;
          entry_origin: string | null;
          id: string;
          idempotency_key: string | null;
          movement_date: string;
          movement_type: string;
          notes: string | null;
          opening_batch_id: string | null;
          request_fingerprint: string | null;
          reversal_of_id: string | null;
          source_entity_id: string;
          source_entity_type: string;
          source_location_id: string | null;
        };
        Insert: {
          amount_ron: number;
          business_day_id?: string | null;
          business_id: string;
          created_at?: string;
          created_by: string;
          destination_location_id?: string | null;
          entry_origin?: string | null;
          id?: string;
          idempotency_key?: string | null;
          movement_date: string;
          movement_type: string;
          notes?: string | null;
          opening_batch_id?: string | null;
          request_fingerprint?: string | null;
          reversal_of_id?: string | null;
          source_entity_id: string;
          source_entity_type: string;
          source_location_id?: string | null;
        };
        Update: {
          amount_ron?: number;
          business_day_id?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          destination_location_id?: string | null;
          entry_origin?: string | null;
          id?: string;
          idempotency_key?: string | null;
          movement_date?: string;
          movement_type?: string;
          notes?: string | null;
          opening_batch_id?: string | null;
          request_fingerprint?: string | null;
          reversal_of_id?: string | null;
          source_entity_id?: string;
          source_entity_type?: string;
          source_location_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_value_movements_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["reversal_movement_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["transfer_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movement_summaries";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
        ];
      };
      opening_balance_batches: {
        Row: {
          bank_balance_ron: number;
          business_id: string;
          cash_balance_ron: number;
          created_at: string;
          created_by: string;
          id: string;
          opening_date: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          shop_inventory_ron: number;
          warehouse_inventory_ron: number;
        };
        Insert: {
          bank_balance_ron: number;
          business_id: string;
          cash_balance_ron: number;
          created_at?: string;
          created_by: string;
          id?: string;
          opening_date: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          shop_inventory_ron: number;
          warehouse_inventory_ron: number;
        };
        Update: {
          bank_balance_ron?: number;
          business_id?: string;
          cash_balance_ron?: number;
          created_at?: string;
          created_by?: string;
          id?: string;
          opening_date?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          shop_inventory_ron?: number;
          warehouse_inventory_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "opening_balance_batches_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      product_stock_thresholds: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string;
          inventory_location_id: string;
          minimum_quantity: number;
          product_id: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by: string;
          inventory_location_id: string;
          minimum_quantity: number;
          product_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string;
          inventory_location_id?: string;
          minimum_quantity?: number;
          product_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_stock_thresholds_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_stock_thresholds_location_business_fkey";
            columns: ["business_id", "inventory_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "product_stock_thresholds_location_business_fkey";
            columns: ["business_id", "inventory_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "product_stock_thresholds_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "product_stock_thresholds_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "product_stock_thresholds_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "product_stock_thresholds_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "product_stock_thresholds_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      products: {
        Row: {
          business_id: string;
          category_id: string;
          created_at: string;
          created_by: string;
          default_purchase_cost_original: number | null;
          default_purchase_cost_ron: number | null;
          default_purchase_currency: Database["public"]["Enums"]["transaction_currency"];
          default_purchase_exchange_rate: number | null;
          default_selling_price_ron: number | null;
          id: string;
          internal_code: string;
          is_active: boolean;
          name: string;
          unit: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          business_id: string;
          category_id: string;
          created_at?: string;
          created_by: string;
          default_purchase_cost_original?: number | null;
          default_purchase_cost_ron?: number | null;
          default_purchase_currency?: Database["public"]["Enums"]["transaction_currency"];
          default_purchase_exchange_rate?: number | null;
          default_selling_price_ron?: number | null;
          id?: string;
          internal_code: string;
          is_active?: boolean;
          name: string;
          unit?: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          business_id?: string;
          category_id?: string;
          created_at?: string;
          created_by?: string;
          default_purchase_cost_original?: number | null;
          default_purchase_cost_ron?: number | null;
          default_purchase_currency?: Database["public"]["Enums"]["transaction_currency"];
          default_purchase_exchange_rate?: number | null;
          default_selling_price_ron?: number | null;
          id?: string;
          internal_code?: string;
          is_active?: boolean;
          name?: string;
          unit?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_business_fkey";
            columns: ["business_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sale_lines: {
        Row: {
          business_id: string;
          created_at: string;
          gross_profit_ron: number;
          id: string;
          line_cost_ron: number;
          line_number: number;
          line_total_ron: number;
          product_id: string;
          profit_percent: number;
          quantity: number;
          sale_id: string;
          unit_cost_ron: number;
          unit_selling_price_ron: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          gross_profit_ron: number;
          id?: string;
          line_cost_ron: number;
          line_number: number;
          line_total_ron: number;
          product_id: string;
          profit_percent: number;
          quantity: number;
          sale_id: string;
          unit_cost_ron: number;
          unit_selling_price_ron: number;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          gross_profit_ron?: number;
          id?: string;
          line_cost_ron?: number;
          line_number?: number;
          line_total_ron?: number;
          product_id?: string;
          profit_percent?: number;
          quantity?: number;
          sale_id?: string;
          unit_cost_ron?: number;
          unit_selling_price_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_lines_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "returnable_sale_line_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_lines_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_lines_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      sale_return_lines: {
        Row: {
          business_id: string;
          created_at: string;
          disposition: string;
          id: string;
          line_cost_ron: number;
          line_number: number;
          line_refund_ron: number;
          product_id: string;
          quantity: number;
          sale_line_id: string;
          sale_return_id: string;
          unit_cost_ron: number;
          unit_refund_ron: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          disposition: string;
          id?: string;
          line_cost_ron: number;
          line_number: number;
          line_refund_ron: number;
          product_id: string;
          quantity: number;
          sale_line_id: string;
          sale_return_id: string;
          unit_cost_ron: number;
          unit_refund_ron: number;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          disposition?: string;
          id?: string;
          line_cost_ron?: number;
          line_number?: number;
          line_refund_ron?: number;
          product_id?: string;
          quantity?: number;
          sale_line_id?: string;
          sale_return_id?: string;
          unit_cost_ron?: number;
          unit_refund_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_return_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_return_lines_return_business_fkey";
            columns: ["business_id", "sale_return_id"];
            isOneToOne: false;
            referencedRelation: "sale_return_summaries";
            referencedColumns: ["business_id", "sale_return_id"];
          },
          {
            foreignKeyName: "sale_return_lines_return_business_fkey";
            columns: ["business_id", "sale_return_id"];
            isOneToOne: false;
            referencedRelation: "sale_returns";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_return_lines_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: false;
            referencedRelation: "returnable_sale_line_summaries";
            referencedColumns: ["sale_line_id"];
          },
          {
            foreignKeyName: "sale_return_lines_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: false;
            referencedRelation: "sale_line_summaries";
            referencedColumns: ["line_id"];
          },
          {
            foreignKeyName: "sale_return_lines_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: false;
            referencedRelation: "sale_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_returns: {
        Row: {
          bank_refund_ron: number;
          business_day_id: string;
          business_id: string;
          cash_refund_ron: number;
          created_at: string;
          created_by: string;
          credit_reduction_ron: number;
          customer_id: string | null;
          id: string;
          idempotency_key: string;
          reason: string;
          request_fingerprint: string;
          return_date: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          sale_id: string;
          total_cost_ron: number;
          total_refund_ron: number;
        };
        Insert: {
          bank_refund_ron: number;
          business_day_id: string;
          business_id: string;
          cash_refund_ron: number;
          created_at?: string;
          created_by: string;
          credit_reduction_ron: number;
          customer_id?: string | null;
          id?: string;
          idempotency_key: string;
          reason: string;
          request_fingerprint: string;
          return_date: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          sale_id: string;
          total_cost_ron: number;
          total_refund_ron: number;
        };
        Update: {
          bank_refund_ron?: number;
          business_day_id?: string;
          business_id?: string;
          cash_refund_ron?: number;
          created_at?: string;
          created_by?: string;
          credit_reduction_ron?: number;
          customer_id?: string | null;
          id?: string;
          idempotency_key?: string;
          reason?: string;
          request_fingerprint?: string;
          return_date?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          sale_id?: string;
          total_cost_ron?: number;
          total_refund_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_returns_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_returns_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "sale_returns_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_returns_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sale_returns_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_returns_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sale_returns_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "returnable_sale_line_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_returns_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_returns_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      sales: {
        Row: {
          bank_amount_ron: number;
          business_day_id: string;
          business_id: string;
          cash_amount_ron: number;
          created_at: string;
          created_by: string;
          credit_amount_ron: number;
          customer_id: string | null;
          gross_profit_ron: number;
          id: string;
          idempotency_key: string;
          notes: string | null;
          profit_percent: number;
          request_fingerprint: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          sale_date: string;
          sale_number: number;
          shop_location_id: string;
          total_amount_ron: number;
          total_cost_ron: number;
        };
        Insert: {
          bank_amount_ron: number;
          business_day_id: string;
          business_id: string;
          cash_amount_ron: number;
          created_at?: string;
          created_by: string;
          credit_amount_ron: number;
          customer_id?: string | null;
          gross_profit_ron: number;
          id?: string;
          idempotency_key: string;
          notes?: string | null;
          profit_percent: number;
          request_fingerprint: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          sale_date: string;
          sale_number: number;
          shop_location_id: string;
          total_amount_ron: number;
          total_cost_ron: number;
        };
        Update: {
          bank_amount_ron?: number;
          business_day_id?: string;
          business_id?: string;
          cash_amount_ron?: number;
          created_at?: string;
          created_by?: string;
          credit_amount_ron?: number;
          customer_id?: string | null;
          gross_profit_ron?: number;
          id?: string;
          idempotency_key?: string;
          notes?: string | null;
          profit_percent?: number;
          request_fingerprint?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          sale_date?: string;
          sale_number?: number;
          shop_location_id?: string;
          total_amount_ron?: number;
          total_cost_ron?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "sales_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sales_shop_business_fkey";
            columns: ["business_id", "shop_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "sales_shop_business_fkey";
            columns: ["business_id", "shop_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      stock_movement_cost_details: {
        Row: {
          business_id: string;
          cost_currency: Database["public"]["Enums"]["transaction_currency"];
          cost_source: string;
          exchange_rate: number | null;
          original_unit_cost: number;
          stock_movement_id: string;
        };
        Insert: {
          business_id: string;
          cost_currency: Database["public"]["Enums"]["transaction_currency"];
          cost_source: string;
          exchange_rate?: number | null;
          original_unit_cost: number;
          stock_movement_id: string;
        };
        Update: {
          business_id?: string;
          cost_currency?: Database["public"]["Enums"]["transaction_currency"];
          cost_source?: string;
          exchange_rate?: number | null;
          original_unit_cost?: number;
          stock_movement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movement_cost_details_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movement_cost_details_business_movement_fkey";
            columns: ["business_id", "stock_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["business_id", "movement_id"];
          },
          {
            foreignKeyName: "stock_movement_cost_details_business_movement_fkey";
            columns: ["business_id", "stock_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["business_id", "reversal_movement_id"];
          },
          {
            foreignKeyName: "stock_movement_cost_details_business_movement_fkey";
            columns: ["business_id", "stock_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "stock_movement_cost_details_stock_movement_id_fkey";
            columns: ["stock_movement_id"];
            isOneToOne: true;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "stock_movement_cost_details_stock_movement_id_fkey";
            columns: ["stock_movement_id"];
            isOneToOne: true;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["reversal_movement_id"];
          },
          {
            foreignKeyName: "stock_movement_cost_details_stock_movement_id_fkey";
            columns: ["stock_movement_id"];
            isOneToOne: true;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          business_day_id: string | null;
          business_id: string;
          created_at: string;
          created_by: string;
          destination_location_id: string | null;
          id: string;
          idempotency_key: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          negative_stock_override: boolean;
          notes: string | null;
          override_reason: string | null;
          product_id: string;
          quantity: number;
          reference_id: string;
          reference_type: string;
          request_fingerprint: string;
          reversal_of_id: string | null;
          source_location_id: string | null;
          unit_cost_ron: number | null;
          unit_cost_usd: number | null;
        };
        Insert: {
          business_day_id?: string | null;
          business_id: string;
          created_at?: string;
          created_by: string;
          destination_location_id?: string | null;
          id?: string;
          idempotency_key: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          negative_stock_override?: boolean;
          notes?: string | null;
          override_reason?: string | null;
          product_id: string;
          quantity: number;
          reference_id: string;
          reference_type: string;
          request_fingerprint: string;
          reversal_of_id?: string | null;
          source_location_id?: string | null;
          unit_cost_ron?: number | null;
          unit_cost_usd?: number | null;
        };
        Update: {
          business_day_id?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          destination_location_id?: string | null;
          id?: string;
          idempotency_key?: string;
          movement_type?: Database["public"]["Enums"]["stock_movement_type"];
          negative_stock_override?: boolean;
          notes?: string | null;
          override_reason?: string | null;
          product_id?: string;
          quantity?: number;
          reference_id?: string;
          reference_type?: string;
          request_fingerprint?: string;
          reversal_of_id?: string | null;
          source_location_id?: string | null;
          unit_cost_ron?: number | null;
          unit_cost_usd?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "stock_movements_business_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_business_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "stock_movements_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_destination_location_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "stock_movements_destination_location_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "stock_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["reversal_movement_id"];
          },
          {
            foreignKeyName: "stock_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_source_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "stock_movements_source_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      supplier_payment_allocations: {
        Row: {
          actual_ron_value: number;
          allocated_original_amount: number;
          business_id: string;
          created_at: string;
          currency_gain_loss_ron: number;
          historical_ron_value: number;
          id: string;
          supplier_payment_id: string;
          supplier_purchase_id: string;
        };
        Insert: {
          actual_ron_value: number;
          allocated_original_amount: number;
          business_id: string;
          created_at?: string;
          currency_gain_loss_ron: number;
          historical_ron_value: number;
          id?: string;
          supplier_payment_id: string;
          supplier_purchase_id: string;
        };
        Update: {
          actual_ron_value?: number;
          allocated_original_amount?: number;
          business_id?: string;
          created_at?: string;
          currency_gain_loss_ron?: number;
          historical_ron_value?: number;
          id?: string;
          supplier_payment_id?: string;
          supplier_purchase_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_payment_business_fkey";
            columns: ["business_id", "supplier_payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payment_summaries";
            referencedColumns: ["business_id", "payment_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_payment_business_fkey";
            columns: ["business_id", "supplier_payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payments";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchase_summaries";
            referencedColumns: ["business_id", "purchase_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchases";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_payment_id_fkey";
            columns: ["supplier_payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payment_summaries";
            referencedColumns: ["payment_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_payment_id_fkey";
            columns: ["supplier_payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_purchase_id_fkey";
            columns: ["supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchase_summaries";
            referencedColumns: ["purchase_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_purchase_id_fkey";
            columns: ["supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_payments: {
        Row: {
          actual_amount_ron: number;
          allocation_strategy: string;
          business_day_id: string;
          business_id: string;
          created_at: string;
          created_by: string;
          currency: Database["public"]["Enums"]["transaction_currency"];
          currency_gain_loss_ron: number;
          entry_origin: string;
          financial_account_id: string;
          id: string;
          idempotency_key: string;
          notes: string | null;
          original_amount_paid: number;
          payment_date: string;
          payment_exchange_rate: number | null;
          request_fingerprint: string;
          reversal_of_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          supplier_id: string;
        };
        Insert: {
          actual_amount_ron: number;
          allocation_strategy: string;
          business_day_id: string;
          business_id: string;
          created_at?: string;
          created_by: string;
          currency: Database["public"]["Enums"]["transaction_currency"];
          currency_gain_loss_ron?: number;
          entry_origin: string;
          financial_account_id: string;
          id?: string;
          idempotency_key: string;
          notes?: string | null;
          original_amount_paid: number;
          payment_date: string;
          payment_exchange_rate?: number | null;
          request_fingerprint: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          supplier_id: string;
        };
        Update: {
          actual_amount_ron?: number;
          allocation_strategy?: string;
          business_day_id?: string;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: Database["public"]["Enums"]["transaction_currency"];
          currency_gain_loss_ron?: number;
          entry_origin?: string;
          financial_account_id?: string;
          id?: string;
          idempotency_key?: string;
          notes?: string | null;
          original_amount_paid?: number;
          payment_date?: string;
          payment_exchange_rate?: number | null;
          request_fingerprint?: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "supplier_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "supplier_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payment_summaries";
            referencedColumns: ["payment_id"];
          },
          {
            foreignKeyName: "supplier_payments_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["business_id", "supplier_id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_purchase_lines: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          line_number: number;
          line_total_ron: number;
          line_total_usd: number | null;
          product_id: string;
          purchase_exchange_rate: number;
          quantity: number;
          supplier_purchase_id: string;
          unit_cost_ron: number;
          unit_cost_usd: number | null;
          unit_price_original_currency: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          line_number: number;
          line_total_ron: number;
          line_total_usd?: number | null;
          product_id: string;
          purchase_exchange_rate: number;
          quantity: number;
          supplier_purchase_id: string;
          unit_cost_ron: number;
          unit_cost_usd?: number | null;
          unit_price_original_currency: number;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          line_number?: number;
          line_total_ron?: number;
          line_total_usd?: number | null;
          product_id?: string;
          purchase_exchange_rate?: number;
          quantity?: number;
          supplier_purchase_id?: string;
          unit_cost_ron?: number;
          unit_cost_usd?: number | null;
          unit_price_original_currency?: number;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_purchase_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_purchase_business_fkey";
            columns: ["business_id", "supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchase_summaries";
            referencedColumns: ["business_id", "purchase_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_purchase_business_fkey";
            columns: ["business_id", "supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchases";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      supplier_purchases: {
        Row: {
          business_day_id: string | null;
          business_id: string;
          created_at: string;
          created_by: string;
          currency: Database["public"]["Enums"]["transaction_currency"];
          description: string | null;
          destination_location_id: string | null;
          due_date: string | null;
          entry_origin: string;
          id: string;
          inventory_cost_ron: number;
          inventory_cost_usd: number | null;
          opening_batch_id: string | null;
          original_amount: number;
          purchase_date: string;
          purchase_exchange_rate: number | null;
          record_mode: string;
          reversal_of_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          supplier_id: string;
        };
        Insert: {
          business_day_id?: string | null;
          business_id: string;
          created_at?: string;
          created_by: string;
          currency: Database["public"]["Enums"]["transaction_currency"];
          description?: string | null;
          destination_location_id?: string | null;
          due_date?: string | null;
          entry_origin: string;
          id?: string;
          inventory_cost_ron: number;
          inventory_cost_usd?: number | null;
          opening_batch_id?: string | null;
          original_amount: number;
          purchase_date: string;
          purchase_exchange_rate?: number | null;
          record_mode?: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          supplier_id: string;
        };
        Update: {
          business_day_id?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: Database["public"]["Enums"]["transaction_currency"];
          description?: string | null;
          destination_location_id?: string | null;
          due_date?: string | null;
          entry_origin?: string;
          id?: string;
          inventory_cost_ron?: number;
          inventory_cost_usd?: number | null;
          opening_batch_id?: string | null;
          original_amount?: number;
          purchase_date?: string;
          purchase_exchange_rate?: number | null;
          record_mode?: string;
          reversal_of_id?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          supplier_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_batch_business_fkey";
            columns: ["business_id", "opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_opening_batch_id_fkey";
            columns: ["opening_batch_id"];
            isOneToOne: false;
            referencedRelation: "opening_balance_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchase_summaries";
            referencedColumns: ["purchase_id"];
          },
          {
            foreignKeyName: "supplier_purchases_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["business_id", "supplier_id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          business_id: string;
          created_at: string;
          created_by: string;
          default_currency:
            Database["public"]["Enums"]["transaction_currency"] | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          created_by: string;
          default_currency?:
            Database["public"]["Enums"]["transaction_currency"] | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          created_by?: string;
          default_currency?:
            Database["public"]["Enums"]["transaction_currency"] | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      audit_log_summaries: {
        Row: {
          action: string | null;
          actor_name: string | null;
          actor_user_id: string | null;
          business_date: string | null;
          business_id: string | null;
          created_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string | null;
          new_data: Json | null;
          previous_data: Json | null;
          reason: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_day_credit_sales: {
        Row: {
          business_date: string | null;
          business_day_id: string | null;
          business_id: string | null;
          credit_sales_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_days_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_position_snapshot_summaries: {
        Row: {
          bank_ron: string | null;
          business_id: string | null;
          cash_ron: string | null;
          created_at: string | null;
          created_by: string | null;
          customer_receivables_ron: string | null;
          estimated_supplier_payables_ron: string | null;
          estimated_usd_payables_ron: string | null;
          id: string | null;
          net_business_value_ron: string | null;
          shop_inventory_ron: string | null;
          snapshot_date: string | null;
          supplier_payables_ron: string | null;
          supplier_payables_usd: string | null;
          total_assets_ron: string | null;
          usd_ron_rate: string | null;
          warehouse_inventory_ron: string | null;
        };
        Insert: {
          bank_ron?: never;
          business_id?: string | null;
          cash_ron?: never;
          created_at?: string | null;
          created_by?: string | null;
          customer_receivables_ron?: never;
          estimated_supplier_payables_ron?: never;
          estimated_usd_payables_ron?: never;
          id?: string | null;
          net_business_value_ron?: never;
          shop_inventory_ron?: never;
          snapshot_date?: string | null;
          supplier_payables_ron?: never;
          supplier_payables_usd?: never;
          total_assets_ron?: never;
          usd_ron_rate?: never;
          warehouse_inventory_ron?: never;
        };
        Update: {
          bank_ron?: never;
          business_id?: string | null;
          cash_ron?: never;
          created_at?: string | null;
          created_by?: string | null;
          customer_receivables_ron?: never;
          estimated_supplier_payables_ron?: never;
          estimated_usd_payables_ron?: never;
          id?: string | null;
          net_business_value_ron?: never;
          shop_inventory_ron?: never;
          snapshot_date?: string | null;
          supplier_payables_ron?: never;
          supplier_payables_usd?: never;
          total_assets_ron?: never;
          usd_ron_rate?: never;
          warehouse_inventory_ron?: never;
        };
        Relationships: [
          {
            foreignKeyName: "business_position_snapshots_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      currency_reference_rate_summaries: {
        Row: {
          base_currency: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          effective_date: string | null;
          id: string | null;
          quote_currency: string | null;
          rate: string | null;
        };
        Insert: {
          base_currency?: string | null;
          business_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string | null;
          quote_currency?: string | null;
          rate?: never;
        };
        Update: {
          base_currency?: string | null;
          business_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string | null;
          quote_currency?: string | null;
          rate?: never;
        };
        Relationships: [
          {
            foreignKeyName: "currency_reference_rates_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_credit_purchase_balances: {
        Row: {
          allocated_ron: string | null;
          amount_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          customer_id: string | null;
          derived_status: string | null;
          description: string | null;
          due_date: string | null;
          entry_origin: string | null;
          purchase_date: string | null;
          purchase_id: string | null;
          remaining_ron: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_credit_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_credit_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
        ];
      };
      customer_payment_allocation_details: {
        Row: {
          allocation_id: string | null;
          amount_ron: string | null;
          business_id: string | null;
          created_at: string | null;
          customer_id: string | null;
          payment_id: string | null;
          payment_reversed_at: string | null;
          purchase_date: string | null;
          purchase_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payment_allocations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_customer_credit_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchase_balances";
            referencedColumns: ["purchase_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_customer_credit_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_customer_credit_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["customer_credit_purchase_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_business_fkey";
            columns: ["business_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payment_summaries";
            referencedColumns: ["business_id", "payment_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_business_fkey";
            columns: ["business_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payment_summaries";
            referencedColumns: ["payment_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "customer_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchase_balances";
            referencedColumns: ["business_id", "purchase_id"];
          },
          {
            foreignKeyName: "customer_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "purchase_id"];
            isOneToOne: false;
            referencedRelation: "customer_credit_purchases";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_payment_summaries: {
        Row: {
          allocated_ron: string | null;
          allocation_strategy: string | null;
          amount_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          customer_id: string | null;
          derived_status: string | null;
          entry_origin: string | null;
          financial_account_id: string | null;
          financial_account_name: string | null;
          financial_account_type:
            Database["public"]["Enums"]["financial_account_type"] | null;
          notes: string | null;
          payment_date: string | null;
          payment_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "customer_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "customer_payments_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["customer_id"];
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "customer_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "customer_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "customer_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_receivable_balances: {
        Row: {
          business_id: string | null;
          customer_id: string | null;
          name: string | null;
          outstanding_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_net_revenue_summaries: {
        Row: {
          bank_sales_ron: string | null;
          business_date: string | null;
          business_day_id: string | null;
          business_id: string | null;
          cash_sales_ron: string | null;
          credit_sales_ron: string | null;
          returns_ron: string | null;
          status: Database["public"]["Enums"]["daily_sales_status"] | null;
          total_sales_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
        ];
      };
      daily_product_sales_summaries: {
        Row: {
          bank_amount_ron: string | null;
          business_date: string | null;
          business_day_id: string | null;
          business_id: string | null;
          cash_amount_ron: string | null;
          credit_amount_ron: string | null;
          gross_profit_ron: string | null;
          profit_percent: string | null;
          sale_count: number | null;
          total_amount_ron: string | null;
          total_cost_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_days_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_sales_summaries: {
        Row: {
          active_closure_id: string | null;
          bank_sales_ron: string | null;
          business_date: string | null;
          business_day_id: string | null;
          business_id: string | null;
          cash_sales_ron: string | null;
          close_sequence: number | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string | null;
          created_by: string | null;
          credit_sales_ron: string | null;
          daily_sales_id: string | null;
          last_draft_at: string | null;
          last_draft_by: string | null;
          last_draft_by_name: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["daily_sales_status"] | null;
          total_sales_ron: string | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "daily_sales_active_closure_business_fkey";
            columns: ["business_id", "active_closure_id"];
            isOneToOne: false;
            referencedRelation: "daily_sales_closures";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "daily_sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: true;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
        ];
      };
      damaged_stock_balances: {
        Row: {
          business_id: string | null;
          damaged_quantity: string | null;
          historical_cost_ron: string | null;
          internal_code: string | null;
          product_id: string | null;
          product_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_summaries: {
        Row: {
          amount_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          category_id: string | null;
          category_name: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          entry_origin: string | null;
          expense_date: string | null;
          expense_id: string | null;
          financial_account_id: string | null;
          financial_account_name: string | null;
          financial_account_type:
            Database["public"]["Enums"]["financial_account_type"] | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "expenses_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "expenses_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "expenses_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "expenses_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_category_business_fkey";
            columns: ["business_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "expenses_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "expenses_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "expenses_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "expenses_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_account_balances: {
        Row: {
          balance_ron: string | null;
          business_id: string | null;
          currency: string | null;
          financial_account_id: string | null;
          name: string | null;
          type: Database["public"]["Enums"]["financial_account_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "financial_accounts_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_account_daily_totals: {
        Row: {
          business_id: string | null;
          entry_count: number | null;
          entry_date: string | null;
          financial_account_id: string | null;
          financial_account_name: string | null;
          financial_account_type:
            Database["public"]["Enums"]["financial_account_type"] | null;
          inflow_ron: string | null;
          net_movement_ron: string | null;
          outflow_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "financial_account_entries_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "financial_account_entries_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "financial_account_entries_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_account_entry_summaries: {
        Row: {
          amount_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          direction:
            Database["public"]["Enums"]["financial_entry_direction"] | null;
          entry_date: string | null;
          entry_id: string | null;
          entry_type: string | null;
          financial_account_id: string | null;
          financial_account_name: string | null;
          financial_account_type:
            Database["public"]["Enums"]["financial_account_type"] | null;
          idempotency_key: string | null;
          reversal_of_id: string | null;
          signed_amount_ron: string | null;
          source_entity_id: string | null;
          source_entity_type: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "financial_account_entries_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "financial_account_entries_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "financial_account_entries_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "financial_account_entries_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "financial_account_entries_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_account_entries_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_entry_summaries";
            referencedColumns: ["entry_id"];
          },
        ];
      };
      inventory_exception_summaries: {
        Row: {
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          created_by_name: string | null;
          exception_date: string | null;
          exception_type: string | null;
          inventory_exception_id: string | null;
          product_code: string | null;
          product_id: string | null;
          product_name: string | null;
          quantity: string | null;
          reason: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          source_location_id: string | null;
          source_location_name: string | null;
          source_location_type:
            Database["public"]["Enums"]["inventory_location_type"] | null;
          status: string | null;
          total_cost_ron: string | null;
          unit_cost_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_exceptions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_exceptions_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_exceptions_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_exceptions_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      inventory_location_balances: {
        Row: {
          balance_ron: string | null;
          business_id: string | null;
          inventory_location_id: string | null;
          name: string | null;
          type: Database["public"]["Enums"]["inventory_location_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_locations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_stocktake_summaries: {
        Row: {
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          notes: string | null;
          reason: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          shop_actual_value_ron: string | null;
          shop_difference_ron: string | null;
          shop_expected_value_ron: string | null;
          status: string | null;
          stocktake_date: string | null;
          stocktake_id: string | null;
          warehouse_actual_value_ron: string | null;
          warehouse_difference_ron: string | null;
          warehouse_expected_value_ron: string | null;
        };
        Insert: {
          business_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          notes?: string | null;
          reason?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          shop_actual_value_ron?: never;
          shop_difference_ron?: never;
          shop_expected_value_ron?: never;
          status?: never;
          stocktake_date?: string | null;
          stocktake_id?: string | null;
          warehouse_actual_value_ron?: never;
          warehouse_difference_ron?: never;
          warehouse_expected_value_ron?: never;
        };
        Update: {
          business_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          notes?: string | null;
          reason?: string | null;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          shop_actual_value_ron?: never;
          shop_difference_ron?: never;
          shop_expected_value_ron?: never;
          status?: never;
          stocktake_date?: string | null;
          stocktake_id?: string | null;
          warehouse_actual_value_ron?: never;
          warehouse_difference_ron?: never;
          warehouse_expected_value_ron?: never;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_stocktakes_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_transfer_line_summaries: {
        Row: {
          business_id: string | null;
          inventory_transfer_id: string | null;
          line_id: string | null;
          line_number: number | null;
          line_total_ron: string | null;
          product_code: string | null;
          product_id: string | null;
          product_name: string | null;
          quantity: string | null;
          unit_cost_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["business_id", "reversal_movement_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["business_id", "transfer_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movement_summaries";
            referencedColumns: ["business_id", "movement_id"];
          },
          {
            foreignKeyName: "inventory_transfer_lines_transfer_business_fkey";
            columns: ["business_id", "inventory_transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movements";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      inventory_transfer_summaries: {
        Row: {
          amount_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          destination_location_id: string | null;
          destination_location_name: string | null;
          entry_origin: string | null;
          notes: string | null;
          product_line_count: number | null;
          reversal_movement_id: string | null;
          source_location_id: string | null;
          source_location_name: string | null;
          status: string | null;
          transfer_date: string | null;
          transfer_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
        ];
      };
      inventory_value_movement_summaries: {
        Row: {
          amount_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          destination_location_id: string | null;
          entry_origin: string | null;
          idempotency_key: string | null;
          movement_date: string | null;
          movement_id: string | null;
          movement_type: string | null;
          notes: string | null;
          reversal_of_id: string | null;
          source_entity_id: string | null;
          source_entity_type: string | null;
          source_location_id: string | null;
        };
        Insert: {
          amount_ron?: never;
          business_day_id?: string | null;
          business_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          destination_location_id?: string | null;
          entry_origin?: string | null;
          idempotency_key?: string | null;
          movement_date?: string | null;
          movement_id?: string | null;
          movement_type?: string | null;
          notes?: string | null;
          reversal_of_id?: string | null;
          source_entity_id?: string | null;
          source_entity_type?: string | null;
          source_location_id?: string | null;
        };
        Update: {
          amount_ron?: never;
          business_day_id?: string | null;
          business_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          destination_location_id?: string | null;
          entry_origin?: string | null;
          idempotency_key?: string | null;
          movement_date?: string | null;
          movement_id?: string | null;
          movement_type?: string | null;
          notes?: string | null;
          reversal_of_id?: string | null;
          source_entity_id?: string | null;
          source_entity_type?: string | null;
          source_location_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["reversal_movement_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_transfer_summaries";
            referencedColumns: ["transfer_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movement_summaries";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "inventory_value_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "inventory_value_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
        ];
      };
      monthly_expense_summaries: {
        Row: {
          business_id: string | null;
          category_id: string | null;
          category_name: string | null;
          expense_count: number | null;
          month_start: string | null;
          total_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_category_business_fkey";
            columns: ["business_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      opening_balance_summaries: {
        Row: {
          bank_balance_ron: string | null;
          business_id: string | null;
          cash_balance_ron: string | null;
          created_at: string | null;
          created_by: string | null;
          customer_receivable_count: number | null;
          id: string | null;
          opening_date: string | null;
          shop_inventory_ron: string | null;
          supplier_payable_count: number | null;
          warehouse_inventory_ron: string | null;
        };
        Insert: {
          bank_balance_ron?: never;
          business_id?: string | null;
          cash_balance_ron?: never;
          created_at?: string | null;
          created_by?: string | null;
          customer_receivable_count?: never;
          id?: string | null;
          opening_date?: string | null;
          shop_inventory_ron?: never;
          supplier_payable_count?: never;
          warehouse_inventory_ron?: never;
        };
        Update: {
          bank_balance_ron?: never;
          business_id?: string | null;
          cash_balance_ron?: never;
          created_at?: string | null;
          created_by?: string | null;
          customer_receivable_count?: never;
          id?: string | null;
          opening_date?: string | null;
          shop_inventory_ron?: never;
          supplier_payable_count?: never;
          warehouse_inventory_ron?: never;
        };
        Relationships: [
          {
            foreignKeyName: "opening_balance_batches_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      product_inventory_analysis_current: {
        Row: {
          average_unit_cost_ron: string | null;
          business_id: string | null;
          category_id: string | null;
          category_name: string | null;
          cost_is_complete: boolean | null;
          internal_code: string | null;
          inventory_value_ron: string | null;
          is_low_stock: boolean | null;
          location_id: string | null;
          location_name: string | null;
          location_type:
            Database["public"]["Enums"]["inventory_location_type"] | null;
          minimum_quantity: string | null;
          product_id: string | null;
          product_is_active: boolean | null;
          product_name: string | null;
          quantity: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_business_fkey";
            columns: ["business_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      product_sales_daily_analysis: {
        Row: {
          activity_date: string | null;
          business_id: string | null;
          category_id: string | null;
          category_name: string | null;
          gross_margin_percent: string | null;
          gross_margin_ron: string | null;
          gross_sales_ron: string | null;
          historical_cost_ron: string | null;
          internal_code: string | null;
          net_quantity: string | null;
          net_revenue_ron: string | null;
          product_id: string | null;
          product_name: string | null;
          refunds_ron: string | null;
          return_count: number | null;
          returned_quantity: string | null;
          sale_count: number | null;
          sold_quantity: string | null;
        };
        Relationships: [];
      };
      product_stock_by_location: {
        Row: {
          business_id: string | null;
          category_id: string | null;
          category_name: string | null;
          internal_code: string | null;
          location_id: string | null;
          location_name: string | null;
          location_type:
            Database["public"]["Enums"]["inventory_location_type"] | null;
          product_id: string | null;
          product_is_active: boolean | null;
          product_name: string | null;
          quantity: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_business_fkey";
            columns: ["business_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      product_stock_valuation_by_location: {
        Row: {
          average_unit_cost_ron: string | null;
          average_unit_cost_usd: string | null;
          business_id: string | null;
          category_id: string | null;
          category_name: string | null;
          cost_is_complete: boolean | null;
          internal_code: string | null;
          inventory_value_ron: string | null;
          inventory_value_usd: string | null;
          location_id: string | null;
          location_name: string | null;
          location_type:
            Database["public"]["Enums"]["inventory_location_type"] | null;
          product_id: string | null;
          product_is_active: boolean | null;
          product_name: string | null;
          quantity: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_business_fkey";
            columns: ["business_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      returnable_sale_line_summaries: {
        Row: {
          business_id: string | null;
          credit_available_ron: string | null;
          customer_id: string | null;
          customer_name: string | null;
          original_credit_ron: string | null;
          product_code: string | null;
          product_id: string | null;
          product_name: string | null;
          returnable_quantity: string | null;
          returned_quantity: string | null;
          sale_date: string | null;
          sale_id: string | null;
          sale_line_id: string | null;
          sale_number: number | null;
          shop_location_id: string | null;
          shop_location_name: string | null;
          sold_quantity: string | null;
          unit_cost_ron: string | null;
          unit_selling_price_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "sales_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sales_shop_business_fkey";
            columns: ["business_id", "shop_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "sales_shop_business_fkey";
            columns: ["business_id", "shop_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      sale_line_summaries: {
        Row: {
          business_id: string | null;
          gross_profit_ron: string | null;
          line_cost_ron: string | null;
          line_id: string | null;
          line_number: number | null;
          line_total_ron: string | null;
          product_code: string | null;
          product_id: string | null;
          product_name: string | null;
          profit_percent: string | null;
          quantity: string | null;
          sale_id: string | null;
          unit_cost_ron: string | null;
          unit_selling_price_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_lines_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "returnable_sale_line_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_lines_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_lines_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      sale_return_line_summaries: {
        Row: {
          business_id: string | null;
          disposition: string | null;
          line_cost_ron: string | null;
          line_id: string | null;
          line_number: number | null;
          line_refund_ron: string | null;
          product_code: string | null;
          product_id: string | null;
          product_name: string | null;
          quantity: string | null;
          sale_line_id: string | null;
          sale_return_id: string | null;
          unit_cost_ron: string | null;
          unit_refund_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_return_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "sale_return_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_return_lines_return_business_fkey";
            columns: ["business_id", "sale_return_id"];
            isOneToOne: false;
            referencedRelation: "sale_return_summaries";
            referencedColumns: ["business_id", "sale_return_id"];
          },
          {
            foreignKeyName: "sale_return_lines_return_business_fkey";
            columns: ["business_id", "sale_return_id"];
            isOneToOne: false;
            referencedRelation: "sale_returns";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_return_lines_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: false;
            referencedRelation: "returnable_sale_line_summaries";
            referencedColumns: ["sale_line_id"];
          },
          {
            foreignKeyName: "sale_return_lines_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: false;
            referencedRelation: "sale_line_summaries";
            referencedColumns: ["line_id"];
          },
          {
            foreignKeyName: "sale_return_lines_sale_line_id_fkey";
            columns: ["sale_line_id"];
            isOneToOne: false;
            referencedRelation: "sale_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_return_summaries: {
        Row: {
          bank_refund_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          cash_refund_ron: string | null;
          created_at: string | null;
          created_by: string | null;
          created_by_name: string | null;
          credit_reduction_ron: string | null;
          customer_id: string | null;
          customer_name: string | null;
          reason: string | null;
          return_date: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          sale_id: string | null;
          sale_number: number | null;
          sale_return_id: string | null;
          status: string | null;
          total_cost_ron: string | null;
          total_refund_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_returns_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_returns_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "sale_returns_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_returns_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sale_returns_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sale_returns_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sale_returns_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "returnable_sale_line_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_returns_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sale_summaries";
            referencedColumns: ["business_id", "sale_id"];
          },
          {
            foreignKeyName: "sale_returns_sale_business_fkey";
            columns: ["business_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      sale_summaries: {
        Row: {
          bank_amount_ron: string | null;
          business_day_id: string | null;
          business_id: string | null;
          cash_amount_ron: string | null;
          created_at: string | null;
          created_by: string | null;
          created_by_name: string | null;
          credit_amount_ron: string | null;
          customer_credit_purchase_id: string | null;
          customer_id: string | null;
          customer_name: string | null;
          gross_profit_ron: string | null;
          notes: string | null;
          profit_percent: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          sale_date: string | null;
          sale_id: string | null;
          sale_number: number | null;
          shop_location_id: string | null;
          shop_location_name: string | null;
          status: string | null;
          total_amount_ron: string | null;
          total_cost_ron: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_receivable_balances";
            referencedColumns: ["business_id", "customer_id"];
          },
          {
            foreignKeyName: "sales_customer_business_fkey";
            columns: ["business_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "sales_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "sales_shop_business_fkey";
            columns: ["business_id", "shop_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "sales_shop_business_fkey";
            columns: ["business_id", "shop_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      stock_movement_summaries: {
        Row: {
          business_date: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          created_by_name: string | null;
          destination_location_id: string | null;
          destination_location_name: string | null;
          movement_id: string | null;
          movement_type:
            Database["public"]["Enums"]["stock_movement_type"] | null;
          negative_stock_override: boolean | null;
          notes: string | null;
          override_reason: string | null;
          product_code: string | null;
          product_id: string | null;
          product_name: string | null;
          quantity: string | null;
          reference_id: string | null;
          reference_type: string | null;
          reversal_movement_id: string | null;
          reversal_of_id: string | null;
          source_location_id: string | null;
          source_location_name: string | null;
          status: string | null;
          unit_cost_ron: string | null;
          unit_cost_usd: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "stock_movements_business_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_business_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "stock_movements_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_destination_location_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "stock_movements_destination_location_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "stock_movements_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "stock_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "stock_movement_summaries";
            referencedColumns: ["reversal_movement_id"];
          },
          {
            foreignKeyName: "stock_movements_reversal_of_id_fkey";
            columns: ["reversal_of_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_source_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "stock_movements_source_location_business_fkey";
            columns: ["business_id", "source_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      supplier_payable_balances: {
        Row: {
          business_id: string | null;
          currency: Database["public"]["Enums"]["transaction_currency"] | null;
          historical_ron_amount: string | null;
          name: string | null;
          outstanding_original_amount: string | null;
          supplier_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_payment_allocation_details: {
        Row: {
          actual_ron_value: string | null;
          allocated_original_amount: string | null;
          allocation_id: string | null;
          business_id: string | null;
          created_at: string | null;
          currency: Database["public"]["Enums"]["transaction_currency"] | null;
          currency_gain_loss_ron: string | null;
          historical_ron_value: string | null;
          payment_id: string | null;
          payment_reversed_at: string | null;
          purchase_date: string | null;
          purchase_id: string | null;
          supplier_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_payment_business_fkey";
            columns: ["business_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payment_summaries";
            referencedColumns: ["business_id", "payment_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_payment_business_fkey";
            columns: ["business_id", "payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payments";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchase_summaries";
            referencedColumns: ["business_id", "purchase_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_purchase_business_fkey";
            columns: ["business_id", "purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchases";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payment_summaries";
            referencedColumns: ["payment_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchase_summaries";
            referencedColumns: ["purchase_id"];
          },
          {
            foreignKeyName: "supplier_payment_allocations_supplier_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_payment_summaries: {
        Row: {
          actual_amount_ron: string | null;
          allocation_strategy: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          currency: Database["public"]["Enums"]["transaction_currency"] | null;
          currency_gain_loss_ron: string | null;
          derived_status: string | null;
          entry_origin: string | null;
          financial_account_id: string | null;
          financial_account_name: string | null;
          financial_account_type:
            Database["public"]["Enums"]["financial_account_type"] | null;
          notes: string | null;
          original_amount_paid: string | null;
          payment_date: string | null;
          payment_exchange_rate: string | null;
          payment_id: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          supplier_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["business_id", "financial_account_id"];
          },
          {
            foreignKeyName: "supplier_payments_account_business_fkey";
            columns: ["business_id", "financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payments_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_account_balances";
            referencedColumns: ["financial_account_id"];
          },
          {
            foreignKeyName: "supplier_payments_financial_account_id_fkey";
            columns: ["financial_account_id"];
            isOneToOne: false;
            referencedRelation: "financial_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["business_id", "supplier_id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_purchase_line_summaries: {
        Row: {
          business_id: string | null;
          line_id: string | null;
          line_number: number | null;
          line_total_ron: string | null;
          line_total_usd: string | null;
          product_code: string | null;
          product_id: string | null;
          product_name: string | null;
          purchase_exchange_rate: string | null;
          quantity: string | null;
          supplier_purchase_id: string | null;
          unit_cost_ron: string | null;
          unit_cost_usd: string | null;
          unit_price_original_currency: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_purchase_lines_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "damaged_stock_balances";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["business_id", "product_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_product_business_fkey";
            columns: ["business_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_purchase_business_fkey";
            columns: ["business_id", "supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchase_summaries";
            referencedColumns: ["business_id", "purchase_id"];
          },
          {
            foreignKeyName: "supplier_purchase_lines_purchase_business_fkey";
            columns: ["business_id", "supplier_purchase_id"];
            isOneToOne: false;
            referencedRelation: "supplier_purchases";
            referencedColumns: ["business_id", "id"];
          },
        ];
      };
      supplier_purchase_summaries: {
        Row: {
          allocated_original_amount: string | null;
          business_day_id: string | null;
          business_id: string | null;
          created_at: string | null;
          created_by: string | null;
          currency: Database["public"]["Enums"]["transaction_currency"] | null;
          derived_status: string | null;
          description: string | null;
          destination_location_id: string | null;
          destination_location_name: string | null;
          destination_location_type:
            Database["public"]["Enums"]["inventory_location_type"] | null;
          due_date: string | null;
          entry_origin: string | null;
          inventory_cost_ron: string | null;
          inventory_cost_usd: string | null;
          original_amount: string | null;
          product_line_count: number | null;
          purchase_date: string | null;
          purchase_exchange_rate: string | null;
          purchase_id: string | null;
          record_mode: string | null;
          remaining_historical_ron: string | null;
          remaining_original_amount: string | null;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          supplier_id: string | null;
          supplier_name: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_business_day_id_fkey";
            columns: ["business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_day_credit_sales";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "business_days";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_day_business_fkey";
            columns: ["business_id", "business_day_id"];
            isOneToOne: false;
            referencedRelation: "daily_product_sales_summaries";
            referencedColumns: ["business_id", "business_day_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["business_id", "inventory_location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_business_fkey";
            columns: ["business_id", "destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_location_balances";
            referencedColumns: ["inventory_location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "inventory_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_inventory_analysis_current";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_valuation_by_location";
            referencedColumns: ["location_id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["business_id", "supplier_id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_business_fkey";
            columns: ["business_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["business_id", "id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "supplier_payable_balances";
            referencedColumns: ["supplier_id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      add_business_employee: {
        Args: { target_business_id: string; target_user_id: string };
        Returns: undefined;
      };
      clear_auth_rate_limit: {
        Args: { target_identifier: string; target_scope: string };
        Returns: undefined;
      };
      close_business_day: {
        Args: { target_business_day_id: string; target_business_id: string };
        Returns: undefined;
      };
      close_daily_sales: {
        Args: { target_business_id: string; target_daily_sales_id: string };
        Returns: string;
      };
      consume_auth_rate_limit: {
        Args: { target_identifier: string; target_scope: string };
        Returns: number;
      };
      create_business_day: {
        Args: { target_business_date: string; target_business_id: string };
        Returns: string;
      };
      create_business_foundation: {
        Args: { business_name: string; business_timezone?: string };
        Returns: string;
      };
      create_customer: {
        Args: {
          target_business_id: string;
          target_name: string;
          target_notes?: string;
          target_phone?: string;
        };
        Returns: string;
      };
      create_customer_credit_purchase: {
        Args: {
          target_amount_ron: string;
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_customer_id: string;
          target_description?: string;
          target_due_date?: string;
        };
        Returns: string;
      };
      create_customer_credit_purchase_idempotent: {
        Args: {
          target_amount_ron: string;
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_customer_id: string;
          target_description?: string;
          target_due_date?: string;
          target_idempotency_key: string;
        };
        Returns: string;
      };
      create_customer_payment: {
        Args: {
          target_allocation_strategy?: string;
          target_amount_ron: string;
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_customer_id: string;
          target_financial_account_id: string;
          target_idempotency_key: string;
          target_manual_allocations?: Json;
          target_notes?: string;
        };
        Returns: string;
      };
      create_expense: {
        Args: {
          target_amount_ron: string;
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_category_id: string;
          target_description: string;
          target_financial_account_id: string;
          target_idempotency_key: string;
        };
        Returns: string;
      };
      create_inventory_exception: {
        Args: {
          target_business_day_id: string;
          target_business_id: string;
          target_exception_type: string;
          target_idempotency_key: string;
          target_product_id: string;
          target_quantity: string;
          target_reason: string;
          target_source_location_id: string;
        };
        Returns: string;
      };
      create_inventory_product_transfer: {
        Args: {
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_destination_location_id: string;
          target_idempotency_key: string;
          target_lines: Json;
          target_notes?: string;
          target_source_location_id: string;
        };
        Returns: string;
      };
      create_inventory_stocktake: {
        Args: {
          target_business_id: string;
          target_idempotency_key: string;
          target_notes: string;
          target_reason: string;
          target_shop_actual_value_ron: string;
          target_stocktake_date: string;
          target_warehouse_actual_value_ron: string;
        };
        Returns: string;
      };
      create_inventory_value_transfer: {
        Args: {
          target_amount_ron: string;
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_destination_location_id: string;
          target_idempotency_key: string;
          target_notes: string;
          target_source_location_id: string;
        };
        Returns: string;
      };
      create_opening_balance: {
        Args: {
          target_bank_balance_ron: string;
          target_business_id: string;
          target_cash_balance_ron: string;
          target_customer_receivables?: Json;
          target_opening_date: string;
          target_shop_inventory_ron: string;
          target_supplier_payables?: Json;
          target_warehouse_inventory_ron: string;
        };
        Returns: string;
      };
      create_product: {
        Args: {
          target_business_id: string;
          target_category_id: string;
          target_default_purchase_cost_ron?: string;
          target_default_selling_price_ron?: string;
          target_internal_code: string;
          target_name: string;
        };
        Returns: string;
      };
      create_product_category: {
        Args: { target_business_id: string; target_name: string };
        Returns: string;
      };
      create_product_sale: {
        Args: {
          target_bank_amount_ron: string;
          target_business_day_id: string;
          target_business_id: string;
          target_cash_amount_ron: string;
          target_credit_amount_ron: string;
          target_customer_id?: string;
          target_idempotency_key: string;
          target_lines: Json;
          target_notes?: string;
          target_shop_location_id: string;
        };
        Returns: string;
      };
      create_product_with_cost_currency: {
        Args: {
          target_business_id: string;
          target_category_id: string;
          target_default_purchase_cost: string;
          target_default_purchase_currency: Database["public"]["Enums"]["transaction_currency"];
          target_default_purchase_exchange_rate: string;
          target_default_selling_price_ron?: string;
          target_internal_code: string;
          target_name: string;
        };
        Returns: string;
      };
      create_product_with_currency: {
        Args: {
          target_business_id: string;
          target_category_id: string;
          target_default_purchase_cost: string;
          target_default_purchase_currency: Database["public"]["Enums"]["transaction_currency"];
          target_default_selling_price_ron?: string;
          target_internal_code: string;
          target_name: string;
        };
        Returns: string;
      };
      create_sale_return: {
        Args: {
          target_bank_refund_ron: string;
          target_business_day_id: string;
          target_business_id: string;
          target_cash_refund_ron: string;
          target_credit_reduction_ron: string;
          target_idempotency_key: string;
          target_lines: Json;
          target_reason: string;
          target_sale_id: string;
        };
        Returns: string;
      };
      create_stock_movement: {
        Args: {
          target_allow_negative?: boolean;
          target_business_day_id?: string;
          target_business_id: string;
          target_destination_location_id?: string;
          target_idempotency_key: string;
          target_movement_type: string;
          target_notes?: string;
          target_override_reason?: string;
          target_product_id: string;
          target_quantity: string;
          target_reference_id: string;
          target_reference_type: string;
          target_source_location_id?: string;
          target_unit_cost_ron?: string;
        };
        Returns: string;
      };
      create_stock_movement_with_cost: {
        Args: {
          target_allow_negative?: boolean;
          target_business_day_id?: string;
          target_business_id: string;
          target_destination_location_id?: string;
          target_exchange_rate?: string;
          target_idempotency_key: string;
          target_movement_type: string;
          target_notes?: string;
          target_override_reason?: string;
          target_product_id: string;
          target_quantity: string;
          target_reference_id: string;
          target_reference_type: string;
          target_source_location_id?: string;
          target_unit_cost?: string;
          target_unit_cost_currency?: Database["public"]["Enums"]["transaction_currency"];
        };
        Returns: string;
      };
      create_supplier: {
        Args: {
          target_business_id: string;
          target_default_currency?: string;
          target_name: string;
          target_notes?: string;
          target_phone?: string;
        };
        Returns: string;
      };
      create_supplier_payment: {
        Args: {
          target_allocation_strategy?: string;
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_currency: string;
          target_financial_account_id: string;
          target_idempotency_key: string;
          target_manual_allocations?: Json;
          target_notes?: string;
          target_original_amount_paid: string;
          target_payment_exchange_rate: string;
          target_supplier_id: string;
        };
        Returns: string;
      };
      create_supplier_purchase: {
        Args: {
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_currency: string;
          target_description?: string;
          target_destination_location_id: string;
          target_due_date?: string;
          target_original_amount: string;
          target_purchase_exchange_rate: string;
          target_supplier_id: string;
        };
        Returns: string;
      };
      create_supplier_purchase_idempotent: {
        Args: {
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_currency: string;
          target_description?: string;
          target_destination_location_id: string;
          target_due_date?: string;
          target_idempotency_key: string;
          target_original_amount: string;
          target_purchase_exchange_rate: string;
          target_supplier_id: string;
        };
        Returns: string;
      };
      create_supplier_purchase_with_lines_idempotent: {
        Args: {
          target_audit_reason?: string;
          target_business_day_id: string;
          target_business_id: string;
          target_currency: string;
          target_description?: string;
          target_destination_location_id: string;
          target_due_date?: string;
          target_idempotency_key: string;
          target_lines: Json;
          target_purchase_exchange_rate: string;
          target_supplier_id: string;
        };
        Returns: string;
      };
      deactivate_customer: {
        Args: { target_business_id: string; target_customer_id: string };
        Returns: undefined;
      };
      deactivate_product: {
        Args: { target_business_id: string; target_product_id: string };
        Returns: undefined;
      };
      deactivate_product_category: {
        Args: { target_business_id: string; target_category_id: string };
        Returns: undefined;
      };
      deactivate_supplier: {
        Args: { target_business_id: string; target_supplier_id: string };
        Returns: undefined;
      };
      ensure_current_business_day: {
        Args: { target_business_id: string };
        Returns: string;
      };
      import_products: {
        Args: {
          target_business_id: string;
          target_idempotency_key: string;
          target_rows: Json;
        };
        Returns: number;
      };
      record_usd_ron_reference_rate: {
        Args: {
          target_business_id: string;
          target_effective_date: string;
          target_rate: string;
        };
        Returns: string;
      };
      reopen_business_day: {
        Args: {
          target_business_day_id: string;
          target_business_id: string;
          target_reason: string;
        };
        Returns: undefined;
      };
      reverse_customer_credit_purchase: {
        Args: {
          target_business_id: string;
          target_purchase_id: string;
          target_reason: string;
        };
        Returns: undefined;
      };
      reverse_customer_payment: {
        Args: {
          target_business_id: string;
          target_payment_id: string;
          target_reason: string;
        };
        Returns: undefined;
      };
      reverse_expense: {
        Args: {
          target_business_id: string;
          target_expense_id: string;
          target_reason: string;
        };
        Returns: undefined;
      };
      reverse_inventory_exception: {
        Args: {
          target_business_id: string;
          target_inventory_exception_id: string;
          target_reason: string;
        };
        Returns: undefined;
      };
      reverse_inventory_stocktake: {
        Args: {
          target_business_id: string;
          target_reason: string;
          target_stocktake_id: string;
        };
        Returns: undefined;
      };
      reverse_inventory_value_transfer:
        | {
            Args: {
              target_business_id: string;
              target_reason: string;
              target_transfer_id: string;
            };
            Returns: undefined;
          }
        | {
            Args: {
              target_allow_negative_stock: boolean;
              target_business_id: string;
              target_reason: string;
              target_transfer_id: string;
            };
            Returns: undefined;
          };
      reverse_opening_balance: {
        Args: {
          target_batch_id: string;
          target_business_id: string;
          target_reason: string;
        };
        Returns: undefined;
      };
      reverse_product_sale: {
        Args: {
          target_business_id: string;
          target_reason: string;
          target_sale_id: string;
        };
        Returns: undefined;
      };
      reverse_sale_return: {
        Args: {
          target_business_id: string;
          target_reason: string;
          target_sale_return_id: string;
        };
        Returns: undefined;
      };
      reverse_stock_movement: {
        Args: {
          target_allow_negative?: boolean;
          target_business_id: string;
          target_idempotency_key: string;
          target_movement_id: string;
          target_reason: string;
        };
        Returns: string;
      };
      reverse_supplier_payment: {
        Args: {
          target_business_id: string;
          target_payment_id: string;
          target_reason: string;
        };
        Returns: undefined;
      };
      reverse_supplier_purchase:
        | {
            Args: {
              target_business_id: string;
              target_purchase_id: string;
              target_reason: string;
            };
            Returns: undefined;
          }
        | {
            Args: {
              target_allow_negative_stock: boolean;
              target_business_id: string;
              target_purchase_id: string;
              target_reason: string;
            };
            Returns: undefined;
          };
      save_business_position_snapshot: {
        Args: {
          target_business_id: string;
          target_snapshot_date: string;
          target_usd_ron_rate: string;
        };
        Returns: string;
      };
      search_customers: {
        Args: {
          target_business_id: string;
          target_include_inactive?: boolean;
          target_result_limit?: number;
          target_search_text?: string;
        };
        Returns: {
          business_id: string;
          created_at: string;
          created_by: string;
          id: string;
          is_active: boolean;
          name: string;
          notes: string;
          phone: string;
          updated_at: string;
        }[];
      };
      search_products: {
        Args: {
          target_business_id: string;
          target_category_id?: string;
          target_include_inactive?: boolean;
          target_result_limit?: number;
          target_search_text?: string;
        };
        Returns: {
          business_id: string;
          category_id: string;
          category_name: string;
          created_at: string;
          created_by: string;
          default_purchase_cost_ron: string;
          default_selling_price_ron: string;
          id: string;
          internal_code: string;
          is_active: boolean;
          name: string;
          unit: string;
          updated_at: string;
        }[];
      };
      search_suppliers: {
        Args: {
          target_business_id: string;
          target_include_inactive?: boolean;
          target_result_limit?: number;
          target_search_text?: string;
        };
        Returns: {
          business_id: string;
          created_at: string;
          created_by: string;
          default_currency: Database["public"]["Enums"]["transaction_currency"];
          id: string;
          is_active: boolean;
          name: string;
          notes: string;
          phone: string;
          updated_at: string;
        }[];
      };
      set_business_employee_active: {
        Args: {
          target_active: boolean;
          target_business_id: string;
          target_user_id: string;
        };
        Returns: undefined;
      };
      set_product_stock_threshold: {
        Args: {
          target_business_id: string;
          target_inventory_location_id: string;
          target_minimum_quantity: string;
          target_product_id: string;
        };
        Returns: undefined;
      };
      update_customer: {
        Args: {
          target_business_id: string;
          target_customer_id: string;
          target_name: string;
          target_notes?: string;
          target_phone?: string;
        };
        Returns: undefined;
      };
      update_product: {
        Args: {
          target_business_id: string;
          target_category_id: string;
          target_default_purchase_cost_ron?: string;
          target_default_selling_price_ron?: string;
          target_internal_code: string;
          target_name: string;
          target_product_id: string;
        };
        Returns: undefined;
      };
      update_product_category: {
        Args: {
          target_business_id: string;
          target_category_id: string;
          target_name: string;
        };
        Returns: undefined;
      };
      update_product_with_cost_currency: {
        Args: {
          target_business_id: string;
          target_category_id: string;
          target_default_purchase_cost: string;
          target_default_purchase_currency: Database["public"]["Enums"]["transaction_currency"];
          target_default_purchase_exchange_rate: string;
          target_default_selling_price_ron?: string;
          target_internal_code: string;
          target_name: string;
          target_product_id: string;
        };
        Returns: undefined;
      };
      update_product_with_currency: {
        Args: {
          target_business_id: string;
          target_category_id: string;
          target_default_purchase_cost: string;
          target_default_purchase_currency: Database["public"]["Enums"]["transaction_currency"];
          target_default_selling_price_ron?: string;
          target_internal_code: string;
          target_name: string;
          target_product_id: string;
        };
        Returns: undefined;
      };
      update_supplier: {
        Args: {
          target_business_id: string;
          target_default_currency?: string;
          target_name: string;
          target_notes?: string;
          target_phone?: string;
          target_supplier_id: string;
        };
        Returns: undefined;
      };
      upsert_daily_sales_draft: {
        Args: {
          target_bank_sales_ron: string;
          target_business_day_id: string;
          target_business_id: string;
          target_cash_sales_ron: string;
          target_credit_sales_ron: string;
          target_notes?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      business_day_status: "open" | "closed";
      daily_sales_status: "draft" | "closed";
      financial_account_type: "cash" | "bank";
      financial_entry_direction: "inflow" | "outflow";
      inventory_location_type: "warehouse" | "shop";
      member_role: "admin" | "employee";
      stock_movement_type:
        | "opening"
        | "supplier_receipt"
        | "transfer"
        | "sale"
        | "return"
        | "damage"
        | "adjustment";
      transaction_currency: "RON" | "USD";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      business_day_status: ["open", "closed"],
      daily_sales_status: ["draft", "closed"],
      financial_account_type: ["cash", "bank"],
      financial_entry_direction: ["inflow", "outflow"],
      inventory_location_type: ["warehouse", "shop"],
      member_role: ["admin", "employee"],
      stock_movement_type: [
        "opening",
        "supplier_receipt",
        "transfer",
        "sale",
        "return",
        "damage",
        "adjustment",
      ],
      transaction_currency: ["RON", "USD"],
    },
  },
} as const;
