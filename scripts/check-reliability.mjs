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
import ts from "typescript";
import { readdirSync, readFileSync } from "fs";
import { join, relative, resolve, dirname } from "path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(SRC);

const hits = { unchecked: [], unbounded: [], action: [], cas: [] };
const QRE = /\.from\(\s*['"]|\.rpc\(\s*['"]/g;
const SAFE_WRAP = /^\s*(must|mustRows|fetchAllRows?|fetchAll)\s*[<(]/;

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
  const maskedNoFetch = maskCalls(masked, ["fetchAllRows", "fetchAll"]);
  const hadFetch =
    maskedNoFetch !== masked || /fetchAllRows?|fetchAll/.test(masked);
  if (hadFetch && !/\bmustRows\s*\(/.test(text)) return false;
  QRE.lastIndex = 0;
  return !QRE.test(maskedNoFetch);
}

// B: tables that exceed the ~1000-row PostgREST cap at pilot scale.
const BIG_TABLES =
  /^(students|grades|attendance_records|period_absences|conduct_evaluations|daily_conduct|notifications|messages|audit_log|timetable_entries|period_logs|daily_reports|early_warnings|incidents|digest_outbox|digest_deliveries|ai_jobs|tvc_questions|tvc_materials|activity_attendance|signoffs|lock_records|support_plans|teacher_assessments|counseling_cases|competency_assessments|competency_evidence|emulation_scores|tasks|profiles|teacher_subjects|student_groups|tvc_curriculum_standards|lesson_plans|assessment_items|student_assessments|parents|parent_students|appointments)$/;
const BOUNDED =
  /\.(limit|range|single|maybeSingle)\(|count\s*:|head\s*:|fetchAll|\.in\(\s*['"][a-z_]*id['"]|\.eq\(\s*['"](id|[\w.]*_id)['"]/;

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

  const visit = (n) => {
    // ---- A: unchecked-read ----
    if (ts.isVariableDeclaration(n) && n.initializer) {
      const raw = n.initializer;
      const awaited = ts.isAwaitExpression(raw);
      let e = raw;
      while (ts.isAwaitExpression(e)) e = e.expression;
      const core = e.getText(sf);
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
        if (!hasErr && awaited && !SAFE_WRAP.test(core))
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
            const elText = els[i] ? els[i].getText(sf) : "";
            resVars.push({ name: el.name.text, line, initText: elText });
          }
          if (ts.isBindingElement(el) && ts.isObjectBindingPattern(el.name)) {
            const elText = els[i] ? els[i].getText(sf) : "";
            const hasErr = el.name.elements.some(
              (x) =>
                x.name.getText(sf) === "error" ||
                x.propertyName?.getText(sf) === "error",
            );
            const elQ = QRE.test(elText);
            QRE.lastIndex = 0;
            if (
              elQ &&
              !hasErr &&
              !SAFE_WRAP.test(elText) &&
              !allQueriesWrapped(elText)
            )
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
        let stmt = n;
        while (stmt.parent && !ts.isStatement(stmt)) stmt = stmt.parent;
        const t = stmt.getText(sf);
        if (!/\.(insert|update|upsert|delete)\(/.test(t) && !BOUNDED.test(t)) {
          let vdn = n.parent;
          while (vdn && !ts.isVariableDeclaration(vdn)) vdn = vdn.parent;
          const vd = vdn && ts.isIdentifier(vdn.name) ? vdn.name.text : null;
          let boundedLater = false;
          if (vd) {
            const fnText = findFnText(stmt);
            const re = new RegExp(
              `\\b${vd}\\b[\\s\\S]{0,400}?(` +
                `\\.(range|limit|single|maybeSingle)\\(|` +
                `\\.(eq|in)\\(\\s*['"][a-z_.]*_id['"]|` +
                `\\.or\\([^)]*_id|` +
                `fetchAllRows?\\s*[(<]` +
                `)`,
            );
            boundedLater = re.test(fnText);
          }
          if (!boundedLater) {
            const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
            hits.unbounded.push(
              `${relative(SRC, f)}:${line} ${tbl} :: ${t.slice(0, 120).replace(/\s+/g, " ")}`,
            );
          }
        }
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
      const t = stmt.getText(sf);
      if (
        /\.eq\(/.test(t) &&
        !/\.select\(/.test(t) &&
        !/\.(eq|in|not)\(\s*['"](status|state|workflow_state|delivery_status)['"]/.test(
          t,
        ) &&
        /status|state|locked|approved|confirmed|completed|archived|published|delivered|processed/i.test(
          t,
        )
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
