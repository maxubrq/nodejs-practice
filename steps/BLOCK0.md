# Block 0 · 0:00–1:30 · Đo baseline (chưa đọc gì)

Nguồn: `node-prod-20h/PLAN.md` mục 6 (Block 0), mục 5, mục 7.1.
Mục tiêu: có cột **GIỜ 0** trong `journal.csv` để giờ 20 so lại. Block này **gần như không chạy lệnh nào trước khi dự đoán xong**.
Chạy lệnh chỉ để chấm, sau khi đã ghi dự đoán.

Mọi đường dẫn dưới đây tính từ `node-prod-20h/`:

```sh
cd /Users/hungtran/MyApps/Node20-Practice/node-prod-20h
```

---

## 0. Chuẩn bị (trước khi bấm giờ, ~5 phút)

```sh
node -v                  # máy bạn: v24.10.0 (khóa đáp án sinh trên v24.22.1, xem "Lưu ý" cuối file)
git status               # đang sạch; steps/ chưa commit
```

Không cần `tools/setup-node.sh`, không cần Docker, không cần cgroup cho Block 0.
Nếu muốn có đúng 24.22.1 / 26.12.1 cho các block sau (máy bạn là macOS arm64):

```sh
NODE_PKG=node-darwin-arm64 tools/setup-node.sh     # tạo .runtimes/ và bin/node24, bin/node26
```

`.gitignore` chỉ có `node_modules`, nên thêm `.runtimes/` và `bin/` nếu không muốn commit chúng.

---

## 1. File cần để ý

| File / thư mục | Dùng để | Mở lúc nào |
|---|---|---|
| `quiz/out/seed101/questions.md` | 12 câu thứ tự thực thi CJS (chỉ có code) | **Đọc** để dự đoán |
| `quiz/out/seed201-esm/questions.md` | 12 câu ESM | **Đọc** để dự đoán |
| `quiz/prod/p01.mjs … p30.mjs` | 30 câu production; dòng đầu `// Q:` là câu hỏi, code bên dưới | **Đọc**, không chạy |
| `service/naive.mjs`, `faults/run.mjs` | Xem service naive và 12 kịch bản F1–F12 để điền bảng "chuyện gì xảy ra" | Đọc được; chỉ đọc code, không chạy |
| `PLAN.md` mục 2 (cột giá trị) | Bảng 7 timeout | **Không đọc** khi điền |
| `journal.csv` | Nơi ghi dự đoán, hiện chỉ có dòng tiêu đề | Ghi suốt block |
| `quiz/out/seed101/key.json`, `quiz/out/seed201-esm/key.json` | Đáp án | **Cấm mở** tới khi ghi xong dự đoán cả 24 câu |
| `quiz/key-v24.json` (và `key-v26.json`) | Đáp án 30 câu production | **Cấm mở** tới khi ghi xong 30 dự đoán |
| `quiz/out/seed101/gNN.cjs`, `seed201-esm/gNN.mjs` | Chính 12 câu dưới dạng chạy được; chạy = chấm | Chỉ sau khi ghi dự đoán |
| `quiz/gen-eventloop.mjs` | Sinh bộ câu mới cho phần A đề công khai (người coi thi chạy) | Bước 5 |
| `quiz/run.mjs` | Chạy 30 câu production (`--check-key`) | Chỉ khi chấm |
| `tools/journal-stats.mjs` | Tỉ lệ đúng theo block và theo mức tự tin | Cuối block |
| `faults/CRITERIA.md`, `_solutions/fixed.mjs`, `results-faults-*.jsonl` | Chứa đáp án bảng naive / lời giải | **Không mở** ở block này |

Lưu ý tên file: trong comment của `gen-eventloop.mjs` ghi `qNN.cjs`, nhưng file thật tên `gNN.cjs` / `gNN.mjs`.

---

## 2. Quy ước `journal.csv`

Cột (đã có sẵn dòng tiêu đề):

```
ngay,gio_hoc,block,ma_cau,khai_niem,du_doan,tu_tin_1_5,ket_qua_runtime,dung_sai,vi_sao_co_che,nguon_da_kiem
```

- `gio_hoc` = `0`, `block` = `0` cho mọi dòng của block này.
- `ma_cau`: `s101-g01` … `s101-g12`, `s201-g01` … `s201-g12`, `p01` … `p30`, `F1` … `F12`, `T1` … `T7`.
- `du_doan` và `tu_tin_1_5` (1–5): ghi **trước** khi chạy. Để trống các cột còn lại tới bước chấm.
- Sau khi chấm: `ket_qua_runtime`, `dung_sai` (đúng chữ `dung` hoặc `sai`, `journal-stats.mjs` đọc đúng hai giá trị này), `vi_sao_co_che`, `nguon_da_kiem`.
- `vi_sao_co_che` phải nêu tên hàng đợi, phase hoặc hàm trong mã nguồn. "Vì async" không tính. Ở giờ 0 bạn chưa đọc mã nguồn nên cột này và `nguon_da_kiem` có thể để trống; điền lại sau ở Block 1.
- Chuỗi có dấu phẩy phải bọc trong dấu `"` (script parse có hỗ trợ).

Ví dụ (một dòng trước khi chấm, một dòng sau):

```csv
2026-10-27,0,0,s101-g01,microtask,AEFBDC,4,,,,
2026-10-27,0,0,p01,unhandled rejection,"stdout=(trống) exit=1",5,"stdout=(trống) exit=1",dung,,
```

---

## 3. Trình tự 90 phút

### 3.1 · 30 phút · 24 câu thứ tự thực thi (N1)

Đọc `quiz/out/seed101/questions.md` rồi `quiz/out/seed201-esm/questions.md`. Mỗi câu hỏi: chuỗi chữ cái in ra ở `exit`.
Ghi 24 dòng vào `journal.csv` (dự đoán + tự tin 1–5). Không chạy gì.

**Chấm** (sau khi ghi xong cả 24):

```sh
for f in quiz/out/seed101/g*.cjs;      do echo "$(basename $f .cjs)  $(node $f)"; done
for f in quiz/out/seed201-esm/g*.mjs;  do echo "$(basename $f .mjs)  $(node $f)"; done
```

Điền `ket_qua_runtime` và `dung_sai`. Nếu muốn đối chiếu với khóa: `quiz/out/seed101/key.json`, `quiz/out/seed201-esm/key.json` (khóa sinh trên v24.22.1).

### 3.2 · 25 phút · 30 câu production, chỉ dự đoán (N2–N7)

Đọc `quiz/prod/p01.mjs … p30.mjs`, ghi dự đoán + tự tin. **Không chạy**: các file này tự `spawnSync` ra tiến trình con và in kết quả.

**Chấm bằng khóa v24** (theo PLAN, không chấm bằng chạy máy bạn):

```sh
node -e 'const k=require("./quiz/key-v24.json").answers; for (const [q,v] of Object.entries(k)) console.log(q, v.outputs.join(" || "))'
```

Vì sao dùng khóa chứ không chạy: máy bạn là Node 24.10.0, còn khóa sinh trên 24.22.1. Có câu phụ thuộc bản vá (ví dụ p21,
`Buffer.poolSize` tăng ở 24.18.0), và p13, p14, p19, p20 phụ thuộc tín hiệu/tiến trình.
Muốn kiểm trên máy bạn sau khi có `bin/node24`:
`bin/node24 quiz/run.mjs --check-key quiz/key-v24.json` (~1 phút, in câu nào lệch khóa).

### 3.3 · 10 phút · Bảng naive 12 ô (F1–F12)

Tạo file nháp, ví dụ `baseline-naive.md`: 12 dòng, mỗi dòng một câu "service naive sẽ ra sao khi gặp lỗi này".
Tên 12 lỗi lấy từ cột "Lỗi" của bảng mục 4 trong `PLAN.md` (chỉ chép **cột đầu**, che các cột kết quả). Mô tả F1–F12 cũng có trong `faults/run.mjs`.
Mỗi dòng ghi: hiện tượng dự đoán, con số ước lượng nếu có (số lỗi, p99, exit code), tự tin 1–5.
Chép 12 dòng vào `journal.csv` với `ma_cau` = `F1` … `F12`. Chấm ở Block 2 trở đi khi chạy `faults/run.mjs naive`; chưa chạy bây giờ.

### 3.4 · 5 phút · Bảng 7 timeout, không tra

Điền 7 giá trị mặc định (mili giây) cho Node 24, từ trí nhớ:

| # | Giá trị | Dự đoán của bạn |
|---|---|---|
| T1 | server `headersTimeout` | |
| T2 | server `requestTimeout` | |
| T3 | server `keepAliveTimeout` | |
| T4 | server `keepAliveTimeoutBuffer` | |
| T5 | fetch `headersTimeout` | |
| T6 | fetch `bodyTimeout` | |
| T7 | số kết nối mỗi origin của fetch | |

Ghi vào `journal.csv` (`ma_cau` = `T1` … `T7`). Đáp án nằm ở `PLAN.md` mục 2; chấm xong mới mở.
Chạy thử để kiểm bằng runtime: `node tools/defaults.mjs --pretty` (không có cgroup trên macOS, nên bỏ dòng `heap_size_limit` trong cgroup).

### 3.5 · 25 phút · Phần A đề công khai (mục 7.1)

Cần **người coi thi**, bạn không tự làm được vì bạn không được biết seed.

Người coi thi chạy (~1 phút, mỗi câu chạy 100 lần để loại câu race):

```sh
node quiz/gen-eventloop.mjs --seed <số bạn chưa biết, khác 101/102/103/201> --count 12 --out <thư mục bạn không thấy>
```

Họ giữ `key.json`, đưa bạn đúng `questions.md`. Bạn làm 25 phút, không chạy code, không tra cứu, đáp án là chuỗi 6–10 chữ cái cho từng câu.
Ghi kết quả vào `journal.csv` như các câu khác (`ma_cau` = `pa-g01` …). Chấm theo `key.json` của họ.
Phần B (8 câu biến thể production) do `quiz/public/PROCTOR-partB.md` mô tả; phần đó là việc của người coi thi, chưa cần làm ở block này.

Nếu chưa có người coi thi: dùng tạm một seed bạn chưa dùng và nhờ người khác sinh. Đừng tự sinh rồi tự làm: bạn sẽ thấy `key.json` nằm cạnh.

---

## 4. Kiểm cuối block

```sh
node tools/journal-stats.mjs
```

In tỉ lệ đúng theo block và theo mức tự tin. Mức 5 mà sai được liệt kê trong dòng `TỰ TIN 5 MÀ SAI:`, đó là lỗ hổng nguy hiểm nhất. Chụp kết quả lại, giờ 20 so với số này.

**Đầu ra của Block 0:** `journal.csv` có các dòng `gio_hoc=0` cho 24 câu event loop, 30 câu production, F1–F12, T1–T7 và phần A.

---

## Lưu ý

1. **Baseline đã nhiễm.** `PLAN.md` mục 2, 4, 5, 6 chứa đáp án (giá trị mặc định, bảng kết quả naive, các khóa p02, p03, p21–p23 …). Nếu bạn đã đọc, hãy ghi vào đầu `journal.csv` hoặc `baseline-naive.md`
   câu "đã đọc PLAN.md mục … trước khi đo", và coi các ô liên quan là baseline bị thổi phồng. Cách sạch nhất là phần A với seed người khác chọn.
2. **Thời gian.** Các bước cộng lại 95 phút (30 + 25 + 10 + 5 + 25), block 90 phút. Chấm bài nằm ngoài 90 phút hoặc cắt bớt ở 3.2.
3. **Node local lệch bản.** Máy bạn v24.10.0, khóa v24.22.1. Chấm thứ tự thực thi (3.1) bằng chạy máy bạn thường ổn (kiểm chéo v24/v26 của PLAN: 48/48 khớp), nhưng câu production chấm bằng khóa.
4. **`steps/` chưa commit** (`git status` hiện `?? steps/`).
