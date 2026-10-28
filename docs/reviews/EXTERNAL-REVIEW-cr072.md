# External Review - CR-072 tich_hop (integration framework)
## r1 (reviewer-gpt) REJECT: 4H -> 82d633f
1. int_receive thieu -> RPC moi: service_role hoac bgh|admin cung truong,
   dedup (source, idem_key), module gate, grant authenticated+service_role
2. int_dequeue bo qua module gate -> them int_module_enabled(i.school_id):
   truong tat tich_hop thi event giu pending, khong dispatch
3. SSRF: endpoint khong kiem -> int_endpoint_ok khi luu (https only, chan
   localhost/private/link-local/metadata/cgnat/ipv6) + safeEndpoint() khi dispatch
4. int_enqueue cho staff tuy y payload -> chi bgh|admin; event nghiep vu cua
   staff se di qua wrapper security definer rieng cua tung module
## r2 - APPROVE (0 findings)
Live-verified 16/16: 5 endpoint xau bi chan, gvbm deny 3 RPC, inbox dedup,
module off giu event pending, module on dequeue lai; worker e2e sent=1.
UI: bgh tao/xoa connector qua form, invalid_endpoint inline; gvbm redirect.
Commits: 3558a5e + 82d633f.
Residual (accepted): DNS-rebind toi private IP khong chan duoc o tang app -
ghi nhan, webhook endpoint doi hoi https cong khai, khach noi bo dung allowlist.
