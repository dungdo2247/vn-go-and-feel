import { createApiHandler, callGeminiWithFallback } from '../../lib/gemini.ts';

export const onRequestPost = createApiHandler(async (body, apiKey) => {
    const { visitedProvinces } = body;

    const listStr = Array.isArray(visitedProvinces) && visitedProvinces.length > 0
      ? visitedProvinces.join(', ')
      : 'Chưa ghé tỉnh/thành nào';

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

    const response = await callGeminiWithFallback(apiKey, {
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

    return ({
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
});
