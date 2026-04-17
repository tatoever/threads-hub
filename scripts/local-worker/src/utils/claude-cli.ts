/**
 * Claude Code CLI ラッパー (threads-hub)
 *
 * threads-auto-agent の実戦稼働パターンを踏襲:
 * - CLAUDECODE 環境変数を除外してネストセッションエラー回避
 * - windowsHide: true で DLL_INIT_FAILED 回避
 * - セマフォで直列実行（同時spawn防止）
 * - 3段階 JSON 修復
 * - レート制限検知 + 指数バックオフリトライ
 */

import { spawn } from "child_process";

export type ModelType = "opus" | "sonnet";

interface ClaudeCliOptions {
  model?: ModelType;
  systemPrompt?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

interface ClaudeCliResult {
  text: string;
  model: string;
}

// ================================================================
// セマフォ（同時実行制御）
// ================================================================

class AsyncQueue {
  private running = 0;
  private queue: Array<{ resolve: () => void }> = [];

  async acquire(): Promise<void> {
    if (this.running < 1) {
      this.running++;
      return;
    }
    console.log("[claude-cli] 別のCLI実行中 → キュー待機");
    return new Promise((resolve) => this.queue.push({ resolve }));
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next.resolve();
    }
  }
}

const claudeQueue = new AsyncQueue();

// ================================================================
// レート制限リトライ
// ================================================================

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 120_000,    // 2分
  maxDelayMs: 3_600_000,   // 1時間
  backoffMultiplier: 2,
};

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /rate.?limit|too many requests|429|overloaded|capacity/i.test(msg);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_CONFIG.maxRetries) break;
      if (!isRateLimitError(error)) throw error;

      const delayMs = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
        RETRY_CONFIG.maxDelayMs
      );
      console.warn(
        `[claude-cli] レート制限検知 (${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}), ${Math.round(delayMs / 1000)}秒後にリトライ`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// ================================================================
// メイン API
// ================================================================

export async function callClaude(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<ClaudeCliResult> {
  await claudeQueue.acquire();
  try {
    const text = await withRetry(
      () => executeClaudeCli(prompt, options),
      "callClaude"
    );
    return { text, model: options.model || "opus" };
  } finally {
    claudeQueue.release();
  }
}

export async function callClaudeJson<T = any>(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<{ data: T; model: string }> {
  const result = await callClaude(prompt, { ...options, _expectJson: true } as any);
  const data = extractJson<T>(result.text);
  return { data, model: result.model };
}

// ================================================================
// CLI 実行（stdin pipe 方式）
// ================================================================

function executeClaudeCli(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<string> {
  const {
    model = "opus",
    systemPrompt,
    maxTokens,
    timeoutMs = 600_000, // 10分（おきつねさま準拠）
  } = options;

  return new Promise((resolve, reject) => {
    const expectJson = (options as any)._expectJson === true;

    const parts: string[] = [];
    if (systemPrompt) {
      parts.push("=== SYSTEM ===");
      parts.push(systemPrompt);
      parts.push("");
    }
    parts.push("=== REQUEST ===");
    parts.push(prompt);
    parts.push("");
    parts.push("=== OUTPUT ===");
    if (expectJson) {
      parts.push("以下のJSON形式のみを出力してください。説明・マークダウン・コードブロック(```)は一切不要。純粋なJSONのみ。");
    } else {
      parts.push("生成テキストのみを出力してください。説明・マークダウン・コードブロック・ステップ番号は一切不要。最終テキストのみ。");
    }
    const fullPrompt = parts.join("\n");

    // CLAUDECODE 除外（���ストセッション防止）
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const args = ["-p", "--model", model, "--output-format", "text"];
    if (maxTokens) args.push("--max-tokens", String(maxTokens));

    console.log(`[claude-cli] 実行中... (${fullPrompt.length}文字, model: ${model})`);

    const child = spawn(
      process.env.CLAUDE_CLI_PATH || "claude",
      args,
      {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      reject(new Error(`Claude CLI timeout (${timeoutMs / 1000}s)`));
    }, timeoutMs);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        if (/rate.?limit|too many requests|429|overloaded|capacity/i.test(stderr)) {
          reject(new Error(`Rate limit: ${stderr.slice(0, 300)}`));
          return;
        }
        if (!stderr.trim()) {
          reject(new Error(`Rate limit: CLI exit code ${code} with empty stderr (possible transient failure)`));
          return;
        }
        reject(new Error(`Claude CLI exit code ${code}: ${stderr.slice(0, 500)}`));
        return;
      }

      const output = stdout.trim();
      if (!output) {
        reject(new Error("Claude CLI returned empty output"));
        return;
      }

      console.log(`[claude-cli] 完了 (${output.length}文字)`);
      resolve(output);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Claude CLI spawn error: ${err.message}`));
    });

    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

// ================================================================
// JSON 抽出・修復（おきつね���ま 3段階方式）
// ================================================================

function extractJson<T>(text: string): T {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const rawJson = codeBlockMatch
    ? codeBlockMatch[1].trim()
    : (() => {
        const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) return jsonMatch[1];
        throw new Error(`JSON extraction failed: ${text.slice(0, 200)}...`);
      })();

  // Step 1: そのままパース
  try {
    return JSON.parse(rawJson) as T;
  } catch {}

  // Step 2: よくある不正パターンを修復
  const repaired = repairJson(rawJson);
  try {
    return JSON.parse(repaired) as T;
  } catch {}

  // Step 3: 積極的修復
  const aggressive = repairJsonAggressive(rawJson);
  try {
    return JSON.parse(aggressive) as T;
  } catch (e) {
    throw new Error(
      `JSON parse failed after 3-stage repair (${e instanceof Error ? e.message : ""}): ${rawJson.slice(0, 300)}...`
    );
  }
}

function repairJson(json: string): string {
  let result = json;
  result = result.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match
      .replace(/(?<!\\)\n/g, "\\n")
      .replace(/(?<!\\)\r/g, "\\r")
      .replace(/(?<!\\)\t/g, "\\t")
  );
  result = result.replace(/,\s*([\]}])/g, "$1");
  return result;
}

function repairJsonAggressive(json: string): string {
  let result = repairJson(json);
  result = result.replace(/"([^"]*?)": "([^]*?)"/g, (_match, key, value) => {
    const fixedValue = value.replace(/(?<!\\)"/g, '\\"');
    return `"${key}": "${fixedValue}"`;
  });
  return result;
}

/** @deprecated Use callClaude instead */
export async function callClaudeWithPipe(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<ClaudeCliResult> {
  return callClaude(prompt, options);
}
