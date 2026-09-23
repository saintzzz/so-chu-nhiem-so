-- Keep-warm: ping cac route dynamic cua Vercel app moi 10 phut
-- de giam cold start serverless (TTFB ~1-1.4s sau idle).
-- pg_cron + pg_net da duoc enable tren project.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'vercel-keep-warm',
  '*/10 * * * *',
  $$
  select net.http_get('https://so-chu-nhiem-so-theta.vercel.app/login');
  select net.http_get('https://so-chu-nhiem-so-theta.vercel.app/dashboard');
  select net.http_get('https://so-chu-nhiem-so-theta.vercel.app/school/dashboard');
  select net.http_get('https://so-chu-nhiem-so-theta.vercel.app/portal/parent');
  $$
);
