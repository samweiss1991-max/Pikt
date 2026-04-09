/**
 * Fee value calculations — shared between marketplace tile,
 * locked profile, and unlock modal.
 */

const AGENCY_RATE = 0.22; // Typical agency 22% midpoint of 20–25%

/**
 * Calculate savings vs agency for a salary band.
 * @param {number} salaryLow
 * @param {number} salaryHigh
 * @param {number} feePct - pickt fee as integer (e.g. 8)
 * @returns {{ saveLow: number, saveHigh: number, saveAvg: number } | null}
 */
export function calcBandSavings(salaryLow, salaryHigh, feePct) {
  if (!salaryLow && !salaryHigh) return null;
  const low = salaryLow || salaryHigh;
  const high = salaryHigh || salaryLow;
  const rate = feePct / 100;
  const saveLow = Math.round((AGENCY_RATE - rate) * low / 1000);
  const saveHigh = Math.round((AGENCY_RATE - rate) * high / 1000);
  const avg = Math.round((AGENCY_RATE - rate) * ((low + high) / 2) / 1000);
  if (avg <= 0) return null;
  return { saveLow, saveHigh, saveAvg: avg };
}

/**
 * Format savings for marketplace tile footer.
 * "saves ~$17k vs agency"
 * @returns {string | null}
 */
export function formatTileSaving(salaryLow, salaryHigh, feePct) {
  const s = calcBandSavings(salaryLow, salaryHigh, feePct);
  if (!s) return null;
  return `saves ~$${s.saveAvg}k vs agency`;
}

/**
 * Format savings range for profile header / modal.
 * "saves ~$14k–$20k"
 * @returns {string | null}
 */
export function formatRangeSaving(salaryLow, salaryHigh, feePct) {
  const s = calcBandSavings(salaryLow, salaryHigh, feePct);
  if (!s) return null;
  if (s.saveLow === s.saveHigh) return `saves ~$${s.saveLow}k`;
  return `saves ~$${s.saveLow}k–$${s.saveHigh}k`;
}
