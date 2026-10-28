# CR-075 external review log

| Round | Verdict | Findings | Accion |
|---|---|---|---|
| r1 | REJECT | 9 (2 High: gvcn branch sin tenant-bind + falta revoke DML; 4 Medium: page sin gvcn, order full_name, sin validacion inline health/BHYT; 3 Low: fetch whole-school, colspan, section) | Todo corregido + live re-verify 10/10 (dd9696a) |
| r2 | REJECT | 2 (High: pht sin campus-scope en RLS+page; Medium: concurrent gvcn+pht = picker toda la escuela) | yt_can_read 3 ramas (leader / pht campus-bound fail-closed / gvcn own-class); page filtra campus||gvcn. Live: duclm solo ve TEST_IN (b357b76) |
| r3 | APPROVE | - | Reviewer verifico parentesis, campus null fail-closed, gvcn bound |

Live evidence: scripts/test-cr075-live.mjs 10/10; Playwright UI e2e BHYT save->DB; pht campus boundary 142/435 students.
