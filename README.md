# QuizRush

Web game đố vui thời gian thực, cùng thể loại với Kahoot. Host chiếu câu hỏi lên màn hình lớn, người chơi trả lời trên điện thoại (vào phòng bằng **mã PIN** hoặc **quét QR**), điểm tính theo đúng/sai và tốc độ. Thiết kế cho 25–30 người chơi mỗi phòng (giới hạn chỉnh bằng `MAX_PLAYERS`).

- 4 loại câu hỏi: một đáp án, Đúng/Sai, nhiều đáp án, gõ đáp án. Câu gõ đáp án không phân biệt hoa/thường và dấu tiếng Việt.
- Ảnh cho câu hỏi và ảnh bìa (tự nén WebP ≤1280px trước khi upload), 24 avatar vẽ sẵn.
- Không cần đăng nhập: mỗi quiz có một **link quản lý bí mật**.
- Giao diện song ngữ Việt/Anh.

## Kiến trúc

| Phần | Dùng |
|---|---|
| Web + API | Next.js 16 (App Router) trên **Vercel** |
| Database | **Supabase Postgres** (RLS bật, chỉ server truy cập bằng service role) |
| Realtime | **Supabase Realtime Broadcast + Presence** (kênh `game:{pin}`) |
| Ảnh | **Supabase Storage**, bucket public `quiz-images`, upload qua signed URL |

Vercel không giữ được WebSocket lâu dài, nên mọi thay đổi trạng thái đi qua API route (server tính giờ và tính điểm). Server phát sự kiện qua REST broadcast của Supabase; trình duyệt chỉ **nghe**. Đáp án đúng không gửi xuống client trước khi lật đáp án. Khi refresh hoặc mất mạng, client gọi `GET /api/games/[pin]/state` để đồng bộ lại.

```
lobby → question (đọc đề 4s → trả lời) → reveal → leaderboard → question … → finished
```

Thư mục chính:

- `lib/game/`: logic thuần (chấm điểm, chuẩn hóa chữ, chuyển trạng thái, dựng state), có unit test trong `tests/`.
- `lib/server/`: truy cập Supabase phía server, broadcast.
- `lib/client/`: gọi API, đồng bộ đồng hồ, hook `useGame` (realtime + resync).
- `app/api/`: các route API. `components/`: giao diện host / player / editor.
- `supabase/migrations/`: schema, hàm `reveal_question`, bucket ảnh.

## Chạy ở máy

Cần Node 20+ và một project Supabase (cloud, hoặc local bằng Docker).

```bash
npm install
cp .env.example .env.local   # điền URL + key Supabase
```

**Supabase cloud:** tạo project ở region Singapore (`ap-southeast-1`), rồi chạy migration:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Key lấy ở *Project Settings → API*: `anon`/publishable cho `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `service_role`/secret cho `SUPABASE_SERVICE_ROLE_KEY`.

**Hoặc Supabase local (Docker):** `npm run db:start`, rồi copy `API URL`, `anon key`, `service_role key` vào `.env.local`. Migration tự chạy.

```bash
npm run dev          # http://localhost:3000
```

Thử với điện thoại cùng mạng wifi: đặt `NEXT_PUBLIC_SITE_URL=http://<IP-LAN-của-máy>:3000` để QR trỏ đúng địa chỉ. Nếu dùng Supabase local, `NEXT_PUBLIC_SUPABASE_URL` cũng phải là IP LAN thay vì `127.0.0.1`.

## Kiểm tra

```bash
npm test             # unit test: chấm điểm, chuẩn hóa, luật chuyển trạng thái, dựng state
npm run typecheck
npm run lint
npm run bots -- --players 30                       # E2E tự động: tạo quiz, 30 bot chơi hết game, đối chiếu điểm
npm run bots -- --players 30 --pin 123456          # chỉ bot vào phòng bạn đang host trên trình duyệt
npm run bots -- --players 30 --base https://<app>.vercel.app   # chạy vào bản đã deploy
```

## Deploy lên Vercel

1. Đẩy code lên GitHub, rồi *Import Project* trên Vercel (framework Next.js tự nhận).
2. Thêm biến môi trường: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (tùy chọn: `MAX_PLAYERS`).
3. Deploy. `vercel.json` đặt functions ở `sin1` (Singapore), gần Supabase `ap-southeast-1`.

## Lưu ý vận hành

- Project Supabase gói free **tự tạm dừng sau 7 ngày không hoạt động**. Mở dashboard để bật lại trước buổi chơi.
- Realtime cần bật *Allow public access* (mặc định đã bật) trong Supabase → Realtime → Settings, vì kênh game là kênh public.
- `SUPABASE_SERVICE_ROLE_KEY` là khóa bí mật: chỉ đặt ở server/Vercel, không bao giờ thêm tiền tố `NEXT_PUBLIC_`.
- Mất link quản lý là mất quyền sửa quiz. Danh sách "Quiz của tôi" chỉ lưu trong trình duyệt đã tạo quiz.
- Đổi tên app: sửa `APP_NAME` trong `lib/config.ts`.
