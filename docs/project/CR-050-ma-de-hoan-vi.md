# CR-050: Sinh mã đề hoán vị (shuffle=yes sinh thật 2 mã đề)

- **Status**: APPROVED (PO: "làm lần lượt theo SDLC")
- **Nguồn**: gap audit vs chuẩn Bộ - field `shuffle` trong DC-03 hứa "2 mã đề (hoán vị câu hỏi)" nhưng code chỉ ghi `config.shuffle`, không sinh đề thứ 2. Phòng thi cần nhiều mã đề từ 1 ma trận.

## Scope

1. `shuffle=yes` sinh **mã đề B**: cùng tập câu hỏi của đề chính thức, hoán vị **thứ tự câu trong từng phần** (giữ cấu trúc phần TT22/CV7991: PHẦN I-IV / I-II) + `shuffleMc` đã hoán vị phương án A-D sẵn.
2. Mã đề B là exam thật trong `scn_save_exam_pack` (cùng transaction, `config.code="B"`), title suffix `- MÃ ĐỀ 2`.
3. Response trả `docB` + tab "Mã đề 2" trong tool-runner; bảng đáp án của mã đề B map theo thứ tự mới.
4. Câu có `context` (đoạn đọc) giữ cụm: shuffle đổi vị trí cụm, không tách câu khỏi context.
5. Đề dự phòng giữ nguyên là tập câu khác - KHÔNG phải mã đề.

## Impact assessment

- **Code**: `generate/route.ts` (buildPicked/buildExamDoc reuse), `tool-runner.tsx` (tab mới), `scn_save_exam_pack` RPC (đã nhận array p_exams - chỉ thêm phần tử).
- **DB**: không migration - `tvc_exams.config` đã là jsonb.
- **RBAC**: không đổi - cùng route DC-03.
- **Rủi ro**: chấm thi online theo position - mã đề B phải là exam riêng (đúng, thêm exam trong pack) không được ghi đè position đề A.
- **Không ảnh hưởng**: pack=simple, shuffle=no giữ nguyên hành vi.

## Estimate

Dev ~2-3h (reuse toàn bộ pipeline chọn câu, chỉ hoán vị thứ tự + lưu thêm 1 exam) + test.

## AC

- AC-50.1: `shuffle=yes` trả `docB` với cùng tập question_id nhưng thứ tự khác, đáp án map đúng vị trí mới.
- AC-50.2: DB lưu 2 exams cùng matrix (A + B) trong 1 transaction; mã B có `config.code="B"`.
- AC-50.3: câu `context` không bị tách cụm khi shuffle.
- AC-50.4: `shuffle=no` không đổi hành vi (regression).
- AC-50.5: bảng đáp án mã B in đúng đáp án câu ở vị trí mới (verify bằng test so khớp stem→đáp án).
