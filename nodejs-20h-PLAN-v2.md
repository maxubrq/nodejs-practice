# Kế hoạch 20 giờ v2: Sử dụng Node.js trong production

**Mục tiêu:** sau 20 giờ, sử dụng Node.js tốt hơn 95% kỹ sư Node đang làm production, đo bằng 7 năng lực dưới đây.
**Phiên bản:** Node 24 LTS (kiểm trên v24.22.1: V8 13.6, libuv 1.52.1, undici 7.30.1). Đối chiếu v26.12.1
(V8 14.6, libuv 1.52.1, undici 8.12.2); v26 lên LTS ngày 28/10/2026.
**Máy đo:** 2 vCPU, 8 GB, cgroup v1. Tải, service, DB giả và LB giả chạy chung máy, nên số tuyệt đối sẽ khác trên
máy bạn; tỉ lệ naive/fixed và các số đếm (lỗi, kết nối còn mở) thì không phụ thuộc máy.
**Quan hệ với bộ v1:** giữ nguyên `A-baseline/`, `B-experiments/`, `tools/`, `_solutions/` (D1–D3, build-stream,
q01–q30, h01–h10). Bộ v2 thêm `service/`, `faults/`, `b-exp/`, `quiz/`. Mọi số trong file này nằm trong
`results-*.jsonl` hoặc output của script được nêu tên.

---

## 1. Bảy năng lực và cách chấm

| # | Năng lực | Đạt khi | Đo bằng |
|---|---|---|---|
| 1 | Dự đoán thứ tự thực thi | ≥ 90% câu **mới** đúng; mọi câu tự tin 5 đúng | `quiz/gen-eventloop.mjs` (câu sinh theo seed, chưa ai thấy) + h01–h10 |
| 2 | Threadpool libuv | Nêu đúng API nào vào pool; dự đoán u21, u21b, u22 trên cả v24 và v26; biểu đồ p99 theo `UV_THREADPOOL_SIZE` | D1 (v1), u21/u22 |
| 3 | Leak và bộ nhớ | Đường retainer khớp `tools/retainers.mjs`; giải thích và tái hiện OOMKilled khi heap còn trống | D2 (v1), `b-exp/oom-offheap.js` |
| 4 | Transform đúng backpressure | 5 GB với `--max-old-space-size=48`, exit 0, RSS max < 256 MB | build-stream (v1) |
| 5 | Flamegraph và event loop lag | Tìm đúng hàm nóng; đọc đúng `monitorEventLoopDelay` ở cả 2 chế độ lấy mẫu | D3 (v1), `b-exp/e6-eld.js` |
| 6 | Ngữ nghĩa lỗi và vòng đời | `mine.mjs` của bạn đạt F1–F7 ở mục 4 | `faults/run.mjs` |
| 7 | HTTP production | Tái hiện 502 ngắt quãng, sửa về 0/500; nói được 4 timeout phía server và 3 phía client | `b-exp/h502.mjs`, e4, e5 |

**Quy tắc (giữ từ v1):** mọi khẳng định có script; dự đoán ra giấy trước, kèm tự tin 1–5, ghi `journal.csv`;
runtime mâu thuẫn với giải thích thì runtime thắng, rồi tìm dòng mã nguồn; cột `nguon_da_kiem` ghi đường dẫn file.
**Ngưỡng chuyển block:** ≥ 90% dự đoán đúng trên câu mới của block và mọi câu tự tin 5 đúng. Chưa đạt thì làm
5 biến thể của câu sai (đổi pha xảy ra, đổi thứ tự đăng ký, thêm một tầng async), tối đa 30 phút, rồi đi tiếp.

---

## 2. Lịch 20 giờ

So với v1: V8 rút từ 3 giờ xuống 1,5 giờ; module loader + worker gộp còn 1,5 giờ. 5 giờ được giải phóng cho
năng lực 6 và 7.

### Block 0 — 0:00 → 1:30 · Baseline
- Bộ v1 `A-baseline/` như cũ (60 phút).
- `quiz/u/` 28 câu: chỉ dự đoán, không chạy (20 phút). Chấm: `node quiz/run.mjs --check-key quiz/key-v24.json`
  in khác biệt; so dự đoán của bạn với `key-v24.json` sau khi ghi xong.
- **Dự đoán bảng naive ở mục 4** (8 dòng, 10 phút) trước khi bất kỳ ai chạy harness. Đây là baseline của năng lực 6–7.
- Làm phần A đề công khai (mục 7.2) **ngay bây giờ**, trước khi học, dưới cùng điều kiện người khác sẽ làm.

### Block 1 — 1:30 → 5:30 · Event loop, hàng đợi, threadpool (năng lực 1, 2)
**Đọc (70 phút)** — đường dẫn đã kiểm trên tag `v24.22.1`:
- `deps/uv/src/unix/core.c` (`uv_run`, `uv__run_timers`), `deps/uv/src/threadpool.c` (`init_once`, `UV_THREADPOOL_SIZE`).
- `lib/internal/timers.js` (`getTimerCallbacks`, `processTimers`, `listOnTimeout`, `processImmediate`, chỗ gọi `runNextTicks`).
- `lib/internal/process/task_queues.js` (`processTicksAndRejections`, `runMicrotasks`).
- v26: `lib/fs.js` hàm `readFile` (dòng 455–462 ở tag v26.12.1: `ReadFileJob`, open+fstat+read+close trong **một** chuyến
  threadpool, PR #65327, có từ v26.8.0, không backport sang v24).

**Thí nghiệm (đã chạy):**
- u01: main CJS `setTimeout 0` với `setImmediate` → cả hai thứ tự đều xuất hiện. u02 trong I/O callback → luôn immediate trước.
- u09 (immediate lồng immediate, đặt timer 0 bên trong): **không xác định** trên cả v24 và v26, 52/60 lần `imm-B` trước,
  8/60 lần `timeout` trước. Lý do: timer 1 ms đã hết hạn hay chưa khi vòng sau tới pha timers.
- u03 vs u04: cùng code, CJS in `sync / tick / then / microtask`, ESM in `sync / then / microtask / tick`.
- u21 (`UV_THREADPOOL_SIZE=1`): `pbkdf2` trước `stat`; u21b (size 4): `stat` trước.
- u22 (size 1, pbkdf2 chạy trước): v24 `pbkdf2 < lookup < readFile < promises.readFile`;
  v26 `pbkdf2 < readFile < promises.readFile < lookup`. Giải thích bằng số chuyến threadpool mỗi API cần.
- Từ v1: `b1-starve.js`, `b1-timers-end.js`, D1 với size 1/4/16/64.
- `quiz/gen-eventloop.mjs --seed <số bạn chọn> --count 12`: luyện trên câu mới vô hạn. Tỉ lệ đúng trên 3 bộ seed
  liên tiếp là số đo năng lực 1.

**Tự dựng (45 phút):** `mini-loop.js` như v1, chạy trên 12 câu sinh ra, khớp ≥ 11/12.
**Đầu ra:** ≥ 90% trên 2 bộ seed mới liên tiếp; biểu đồ p99 theo threadpool.

### Block 2 — 5:30 → 7:00 · Bộ nhớ: V8 heap, off-heap, container (năng lực 3)
**Đọc (30 phút):** `src/api/environment.cc` dòng 211–220 (heap mặc định lấy `min(tổng RAM, cgroup limit)`);
`src/node_options.cc` quanh dòng 157 (`--max-old-space-size-percentage` dùng `uv_get_constrained_memory`);
`doc/api/cli.md` mục `--max-old-space-size-percentage`; v8.dev/blog/trash-talk (chỉ phần Scavenger/Mark-Compact).

**Thí nghiệm (đã chạy, cgroup v1 giới hạn 256 MB):**
`b-exp/oom-offheap.js` cấp 20 MB Buffer mỗi bước. Kết quả: `heap_size_limit` = 259 MB (bằng cả container),
`heapUsed` giữ ~4 MB, `arrayBuffers` lên 240 MB, rồi kernel **SIGKILL** (exit 137, `oom_kill 1`). Heap không bao giờ đầy.
Rút ra 2 điều: (1) Buffer, ArrayBuffer, bộ nhớ native nằm ngoài heap V8; (2) trong container nhỏ, heap mặc định đã bằng
cả container nên V8 không thể OOM trước kernel. Sửa: `--max-old-space-size-percentage` (đặt mức cho heap, chừa chỗ
off-heap) và giới hạn đầu vào (F5).
Tự làm cgroup trên Linux của bạn: `mkdir /sys/fs/cgroup/memory/t && echo 268435456 > .../memory.limit_in_bytes`
(cgroup v1) hoặc `systemd-run --scope -p MemoryMax=256M node ...` (cgroup v2). **[cần kiểm]** trên macOS không có
cgroup; chạy trong Docker `--memory=256m`.
- Giữ từ v1: `b2-hidden-class.js`, `b2-deopt.js` (bỏ `b2-gc.js` và cpu-prof so deopt).

**Đầu ra:** bảng 3 cột `heapUsed / arrayBuffers / rss` lúc bị giết, và 1 câu giải thích tại sao heap không cứu được.

### Block 3 — 7:00 → 10:00 · Stream và backpressure (năng lực 4)
Giữ nguyên block 3 của v1. Hai mục `[cần kiểm]` của v1 đã giải:
- Readable mặc định 65536 byte từ **v22.0.0** (SEMVER-MAJOR, PR #52037, `CHANGELOG_V22.md`); **Windows vẫn 16 KB**
  (`lib/internal/streams/state.js` dòng 12). u15 in `65536 65536 16 65536` trên Linux.
Thêm: u13 (write trả `false` ở lần 4, nhận đủ 30 byte), u14 (`.pipe()` không hủy đích khi nguồn lỗi, `pipeline()` có),
`b-exp/e3-pipe-vs-pipeline.mjs` (với `.pipe()`: còn 1 fd mở; với `pipeline()`: 0).

### Block 4 — 10:00 → 13:00 · Lỗi, hủy, vòng đời (năng lực 6)
**Đọc (50 phút):**
- `lib/internal/process/promises.js` (`processPromiseRejections`, `throwUnhandledRejectionsMode`) và
  `doc/api/process.md` mục `--unhandled-rejections`.
- `lib/internal/streams/pipeline.js` (`pipelineImpl`, `destroyer`), `lib/internal/streams/end-of-stream.js` (`eos`).
- `lib/internal/abort_controller.js` (`AbortSignal.any`, `AbortSignal.timeout`).
- `lib/_http_server.js` (`resOnFinish`, `closeIdleConnections`, `closeAllConnections`), `lib/_http_outgoing.js`
  (`write_`, `ERR_STREAM_DESTROYED`).
- fastify v5.12.7 `lib/route.js` (`return503OnClosing`, `forceCloseConnections`), `lib/content-type-parser.js` (`bodyLimit`):
  cách một framework do core contributor viết xử lý đúng những chỗ này.

**Thí nghiệm dự đoán rồi chạy (đã chạy, v24 = v26):**
- `e1-req-close.mjs`: client đợi → `res close` lúc 502 ms, `writableFinished=true`; client ngắt lúc 100 ms →
  `res close` lúc 102 ms, `writableFinished=false`, handler vẫn chạy tới 501 ms và `res.end()` **không ném lỗi**.
  Tín hiệu "client đã đi" là `res 'close'` + `!res.writableFinished`.
- `e2-unhandled.mjs`: reject rồi gắn `.catch` sau `await null; await null` hoặc trong `nextTick` → không crash;
  gắn trong `setTimeout 0` hoặc `setImmediate` → **exit 1**. Ranh giới là lúc `processTicksAndRejections` chạy xong.
- `quiz/public/partB` (không mở, xem 7.2) phủ thêm 8 tình huống cùng nhóm.

**Bài chính (100 phút):** chạy `faults/run.mjs naive`, so với dự đoán ở block 0. Viết `service/mine.mjs` từ nhánh naive
(không đọc nhánh fixed). Chạy `SERVICE_FILE=mine.mjs node faults/run.mjs fixed` tới khi đạt F1–F6.

### Block 5 — 13:00 → 15:00 · HTTP production (năng lực 7)
**Đọc (35 phút):**
- `lib/_http_server.js` dòng 545–570 (mặc định `headersTimeout` = min(60 s, requestTimeout), `keepAliveTimeout` 5 s,
  `keepAliveTimeoutBuffer` 1 s) và dòng 1131–1141 (socket thật sự hết hạn ở `keepAliveTimeout + keepAliveTimeoutBuffer`).
  `keepAliveTimeoutBuffer` có từ **v24.6.0**, sửa ở v24.8.0 (`CHANGELOG_V24.md`).
- `lib/_http_agent.js` dòng 665–685: Agent của Node đọc hint `Keep-Alive: timeout=N` và hết hạn socket ở N − 1 s
  (`agentKeepAliveTimeoutBuffer`, từ v24.7.0). Load balancer cloud **không** đọc hint, nên lỗi chỉ hiện sau LB.
- undici v7.30.1: `lib/dispatcher/client.js` dòng 262–263 (`bodyTimeout`, `headersTimeout` mặc định 300 s),
  `lib/util/timers.js` dòng 30–40 (timer thô, `TICK_MS` 499), `lib/dispatcher/client-h1.js` dòng 267
  (`setFastTimeout` cho timeout parser), `lib/dispatcher/pool.js` (`connections`).

**Thí nghiệm (đã chạy):**

| Script | Kết quả v24.22.1 | v26.12.1 |
|---|---|---|
| `h502.mjs 100 1 500` (backend keep-alive 100 ms → đóng ở 1100 ms; LB idle 60 s; 1 client, khoảng nghỉ 1070–1130 ms) | **5/500 lỗi 502** (2 FIN, 3 ECONNRESET) | 3/500 |
| `GAP_MS=1100 h502.mjs 65000 1 500` (keep-alive backend > idle của LB) | 0/500 | 0/500 |
| `e4-keepalive-block.mjs 3000 timer` (block 3 s trong pha timers, socket hết hạn ở 2 s) | request 2 → 200 | 200 |
| `e4-keepalive-block.mjs 3000 io` (cùng block nhưng trong một I/O callback) | **kết nối đóng, không response** | giống |
| `e5-fetch-timeouts.mjs` 1: không có header, `AbortSignal.timeout(500)` | `TimeoutError` sau 504 ms | giống |
| 2: có header rồi treo body | `fetch` resolve sau 10 ms; `text()` ném `TimeoutError` sau 502 ms | giống |
| 3: `Agent({ bodyTimeout: 500 })` | `UND_ERR_BODY_TIMEOUT` sau **1006 ms** (timer thô) | giống |
| 4: 200 fetch đồng thời, dispatcher mặc định | **198 kết nối TCP** | 200 |
| 4b: `Agent({ connections: 10 })` | 10 kết nối, 6077 ms | 10, 6088 ms |

Dòng e4 là cơ chế đằng sau một lỗi khó thấy: khi event loop bị chặn **trong I/O callback**, vòng lặp đi tiếp tới pha
timers trước khi đọc dữ liệu mới, nên timer keep-alive đóng socket dù request đã nằm trong buffer. Bị chặn trong pha
timers thì pha poll đọc request trước. Harness F6 thấy đúng chuyện này: health probe nhận `ECONNRESET` sau ReDoS 15,7 s.

**Bài:** sửa backend của `h502` sao cho 0/500 với khoảng nghỉ bất kỳ (quy tắc: keep-alive backend > idle timeout LB;
nhớ `headersTimeout` phải ≤ `requestTimeout`, nếu không constructor ném `ERR_OUT_OF_RANGE`, `lib/_http_server.js` dòng 553). Viết bảng 7 timeout:
server `headersTimeout`, `requestTimeout`, `keepAliveTimeout`, `keepAliveTimeoutBuffer`; client undici `headersTimeout`,
`bodyTimeout`, `connections`, mỗi ô ghi mặc định đo được trên máy bạn (u19 in sẵn 4 giá trị server:
`5000 / 1000 / 60000 / 300000`).

### Block 6 — 15:00 → 17:30 · Chẩn đoán (năng lực 3, 5)
- Làm lại D1, D2, D3 (v1) có bấm giờ, mỗi bài ≤ 20 phút.
- `monitorEventLoopDelay`: `[cần kiểm]` của v1 đã giải. `src/histogram-inl.h` dòng 176: `RecordDelta` ghi
  `time - prev_` giữa hai lần timer chạy, tức khoảng cách giữa hai lần lấy mẫu, gồm cả `resolution`. Vì vậy p50 khi rảnh
  ≈ resolution (u26: p50 gần 20 ms với resolution 20).
- Chế độ mới `samplePerIteration` (v24.19.0): `e6-eld.js` đo khi rảnh: interval p50 10,1 ms; per-iteration p50 0,1 ms.
  Khi chặn 5 × 100 ms: interval max 109,4 ms (= 100 + resolution), per-iteration max 100,4 ms. Tài liệu ghi rõ hai chế
  độ không so trực tiếp được.
- ReDoS: `b-exp/redos-tierup.js` cho thấy lần gọi regex **đầu tiên** chậm hơn 7–8 lần (1018 ms so với 128–144 ms với
  24 ký tự trên v24) vì V8 thông dịch regex trước khi biên dịch; `--regexp-tier-up-ticks=0` xóa chênh lệch.
  `--enable-experimental-regexp-engine-on-excessive-backtracks` đưa 26 ký tự từ 578 ms xuống 0,3 ms trên v24.
  Kẻ tấn công chỉ cần một request: F6 naive tốn 15,7 s (v24) và 20,4 s (v26) với 28 ký tự.

### Block 7 — 17:30 → 19:00 · Module, async context, worker (gộp)
- `require(esm)` **stable từ v24.15.0** (PR #60959, `doc/api/modules.md`). u24: module không có top-level await → `a: 1`;
  có → `ERR_REQUIRE_ASYNC_MODULE`. `[cần kiểm]` của v1 đã giải.
- u23: listener đăng ký trong context A, `emit` từ B → listener thấy `B`. Dual package (`b4-dual` v1) và
  `AsyncResource.bind` cho pool kết nối tự viết, 30 phút.
- u25: `postMessage` với transferList → phía gửi còn 0 byte. `b6-transfer.js` (v1). Bỏ bảng chọn worker/cluster đầy đủ.

### Block 8 — 19:00 → 20:00 · Đo lại
- `A-baseline/` + h01–h10 (v1), 3 bộ `gen-eventloop` seed mới, `faults/run.mjs` với `mine.mjs`.
- Phần A đề công khai với seed mới; phần B lần đầu (bạn chưa thấy).
- Hiệu chỉnh độ tự tin từ `journal.csv`: tỉ lệ đúng theo từng mức tự tin 1–5; mức 5 phải ≥ 95%.

---

## 3. Nguyên liệu thô theo năng lực

| # | Mã nguồn (tag v24.22.1 trừ khi ghi khác) | Test khóa hành vi (`test/…`) | Thư viện | Changelog / tài liệu |
|---|---|---|---|---|
| 1 | `deps/uv/src/unix/core.c`, `lib/internal/timers.js`, `lib/internal/process/task_queues.js` | `parallel/test-timers-immediate-queue.js`, `parallel/test-next-tick-ordering.js` | — | — |
| 2 | `deps/uv/src/threadpool.c`; v26 `lib/fs.js` `ReadFileJob` | `parallel/test-fs-readfile.js` | — | `CHANGELOG_V26.md` PR #65327 (26.8.0), #65489 (26.9.0, ghi file một chuyến) |
| 3 | `src/api/environment.cc` 211–220, `src/node_options.cc` | `parallel/test-max-old-space-size-percentage.js`, `parallel/test-heapsnapshot-near-heap-limit-worker.js`, `report/test-report-fatalerror-oomerror-compact.js` | — | `doc/api/cli.md` |
| 4 | `lib/internal/streams/{writable,readable,pipeline,state}.js` | `parallel/test-stream-pipeline.js`, `parallel/test-stream-pipeline-listeners.js` | — | `CHANGELOG_V22.md` PR #52037 |
| 5 | `src/histogram-inl.h` 176, `src/node_perf.cc` 289–310, `lib/internal/perf/event_loop_delay.js` | `sequential/test-performance-eventloopdelay.js`, `parallel/test-perf-hooks-histogram.js` | pino v10.4.0 `lib/transport.js` (log qua worker, không chặn loop) | `doc/api/perf_hooks.md` (`samplePerIteration`, v24.19.0) |
| 6 | `lib/internal/process/promises.js`, `lib/internal/abort_controller.js`, `lib/_http_outgoing.js` | `parallel/test-promises-unhandled-rejections.js`, `parallel/test-promise-unhandled-flag.js`, `parallel/test-abortsignal-any.mjs`, `parallel/test-abort-controller-any-timeout.js`, `parallel/test-http-outgoing-destroyed.js`, `parallel/test-http-server-close-idle.js`, `parallel/test-http-server-close-all.js` | fastify v5.12.7 `lib/route.js`, `lib/content-type-parser.js` | `doc/api/deprecations.md` |
| 7 | `lib/_http_server.js` 545–570, 1131–1141; `lib/_http_agent.js` 665–685 | `parallel/test-http-keep-alive-timeout-buffer.js`, `parallel/test-http-keep-alive-timeout-race-condition.js`, `parallel/test-http-client-keep-alive-hint.js`, `parallel/test-http-agent-keep-alive-timeout-buffer.js`, `parallel/test-http-server-headers-timeout-keepalive.js`, `parallel/test-http-server-request-timeout-keepalive.js` | undici v7.30.1 `lib/dispatcher/client.js`, `client-h1.js`, `pool.js`, `lib/util/timers.js` | `CHANGELOG_V24.md` (24.6.0, 24.7.0, 24.8.0) |

Tất cả đường dẫn trên đã kiểm tồn tại và chứa đúng tên hàm. Cách tự kiểm: `git clone --depth 1 --branch v24.22.1
https://github.com/nodejs/node` rồi `grep -n <tên hàm> <file>`. Số dòng có thể lệch vài dòng giữa các bản patch 24.x.

---

## 4. Service mẫu và 8 lỗi (F1–F8)

`node faults/run.mjs naive|fixed`. Tải bằng autocannon 8 (mặc định 50 kết nối, 5 s). Health probe là một client
keep-alive gọi `/health` mỗi 50 ms trong suốt kịch bản; nó đo service từ bên ngoài.

| Lỗi | Bơm thế nào | Naive v24 | Naive v26 | Fixed v24 | Fixed v26 | **Tiêu chí đạt cho `mine.mjs`** |
|---|---|---|---|---|---|---|
| F1 DB chậm | độ trễ DB 5 s, 100 kết nối, 8 s | 100 req, p99 5040 ms, 100 query treo sau đó | 100, p99 5038, 100 | 2600 req (504), p99 338 ms, 0 treo | 2600, p99 340, 0 | p99 ≤ 350 ms, 0 query treo |
| F2 DB sập | DB đóng listener, 50 kết nối, client timeout 3 s | 0 response, 50 timeout, hàng đợi 100 | giống | 84 750 response 503, p99 14 ms, hàng đợi 0 | 103 342, p99 8 ms | 0 timeout, p99 ≤ 20 ms, hàng đợi 0 |
| F3 client ngắt giữa chừng | 50 client tải `/export`, ngắt sau 200 ms | 50 stream upstream còn mở | 50 | 0 | 0 | 0 upstream mở sau 1,5 s |
| F4 stream không kết thúc | upstream gửi 10 dòng rồi treo, 20 client, client timeout 10 s | 0 kết nối được server đóng, 20 upstream mở | giống | 20/20 đóng, tối đa 2057 ms, 0 upstream mở | 2062 ms, 0 | 100% đóng ≤ 2,2 s, 0 upstream mở |
| F5 payload 49,2 MB × 4 | POST `/ingest` đồng thời | RSS 60 → 521 MB, lag 107 ms, health 100 ms | 60 → 338 MB, lag 80 ms | RSS 60 MB, lag 0,6 ms, health 1,4 ms; 3×413 + 1 EPIPE | 61 MB, 0,6 ms | RSS tăng ≤ 10 MB, lag ≤ 20 ms |
| F6 ReDoS | `/validate?name=` 28 × `a` + `!` | request 15 739 ms, health probe ECONNRESET | 20 365 ms, ECONNRESET | 1,2 ms | 1,3 ms | ≤ 5 ms, 0 lỗi probe |
| F7 SIGTERM dưới tải | 2 backend sau LB, SIGTERM backend 1 ở giây 2 | **119/5896 lỗi 502** (94 ECONNREFUSED, 25 FIN) | 124/5901 | 0/5763, exit 0 | 0/5780 | 0 non-2xx, exit 0 |
| F8 keep-alive < idle LB | `h502.mjs` mục block 5 | 5/500 | 3/500 | 0/500 | 0/500 | 0/500 |

Ghi chú để không đọc sai:
- F5: phía client có 1/4 lần thấy `EPIPE` thay cho 413 vì server đóng kết nối khi client còn đang gửi. Đó là TCP,
  không phải lỗi service. Client muốn chắc chắn nhận 413 thì gửi `Expect: 100-continue`.
- F7: LB kiểm health mỗi 200 ms. 94 lỗi ECONNREFUSED là request rơi vào khe 200 ms sau khi backend chết;
  25 lỗi FIN là request đang chạy bị giết. Bản fixed: `/health` trả 503 ngay khi nhận SIGTERM, phục vụ tiếp 1 s,
  rồi `server.close()` + `closeIdleConnections()`, gắn `Connection: close` cho response trong lúc rút.
- F2: "đạt" nghĩa là **fail nhanh** (503 trong 2 ms) chứ không phải trả 200. Người dùng thấy lỗi ngay thay vì treo 3 s.
- Naive F1 và F2 dùng một pool chờ kết nối vô hạn (`queueWhileDown`): đúng hành vi mặc định của nhiều driver DB
  khi không đặt timeout lấy kết nối.

---

## 5. Differential v24.22.1 ↔ v26.12.1 (đã kiểm)

| Hành vi | v24 | v26 | Nguồn |
|---|---|---|---|
| u22: `fs.readFile` khi threadpool bận | nhiều chuyến threadpool (`lookup` chen vào giữa) | một chuyến (`readFile` xong trước `lookup`) | v26 `lib/fs.js` `ReadFileJob`, PR #65327 |
| Bản undici đóng gói | 7.30.1 | 8.12.2 | `process.versions.undici` |
| e5 #4: kết nối cho 200 fetch đồng thời | 198 | 200 | cả hai đều không giới hạn kết nối mỗi origin |
| V8 | 13.6 | 14.6 | `process.versions.v8` |
| ReDoS 26 ký tự (lần gọi thứ 6) | 578 ms | 626 ms | `redos-calib.js` |

Giống nhau trên cả hai (đã kiểm): u01–u21, u23–u28 (`quiz/run.mjs --diff`), e1–e6, partB b01–b08, 502 0/500 sau sửa.
u09 không xác định trên **cả hai** bản (13% chạy ra thứ tự thứ hai); 5 lần chạy chưa đủ để thấy, nên `meta.json`
đặt u09 chạy 40 lần.

---

## 6. Sửa sai so với giả thuyết ban đầu (giữ lại vì là bài học)

1. Mình từng viết "`req 'close'` chỉ bắn khi body đã đọc xong, không bắn khi client ngắt". **Sai trên v24 và v26:**
   e1 cho thấy `req close` bắn lúc 102 ms khi client ngắt. Code mẫu vẫn dùng `res 'close'` + `writableFinished` vì
   đó là cách phân biệt hoàn thành và bị ngắt.
2. Giả thuyết "event loop bị chặn lâu hơn keep-alive thì request kế tiếp chết" chỉ đúng khi chặn trong I/O callback (e4).
3. Lần chạy `h502` đầu tiên với 20 client song song cho 0/600 lỗi: pool LB co lại còn 2 kết nối, không kết nối nào rảnh
   đủ lâu. Lỗi 502 do keep-alive xuất hiện ở backend **ít tải**, không phải backend bận.
4. Bộ v1 ghi "19 người là đủ" cho khẳng định phân vị 95. Sai, xem 7.2.

---

## 7. Kiểm chứng ngoài bạn và mình

### 7.1 Runtime là trọng tài
`node quiz/run.mjs --check-key quiz/key-v24.json` (và `key-v26.json` nếu máy bạn chạy v26). Mỗi câu chạy nhiều lần
và khóa ghi **mọi** output khác nhau, nên câu có race hiện rõ. Nếu khác: runtime đúng, khóa sai, ghi vào nhật ký.
`results-*.jsonl` là số đo thô; chạy lại harness trên máy bạn và so tỉ lệ.

### 7.2 Đề công khai, n ≥ 59
**Thống kê.** Nếu phân vị thật của bạn là đúng 95%, xác suất bạn hơn cả n người là 0,95ⁿ. Muốn bác giả thuyết
"phân vị ≤ 95" ở α = 0,05 khi hơn tất cả: n ≥ 59. `grade-responses.mjs` in p-value một phía và cận dưới Clopper–Pearson
95% cho phân vị của bạn. Thử với dữ liệu giả: hơn 70/70 người → p = 0,028, cận dưới 95,8% (đạt). Hơn 56, hòa 4 trên
60 người → cận dưới 85,4% (không đạt). Vì vậy **hòa điểm ở đỉnh giết khẳng định**: đề phải đủ khó để người giỏi không
cùng đạt tối đa. Phần A sinh câu 5–7 bước nên rất khó đạt trọn.

**Mù hóa, vì bạn đã học chính các câu trong bộ này.**
- Phần A (12 câu thứ tự thực thi): `node quiz/gen-eventloop.mjs --seed <số chọn lúc dựng đề> --count 12 --out quiz/public/partA`.
  Câu sinh ngẫu nhiên, đáp án từ runtime, lọc bỏ câu có race (40 lần chạy). Bạn không mở `questions.md` trước khi làm.
- Phần B (8 câu production): `quiz/public/partB/PROCTOR-ONLY.md`. **Nhờ một người khác** chép vào Form và giữ file.
  Bạn chưa thấy đáp án, các câu không trùng u01–u28 hay e1–e6.
- Bạn làm đề **đúng điều kiện người khác**: 25 phút, không chạy code, không tra cứu.

**Dựng Form.** Google Forms chế độ Quiz; tiêu đề câu bắt đầu bằng mã (`G01 …`, `B03 …`); phần A là câu trả lời ngắn
(chuỗi chữ cái), phần B trắc nghiệm. Thêm 3 câu sàng lọc: "Bạn có viết Node.js chạy production trong công việc hiện tại?"
(loại nếu không), số năm kinh nghiệm, phiên bản Node đang dùng. Ghi ở đầu đề: "Đáp án áp dụng cho Node 24 LTS".
Google Forms không có đồng hồ đếm ngược; ghi giờ bắt đầu và kết thúc bằng 2 câu bắt buộc và loại bài > 30 phút.
**[cần kiểm]** công cụ có hẹn giờ thật nếu bạn cần chặt hơn.

**Tuyển 59+ người.** Nguồn theo thứ tự hiệu quả: (1) đồng nghiệp và người phỏng vấn bạn; (2) cộng đồng Node/JavaScript
Việt Nam trên Facebook, Discord; (3) bài blog mục 7.4 với link đề ở cuối; (4) r/node và kênh cộng đồng Node.js quốc tế
**[cần kiểm tên kênh và quy định đăng bài]**. Mời theo số lượng: tỉ lệ người mở link rồi làm hết thường thấp, nên gửi tới
vài trăm người. Mẫu phải gồm cả junior và senior; ghi số năm để báo cáo phân phối theo nhóm.

**Chấm:** xuất CSV, chạy
`node quiz/public/grade-responses.mjs responses.csv quiz/public/partA/key.json quiz/public/partB/key-partB.json --me <email>`.

### 7.3 Một PR (3 ứng viên cụ thể, từ hành vi đã đo)
Kiểm lại trên nhánh `main` và tìm issue/PR trùng trước khi mở.
1. **doc** `doc/api/perf_hooks.md`, `monitorEventLoopDelay`: ở chế độ interval, mỗi mẫu là khoảng cách giữa hai lần
   timer chạy (`src/histogram-inl.h` 176), nên khi rảnh p50 ≈ `resolution` và độ trễ thật = giá trị − `resolution`.
   Tài liệu hiện chỉ nói "reports the event loop delay". Bằng chứng: u26 và `e6-eld.js`.
2. **test** `test/parallel/`: Agent tôn trọng `agentKeepAliveTimeoutBuffer` khi tính hạn socket từ hint. Test hiện có
   (`test-http-agent-keep-alive-timeout-buffer.js`) chỉ kiểm giá trị được gán; `test-http-client-keep-alive-hint.js` chỉ
   kiểm hint `timeout=1`. Test mới: hint `timeout=5`, buffer 4500 → socket không được dùng lại sau 600 ms.
3. **test**: keep-alive socket bị đóng khi event loop bị chặn trong I/O callback lâu hơn `keepAliveTimeout + buffer`
   (e4). Đây là hành vi đúng hay lỗi cần mở issue trước khi viết test, vì một test sẽ khóa nó lại.
Quy trình như v1: `doc/contributing/pull-requests.md` (DCO, `git commit -s`), `writing-tests.md` (`common.mustCall`),
`collaborator-guide.md` (mở ≥ 48 giờ, 2 approval). Mục tiêu trong 20 giờ: PR mở và xử lý xong vòng review đầu.

### 7.4 Blog kèm repo
Mở bằng F7: "119 request lỗi trong một lần deploy, và 0 sau khi sửa cách tắt tiến trình". Thân bài: bảng mục 4, e4 (vì sao lỗi chỉ hiện khi
chặn trong I/O callback), u22 (cùng code, khác kết quả giữa v24 và v26). Cuối bài: link repo, link đề công khai.
Người đọc chạy harness trên máy họ và báo số khác là bên kiểm chứng thứ ba.

---

## 8. Còn `[cần kiểm]`
- cgroup trên máy bạn (macOS cần Docker).
- Công cụ quiz có hẹn giờ thật; tên kênh cộng đồng và quy định đăng bài.
- 3 ứng viên PR: kiểm trùng trên `main` trước khi mở.
- Số dòng mã nguồn có thể lệch ở bản 24.x khác 24.22.1.
