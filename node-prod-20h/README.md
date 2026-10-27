# node-prod-20h

Chương trình 20 giờ để dùng Node.js trong production tốt hơn 95% kỹ sư Node. Đọc `PLAN.md` trước.
Mọi con số trong `PLAN.md` nằm trong `results-*.jsonl` / `results-*.txt` và chạy lại được bằng các lệnh dưới đây.

## Cần gì
- Linux x86_64, quyền root (cgroup bộ nhớ 256 MB và `unshare --pid`). macOS: chạy trong
  `docker run --rm -it --privileged -v $PWD:/w -w /w node:24 bash` rồi làm như Linux.
- Node 24.22.1 và 26.12.1: chạy `tools/setup-node.sh` (cần npm có sẵn). Script tải hai binary từ npm và tạo
  `bin/node24`, `bin/node26`.
- Không phụ thuộc npm nào khác. Không cần mạng sau khi có hai binary.

## Lệnh
| Việc | Lệnh | Thời gian |
|---|---|---|
| Giá trị mặc định | `bin/node24 tools/defaults.mjs --pretty`; trong container 256 MB: `tools/incg.sh 256M bin/node24 tools/defaults.mjs` | 1 s |
| Harness bơm lỗi, bản naive | `bin/node24 faults/run.mjs naive` | ~2,5 phút |
| Bản của bạn | `cp service/naive.mjs service/mine.mjs` rồi sửa; `bin/node24 faults/run.mjs mine` | ~2,5 phút |
| Một vài lỗi | `bin/node24 faults/run.mjs mine --only F1,F7` | |
| Chấm bản của bạn | `bin/node24 faults/check.mjs results-faults-mine-v24.jsonl` | 0 s |
| Câu production | `bin/node24 quiz/run.mjs --check-key quiz/key-v24.json` | ~1 phút |
| So hai phiên bản | `bin/node24 quiz/run.mjs --diff quiz/key-v24.json quiz/key-v26.json` | 0 s |
| Câu thứ tự thực thi mới | `bin/node24 quiz/gen-eventloop.mjs --seed <số> --count 12` | ~1 phút |
| Nhật ký | `bin/node24 tools/journal-stats.mjs` | 0 s |
| Kiểm mã nguồn | `tools/verify-sources.sh <thư mục chứa node24/ node26/>` | 1 s |
| Dọn tiến trình sót | `tools/cleanup.sh` | |

`_solutions/` chứa lời giải tham khảo. Chỉ mở sau khi `mine.mjs` đạt `faults/CRITERIA.md` hoặc bạn đã dùng hết thời gian của block.

## Cấu trúc
```
PLAN.md                 kế hoạch 20 giờ, mọi số đo, nguồn đã kiểm
service/naive.mjs       service mẫu, bản naive (điểm xuất phát của bạn)
service/_runtime.mjs    phần đo đạc dùng chung (không chứa lời giải)
faults/run.mjs          12 kịch bản bơm lỗi; faults/deps.mjs: DB, upstream giả; faults/CRITERIA.md: ngưỡng đạt
tools/                  load, probe, LB kiểu ALB, relay trễ, cgroup, defaults, verify-sources, journal-stats
b-exp/                  thí nghiệm cơ chế (keep-alive race, PID 1, event loop delay)
quiz/                   bộ sinh câu thứ tự thực thi, 30 câu production, khóa v24/v26, đề công khai
results-*.jsonl         số đo thô của mình trên máy 2 vCPU
```
