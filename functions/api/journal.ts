import { createApiHandler, callGeminiWithFallback } from '../../lib/gemini.ts';

export const onRequestPost = createApiHandler(async (body, apiKey) => {
    const { imageBase64, mimeType, location, mood } = body;

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

    const response = await callGeminiWithFallback(apiKey, {
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

    return ({
      success: true,
      rawText: outputText,
      data: {
        caption: caption || 'Một thoáng Việt Nam yêu thương',
        journal: journal,
        hashtags: hashtags.length > 0 ? hashtags : ['#VietnamTravel', '#KỷNiệmĐẹp', '#VietNamTrongToi'],
      },
    });
});
