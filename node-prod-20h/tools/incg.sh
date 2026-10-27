#!/bin/sh
# Chạy một lệnh trong cgroup bộ nhớ có giới hạn (Linux, cần root).
# Dùng: tools/incg.sh 256M node script.js
# Tự động nhận cgroup v1 hoặc v2. Trên macOS: docker run --memory=256m ...
set -e
LIM="$1"; shift
case "$LIM" in *M) BYTES=$(( ${LIM%M} * 1048576 ));; *G) BYTES=$(( ${LIM%G} * 1073741824 ));; *) BYTES=$LIM;; esac
NAME="np20h_$$"
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
  CG=/sys/fs/cgroup/$NAME; mkdir -p "$CG"; echo "$BYTES" > "$CG/memory.max"; echo 0 > "$CG/memory.swap.max" 2>/dev/null || true
else
  CG=/sys/fs/cgroup/memory/$NAME; mkdir -p "$CG"; echo "$BYTES" > "$CG/memory.limit_in_bytes"
  echo "$BYTES" > "$CG/memory.memsw.limit_in_bytes" 2>/dev/null || true
fi
echo $$ > "$CG/cgroup.procs"
exec "$@"
