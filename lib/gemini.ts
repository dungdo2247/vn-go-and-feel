// Shared server-only code for Cloudflare Pages Functions.
// Supports Cloudflare Workers AI (DeepSeek) as default, with fallback to Gemini.

export interface AiBinding {
  run: (model: string, inputs: Record<string, any>) => Promise<any>;
}

export interface Env {
  AI?: AiBinding;
  GEMINI_API_KEY?: string;
  [key: string]: unknown;
}

interface FunctionContext {
  request: Request;
  env: Env;
}

export interface AiRequestParams {
  systemInstruction?: string;
  userPrompt: string;
  imageBase64?: string;
  mimeType?: string;
  jsonSchema?: Record<string, any>;
}

export interface GeminiParams {
  contents: string | { parts: unknown[] };
  config?: { systemInstruction?: string; [key: string]: unknown };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY_BYTES = 25 * 1024 * 1024;

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function readBody(request: Request): Promise<Record<string, any>> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'Vui lòng gửi dữ liệu JSON.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Dữ liệu JSON không hợp lệ.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'Dữ liệu quá lớn. Giới hạn là 25 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    for (const field of ['destination', 'duration', 'companions', 'preferences', 'budget', 'imageBase64', 'mimeType', 'location', 'mood']) {
      if (body[field] != null && typeof body[field] !== 'string') throw new Error();
    }
    if (body.visitedProvinces != null && (!Array.isArray(body.visitedProvinces) || body.visitedProvinces.some((item: unknown) => typeof item !== 'string'))) throw new Error();
    return body;
  } catch {
    throw new ApiError(400, 'Dữ liệu JSON không hợp lệ.');
  }
}

export function extractJson<T = any>(text: string): T {
  // Remove thinking tokens from reasoning models (like DeepSeek R1)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extract from markdown ```json ... ``` code fence if present
  const markdownMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch) {
    clean = markdownMatch[1].trim();
  } else {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
  }

  return JSON.parse(clean);
}

export function createApiHandler(
  handler: (body: Record<string, any>, env: Env, apiKey: string) => Promise<unknown>
) {
  return async ({ request, env }: FunctionContext): Promise<Response> => {
    const envObj: Env = typeof env === 'string' ? { GEMINI_API_KEY: env } : (env || {});
    if (!envObj.AI && !envObj.GEMINI_API_KEY?.trim()) {
      return json(
        {
          success: false,
          error: 'Chưa cấu hình Cloudflare Workers AI (DeepSeek) hoặc GEMINI_API_KEY. Vui lòng thêm binding AI trong Cloudflare Pages.',
        },
        503
      );
    }
    try {
      const body = await readBody(request);
      return json(await handler(body, envObj, envObj.GEMINI_API_KEY || ''));
    } catch (error) {
      if (error instanceof ApiError) return json({ success: false, error: error.message }, error.status);
      console.error('AI request failed:', error);
      return json({ success: false, error: 'Không thể tạo dữ liệu. Vui lòng bấm thử lại.' }, 500);
    }
  };
}

// Call Cloudflare Workers AI with DeepSeek models
export async function callDeepSeekWithFallback(
  ai: AiBinding,
  params: AiRequestParams
): Promise<{ text: string }> {
  const candidateModels = [
    '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
  ];

  let lastError: Error | null = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const messages: Array<{ role: string; content: any }> = [];
        if (params.systemInstruction) {
          messages.push({ role: 'system', content: params.systemInstruction });
        }

        if (params.imageBase64 && model.includes('v4.1-flash')) {
          const imgUrl = params.imageBase64.startsWith('data:')
            ? params.imageBase64
            : `data:${params.mimeType || 'image/jpeg'};base64,${params.imageBase64}`;
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: params.userPrompt },
              { type: 'image', image: imgUrl },
            ],
          });
        } else {
          messages.push({ role: 'user', content: params.userPrompt });
        }

        const res = await ai.run(model, {
          messages,
          stream: false,
          max_tokens: 2500,
        });

        let text = '';
        if (typeof res === 'string') {
          text = res;
        } else if (res && typeof res.response === 'string') {
          text = res.response;
        } else if (res && Array.isArray(res.choices) && res.choices[0]?.message?.content) {
          text = res.choices[0].message.content;
        } else if (res && typeof res.text === 'string') {
          text = res.text;
        }

        // Clean reasoning tokens generated by DeepSeek-R1 (<think>...</think>)
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        if (!text) {
          throw new ApiError(502, 'AI chưa tạo được nội dung. Vui lòng thử lại.');
        }

        return { text };
      } catch (err: any) {
        lastError = err;
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        break;
      }
    }
  }

  throw new ApiError(503, lastError?.message || 'Không thể gọi Cloudflare DeepSeek AI. Vui lòng thử lại sau.');
}

// Fallback to Gemini REST API when GEMINI_API_KEY is provided
export async function callGeminiWithFallback(apiKey: string, params: GeminiParams): Promise<{ text: string }> {
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  const { systemInstruction, ...generationConfig } = params.config ?? {};
  const contents = typeof params.contents === 'string'
    ? [{ role: 'user', parts: [{ text: params.contents }] }]
    : [{ role: 'user', parts: params.contents.parts }];

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents,
          generationConfig,
          ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        }),
      });
      if (response.ok) {
        const result = await response.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
        };
        const text = result.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('') ?? '';
        if (!text) throw new ApiError(502, 'AI chưa tạo được nội dung. Vui lòng thử lại.');
        return { text };
      }
      await response.body?.cancel();
      if (response.status === 429 || response.status === 503) {
        if (attempt === 1) {
          await new Promise(resolve => setTimeout(resolve, 600));
          continue;
        }
        break;
      }
      throw new ApiError(502, 'Không thể gọi Gemini. Vui lòng kiểm tra API key và quyền truy cập model.');
    }
  }
  throw new ApiError(503, 'Hệ thống AI đang quá tải. Vui lòng thử lại sau vài giây.');
}

// Unified AI caller: prioritizes Cloudflare Workers AI (DeepSeek), falls back to Gemini if configured
export async function callAi(envOrKey: Env | string, params: AiRequestParams): Promise<{ text: string }> {
  const env: Env = typeof envOrKey === 'string' ? { GEMINI_API_KEY: envOrKey } : (envOrKey || {});

  // 1. Cloudflare Workers AI with DeepSeek
  if (env.AI && typeof env.AI.run === 'function') {
    return await callDeepSeekWithFallback(env.AI, params);
  }

  // 2. Gemini fallback
  if (env.GEMINI_API_KEY?.trim()) {
    const parts: any[] = [];
    if (params.imageBase64) {
      const cleanData = params.imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: params.mimeType || 'image/jpeg',
          data: cleanData,
        },
      });
    }
    parts.push({ text: params.userPrompt });

    return await callGeminiWithFallback(env.GEMINI_API_KEY, {
      contents: parts.length === 1 && !params.imageBase64 ? params.userPrompt : { parts },
      config: {
        systemInstruction: params.systemInstruction,
        ...(params.jsonSchema ? { responseMimeType: 'application/json', responseSchema: params.jsonSchema } : {}),
      },
    });
  }

  throw new ApiError(
    503,
    'Chưa cấu hình Cloudflare Workers AI (DeepSeek) hoặc GEMINI_API_KEY. Vui lòng kiểm tra binding trong Cloudflare Pages.'
  );
}
