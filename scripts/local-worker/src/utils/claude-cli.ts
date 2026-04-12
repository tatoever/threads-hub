import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

/**
 * Call Claude CLI (claude -p) with a prompt.
 * All AI generation MUST go through this function.
 * API direct calls are PROHIBITED.
 */
export async function callClaude(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<ClaudeCliResult> {
  const {
    model = "opus",
    systemPrompt,
    maxTokens,
    timeoutMs = 120_000,
  } = options;

  const args = ["-p", "--model", model];

  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }

  if (maxTokens) {
    args.push("--max-tokens", String(maxTokens));
  }

  try {
    const { stdout, stderr } = await execFileAsync("claude", args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env },
      shell: true,
      // Pass prompt via stdin
      input: prompt,
    } as any);

    const stdoutStr = String(stdout);
    const stderrStr = String(stderr);

    if (stderrStr.trim()) {
      console.warn(`[claude-cli] stderr: ${stderrStr.trim()}`);
    }

    return {
      text: stdoutStr.trim(),
      model,
    };
  } catch (error: any) {
    if (error.killed) {
      throw new Error(`Claude CLI timed out after ${timeoutMs}ms (model: ${model})`);
    }
    throw new Error(`Claude CLI failed (model: ${model}): ${error.message}`);
  }
}

/**
 * Call Claude CLI and parse the response as JSON.
 * Extracts JSON from the response even if surrounded by markdown fences.
 */
export async function callClaudeJson<T = any>(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<{ data: T; model: string }> {
  const result = await callClaude(prompt, options);

  // Extract JSON from markdown code fences if present
  let jsonStr = result.text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const data = JSON.parse(jsonStr) as T;
    return { data, model: result.model };
  } catch (parseError) {
    throw new Error(
      `Failed to parse Claude response as JSON (model: ${result.model}):\n${result.text.slice(0, 500)}`
    );
  }
}

/**
 * Call Claude CLI with stdin pipe (for longer prompts).
 * Uses echo + pipe instead of --input.
 */
export async function callClaudeWithPipe(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<ClaudeCliResult> {
  const {
    model = "opus",
    systemPrompt,
    timeoutMs = 180_000,
  } = options;

  const args = ["-p", "--model", model];

  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }

  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process");
    const proc = spawn("claude", args, {
      shell: true,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        return;
      }
      if (stderr.trim()) {
        console.warn(`[claude-cli] stderr: ${stderr.trim()}`);
      }
      resolve({ text: stdout.trim(), model });
    });

    proc.on("error", (err: Error) => {
      reject(new Error(`Claude CLI spawn failed: ${err.message}`));
    });

    // Write prompt to stdin and close
    proc.stdin.write(prompt);
    proc.stdin.end();

    // Timeout
    setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}
