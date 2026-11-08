#!/usr/bin/env node
// Sinh ANON_KEY + SERVICE_ROLE_KEY (JWT HS256) cho stack self-host.
// Cach dung: node scripts/gen-keys.mjs <JWT_SECRET>
// JWT_SECRET do minh dat trong .env - khong dung lai secret cua Supabase cloud.
import crypto from "node:crypto";

const secret = process.argv[2];
if (!secret || secret.length < 32) {
  console.error("Can JWT_SECRET toi thieu 32 ky tu: node gen-keys.mjs <secret>");
  process.exit(1);
}

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const sign = (payload) => {
  const header = b64u({ alg: "HS256", typ: "JWT" });
  const body = b64u({
    ...payload,
    iss: "supabase",
    ref: "vieschool-vn",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600,
  });
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
};

console.log("ANON_KEY=" + sign({ role: "anon" }));
console.log("SERVICE_ROLE_KEY=" + sign({ role: "service_role" }));
