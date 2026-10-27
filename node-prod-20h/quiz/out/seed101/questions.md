# Câu hỏi thứ tự thực thi — seed 101 (CommonJS, file chính)

Mỗi câu: chuỗi chữ cái in ra là gì? `log` đẩy nhãn vào mảng, in ở 'exit'.
Ghi dự đoán + độ tự tin 1–5 vào journal.csv TRƯỚC khi chạy.

## g01

```js
queueMicrotask(() => {
  log('A');
  queueMicrotask(() => {
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
    log('D');
  });
  log('E');
});
queueMicrotask(() => {
  log('F');
});
```

## g02

```js
process.nextTick(() => {
  log('A');
  Promise.resolve().then(() => {
    log('B');
  });
  setImmediate(() => {
    log('C');
  });
});
setImmediate(() => {
  log('D');
});
queueMicrotask(() => {
  log('E');
  queueMicrotask(() => {
    log('F');
    setImmediate(() => {
      log('G');
    });
    queueMicrotask(() => {
      log('H');
    });
  });
  log('I');
});
```

## g03

```js
process.nextTick(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    log('C');
  })();
});
Promise.resolve().then(() => {
  log('D');
  (async () => {
    log('E');
    await Promise.resolve();
    Promise.resolve().then(() => {
      log('F');
    });
    log('G');
  })();
});
```

## g04

```js
setImmediate(() => {
  log('A');
});
queueMicrotask(() => {
  log('B');
  process.nextTick(() => {
    log('C');
    setImmediate(() => {
      log('D');
    });
  });
});
(async () => {
  await null;
  log('E');
  process.nextTick(() => {
    log('F');
  });
})();
```

## g05

```js
fs.stat(__filename, () => {
  log('A');
  log('B');
  queueMicrotask(() => {
    log('C');
    Promise.resolve().then(() => {
      log('D');
    });
  });
});
log('E');
(async () => {
  await null;
  log('F');
})();
```

## g06

```js
(async () => {
  log('A');
  await Promise.resolve();
  (async () => {
    await null;
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
  })();
  log('D');
})();
setTimeout(() => {
  log('E');
}, 0);
setTimeout(() => {
  log('F');
}, 0);
```

## g07

```js
queueMicrotask(() => {
  log('A');
  setTimeout(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
  }, 0);
  setTimeout(() => {
    log('D');
  }, 0);
});
Promise.resolve().then(() => {
  log('E');
  log('F');
});
```

## g08

```js
process.nextTick(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    setTimeout(() => {
      log('C');
    }, 0);
    process.nextTick(() => {
      log('D');
    });
    log('E');
  })();
  Promise.resolve().then(() => {
    log('F');
  });
});
```

## g09

```js
queueMicrotask(() => {
  log('A');
  setImmediate(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
    Promise.resolve().then(() => {
      log('D');
    });
  });
});
Promise.resolve().then(() => {
  log('E');
  log('F');
  log('G');
});
```

## g10

```js
queueMicrotask(() => {
  log('A');
  log('B');
});
(async () => {
  await null;
  log('C');
  Promise.resolve().then(() => {
    log('D');
    process.nextTick(() => {
      log('E');
    });
  });
})();
Promise.resolve().then(() => {
  log('F');
  setImmediate(() => {
    log('G');
  });
  Promise.resolve().then(() => {
    log('H');
    log('I');
  });
});
```

## g11

```js
setImmediate(() => {
  log('A');
  setImmediate(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
  });
  process.nextTick(() => {
    log('D');
  });
});
queueMicrotask(() => {
  log('E');
  queueMicrotask(() => {
    log('F');
  });
  queueMicrotask(() => {
    log('G');
  });
});
```

## g12

```js
setTimeout(() => {
  log('A');
  process.nextTick(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
  });
  queueMicrotask(() => {
    log('D');
    setTimeout(() => {
      log('E');
    }, 0);
    setTimeout(() => {
      log('F');
    }, 0);
  });
}, 0);
```

