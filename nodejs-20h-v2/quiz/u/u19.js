// Default server timeouts on this version, and when an idle keep-alive socket is actually closed.
const s = require('http').createServer();
console.log('keepAliveTimeout', s.keepAliveTimeout, 'buffer', s.keepAliveTimeoutBuffer,
  'headersTimeout', s.headersTimeout, 'requestTimeout', s.requestTimeout);
