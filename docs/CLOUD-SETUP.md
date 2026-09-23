# Cloud Session Setup - So Chu Nhiem So

Muc tieu: cloud Devin session (qua `/handoff` hoac app.devin.ai) tai lap duoc
moi truong lam viec nhu tren local.

## 1. Secrets can thiet (org secrets manager)

Cac key can co trong Devin Cloud secrets (Settings -> Secrets tren
app.devin.ai, hoac `devin cloud drs secret-create`):

| Secret name | Dung cho |
|---|---|
| SCN_NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| SCN_NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon |
| SCN_SUPABASE_SERVICE_ROLE_KEY | Server actions / QA scripts |
| SCN_SUPABASE_PUBLISHABLE_KEY | Publishable key |
| SCN_GEMINI_API_KEY | AI provider (gemini) |
| SCN_DEVIN_API_KEY | AI fallback -> Devin session |
| SCN_DEVIN_CALLBACK_URL | callback host cho ai_jobs |
| RESEND_API_KEY | email PH (optional - thieu van chay, chi khong gui mail) |
| GITHUB_TOKEN | push repo neu can |

TVC360 project (neu lam repo kia): prefix `TVC_` cung bo key Supabase + GEMINI.

### Tao .env.local trong cloud session

```bash
cd ~/workspaces/so-chu-nhiem-so   # hoac path repo trong cloud VM
cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SCN_NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SCN_NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SCN_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PUBLISHABLE_KEY=$SCN_SUPABASE_PUBLISHABLE_KEY
GEMINI_API_KEY=$SCN_GEMINI_API_KEY
DEVIN_API_KEY=$SCN_DEVIN_API_KEY
DEVIN_CALLBACK_URL=$SCN_DEVIN_CALLBACK_URL
RESEND_API_KEY=$RESEND_API_KEY
EOF
```

(Cloud session inject org secrets thanh env vars cung ten - doc them tai
app.devin.ai Settings -> Secrets.)

## 2. Setup trong cloud VM

`environment.yaml` o repo root da co san - DRS build tu chay `npm ci` +
playwright. Thu cong neu can:

```bash
npm ci
npx playwright install chromium
npm run check   # lint + typecheck + build
```

## 3. MCP servers (local-only - khong co tren cloud)

MCP config local (`~/.config/devin/mcp_config.json`) gom: supabase,
supabase-aal, playwright, playwright-notebooklm, notebooklm, deepwiki,
vercel, render, resend. Cloud session khong mang theo - dung thay:

- Supabase: SQL truc tiep qua connection string / psql, hoac MCP config lai
- Playwright: `npx playwright` trong VM
- Vercel/Render/Resend: REST API + token tu secrets

## 4. Handoff tung session

```
devin -r <session-id>
/handoff
```

| Session | ID |
|---|---|
| Presale_SoChuNhiem | likeable-distance |
| Presale_DeAnMoi | relic-hearing |
| AAL_fasttrack | amplified-reward |
| Apply model in image to SDLC | melodious-echidna |

## 5. Khac biet can nho tren cloud

- `localhost` previews khong truy cap duoc tu browser local - dung deployed
  URL hoac cloud preview port-forward cua Devin
- Deploy verify qua production URL, khong can local dev server
- DB migrations apply qua MCP local; tren cloud dung Supabase SQL editor hoac
  psql voi SUPABASE_DB_PASS secret
