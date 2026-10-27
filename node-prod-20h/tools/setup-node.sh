#!/bin/sh
# Tải đúng hai binary Node dùng trong PLAN.md từ npm (không cần nvm, không cần nodejs.org) và tạo bin/node24, bin/node26.
# Linux x64. macOS Apple Silicon: thay node-linux-x64 bằng node-darwin-arm64 (chỉ dùng được phần không cần cgroup).
set -e
cd "$(dirname "$0")/.."
PKG=${NODE_PKG:-node-linux-x64}
mkdir -p .runtimes bin
for v in 24.22.1 26.12.1; do
  major=${v%%.*}
  d=.runtimes/$major
  if [ ! -x "$d/node_modules/$PKG/bin/node" ]; then
    mkdir -p "$d" && (cd "$d" && npm init -y >/dev/null && npm i --no-audit --no-fund "$PKG@$v" >/dev/null)
  fi
  ln -sf "../$d/node_modules/$PKG/bin/node" "bin/node$major"
  echo "bin/node$major -> $(bin/node$major -v)"
done
