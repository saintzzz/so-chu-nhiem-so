# External Review r30 - VERDICT: REJECT -> 3 fixed, 1 not-confirmed (commit e427982)

Pham vi: diff `682a816..6fefbd1` - CR-050 shuffle ma de, CR-051 bo ho so
7 van ban, CR-052 PPT tuong tac + TTS, fix DC-03/T-02 GVBM mon ngoai TVC,
fix lint react-hooks-7 tren 10 site.

Kenh review: pinned `reviewer-gpt` (fallback theo runbook) - Codex Cloud
dispatch treo o trang root ~95 phut, poller khong lay duoc report.

## Triage

| # | Sev | Class | Finding | Trang thai |
|---|-----|-------|---------|------------|
| 1 | H | spec-impl-drift | `interactiveSeq` thieu `evt="onClick"` tren cond | NOT-CONFIRMED - cau truc `cond delay="indefinite"` + `spTgt` trong `interactiveSeq` giong het golden XML slideforge `worker/build.mjs` L616 da verify playback that tren PowerPoint; interactiveSeq la trigger click mac dinh, `evt` khong bat buoc |
| 2 | H | privacy-leak | DC-06 TTS narration doc tu `doc` DA deanonymize -> ten that HS lot len TTS provider | FIXED - doc tu `aiDocRaw` (con alias HSxxx) nhu path A-03 `extractDialogueTurns` |
| 3 | H | state-race | `save` khong chan khi `pending`, `generate` khong chan khi `saving`, pack state reset som -> regen loi van save trung pack id moi | FIXED - `generate` no-op khi `saving`, `save` no-op khi `pending|saving`, nut Save `disabled={saving||pending}`, `resetPackState` chi goi khi chap nhan ket qua moi (sync + async onDone) |
| 4 | M | parse-overmatch | `trả lời` trong ANSWER_INLINE an van thuong "HS trả lời:..."; `NOTE_TAIL_CUT` cat dap an hop le bat dau "Đáp án: Thời gian:..." | FIXED - bo `trả lời` khoi inline (giu line-start); tail-cut chi ap dung khi marker xuat hien sau >12 ky tu dap an |

## Fix chi tiet

- `route.ts` DC-06: `ttsDoc = aiDocRaw ?? doc`, narration `text` lay tu
  section tuong ung cua ban alias; audio block van ghi vao `doc` (deanon)
  de user xem duoc transcript that.
- `tool-runner.tsx`: guard `if (saving) return` o generate, `if (!doc ||
  saving || pending) return` o save; `resetPackState()` (savedId /
  savedCount / firstSavedId / packExamId) chi chay trong 2 nhanh success
  - regen fail giu nguyen trang thai cu de retry, khong tao pack trung.
- `pptx.ts`: `ANSWER_INLINE` mat `trả\s*lời`; `NOTE_TAIL_CUT` qua index
  check `cut > 12` thay vi cat vo dieu kien.
- `package-lock.json`: lock pin `next@16.4.0` trong khi range `^16.4.0` +
  node_modules 16.4.2 -> GHSA-2464-fhr4-w9xw (RCE SVG imgopt) +
  GHSA-p3m5-59mp-jv5r (DoS server actions). Nang lock len `^16.4.2`,
  audit `--omit=dev --audit-level=high` = 0.

## Regression them

- Fixture am: "Học sinh trả lời: ..." van hien tren slide (khong bi an),
  "Đáp án: Thời gian: 8 giờ; quãng đường: 12 km" giu nguyen trong reveal.
- Assert guard: generate/save mutual exclusion + resetPackState vi tri
  dung + ttsDoc doc tu aiDocRaw.

## Gates

- reliability 4/4 PASS, regression 172/172 PASS, tsc clean, lint 0 errors,
  build PASS, audit 0, preflight chain PASS.
- Deploy `e427982` da push -> Vercel; verify prod interactive PPT giu
  nguyen reveal (note-extract + tail-cut khong pha output da xac nhan).

## Loop

r30 la round 1 sau lo CR-050/051/052 + deploy `6fefbd1`. Round tiep theo
(r31) chay tren artifact `..e427982` sau khi redeploy + prod re-verify.
