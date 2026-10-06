# CR-031 - Cau hoi co hinh (figure spec SVG + upload anh)

## Bai toan

Cau hoi can hinh: hinh hoc Toan (tam giac, goc, dong ho), anh minh hoa
Tieng Viet / Tieng Anh. KHONG dung AI sinh anh raster cho hinh hoc
(sai goc/ty le, khong hop de thi) - dung figure spec tham so hoa
render SVG deterministic.

## Scope (a + b)

- `tvc.questions.media` + `tvc.materials.media` jsonb:
  `[{kind:"figure", spec} | {kind:"image", path, alt}]`
- `src/lib/tvc/figures.ts`: 6 template SVG cho Toan TH - triangle
  (nhan dinh + canh + goc), rectangle, circle (ban kinh), segment
  (doan thang do do dai), angle, clock (gio phut) - nen trang,
  duong den, in A4 dep.
- Storage bucket `tvc-media` (public read), ghi/xoa theo
  `{school_id}/` + staff role.
- Question form: "Tai anh len" + "+ Hinh ve (SVG tham so)" voi 6
  preset; preview + xoa tung media; edit preload media.
- DocBlock `image` {svg?|path?|caption}: render inline trong
  doc-render, nhung PNG vao DOCX (`ImageRun`, sharp rasterize SVG /
  fetch+resize anh toi 480px), vao PPTX (`addImage` base64).
- DC-03 buildExamDoc chen image block ngay sau cau co media.
- Validate: media shape, toi da 4; stem tham chieu hinh phai co
  media hoac context; `referencesMissingContext` tach phan hinh
  sang IMG_REF_RE (khong con bat cau hinh phai co text context).
- importQuestions ghi media + school_id (da thieu school_id cho
  import path - fix luon).

## Verify

- sharp SVG->PNG: 1650 bytes, thanh cong local.
- validate: stem "như hình" + khong media -> error; co media -> pass;
  media kind sai -> error.
- typecheck xanh; lint/build trong gate chung CR-032.

## Con lai (CR tiep theo)

- Editor tham so hinh chi tiet (doi label/goc tung hinh) - hien
  figure co spec mac dinh, chinh JSON sau.
- Media bank theo YCCD (anh curated reusable).
- Prompt harness: LLM tra media.spec cho cau hinh hoc.
