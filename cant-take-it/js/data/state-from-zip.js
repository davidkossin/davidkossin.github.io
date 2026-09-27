/**
 * Approximate US state from ZIP prefix.
 * Offline static map — replace/enhance with live geocoding later.
 * Returns { state, abbr, stateIncomeTaxApprox } for tax estimates.
 */

const PREFIX_RANGES = [
  // [lo, hi, abbr, name, approx flat/effective state income tax rate]
  [0, 59, 'MA', 'Massachusetts', 0.05],
  [60, 69, 'PR', 'Puerto Rico', 0.0],
  [70, 89, 'VI', 'Virgin Islands', 0.0],
  [100, 149, 'NY', 'New York', 0.0685],
  [150, 196, 'PA', 'Pennsylvania', 0.0307],
  [197, 199, 'DE', 'Delaware', 0.066],
  [200, 205, 'DC', 'District of Columbia', 0.085],
  [206, 219, 'MD', 'Maryland', 0.0575],
  [220, 246, 'VA', 'Virginia', 0.0575],
  [247, 269, 'WV', 'West Virginia', 0.065],
  [270, 289, 'NC', 'North Carolina', 0.0475],
  [290, 299, 'SC', 'South Carolina', 0.064],
  [300, 319, 'GA', 'Georgia', 0.055],
  [320, 349, 'FL', 'Florida', 0.0],
  [350, 369, 'AL', 'Alabama', 0.05],
  [370, 385, 'TN', 'Tennessee', 0.0],
  [386, 397, 'MS', 'Mississippi', 0.05],
  [400, 427, 'KY', 'Kentucky', 0.045],
  [430, 459, 'OH', 'Ohio', 0.035],
  [460, 479, 'IN', 'Indiana', 0.0315],
  [480, 499, 'MI', 'Michigan', 0.0425],
  [500, 528, 'IA', 'Iowa', 0.057],
  [530, 549, 'WI', 'Wisconsin', 0.0765],
  [550, 567, 'MN', 'Minnesota', 0.0785],
  [570, 577, 'SD', 'South Dakota', 0.0],
  [580, 588, 'ND', 'North Dakota', 0.029],
  [590, 599, 'MT', 'Montana', 0.0675],
  [600, 629, 'IL', 'Illinois', 0.0495],
  [630, 658, 'MO', 'Missouri', 0.048],
  [660, 679, 'KS', 'Kansas', 0.057],
  [680, 693, 'NE', 'Nebraska', 0.0664],
  [700, 715, 'LA', 'Louisiana', 0.0425],
  [716, 729, 'AR', 'Arkansas', 0.049],
  [730, 749, 'OK', 'Oklahoma', 0.0475],
  [750, 799, 'TX', 'Texas', 0.0],
  [800, 816, 'CO', 'Colorado', 0.044],
  [820, 831, 'WY', 'Wyoming', 0.0],
  [832, 838, 'ID', 'Idaho', 0.058],
  [840, 847, 'UT', 'Utah', 0.0465],
  [850, 865, 'AZ', 'Arizona', 0.025],
  [870, 884, 'NM', 'New Mexico', 0.059],
  [889, 898, 'NV', 'Nevada', 0.0],
  [900, 961, 'CA', 'California', 0.093],
  [967, 968, 'HI', 'Hawaii', 0.0825],
  [970, 979, 'OR', 'Oregon', 0.099],
  [980, 994, 'WA', 'Washington', 0.0],
  [995, 999, 'AK', 'Alaska', 0.0],
];

/**
 * @param {string|number} zip
 * @returns {{ state: string, abbr: string, stateIncomeTaxApprox: number }}
 */
export function stateFromZip(zip) {
  const digits = String(zip || '').replace(/\D/g, '').padStart(5, '0').slice(0, 5);
  const prefix = parseInt(digits.slice(0, 3), 10);
  if (Number.isNaN(prefix)) {
    return { state: 'Unknown', abbr: 'XX', stateIncomeTaxApprox: 0.05 };
  }
  for (const [lo, hi, abbr, name, rate] of PREFIX_RANGES) {
    if (prefix >= lo && prefix <= hi) {
      return { state: name, abbr, stateIncomeTaxApprox: rate };
    }
  }
  return { state: 'Unknown', abbr: 'XX', stateIncomeTaxApprox: 0.05, zip: digits };
}

export function formatZip(zip) {
  return String(zip || '').replace(/\D/g, '').slice(0, 5).padStart(5, '0');
}
