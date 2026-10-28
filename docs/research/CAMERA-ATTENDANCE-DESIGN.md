# Thiet ke diem danh bang camera (design-only)

CR backlog - tai lieu thiet ke truoc khi trien khai. Phan cung (camera RTSP,
edge device, model nhan dien) nam ngoai pham vi code; tich hop thuc can khach
hang chot vendor -> BACKLOG-CREDENTIALS.

## 1. Muc tieu nghiep vu

- Diem danh vao/ra cong truong + (tuy chon) vao lop tiet 1 - ghi nhan tu dong,
  giam cong GVCN/bao ve nhap tay.
- Canh bao: HS ra cong gio hoc (khong co phieu ra ngoai), nguoi la vao truong,
  PH den don tre em (check-out matching).
- Du lieu dau ra phai roi vao `attendance_records` hien co (source='camera') -
  khong tao he diem danh song song.

## 2. Rang buoc phap ly (DPIA)

Viet Nam: ND 13/2023 bao ve du lieu ca nhan; khuon mat = du lieu sinh trac hoc =
du lieu nhay cam; chu the la **tre em vi thanh nien** -> nguong bao ve cao nhat.

| Nguyen tac | Thiet ke |
|---|---|
| Muc dich | Chi diem danh + an ninh cong; KHONG cham diem hanh vi, cam xuc, theo doi ca nhan ngoai pham vi |
| Toi thieu hoa | Template khuon mat (embedding so), KHONG luu anh goc qua 24-72h (chu ky audit) |
| Dong y | Van ban dong y PH cho HS (opt-in), co the rut lai -> fallback diem danh thu cong |
| Phan quyen du lieu | Template + anh event chi can bo an ninh/BGH; GVCN chi thay ket qua diem danh (da co san trong attendance) |
| Luu tru | Tai cho (edge/on-prem) uu tien; neu cloud thi VN region, ma hoa at-rest |
| Xoa | Template xoa khi HS chuyen di/tot nghiep (noi vao workflow bien_dong_hs: them buoc purge) |
| Danh gia rui ro | Danh sach kiem tra DPIA day du phai ky boi hieu truong truoc khi bat camera |

Hau qua: **opt-in + on-prem edge + template-only** la kien truc toi thieu duoc
phep. Khong co phuong an "anh luu cloud lau dai".

## 3. Kien truc de xuat

```
[IP Camera cong] --RTSP--> [Edge box tai truong]
                              | detect+embed (model local)
                              | match template DB (edge copy)
                              v
                      event {student_id, gate, ts, conf}
                              | HTTPS (API key per gate)
                              v
                    POST /api/attendance/camera-event
                              | dedup + gio hop le
                              v
                    attendance_records (source='camera')
```

- Edge = pattern STRANGLE da chon: truong van chay duoc khi mat mang;
  sync lai su kien khi co mang (outbox phia edge - trong tu int_outbox).
- He thong khong nhan RTSP truc tiep - cloud chi nhan event da xu ly.

## 4. Schema can them (khi implement - chua tao)

- `cam_gates`: id, school_id, name, direction (vao/ra), api_key_hash, active.
- `face_templates`: student_id, embedding (vector), enrolled_at, consent_doc_id,
  expires (theo nam hoc) - chi tao khi co dong y.
- `cam_events`: id, school_id, gate_id, student_id, ts, confidence, snapshot_url
  (TTL 72h, xoa dinh ky), processed->attendance_record_id.
- consent: `consents` (parent_id, student_id, type='face_attendance', status,
  signed_at, revoked_at).

## 5. Luong du lieu

1. Dang ky: PH ky dong y (portal) -> truong chup/enroll 1 lan -> template vao
   `face_templates`; PH huy dong y bat cu luc nao -> xoa template + fallback thu cong.
2. Hang ngay: event -> dedup (1 HS/1 gate/15 phut) -> map vao `attendance_records`
   theo lich hoc (vao truong => co mat; ra cong giua gio => co diem ra + canh bao neu
   khong co phieu).
3. Ngoai le: conf < nguong (vd 0.75) => khong ghi, log manual-review queue cho bao ve.
4. Bao mat API: key per-gate (hash), rate-limit, chi nhan event - khong cho pull data.

## 6. Tich hop module hien co

- `attendance_records`: them gia tri `source='camera'` (check constraint mo rong khi implement).
- `chuyen_can` module flag: camera la TUY CHON ben trong chuyen_can, flag con `cam_attendance`.
- `bien_dong_hs`: HS chuyen di -> hook xoa face_templates + consent.
- Dashboard `Việc chờ phê duyệt`: event conf thap + ra cong trai phep -> hang cho xu ly.
- Notifications: PH nhan email khi HS vao/ra (tuy chon theo consent; van email-only).

## 7. Quyet dinh da chot (PO)

| Van de | Quyet dinh |
|---|---|
| Vendor camera/model | De mo - edge device chay ONNX local, khong rang buoc vendor cloud |
| Luu anh | Chi snapshot event 72h (audit), khong luu video |
| Opt-in/opt-out | Opt-in, fallback thu cong day du - khong truong nao bi bat |
| Trien khai | Can khach hang thuc + dieu kien phap ly dia phuong -> BACKLOG |

## 8. Checklist truoc khi go code (khi un-backlog)

1. DPIA form co chu ky hieu truong + van ban dong y PH mau.
2. Chon edge stack (ONNX runtime + model licensed for VN faces).
3. Migration schema muc 4 + RPC `cam_ingest_event` (gate-key auth, dedup).
4. UI: portal PH consent + trang enroll (gvcn/bgh) + review queue (bao ve).
5. Test: dedup, conf threshold, consent revoke purge, mat-mang replay.
