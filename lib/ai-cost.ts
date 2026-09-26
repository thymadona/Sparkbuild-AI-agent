// The estimated USD cost of AI requests. Pure, so client tables can use it;
// the counts themselves come from lib/ai-usage.ts (platform owner only).

// Assumed USD per million tokens and an average turn's size: an estimate, not
// billing. (Moved from the old /staff overview unchanged.)
const INPUT_COST_PER_M = 0.15
const OUTPUT_COST_PER_M = 0.6
const AVG_INPUT_TOKENS = 2000
const AVG_OUTPUT_TOKENS = 3000

export function estimateCost(requests: number): string {
  const d =
    requests *
    ((AVG_INPUT_TOKENS * INPUT_COST_PER_M + AVG_OUTPUT_TOKENS * OUTPUT_COST_PER_M) / 1_000_000)
  return d === 0 ? '$0.00' : d < 0.01 ? '<$0.01' : `$${d.toFixed(2)}`
}
