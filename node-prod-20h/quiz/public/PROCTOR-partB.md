# Phần B — dành cho người coi thi (PROCTOR). Người học KHÔNG làm các bước dưới đây.

Người học đã thấy 30 câu gốc trong `quiz/prod/`. Phần B dùng **biến thể**: cùng chủ đề, đổi một tham số,
nên đáp án khác câu gốc. Người coi thi tự tạo biến thể, tự sinh khóa từ runtime, và giữ khóa cho tới khi chấm.

## Cách dựng (30 phút)

1. Chép thư mục `quiz/prod/` sang một chỗ người học không thấy, ví dụ `~/partB/prod/`.
2. Chọn 8 câu theo bảng dưới. Với mỗi câu, đổi đúng một tham số theo cột "Đổi gì" (hoặc một thay đổi tương đương
   do bạn tự nghĩ). Đặt tên lại `p01.mjs` … `p08.mjs`.
3. Chạy `RUNS=10 QUIZ_DIR=~/partB/prod node quiz/run.mjs`
   để in output. Bỏ câu nào có `[racy]`.
4. Viết mỗi câu thành câu trắc nghiệm 4 lựa chọn trong Google Form: 1 lựa chọn là output thật, 3 lựa chọn là output
   của các biến thể lân cận (ví dụ các mã thoát, thứ tự, hoặc giá trị khác). Tiêu đề câu bắt đầu bằng `B01` … `B08`.
5. Ghi `key-partB.json` dạng `{ "answers": { "B01": "C", ... } }` và giữ riêng.

| Câu gốc | Chủ đề | Đổi gì |
|---|---|---|
| p02 | unhandled rejection | gắn `.catch` trong `process.nextTick` thay vì `setTimeout 0`; hoặc chạy với `--unhandled-rejections=warn` |
| p06 | pipeline | đổi nguồn lỗi thành đích lỗi (`dst.destroy(err)`), hỏi `src.destroyed` |
| p07 | backpressure | `highWaterMark` 10, mỗi lần ghi 4 byte |
| p11 | client ngắt | client ngắt ở 300 ms, handler xong ở 100 ms |
| p13 | server.close | thêm một request đang chạy 300 ms bên cạnh kết nối rảnh |
| p16 | keep-alive hint | `keepAliveTimeout: 3000`, khoảng cách 2 request 500 ms |
| p23 | threadpool | `UV_THREADPOOL_SIZE=2` và thêm một `crypto.scrypt` |
| p28 | 413 không đọc body | server đặt `connection: close` khi trả 413 |

Bản Node: ghi ở đầu Form "Đáp án áp dụng cho Node 24 LTS (24.22.1)". Nếu bạn sinh khóa trên bản khác, ghi bản đó.
