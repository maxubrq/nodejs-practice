# Tiêu chí đạt cho `service/mine.mjs`

Chạy: `bin/node24 faults/run.mjs mine && bin/node24 faults/check.mjs results-faults-mine-v24.jsonl`.
Lặp lại trên `bin/node26`. Đạt = 12/12 trên cả hai bản.
Mọi kịch bản có health probe (GET /health mỗi 50 ms, timeout 1 s) còn phải có **0 lỗi probe** (trừ F5, F6 đã tính riêng).

| Lỗi | Bơm thế nào | Tiêu chí |
|---|---|---|
| F1 DB chậm | DB trễ 5 s; 100 kết nối gọi `/user` trong 8 s, client timeout 10 s | p99 ≤ 500 ms (bản tham khảo đặt deadline 300 ms; phần dư là nhiễu đo trên máy 2 lõi chạy chung tải); 0 timeout; 0 query còn chạy ở DB 1,5 s sau khi tải dừng |
| F2 DB sập | DB đóng listener và mọi kết nối; 50 kết nối gọi `/user` 5 s, client timeout 3 s | 0 timeout; p99 ≤ 50 ms (fail nhanh bằng 503) |
| F3 client ngắt | 50 client tải `/export`, ngắt sau 200 ms | 0 stream upstream còn mở sau 1,5 s |
| F4 upstream treo | upstream gửi 10 dòng rồi im; 20 client, timeout 10 s | server tự đóng 20/20 trong ≤ 2,5 s; 0 upstream còn mở |
| F5 payload lớn | 4 × POST `/ingest` 60 MB đồng thời, service trong cgroup 256 MB | service sống, 0 OOM kill; RSS max ≤ 100 MB; probe 0 lỗi |
| F6 ReDoS | 3 × `/validate?name=` 27 chữ `a` + `!` | mỗi request ≤ 50 ms; probe 0 lỗi |
| F7 SIGTERM dưới tải | 2 backend sau LB (health check 200 ms); SIGTERM backend 1 ở giây 2 | 0 non-2xx; backend 1 thoát mã 0 |
| F8 keep-alive < idle LB | LB giữ kết nối 60 s, không đọc hint; RTT LB–backend 2 ms; 30 client nghỉ 6000 ± 25 ms | 0 lỗi 502 |
| F9 promise bị bỏ rơi | gọi `/notify` (audit trả 500), rồi tải `/health` 2 s | service sống; 0 lỗi |
| F10 threadpool cạn | 8 kết nối `/avatar` (pbkdf2) cùng 4 kết nối `/config` (readFile), 5 s | `/config` p99 ≤ 50 ms |
| F11 leak listener | 5000 request `/sub` | heap sau GC tăng ≤ 2 MB; không có MaxListenersExceededWarning |
| F12 PID 1 | service chạy làm PID 1 trong PID namespace riêng, nhận SIGTERM | thoát trong ≤ 3 s |

Không được: đổi route, đổi định dạng response thành công, sửa `_runtime.mjs`, sửa harness.
Được: mọi thứ khác, kể cả kiến trúc pool, giới hạn, cờ dòng lệnh đặt trong code.
