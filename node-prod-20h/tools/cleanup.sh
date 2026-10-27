#!/bin/sh
# Dọn các tiến trình harness còn sót (service, deps, LB, probe) sau khi một lần chạy bị ngắt.
for p in $(pgrep -f '(faults/deps\.mjs|service/[a-z]+\.mjs|_solutions/fixed\.mjs|tools/lb\.mjs|tools/probe\.mjs|faults/run\.mjs)'); do
  [ "$p" = "$$" ] && continue
  case "$(cat /proc/$p/comm 2>/dev/null)" in node|node24|node26|unshare|incg.sh) kill -9 "$p" 2>/dev/null;; esac
done
rmdir /sys/fs/cgroup/memory/np20h_* /sys/fs/cgroup/np20h_* 2>/dev/null
exit 0
