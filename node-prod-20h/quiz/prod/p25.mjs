// Q: Listener đăng ký trong context A, emit từ context B. Listener thấy store nào?
import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
const als = new AsyncLocalStorage();
const bus = new EventEmitter();
als.run('A', () => bus.on('x', () => console.log(`listener sees ${als.getStore()}`)));
als.run('B', () => bus.emit('x'));
