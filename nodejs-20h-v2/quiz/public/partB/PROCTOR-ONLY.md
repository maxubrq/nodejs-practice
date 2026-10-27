# Phần B — chỉ người dựng đề (proctor) được mở

Người học **không mở file này** và không mở `b0*.mjs`. Proctor chép 8 câu dưới đây vào Google Forms
(chế độ Quiz, mỗi câu 1 điểm), gắn đáp án, rồi xóa file khỏi máy chung.
Đáp án sinh từ runtime Node v24.22.1 và v26.12.1 (giống nhau ở cả 8 câu). Kiểm lại trước khi dựng đề:
`for f in b0*.mjs; do node $f; done` (b06 cần `npm i undici@7` cạnh file).

Tiêu đề cột trong Form phải bắt đầu bằng mã câu (`B01 ...`) để `grade-responses.mjs` nhận ra.

---

**B01.** Một `http.createServer(async (req, res) => { throw new Error('bug') })`, không có handler `unhandledRejection`,
Node 24 mặc định. Client gửi 1 request. Chuyện gì xảy ra?
- A. Client nhận 500, server tiếp tục chạy
- B. Client chờ tới `requestTimeout` (300 s), server tiếp tục chạy
- C. Client nhận lỗi kết nối (ECONNRESET), tiến trình server thoát mã 1
- D. Client nhận 500, rồi tiến trình server thoát mã 1

**B02.** `await setTimeout(1000, null, { signal: AbortSignal.timeout(100) })` (từ `node:timers/promises`). Lỗi nhận được?
- A. `name: TimeoutError`
- B. `name: AbortError`, `cause.name: TimeoutError`
- C. `name: AbortError`, `cause` là `undefined`
- D. Không lỗi: promise resolve sau 1000 ms

**B03.** `const r = Readable.from(gen())` với `gen` là async generator vô hạn có khối `finally` in log.
`for await (const x of r) { if (x === 3) break; }`. Sau vòng lặp?
- A. `finally` không chạy; `r.destroyed === false`
- B. `finally` chạy; `r.destroyed === true`
- C. `finally` không chạy; `r.destroyed === true`
- D. Vòng lặp treo vì generator vô hạn

**B04.** Server Node 24, `keepAliveTimeout` mặc định. Một client keep-alive vừa xong 1 request, socket đang rảnh.
Gọi `server.close(cb)`. `cb` chạy khi nào?
- A. Gần như ngay (< 1 s)
- B. Sau ~5 s (khi keep-alive hết hạn)
- C. Sau ~6 s (keep-alive + buffer)
- D. Không bao giờ, cho tới khi client tự đóng

**B05.** `s = AbortSignal.any([a.signal, b.signal])`. `b.abort(new Error('from b'))` ở 10 ms,
`a.abort(new Error('from a'))` ở 20 ms. Đọc `s.reason.message` ở 50 ms?
- A. `from a`
- B. `from b`
- C. `AbortError`
- D. `undefined`

**B06.** `new undici.Agent({ connections: 1 })`, 3 lần `await fetch(url, { dispatcher })` nối tiếp, không đọc body
(body 1 MB). Trong 2 s có bao nhiêu `fetch` resolve?
- A. 3
- B. 2
- C. 1
- D. 0

**B07.** Tiến trình con có `process.on('SIGTERM', () => {})` và một `setInterval`. Gửi SIGTERM. 500 ms sau?
- A. Đã thoát với signal SIGTERM
- B. Đã thoát mã 0
- C. Vẫn đang chạy
- D. Đã thoát mã 143

**B08.** `setInterval(async () => { await sleep(350) }, 100)`, chạy 1 s. Số lần callback chạy chồng nhau tối đa?
- A. 1 (setInterval chờ promise)
- B. 2
- C. 4
- D. 10

---
Đáp án: B01 C · B02 B · B03 B · B04 A · B05 B · B06 C · B07 C · B08 C
