// Relay TCP thêm độ trễ một chiều D ms cho mọi sự kiện (dữ liệu, FIN, RST), để giả lập RTT giữa LB và backend
// trong một VPC. Trên loopback RTT gần 0 nên cửa sổ race keep-alive gần như biến mất; ngoài đời nó bằng RTT.
// Dùng: fork('tools/delay.mjs', [listenPort, targetPort, D])
import net from 'node:net';

const [listen, target, d] = process.argv.slice(2).map(Number);
const later = (fn) => setTimeout(fn, d);

function wire(a, b) {
  a.on('data', (buf) => later(() => { if (!b.destroyed) b.write(buf); }));
  a.on('end', () => later(() => { if (!b.destroyed) b.end(); }));
  a.on('error', () => later(() => { if (!b.destroyed) b.resetAndDestroy(); }));   // RST đi tiếp thành RST
  a.on('close', () => later(() => { if (!b.destroyed && !b.writableEnded) b.destroy(); }));
}

net.createServer({ allowHalfOpen: true }, (client) => {
  const up = net.connect({ port: target, host: '127.0.0.1', allowHalfOpen: true });
  wire(client, up); wire(up, client);
}).listen(listen, '127.0.0.1', () => process.send?.({ ready: true }));
