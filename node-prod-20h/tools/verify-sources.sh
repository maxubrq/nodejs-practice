#!/bin/sh
# Kiểm mọi đường dẫn mã nguồn và test được nhắc trong PLAN.md: file tồn tại, ký hiệu có mặt, in số dòng ở mỗi tag.
# Chuẩn bị:  git clone --depth 1 --branch v24.22.1 https://github.com/nodejs/node src/node24
#            git clone --depth 1 --branch v26.12.1 https://github.com/nodejs/node src/node26
# Dùng: tools/verify-sources.sh <thư mục chứa node24 và node26>
SRC=${1:-../src}
check() { # file  ký-hiệu
  for v in 24 26; do
    f="$SRC/node$v/$1"
    if [ ! -f "$f" ]; then printf 'v%s  MISSING  %s\n' "$v" "$1"; continue; fi
    if [ -z "$2" ]; then printf 'v%s  ok       %s\n' "$v" "$1"; continue; fi
    l=$(grep -n -m1 -F -- "$2" "$f" | cut -d: -f1)
    if [ -n "$l" ]; then printf 'v%s  %-7s  %s  «%s»\n' "$v" "$l" "$1" "$2"; else printf 'v%s  NOTFOUND %s «%s»\n' "$v" "$1" "$2"; fi
  done
}
# 1 event loop
check deps/uv/src/unix/core.c "int uv_run(uv_loop_t* loop, uv_run_mode mode)"
check deps/uv/src/threadpool.c "static void init_threads(void)"
check deps/uv/src/threadpool.c "UV_THREADPOOL_SIZE"
check lib/internal/timers.js "function processTimers(now)"
check lib/internal/timers.js "function processImmediate()"
check lib/internal/process/task_queues.js "function processTicksAndRejections()"
check lib/internal/process/promises.js "function processPromiseRejections()"
check lib/internal/process/promises.js "function throwUnhandledRejectionsMode(promise, promiseInfo)"
# 2 bộ nhớ
check src/api/environment.cc "uv_get_constrained_memory"
check lib/buffer.js "Buffer.poolSize = 64 * 1024;"
check lib/internal/streams/state.js "let defaultHighWaterMarkBytes"
# 3 stream
check lib/internal/streams/writable.js "function writeOrBuffer(stream, state, chunk, encoding, callback)"
check lib/internal/streams/pipeline.js "function pipelineImpl(streams, callback, opts)"
check lib/internal/streams/end-of-stream.js "function eos(stream, options, callback)"
check lib/internal/streams/readable.js "Readable.prototype.pipe = function(dest, pipeOpts)"
# 4 HTTP server
check lib/_http_server.js "this.requestTimeout = 300_000"
check lib/_http_server.js "this.headersTimeout = MathMin(60_000, this.requestTimeout)"
check lib/_http_server.js "this.keepAliveTimeout = 5_000"
check lib/_http_server.js "this.keepAliveTimeoutBuffer = 1000"
check lib/_http_server.js "socket.setTimeout(keepAliveTimeout + keepAliveTimeoutBuffer)"
check lib/_http_server.js "function socketOnTimeout()"
check lib/_http_server.js "Server.prototype.closeIdleConnections = function"
check lib/_http_server.js "Server.prototype.close = function"
check lib/_http_agent.js "Agent.prototype.keepSocketAlive = function keepSocketAlive(socket)"
check lib/_http_outgoing.js "ERR_STREAM_DESTROYED"
check src/node_options.h "network_family_autoselection_attempt_timeout ="
# 5 undici
check deps/undici/src/lib/dispatcher/client.js "this[kHeadersTimeout] = headersTimeout != null ? headersTimeout : 300e3"
check deps/undici/src/lib/dispatcher/client.js "this[kBodyTimeout] = bodyTimeout != null ? bodyTimeout : 300e3"
check deps/undici/src/lib/dispatcher/client.js "this[kKeepAliveTimeoutThreshold]"
check deps/undici/src/lib/core/connect.js "timeout = timeout == null ? 10e3 : timeout"
check deps/undici/src/lib/dispatcher/pool.js "this[kConnections] = connections || null"
check deps/undici/src/lib/util/timers.js "TICK_MS"
# 6 lỗi, hủy, abort
check lib/internal/abort_controller.js "static any(signals)"
check lib/internal/abort_controller.js "static timeout(delay)"
check lib/internal/perf/event_loop_utilization.js "function eventLoopUtilization(util1, util2)"
check src/histogram-inl.h "RecordDelta"
check lib/internal/modules/esm/module_job.js "ERR_REQUIRE_ASYNC_MODULE"
check lib/events.js "MaxListenersExceededWarning"
# test khóa hành vi
for t in parallel/test-http-keep-alive-timeout-buffer.js parallel/test-http-client-keep-alive-hint.js \
         parallel/test-http-agent-keep-alive-timeout-buffer.js parallel/test-http-server-close-idle.js \
         parallel/test-http-server-close-all.js parallel/test-http-server-headers-timeout-keepalive.js \
         parallel/test-http-outgoing-destroyed.js parallel/test-stream-pipeline.js parallel/test-stream-pipeline-listeners.js \
         parallel/test-promises-unhandled-rejections.js parallel/test-promise-unhandled-flag.js \
         parallel/test-abortsignal-any.mjs parallel/test-timers-immediate-queue.js parallel/test-next-tick-ordering.js \
         parallel/test-max-old-space-size-percentage.js parallel/test-buffer-pool-untransferable.js \
         sequential/test-performance-eventloopdelay.js parallel/test-net-autoselectfamily.js \
         es-module/test-require-module-tla-execution.js parallel/test-http-server-request-timeout-keepalive.js; do
  check "test/$t" ""
done
