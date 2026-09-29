import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for parsing JSON with generous limit for base64 photo uploads
app.use(express.json({ limit: '25mb' }));

// Server-side initialization of Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to check API Key availability
const verifyApiKey = (res: Response): boolean => {
  if (!apiKey) {
    res.status(500).json({
      error: 'GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm khóa trong Settings > Secrets.',
    });
    return false;
  }
  return true;
};

/**
 * Robust Gemini Caller with Automatic Model Fallback & Retry
 * Guards against 503 "High Demand / UNAVAILABLE" temporary spikes on any single model
 */
async function callGeminiWithFallback(params: any): Promise<any> {
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || JSON.stringify(err);
        console.warn(`[Gemini Request] Model ${model} (attempt ${attempt}) error:`, msg);

        const isTransient =
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('overloaded') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429');

        if (isTransient) {
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          break; // Move to next model
        } else {
          throw err;
        }
      }
    }
  }

  throw lastError;
}

/**
 * Format error message into friendly Vietnamese text
 */
function formatHumanErrorMessage(error: any): string {
  if (!error) return 'Không thể tạo dữ liệu. Vui lòng bấm thử lại.';
  const raw = typeof error === 'string' ? error : error.message || JSON.stringify(error);
  try {
    const json = JSON.parse(raw);
    if (json?.error?.message) {
      if (json.error.code === 503 || json.error.message.includes('high demand')) {
        return 'Hệ thống AI đang quá tải lượt truy cập tạm thời. Vui lòng bấm "Tạo Lịch Trình" thử lại sau 3 giây!';
      }
      return json.error.message;
    }
  } catch {
    // Not valid json string
  }
  if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
    return 'Hệ thống AI đang quá tải lượt truy cập tạm thời. Vui lòng bấm "Tạo Lịch Trình" thử lại sau 3 giây!';
  }
  return raw;
}

/**
 * FEATURE 1: Smart Planner (Lên Kế Hoạch Lịch Trình)
 */
app.post('/api/planner', async (req: Request, res: Response) => {
  if (!verifyApiKey(res)) return;

  try {
    const { destination, duration, companions, preferences, budget } = req.body;

    const userPrompt = `Hãy lên lịch trình du lịch cho tôi với các thông tin sau:
- Điểm đến: [${destination || 'Đà Lạt'}]
- Thời gian: [${duration || '3 ngày 2 đêm'}]
- Đối tượng: [${companions || 'Đi cùng bạn bè'}]
- Sở thích/Phong cách: [${preferences || 'Khám phá thiên nhiên, ẩm thực địa phương, check-in chụp ảnh'}]
- Ngân sách tổng: [${budget || 'Khoảng 4 triệu VNĐ'}]`;

    const systemInstruction = `Bạn là một chuyên gia thiết kế lịch trình du lịch nội địa Việt Nam. 
Nhiệm vụ của bạn là tạo ra một lịch trình chi tiết dựa trên yêu cầu của người dùng.
Luôn luôn trả lời CHỈ BẰNG một chuỗi JSON hợp lệ (không kèm theo markdown code block hay văn bản giải thích nào khác) với cấu trúc sau:
{
  "title": "Tên chuyến đi hấp dẫn",
  "summary": "Tóm tắt ngắn gọn về chuyến đi (2 câu)",
  "itinerary": [
    {
      "day": 1,
      "activities": [
        {
          "time": "Buổi sáng/Chiều/Tối",
          "locationName": "Tên địa điểm",
          "description": "Mô tả trải nghiệm tại đây",
          "estimatedCost": "Chi phí dự kiến (VND)"
        }
      ]
    }
  ]
}
Chỉ gợi ý các địa điểm có thật và phù hợp với thực tế giao thông tại Việt Nam.`;

    const response = await callGeminiWithFallback({
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            itinerary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.INTEGER },
                  activities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        time: { type: Type.STRING },
                        locationName: { type: Type.STRING },
                        description: { type: Type.STRING },
                        estimatedCost: { type: Type.STRING },
                      },
                      required: ['time', 'locationName', 'description', 'estimatedCost'],
                    },
                  },
                },
                required: ['day', 'activities'],
              },
            },
          },
          required: ['title', 'summary', 'itinerary'],
        },
      },
    });

    const rawText = response.text || '{}';
    const parsedData = JSON.parse(rawText);
    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error generating planner:', error);
    res.status(500).json({
      success: false,
      error: formatHumanErrorMessage(error),
    });
  }
});

/**
 * FEATURE 2: AI Photo Journal (Viết nhật ký từ Ảnh chụp)
 */
app.post('/api/journal', async (req: Request, res: Response) => {
  if (!verifyApiKey(res)) return;

  try {
    const { imageBase64, mimeType, location, mood } = req.body;

    const userPromptText = `- Địa điểm: [${location || 'Một góc Việt Nam bình yên'}]
- Tâm trạng của tôi lúc này: [${mood || 'Bình yên, thư giãn, ngập tràn cảm hứng'}]

Hãy viết nhật ký cho bức ảnh này giúp tôi.`;

    const systemInstruction = `Bạn là một nhà văn du lịch và là người bạn đồng hành lưu giữ kỷ niệm. 
Người dùng sẽ gửi cho bạn 1 bức ảnh chụp tại 1 địa điểm du lịch ở Việt Nam kèm theo một vài từ khóa tâm trạng.
Dựa vào bức ảnh và từ khóa, hãy viết một đoạn nhật ký du lịch thật cảm xúc, thơ mộng và mang đậm dấu ấn cá nhân.
Định dạng trả về:
- 🖋️ Caption ngắn (1 câu để làm tiêu đề bài viết).
- 📖 Nhật ký (Khoảng 3-4 câu miêu tả vẻ đẹp trong ảnh và cảm xúc).
- 🏷️ Hashtags (3-5 hashtags liên quan đến cảnh vật và địa danh).`;

    const parts: any[] = [];

    if (imageBase64) {
      const cleanData = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanData,
        },
      });
    }

    parts.push({
      text: userPromptText,
    });

    const response = await callGeminiWithFallback({
      contents: { parts },
      config: {
        systemInstruction,
      },
    });

    const outputText = response.text || '';

    let caption = '';
    let journal = '';
    let hashtags: string[] = [];

    const captionMatch = outputText.match(/(?:🖋️|Caption(?:\s*ngắn)?)\s*[:：]?\s*([^\n\r]+)/i);
    if (captionMatch && captionMatch[1]) {
      caption = captionMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    const hashtagsMatch = outputText.match(/(?:🏷️|Hashtags?)\s*[:：]?\s*([^\n\r]+)/i);
    if (hashtagsMatch && hashtagsMatch[1]) {
      hashtags = hashtagsMatch[1]
        .split(/[\s,]+/)
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.startsWith('#') || tag.length > 0)
        .map((tag: string) => (tag.startsWith('#') ? tag : `#${tag}`));
    } else {
      const inlineTags = outputText.match(/#[A-Za-z0-9_\p{L}]+/gu);
      if (inlineTags) hashtags = inlineTags;
    }

    const journalMatch = outputText.match(/(?:📖|Nhật ký)\s*[:：]?\s*([\s\S]*?)(?=(?:🏷️|Hashtags?|$))/i);
    if (journalMatch && journalMatch[1]) {
      journal = journalMatch[1].trim();
    } else {
      journal = outputText.trim();
    }

    res.json({
      success: true,
      rawText: outputText,
      data: {
        caption: caption || 'Một thoáng Việt Nam yêu thương',
        journal: journal,
        hashtags: hashtags.length > 0 ? hashtags : ['#VietnamTravel', '#KỷNiệmĐẹp', '#VietNamTrongToi'],
      },
    });
  } catch (error: any) {
    console.error('Error generating photo journal:', error);
    res.status(500).json({
      success: false,
      error: formatHumanErrorMessage(error),
    });
  }
});

/**
 * FEATURE 3: "Bản đồ Chinh Phục Việt Nam" (Gợi ý điểm đến tiếp theo)
 */
app.post('/api/recommend-destination', async (req: Request, res: Response) => {
  if (!verifyApiKey(res)) return;

  try {
    const { visitedProvinces } = req.body;

    const listStr = Array.isArray(visitedProvinces) && visitedProvinces.length > 0
      ? visitedProvinces.join(', ')
      : 'Bà Rịa - Vũng Tàu, Bình Thuận, Khánh Hòa, Đà Nẵng, Quảng Nam';

    const userPrompt = `Đây là danh sách các tỉnh thành tôi đã check-in trên bản đồ:
[${listStr}].

Hãy phân tích và gợi ý cho tôi điểm đến tiếp theo!`;

    const systemInstruction = `Bạn là một AI phân tích dữ liệu du lịch cá nhân. 
Bạn sẽ nhận được danh sách các tỉnh thành tại Việt Nam mà người dùng đã đi qua.
Hãy phân tích "Gu" du lịch của họ (thích biển, núi, đồng bằng, hay thành phố nhộn nhịp) dựa trên danh sách đó. 
Sau đó, đề xuất 1 tỉnh thành DUY NHẤT ở Việt Nam mà họ CHƯA đi, nhưng cực kỳ phù hợp với gu của họ.
Trình bày theo format sau:
- 🔍 Phân tích Gu du lịch: (1 câu)
- 🎯 Điểm đến tiếp theo dành cho bạn: (Tên tỉnh/thành)
- 💡 Lý do: (Vì sao lại chọn nơi này dựa trên lịch sử của họ)
- 🎒 3 Trải nghiệm phải thử tại đây: (Bullet points)`;

    const response = await callGeminiWithFallback({
      contents: userPrompt,
      config: {
        systemInstruction,
      },
    });

    const outputText = response.text || '';

    let guAnalysis = '';
    let nextDestination = '';
    let reason = '';
    const experiences: string[] = [];

    const guMatch = outputText.match(/(?:🔍|Phân tích Gu du lịch)\s*[:：]?\s*([^\n\r]+)/i);
    if (guMatch) guAnalysis = guMatch[1].trim();

    const destMatch = outputText.match(/(?:🎯|Điểm đến tiếp theo(?: dành cho bạn)?)\s*[:：]?\s*([^\n\r]+)/i);
    if (destMatch) nextDestination = destMatch[1].trim();

    const reasonMatch = outputText.match(/(?:💡|Lý do)\s*[:：]?\s*([\s\S]*?)(?=(?:🎒|3 Trải nghiệm|$))/i);
    if (reasonMatch) reason = reasonMatch[1].trim();

    const expSection = outputText.split(/(?:🎒|3 Trải nghiệm phải thử tại đây)/i)[1] || '';
    const lines = expSection.split('\n');
    for (const line of lines) {
      const clean = line.replace(/^[\s*•\-–\d.]+/, '').trim();
      if (clean && clean.length > 3) {
        experiences.push(clean);
      }
    }

    res.json({
      success: true,
      rawText: outputText,
      data: {
        guAnalysis: guAnalysis || 'Bạn yêu thích khám phá vẻ đẹp thiên nhiên và văn hóa đặc sắc của dải đất hình chữ S.',
        nextDestination: nextDestination || 'Ninh Bình',
        reason: reason || 'Nơi đây hội tụ non nước hữu tình và chiều sâu lịch sử văn hóa tuyệt vời.',
        experiences: experiences.length >= 3 ? experiences.slice(0, 3) : [
          'Đi thuyền khám phá Quần thể danh thắng Tràng An',
          'Chinh phục đỉnh Hang Múa ngắm toàn cảnh Tam Cốc',
          'Thưởng thức đặc sản cơm cháy và dê núi Ninh Bình'
        ],
      },
    });
  } catch (error: any) {
    console.error('Error recommending destination:', error);
    res.status(500).json({
      success: false,
      error: formatHumanErrorMessage(error),
    });
  }
});

// Setup Vite middleware in dev or serve dist in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
