# Việt Nam Đi & Nhớ — Cloudflare Pages

Nhánh `cloudflare` chạy React/Vite trên Pages và 3 API Gemini trên Pages Functions.
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

5. Trong project Settings → Variables and Secrets, thêm **secret** `GEMINI_API_KEY`
   cho Production; thêm riêng cho Preview nếu muốn thử các nhánh/preview.
   Không đặt tên `VITE_GEMINI_API_KEY` và không commit key vào source.
6. Deploy hoặc redeploy sau khi thêm secret. Cloudflare tự build thư mục `functions/`.
7. Mở URL `*.pages.dev` do Cloudflare cấp.
8. Firebase Console → Authentication → Settings → Authorized domains:
   thêm hostname `*.pages.dev` cụ thể của app và custom domain nếu có (không thêm protocol/path).
   Bật Google sign-in; bật Anonymous sign-in nếu muốn khách có danh tính Firebase.

`wrangler.jsonc` là cấu hình Pages, output `dist`; `public/_routes.json` chỉ gọi
Functions cho `/api/*`. Firebase không cần chuyển sang Cloudflare.
Hãy dùng Git integration hoặc Wrangler để deploy cả Functions; không chỉ upload `dist`
bằng thao tác kéo/thả trên dashboard.

## Chạy local

Yêu cầu Node.js >= 22.12.

```sh
npm ci
cp .dev.vars.example .dev.vars
# Sửa .dev.vars để điền GEMINI_API_KEY thật.
npm run dev
```

Mở URL Wrangler in ra (thường `http://localhost:8788`). `dev` build giao diện rồi chạy
Pages và Functions cùng origin; chạy lại sau khi sửa UI. `npm run dev:ui` chạy Vite
để xem UI với hot reload, nhưng không có API Gemini.

```sh
npm run lint
npm test
npm run build
npm run check:functions
```

Tests giả lập phản hồi Gemini, không gọi API thật và không tốn quota.

## API

| Route | Chức năng |
| --- | --- |
| `POST /api/planner` | Lên lịch trình, trả JSON có cấu trúc |
| `POST /api/journal` | Nhận ảnh base64 và tạo nhật ký |
| `POST /api/recommend-destination` | Gợi ý điểm đến từ các tỉnh đã ghé |

Giữ nguyên request/response mà frontend hiện tại sử dụng. API key được đọc từ
`context.env.GEMINI_API_KEY` tại runtime và gửi qua header đến Gemini REST API.
Không có server Express và không dùng API key ở frontend. Giữ danh sách model hiện có
`gemini-3.8-flash`, `gemini-3.1-flash-lite`; retry/fallback khi Gemini trả 429/503.
Request JSON giới hạn 25 MB, tương đương giới hạn Express cũ.

## Kiểm tra sau deploy

- Giao diện tải được; đăng nhập Google không báo `auth/unauthorized-domain`.
- Tạo lịch trình, tạo nhật ký từ ảnh và gợi ý điểm đến đều trả `success: true`.
- Khi thiếu secret, API trả JSON lỗi rõ ràng thay vì trả HTML.
- Kiểm tra quyền truy cập model/quota của Gemini key nếu AI báo lỗi.

## Quyền dữ liệu hiện có

Chuyển hosting không tự triển khai `firestore.rules`. File hiện tại cho phép khách truy cập
đường dẫn `guest_*`, mọi người tạo/sửa `publicJournals`, và đọc/ghi `/test`.
Cần siết quyền Firestore trên đúng database trước khi lưu dữ liệu người dùng thật.
Các API AI hiện không yêu cầu đăng nhập, như backend cũ; cần giới hạn lượt gọi
phù hợp khi mở rộng sử dụng public vì tất cả lượt gọi dùng quota của key này.

## Tài liệu

- https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- https://developers.cloudflare.com/pages/functions/local-development/
