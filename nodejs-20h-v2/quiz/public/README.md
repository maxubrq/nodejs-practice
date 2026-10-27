# Đề công khai: 25 phút, Node 24 LTS

Hai phần. Người học **không** tự dựng đề.

**Phần A — 12 câu thứ tự thực thi, sinh mới mỗi lần**
```
node quiz/gen-eventloop.mjs --seed <proctor chọn> --count 12 --out quiz/public/partA
```
Proctor chép `partA/questions.md` vào Form (câu trả lời ngắn, tiêu đề `G01 …`). Đáp án: `partA/key.json`.

**Phần B — 8 câu production** trong `partB/PROCTOR-ONLY.md`. Người học không mở thư mục `partB/`.

**Câu sàng lọc bắt buộc:** viết Node.js production ở công việc hiện tại (có/không), số năm, phiên bản Node,
giờ bắt đầu, giờ nộp. Loại bài trả lời "không" hoặc làm > 30 phút.

**Chấm**
```
node quiz/public/grade-responses.mjs responses.csv quiz/public/partA/key.json quiz/public/partB/key-partB.json --me <email>
```
In phân phối điểm, vị trí của bạn, p-value một phía cho "phân vị ≤ 95%" và cận dưới 95% của phân vị.
Muốn khẳng định top 5% khi hơn tất cả: cần ít nhất 59 người hợp lệ và không hòa điểm ở đỉnh.
