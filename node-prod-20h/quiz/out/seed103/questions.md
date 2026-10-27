# Câu hỏi thứ tự thực thi — seed 103 (CommonJS, file chính)

Mỗi câu: chuỗi chữ cái in ra là gì? `log` đẩy nhãn vào mảng, in ở 'exit'.
Ghi dự đoán + độ tự tin 1–5 vào journal.csv TRƯỚC khi chạy.

## g01

```js
log('A');
log('B');
Promise.resolve().then(() => {
  log('C');
  queueMicrotask(() => {
    log('D');
  });
});
queueMicrotask(() => {
  log('E');
  (async () => {
    await null;
    log('F');
    setImmediate(() => {
      log('G');
    });
  })();
});
```

## g02

```js
setImmediate(() => {
  log('A');
  setImmediate(() => {
    log('B');
    process.nextTick(() => {
      log('C');
    });
  });
});
process.nextTick(() => {
  log('D');
  log('E');
  (async () => {
    await null;
    log('F');
    Promise.resolve().then(() => {
      log('G');
    });
  })();
});
```

## g03

```js
process.nextTick(() => {
  log('A');
  setImmediate(() => {
    log('B');
  });
  Promise.resolve().then(() => {
    log('C');
  });
});
(async () => {
  await null;
  log('D');
  (async () => {
    log('E');
    await Promise.resolve();
    process.nextTick(() => {
      log('F');
    });
    log('G');
  })();
  process.nextTick(() => {
    log('H');
    process.nextTick(() => {
      log('I');
    });
  });
})();
```

## g04

```js
process.nextTick(() => {
  log('A');
});
setTimeout(() => {
  log('B');
  (async () => {
    await null;
    log('C');
  })();
  queueMicrotask(() => {
    log('D');
    Promise.resolve().then(() => {
      log('E');
    });
  });
}, 0);
setTimeout(() => {
  log('F');
}, 0);
```

## g05

```js
(async () => {
  log('A');
  await Promise.resolve();
  setTimeout(() => {
    log('B');
    setTimeout(() => {
      log('C');
    }, 0);
  }, 0);
  log('D');
})();
(async () => {
  log('E');
  await Promise.resolve();
  log('F');
})();
```

## g06

```js
process.nextTick(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    setTimeout(() => {
      log('C');
    }, 0);
    log('D');
  })();
  (async () => {
    log('E');
    await Promise.resolve();
    log('F');
    log('G');
  })();
});
```

## g07

```js
(async () => {
  await null;
  log('A');
  process.nextTick(() => {
    log('B');
    setImmediate(() => {
      log('C');
    });
  });
})();
process.nextTick(() => {
  log('D');
  process.nextTick(() => {
    log('E');
  });
});
log('F');
```

## g08

```js
process.nextTick(() => {
  log('A');
});
queueMicrotask(() => {
  log('B');
});
queueMicrotask(() => {
  log('C');
  fs.stat(__filename, () => {
    log('D');
    log('E');
    process.nextTick(() => {
      log('F');
    });
  });
  (async () => {
    await null;
    log('G');
    process.nextTick(() => {
      log('H');
    });
  })();
});
```

## g09

```js
setTimeout(() => {
  log('A');
}, 0);
log('B');
(async () => {
  await null;
  log('C');
  queueMicrotask(() => {
    log('D');
    log('E');
    Promise.resolve().then(() => {
      log('F');
    });
  });
})();
```

## g10

```js
Promise.resolve().then(() => {
  log('A');
});
queueMicrotask(() => {
  log('B');
  (async () => {
    await null;
    log('C');
    process.nextTick(() => {
      log('D');
    });
  })();
  process.nextTick(() => {
    log('E');
    log('F');
  });
});
```

## g11

```js
queueMicrotask(() => {
  log('A');
});
(async () => {
  await null;
  log('B');
  queueMicrotask(() => {
    log('C');
    log('D');
    log('E');
  });
  (async () => {
    log('F');
    await Promise.resolve();
    Promise.resolve().then(() => {
      log('G');
    });
    log('H');
  })();
})();
```

## g12

```js
fs.stat(__filename, () => {
  log('A');
  setImmediate(() => {
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
process.nextTick(() => {
  log('F');
});
```

