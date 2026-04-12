import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type Severity = "info" | "warning" | "critical";

const EMOJI: Record<Severity, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

export async function notifyDiscord(
  message: string,
  severity: Severity = "info"
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${EMOJI[severity]} **[threads-hub]** ${message}`,
      }),
    });
  } catch (err) {
    console.error("[notify] Discord notification failed:", err);
  }
}
