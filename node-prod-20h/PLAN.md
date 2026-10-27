# Kế hoạch 20 giờ: dùng Node.js trong production tốt hơn 95% kỹ sư Node

Mọi số trong file này đã chạy trên máy đo ở mục 0. Số thô nằm trong `results-*`. Lệnh chạy lại ở `README.md`.
Chỗ nào chưa kiểm được ghi **[cần kiểm]** kèm cách tự kiểm.

---

## 0. Phiên bản và máy đo

**Ngày kiểm:** 27/10/2026.

**Chọn bản:** Node **24.22.1** "Krypton". Node 24 là LTS; giai đoạn Active kết thúc 20/10/2026, nay ở Maintenance tới 30/4/2028.
Đối chiếu với **26.12.1**, đang là Current và được ghi "upcoming LTS" (nguồn: endoflife.date, cập nhật 22/10/2026).
Ngày 26 chính thức lên LTS: **[cần kiểm]** trên `nodejs.org/en/about/previous-releases`.
Dự án mới nên lên 26 khi nó thành LTS. Bộ này chạy trên cả hai bản và ghi rõ mọi chỗ khác nhau.

| | v24.22.1 | v26.12.1 |
|---|---|---|
| V8 | 13.6.233.17-node.58 | 14.6.202.34-node.40 |
| libuv | 1.52.1 | 1.52.1 |
| undici (fetch) | 7.30.1 | 8.12.2 |
| llhttp | 9.4.3 | 9.4.3 |

Binary lấy từ npm (`node-linux-x64@24.22.1`, `@26.12.1`), vì sandbox không tới được nodejs.org.

**Máy đo:** 2 vCPU x86_64, 8 GB RAM, Linux 6.18, **cgroup v1**, không swap. Service, tải, DB giả, upstream giả và LB giả
chạy chung máy. Vì vậy số tuyệt đối sẽ khác trên máy bạn. Số đếm (lỗi, kết nối còn mở, OOM kill) và tỉ lệ naive/fixed
thì không phụ thuộc máy.

**Mã nguồn:** clone `--depth 1 --branch v24.22.1` và `v26.12.1` từ github.com/nodejs/node, thêm `main` @ `640ce854`
(27/10/2026). `tools/verify-sources.sh` grep 58 cặp (file, ký hiệu) trên cả hai tag: 116/116 dòng tìm thấy,
xem `results-sources.txt`. Số dòng trong file này là **v24 / v26**.

---

## 1. Tám năng lực, bắt đầu từ sự cố

Mình bắt đầu từ cách Node chết trong production, rồi gom thành năng lực. Mỗi sự cố có một kịch bản trong harness (`F*`)
hoặc một câu hỏi (`p*`) để đo.

| Sự cố thật | Đo bằng |
|---|---|
| Event loop bị chặn (regex, CPU) | F6, eld |
| Threadpool cạn (`fs`, `dns.lookup`, `crypto`, `zlib` dùng chung 4 luồng) | F10, p23, quét `UV_THREADPOOL_SIZE` |
| OOMKilled do bộ nhớ ngoài heap | F5, defaults trong cgroup 256 MB |
| Leak | F11 |
| Thiếu timeout, pool DB chờ vô hạn | F1, F2 |
| Client bỏ đi nhưng upstream vẫn chạy | F3 |
| Upstream treo giữa stream | F4 |
| Keep-alive lệch với LB → 502 | F8, `b-exp/ka-race.mjs` |
| Tắt tiến trình sai → 502 khi deploy | F7 |
| Node làm PID 1 không chết khi SIGTERM | F12, `b-exp/pid1-sigterm.mjs` |
| Unhandled rejection làm sập tiến trình | F9, p01–p04 |
| Backpressure | p05–p08 |
| ReDoS | F6 |
| Chuỗi cung ứng npm | mục 6, block 7 |

| # | Năng lực | Bài kiểm chạy được | Ngưỡng đạt | Công cụ | Đo ở giờ 0 |
|---|---|---|---|---|---|
| N1 | Dự đoán thứ tự thực thi | `quiz/gen-eventloop.mjs` với seed **mới** | ≥ 90% đúng trên 2 bộ 12 câu liên tiếp; mọi câu tự tin 5 đều đúng | runtime, `journal.csv` | seed 101 (CJS) + 201 (ESM), chưa đọc gì |
| N2 | Threadpool | F10; p23 trên cả v24 và v26; quét `UV_THREADPOOL_SIZE` | F10 đạt; dự đoán đúng thứ tự p23 trên **cả hai** bản và nói được vì sao chúng khác | harness, `quiz/run.mjs` | dự đoán p23 |
| N3 | Bộ nhớ trong container | F5, F11 | F5: sống, 0 OOM kill, RSS ≤ 100 MB; F11: heap sau GC tăng ≤ 2 MB | cgroup 256 MB, `--expose-gc` | dự đoán bảng naive |
| N4 | Stream, backpressure | F3, F4; p05–p08 | F3, F4 đạt; 4/4 câu | harness | 4 câu |
| N5 | Lỗi, timeout, hủy | F1, F2, F9; p01–p04, p09–p12, p27 | F1, F2, F9 đạt; ≥ 10/11 câu | harness, `AbortSignal` | 11 câu |
| N6 | Vòng đời tiến trình | F7, F12; p13, p14, p19, p20 | 0 non-2xx khi SIGTERM dưới tải; thoát ≤ 3 s khi là PID 1 | LB giả, `unshare --pid` | dự đoán F7, F12 |
| N7 | HTTP sau LB | F8; p15–p17, p28, p30; bảng 7 timeout ở mục 2 | 0 lỗi 502; điền đúng bảng timeout không tra | LB giả, relay trễ | điền bảng không tra |
| N8 | Chẩn đoán dưới tải | diễn tập mù (block 9) | mỗi lỗi ≤ 20 phút: tên cơ chế + công cụ + số trước/sau | `--cpu-prof` + `tools/topfn.mjs`, heap snapshot, `monitorEventLoopDelay`, ELU | 1 lỗi bất kỳ, bấm giờ |

---

## 2. Bảng giá trị mặc định (đo bằng `tools/defaults.mjs`)

Phần lớn sự cố production đến từ giá trị mặc định. Bảng dưới đọc từ runtime, không lấy từ blog.

| Giá trị | v24.22.1 | v26.12.1 | Nguồn / lúc đổi |
|---|---|---|---|
| `server.keepAliveTimeout` | 5000 | 5000 | `lib/_http_server.js:562 / 578`. **Trên `main`: 65000** (PR #62782, ghi `REPLACEME`, chưa phát hành; `lib/internal/http/server.js:583`) |
| `server.keepAliveTimeoutBuffer` | 1000 | 1000 | `:570 / 586`; thêm ở 24.6.0 (PR #59243). Socket thật sự đóng ở `keepAliveTimeout + buffer` (`:1140 / 1260`) |
| `server.headersTimeout` | 60000 | 60000 | `= min(60 s, requestTimeout)`, `:550 / 566` |
| `server.requestTimeout` | 300000 | 300000 | `:542 / 558`. `headersTimeout > requestTimeout` → `ERR_OUT_OF_RANGE` (p15) |
| `server.timeout` | 0 | 0 | không có timeout socket |
| `http.maxHeaderSize` | 16384 | 16384 | |
| `http.globalAgent` | keepAlive `true`, maxSockets `Infinity`, timeout 5000, scheduling `lifo` | giống | p30: `http.get` không truyền agent vẫn dùng lại socket |
| `agentKeepAliveTimeoutBuffer` | 1000 | 1000 | 24.7.0 (PR #59315). Agent hết hạn socket ở `hint − 1 s` (`lib/_http_agent.js:658`) |
| fetch: `headersTimeout`, `bodyTimeout` | 300000, 300000 | giống | `deps/undici/src/lib/dispatcher/client.js:263, 262 / 319, 318`. **fetch không có timeout tổng** |
| fetch: connect timeout | 10000 | 10000 | `deps/undici/src/lib/core/connect.js:75` |
| fetch: keep-alive khi không có hint / ngưỡng | 4000 / 2000 | giống | `client.js:253–255 / 309–311` |
| fetch: số kết nối mỗi origin | không giới hạn | không giới hạn | `pool.js:68 / 99` (`connections || null`) |
| `net` autoSelectFamily attempt | **250 ms** | **500 ms** | `src/node_options.h:164 / 185`; đổi ở 25.2.0 (PR #60334), không backport sang 24 (p22) |
| `dns` result order | `verbatim` | `verbatim` | |
| Readable highWaterMark (byte / object) | 65536 / 16 | giống | `lib/internal/streams/state.js:12`; Windows vẫn 16 KiB; đổi ở 22.0.0 (PR #52037) |
| `fs.createReadStream` highWaterMark | 65536 | 65536 | |
| `Buffer.poolSize` | 65536 | 65536 | `lib/buffer.js:176 / 189`; tăng từ 8 KiB ở 24.18.0 (PR #63597) |
| ArrayBuffer nền của `allocUnsafe(100)` | 65536 | **65600** | v26 cấp dư 64 byte để căn pool theo cache line (`lib/buffer.js:187`, v26). **[cần kiểm]** PR nào (ứng viên #65003, 26.8.0) |
| Luồng `libuv-worker` | 4 | 4 | đếm trong `/proc/self/task`; `deps/uv/src/threadpool.c:207` |
| `os.availableParallelism()` | 2 | 2 | |
| `heap_size_limit`, không giới hạn bộ nhớ | 2240 MB | 2144 MB | |
| `heap_size_limit` trong cgroup 256 MB | **259 MB** | **262 MB** | `src/api/environment.cc:211`: heap tính theo `min(RAM, cgroup)` |
| … với `--max-old-space-size-percentage=50` | 131 MB | 134 MB | cờ có từ 24.6.0 (PR #59082) |
| Unhandled rejection | sập, exit 1 | giống | p01 |
| `defaultMaxListeners` | 10, chỉ cảnh báo | giống | p29 |

Dòng đáng nhớ nhất: trong container 256 MB, heap mặc định đã **lớn hơn** cả container. V8 không bao giờ báo OOM trước;
kernel giết tiến trình trước (F5: `oom_kill 1`, exit SIGKILL).

**Bảng 7 timeout bạn phải điền không tra ở giờ 0 và giờ 20:** server `headersTimeout`, `requestTimeout`,
`keepAliveTimeout`, `keepAliveTimeoutBuffer`; fetch `headersTimeout`, `bodyTimeout`, số kết nối mỗi origin.

---

## 3. Nguyên liệu thô theo năng lực

Đường dẫn trong repo nodejs/node ở tag tương ứng. Thư viện: bản mới nhất trên npm ngày 27/10/2026 (`results-libs.txt`).

| # | Mã nguồn (dòng v24 / v26) | Test khóa hành vi (`test/…`, có ở cả 2 tag) | Thư viện production | Changelog |
|---|---|---|---|---|
| N1 | `deps/uv/src/unix/core.c:427` `uv_run`; `lib/internal/timers.js:603` `processTimers`, `:525` `processImmediate`; `lib/internal/process/task_queues.js:72` `processTicksAndRejections` | `parallel/test-timers-immediate-queue.js`, `parallel/test-next-tick-ordering.js` | — | — |
| N2 | `deps/uv/src/threadpool.c:194` `init_threads`, `:207`; v26 `lib/fs.js:459` `ReadFileJob` | — | — | PR #65327 "read small files in one thread pool round trip" (26.8.0), #65489 ghi file (26.9.0) |
| N3 | `src/api/environment.cc:211`; `lib/buffer.js:176 / 189`; `lib/events.js:605` `MaxListenersExceededWarning` | `parallel/test-max-old-space-size-percentage.js`, `parallel/test-buffer-pool-untransferable.js` | — | PR #59082 (24.6.0), #63597 (24.18.0) |
| N4 | `lib/internal/streams/writable.js:550` `writeOrBuffer`; `pipeline.js:186` `pipelineImpl`; `end-of-stream.js:111 / 114` `eos`; `readable.js:930 / 978` `pipe` | `parallel/test-stream-pipeline.js`, `parallel/test-stream-pipeline-listeners.js` | — | PR #52037 (22.0.0) |
| N5 | `lib/internal/process/promises.js:439 / 369` `processPromiseRejections`, `:386 / 316` `throwUnhandledRejectionsMode`; `lib/internal/abort_controller.js:320 / 322` `any`, `:305 / 307` `timeout`; `lib/_http_outgoing.js:67 / 66` `ERR_STREAM_DESTROYED` | `parallel/test-promises-unhandled-rejections.js`, `parallel/test-promise-unhandled-flag.js`, `parallel/test-abortsignal-any.mjs`, `parallel/test-http-outgoing-destroyed.js` | pg-pool 3.14.0 `index.js:206`: không đặt `connectionTimeoutMillis` thì hàng đợi chờ vô hạn, đúng bản naive F1–F2 | — |
| N6 | `lib/_http_server.js:674 / 690` `close`, `:696 / 712` `closeIdleConnections`; `src/node.cc:619 / 627` đăng ký `SignalExit` cho SIGTERM, `:189 / 190` `SignalExit` = `ResetStdio(); raise(signo)` | `parallel/test-http-server-close-idle.js`, `parallel/test-http-server-close-all.js` | fastify 5.12.7 `lib/route.js:88` `return503OnClosing`, `fastify.js:393` `closeIdleConnections()`; close-with-grace 2.5.0 `index.js:36` | — |
| N7 | `lib/_http_server.js:542–570 / 558–586`, `:1140 / 1260`, `:900 / 921` `socketOnTimeout`; `lib/_http_agent.js:658` `keepSocketAlive`; undici `client.js`, `connect.js:75`, `pool.js`, `util/timers.js:33` | `parallel/test-http-keep-alive-timeout-buffer.js`, `parallel/test-http-client-keep-alive-hint.js`, `parallel/test-http-agent-keep-alive-timeout-buffer.js`, `parallel/test-http-server-headers-timeout-keepalive.js`, `parallel/test-http-server-request-timeout-keepalive.js`, `parallel/test-net-autoselectfamily.js` | fastify `lib/config-validator.js:6`: mặc định `keepAliveTimeout` **72000**, `bodyLimit` 1 MiB | PR #59243 (24.6.0), #59315 (24.7.0), #60334 (25.2.0), #62782 (main) |
| N8 | `src/histogram-inl.h:176 / 182` `RecordDelta`; `lib/internal/perf/event_loop_utilization.js:11` | `sequential/test-performance-eventloopdelay.js` | @fastify/under-pressure 9.2.1 `index.js:6–7, 27` (cắt tải theo ELU và event loop delay); pino 10.4.0 `lib/transport.js:10` (log qua worker) | `samplePerIteration` có từ 24.19.0 (PR #62935) |
| ESM | `lib/internal/modules/esm/module_job.js:64 / 65` `ERR_REQUIRE_ASYNC_MODULE` | `es-module/test-require-module-tla-execution.js` | — | `require(esm)` stable 24.15.0 (PR #60959) |

Tự kiểm: `tools/verify-sources.sh <thư mục chứa node24/ node26/>`. Số dòng lệch vài dòng giữa các bản patch 24.x.

---

## 4. Harness bơm lỗi

`faults/run.mjs` dựng cho mỗi kịch bản: một service mới trong cgroup 256 MB, DB và upstream giả (`faults/deps.mjs`),
health probe ở tiến trình riêng (GET `/health` mỗi 50 ms, timeout 1 s), bộ tạo tải không phụ thuộc (`tools/load.mjs`).
F7 và F8 thêm một LB kiểu ALB (`tools/lb.mjs`): giữ kết nối tới backend 60 s, **không đọc** hint `Keep-Alive`,
bỏ header hop-by-hop, health check mỗi 200 ms. F8 thêm relay trễ 1 ms mỗi chiều (`tools/delay.mjs`), tức RTT 2 ms.
Mọi số đếm phía phụ thuộc (query đang chạy, stream upstream còn mở) đo từ bên ngoài service.

**Kết quả** (`results-faults-{naive,fixed}-v{24,26}.jsonl`; `faults/check.mjs`: naive 0/12, fixed 12/12 trên cả hai bản):

| Lỗi | Naive v24 | Naive v26 | Fixed v24 | Fixed v26 |
|---|---|---|---|---|
| F1 DB trễ 5 s, 100 kết nối, 8 s | 100/110 request timeout 10 s; 10 query còn chạy ở DB khi mọi client đã đi | giống | 6875 response (6467 × 503, 408 × 504), p99 415 ms; 0 query còn chạy | 7802, p99 363 ms; 0 |
| F2 DB sập, 50 kết nối, timeout 3 s | 100/100 timeout | giống | 30 445 × 503, p99 29 ms | 42 215 × 503, p99 23 ms |
| F3 50 client ngắt sau 200 ms | 50/50 stream upstream còn mở | 50/50 | 0 | 0 |
| F4 upstream treo, 20 client | 0/20 được server đóng; 20 upstream còn mở | giống | 20/20 đóng, chậm nhất 2145 ms; 0 mở | 20/20, 2165 ms; 0 |
| F5 4 × 60 MB POST | **SIGKILL, `oom_kill 1`**; RSS mẫu cuối 237 MB; probe 12/28 lỗi | SIGKILL, 260 MB; 11/28 | sống, RSS 63 MB; 2 × 413 + 2 × EPIPE | sống, 65 MB; 3 × 413 + 1 × EPIPE |
| F6 3 × ReDoS (27 ký tự) | 3 request mất 13,2 s; event loop chặn 9,9 s liền; probe 13/19 lỗi | 19,0 s; 15,2 s; 18/24 | 4,4 ms; 0 lỗi | 4,2 ms; 0 |
| F7 SIGTERM backend 1 giữa tải qua LB | **65/10 274 lỗi 502** (56 ECONNREFUSED, 9 ECONNRESET); chết sau 17 ms | 71/10 869 | 0/9183; thoát mã 0 sau 1020 ms | 0/10 139; 1012 ms |
| F8 keep-alive 5+1 s < idle LB 60 s | **23/270 lỗi 502** (ECONNRESET) | 18/270 | 0/270 | 0/270 |
| F9 promise audit bị bỏ rơi | tiến trình thoát mã 1; 7986/7986 request sau đó ECONNREFUSED | giống | 0 lỗi / 11 572 | 0 / 13 810 |
| F10 8 × pbkdf2 + 4 × readFile | `/config` p99 **1271 ms** (20 request trong 5 s) | **466 ms** (72) | 10 ms (7912) | 9 ms (10 649) |
| F11 5000 request `/sub` | heap sau GC +59,8 MB; có MaxListenersExceededWarning | +56,9 MB | +0,5 MB; không cảnh báo | +0,5 MB |
| F12 PID 1 nhận SIGTERM | **còn sống sau 5 s** | còn sống | thoát sau 1105 ms | 1103 ms |

Đọc bảng:
- F2 đạt nghĩa là **fail nhanh**: 503 trong vài chục ms thay vì treo 3 s.
- F5: client đôi khi thấy `EPIPE` thay cho 413, vì server đóng kết nối khi client còn đang gửi. Đó là TCP, không phải lỗi service.
  Client muốn chắc chắn nhận 413 thì gửi `Expect: 100-continue`.
- F6 trên v26 chậm hơn v24 khoảng 1,4 lần với cùng regex.
- F7: 56 lỗi ECONNREFUSED là request rơi vào khe giữa lúc backend chết và lần health check kế tiếp; 9 lỗi ECONNRESET là
  request đang chạy bị giết. Cách sửa: `/health` trả 503 ngay khi nhận SIGTERM, phục vụ tiếp 1 s (lớn hơn chu kỳ health
  check), rồi `server.close()` + `closeIdleConnections()`, gắn `Connection: close` cho response trong lúc rút.
- F8 và `b-exp/ka-race.mjs`: lỗi chỉ xảy ra khi LB gửi request trong khoảng ~3,5 ms trước lúc backend đóng socket rảnh
  (bảng ở block 7). Cửa sổ đó cỡ RTT cộng độ phân giải timer. Sửa: `keepAliveTimeout` của backend **lớn hơn** idle timeout của LB.
- F10: v26 nhanh hơn v24 khoảng 2,7 lần ở p99 vì `fs.readFile` trên v26 đi threadpool **một** chuyến (PR #65327), v24 đi
  nhiều chuyến (open, fstat, read, close), mỗi chuyến xếp hàng sau pbkdf2. p23 cho thấy cùng cơ chế.
- F12: Node **có** cài handler cho SIGTERM (`src/node.cc:619`). Handler đó khôi phục terminal rồi `raise(SIGTERM)` với
  hành vi mặc định. Kernel bỏ tín hiệu mặc định gửi tới init của một PID namespace, nên tiến trình sống tiếp.
  `b-exp/pid1-sigterm.mjs` đọc `SigCgt` trong `/proc`: bit SIGTERM bật trước, tắt sau lần SIGTERM đầu; lần thứ hai cũng bị bỏ.
  `docker stop` sẽ đợi 10 s rồi SIGKILL.

**Quét `UV_THREADPOOL_SIZE` cho F10 naive** (`results-threadpool.txt`, `/config` p99 ms):

| Luồng | 1 | 2 | 4 | 8 | 16 |
|---|---|---|---|---|---|
| v24 | 3039 | 1412 | 1186 | 439 | 39 |
| v26 | 923 | 447 | 432 | 433 | 24 |
| pbkdf2 p99 (v24) | 924 | 488 | 548 | 500 | 687 |

Tăng luồng cứu `/config` nhưng pbkdf2 chậm đi vì 16 luồng tranh 2 lõi. Bản fixed dùng **bulkhead** (tối đa 2 pbkdf2 cùng lúc)
và giữ 4 luồng: `/config` p99 10 ms.

**Tiêu chí cho `service/mine.mjs`:** `faults/CRITERIA.md`, chấm bằng `faults/check.mjs`. Đạt = 12/12 trên cả v24 và v26.
Lời giải tham khảo ở `_solutions/fixed.mjs`. Không mở trước khi đạt hoặc hết giờ của block.

---

## 5. Luyện dự đoán

**Câu thứ tự thực thi sinh theo seed** (`quiz/gen-eventloop.mjs`): 6–10 nhãn, lồng tối đa 3 tầng, trộn `nextTick`,
`then`, `queueMicrotask`, `setTimeout 0`, `setImmediate`, callback `fs.stat`, `await`. Mỗi câu chạy 100 lần; câu nào
ra hơn một thứ tự bị bỏ. Đã sinh sẵn `quiz/out/seed101..103` (CJS) và `seed201-esm`.
Mỗi thư mục có `key.json`: **không mở trước khi ghi xong dự đoán**; chấm bằng cách chạy `node quiz/out/seedN/gNN.cjs`.
Tỉ lệ bị bỏ vì race: 9, 6, 8 câu (CJS) và 14 câu (ESM) để giữ 12. Kiểm chéo trên v26 bằng `quiz/check-seed.mjs`:
48/48 khớp. Seed mới cho mỗi lần đo: `--seed <số bạn chưa dùng>`.

**30 câu production** (`quiz/prod/p01..p30.mjs`, đọc code rồi đoán dòng in ra). Khóa sinh từ runtime, 5 lần mỗi câu,
0 câu racy: `quiz/key-v24.json`, `quiz/key-v26.json`. Khác nhau giữa hai bản (`quiz/run.mjs --diff`): 3/30.

| Câu | v24 | v26 |
|---|---|---|
| p21 `Buffer.allocUnsafe(100).buffer.byteLength` | 65536 | 65600 |
| p22 attemptTimeout Happy Eyeballs | 250 | 500 |
| p23 thứ tự khi threadpool 1 luồng bận | pbkdf2 < lookup < readFile < promises.readFile | pbkdf2 < readFile < lookup < promises.readFile |

Vài khóa đáng ghi (giống nhau trên hai bản):
- p03: gắn `.catch` sau `await null; await null` → không sập. p02: gắn trong `setTimeout 0` → exit 1.
- p04: listener **async** ném lỗi → exit 1, listener `'error'` không được gọi (captureRejections mặc định tắt).
- p05/p06: `.pipe()` không hủy đích khi nguồn lỗi; `pipeline()` hủy.
- p10: header về rồi body treo → `fetch` resolve, `text()` ném `TimeoutError`.
- p11: client ngắt ở 50 ms → `res 'close'` chạy ngay, `writableFinished=false`; `res.end()` sau đó **không ném**.
- p16: server `keepAliveTimeout: 1000` → hint `timeout=1` → Agent mặc định **không** dùng lại socket.
- p19: SIGTERM không có listener → `'exit'` **không** chạy.
- p28: trả 413 mà không đọc body, không `Connection: close` → kết nối vẫn keep-alive và request thứ hai vẫn nhận 413.

**`journal.csv`**: `ngay, gio_hoc, block, ma_cau, khai_niem, du_doan, tu_tin_1_5, ket_qua_runtime, dung_sai,
vi_sao_co_che, nguon_da_kiem`. Ghi `du_doan` và `tu_tin_1_5` **trước** khi chạy. `vi_sao_co_che` phải nêu tên hàng đợi,
phase hoặc hàm trong mã nguồn; "vì async" không được tính.
Tỉ lệ đúng theo block và theo mức tự tin: `node tools/journal-stats.mjs`. Mức 5 phải ≥ 95%; script liệt kê mọi câu
tự tin 5 mà sai.

---

## 6. Lịch 20 giờ

11,5 giờ (57%) cho năng lực production: block 3, 5, 6, 7, 8.
**Ngưỡng chuyển block:** ≥ 90% đúng trên câu **mới** của block, và mọi câu tự tin 5 đều đúng. Chưa đạt: làm 5 biến thể của
câu sai (đổi phase, đổi thứ tự đăng ký, thêm một tầng async, đổi phiên bản), tối đa 30 phút, rồi đi tiếp và ghi lỗ hổng.

### Block 0 · 0:00–1:30 · Đo baseline (chưa đọc gì)
- seed 101 và 201-esm: dự đoán 24 câu, ghi tự tin (30 phút).
- 30 câu production: chỉ dự đoán (25 phút). Chấm bằng khóa v24 sau khi ghi xong.
- Dự đoán bảng naive mục 4: điền 12 ô "chuyện gì xảy ra" (10 phút). Điền bảng 7 timeout (5 phút).
- Làm phần A đề công khai (mục 7.1) đúng điều kiện người khác: 25 phút, không chạy code.
- Đầu ra: cột GIỜ 0 trong `journal.csv`.

### Block 1 · 1:30–4:00 · Event loop và hàng đợi (N1)
**Đọc (60 phút):** `deps/uv/src/unix/core.c:427` `uv_run` (timers chạy một lần trước vòng đầu, sau đó ở **cuối** mỗi vòng, sau poll, check và close);
`lib/internal/timers.js:603` `processTimers`, `:525` `processImmediate` (chỗ gọi `runNextTicks` giữa các callback);
`lib/internal/process/task_queues.js:72` `processTicksAndRejections`; `lib/internal/process/promises.js:439`.
**Thí nghiệm:** seed 102 (dự đoán rồi chạy `node quiz/out/seed102/gNN.cjs`). Mỗi câu sai: viết 1 biến thể.
**Tự dựng (45 phút):** `mini-loop.js` mô phỏng hàng nextTick, microtask, timers, immediate, check theo `uv_run`;
chạy lại 12 câu seed 102 bằng API của bạn, khớp ≥ 11/12.
**Đầu ra:** ≥ 90% trên seed 103 và một seed tự chọn.

### Block 2 · 4:00–5:30 · Threadpool (N2)
**Đọc (25 phút):** `deps/uv/src/threadpool.c:194, 207`; v26 `lib/fs.js:459` và PR #65327.
**Thí nghiệm (đã chạy, mục 4):** p23 trên v24 và v26; quét `UV_THREADPOOL_SIZE` 1–16 cho F10
(`UV_THREADPOOL_SIZE=<n> RESULTS_TAG=tp<n> node faults/run.mjs naive --only F10`). Dự đoán trước hình dạng bảng.
**Bài:** sửa `/avatar` và `/config` trong `mine.mjs` tới khi F10 đạt mà **không** tăng `UV_THREADPOOL_SIZE`.
**Đầu ra:** F10 đạt trên v24 và v26; một câu giải thích vì sao p23 khác giữa hai bản, có số chuyến threadpool.

### Block 3 · 5:30–7:30 · Bộ nhớ trong container (N3) — production
**Đọc (30 phút):** `src/api/environment.cc:211–220`; `doc/api/cli.md` mục `--max-old-space-size-percentage`;
`lib/events.js:605`.
**Thí nghiệm (đã chạy):** `tools/incg.sh 256M node tools/defaults.mjs` → `heap_size_limit` 259 MB (v24) trong container
256 MB. Với `--max-old-space-size-percentage=50` → 131 MB. F5 naive bị kernel giết (`oom_kill 1`).
**Bài:** F5 và F11 trong `mine.mjs`. Với F11: chụp heap snapshot (`--heapsnapshot-signal=SIGUSR2`) trước và sau 5000
request, mở trong DevTools, tìm đường giữ từ `configBus` tới mảng 10 KB.
**Đầu ra:** F5, F11 đạt; bảng `heapUsed / arrayBuffers / rss` lúc F5 naive bị giết (đọc từ `process.memoryUsage()` ghi mỗi
100 ms) và một câu vì sao heap không cứu được.

### Block 4 · 7:30–9:00 · Stream và backpressure (N4)
**Đọc (30 phút):** `writable.js:550` `writeOrBuffer` (chỗ trả `false`); `pipeline.js:186`; `end-of-stream.js:111`;
`readable.js:930` `pipe`.
**Thí nghiệm:** p05–p08 dự đoán rồi chạy. **Bài:** F3, F4 trong `mine.mjs`.
**Đầu ra:** F3, F4 đạt; 4/4 câu.

### Block 5 · 9:00–12:00 · Lỗi, timeout, hủy (N5) — production
**Đọc (40 phút):** `promises.js:386` `throwUnhandledRejectionsMode`; `abort_controller.js:305, 320`;
`_http_outgoing.js:67`; pg-pool `index.js:200–230` (hàng đợi khi không có `connectionTimeoutMillis`).
**Thí nghiệm:** p01–p04, p09–p12, p27.
**Bài (100 phút):** F1, F2, F9 trong `mine.mjs`. Gợi ý không lộ lời giải: mỗi request có một deadline, deadline đi
xuống tới tận DB, và "DB sập" phải được biết trước khi xếp hàng.
**Đầu ra:** F1, F2, F9 đạt trên cả hai bản.

### Block 6 · 12:00–14:00 · Vòng đời tiến trình (N6) — production
**Đọc (30 phút):** `_http_server.js:674` `close`, `:696` `closeIdleConnections`; `src/node.cc:189, 619`;
fastify `lib/route.js:88`, `fastify.js:393`; close-with-grace `index.js:36`; `man 7 pid_namespaces` mục về init.
**Thí nghiệm (đã chạy):** `b-exp/pid1-sigterm.mjs` (bảng `SigCgt`); p13, p14, p19, p20.
**Bài:** F7, F12 trong `mine.mjs`.
**Đầu ra:** 0 non-2xx khi SIGTERM dưới tải; thoát ≤ 3 s khi là PID 1.

### Block 7 · 14:00–16:00 · HTTP sau load balancer (N7) — production
**Đọc (35 phút):** `_http_server.js:542–570, 900, 1140`; `_http_agent.js:658–690`; undici `client.js:250–265`,
`connect.js:75`, `pool.js:68`; fastify `config-validator.js:6` (mặc định 72 s).
**Thí nghiệm (đã chạy):** `b-exp/ka-race.mjs 200 1` quét khoảng nghỉ quanh lúc backend đóng (keepAliveTimeout 200 ms,
buffer 0, RTT 2 ms, 4 lần mỗi điểm):

| Khoảng nghỉ (ms) | ≤ 195,5 | 196–196,5 | 197–199,5 | 200 | 200,5–201 | ≥ 201,5 |
|---|---|---|---|---|---|---|
| Lỗi ECONNRESET v24 | 0/16 | 3/8 | 22/24 | 3/4 | 1/8 | 1/40 |
| v26 | 3/16 | 3/8 | 23/24 | 2/4 | 1/8 | 1/40 |

p15–p17, p28, p30.
**Bài:** F8 trong `mine.mjs`. Điền bảng 7 timeout mục 2 không tra.
**Đầu ra:** F8 đạt; bảng timeout đúng 7/7.

### Block 8 · 16:00–18:30 · Chẩn đoán dưới tải (N8) — production
**Đọc (20 phút):** `src/histogram-inl.h:176` `RecordDelta` (mỗi mẫu là khoảng cách giữa hai lần timer chạy);
`doc/api/perf_hooks.md` mục `samplePerIteration`; @fastify/under-pressure `index.js`.
**Thí nghiệm (đã chạy):**
- `b-exp/eld.mjs` (`results-eld.txt`): chế độ interval khi rảnh cho p50 = 10,2 ms với resolution 10 và 20,3 ms với
  resolution 20, tức **giá trị đo gồm cả resolution**. Chặn 5 × 100 ms: max 107,7 ms (res 10), 118,9 ms (res 20).
  `samplePerIteration`: rảnh p50 0,5 ms, bị chặn max 100,5 ms. ELU khi chặn: 0,30.
- `--cpu-prof` service naive với 1 request ReDoS 26 ký tự, rồi `tools/topfn.mjs`: 4765 ms (78,4% mẫu) là self time của
  handler `service/naive.mjs:54`. Regex không hiện thành frame riêng; thời gian rơi vào hàm gọi `.test()`.
**Bài:** F6 trong `mine.mjs`. Luyện diễn tập: người khác chạy `node faults/run.mjs naive --only F<x>` với một lỗi bạn
không biết, bạn chỉ xem output probe và công cụ chẩn đoán.
**Đầu ra:** 12/12 trên v24 và v26; 2 lần diễn tập ≤ 20 phút mỗi lần.

### Block 9 · 18:30–20:00 · Đo lại
- Seed mới chưa dùng (12 CJS + 12 ESM); 30 câu production phần B do người khác giữ (mục 7.1).
- `faults/run.mjs mine` trên v24 và v26.
- Diễn tập mù do người khác chọn 3 lỗi ngẫu nhiên. Mỗi lỗi: tên cơ chế, công cụ đã dùng, bảng trước/sau.
- `tools/journal-stats.mjs`: tỉ lệ đúng theo block và theo mức tự tin.
- Chuỗi cung ứng npm (15 phút trong block này): `npm ci` với lockfile, `npm audit signatures`, chạy thử `--permission`
  trên service của bạn. **[cần kiểm]**: phần này chưa có kịch bản đo trong harness.

---

## 7. Bằng chứng ngoài bạn và mình

### 7.1 Đề công khai, n ≥ 59
**Thống kê.** Nếu phân vị thật của bạn đúng bằng 95%, xác suất bạn hơn hẳn cả n người là 0,95ⁿ. Với n = 59: 0,0485 < 0,05.
Với n = 58: 0,051, chưa đủ. `quiz/public/grade-responses.mjs --selftest` in:
59/59 → p = 0,0485, đạt; 70/70 → p = 0,0276, cận dưới 95,8%; 100 người hơn 99 → p = 0,037, đạt; 60 người hơn 56 → p = 0,82.
**Hòa điểm ở đỉnh không được tính là hơn.** Vì vậy đề phải đủ khó để người giỏi khó đạt trọn. Phần A chấm đúng cả chuỗi
6–10 chữ cái.

**Mù hóa.** Bạn đã học chính các câu trong repo.
- Phần A (12 câu): người coi thi chọn seed, chạy `node quiz/gen-eventloop.mjs --seed <số> --count 12 --out <thư mục riêng>`
  và giữ `key.json`.
- Phần B (8 câu): người coi thi làm theo `quiz/public/PROCTOR-partB.md`: biến thể của 8 câu production, khóa sinh từ runtime.
- Bạn làm đúng điều kiện người khác: 25 phút, không chạy code, không tra cứu.

**Form.** Google Forms chế độ Quiz. Tiêu đề câu bắt đầu bằng mã (`G01 …`, `B01 …`). Phần A là câu trả lời ngắn, phần B
trắc nghiệm. Câu sàng lọc: `S1` "Bạn đang viết Node.js chạy production trong công việc hiện tại?" (loại nếu không),
`S2` số năm kinh nghiệm, `S3` bản Node đang dùng, `T1`/`T2` giờ bắt đầu và nộp (loại bài > 30 phút).
Đầu đề ghi: "Đáp án áp dụng cho Node 24 LTS (24.22.1)". Google Forms không có đồng hồ đếm ngược; **[cần kiểm]** công cụ
có hẹn giờ thật nếu cần chặt hơn.
**Chấm:** `node quiz/public/grade-responses.mjs responses.csv partA/key.json key-partB.json --me <email>`.

**Tuyển 59+ người hợp lệ.** Theo thứ tự hiệu quả: (1) đồng nghiệp và người phỏng vấn bạn; (2) cộng đồng Node/JavaScript
Việt Nam trên Facebook, Discord; (3) link đề ở cuối bài blog (7.4); (4) r/node và kênh cộng đồng Node quốc tế.
**[cần kiểm]** tên nhóm cụ thể và quy định đăng bài của từng nơi. Gửi tới vài trăm người, vì tỉ lệ mở link rồi làm hết
thường thấp. Ghi số năm kinh nghiệm để báo phân phối theo nhóm junior/senior.

### 7.2 Ba ứng viên PR (rút từ hành vi đã đo)
Đã kiểm trên `main` @ `640ce854` rằng chỗ cần sửa còn thiếu. **[cần kiểm]** issue/PR đang mở trùng chủ đề:
tìm trên github.com/nodejs/node/issues và /pulls trước khi mở.
1. **doc** `doc/api/process.md:669` (mục signal events): tài liệu nói SIGTERM/SIGINT có handler mặc định và thoát;
   chưa nói khi Node là PID 1 trong một PID namespace (container không có init) thì tiến trình **không** thoát.
   Bằng chứng: F12, `b-exp/pid1-sigterm.mjs`, `src/node.cc:189, 619`. Đề xuất một đoạn: cài listener hoặc chạy với init
   (`docker run --init`).
2. **doc** `doc/api/perf_hooks.md:1973` (`monitorEventLoopDelay`): ở chế độ interval, mỗi mẫu là khoảng cách giữa hai lần
   timer chạy (`src/histogram-inl.h` `RecordDelta`), nên khi rảnh p50 ≈ `resolution` và độ trễ thật ≈ giá trị − `resolution`.
   Bằng chứng: `results-eld.txt`.
3. **test** `test/parallel/`: Agent không dùng lại socket khi hint `timeout=N` ≤ `agentKeepAliveTimeoutBuffer`, và dùng lại
   khi còn hạn. Test hiện có chỉ kiểm tiến trình kết thúc (`test-http-client-keep-alive-hint.js`) và giá trị option
   (`test-http-agent-keep-alive-timeout-buffer.js`), không kiểm socket nào được dùng lại. Bằng chứng: p16.

Quy trình: `doc/contributing/pull-requests.md` (DCO, `git commit -s`, tiêu đề `doc: …` / `test: …`),
`doc/contributing/writing-tests.md` (`common.mustCall`), `doc/contributing/collaborator-guide.md` (mở ít nhất 48 giờ,
2 approval). Mục tiêu trong 20 giờ: PR mở và xử lý xong vòng review đầu; merge đến sau.

### 7.3 Áp vào một service thật
- **Đo trước 7 ngày, gồm ít nhất 5 lần deploy:** p99 latency; tỉ lệ 5xx và số 502 ở LB; số request lỗi mỗi lần deploy;
  số lần restart vì OOMKilled; event loop delay p99 (chế độ `samplePerIteration`) và ELU; RSS và `heapUsed` lúc đỉnh;
  thời gian từ SIGTERM tới thoát.
- **Đổi lần lượt, mỗi thay đổi một lần deploy:** `keepAliveTimeout` > idle timeout LB; deadline + hủy cho mọi lời gọi ra
  ngoài; giới hạn hàng đợi và fail nhanh cho pool DB; rút êm khi SIGTERM; giới hạn body; bulkhead cho việc dùng threadpool.
- **Đo sau 7 ngày, cùng số lần deploy.** Báo cáo bảng trước/sau. Giữ dashboard và query để người khác xem lại.

### 7.4 Blog kèm repo
1. Mở bằng F7: "65 request lỗi trong một lần deploy, và 0 sau khi sửa cách tắt tiến trình".
2. Câu đố F12: "Node có handler SIGTERM, vậy sao container không chịu tắt?" Đáp án bằng bảng `SigCgt`.
3. Bảng ka-race: cửa sổ 3,5 ms làm ra lỗi 502 ngắt quãng.
4. Một câu phụ thuộc phiên bản: p23 (cùng code, khác thứ tự trên v24 và v26).
5. Cuối bài: link repo và link đề công khai. Người đọc chạy harness trên máy họ; mọi "máy mình ra khác" là dữ liệu.

---

## 8. Sửa sai (giữ lại vì là bài học)

1. **F8 lần đầu cho 0/270 lỗi.** LB giả chuyển tiếp nguyên header `Connection: close` của client sang backend, nên backend
   đóng kết nối sau mỗi response và không có gì để race. Sau khi bỏ header hop-by-hop: 23/270 (v24), 18/270 (v26).
2. **F8 với một pool LB dùng chung và request chồng nhau: 0/240.** Pool LIFO luôn lấy socket vừa rảnh, nên không socket
   nào rảnh đủ 6 s. Lỗi này xuất hiện ở backend **ít tải**, không phải backend bận.
3. **Trên loopback cửa sổ race gần bằng 0.** Phải thêm RTT 2 ms (relay trễ) mới thấy cửa sổ ~3,5 ms. Ngoài đời cửa sổ cỡ RTT.
4. **DB giả lúc đầu tiếp tục chạy query sau khi client đóng kết nối**, nên bản fixed báo 90 "query treo". Đã sửa để DB
   dừng query khi kết nối đóng, giống Postgres khi backend bị terminate. Sau sửa: naive 10, fixed 0.
5. **Cổng harness nằm trong dải cổng tạm của Linux (32768–60999)**, đụng cổng nguồn của kết nối đi ra → `EADDRINUSE`.
   Dời xuống 10000–25000.
6. **Lọc race bằng 40 lần chạy để lọt một câu** (seed 101, g11 cũ: thứ tự khác xuất hiện 1/60 lần). Tăng lên 100.
   Lọc vẫn là thống kê: câu nào bạn thấy ra thứ tự khác, ghi lại và báo.
7. **Giả thuyết "Node có handler SIGTERM nên PID 1 vẫn thoát" sai** (F12, `pid1-sigterm.mjs`).
8. **Payload leak `'x'.repeat(10000) + Math.random()` chỉ làm heap tăng 14 MB cho 5000 request**, không phải ~50 MB như
   mình tính. Đổi sang mảng 1250 số: +59,8 MB. **[cần kiểm]** cơ chế V8 làm chuỗi ghép chiếm ít bộ nhớ hơn dự tính.
9. **p23 lần đầu đọc file `[eval]`** (không tồn tại), nên `fs.promises.readFile` reject và biến mất khỏi kết quả. Đã sửa
   để đọc file thật.
10. **Ngưỡng F1 p99 ≤ 400 ms quá chặt:** bản fixed (deadline 300 ms) đạt 415 ms trên v24 vì nhiễu máy 2 lõi. Nới thành 500 ms.

---

## 9. Còn [cần kiểm]
- Ngày Node 26 lên LTS.
- PR nào thêm căn lề cho Buffer pool trên v26.
- Issue/PR trùng cho 3 ứng viên ở 7.2.
- Công cụ quiz có hẹn giờ thật; tên nhóm cộng đồng và quy định đăng bài.
- cgroup v2 và macOS: `tools/incg.sh` có nhánh cgroup v2 nhưng chưa chạy trên máy cgroup v2.
- Phần chuỗi cung ứng npm chưa có kịch bản đo.
- Cơ chế bộ nhớ của chuỗi ghép (Sửa sai 8).
