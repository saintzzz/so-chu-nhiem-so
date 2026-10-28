# CR-070 External Review Loop

## Round 1 (reviewer-gpt) - REJECT

| Sev | Finding | Disposición |
|---|---|---|
| High | `dd_effective_teacher` = oráculo security-definer sin tenant/module check - cualquier usuario autenticado resolvía profesor de cualquier entry cross-tenant | FIXED: plpgsql, join `timetable_entries→classes`, fail-closed null cuando entry inexistente, school != my_school_id(), o módulo off. Live: service-role→null, module-off→null, JWT propio→resuelve |
| Medium | pht autorizado en página/RPCs pero sin entrada nav | FIXED: nav pht + "Điều động giáo viên" module-gated |
| Medium | glifo `→` en date range (regla: solo `-`) | FIXED: ` - ` |
| Medium | botón "Aprobar" (español) | FIXED: "Phê duyệt" |

Fix commit: `9fe8830`. Live test extendido: +`effective_service_null` +`module_off_effective` → 19/19 pass.

## Round 2 (reviewer-gpt) - APPROVE

Re-verificados los 4 fixes en archivos reales; sin issues nuevos. `my_school_id()`
dentro del security-definer deriva contexto del caller vía auth helper (no confía
en `p_entry`). Sweep de glifos: restantes son comentarios/otros módulos ajenos.

## Post-review (consistency gate)
- `code:vn-sort` detectó select de profesores sin orden VN - FIXED:
  `sortByVietnameseName` en `sortedTeachers` (mismo commit de cierre).

## Estado: CERRADO (APPROVE r2)
