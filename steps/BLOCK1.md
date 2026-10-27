# Block 1 · 1:30–4:00 · Event loop và hàng đợi (N1)

Nguồn: `node-prod-20h/PLAN.md` mục 6 (Block 1), mục 3 (hàng N1), mục 5.
Mục tiêu: dự đoán đúng thứ tự thực thi, và giải thích được bằng **tên hàng đợi / phase / hàm** trong mã nguồn.
Đầu ra: **≥ 90% đúng trên seed 103 và một seed tự chọn, mọi câu tự tin 5 đều đúng.**

Làm từ thư mục:

```sh
cd /Users/hungtran/MyApps/Node20-Practice/node-prod-20h
```

Phần lệnh chấm trong file này mình chưa chạy thử trên máy bạn. Xem "Lưu ý" ở cuối.

---

## 0. Điểm xuất phát (từ Block 0)

Event loop giờ 0: 21/36 (58%). Mức tự tin 5: 18/27 đúng, 9 câu mức 5 mà sai:
`s101-g08`, `s201-g02`, `s201-g04`, `s201-g07`, `s201-g08`, `s201-g11`, `pa-g03`, `pa-g11`, `pa-g12`.

Hai điểm yếu rõ trong số liệu của bạn:
- **ESM:** `s201` (ESM) đúng 7/12 nhưng bạn ghi mức 5 gần như mọi câu. Đọc kỹ `lib/internal/modules/esm/module_job.js` (mục 2) để hiểu mã chạy trong ESM khác CJS ở đâu.
- **Đổi chỗ hai chữ liền kề** trong cùng một phase (ví dụ `setTimeout` vs `setImmediate`, callback `fs.stat` vs microtask). Đây là chỗ `uv_run` quyết định.

---

## 1. Chuẩn bị

Không cần clone cả repo Node. Các file mã nguồn Block 1 đã tải về `source/block1/` (từ tag `v24.22.1`, giữ nguyên cấu trúc thư mục của repo `nodejs/node`):

```
/Users/hungtran/MyApps/Node20-Practice/source/block1/
├── deps/uv/src/unix/core.c
├── lib/internal/timers.js
├── lib/internal/process/task_queues.js
├── lib/internal/process/promises.js
├── lib/internal/modules/esm/module_job.js
├── test/parallel/test-timers-immediate-queue.js
└── test/parallel/test-next-tick-ordering.js
```

Chỉ đọc, không chạy. Số dòng trong mục 2 đã kiểm trên đúng các file này.
Muốn tải lại một file: `curl -fsSL https://raw.githubusercontent.com/nodejs/node/v24.22.1/<đường dẫn> -o source/block1/<đường dẫn>`.

---

## 2. File cần để ý

**Đọc (60 phút)**, theo thứ tự này (số dòng là v24.22.1, đã kiểm; đường dẫn tính từ `source/block1/`):

| # | File | Vị trí | Đọc để hiểu |
|---|---|---|---|
| 1 | `deps/uv/src/unix/core.c` | `uv_run` :427 | Thứ tự phase: timers chạy một lần trước vòng đầu, sau đó ở **cuối** mỗi vòng, sau poll, check và close |
| 2 | `lib/internal/timers.js` | `processTimers` :603 | Cách timer đến hạn được chạy; chỗ gọi `runNextTicks` giữa các callback |
| 3 | `lib/internal/timers.js` | `processImmediate` :525 | Hàng đợi `setImmediate` và `runNextTicks` giữa các callback |
| 4 | `lib/internal/process/task_queues.js` | `processTicksAndRejections` :72 | Hàng nextTick trước, microtask sau, lặp tới khi cả hai cạn |
| 5 | `lib/internal/process/promises.js` | `processPromiseRejections` :439 | Khi nào xử lý rejection chưa bắt |
| 6 | `lib/internal/modules/esm/module_job.js` | `ModuleJob.run` :550 | Vì sao ESM khác CJS (câu s201 của bạn) |

Test khóa hành vi (đã tải vào `source/block1/test/parallel/`, đọc để thấy đúng ý của người viết Node):
`test/parallel/test-timers-immediate-queue.js`, `test/parallel/test-next-tick-ordering.js`.

**Nhật ký:** `journal.csv`, mọi dòng của block này có `gio_hoc` = `1.5` (giờ bắt đầu block), `block` = `1`.

**Câu hỏi:**

| File | Dùng khi |
|---|---|
| `quiz/out/seed102/questions.md` | Dự đoán (12 câu CJS) |
| `quiz/out/seed102/gNN.cjs` | Chạy để chấm |
| `quiz/out/seed102/key.json` | **Cấm mở** trước khi ghi xong dự đoán |
| `quiz/out/seed103/questions.md`, `key.json`, `gNN.cjs` | Bài kiểm đầu ra, **không mở** trước mục 5 |
| `quiz/gen-eventloop.mjs` | Sinh bộ câu mới (seed tự chọn) |
| `quiz/check-seed.mjs` | Kiểm bộ câu trên runtime của bạn |
| `mini-loop.js` | File bạn tự viết ở mục 4 |

---

## 3. Thí nghiệm, seed 102 (~40 phút)

1. **Đọc mã nguồn trước** (60 phút ở mục 2), **rồi** mới đọc `quiz/out/seed102/questions.md`. Plan dựng block theo thứ tự đọc → đoán → chạy.
2. Ghi 12 dòng vào `journal.csv` **trước khi chạy**, với `ma_cau` = `s102-g01` … `s102-g12`, `du_doan`, `tu_tin_1_5`:

   ```csv
   2026-10-27,1.5,1,s102-g01,"timers, microtask",ABCD,4,,,,
   ```

3. **Chấm:**

   ```sh
   for f in quiz/out/seed102/g*.cjs; do echo "$(basename $f .cjs)  $(node $f)"; done
   ```

   Điền `ket_qua_runtime`, `dung_sai` (`dung`/`sai`).
4. **Mỗi câu sai: viết một biến thể.** Đổi đúng một thứ, đoán lại trước khi chạy:
   - đổi phase (ví dụ `setTimeout 0` thành `setImmediate`),
   - đổi thứ tự đăng ký hai callback,
   - thêm một tầng async,
   - đổi phiên bản (`bin/node24` vs `bin/node26` nếu đã chạy `tools/setup-node.sh`).
5. Mỗi câu sai điền `vi_sao_co_che`: nêu **tên hàng đợi, phase hoặc hàm**, ví dụ "`processTicksAndRejections` chạy hết nextTick rồi mới `runMicrotasks`". "Vì async" không tính. Điền `nguon_da_kiem` bằng file:dòng, ví dụ `lib/internal/process/task_queues.js:72`.

---

## 4. Tự dựng `mini-loop.js` (45 phút)

Viết `node-prod-20h/mini-loop.js` mô phỏng event loop theo `uv_run`, rồi chạy lại 12 câu seed 102 bằng API của bạn.

Hàng đợi bạn cần mô phỏng (đúng như tên trong plan):
1. hàng `nextTick`,
2. hàng microtask (promise, `queueMicrotask`),
3. `timers`,
4. `immediate` (check),
5. phase poll (callback `fs.stat` đã xong),
6. close.

Yêu cầu từ plan:
- Chạy `process.nextTick`, `Promise.resolve().then`, `queueMicrotask`, `setTimeout`, `setImmediate`, `fs.stat` và `await` thông qua **API của bạn** (ví dụ `mini.nextTick`, `mini.setImmediate`), không dùng API thật của Node.
- **Khớp ≥ 11/12 câu** của seed 102 (so với `key.json`, sau khi bạn chấm xong mục 3).
- Chỗ cần đúng: hai quy tắc đã nằm trong mục 2: timers chạy một lần trước vòng đầu rồi chạy ở cuối vòng; `runNextTicks` chạy **giữa các callback** của timers và immediate, không chỉ giữa các phase.

Gợi ý chia việc: bắt đầu với CJS (không có `await`, không có ESM); thêm `await` sau khi 8–9 câu khớp.

---

## 5. Kiểm đầu ra (~15 phút)

**Seed 103 (câu mới, bạn chưa thấy):**

1. Đọc `quiz/out/seed103/questions.md`. Ghi 12 dự đoán vào `journal.csv` (`ma_cau` = `s103-g01` …) **trước khi chạy**.
2. Chấm:

   ```sh
   for f in quiz/out/seed103/g*.cjs; do echo "$(basename $f .cjs)  $(node $f)"; done
   ```

**Một seed tự chọn (mới hoàn toàn):** sinh bằng một số bạn chưa dùng (không phải 101, 102, 103, 201 và seed của phần A):

```sh
node quiz/gen-eventloop.mjs --seed <số mới> --count 12 --out /tmp/myseed
```

Vấn đề: lệnh này tạo `key.json` ngay cạnh `questions.md`, bạn sẽ thấy đáp án. Cách sạch nhất là nhờ mình (hoặc người khác) sinh bộ câu giúp bạn như ở phần A. Mình sẽ giữ khóa và chỉ đưa đề.

**Đạt khi:**
- ≥ 90% đúng trên câu mới của block, tức ≥ 22/24 nếu gộp hai bộ 12 câu (≥ 11/12 mỗi bộ).
- **mọi** câu tự tin 5 đều đúng.

**Chưa đạt:** làm 5 biến thể của câu sai (mục 3, bước 4), tối đa 30 phút, rồi đi tiếp sang Block 2 và ghi lỗ hổng vào `journal.csv` (cột `vi_sao_co_che`).

---

## 6. Kiểm cuối block

```sh
node tools/journal-stats.mjs
```

Xem `theo block` (block `1`) và `theo tự tin`. Câu mức 5 mà sai được liệt kê ở dòng `TỰ TIN 5 MÀ SAI`; so với 9 câu của Block 0.

---

## 7. Tổng thời gian

| Việc | Phút |
|---|---|
| Đọc mã nguồn (mục 2) | 60 |
| Seed 102 + biến thể (mục 3) | ~40 |
| `mini-loop.js` (mục 4) | 45 |
| Seed 103 + seed tự chọn (mục 5) | ~15 |
| **Tổng** | **~160**, block là 150 phút |

Block 0 có thể vượt giờ, Block 1 cũng vậy. Nếu thiếu giờ thì rút bớt phần biến thể (mục 3, bước 4) trước.

---

## Lưu ý

1. **Số dòng đã kiểm** trên `source/block1/` (khớp PLAN: 427, 603, 525, 72, 439). Nếu sau này đổi sang tag khác, dùng `grep -n "function processTimers" lib/internal/timers.js` để tìm lại.
2. **Node local lệch bản.** Bạn đang dùng v24.10.0. Chấm thứ tự thực thi bằng chạy máy thường ổn (PLAN kiểm chéo v24/v26: 48/48 khớp). Nếu thấy lệch so với `key.json`, chạy `node quiz/check-seed.mjs quiz/out/seed102 20`.
3. **Chưa chạy thử** vòng lặp chấm seed 102/103. `mini-loop.js` chưa tồn tại: đây là bài bạn tự làm.
4. **Seed 103 và seed tự chọn có `key.json` cạnh đề.** Không mở trước khi dự đoán, tương tự Block 0.
