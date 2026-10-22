// Reliability gate - codifies the defect classes that the external review
// loop kept rediscovering site-by-site. Run: node scripts/check-reliability.mjs
// Exits non-zero and prints every violation.
//
// Scanned classes:
//   A. unchecked-read  - supabase .from()/.rpc() awaited result whose error
//      channel is never handled -> DB failure renders as fake-empty data.
//      SAFE idioms: must()/mustRows() wrappers, fetchAllRows() callbacks,
//      (VAR as {error}) casts, element .error checks via for-of/.some/.map,
//      Promise.all elements individually wrapped.
//   B. unbounded-read  - SELECT on a table that can exceed the ~1000-row
//      PostgREST cap without .limit/.range/.single/.in(id-list)/.eq(*_id)
//      or a fetchAllRows wrapper -> silent truncation corrupts reports.
//   C. action-loss     - awaited server-action results discarded or never
//      checked for {error} -> UI reports success on failed persistence.
//   D. cas-transition  - .update({status...}).eq("id") without a predicate
//      on the transition column + .select() -> stale clients overwrite
//      newer states. (heuristic: flags updates touching status-ish fields
//      lacking a conditional predicate)
import { readdirSync, readFileSync, existsSync, writeFileSync } from "fs";
import { join, relative, resolve, dirname } from "path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// SCAN_SRC: fixture tests quet mot thu muc rieng thay vi src/.
const SRC = process.env.SCAN_SRC
  ? resolve(process.env.SCAN_SRC)
  : join(ROOT, "src");

// The scanner parses TS with the project's own typescript. Skip (not fail)
// when there is nothing to scan: no src/ tree, or typescript is not
// resolvable (static repos, or deps not installed yet - typecheck catches
// the latter elsewhere).
let ts = null;
if (!existsSync(SRC)) {
  console.log("check-reliability: no src/ tree - skipped");
  process.exit(0);
}
try {
  ts = (await import("typescript")).default;
} catch {
  console.log("check-reliability: typescript not resolvable - skipped");
  process.exit(0);
}

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(SRC);

const hits = { unchecked: [], unbounded: [], action: [], cas: [] };
// .from()/.rpc() voi MOI dang tham so - ke ca ten bang dong
// (.from(e.table)) nhur r25 phat hien. Ngoai tru Array.from(...).
const QRE = /(?<!Array)\.from\s*\(|\.rpc\s*\(/g;
// fetchAllRows KHONG phai safe-wrap cho Class A: ket qua {rows,error,truncated}
// van phai di qua mustRows hoac bind error - bo sot r25 (dept/reports).
const SAFE_WRAP = /^\s*(must|mustRows)\s*[<(]/;

function maskCalls(text, names) {
  let t = text;
  const re = new RegExp(`\\b(?:${names.join("|")})\\b`, "g");
  for (;;) {
    const m = re.exec(t);
    if (!m) break;
    let i = m.index + m[0].length;
    while (i < t.length && /\s/.test(t[i])) i++;
    if (t[i] === "<") {
      let d = 1;
      i++;
      while (i < t.length && d > 0) {
        if (t[i] === "<") d++;
        else if (t[i] === ">") d--;
        i++;
      }
      while (i < t.length && /\s/.test(t[i])) i++;
    }
    if (t[i] !== "(") continue;
    let depth = 1;
    i++;
    while (i < t.length && depth > 0) {
      const ch = t[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    t = t.slice(0, m.index) + " ".repeat(i - m.index) + t.slice(i);
    re.lastIndex = m.index;
  }
  return t;
}

function allQueriesWrapped(text) {
  const masked = maskCalls(text, ["must", "mustRows"]);
  const maskedNoFetch = maskCalls(masked, ["fetchAllRows", "fetchAllRowsIn", "fetchAll"]);
  const hadFetch =
    maskedNoFetch !== masked || /fetchAllRows(?:In)?|fetchAll/.test(masked);
  if (hadFetch && !/\bmustRows\s*\(/.test(text)) return false;
  QRE.lastIndex = 0;
  return !QRE.test(maskedNoFetch);
}

// B: tables that exceed the ~1000-row PostgREST cap at pilot scale.
const BIG_TABLES =
  /^(students|grades|attendance_records|period_absences|conduct_evaluations|daily_conduct|notifications|messages|audit_log|audit_logs|student_record_history|activities|announcements|activity_announcements|timetable_entries|period_logs|daily_reports|early_warnings|incidents|digest_outbox|digest_deliveries|ai_jobs|tvc_questions|tvc_materials|activity_attendance|signoffs|lock_records|support_plans|teacher_assessments|counseling_cases|competency_assessments|competency_evidence|emulation_scores|tasks|profiles|teacher_subjects|student_groups|tvc_curriculum_standards|lesson_plans|assessment_items|student_assessments|parents|parent_students|appointments)$/;
// Cot scope cardinality cao KHONG gioi han so rows (r25: .in("school_id")
// tren profiles cua mot So co the >1000 rows). Chi cac khoa tro toi mot
// thuc the don le moi tinh la bounded.
const HIGH_CARD_COLS =
  /^(school_id|academic_year_id|campus_id|org_unit_id|subject_id|term_id|year_id|term|semester|grade|role|status|date|weekday|month|year)$/;
// Bang moi truong luon < 1000 rows -> .eq("school_id") du de bound.
// (.in("school_id") = pham vi So -> KHONG bao gio bound.)
const SCHOOL_SCOPED =
  /^(profiles|classes|subjects|campuses|departments|school_kpis|feature_grants|digest_configs|literature|schools|academic_years)$/;
function colBounds(col, tbl, method) {
  const c = col.split(".").pop();
  // r26 M: .in(*_id) KHONG bao gio bound - kich thuoc list khong kiem
  // chung duoc tinh (.in("class_id", allSchoolClasses) tren students cua
  // truong 1200 HS tra >1000 rows, cat ngam khong loi). Ca .in("id")
  // cung vay - list PK co the vuot cap.
  if (method === "in") return false;
  // Khoa unique-ish: lookup theo key/code/token luon <=1 row.
  if (
    c === "id" ||
    c === "key" ||
    c === "code" ||
    c === "slug" ||
    c === "token" ||
    c === "dedupe_key" ||
    c.endsWith("_key") ||
    c.endsWith("_code") ||
    c.endsWith("_token")
  )
    return true;
  if (c === "school_id") return method === "eq" && SCHOOL_SCOPED.test(tbl);
  return c.endsWith("_id") && !HIGH_CARD_COLS.test(c);
}
function isBounded(t, tbl) {
  if (
    /\.(limit|range|single|maybeSingle)\(|count\s*:|head\s*:|fetchAll/.test(t)
  )
    return true;
  for (const m of t.matchAll(/\.(eq|in|is)\(\s*['"]([\w.]+)['"]/g))
    if (colBounds(m[2], tbl, m[1])) return true;
  for (const m of t.matchAll(/\.or\(\s*['"]([\w.]+)/g))
    if (colBounds(m[1], tbl, "or")) return true;
  return false;
}

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const sf = ts.createSourceFile(
    f,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const body = sf.getText(sf);
  const isActionFile = /actions\.ts$|route\.ts$/.test(f);

  // ---- C: collect action imports (only needed in non-action files) ----
  const actionNames = new Set();
  if (!isActionFile) {
    for (const st of sf.statements) {
      if (
        ts.isImportDeclaration(st) &&
        st.importClause?.namedBindings &&
        ts.isNamedImports(st.importClause.namedBindings)
      ) {
        const mod = st.moduleSpecifier.text;
        if (mod.endsWith("/actions") || mod.endsWith("actions")) {
          for (const el of st.importClause.namedBindings.elements)
            actionNames.add(el.name.text);
        }
      }
    }
  }

  const resVars = [];
  const decls = new Map();
  const findFnText = (node) => {
    let fn = node;
    while (
      fn.parent &&
      !ts.isFunctionLike(fn.parent) &&
      !ts.isSourceFile(fn.parent)
    )
      fn = fn.parent;
    return fn.parent ? fn.parent.getText(sf) : src;
  };

  // r26 M: query giu trong bien roi moi await (`let q = supabase.from...
  // const {data} = await q` / `await q.range()`). Tim identifier goc cua
  // mot chain de tra decls - QRE chi match .from(/.rpc( truc tiep nen
  // dang nay truot gate r25 (intake, announce, journals, audit).
  const rootIdent = (expr) => {
    let x = expr;
    while (
      ts.isCallExpression(x) ||
      ts.isPropertyAccessExpression(x) ||
      ts.isParenthesizedExpression(x) ||
      ts.isAsExpression(x) ||
      ts.isNonNullExpression(x)
    ) {
      x = x.expression;
    }
    return ts.isIdentifier(x) ? x.text : null;
  };
  const resolveCore = (expr, core) => {
    const rid = expr && rootIdent(expr);
    if (rid && decls.has(rid)) {
      const d = decls.get(rid);
      QRE.lastIndex = 0;
      if (QRE.test(d)) {
        QRE.lastIndex = 0;
        return d;
      }
      QRE.lastIndex = 0;
    }
    return core;
  };

  const visit = (n) => {
    // ---- A: unchecked-read ----
    if (ts.isVariableDeclaration(n) && n.initializer) {
      const raw = n.initializer;
      const awaited = ts.isAwaitExpression(raw);
      let e = raw;
      while (ts.isAwaitExpression(e)) e = e.expression;
      const core = resolveCore(e, e.getText(sf));
      if (ts.isIdentifier(n.name)) decls.set(n.name.text, core);
      const isQuery = QRE.test(core);
      QRE.lastIndex = 0;
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      if (isQuery && ts.isObjectBindingPattern(n.name)) {
        const hasErr = n.name.elements.some(
          (x) =>
            x.name.getText(sf) === "error" ||
            x.propertyName?.getText(sf) === "error",
        );
        // r25: khong bat buoc `awaited` - cond ? await fetchAllRows() :
        // fallback la conditional initializer, van phai chan error.
        if (!hasErr && !SAFE_WRAP.test(core) && !allQueriesWrapped(core))
          hits.unchecked.push(`${relative(SRC, f)}:${line} NO-ERR-BIND`);
      } else if (isQuery && awaited && ts.isIdentifier(n.name)) {
        resVars.push({ name: n.name.text, line, initText: core });
      } else if (awaited && ts.isIdentifier(n.name) && ts.isIdentifier(e)) {
        resVars.push({ name: n.name.text, line, initText: core, indirect: e.text });
      }
      if (
        awaited &&
        ts.isArrayBindingPattern(n.name) &&
        /Promise\.all/.test(raw.getText(sf)) &&
        ts.isCallExpression(e) &&
        ts.isArrayLiteralExpression(e.arguments[0])
      ) {
        const els = e.arguments[0].elements;
        n.name.elements.forEach((el, i) => {
          if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
            const elText = els[i]
              ? resolveCore(els[i], els[i].getText(sf))
              : "";
            resVars.push({ name: el.name.text, line, initText: elText });
          }
          if (ts.isBindingElement(el) && ts.isObjectBindingPattern(el.name)) {
            const elText = els[i]
              ? resolveCore(els[i], els[i].getText(sf))
              : "";
            const hasErr = el.name.elements.some(
              (x) =>
                x.name.getText(sf) === "error" ||
                x.propertyName?.getText(sf) === "error",
            );
            const elQ = QRE.test(elText);
            QRE.lastIndex = 0;
            // fetchAll/fetchAllRows element khong phai safe-wrap - phai
            // mustRows hoac bind error/incomplete (r25 SAFE_WRAP qua rong;
            // {rows,truncated} ma khong bind error van la lo: loi trang dau
            // tra truncated=false).
            const elSafe =
              SAFE_WRAP.test(elText) ||
              (/^\s*(fetchAllRows(?:In)?|fetchAll)\s*[<(]/.test(elText) &&
                /error|incomplete/.test(el.name.getText(sf)));
            if (elQ && !hasErr && !elSafe && !allQueriesWrapped(elText))
              hits.unchecked.push(`${relative(SRC, f)}:${line} NO-ERR-BIND-EL`);
          }
        });
      }
    }

    // ---- B: unbounded-read ----
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "from" &&
      /supabase/.test(n.expression.expression.getText(sf))
    ) {
      const tbl = n.arguments[0]?.getText(sf).replace(/['"]/g, "") || "";
      if (BIG_TABLES.test(tbl)) {
        // Query nam trong callback fetchAllRows*/fetchAll: helper tu phan
        // trang -> bound theo dinh nghia, bat ke hinh dang var ben trong.
        let inPager = false;
        for (let anc = n.parent; anc; anc = anc.parent) {
          if (
            ts.isCallExpression(anc) &&
            ts.isIdentifier(anc.expression) &&
            /^(fetchAllRows|fetchAllRowsIn|fetchAll)$/.test(anc.expression.text)
          ) {
            inPager = true;
            break;
          }
        }
        if (!inPager) {
        let stmt = n;
        while (stmt.parent && !ts.isStatement(stmt)) stmt = stmt.parent;
        const t = stmt.getText(sf);
        if (!/\.(insert|update|upsert|delete)\(/.test(t) && !isBounded(t, tbl)) {
          let vdn = n.parent;
          while (vdn && !ts.isVariableDeclaration(vdn)) vdn = vdn.parent;
          const vd = vdn && ts.isIdentifier(vdn.name) ? vdn.name.text : null;
          let boundedLater = false;
          if (vd) {
            const fnText = findFnText(stmt);
            // Query builder dat trong var, bound o chain tiep theo
            // (.limit/.range/._id predicate/fetchAllRows). Cot cardinality
            // cao (school_id...) khong tinh - cung HIGH_CARD_COLS.
            const chainRe = new RegExp(
              `\\b${vd}\\s*\\.\\s*(range|limit|single|maybeSingle)\\s*\\(`,
            );
            if (chainRe.test(fnText)) boundedLater = true;
            if (!boundedLater) {
              const predRe = new RegExp(
                `\\b${vd}\\s*\\.\\s*(eq|in|is|or)\\s*\\(\\s*['"]([\\w.]+)`,
                "g",
              );
              for (const cm of fnText.matchAll(predRe))
                if (colBounds(cm[2], tbl, cm[1])) {
                  boundedLater = true;
                  break;
                }
            }
            if (
              !boundedLater &&
              new RegExp(
                `fetchAllRows(?:In)?\\s*[(<][\\s\\S]{0,400}?\\b${vd}\\b`,
              ).test(fnText)
            )
              boundedLater = true;
          }
          // Exemption co chu dich: `// bounded-ok: <ly do>` ngay tren -
          // dung khi list .in nho theo cau truc (vd Set <=3 id) hoac bound
          // dat o cho scanner khong thay duoc. Luon kem ly do.
          if (!boundedLater) {
            const pre = src.slice(Math.max(0, stmt.getStart() - 200), stmt.getStart());
            if (!/bounded-ok/.test(pre + t)) {
              const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
              hits.unbounded.push(
                `${relative(SRC, f)}:${line} ${tbl} :: ${t.slice(0, 120).replace(/\s+/g, " ")}`,
              );
            }
          }
        }
        }
      }
    }

    // ---- A: discarded awaited query (r25: notifications-client update) ----
    // `await supabase.from().update(...)` lam expression statement -> ket qua
    // bi bo, UI cap nhat du write that bai. Phai must()/bind error.
    if (
      ts.isExpressionStatement(n) &&
      ts.isAwaitExpression(n.expression)
    ) {
      let core = n.expression.expression.getText(sf);
      if (decls.has(core.trim())) core = decls.get(core.trim());
      else core = resolveCore(n.expression.expression, core);
      const isQ = QRE.test(core);
      QRE.lastIndex = 0;
      // Exemption co chu dich: `// discarded-ok: <ly do>` ngay tren -
      // dung khi callee tu xu ly loi ben trong (vd release-claim helper
      // log loi rpc) thay vi tra result de caller kiem.
      const preD = src.slice(
        Math.max(0, n.getStart() - 200),
        n.getStart(),
      );
      if (
        isQ &&
        !SAFE_WRAP.test(core) &&
        !allQueriesWrapped(core) &&
        !/discarded-ok/.test(preD + core)
      ) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        hits.unchecked.push(
          `${relative(SRC, f)}:${line} DISCARDED-QUERY`,
        );
      }
    }

    // ---- B: paginated helper phai .order() (r25: dept/usage) ----
    // fetchAllRows/fetchAll paging .range() khong co order -> thu tu trang
    // khong on dinh -> row lap/bo sot, incomplete van false.
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      /^(fetchAllRows(?:In)?|fetchAll)$/.test(n.expression.text) &&
      n.arguments[0]
    ) {
      const arg = n.arguments[0];
      let cb = arg.getText(sf);
      if (ts.isIdentifier(arg) && decls.has(arg.text))
        cb = decls.get(arg.text);
      if (/\.range\s*\(/.test(cb) && !/\.order\s*\(/.test(cb)) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        hits.unbounded.push(
          `${relative(SRC, f)}:${line} PAGINATED-NO-ORDER ${n.expression.text}`,
        );
      }
    }

    // ---- C: action-loss ----
    if (
      !isActionFile &&
      actionNames.size &&
      ts.isAwaitExpression(n) &&
      ts.isCallExpression(n.expression)
    ) {
      const ce = n.expression;
      const callee = ce.expression.getText(sf);
      const base = callee.split(".").pop();
      if (actionNames.has(base)) {
        let cur = n;
        while (
          cur.parent &&
          (ts.isConditionalExpression(cur.parent) ||
            ts.isBinaryExpression(cur.parent) ||
            (ts.isCallExpression(cur.parent) && cur.parent.expression !== cur) ||
            ts.isParenthesizedExpression(cur.parent) ||
            ts.isAsExpression(cur.parent) ||
            ts.isNonNullExpression(cur.parent))
        )
          cur = cur.parent;
        let bound = null,
          mode = "discarded";
        if (
          ts.isVariableDeclaration(cur.parent) &&
          ts.isIdentifier(cur.parent.name)
        ) {
          bound = cur.parent.name.text;
          mode = "bound";
        } else if (
          ts.isReturnStatement(cur.parent) ||
          ts.isArrowFunction(cur.parent) ||
          ts.isPropertyAssignment(cur.parent)
        ) {
          mode = "returned";
        }
        const fn = findFnText(n);
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        if (mode === "discarded")
          hits.action.push(`${relative(SRC, f)}:${line} DISCARDED ${callee}(...)`);
        else if (mode === "bound") {
          const ok = new RegExp(
            `\\b${bound}\\.error\\b|\\b${bound}\\?\\.|${bound}\\s*&&|` +
              `if\\s*\\(\\s*${bound}\\b|${bound}\\.(committed|ok|success|skipped|email)|` +
              `["']error["']\\s+in\\s+${bound}\\b|!\\s*${bound}\\.(rows|data|url|id)\\b|` +
              `\\breturn\\s+${bound}\\b|${bound}\\s*\\?\\?|` +
              `\\{\\s*error[^}]*\\}\\s*=\\s*${bound}\\b`,
          ).test(fn);
          if (!ok)
            hits.action.push(
              `${relative(SRC, f)}:${line} NO-ERR-CHECK ${bound} = await ${callee}(...)`,
            );
        }
      }
    }

    // ---- D: cas-transition ----
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "update"
    ) {
      let stmt = n;
      while (stmt.parent && !ts.isStatement(stmt)) stmt = stmt.parent;
      let t = stmt.getText(sf);
      // Chain co the tiep tuc qua var o statement khac:
      //   let q = ...update(patch).eq("id"); if (c) q = q.eq("status", s);
      //   await q.select("id")
      const assign = /(?:let|const)\s+(\w+)\s*=[\s\S]*?\.update\s*\(/.exec(t);
      if (assign) {
        const v = assign[1];
        const fnText = findFnText(n);
        const extra = [
          ...fnText.matchAll(
            new RegExp(
              `\\b${v}\\s*\\.\\s*(?:eq|in|not|is|or|select|single|maybeSingle)\\s*\\([^;)]*\\)`,
              "g",
            ),
          ),
        ]
          .map((x) => x[0])
          .join(" ");
        t += " " + extra;
      }
      // Status-ish: literal trong stmt HOAC update-arg la identifier co
      // status trong param-type/call-site (r25: .update(patch) bi bo sot).
      let statusish =
        /status|state|locked|approved|confirmed|completed|archived|published|delivered|processed/i.test(
          t,
        );
      const arg = n.arguments[0];
      if (!statusish && arg && ts.isIdentifier(arg)) {
        const a = arg.text;
        const fnText = findFnText(n);
        // const patch = { status } -> object literal chua status-ish key
        const decl = decls.get(a);
        if (decl && /\b(status|state|workflow_state|delivery_status)\b/.test(decl))
          statusish = true;
        if (
          !statusish &&
          new RegExp(`${a}\\s*:\\s*\\{[^}]*\\b(status|state)\\b`).test(fnText)
        )
          statusish = true;
        if (!statusish) {
          let fn = n.parent;
          while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
          let fname = null;
          if (fn && ts.isFunctionDeclaration(fn) && fn.name)
            fname = fn.name.text;
          if (!fname && fn && ts.isVariableDeclaration(fn.parent))
            fname = fn.parent.name.getText(sf);
          if (
            fname &&
            new RegExp(
              `\\b${fname}\\s*\\(\\s*\\{[^}]*\\b(status|state)\\b\\s*:`,
            ).test(src)
          )
            statusish = true;
        }
      }
      // Exemption co chu dich: comment `// cas-ok: <ly do>` ngay tren
      // statement - duy tri danh sach ngoai le tuong minh trong review.
      const pre = src.slice(Math.max(0, stmt.getStart() - 200), stmt.getStart());
      if (
        statusish &&
        /\.eq\(/.test(t) &&
        !/cas-ok/.test(pre + t) &&
        (!/\.select\(/.test(t) ||
          !/\.(eq|in|not|is)\(\s*['"](status|state|workflow_state|delivery_status|read_at)['"]/.test(
            t,
          ))
      ) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        hits.cas.push(
          `${relative(SRC, f)}:${line} ${t.slice(0, 120).replace(/\s+/g, " ")}`,
        );
      }
    }

    ts.forEachChild(n, visit);
  };
  visit(sf);

  // ---- A (cont): resolve identifier-bound results ----
  for (const v of resVars) {
    let initText = v.initText;
    if (v.indirect && decls.has(v.indirect)) initText = decls.get(v.indirect);
    if (allQueriesWrapped(initText)) continue;
    const hasQuery = QRE.test(initText);
    QRE.lastIndex = 0;
    if (!hasQuery && !v.indirect) continue;
    let handled = new RegExp(
      `\\b${v.name}(\\s*\\?)?\\s*\\.\\s*(error|incomplete|truncated)\\b`,
    ).test(body);
    if (!handled)
      handled = new RegExp(`\\b${v.name}\\s+as\\s*\\{[^}]*error`).test(body);
    if (!handled) {
      const loop = new RegExp(
        `for\\s*\\(\\s*(?:const|let)\\s+(\\w+)\\s+of\\s+${v.name}\\b`,
      ).exec(body);
      if (loop && new RegExp(`\\b${loop[1]}\\s*\\.\\s*error\\b`).test(body))
        handled = true;
    }
    if (
      !handled &&
      new RegExp(
        `\\b${v.name}\\s*\\.\\s*(some|every|find|filter|map)\\s*\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>`,
      ).test(body)
    ) {
      const m = new RegExp(
        `\\b${v.name}\\s*\\.\\s*(?:some|every|find|filter|map)\\s*\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>`,
      ).exec(body);
      if (m && new RegExp(`\\b${m[1]}\\s*\\.\\s*error\\b`).test(body))
        handled = true;
    }
    if (
      !handled &&
      new RegExp(`\\b${v.name}\\s*[,\\]\\n]`).test(body) &&
      /\.map\(\s*\(?\s*\w+\s*\)?\s*=>[^;]*\.error/.test(body)
    ) {
      handled = true;
    }
    if (!handled)
      hits.unchecked.push(`${relative(SRC, f)}:${v.line} NO-ERR-USE ${v.name}`);
  }
}

// Ratchet baseline: .reliability-baseline.json at repo root fingerprints known
// violations as "file|pattern detail" (line numbers stripped so unrelated
// edits don't invalidate them). Baselined hits never fail; only NEW
// violations do. After paying down debt, regenerate with --write-baseline.
const BASELINE_FILE = join(ROOT, ".reliability-baseline.json");
const fp = (h) => h.replace(/\\/g, "/").replace(/:\d+/, "").trim();
if (process.argv.includes("--write-baseline")) {
  const all = [...hits.unchecked, ...hits.unbounded, ...hits.action, ...hits.cas]
    .map(fp)
    .sort();
  writeFileSync(BASELINE_FILE, JSON.stringify(all, null, 2) + "\n");
  console.log(`baseline written: ${all.length} entr(ies) -> .reliability-baseline.json`);
  process.exit(0);
}
const baseline = new Map();
if (existsSync(BASELINE_FILE))
  for (const s of JSON.parse(readFileSync(BASELINE_FILE, "utf8")))
    baseline.set(fp(s), (baseline.get(fp(s)) ?? 0) + 1);
let baselined = 0;
for (const k of Object.keys(hits)) {
  const before = hits[k].length;
  hits[k] = hits[k].filter((h) => {
    const key = fp(h);
    const n = baseline.get(key) ?? 0;
    if (n > 0) {
      baseline.set(key, n - 1);
      return false;
    }
    return true;
  });
  baselined += before - hits[k].length;
}
if (baselined) console.log(`(${baselined} known violation(s) covered by baseline)`);

const failures = [];
const check = (name, list) => {
  const ok = list.length === 0;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (${list.length})`}`,
  );
  if (!ok) {
    for (const h of list.slice(0, 20)) console.log(`       ${h}`);
    if (list.length > 20) console.log(`       ... +${list.length - 20} more`);
    failures.push(`${name}: ${list.length}`);
  }
};

check("reliability:unchecked-read", hits.unchecked);
check("reliability:unbounded-read", hits.unbounded);
check("reliability:action-result-loss", hits.action);
check("reliability:cas-transition", hits.cas);

console.log(
  "\n" +
    (failures.length
      ? `${failures.length} reliability check(s) FAILED`
      : "All reliability checks passed"),
);
process.exit(failures.length ? 1 : 0);
