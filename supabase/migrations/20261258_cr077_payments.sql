-- CR-077: thanh toan online (VietQR + webhook doi soat) + khung e-invoice.

-- Cau hinh tich hop per truong (sepay token, tai khoan ngan hang,
-- zalo...). Chi service_role doc ghi - client khong duoc doc secret.
create table if not exists public.school_integrations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  provider text not null check (provider in ('sepay','bank','zalo_oa','sms','einvoice')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (school_id, provider)
);
alter table public.school_integrations enable row level security;
-- admin/bgh doc (KHONG doc secret tren client - chi doc flag enabled +
-- cac field non-secret, UI loc). Ghi: admin/bgh cung truong.
create policy si_select on public.school_integrations for select using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin','ke_toan']::text[]);
create policy si_write on public.school_integrations for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','admin']::text[]);
grant select, insert, update on public.school_integrations to authenticated;

-- Ma thanh toan per invoice - PH dien vao noi dung chuyen khoan.
alter table public.fee_invoices
  add column if not exists payment_code text;
create unique index if not exists fee_invoices_payment_code_key
  on public.fee_invoices (school_id, payment_code) where payment_code is not null;

-- Ham sinh payment_code: SCN + 8 ky tu base32 (khong nhap nham).
create or replace function public.gen_payment_code()
returns text language plpgsql as $$
declare c text;
begin
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  return 'SCN' || c;
end $$;

alter table public.fee_invoices
  alter column payment_code set default public.gen_payment_code();
update public.fee_invoices set payment_code = public.gen_payment_code()
  where payment_code is null;

-- Giao dich ngan hang tu webhook (SePay...). Raw + match ket qua.
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  provider text not null default 'sepay',
  external_id text not null,
  gateway text,
  txn_date timestamptz,
  account_number text,
  code text,
  content text,
  amount numeric not null check (amount > 0),
  reference_code text,
  invoice_id uuid references public.fee_invoices(id),
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched','matched','manual')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
alter table public.bank_transactions enable row level security;
create policy bt_select on public.bank_transactions for select using (
  (school_id = (select my_school_id())
    and (select my_roles()) && array['ke_toan','bgh','admin']::text[])
    or (select my_roles()) && array['admin','so_gd']::text[]);
create policy bt_write on public.bank_transactions for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['ke_toan','bgh','admin']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['ke_toan','bgh','admin']::text[]);
grant select, insert, update on public.bank_transactions to authenticated;

-- Skeleton e-invoice ND123 - phat hanh khi co provider contract.
create table if not exists public.einvoice_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  invoice_id uuid not null references public.fee_invoices(id) on delete cascade,
  provider text check (provider in ('misa','sinvoice','bkav','viettel','other')),
  status text not null default 'draft'
    check (status in ('draft','requested','issued','failed','cancelled')),
  external_ref text,
  note text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  unique (school_id, invoice_id)
);
alter table public.einvoice_requests enable row level security;
create policy er_select on public.einvoice_requests for select using (
  school_id = (select my_school_id())
    or (select my_roles()) && array['admin','so_gd']::text[]);
create policy er_write on public.einvoice_requests for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['ke_toan','bgh','admin']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['ke_toan','bgh','admin']::text[]);
grant select, insert, update on public.einvoice_requests to authenticated;

-- RPC ghi nhan thanh toan chuyen khoan (webhook hoac ke_toan gan tay).
-- Atomic: insert payment + cap nhat invoice + receipt_no; tra trang thai.
create or replace function public.fee_record_transfer(
  p_invoice uuid, p_amount numeric, p_method text,
  p_note text default null, p_txn uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  inv public.fee_invoices;
  v_school uuid := (select my_school_id());
  v_due numeric;
  v_new_paid numeric;
  v_receipt text;
  v_seq int;
begin
  -- webhook goi bang service_role -> my_school_id() null: lay truong tu
  -- invoice thay vi role check. Caller bang authenticated thi check role.
  -- for update: lock gegen parallele transfers auf dieselbe invoice.
  select * into inv from public.fee_invoices where id = p_invoice for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if v_school is not null then
    if inv.school_id <> v_school then raise exception 'school_mismatch'; end if;
    if not ((select my_roles()) && array['ke_toan','bgh','admin']::text[]) then
      raise exception 'forbidden';
    end if;
  end if;
  if inv.status in ('paid','exempt') then raise exception 'already_settled'; end if;
  if p_method not in ('transfer','bank_auto') then raise exception 'invalid_method'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  -- wie fee_collect: due = amount - exemption; cap + status gegen due.
  v_due := inv.amount - inv.exemption_amount;
  v_new_paid := inv.paid_amount + p_amount;
  if v_new_paid - v_due > 0.001 then raise exception 'invalid_amount'; end if;

  insert into public.fee_payments (invoice_id, school_id, amount, method, note)
    values (p_invoice, inv.school_id, p_amount, 'transfer', p_note);
  -- bien lai nur bei vollstandigem Ausgleich, sequentiell wie fee_collect.
  if v_new_paid >= v_due - 0.001 then
    select count(*) + 1 into v_seq
      from public.fee_invoices where school_id = inv.school_id
        and receipt_no is not null;
    v_receipt := 'BL' || lpad(v_seq::text, 6, '0');
  end if;
  update public.fee_invoices
    set paid_amount = v_new_paid,
        status = case when v_new_paid >= v_due - 0.001 then 'paid' else 'partial' end,
        receipt_no = case when v_new_paid >= v_due - 0.001
                          then coalesce(receipt_no, v_receipt)
                          else receipt_no end
    where id = p_invoice;
  if p_txn is not null then
    update public.bank_transactions
      set invoice_id = p_invoice, match_status = 'matched'
      where id = p_txn;
  end if;
  return jsonb_build_object('ok', true, 'status',
    case when v_new_paid >= v_due - 0.001 then 'paid' else 'partial' end,
    'receipt', v_receipt);
end $$;
revoke all on function public.fee_record_transfer(uuid, numeric, text, text, uuid) from public, anon;
grant execute on function public.fee_record_transfer(uuid, numeric, text, text, uuid) to authenticated, service_role;

-- ke_toan gan tay: match txn -> invoice (goi fee_record_transfer trong).
create or replace function public.fee_match_txn(p_txn uuid, p_invoice uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.bank_transactions;
  r jsonb;
begin
  if not ((select my_roles()) && array['ke_toan','bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  -- for update: zwei parallele matches durfen nicht zweimal zahlen.
  select * into t from public.bank_transactions
    where id = p_txn and school_id = (select my_school_id())
    for update;
  if not found then raise exception 'txn_not_found'; end if;
  if t.match_status = 'matched' then raise exception 'already_matched'; end if;
  r := public.fee_record_transfer(p_invoice, t.amount, 'transfer',
        'Doi soat tay: ' || coalesce(t.reference_code, t.external_id), p_txn);
  return r;
end $$;
revoke all on function public.fee_match_txn(uuid, uuid) from public, anon;
grant execute on function public.fee_match_txn(uuid, uuid) to authenticated;
