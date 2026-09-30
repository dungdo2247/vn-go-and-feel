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
   Bật Google sign-in; workspace cá nhân chỉ dành cho tài khoản Google đã đăng nhập.

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

## Dữ liệu theo tài khoản

- Đăng nhập Google trước khi mở workspace cá nhân.
- Lịch trình, lịch trình đang xem, nhật ký và tỉnh đã đi được cache theo Firebase UID.
- Đổi tài khoản/đăng xuất đóng workspace cũ; phản hồi tải dữ liệu cũ không nhập vào tài khoản mới.
- Tài khoản mới không có dữ liệu mẫu. Form trống; không tự chọn ảnh mẫu.
- Nhật ký chỉ ghi vào `users/{uid}/journals`, không tự công khai.
- Key local chung từ bản cũ không được tự nhập vào tài khoản vì không xác định được chủ sở hữu.
- Dữ liệu đã lưu trên Firestore dưới UID vẫn được tải về cho đúng tài khoản.

### Áp dụng quyền Firestore (bắt buộc, tách riêng với deploy Pages)

Cloudflare không tự deploy Firestore rules. Repo có `firebase.json` trỏ đúng named database
`ai-studio-vitnaminhvietnam-4b25c6e9-7a01-431e-8772-b18609a8456c`.

Chạy trong thư mục repo đã checkout nhánh `cloudflare`:

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0850321147
```

Rules chỉ cho chủ UID đọc/ghi dữ liệu; chặn guest/anonymous và chặn đọc nhật ký của người khác,
bao gồm các bản sao public cũ. Không xóa dữ liệu cũ.

Các API AI là stateless và vẫn chưa yêu cầu đăng nhập ở server; tất cả dùng quota của Gemini key.
Quyền sở hữu dữ liệu được thực thi ở Firestore, không phụ thuộc vào việc ẩn UI.

## Tài liệu

- https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- https://developers.cloudflare.com/pages/functions/local-development/
