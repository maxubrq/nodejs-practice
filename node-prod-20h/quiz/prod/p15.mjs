// Q: http.createServer({ headersTimeout: 20000, requestTimeout: 10000 }) — chuyện gì xảy ra?
import http from 'node:http';
try { http.createServer({ headersTimeout: 20000, requestTimeout: 10000 }); console.log('ok'); }
catch (e) { console.log(`throws ${e.code}`); }
