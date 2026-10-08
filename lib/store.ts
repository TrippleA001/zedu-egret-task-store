// Storefront availability map — toggle per task when YOU open it.
// Unlock (prereq met) ≠ purchasable. A task can stay visible + unlocked but
// greyed out until TASK_OPEN[n] = true. Task numbers are GLOBAL (Task 1..N);
// week_number on the product decides which Week section renders the card.
// No DB change needed — flip this and redeploy when ready.
export const TASK_OPEN: Record<number, boolean> = {
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
};

// Back-compat alias for tooling/tests that reference the old name.
export const STAGE_OPEN = TASK_OPEN;

export function isStagePurchasable(stage: number) {
  return TASK_OPEN[stage] ?? false;
}

export function isTaskPurchasable(task: number) {
  return TASK_OPEN[task] ?? false;
}

export const STAGE2_CLOSED_MSG =
  "Stage 2 is not open yet — keep working on your individual task.";

export const TASK_CLOSED_MSG =
  "This task is not open yet — it unlocks when announced.";

