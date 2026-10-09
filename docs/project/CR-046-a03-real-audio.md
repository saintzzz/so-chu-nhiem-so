# CR-046 — A-03 audio TTS that cho hoi thoai luyen nghe

## Context

QA-REPORT-STUDIO-CR043 ghi nhan: A-03 "Sinh hoi thoai va bai luyen nghe" chi
co transcript text - phan mo ta tool hua "audio giong doc tu nhien" nhung
khong co file audio nao duoc tao. PO duyet tao audio that.

## Scope

### DocBlock `audio`
- `src/types/tvc.ts`: them `{ kind: "audio"; path; caption? }` vao DocBlock.
- `doc-render.tsx`: render `<audio controls preload="none">` tro toi public
  URL `tvc-media/<path>` + caption.
- `doc-editor.tsx`: hien read-only chip `[Audio: caption]` (media khong sua
  truc tiep trong editor - giong image).
- `docx.ts` / `pptx.ts` / `khbd-doc.ts` (plain text): audio -> caption line
  `[Audio] ...` vi dinh dang in/slide khong nhung duoc audio.

### Runtime TTS (env-gated)
- `src/lib/tvc/tts.ts`:
  - `extractDialogueTurns` - tach luot "Name: line" (uu tien section title
    dialogue/hoi thoai, loc prefix bai tap MC/Fill/TF...), toi da 12 luot.
  - `synthesizeDialogue` - OpenAI TTS `gpt-4o-mini-tts`, 2 giong xen ke
    (alloy/nova - override qua `TTS_VOICE_A/B`, `TTS_MODEL`), batch 4 song
    song, mp3 binary concat (frame stream hop le).
  - `uploadTtsAudio` - upload `tvc-media/<school_id>/a03/<uuid>.mp3`.
- Generate route: sau khi co doc A-03, neu `OPENAI_API_KEY` co -> TTS +
  chen audio block dau section hoi thoai. Loi TTS -> bo qua, khong chan
  generate (fallback giu transcript-only).

### Batch script
- `scripts/gen-a03-audio.mjs <material_id>`: gen audio bang `edge-tts`
  (Microsoft neural voices, mien phi, local) cho material da luu -> upload
  `tvc-media` + patch audio block vao `content`. Dung khi chua co
  OPENAI_API_KEY / muon gen lai audio cho material cu.

## Impact

- DocContent shape mo rong 1 kind - moi consumer doc da xu ly.
- Khong co OPENAI_API_KEY: generate A-03 van tra doc transcript nhu cu.
- Storage: ~150-250KB/hoi thoai trong bucket public `tvc-media`.
- TTS runtime them ~5-15s cho generate A-03 (chi khi co key) - van duoi
  maxDuration va chay sau khi doc da xong.

## Verification

- tsc + eslint: clean.
- Script e2e: material `edf876b3` (demo, draft) - 8 luot Lan/Tom, gen mp3
  162KB / 27s, upload `tvc-media/.../a03/c8574654-....mp3` public 200,
  ffprobe hop le.
- Exercise items (`MC:`, `Fill:`) bi regex bat nham vao luot thoai trong
  lan dau -> da loc bang NON_DIALOGUE prefix + uu tien section Dialogue.
