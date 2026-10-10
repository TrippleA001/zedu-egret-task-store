// Task-policy validators (Phase 8): the admin-facing prereq stage syntax
// ("1-10, 15, 70-90") and the per-task attempts policy. Pure and safe to
// share with mobile. Consumed by the admin products route (write-time
// validation), checkout (enforcement), and the catalog/profile unlock logic.

export const ATTEMPTS_POLICIES = ["single", "multiple"] as const;
export type AttemptsPolicy = (typeof ATTEMPTS_POLICIES)[number];

/** Expand a prereq expression like "1-10, 15, 70-90" into a sorted, unique
 *  stage list. Empty/whitespace input → stages: null, meaning "use the
 *  historic default (stage N-1)". Returns error text for anything malformed. */
export function parsePrereqStages(
  raw: string | null | undefined
): { stages: number[] | null; error: string | null } {
  const t = String(raw ?? "").trim();
  if (!t) return { stages: null, error: null };
  const out = new Set<number>();
  for (const partRaw of t.split(",")) {
    const part = partRaw.trim();
    if (!part) continue; // tolerate "1,,2"
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m)
      return {
        stages: null,
        error: `Invalid prerequisite "${part}" — use stage numbers or ranges like 1-10, comma-separated`,
      };
    const a = Number(m[1]);
    const b = m[2] !== undefined ? Number(m[2]) : a;
    if (a < 1 || a > 99 || b < 1 || b > 99)
      return { stages: null, error: "Stage numbers must be between 1 and 99" };
    if (b < a)
      return { stages: null, error: `Range "${part}" is backwards — put the lower number first` };
    for (let s = a; s <= b; s++) out.add(s);
  }
  if (out.size === 0) return { stages: null, error: null };
  return { stages: Array.from(out).sort((x, y) => x - y), error: null };
}

/** Validate a prereq expression for a specific task: syntax first, then
 *  reject a task requiring itself (instant deadlock). */
export function prereqStagesError(raw: string | null | undefined, ownStage?: number): string | null {
  const { stages, error } = parsePrereqStages(raw);
  if (error) return error;
  if (stages && ownStage !== undefined && stages.includes(ownStage))
    return `Task ${ownStage} cannot require itself`;
  return null;
}

/** Validate an attempts_policy value. Absent/empty = keep the column default. */
export function attemptsPolicyError(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (!(ATTEMPTS_POLICIES as readonly string[]).includes(String(raw)))
    return `attempts_policy must be one of: ${ATTEMPTS_POLICIES.join(", ")}`;
  return null;
}

/** The stages a task requires, given its stored prereq expression and stage
 *  number. Shared by checkout and the unlock UI so both apply the same
 *  default (N-1, nothing for stage 1). */
export function requiredStages(
  prereqRaw: string | null | undefined,
  stageNumber: number
): number[] {
  const { stages } = parsePrereqStages(prereqRaw);
  if (stages) return stages;
  return stageNumber > 1 ? [stageNumber - 1] : [];
}
