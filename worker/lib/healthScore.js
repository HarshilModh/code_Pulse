// HealthScore (0–100) = 100 − Σ penalty × weight. Each penalty is on a 0–100 scale.
// A pure function (no I/O) so the formula can be unit-tested on its own.
export const WEIGHTS = { complexity: 0.25, vuln: 0.25, deadcode: 0.15, coverage: 0.20, drift: 0.15 };

export function computePenalties({ complexity, vuln, deadcode, coverage, drift }) {
  return {
    // avg cyclomatic complexity of 10+ is the maximum penalty.
    // `?? 0`: a report without avgComplexity used to make the whole score NaN
    complexity: Math.min(((complexity.avgComplexity ?? 0) / 10) * 100, 100),
    // critical=10, high=5, moderate=2 points each; low is ignored; capped at 100
    vuln: Math.min((vuln.critical ?? 0) * 10 + (vuln.high ?? 0) * 5 + (vuln.moderate ?? 0) * 2, 100),
    deadcode: (deadcode.deadCodeRatio ?? 0) * 100,
    // No lcov report (coverage === null) means NO penalty — missing coverage scores the same
    // as 100% coverage. Known limitation, kept as-is; the tests pin this behavior down.
    coverage: coverage.coverage !== null && coverage.coverage !== undefined ? (1 - coverage.coverage) * 100 : 0,
    drift: (drift.driftRatio ?? 0) * 100,
  };
}

export function computeHealthScore(results) {
  const penalties = computePenalties(results);
  const score = 100 - Object.keys(WEIGHTS).reduce((sum, k) => sum + penalties[k] * WEIGHTS[k], 0);
  return Math.max(0, Math.min(100, score));
}
