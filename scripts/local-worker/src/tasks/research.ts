/**
 * Phase 1: Research - アカウント別リサーチ
 *
 * research_sources テーブルからソース設定を読み込み、
 * YouTube API / Web検索 / サイトスクレイプでデータ収集し、
 * Sonnet で分析・整理して research_results に保存する。
 */

import { supabase } from "../utils/supabase";
import { callClaudeJson, type ModelType } from "../utils/claude-cli";
import type { TaskData } from "../task-executor";

export async function runResearch(task: TaskData): Promise<Record<string, any>> {
  const { account_id, payload } = task;
  const date = payload.date || new Date().toISOString().split("T")[0];

  // 1. Load research sources for this account
  const { data: sources } = await supabase
    .from("research_sources")
    .select("*")
    .eq("account_id", account_id)
    .eq("is_active", true);

  if (!sources || sources.length === 0) {
    return { status: "skipped", reason: "no_active_sources" };
  }

  // 2. Load account persona for context
  const { data: persona } = await supabase
    .from("account_personas")
    .select("*")
    .eq("account_id", account_id)
    .single();

  // 3. Collect data from each source
  const collectedData: Record<string, any> = {};

  for (const source of sources) {
    try {
      switch (source.source_type) {
        case "youtube":
          collectedData.youtube = await fetchYouTubeTrends(source.config as any);
          break;
        case "web_search":
          collectedData.web_search = await fetchWebSearchTrends(source.config as any);
          break;
        case "scrape_site":
          collectedData.scrape = await fetchScrapeData(source.config as any);
          break;
      }
    } catch (err: any) {
      console.warn(`[research] Source ${source.source_type} failed: ${err.message}`);
      collectedData[`${source.source_type}_error`] = err.message;
    }
  }

  // 4. Analyze with Claude (Sonnet)
  const analysisPrompt = buildAnalysisPrompt(persona, collectedData, date);

  const { data: analysis } = await callClaudeJson(analysisPrompt, {
    model: "sonnet" as ModelType,
    systemPrompt: `あなたはSNSコンテンツリサーチャーです。収集されたデータを分析し、今日のコンテンツ制作に使えるトレンド・キーワード・ネタ候補を整理してください。JSON形式で出力してください。`,
  });

  // 5. Save to research_results
  await supabase.from("research_results").upsert({
    account_id,
    date,
    research_type: "daily_research",
    raw_data: collectedData,
    analysis,
  });

  // 6. Update pipeline_runs
  await supabase.from("pipeline_runs").upsert({
    account_id,
    date,
    phase: "research",
    status: "completed",
    output_data: analysis,
    model_used: "sonnet",
    completed_at: new Date().toISOString(),
  });

  return { status: "completed", sources_processed: sources.length };
}

// --- Data fetching functions ---

async function fetchYouTubeTrends(config: { queries: string[]; max_results?: number }) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { error: "YOUTUBE_API_KEY not set" };

  const results: any[] = [];
  const maxResults = config.max_results || 10;

  for (const query of config.queries || []) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&publishedAfter=${getWeekAgo()}&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        results.push({
          query,
          items: data.items?.map((item: any) => ({
            title: item.snippet?.title,
            channelTitle: item.snippet?.channelTitle,
            publishedAt: item.snippet?.publishedAt,
            videoId: item.id?.videoId,
          })) || [],
        });
      }
    } catch (err: any) {
      results.push({ query, error: err.message });
    }
  }

  return results;
}

async function fetchWebSearchTrends(config: { queries: string[]; focus?: string }) {
  // Claude Web Search via CLI
  const queries = config.queries || [];
  const results: any[] = [];

  for (const query of queries) {
    try {
      const { data } = await callClaudeJson(
        `以下のキーワードで最新のトレンド・話題を調べてください: "${query}"\n\nJSON形式で、以下のフィールドを含めてください:\n- trending_topics: 最新トレンド3-5個\n- hot_keywords: 注目キーワード5-10個\n- audience_mood: ターゲット層の今の関心・気分`,
        { model: "sonnet" as ModelType }
      );
      results.push({ query, data });
    } catch (err: any) {
      results.push({ query, error: err.message });
    }
  }

  return results;
}

async function fetchScrapeData(config: { url: string; extract?: string }) {
  // Simple fetch + Claude extraction
  try {
    const res = await fetch(config.url);
    if (!res.ok) return { error: `HTTP ${res.status}` };

    const html = await res.text();
    // Truncate to avoid token overflow
    const truncated = html.slice(0, 5000);

    const { data } = await callClaudeJson(
      `以下のHTMLから「${config.extract || "主要な情報"}」を抽出してJSON形式でまとめてください:\n\n${truncated}`,
      { model: "sonnet" as ModelType }
    );

    return data;
  } catch (err: any) {
    return { error: err.message };
  }
}

function buildAnalysisPrompt(
  persona: any,
  collectedData: Record<string, any>,
  date: string
): string {
  return `# リサーチデータ分析

## アカウント情報
- ジャンル: ${persona?.genre || "未設定"}
- ニッチ: ${persona?.niche || "未設定"}
- ターゲット: ${persona?.target_audience || "未設定"}

## 日付
${date}

## 収集データ
${JSON.stringify(collectedData, null, 2)}

## 出力形式（JSON）
{
  "narrative_seeds": ["今日のコンテンツの軸になりそうなネタ 3-5個"],
  "hot_keywords": ["注目キーワード 5-10個"],
  "audience_mood": "ターゲット層の今の気分・関心",
  "content_opportunities": ["投稿に使えそうな切り口 3-5個"],
  "avoid_topics": ["今日は避けたほうがいいトピック"]
}`;
}

function getWeekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}
