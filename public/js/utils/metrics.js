import { getVisits } from '../stores/visitsStore.js';
import { getSales } from '../stores/salesStore.js';

export async function countVisitsLast30d() {
  const visits = await getVisits();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return visits.filter((v) => {
    const at = new Date(v.at).getTime();
    return !isNaN(at) && at >= cutoff;
  }).length;
}

export function sumSalesLast30d() {
  const sales = getSales();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return sales
    .filter((s) => {
      const at = new Date(s.createdAt).getTime();
      return !isNaN(at) && at >= cutoff;
    })
    .reduce((sum, s) => sum + (parseFloat(s.tons) || 0), 0);
}
