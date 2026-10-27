# Câu hỏi thứ tự thực thi — seed 102 (CommonJS, file chính)

Mỗi câu: chuỗi chữ cái in ra là gì? `log` đẩy nhãn vào mảng, in ở 'exit'.
Ghi dự đoán + độ tự tin 1–5 vào journal.csv TRƯỚC khi chạy.

## g01

```js
fs.stat(__filename, () => {
  log('A');
  Promise.resolve().then(() => {
    log('B');
    log('C');
  });
  setTimeout(() => {
    log('D');
    setImmediate(() => {
      log('E');
    });
    Promise.resolve().then(() => {
      log('F');
    });
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
setTimeout(() => {
  log('C');
  log('D');
  setTimeout(() => {
    log('E');
    Promise.resolve().then(() => {
      log('F');
    });
  }, 0);
}, 0);
```

## g03

```js
fs.stat(__filename, () => {
  log('A');
  process.nextTick(() => {
    log('B');
    queueMicrotask(() => {
      log('C');
    });
    process.nextTick(() => {
      log('D');
    });
  });
});
queueMicrotask(() => {
  log('E');
});
Promise.resolve().then(() => {
  log('F');
  fs.stat(__filename, () => {
    log('G');
    setImmediate(() => {
      log('H');
    });
    queueMicrotask(() => {
      log('I');
    });
  });
});
```

## g04

```js
(async () => {
  await null;
  log('A');
  log('B');
  log('C');
})();
queueMicrotask(() => {
  log('D');
});
process.nextTick(() => {
  log('E');
  setTimeout(() => {
    log('F');
    process.nextTick(() => {
      log('G');
    });
  }, 0);
});
```

## g05

```js
setImmediate(() => {
  log('A');
  (async () => {
    log('B');
    await Promise.resolve();
    setImmediate(() => {
      log('C');
    });
    setImmediate(() => {
      log('D');
    });
    log('E');
  })();
});
(async () => {
  await null;
  log('F');
  log('G');
  Promise.resolve().then(() => {
    log('H');
  });
})();
```

## g06

```js
process.nextTick(() => {
  log('A');
  (async () => {
    await null;
    log('B');
    Promise.resolve().then(() => {
      log('C');
    });
  })();
  (async () => {
    await null;
    log('D');
  })();
});
fs.stat(__filename, () => {
  log('E');
  process.nextTick(() => {
    log('F');
    setTimeout(() => {
      log('G');
    }, 0);
  });
  log('H');
});
```

## g07

```js
queueMicrotask(() => {
  log('A');
});
Promise.resolve().then(() => {
  log('B');
});
(async () => {
  await null;
  log('C');
  Promise.resolve().then(() => {
    log('D');
  });
  setImmediate(() => {
    log('E');
    queueMicrotask(() => {
      log('F');
    });
  });
})();
```

## g08

```js
(async () => {
  log('A');
  await Promise.resolve();
  log('B');
})();
process.nextTick(() => {
  log('C');
  setTimeout(() => {
    log('D');
    Promise.resolve().then(() => {
      log('E');
    });
  }, 0);
});
log('F');
```

## g09

```js
log('A');
setImmediate(() => {
  log('B');
  log('C');
  Promise.resolve().then(() => {
    log('D');
    setImmediate(() => {
      log('E');
    });
  });
});
process.nextTick(() => {
  log('F');
});
```

## g10

```js
log('A');
Promise.resolve().then(() => {
  log('B');
  process.nextTick(() => {
    log('C');
    queueMicrotask(() => {
      log('D');
    });
  });
  log('E');
});
setTimeout(() => {
  log('F');
  process.nextTick(() => {
    log('G');
    Promise.resolve().then(() => {
      log('H');
    });
  });
  (async () => {
    log('I');
    await Promise.resolve();
    setTimeout(() => {
      log('J');
    }, 0);
    log('K');
  })();
}, 0);
```

## g11

```js
(async () => {
  await null;
  log('A');
  log('B');
})();
(async () => {
  log('C');
  await Promise.resolve();
  (async () => {
    log('D');
    await Promise.resolve();
    log('E');
    log('F');
  })();
  setTimeout(() => {
    log('G');
    log('H');
    log('I');
  }, 0);
  log('J');
})();
```

## g12

```js
queueMicrotask(() => {
  log('A');
});
setImmediate(() => {
  log('B');
  log('C');
});
(async () => {
  log('D');
  await Promise.resolve();
  queueMicrotask(() => {
    log('E');
  });
  log('F');
})();
```

