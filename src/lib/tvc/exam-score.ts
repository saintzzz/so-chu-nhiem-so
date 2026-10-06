// CR-18: cham diem server-side cho thi tren may. Dap an KHONG roi server.
// Dinh dang answer (tvc_questions.answer):
//   multiple_choice: { correct: "A" | "B" | "C" | "D" }
//   true_false_4:    { correct: "a-Đúng, b-Sai, c-Đúng, d-Sai" } (canonical sau cleanup CR-08)
//   short_answer:    { correct: "<gia tri>" }
//   essay:           khong tu cham - GV cham tay (essay_pending).

export interface ExamQuestion {
  position: number;
  question_id: string;
  qtype: string;
  stem: string;
  context: string | null;
  points: number;
  answer: Record<string, unknown> | null;
}

export interface StudentAnswer {
  mc?: string; // 'A'|'B'|'C'|'D'
  tf?: Record<string, boolean>; // {a,b,c,d}
  text?: string; // short_answer / essay
}

export interface ScoredResult {
  autoScore: number;
  maxAutoScore: number;
  essayPending: number;
  detail: { position: number; got: number; max: number }[];
}

function normText(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;!]+$/, "")
    .trim();
}

function parseTfCorrect(correct: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const m of correct.matchAll(/([a-d])\s*[-).:]\s*(đúng|sai|đ|s|true|false|t|f)\b/gi)) {
    const v = m[2].toLowerCase();
    out[m[1].toLowerCase()] = ["đúng", "đ", "true", "t"].includes(v);
  }
  return out;
}

export function scoreSubmission(
  questions: ExamQuestion[],
  answers: Record<string, StudentAnswer>,
): ScoredResult {
  let autoScore = 0;
  let maxAutoScore = 0;
  let essayPending = 0;
  const detail: ScoredResult["detail"] = [];

  for (const q of questions) {
    const a = answers[String(q.position)] ?? {};
    const correct = q.answer?.correct;
    const max = q.points;

    if (q.qtype === "multiple_choice") {
      maxAutoScore += max;
      const expected = typeof correct === "string" ? correct.trim().toUpperCase() : "";
      const got = expected && a.mc?.toUpperCase() === expected ? max : 0;
      autoScore += got;
      detail.push({ position: q.position, got, max });
    } else if (q.qtype === "true_false_4") {
      maxAutoScore += max;
      const expected = parseTfCorrect(typeof correct === "string" ? correct : "");
      let claims = 0;
      for (const k of ["a", "b", "c", "d"]) {
        if (k in expected && a.tf && a.tf[k] === expected[k]) claims++;
      }
      // Ti le dung/4 - huong cham lay tien cua QD 764 ma van don gian, minh bach.
      const got = Math.round((claims / 4) * max * 100) / 100;
      autoScore += got;
      detail.push({ position: q.position, got, max });
    } else if (q.qtype === "short_answer") {
      maxAutoScore += max;
      const expected = normText(typeof correct === "string" ? correct : "");
      const got = expected && normText(a.text ?? "") === expected ? max : 0;
      autoScore += got;
      detail.push({ position: q.position, got, max });
    } else {
      // essay - GV cham tay
      essayPending++;
      detail.push({ position: q.position, got: 0, max });
    }
  }

  return {
    autoScore: Math.round(autoScore * 100) / 100,
    maxAutoScore,
    essayPending,
    detail,
  };
}
