// Q: Buffer.allocUnsafe(100) cắt từ pool chung. Kích thước ArrayBuffer nền là bao nhiêu? Buffer.alloc(100) thì sao?
console.log(
  `allocUnsafe.buffer=${Buffer.allocUnsafe(100).buffer.byteLength} alloc.buffer=${Buffer.alloc(100).buffer.byteLength}`,
);
