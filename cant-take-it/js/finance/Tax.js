/**
 * Tax estimation module.
 * Offline: curated federal brackets + ZIP→state approximate rates.
 *
 * FUTURE HOOK — live tax data:
 *   await fetchTaxTables(year) could pull IRS SOI / Tax Foundation JSON
 *   and merge into getFederalTable. Game must remain playable offline
 *   with the static tables in data/tax-brackets.js.
 */

import { getFederalTable } from '../data/tax-brackets.js';
import { stateFromZip } from '../data/state-from-zip.js';

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
  const gross = Math.max(0, state.salary || 0);
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
 * Optional online enhancement stub.
 * Returns null when offline / blocked; Engine ignores and uses static.
 */
export async function fetchLiveTaxHint(year) {
  // Hook: replace with IRS / Tax Foundation endpoint when available.
  // Example:
  //   const res = await fetch(`https://…/brackets/${year}.json`);
  //   if (res.ok) return await res.json();
  return null;
}
