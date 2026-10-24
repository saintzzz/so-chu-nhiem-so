# CR-056 - Tach TTS khoi generate: audio endpoint rieng

## What / Why

Hien tai TTS chay dong bo BEN TRONG `/api/studio/tools/[code]/generate`
sau AI generation. Generate da an 100-130s cua route budget ~150s, nen
TTS chi con vai chuc giay -> hay bi skip ("sao lai skip audio?") hoac
tra doc khong audio.

Thay doi: sau khi generate tra doc, client goi them
`POST /api/studio/tools/[code]/audio` voi doc content. Endpoint nay co
budget 150s RIENG chi cho TTS -> audio gan nhu luon thanh cong.
Generate van tra doc ngay (khong block), audio dien vao doc phia client
truoc khi luu. Neu audio fail -> doc van dung duoc (fail-soft giu nguyen).

## Acceptance criteria

- AC-56.1: `POST /api/studio/tools/[code]/audio` nhan doc content +
  tool code, tra audio blocks da upload tvc-media (hoac rong khi fail).
- AC-56.2: Route TTS rieng tuan thu cung allowlist/RBAC/budget nhu
  generate (requireRoles, aiProviderAllowed, aiEndpointAllowed,
  quotaOk).
- AC-56.3: tool-runner generate xong goi audio endpoint va merge audio
  blocks vao doc hien thi (loading state "Dang tao am thanh...").
- AC-56.4: Generate route khong con goi TTS noi bo - doc ve ngay.
- AC-56.5: Audio fail/timeout -> UI van show doc + thong bao "khong
  tao duoc am thanh", khong mat noi dung.
- AC-56.6: A-03 dialogue (2 giong) va narration A-01/A-02/V-02 deu di
  qua endpoint moi.

## Impact

- Route: 1 API route moi + generate route loai khoi TTS.
- UI: tool-runner them buoc audio sau generate.
- Risk: trung binh - la luong chinh cua studio audio, can test lai
  4 tool tren production.

## Fix bo sung trong luc verify (edge-tts v2 + gemini provider)

Sau khi tach endpoint, edge-tts chet hoan toan: `msedge-tts@2.1.0`
gui Sec-MS-GEC v1, MS tu 10/2026 chi chap nhan v2 -> WS handshake
tra 200 thay vi 101 (xem rany2/edge-tts#490). Da doi sang fork
`@andresaya/edge-tts@1.9.1` (port thuat toan GEC v2 tu PR #492) -
local chay duoc nhung tren Vercel van fail: MS chan WS upgrade tu
IP datacenter, chi IP residential di qua duoc. Runtime logs xac
nhan `Unexpected server response: 200` tren deployment moi.

Do vay them provider thu 3 **Gemini TTS** (`gemini-2.5-flash-preview-tts`,
generateContent + responseModalities AUDIO -> PCM 24kHz -> WAV) -
production co san 7 GEMINI keys. Chain bay gio: openai -> edge ->
gemini, chay o function level de file output dong nhat format.
`uploadTtsAudio` detect RIFF magic -> `.wav`/`audio/wav`; pptx mime
theo extension.

Verify production (sochunhiem.vieschool.com, deploy 267eae3):
- A-02 audio endpoint -> wav 202KB public; export pptx 361KB chua
  `ppt/media/media-2-1.wav` + rels audio dung OOXML.
- A-03 dialogue 4 luot -> wav 476KB (Kore + Charon 2 giong).
- V-02 tieng Viet -> wav (giong Gemini tu nhan dien ngon ngu).
- edge-tts giu lai cho local/self-host (IP residential van chay duoc).
