/**
 * Tax estimation module.
 * Offline: curated federal brackets + ZIP→state approximate rates.
 *
 * Capital gains (simplified gameplay model — not tax advice):
 *   - yearsHeld ≥ 1 → long-term federal CGT ≈ 15% (LTCG_FEDERAL_RATE)
 *   - yearsHeld < 1  → short-term taxed as ordinary income (approx top marginal
 *     on gains alone using federal brackets + state rate)
 *   - State CGT ≈ state income tax rate × gains (from ZIP)
 *
 * FUTURE HOOK — live tax data:
 *   await fetchTaxTables(year) could pull IRS SOI / Tax Foundation JSON
 *   and merge into getFederalTable. Game must remain playable offline
 *   with the static tables in data/tax-brackets.js.
 */

import { getFederalTable } from '../data/tax-brackets.js';
import { stateFromZip } from '../data/state-from-zip.js';
import { LTCG_FEDERAL_RATE } from '../config.js';

/**
 * Progressive federal income tax on taxable income.
 * @param {number} taxable
 * @param {ReturnType<typeof getFederalTable>} table
 */
export function federalTaxOn(taxable, table) {
  if (taxable <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const bracket of table.brackets) {
    const cap = bracket.upTo == null ? Infinity : bracket.upTo;
    const slice = Math.min(taxable, cap) - prev;
    if (slice <= 0) break;
    tax += slice * bracket.rate;
    prev = cap;
    if (taxable <= cap) break;
  }
  return Math.round(tax);
}

/**
 * Estimate annual taxes for a portfolio snapshot.
 * @param {object} state - game financial state
 * @param {object} difficulty
 * @returns {{ federal: number, state: number, property: number, total: number, meta: object }}
 */
export function estimateAnnualTax(state, difficulty) {
  const year = state.year;
  const table = getFederalTable(year, difficulty.inflation);
  const zipInfo = stateFromZip(state.zip || '85001');
  const gross = Math.max(0, (state.salary || 0) + (state.socialSecurity || 0));
  const taxable = Math.max(0, gross - table.stdDeduction);
  let federal = federalTaxOn(taxable, table);
  federal = Math.round(federal * (difficulty.taxMult || 1));

  const stateTax = Math.round(gross * zipInfo.stateIncomeTaxApprox * (difficulty.taxMult || 1));

  let property = 0;
  for (const home of state.homes || []) {
    const rate = home.propertyTaxRate ?? 0.012;
    property += Math.round((home.value || 0) * rate);
  }

  return {
    federal,
    state: stateTax,
    property,
    total: federal + stateTax + property,
    meta: {
      zipInfo,
      stdDeduction: table.stdDeduction,
      taxable,
      source: 'static-offline',
    },
  };
}

/**
 * Capital gains tax on a stock sale.
 * @param {object} opts
 * @param {number} opts.gains - realized gains ($) entered by player (can be 0)
 * @param {number} opts.yearsHeld
 * @param {object} state
 * @param {object} difficulty
 * @returns {{ federal: number, state: number, total: number, longTerm: boolean, rateNote: string }}
 */
export function estimateCapitalGainsTax({ gains, yearsHeld, state, difficulty }) {
  const g = Math.max(0, Number(gains) || 0);
  const zipInfo = stateFromZip(state.zip || '85001');
  const longTerm = (Number(yearsHeld) || 0) >= 1;
  let federal = 0;
  let rateNote = '';

  if (longTerm) {
    federal = Math.round(g * LTCG_FEDERAL_RATE * (difficulty.taxMult || 1));
    rateNote = `Long-term federal ≈ ${(LTCG_FEDERAL_RATE * 100).toFixed(0)}%`;
  } else {
    // Short-term: tax gains as ordinary income on top of salary (simplified)
    const table = getFederalTable(state.year, difficulty.inflation);
    const gross = Math.max(0, (state.salary || 0) + (state.socialSecurity || 0));
    const baseTaxable = Math.max(0, gross - table.stdDeduction);
    const withGains = Math.max(0, gross + g - table.stdDeduction);
    federal = Math.round(
      (federalTaxOn(withGains, table) - federalTaxOn(baseTaxable, table)) *
        (difficulty.taxMult || 1)
    );
    rateNote = 'Short-term: ordinary income rate (approx)';
  }

  const stateTax = Math.round(g * zipInfo.stateIncomeTaxApprox * (difficulty.taxMult || 1));
  return {
    federal,
    state: stateTax,
    total: federal + stateTax,
    longTerm,
    rateNote,
    stateAbbr: zipInfo.abbr,
  };
}

/**
 * Optional online enhancement stub.
 * Returns null when offline / blocked; Engine ignores and uses static.
 */
export async function fetchLiveTaxHint(year) {
  // Hook: replace with IRS / Tax Foundation endpoint when available.
  return null;
}
