// Storefront availability map — toggle per stage when YOU open it.
// Unlock (prereq met) ≠ purchasable. Stage 2 stays visible + unlocked after
// Stage 1, but Add to cart is greyed out until STAGE_OPEN[2] = true.
// No DB change needed — flip this and redeploy when ready.
export const STAGE_OPEN: Record<number, boolean> = {
  1: true,
  2: false,
};

export function isStagePurchasable(stage: number) {
  return STAGE_OPEN[stage] ?? false;
}

export const STAGE2_CLOSED_MSG =
  "Stage 2 is not open yet — keep working on your individual task.";
