// Q: Tiến trình nhận SIGTERM và không có handler. process.on('exit') có chạy không? Mã thoát/tín hiệu?
import { spawn } from "node:child_process";
const c = spawn(process.execPath, [
  "-e",
  `
  process.on('exit', () => console.log('exit-handler'));
  setInterval(() => {}, 1000);
  console.log('ready');
`,
]);
let out = "";
c.stdout.on("data", (d) => {
  out += d;
  if (out.includes("ready")) c.kill("SIGTERM");
});
c.on("exit", (code, sig) =>
  console.log(
    `exitHandlerRan=${out.includes("exit-handler")} code=${code} signal=${sig}`,
  ),
);
