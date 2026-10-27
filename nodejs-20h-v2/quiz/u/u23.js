// AsyncLocalStorage: the emitter is created in request A; listener registered in A; emit() is called from request B.
const { AsyncLocalStorage } = require('async_hooks');
const { EventEmitter } = require('events');
const als = new AsyncLocalStorage(); const bus = new EventEmitter();
als.run('A', () => bus.on('ping', () => console.log('listener sees', als.getStore())));
als.run('B', () => setTimeout(() => bus.emit('ping'), 10));
