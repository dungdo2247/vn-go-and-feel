import { createApiHandler, callGeminiWithFallback } from '../../lib/gemini.ts';

export const onRequestPost = createApiHandler(async (body, apiKey) => {
    const { destination, duration, companions, preferences, budget } = body;

    const userPrompt = `Hãy lên lịch trình du lịch cho tôi với các thông tin sau:
- Điểm đến: [${destination || 'Chưa cung cấp'}]
- Thời gian: [${duration || 'Chưa cung cấp'}]
- Đối tượng: [${companions || 'Chưa cung cấp'}]
- Sở thích/Phong cách: [${preferences || 'Chưa cung cấp'}]
- Ngân sách tổng: [${budget || 'Chưa cung cấp'}]`;

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

    const response = await callGeminiWithFallback(apiKey, {
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            summary: { type: 'STRING' },
            itinerary: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  day: { type: 'INTEGER' },
                  activities: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        time: { type: 'STRING' },
                        locationName: { type: 'STRING' },
                        description: { type: 'STRING' },
                        estimatedCost: { type: 'STRING' },
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
    return ({ success: true, data: parsedData });
});
