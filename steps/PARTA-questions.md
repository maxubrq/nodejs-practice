# Câu hỏi thứ tự thực thi (CommonJS, file chính)

Mỗi câu: chuỗi chữ cái in ra là gì? `log` đẩy nhãn vào mảng, in ở 'exit'.
Ghi dự đoán + độ tự tin 1–5 vào journal.csv TRƯỚC khi chạy.

## g01

```js
process.nextTick(() => {
  log('A');
});
setImmediate(() => {
  log('B');
});
log('C');
process.nextTick(() => {
  log('D');
  fs.stat(__filename, () => {
    log('E');
  });
  queueMicrotask(() => {
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

## g02

```js
Promise.resolve().then(() => {
  log('A');
  queueMicrotask(() => {
    log('B');
  });
});
process.nextTick(() => {
  log('C');
  Promise.resolve().then(() => {
    log('D');
  });
});
setTimeout(() => {
  log('E');
  process.nextTick(() => {
    log('F');
  });
  Promise.resolve().then(() => {
    log('G');
    setTimeout(() => {
      log('H');
    }, 0);
    log('I');
  });
}, 0);
```

## g03

```js
(async () => {
  await null;
  log('A');
  log('B');
  setTimeout(() => {
    log('C');
    setImmediate(() => {
      log('D');
    });
    log('E');
  }, 0);
})();
(async () => {
  await null;
  log('F');
  (async () => {
    log('G');
    await Promise.resolve();
    Promise.resolve().then(() => {
      log('H');
    });
    log('I');
  })();
  log('J');
})();
```

## g04

```js
log('A');
queueMicrotask(() => {
  log('B');
  queueMicrotask(() => {
    log('C');
  });
  Promise.resolve().then(() => {
    log('D');
  });
});
process.nextTick(() => {
  log('E');
});
setImmediate(() => {
  log('F');
});
```

## g05

```js
setImmediate(() => {
  log('A');
  fs.stat(__filename, () => {
    log('B');
    setTimeout(() => {
      log('C');
    }, 0);
  });
});
fs.stat(__filename, () => {
  log('D');
});
queueMicrotask(() => {
  log('E');
});
(async () => {
  log('F');
  await Promise.resolve();
  (async () => {
    await null;
    log('G');
    Promise.resolve().then(() => {
      log('H');
    });
    queueMicrotask(() => {
      log('I');
    });
  })();
  Promise.resolve().then(() => {
    log('J');
  });
  log('K');
})();
```

## g06

```js
setTimeout(() => {
  log('A');
  log('B');
  process.nextTick(() => {
    log('C');
    queueMicrotask(() => {
      log('D');
    });
  });
}, 0);
process.nextTick(() => {
  log('E');
  setTimeout(() => {
    log('F');
  }, 0);
  (async () => {
    await null;
    log('G');
  })();
});
```

## g07

```js
(async () => {
  await null;
  log('A');
})();
(async () => {
  await null;
  log('B');
  Promise.resolve().then(() => {
    log('C');
    log('D');
  });
})();
(async () => {
  log('E');
  await Promise.resolve();
  setImmediate(() => {
    log('F');
    process.nextTick(() => {
      log('G');
    });
    Promise.resolve().then(() => {
      log('H');
    });
  });
  log('I');
})();
```

## g08

```js
queueMicrotask(() => {
  log('A');
  queueMicrotask(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
  });
  log('D');
});
setTimeout(() => {
  log('E');
}, 0);
queueMicrotask(() => {
  log('F');
});
```

## g09

```js
log('A');
process.nextTick(() => {
  log('B');
  setImmediate(() => {
    log('C');
  });
  queueMicrotask(() => {
    log('D');
  });
});
Promise.resolve().then(() => {
  log('E');
});
fs.stat(__filename, () => {
  log('F');
});
```

## g10

```js
(async () => {
  log('A');
  await Promise.resolve();
  Promise.resolve().then(() => {
    log('B');
  });
  log('C');
})();
(async () => {
  log('D');
  await Promise.resolve();
  (async () => {
    await null;
    log('E');
    log('F');
  })();
  log('G');
})();
```

## g11

```js
setTimeout(() => {
  log('A');
  setImmediate(() => {
    log('B');
  });
  (async () => {
    log('C');
    await Promise.resolve();
    log('D');
    Promise.resolve().then(() => {
      log('E');
    });
    log('F');
  })();
}, 0);
```

## g12

```js
setImmediate(() => {
  log('A');
  setImmediate(() => {
    log('B');
    setImmediate(() => {
      log('C');
    });
  });
});
queueMicrotask(() => {
  log('D');
});
(async () => {
  await null;
  log('E');
})();
queueMicrotask(() => {
  log('F');
});
```

