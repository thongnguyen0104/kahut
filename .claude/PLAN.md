# Plan: Web quiz realtime kiểu Kahoot (≥25 người chơi, deploy Vercel)

## Context
Bạn cần một web game quiz nhiều người chơi cùng lúc, cùng thể loại và cơ chế với Kahoot. Host chiếu câu hỏi lên màn hình lớn, người chơi trả lời trên điện thoại, điểm tính theo đúng/sai và tốc độ. Yêu cầu:
- Ít nhất 25 người chơi cùng lúc trong một phòng.
- Vào phòng bằng **mã PIN 6 số** hoặc **quét QR**.
- Có hình ảnh: ảnh câu hỏi, ảnh bìa quiz, avatar người chơi.
- 4 loại câu hỏi: 1 đáp án đúng, Đúng/Sai, nhiều đáp án đúng, gõ câu trả lời.
- Host **không cần đăng nhập**. Mỗi quiz có một link quản lý bí mật.
- Giao diện **song ngữ Việt/Anh**.
- Deploy được lên **Vercel**.

Thư mục `d:\Projects\kahut` đang trống, nên dự án làm từ đầu.

**Ràng buộc chính:** Vercel chạy code server dưới dạng serverless function, không giữ được kết nối WebSocket lâu dài, nên **không dùng được Socket.io**. Phần realtime phải giao cho một dịch vụ bên ngoài.

**Thương hiệu:** game dùng tên, logo, bảng màu và icon đáp án của riêng mình. Không dùng tên, logo, nhạc hay bộ "4 màu + 4 hình" đặc trưng của Kahoot.

## Công nghệ chọn
| Phần | Công nghệ | Lý do |
|---|---|---|
| Frontend + API | **Next.js 15 (App Router) + TypeScript + Tailwind CSS** | Vercel hỗ trợ sẵn, route handlers chạy làm API |
| Database | **Supabase Postgres** | Lưu quiz, game, người chơi, câu trả lời; game lưu trạng thái ở đây nên refresh trang không mất ván |
| Realtime | **Supabase Realtime (Broadcast + Presence)** | Gói free cho 200 kết nối đồng thời, dư cho 25–50 người |
| Lưu ảnh | **Supabase Storage** (bucket public `quiz-images`) | Upload qua signed URL, có CDN |
| QR code | `qrcode.react` | Tạo QR phía client, trỏ tới `/join?pin=XXXXXX` |
| Song ngữ | `next-intl` (chế độ không gắn locale vào URL; lưu ngôn ngữ bằng cookie) | URL vào phòng ngắn, QR gọn |
| Nén ảnh | `browser-image-compression` | Nén ảnh xuống ≤1280px dạng WebP trước khi upload, để điện thoại tải nhanh |
| Test | Vitest (logic chấm điểm) + script bot giả lập 25–30 người chơi | |

**Region:** đặt Supabase ở `ap-southeast-1` (Singapore) và Vercel functions ở `sin1` (cấu hình trong `vercel.json`) để giảm độ trễ cho người dùng ở Việt Nam.

## Kiến trúc: server quyết định trạng thái và điểm
- **Mọi thay đổi trạng thái và mọi phép tính điểm chạy trên Next.js API routes**, dùng Supabase service-role key (chỉ nằm phía server).
- Client chỉ dùng anon key để **nghe** kênh realtime `game:{pin}`. Server gửi sự kiện broadcast qua REST (`channel.send`/`httpSend` của supabase-js, không cần subscribe).
- Đáp án đúng **không bao giờ gửi xuống client** trước lúc lật đáp án (reveal).
- Bật RLS trên mọi bảng và không tạo policy nào cho anon. Client đọc/ghi dữ liệu chỉ qua API.
- Có người giả mạo broadcast thì cũng không đổi được điểm, vì điểm tính và lưu ở server. Khi refresh, client luôn gọi `GET /state` để đồng bộ lại.

### Luồng trạng thái game
```
lobby → question (đọc đề 3–5s, rồi mở trả lời + đếm giờ) → reveal (đáp án đúng + biểu đồ phân bố)
      → leaderboard (top 5) → [câu tiếp theo] … → finished (bục vinh quang top 3)
```
- Host bấm `start`/`next`/`end`. Khi hết giờ, hoặc khi mọi người đã trả lời (host đếm qua sự kiện `answer_count`), host tự gọi `reveal`.
- Mọi lần chuyển trạng thái là **idempotent**: `UPDATE games SET status=... WHERE id=? AND status=<trạng thái cũ> AND current_question_index=?`. Nhờ vậy bấm 2 lần hay gọi trùng cũng không bị lỗi.
- Đồng hồ đếm ngược: server lưu `question_started_at` và trả kèm `serverNow` để client bù lệch giờ. Server nhận câu trả lời đến hạn chót + 1 giây ân hạn.

### Sự kiện realtime trên kênh `game:{pin}`
- `player_joined` / `player_kicked`. Presence dùng để hiện chấm online/offline cạnh tên người chơi.
- `state_changed` {status, questionIndex, question (câu hỏi, không kèm `isCorrect`), startedAt, timeLimit, serverNow}
- `answer_count` {count}: server gửi sau mỗi câu trả lời.
- `reveal` {đáp án đúng, phân bố lựa chọn, kết quả từng người: đúng/sai, điểm cộng, tổng điểm, thứ hạng}. Với ~30 người, gói tin dưới 5KB.
- `game_ended` {bảng xếp hạng cuối}

### Chấm điểm (`lib/game/scoring.ts`)
- Trả lời đúng: `round(1000 × hệ_số × (1 − 0.5 × thời_gian_trả_lời / thời_gian_giới_hạn))`. Hệ số là 0 (câu không tính điểm), 1 hoặc 2.
- Thời gian trả lời đo ở server, tính từ `question_started_at` đến lúc nhận được request.
- Nhiều đáp án đúng: phải chọn đúng toàn bộ đáp án đúng và không chọn sai đáp án nào.
- Gõ câu trả lời: chuẩn hóa trước khi so sánh (`lib/game/normalize.ts`): bỏ khoảng trắng thừa, chuyển chữ thường, bỏ dấu tiếng Việt (NFD + đổi đ→d). So với danh sách `accepted_answers`.
- Chuỗi trả lời đúng liên tiếp (streak) được lưu lại để hiển thị. Thưởng thêm điểm cho streak là tùy chọn.

## Database (`supabase/migrations/0001_init.sql`)
- `quizzes`: id, title, description, cover_image_url, edit_token_hash, created_at, updated_at
- `questions`: id, quiz_id, position, type (`single`|`true_false`|`multi`|`text`), prompt, image_url, time_limit_sec (5–120), points_multiplier, options jsonb `[{id,text,isCorrect}]`, accepted_answers text[]
- `games`: id, pin, quiz_id, quiz_snapshot jsonb, host_token_hash, status, current_question_index, question_started_at, created_at, ended_at
  - Unique index một phần trên `pin` cho các game `status <> 'finished'`.
  - `quiz_snapshot` chụp lại quiz lúc tạo game, để việc sửa quiz giữa chừng không ảnh hưởng ván đang chơi.
- `players`: id, game_id, nickname, avatar, token_hash, score, streak, kicked, joined_at. Unique (game_id, lower(nickname)).
- `answers`: id, game_id, player_id, question_index, answer jsonb, is_correct, points, response_ms, created_at. Unique (player_id, question_index), nên mỗi câu chỉ nhận lần trả lời đầu tiên.
- Token (edit/host/player): tạo 32 byte ngẫu nhiên; DB chỉ lưu bản băm SHA-256 (`lib/tokens.ts`).

## API routes (`app/api/...`)
| Route | Việc làm |
|---|---|
| `POST /api/quizzes` | Tạo quiz, trả về `{id, editToken}` |
| `GET/PUT /api/quizzes/[id]` | Đọc quiz / lưu cả quiz kèm mảng câu hỏi (PUT cần editToken) |
| `POST /api/quizzes/[id]/upload-url` | Kiểm tra editToken rồi trả signed upload URL của Supabase Storage |
| `POST /api/games` | {quizId, editToken} → tạo game và PIN 6 số (tạo lại nếu trùng), trả `{pin, hostToken}` |
| `POST /api/games/[pin]/join` | {nickname, avatar} → `{playerId, playerToken}`. Giới hạn mặc định `MAX_PLAYERS=30` (cấu hình được). Cho vào phòng bất kỳ lúc nào trước khi game kết thúc; người vào muộn bắt đầu từ câu kế tiếp. |
| `GET /api/games/[pin]/state` | Trạng thái hiện tại, dùng khi refresh/mất kết nối. Kèm điểm cá nhân nếu có playerToken. |
| `POST /api/games/[pin]/answer` | {playerToken, questionIndex, answer} → kiểm tra hạn chót, chấm điểm, ghi DB, broadcast `answer_count` |
| `POST /api/games/[pin]/control` | {hostToken, action: `start`/`reveal`/`leaderboard`/`next`/`end`/`kick`} |

## Các trang
- `/`: nhập PIN, nút "Tạo quiz", "Quiz của tôi", nút đổi VI/EN.
- `/join?pin=...`: đích của QR. Nhập nickname, chọn avatar (~24 avatar SVG có sẵn trong `public/avatars/`, ví dụ DiceBear style có license CC0), rồi chuyển sang `/play/[pin]`.
- `/play/[pin]`: màn hình điện thoại, lần lượt hiện: chờ trong lobby → bàn phím đáp án (lưới 2×2 to, dễ bấm; ô nhập chữ cho câu gõ đáp án; nút xác nhận cho câu nhiều đáp án) → đúng/sai + điểm cộng + thứ hạng → hạng cuối cùng. `playerToken` lưu trong localStorage, nên refresh vẫn vào lại đúng người chơi cũ.
- `/host/[pin]`: màn hình chiếu, lần lượt hiện: lobby với **QR to + PIN to** + lưới avatar người chơi (bấm để kick) + nút Bắt đầu → câu hỏi + ảnh + đồng hồ + số người đã trả lời → biểu đồ cột phân bố đáp án → top 5 → bục vinh quang. Tải trước toàn bộ ảnh câu hỏi khi game bắt đầu.
- `/quiz/new` → `/quiz/[id]/edit?k=<editToken>`: trình soạn quiz gồm tiêu đề, ảnh bìa, danh sách câu hỏi (thêm/sửa/xóa/kéo thả sắp xếp), chọn loại câu, upload ảnh, chọn thời gian và hệ số điểm, nút "Chơi ngay".
- `/my-quizzes`: danh sách quiz kèm editToken lưu ở localStorage. Có nút copy link quản lý và cảnh báo "lưu link này lại, mất link là mất quyền sửa quiz".

## Cấu trúc thư mục
```
app/            (các trang ở trên + api/)
components/     host/ player/ editor/ ui/
lib/
  supabase/server.ts   client dùng service-role (chỉ chạy phía server)
  supabase/browser.ts  client dùng anon (chỉ cho realtime)
  game/types.ts, scoring.ts, normalize.ts, transitions.ts, pin.ts
  realtime.ts          broadcastToGame() phía server + hook useGameChannel() phía client
  tokens.ts
i18n/ + messages/vi.json, messages/en.json
supabase/migrations/0001_init.sql
public/avatars/
scripts/bots.ts        giả lập N người chơi
vercel.json            region sin1
```

## Các bước thực hiện
1. **Khung dự án:** `create-next-app` (TS, Tailwind, App Router), cài các thư viện. Tạo project Supabase, chạy migration, tạo bucket ảnh, cấu hình `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). **Deploy bản rỗng lên Vercel ngay** để phát hiện sớm lỗi cấu hình.
2. **Soạn quiz:** các API quiz, upload ảnh qua signed URL, trang soạn quiz, trang "Quiz của tôi".
3. **Phòng chờ:** tạo game và PIN, trang host hiện QR + PIN, trang join + chọn avatar, kênh realtime và Presence, kick người chơi.
4. **Chơi game:** chuyển trạng thái, đồng hồ, gửi câu trả lời, chấm điểm cả 4 loại câu, reveal, bảng xếp hạng, bục vinh quang.
5. **Xử lý tình huống khó:** refresh/mất mạng thì đồng bộ lại qua `/state`, chặn gửi đáp án 2 lần, nickname trùng, phòng đầy, PIN không tồn tại, host đóng tab.
6. **Song ngữ và hoàn thiện:** đổi ngôn ngữ VI/EN, hiệu ứng chuyển cảnh (CSS/Tailwind), giao diện ưu tiên điện thoại, (tùy chọn) âm thanh tự làm hoặc có license miễn phí.
7. **Load test và deploy production:** chạy bot 30 người, chỉnh độ trễ, deploy và thử với điện thoại thật.

## Kiểm tra
- **Unit test (Vitest):** `scoring.ts` (đủ 4 loại câu, biên thời gian, hệ số 0/1/2), `normalize.ts` (dấu tiếng Việt, hoa/thường, khoảng trắng), tạo PIN, các luật chuyển trạng thái.
- **Bot giả lập:** `npx tsx scripts/bots.ts --pin 123456 --players 30`. Bot vào phòng, nghe realtime và trả lời ngẫu nhiên sau 0.5–8s. Kiểm tra: đủ 30 người hiện ở lobby, `answer_count` khớp, tổng điểm trong DB khớp với `reveal`, không có lỗi 5xx, độ trễ broadcast dưới ~500ms.
- **Thử tay trên máy:** `npm run dev`. Mở trang host trên laptop, dùng 2–3 điện thoại cùng mạng LAN quét QR (truy cập bằng IP LAN). Thử refresh giữa ván, gửi đáp án sát giờ, kick người chơi, đổi VI/EN.
- **Trên Vercel:** deploy bản preview và chạy lại script bot vào URL thật. Một buổi chơi thử thật với 5–10 người.

## Lưu ý vận hành
- Project Supabase gói free **tự tạm dừng sau 7 ngày không hoạt động**. Mở dashboard để bật lại trước buổi chơi, hoặc nâng lên gói Pro nếu dùng thường xuyên.
- Gói free (Supabase 200 kết nối realtime, 2 triệu tin nhắn/tháng; Vercel Hobby) dư sức cho 25–50 người mỗi phòng và vài phòng chạy song song.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ được đặt trong biến môi trường của Vercel, tuyệt đối không có tiền tố `NEXT_PUBLIC_`.
