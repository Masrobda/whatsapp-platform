// lib/types/prelude.ts
export interface ChannelPreferences {
  id?: string;
  client_id: string;
  preferred_channel: 'whatsapp' | 'sms';
  allow_fallback: boolean;
  opt_out_sms: boolean;
  opt_out_whatsapp: boolean;
  marketing_opt_in: boolean;
  transactional_opt_in: boolean;
  daily_message_limit: number;
  created_at?: string;
  updated_at?: string;
}

export interface PreludeMessage {
  id: string;
  recipient_phone: string;
  template_id: string;
  channel: 'whatsapp' | 'sms';
  fallback_used: boolean;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  estimated_cost: number;
  created_at: string;
  prelude_message_id?: string;
}

export interface BatchCampaign {
  id: string;
  name: string;
  template_id: string;
  template_name?: string;
  channel: string;
  total_recipients: number;
  successful: number;
  failed: number;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  schedule_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret?: string;
}
