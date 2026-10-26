# CR-061: Ti le rut cau giua ngan hang he thong va ngan hang truong

Nguon: CR-059 item "ngan hang cau hoi 2 tang". Hien tai RLS da gioi han nhìn thay bank he thong (school_id IS NULL) + bank truong minh, nhung khi sinh de DC-03 he thong rut lan - GV khong chon duoc ty le.

## Scope

1. Form DC-03 (va moi tool rut tu ngan hang): them control "Ty le cau truong / cau he thong" - slider hoac select (0/100, 25/75, 50/50, 75/25, 100/0). Mac dinh 50/50.
2. `generate` route (`/api/studio/tools/[code]/generate`): tach pool fetch thanh 2 nguon (system: `.is("school_id", null)`; truong: `.eq("school_id", profile.school_id)`), chia quota theo ti le khi fill tung o ma tran.
3. Khi mot nguon het cau -> bu qua nguon kia (khong bao THIEU sai); khi ca hai het moi THIEU.
4. UI de tai: hien nguon tung cau trong de preview (badge "Truong" / "He thong").

## Impact

- `src/app/api/studio/tools/[code]/generate/route.ts` (pool fetch + pickFrom)
- `src/app/(app)/studio/[code]/page.tsx` hoac form DC-03 (control moi)
- Test: bo sung test ti le (static + handler neu co harness); verify bang dev loi approved/de tao.
- Khong doi schema.

## AC

- AC-61.1: Chon 100/0 truong -> de chi lay cau bank truong (khi bank truong du).
- AC-61.2: Chon 0/100 -> chi lay bank he thong.
- AC-61.3: Ti le hon hop -> so cau trong de xap xi ti le (sai so +-1 cau/o).
- AC-61.4: Nguon truong het -> fallback sang he thong, khong THIEU gia.
- AC-61.5: Badge nguon hien tren preview.
