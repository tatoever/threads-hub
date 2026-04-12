// Auto-generated types will be placed here after Supabase project setup
// For now, define core types manually

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: Account;
        Insert: Omit<Account, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Account, "id">>;
      };
      account_tokens: {
        Row: AccountToken;
        Insert: Omit<AccountToken, "last_refreshed_at">;
        Update: Partial<AccountToken>;
      };
      account_personas: {
        Row: AccountPersona;
        Insert: Omit<AccountPersona, "updated_at">;
        Update: Partial<Omit<AccountPersona, "account_id">>;
      };
      account_prompts: {
        Row: AccountPrompt;
        Insert: Omit<AccountPrompt, "id" | "created_at">;
        Update: Partial<Omit<AccountPrompt, "id">>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, "id" | "created_at">;
        Update: Partial<Omit<Post, "id">>;
      };
      pipeline_runs: {
        Row: PipelineRun;
        Insert: Omit<PipelineRun, "id">;
        Update: Partial<Omit<PipelineRun, "id">>;
      };
      task_queue: {
        Row: TaskQueueItem;
        Insert: Omit<TaskQueueItem, "id" | "created_at">;
        Update: Partial<Omit<TaskQueueItem, "id">>;
      };
      research_results: {
        Row: ResearchResult;
        Insert: Omit<ResearchResult, "id" | "created_at">;
        Update: Partial<Omit<ResearchResult, "id">>;
      };
      research_sources: {
        Row: ResearchSource;
        Insert: Omit<ResearchSource, "id" | "created_at">;
        Update: Partial<Omit<ResearchSource, "id">>;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, "id" | "created_at">;
        Update: Partial<Omit<Comment, "id">>;
      };
      cta_destinations: {
        Row: CtaDestination;
        Insert: Omit<CtaDestination, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CtaDestination, "id">>;
      };
      cta_placements: {
        Row: CtaPlacement;
        Insert: Omit<CtaPlacement, "id" | "placed_at">;
        Update: Partial<Omit<CtaPlacement, "id">>;
      };
      post_analytics: {
        Row: PostAnalytics;
        Insert: Omit<PostAnalytics, "id" | "fetched_at">;
        Update: Partial<Omit<PostAnalytics, "id">>;
      };
      account_daily_stats: {
        Row: AccountDailyStats;
        Insert: Omit<AccountDailyStats, "id">;
        Update: Partial<Omit<AccountDailyStats, "id">>;
      };
      system_alerts: {
        Row: SystemAlert;
        Insert: Omit<SystemAlert, "id" | "created_at">;
        Update: Partial<Omit<SystemAlert, "id">>;
      };
      rate_limit_log: {
        Row: RateLimitLog;
        Insert: Omit<RateLimitLog, "id" | "recorded_at">;
        Update: Partial<Omit<RateLimitLog, "id">>;
      };
    };
  };
};

// === Core Types ===

export type AccountStatus = "setup" | "testing" | "active" | "paused";
export type ModelType = "opus" | "sonnet";
export type PostStatus = "draft" | "pending_review" | "approved" | "published" | "failed";
export type PipelinePhase = "research" | "intelligence" | "community" | "meeting" | "generate" | "publish";
export type TaskStatus = "pending" | "processing" | "completed" | "failed";
export type CtaType = "note_url" | "profile_link" | "affiliate" | "external";
export type PlacementMethod = "reply_tree" | "post_body" | "profile_mention";
export type AlertSeverity = "info" | "warning" | "critical";

export interface Account {
  id: string;
  name: string;
  slug: string;
  threads_user_id: string | null;
  instagram_account_id: string | null;
  status: AccountStatus;
  default_model: ModelType;
  schedule_offset_minutes: number;
  daily_post_target: number;
  pipeline_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccountToken {
  account_id: string;
  access_token: string;
  token_expires_at: string | null;
  refresh_token: string | null;
  last_refreshed_at: string | null;
  status: "active" | "expired" | "revoked";
}

export interface AccountPersona {
  account_id: string;
  display_name: string;
  genre: string;
  niche: string | null;
  target_audience: string | null;
  value_proposition: string | null;
  tone_style: string;
  age_range: string | null;
  gender_feel: string | null;
  background: string | null;
  prohibited_words: string[];
  reply_rules: Record<string, unknown>;
  prompt_files: Record<string, string>;
  updated_at: string;
}

export interface AccountPrompt {
  id: string;
  account_id: string | null;
  phase: PipelinePhase | "reply";
  prompt_name: string;
  system_prompt: string;
  model_preference: ModelType;
  is_active: boolean;
  version: number;
  created_at: string;
}

export interface Post {
  id: string;
  account_id: string;
  content: string;
  status: PostStatus;
  slot_number: number | null;
  scheduled_at: string | null;
  published_at: string | null;
  threads_post_id: string | null;
  metrics: Record<string, unknown>;
  pipeline_run_id: string | null;
  template_type: string | null;
  category: string | null;
  strategy_instructions: Record<string, unknown>;
  reply_1: string | null;
  reply_2: string | null;
  created_at: string;
}

export interface PipelineRun {
  id: string;
  account_id: string;
  date: string;
  phase: PipelinePhase;
  status: TaskStatus;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  model_used: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface TaskQueueItem {
  id: string;
  account_id: string;
  task_type: string;
  priority: number;
  status: TaskStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  model: ModelType;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
}

export interface ResearchResult {
  id: string;
  account_id: string;
  date: string;
  research_type: string;
  raw_data: Record<string, unknown> | null;
  analysis: Record<string, unknown> | null;
  created_at: string;
}

export interface ResearchSource {
  id: string;
  account_id: string;
  source_type: "youtube" | "web_search" | "scrape_site";
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  account_id: string;
  post_id: string | null;
  threads_comment_id: string | null;
  author_username: string | null;
  content: string | null;
  replied: boolean;
  reply_text: string | null;
  reply_status: "pending" | "approved" | "sent" | "skipped";
  created_at: string;
}

export interface CtaDestination {
  id: string;
  account_id: string;
  name: string;
  cta_type: CtaType;
  url: string;
  description: string | null;
  cta_templates: string[];
  placement_rules: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  total_placements: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CtaPlacement {
  id: string;
  account_id: string;
  post_id: string;
  destination_id: string;
  placement_method: PlacementMethod;
  cta_text: string;
  placed_at: string;
}

export interface PostAnalytics {
  id: string;
  account_id: string;
  post_id: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  engagement_rate: number | null;
  fetched_at: string;
}

export interface AccountDailyStats {
  id: string;
  account_id: string;
  date: string;
  posts_published: number;
  total_views: number;
  total_engagement: number;
  follower_count: number | null;
  follower_delta: number | null;
  cta_placements_count: number;
  pipeline_success: boolean;
}

export interface SystemAlert {
  id: string;
  account_id: string | null;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface RateLimitLog {
  id: string;
  account_id: string;
  endpoint: string;
  limit_remaining: number | null;
  limit_total: number | null;
  reset_at: string | null;
  recorded_at: string;
}
