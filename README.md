# QuizRush

Web game đố vui thời gian thực, cùng thể loại với Kahoot. Host chiếu câu hỏi lên màn hình lớn, người chơi trả lời trên điện thoại (vào phòng bằng **mã PIN** hoặc **quét QR**), điểm tính theo đúng/sai và tốc độ. Thiết kế cho 25–30 người chơi mỗi phòng (giới hạn chỉnh bằng `MAX_PLAYERS`).

- 4 loại câu hỏi: một đáp án, Đúng/Sai, nhiều đáp án, gõ đáp án. Câu gõ đáp án không phân biệt hoa/thường và dấu tiếng Việt.
- Ảnh cho câu hỏi và ảnh bìa (tự nén WebP ≤1280px trước khi upload), 24 avatar vẽ sẵn.
- Nhạc .mp3 (≤8MB):
  - Mỗi quiz có thể có một bài nhạc nền, lặp lại ở phòng chờ và trong lúc trả lời.
  - Mỗi câu hỏi có thể có nhạc riêng, phát thay nhạc nền từ lúc mở trả lời (hợp với câu kiểu "nghe nhạc đoán bài").
  - Nhạc phát trên màn hình host và trên điện thoại người chơi. Mỗi máy có nút tắt/bật tiếng.
- **Sinh quiz bằng AI (Gemini)**, chỉ superadmin: nhập chủ đề, số câu (tối đa 30 mỗi lần), loại câu, độ khó và ngôn ngữ. Dùng được để tạo quiz mới (trang "Quiz của tôi") hoặc thêm câu vào quiz đang sửa. Server bỏ những câu AI soạn sai luật; người soạn vẫn nên xem lại trước khi chơi. Cần `GEMINI_API_KEY`; key gói free của Google AI Studio là đủ.
- **Tài khoản:** chỉ tài khoản đã đăng nhập mới tạo và sửa được quiz, và chỉ sửa được quiz của mình. **Superadmin** xem được mọi quiz và cấp, xóa tài khoản, đặt lại mật khẩu ở `/admin/users`. Không có tự đăng ký. Người chơi **không cần tài khoản**, chỉ cần mã PIN.
- Giao diện song ngữ Việt/Anh.

## Kiến trúc

| Phần | Dùng |
|---|---|
| Web + API | Next.js 16 (App Router) trên **Vercel** |
| Database | **Supabase Postgres** (RLS bật, chỉ server truy cập bằng service role) |
| Tài khoản | **Supabase Auth** (email + mật khẩu). Vai trò lưu ở `app_metadata.role` (`user` / `superadmin`) |
| Realtime | **Supabase Realtime Broadcast + Presence** (kênh `game:{pin}`) |
| Ảnh | **Supabase Storage**, bucket public `quiz-images`, upload qua signed URL |
| Sinh quiz bằng AI | **Gemini API** qua `@google/genai`, structured output theo JSON Schema (`lib/ai/quizGen.ts`, `lib/server/gemini.ts`) |

Trình duyệt giữ phiên đăng nhập Supabase và gửi access token tới API (`Authorization: Bearer`). Server xác minh token với Supabase Auth trên mỗi request rồi mới kiểm tra quyền sở hữu quiz và vai trò.

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

**Hoặc Supabase local (Docker):** `npm run db:start`, rồi copy `API URL`, `anon key`, `service_role key` vào `.env.local`. Migration tự chạy. `supabase/config.jsonc` đã tắt tự đăng ký.

Tạo tài khoản superadmin đầu tiên. Chạy lại lệnh này sẽ đặt lại mật khẩu và vai trò.

```bash
npm run create-user -- --email <email> --password <mật-khẩu> --role superadmin
npm run dev          # http://localhost:3000 → Đăng nhập
```

Thử với điện thoại cùng mạng wifi: đặt `NEXT_PUBLIC_SITE_URL=http://<IP-LAN-của-máy>:3000` để QR trỏ đúng địa chỉ. Nếu dùng Supabase local, `NEXT_PUBLIC_SUPABASE_URL` cũng phải là IP LAN thay vì `127.0.0.1`.

## Kiểm tra

```bash
npm test             # unit test: chấm điểm, chuẩn hóa, luật chuyển trạng thái, dựng state, chuyển đổi quiz AI
npm run typecheck
npm run lint
# E2E tự động: đăng nhập, tạo quiz, 30 bot chơi hết game, đối chiếu điểm, xóa quiz test
npm run bots -- --players 30 --email <email> --password <mật-khẩu>
npm run bots -- --players 30 --pin 123456          # chỉ bot vào phòng bạn đang host (không cần tài khoản)
npm run bots -- --players 30 --email <email> --password <mật-khẩu> --base https://<app>.vercel.app
```

Kiểm tra nhanh một bản deploy: mở `/api/health`. Bản khỏe có `"ok": true` và `"signups": "disabled (ok)"`. Trang này không bao giờ hiện giá trị key.

## Deploy lên Vercel

1. Đẩy code lên GitHub, rồi *Import Project* trên Vercel (framework Next.js tự nhận).
2. Thêm biến môi trường: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (tùy chọn: `MAX_PLAYERS`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`).
3. Deploy. `vercel.json` đặt functions ở `sin1` (Singapore), gần Supabase `ap-southeast-1`.

**Thiết lập tài khoản trên Supabase cloud** (một lần):
1. *Authentication → Sign In / Providers*: **tắt "Allow new users to sign up"**. Nếu để bật, ai cũng có thể tự tạo tài khoản qua API Supabase và tạo quiz.
2. *Authentication → Users → Add user → Create new user*: nhập email và mật khẩu, tick **Auto Confirm User**.
3. *SQL Editor*, gán quyền superadmin:
   ```sql
   update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"superadmin"}'
   where email = 'superadmin@kahut.com';
   ```
   Các tài khoản sau đó superadmin tự tạo trong app ở `/admin/users`.

## Lưu ý vận hành

- Project Supabase gói free **tự tạm dừng sau 7 ngày không hoạt động**. Mở dashboard để bật lại trước buổi chơi.
- Nhạc tải xuống từng máy: 30 người chơi × file 4MB ≈ 120MB mỗi bài nhạc trong một ván. Gói free Supabase có giới hạn băng thông tải xuống mỗi tháng, nên dùng file nhỏ (128kbps, đoạn ngắn).
- Realtime cần bật *Allow public access* (mặc định đã bật) trong Supabase → Realtime → Settings, vì kênh game là kênh public.
- `SUPABASE_SERVICE_ROLE_KEY` là khóa bí mật: chỉ đặt ở server/Vercel, không bao giờ thêm tiền tố `NEXT_PUBLIC_`.
- Xóa một tài khoản không xóa quiz của tài khoản đó. Quiz còn lại và chỉ superadmin xem được (hiện là "Người tạo").
- Superadmin không tự xóa mình hay tự bỏ quyền superadmin được, để tránh khóa luôn hệ thống.
- Đổi tên app: sửa `APP_NAME` trong `lib/config.ts`.
- **Sinh quiz bằng AI:**
  - Mỗi lần bấm "Sinh câu hỏi" là 1 request Gemini.
  - Hạn mức gói free tính chung cho cả Google project và reset lúc 0h giờ Pacific. Xem số chính xác ở trang rate limit trong AI Studio.
  - Mặc định dùng `gemini-3.8-flash`. Khi model này hết lượt hoặc quá tải thì tự chuyển sang `gemini-3.5-flash-lite`. Đổi model bằng `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`.
  - Ở gói free, Google có thể dùng nội dung gửi lên để cải thiện sản phẩm. Đừng nhập thông tin nhạy cảm vào chủ đề.
  - `GEMINI_API_KEY` là khóa bí mật, không thêm tiền tố `NEXT_PUBLIC_`. `/api/health` chỉ báo key đã đặt hay chưa, không gọi Gemini.
