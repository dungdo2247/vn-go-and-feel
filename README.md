# Việt Nam Đi & Nhớ — Cloudflare Pages

Nhánh `cloudflare` chạy React/Vite trên Pages và 3 API du lịch thông minh trên Pages Functions sử dụng **Cloudflare Workers AI (DeepSeek)** tích hợp sẵn.
Firebase Authentication/Firestore tiếp tục sử dụng cấu hình hiện có.

## Deploy từ GitHub

1. Trong Cloudflare Dashboard → Workers & Pages → tạo **Pages project** và kết nối GitHub.
2. Chọn repository `dungdo2247/vn-go-and-feel`.
3. Chọn **Production branch: `cloudflare`** (quan trọng: không chọn `main`).
4. Cấu hình:

   | Mục | Giá trị |
   | --- | --- |
   | Framework preset | React (Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | Để trống |
   | Node version | 22, từ `.node-version` |

5. Cloudflare Workers AI (DeepSeek) được tự động cấu hình qua binding `AI` trong `wrangler.jsonc`.
   - Không bắt buộc cấu hình `GEMINI_API_KEY` nữa.
   - Nếu muốn dự phòng, bạn vẫn có thể thêm secret `GEMINI_API_KEY` trong Settings → Variables and Secrets.
6. Deploy hoặc redeploy. Cloudflare tự build thư mục `functions/`.
7. Mở URL `*.pages.dev` do Cloudflare cấp.
8. Firebase Console → Authentication → Settings → Authorized domains:
   thêm hostname `*.pages.dev` cụ thể của app và custom domain nếu có (không thêm protocol/path).
   Bật Google sign-in; hỗ trợ cả chế độ Khách (Guest mode) để xem trước.

`wrangler.jsonc` là cấu hình Pages, output `dist`, kèm Workers AI binding `AI`; `public/_routes.json` chỉ gọi
Functions cho `/api/*`.

## Chạy local

Yêu cầu Node.js >= 22.12.

```sh
npm ci
npm run dev
```

Mở URL Wrangler in ra (thường `http://localhost:8788`). `dev` build giao diện rồi chạy
Pages và Functions cùng origin; chạy lại sau khi sửa UI. `npm run dev:ui` chạy Vite
để xem UI với hot reload.

```sh
npm run lint
npm test
npm run build
npm run check:functions
```

## API

| Route | Chức năng | Model mặc định |
| --- | --- | --- |
| `POST /api/planner` | Lên lịch trình, trả JSON có cấu trúc | DeepSeek R1 Distill Qwen 32B |
| `POST /api/journal` | Tạo nhật ký và caption từ địa điểm & cảm xúc | DeepSeek R1 / V4.1 Flash |
| `POST /api/recommend-destination` | Phân tích Gu & gợi ý điểm đến tiếp theo | DeepSeek R1 Distill Qwen 32B |

Mặc định gọi Cloudflare Workers AI với model DeepSeek (`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`, `@cf/deepseek-ai/deepseek-v4.1-flash-1017`).
Hệ thống tự động lọc bỏ các thẻ suy luận (`<think>...</think>`) của DeepSeek R1 để trả về dữ liệu chuẩn JSON cho frontend.
Hỗ trợ fallback sang Gemini nếu hệ thống Workers AI chưa được kích hoạt hoặc gặp lỗi.

## Kiểm tra sau deploy

- Giao diện tải được; đăng nhập Google hoặc bấm "Trải nghiệm ngay (Chế độ Khách)".
- Tạo lịch trình, tạo nhật ký ảnh và gợi ý điểm đến đều trả `success: true`.
- Không phụ thuộc vào API key bên thứ ba nhờ sử dụng Cloudflare Workers AI built-in.

## Dữ liệu theo tài khoản

- Đăng nhập Google trước khi mở workspace cá nhân.
- Lịch trình, lịch trình đang xem, nhật ký và tỉnh đã đi được cache theo Firebase UID (hoặc lưu local khi dùng chế độ Khách).
- Đổi tài khoản/đăng xuất đóng workspace cũ; phản hồi tải dữ liệu cũ không nhập vào tài khoản mới.
- Tài khoản mới không có dữ liệu mẫu. Form trống; không tự chọn ảnh mẫu.
- Nhật ký chỉ ghi vào `users/{uid}/journals`, không tự công khai.
- Dữ liệu đã lưu trên Firestore dưới UID vẫn được tải về cho đúng tài khoản.

### Áp dụng quyền Firestore (bắt buộc, tách riêng với deploy Pages)

Cloudflare không tự deploy Firestore rules. Repo có `firebase.json` trỏ đúng named database
`ai-studio-vitnaminhvietnam-4b25c6e9-7a01-431e-8772-b18609a8456c`.

Chạy trong thư mục repo đã checkout nhánh `cloudflare`:

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0850321147
```

## Tài liệu

- https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/workers-ai/models/deepseek-r1-distill-qwen-32b/
- https://developers.cloudflare.com/pages/functions/bindings/#workers-ai
