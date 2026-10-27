# Node.js production 20h — bộ lab v2 (bổ sung cho nodejs-20h.zip)

Bộ này **cộng thêm** vào bộ cũ (`A-baseline/`, `B-experiments/`, `tools/`, `_solutions/`). Giải nén cạnh bộ cũ.
Kiểm trên Node v24.22.1 (V8 13.6, libuv 1.52.1, undici 7.30.1) và v26.12.1 (V8 14.6, undici 8.12.2),
máy 2 vCPU / 8 GB, tất cả tiến trình chạy chung máy.

```
npm install                      # autocannon 8 + undici 7.30.1 (cùng bản Node 24 đóng gói)
node quiz/run.mjs --check-key quiz/key-v24.json   # khóa đáp án phải khớp runtime của bạn
```
Chạy check-key khi máy rảnh. Một câu khác khóa chỉ một lần rồi khớp ở các lần sau là câu nhạy thời gian;
câu khác khóa ổn định qua 3 lần chạy là khác biệt thật của runtime bạn.

## Cấu trúc
```
service/          service mẫu + DB giả + LB giả
  fakedb.mjs      DB TCP (độ trễ/sập điều khiển được) + upstream stream NDJSON (/stream, có thể treo)
  db-client.mjs   client DB đa luồng trên 1 TCP; queueWhileDown=true mô phỏng pool chờ vô hạn
  service.mjs     MODE=naive | fixed. /user/:id, /ingest, /validate, /export, /health, /metrics
  lb.mjs          L7 LB kiểu cloud: pool keep-alive, bỏ qua Keep-Alive hint, 502 khi backend đóng, health check
faults/run.mjs    bơm 8 lỗi, in 1 dòng JSON mỗi kịch bản. `node faults/run.mjs naive|fixed [kịch bản...]`
b-exp/            thí nghiệm dự đoán-rồi-chạy cho năng lực 3, 5, 6, 7 (e1…e6, h502, oom-offheap, redos-*)
quiz/
  u/              28 câu dự đoán mới (u01–u28) + meta.json (env/cờ/số lần chạy)
  run.mjs         --make-key | --check-key | --diff (đáp án = mọi output khác nhau qua N lần chạy)
  key-v24.json, key-v26.json
  gen-eventloop.mjs   sinh câu thứ tự thực thi MỚI theo seed, đáp án từ runtime, lọc câu có race
  public/         đề công khai: phần A (sinh theo seed) + partB/ (8 câu, chỉ proctor mở)
                  grade-responses.mjs: chấm CSV Google Forms, phân phối, p-value phân vị 95
results-*.jsonl   số đo đã chạy (nguồn của mọi con số trong PLAN-v2.md)
journal.csv       mẫu nhật ký
```

## Bài chính của năng lực 6–7
1. Chạy `node faults/run.mjs naive`. **Trước khi chạy**, ghi dự đoán cho 8 dòng vào `journal.csv`.
2. Đọc `service/service.mjs` nhánh naive. **Không đọc nhánh fixed.** Viết `service/mine.mjs` của bạn,
   chạy harness với nó (`SERVICE_FILE=mine.mjs`), đạt tiêu chí trong `PLAN-v2.md` mục F.
3. So với nhánh fixed sau khi đạt.
