# CR-022: Chan gui email toi dia chi demo @demo.scn

**Date:** 2026-10-05
**Status:** Implemented
**Driver:** Cron `parent-digest` chay sang thu 2 ban ~364 email toi
`hsXXXXXX.ph@demo.scn` - dia chi seed khong ton tai. Moi email failed,
dot sach daily quota Resend free (100/ngay, dung chung 3 san pham)
va tao bounce storm pha sender reputation cua ca domain `aal.vn`.
Du lieu DB: 369 parents co email, 364 la demo, chi 1 dia chi that.

## Root cause

- `parent-digest` + `sendAnnouncement` query moi parent co email,
  ke ca dia chi demo.
- Resend tra 200 khi accept (bounce xay ra async sau) nen delivery log
  ghi `sent` cho dia chi khong ton tai - che khuat van de.

## What changed

1. **`src/lib/email.ts`**: `sendEmail` loc `@demo.scn` o tang trung tam -
   moi caller (digest, announcement, tuong lai) deu duoc bao ve. Neu moi
   recipient bi loc -> `{sent:0, skipped:true}`.
2. **`/api/cron/parent-digest`**: query parents loai tru `%@demo.scn` -
   khong con queue/ghi delivery cho dia chi demo.
3. **`/parents/actions.ts` (`sendAnnouncement`)**: cung filter o query.

## Impact assessment

- Chi loc recipient - khong cham schema, khong doi API shape.
- Sau fix, volume that: ~1 email/tuan (1 parent that) -> khong anh
  huong quota dang ke.
- Parent demo van nhan notification trong app binh thuong.
- `digest_deliveries` cu (365 rows, phan lon demo) giu nguyen lam
  lich su; khong cleanup trong CR nay.

## Estimate

~1 gio.

## Verification

- DB check: 364/369 email la @demo.scn -> sau filter chi 1 recipient
  that duoc xu ly.
- Typecheck/lint/build.
- Tuan sau cron chi tao ~1 delivery row thay vi 364.

## Follow-ups

- Khi onboard truong that: PH email that van gui binh thuong (chi
  chan dung mien @demo.scn).
- Nen tach RESEND_API_KEY rieng cho SCN neu volume tang - hien tai
  chia key voi AAL Fast Track + English Arena (da tach sang Brevo).

## Addendum (05/10/2026) - Brevo provider support

User quyet: tat ca san pham VieSchool dung chung Brevo key (300/ngay,
tach khoi Resend chung voi AAL). `sendEmail` gio doc provider tu env:
- `EMAIL_PROVIDER=brevo|resend` (default: brevo neu co BREVO_API_KEY)
- `BREVO_API_KEY` primary, `RESEND_API_KEY` fallback
- `EMAIL_FROM` van dung - brevo parse 'Name <addr>' thanh sender{name,email}
- Typecheck + consistency xanh. Vercel env can set tay (token het han).

## Addendum 2 (05/10/2026) - vault config, khong can Vercel env

`sendEmail` gio doc email config theo thu tu: env vars (dev) ->
`public.get_email_config()` RPC doc vault secrets (email_provider /
email_api_key / email_from). Config tap trung mot noi cho moi san pham
VieSchool tren cung project - rotate provider chi sua vault.
Domain vieschool.com da verify trong Brevo (DNS records them qua
Cloudflare dashboard). Sender: VieSchool <no-reply@vieschool.com>.
