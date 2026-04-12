// Discord webhook notification utility

export async function notifyDiscord(
  message: string,
  options?: { severity?: "info" | "warning" | "critical" }
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const severityEmoji = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🚨",
  };

  const emoji = severityEmoji[options?.severity ?? "info"];

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${emoji} **[threads-hub]** ${message}`,
      }),
    });
  } catch (err) {
    console.error("Discord notification failed:", err);
  }
}
