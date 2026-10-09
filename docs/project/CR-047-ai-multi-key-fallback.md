# CR-047 — Co che fallback da API key cho moi tinh nang AI

## Context

Du an phu thuoc LLM (Studio tools, KHBD, trich xuat...) qua
`src/lib/ai.ts`. Truoc day moi provider chi doc 1 key
(`GEMINI_API_KEY`) voi 1 model co dinh. Thuc te probe 4 key Gemini
nguoi dung cap cho thay:

- Key `AIza...` (key tra phi chuan) tra HTTP 402 - het prepay credit.
- 3 key `AQ.Ab8RN6...` (OAuth-style) hoat dong nhung chi chay duoc
  `gemini-flash-latest`; `gemini-2.5-flash` tra 404 tren mot so key.
- Moi key co tap model kha dung khac nhau.

=> Mot key chet/han muc/model-incompatible lam toan bo tinh nang AI
"stuck". Requirement: khong bao gio bi stuck - fallback da tang.

## Scope

### `src/lib/ai.ts`
- `expandKeys(provider)` (export): gom key tu 1 provider:
  - `<PROVIDER>_API_KEY` chap nhan comma-separated ("k1,k2,k3").
  - `<PROVIDER>_API_KEY_2` .. `_9` - slot phu.
  - Dedup bang Set. Ap dung cho ca 3 provider (gemini/openai/anthropic).
- `getAiConfigs()`: moi key = 1 config doc lap. Voi gemini, mo rong
  theo cap (model x key): thu model uu tien qua tat ca key truoc, roi
  moi xuong model du phong.
  - Chuoi model mac dinh: `GEMINI_MODEL`/`AI_MODEL` neu co ->
    `gemini-flash-latest` -> `gemini-2.5-flash` -> `gemini-2.5-flash-lite`.
  - `GEMINI_MODELS` (comma-separated) ghi de toan bo chuoi.
  - `AI_PROVIDER` (ep 1 provider) va `AI_ALLOWED_PROVIDERS` (DPIA
    allowlist) giu nguyen semantics.
- `generateTextDetailed()` khong doi: loop da `continue` tren ca
  `error` (404 model, 4xx khac) lan `quota` (429/402 quota body,
  503/529/overloaded/timeout) => tu dong di qua moi cap key/model roi
  sang provider tiep theo, cuoi cung Devin async + rule-based.

### `src/lib/tvc/tts.ts`
- `ttsSegment` nhan danh sach key tu `expandKeys("openai")`, thu tung
  key khi HTTP loi/timeout. Het key -> null -> route bo qua audio,
  khong chan generate (giu nguyen hanh vi cu).

## Non-scope
- Khong them provider TTS moi (Gemini TTS la Live API khac shape REST).
- Khong rotate key da paste trong chat (khuyen nghi rieng).
- `tvc360-congcuso` va `student-self-practice-web` khong thuoc scope.

## Impact assessment
- Chi cham `src/lib/ai.ts` + `src/lib/tvc/tts.ts`; khong doi signature
  public (`getAiConfig` van tra config dau tien).
- Config cu 1 key -> chuoi 1 phan tu, hanh vi y het.
- Moi tinh nang AI dung `generateText`/`generateTextDetailed` tu dong
  huong fallback - khong can sua call site.
- Env moi (tuy chon): `GEMINI_API_KEY_2..9`, `OPENAI_API_KEY_2..9`,
  `ANTHROPIC_API_KEY_2..9`, `GEMINI_MODELS`.
- Secret chi qua env/Vercel env vars - khong commit.

## Test
- Runtime probe: 4 key that -> chuoi 14 config; `generateTextDetailed`
  tra text qua gemini (key dau 402 -> nhay key/model tiep).
- Fallback tu dong theo thu tu: gemini (model x key) -> openai ->
  anthropic -> Devin -> rule-based.
