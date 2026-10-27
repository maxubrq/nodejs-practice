# Câu hỏi thứ tự thực thi — seed 201 (ESM, file chính)

Mỗi câu: chuỗi chữ cái in ra là gì? `log` đẩy nhãn vào mảng, in ở 'exit'.
Ghi dự đoán + độ tự tin 1–5 vào journal.csv TRƯỚC khi chạy.

## g01

```js
queueMicrotask(() => {
  log('A');
  queueMicrotask(() => {
    log('B');
    log('C');
    log('D');
  });
});
queueMicrotask(() => {
  log('E');
  setTimeout(() => {
    log('F');
    setImmediate(() => {
      log('G');
    });
    setTimeout(() => {
      log('H');
    }, 0);
  }, 0);
});
```

## g02

```js
(async () => {
  log('A');
  await Promise.resolve();
  log('B');
})();
log('C');
queueMicrotask(() => {
  log('D');
});
setTimeout(() => {
  log('E');
  queueMicrotask(() => {
    log('F');
    process.nextTick(() => {
      log('G');
    });
    setImmediate(() => {
      log('H');
    });
  });
}, 0);
```

## g03

```js
log('A');
setImmediate(() => {
  log('B');
  process.nextTick(() => {
    log('C');
    Promise.resolve().then(() => {
      log('D');
    });
    setImmediate(() => {
      log('E');
    });
  });
});
queueMicrotask(() => {
  log('F');
  process.nextTick(() => {
    log('G');
  });
});
```

## g04

```js
Promise.resolve().then(() => {
  log('A');
  process.nextTick(() => {
    log('B');
    setImmediate(() => {
      log('C');
    });
  });
  Promise.resolve().then(() => {
    log('D');
  });
});
process.nextTick(() => {
  log('E');
  process.nextTick(() => {
    log('F');
    process.nextTick(() => {
      log('G');
    });
    process.nextTick(() => {
      log('H');
    });
  });
});
```

## g05

```js
queueMicrotask(() => {
  log('A');
  fs.stat(__filename, () => {
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
    queueMicrotask(() => {
      log('D');
    });
  });
});
(async () => {
  await null;
  log('E');
})();
fs.stat(__filename, () => {
  log('F');
  fs.stat(__filename, () => {
    log('G');
    log('H');
    setImmediate(() => {
      log('I');
    });
  });
});
```

## g06

```js
log('A');
log('B');
(async () => {
  log('C');
  await Promise.resolve();
  fs.stat(__filename, () => {
    log('D');
    queueMicrotask(() => {
      log('E');
    });
  });
  log('F');
})();
```

## g07

```js
(async () => {
  log('A');
  await Promise.resolve();
  Promise.resolve().then(() => {
    log('B');
    setImmediate(() => {
      log('C');
    });
    Promise.resolve().then(() => {
      log('D');
    });
  });
  (async () => {
    await null;
    log('E');
  })();
  log('F');
})();
```

## g08

```js
queueMicrotask(() => {
  log('A');
});
log('B');
process.nextTick(() => {
  log('C');
});
queueMicrotask(() => {
  log('D');
  setTimeout(() => {
    log('E');
    log('F');
    setImmediate(() => {
      log('G');
    });
  }, 0);
});
```

## g09

```js
Promise.resolve().then(() => {
  log('A');
  process.nextTick(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
    queueMicrotask(() => {
      log('D');
    });
  });
  process.nextTick(() => {
    log('E');
    setImmediate(() => {
      log('F');
    });
  });
});
```

## g10

```js
(async () => {
  await null;
  log('A');
})();
setImmediate(() => {
  log('B');
  fs.stat(__filename, () => {
    log('C');
  });
  Promise.resolve().then(() => {
    log('D');
    log('E');
  });
});
log('F');
```

## g11

```js
process.nextTick(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    log('C');
    setImmediate(() => {
      log('D');
    });
    log('E');
  })();
});
(async () => {
  log('F');
  await Promise.resolve();
  log('G');
})();
```

## g12

```js
queueMicrotask(() => {
  log('A');
  Promise.resolve().then(() => {
    log('B');
    process.nextTick(() => {
      log('C');
    });
    Promise.resolve().then(() => {
      log('D');
    });
  });
  setTimeout(() => {
    log('E');
  }, 0);
});
log('F');
```

