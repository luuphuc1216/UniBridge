import { AI_LIMITS } from "@/lib/ai/config";

export class AiProviderError extends Error {}
export class AiNotConfiguredError extends Error {}

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function getProviderConfig() {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) throw new AiNotConfiguredError("AI chưa được cấu hình.");
  return {
    apiKey,
    url: process.env.AI_API_URL?.trim() || "https://api.openai.com/v1/chat/completions",
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
  };
}

export async function callAiJson<T>(input: {
  system: string;
  data: string;
  validate: (value: unknown) => value is T;
}): Promise<T> {
  const config = getProviderConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_LIMITS.timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          {
            role: "user",
            content: `<DATA>\n${input.data.slice(0, AI_LIMITS.maxInputChars)}\n</DATA>`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new AiProviderError("Nhà cung cấp AI đang gặp sự cố.");
    const payload = (await response.json()) as ProviderResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content || content.length > AI_LIMITS.maxOutputChars) {
      throw new AiProviderError("AI trả về kết quả không hợp lệ.");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AiProviderError("AI trả về định dạng không hợp lệ.");
    }
    if (!input.validate(parsed)) throw new AiProviderError("AI trả về dữ liệu không hợp lệ.");
    return parsed;
  } catch (error) {
    if (error instanceof AiNotConfiguredError || error instanceof AiProviderError) throw error;
    throw new AiProviderError(
      error instanceof Error && error.name === "AbortError"
        ? "AI phản hồi quá lâu. Vui lòng thử lại."
        : "Không thể kết nối dịch vụ AI lúc này.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
