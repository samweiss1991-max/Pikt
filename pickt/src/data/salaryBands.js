/**
 * Australian salary bands by role category and seniority.
 * Used for auto-setting salary_band_low/high during CV parsing.
 *
 * All values in AUD, annual, pre-super.
 * Sources: Hays 2025, Seek salary data, industry benchmarks.
 */

export const SALARY_BANDS = {
  "Software Engineering": {
    Junior:     { low: 70000,  high: 90000 },
    "Mid-level":{ low: 100000, high: 130000 },
    Senior:     { low: 140000, high: 175000 },
    "Staff/Lead":{ low: 170000, high: 210000 },
    Principal:  { low: 200000, high: 250000 },
    "Director+":{ low: 220000, high: 300000 },
    Manager:    { low: 160000, high: 200000 },
  },
  "Product Management": {
    Junior:     { low: 80000,  high: 100000 },
    "Mid-level":{ low: 110000, high: 140000 },
    Senior:     { low: 150000, high: 185000 },
    "Staff/Lead":{ low: 180000, high: 220000 },
    Principal:  { low: 210000, high: 260000 },
    "Director+":{ low: 230000, high: 320000 },
    Manager:    { low: 150000, high: 190000 },
  },
  "Design": {
    Junior:     { low: 65000,  high: 85000 },
    "Mid-level":{ low: 90000,  high: 120000 },
    Senior:     { low: 130000, high: 165000 },
    "Staff/Lead":{ low: 160000, high: 200000 },
    Principal:  { low: 190000, high: 240000 },
    "Director+":{ low: 200000, high: 280000 },
    Manager:    { low: 140000, high: 180000 },
  },
  "Data & Analytics": {
    Junior:     { low: 75000,  high: 95000 },
    "Mid-level":{ low: 105000, high: 135000 },
    Senior:     { low: 140000, high: 175000 },
    "Staff/Lead":{ low: 175000, high: 215000 },
    Principal:  { low: 200000, high: 260000 },
    "Director+":{ low: 220000, high: 300000 },
    Manager:    { low: 150000, high: 195000 },
  },
  "Marketing & Growth": {
    Junior:     { low: 60000,  high: 80000 },
    "Mid-level":{ low: 85000,  high: 115000 },
    Senior:     { low: 120000, high: 155000 },
    "Staff/Lead":{ low: 150000, high: 190000 },
    Principal:  { low: 180000, high: 230000 },
    "Director+":{ low: 200000, high: 280000 },
    Manager:    { low: 120000, high: 160000 },
  },
  "Sales & Revenue": {
    Junior:     { low: 65000,  high: 85000 },
    "Mid-level":{ low: 90000,  high: 120000 },
    Senior:     { low: 130000, high: 170000 },
    "Staff/Lead":{ low: 160000, high: 210000 },
    Principal:  { low: 190000, high: 250000 },
    "Director+":{ low: 220000, high: 320000 },
    Manager:    { low: 130000, high: 170000 },
  },
  "Finance": {
    Junior:     { low: 70000,  high: 90000 },
    "Mid-level":{ low: 95000,  high: 130000 },
    Senior:     { low: 135000, high: 170000 },
    "Staff/Lead":{ low: 165000, high: 210000 },
    Principal:  { low: 200000, high: 260000 },
    "Director+":{ low: 230000, high: 320000 },
    Manager:    { low: 140000, high: 185000 },
  },
  "Operations": {
    Junior:     { low: 60000,  high: 80000 },
    "Mid-level":{ low: 85000,  high: 110000 },
    Senior:     { low: 115000, high: 150000 },
    "Staff/Lead":{ low: 145000, high: 185000 },
    Principal:  { low: 175000, high: 220000 },
    "Director+":{ low: 200000, high: 280000 },
    Manager:    { low: 120000, high: 160000 },
  },
  "People & HR": {
    Junior:     { low: 60000,  high: 80000 },
    "Mid-level":{ low: 85000,  high: 115000 },
    Senior:     { low: 120000, high: 155000 },
    "Staff/Lead":{ low: 150000, high: 190000 },
    Principal:  { low: 180000, high: 230000 },
    "Director+":{ low: 200000, high: 280000 },
    Manager:    { low: 110000, high: 150000 },
  },
  "Legal & Compliance": {
    Junior:     { low: 70000,  high: 95000 },
    "Mid-level":{ low: 100000, high: 135000 },
    Senior:     { low: 140000, high: 180000 },
    "Staff/Lead":{ low: 175000, high: 220000 },
    Principal:  { low: 210000, high: 270000 },
    "Director+":{ low: 240000, high: 340000 },
    Manager:    { low: 140000, high: 185000 },
  },
};

/**
 * Look up a salary band by role category and seniority.
 * @param {string} category - Key from SALARY_BANDS
 * @param {string} seniority - seniority_level enum value
 * @returns {{ low: number, high: number } | null}
 */
export function lookupSalaryBand(category, seniority) {
  const cat = SALARY_BANDS[category];
  if (!cat) return null;
  return cat[seniority] || null;
}

/**
 * Best-guess category from a role title string.
 * @param {string} roleTitle
 * @returns {string}
 */
export function guessCategory(roleTitle) {
  const r = (roleTitle || "").toLowerCase();
  if (r.includes("engineer") || r.includes("developer") || r.includes("devops") || r.includes("sre") || r.includes("architect"))
    return "Software Engineering";
  if (r.includes("product manager") || r.includes("product lead") || r.includes("product owner"))
    return "Product Management";
  if (r.includes("design") || r.includes("ux") || r.includes("ui") || r.includes("creative"))
    return "Design";
  if (r.includes("data") || r.includes("analytics") || r.includes("ml") || r.includes("machine learning") || r.includes("ai"))
    return "Data & Analytics";
  if (r.includes("marketing") || r.includes("growth") || r.includes("brand") || r.includes("content"))
    return "Marketing & Growth";
  if (r.includes("sales") || r.includes("account") || r.includes("revenue") || r.includes("bdr") || r.includes("sdr"))
    return "Sales & Revenue";
  if (r.includes("finance") || r.includes("accounting") || r.includes("fp&a") || r.includes("cfo"))
    return "Finance";
  if (r.includes("operations") || r.includes("supply chain") || r.includes("logistics"))
    return "Operations";
  if (r.includes("people") || r.includes("hr") || r.includes("talent") || r.includes("recrui"))
    return "People & HR";
  if (r.includes("legal") || r.includes("compliance") || r.includes("counsel"))
    return "Legal & Compliance";
  return "Software Engineering"; // default fallback
}
