
const TELEGRAM_API = "https://api.telegram.org";

type TelegramSendResult = {
  message_id: number;
  chat: {
    id: number;
  };
};

export async function sendTelegramMessage(
  chatId: string,
  message: string
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(
    `${TELEGRAM_API}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || `Telegram API error: ${response.status}`
    );
  }

  return result.result as TelegramSendResult;
}
