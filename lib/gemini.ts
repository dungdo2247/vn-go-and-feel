// Shared server-only code for Cloudflare Pages Functions.
export interface Env {
  GEMINI_API_KEY: string;
}

interface FunctionContext {
  request: Request;
  env: Env;
}

interface GeminiParams {
  contents: string | { parts: unknown[] };
  config?: { systemInstruction?: string; [key: string]: unknown };
}

class ApiError extends Error {
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
    // The UI sends these as strings. Reject invalid types before handling photos.
    for (const field of ['destination', 'duration', 'companions', 'preferences', 'budget', 'imageBase64', 'mimeType', 'location', 'mood']) {
      if (body[field] != null && typeof body[field] !== 'string') throw new Error();
    }
    if (body.visitedProvinces != null && (!Array.isArray(body.visitedProvinces) || body.visitedProvinces.some((item: unknown) => typeof item !== 'string'))) throw new Error();
    return body;
  } catch {
    throw new ApiError(400, 'Dữ liệu JSON không hợp lệ.');
  }
}

export function createApiHandler(handler: (body: Record<string, any>, apiKey: string) => Promise<unknown>) {
  return async ({ request, env }: FunctionContext): Promise<Response> => {
    if (!env.GEMINI_API_KEY?.trim()) {
      return json({ success: false, error: 'GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm secret trong Cloudflare Pages.' }, 503);
    }
    try {
      const body = await readBody(request);
      return json(await handler(body, env.GEMINI_API_KEY));
    } catch (error) {
      if (error instanceof ApiError) return json({ success: false, error: error.message }, error.status);
      // Do not log request data, photos, or upstream URLs containing credentials.
      console.error('Gemini request failed.');
      return json({ success: false, error: 'Không thể tạo dữ liệu. Vui lòng bấm thử lại.' }, 500);
    }
  };
}

// Use the Gemini REST API with Web APIs; no Express/Node server is needed.
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
      // Discard upstream errors so secrets or internal details are never returned.
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
