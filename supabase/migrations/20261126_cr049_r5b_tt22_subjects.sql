-- CR-049 r5b: subjects.weekly_periods - so tiet/tuan de tinh so DDGtx
-- toi thieu theo TT22/2021 Dieu 9 khoan 2 (<=2 tiet -> 2 DDGtx,
-- >2-4 tiet -> 3, >4 tiet -> 4). Null = chua cau hinh, dung san 2.
alter table public.subjects
  add column if not exists weekly_periods smallint null
  check (weekly_periods between 1 and 12);

comment on column public.subjects.weekly_periods is
  'So tiet/tuan - TT22 D9.2 tinh theo tiet/nam (35 tuan): <=1t/tuan (<=35t/nam) -> 2 DDGtx, 2t/tuan (70t/nam) -> 3, >=3t/tuan -> 4. Null = chua cau hinh, dung san 2.';
