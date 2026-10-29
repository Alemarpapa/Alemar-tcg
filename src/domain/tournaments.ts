import type { Tournament } from './schemas';

export interface TournamentPnL {
  costs: number;
  cashRevenue: number;
  productRevenue: number;
  revenue: number;
  net: number;
  /** Net / costs. null when there were no costs (ROI undefined). */
  roi: number | null;
}

export function tournamentPnL(t: Tournament): TournamentPnL {
  const costs = t.entryFee + t.travelCost + t.otherCosts;
  const productRevenue = t.productPrizes.reduce((acc, p) => acc + p.quantity * p.unitValue, 0);
  const revenue = t.cashPrize + productRevenue;
  const net = revenue - costs;
  return {
    costs,
    cashRevenue: t.cashPrize,
    productRevenue,
    revenue,
    net,
    roi: costs > 0 ? net / costs : null,
  };
}

export interface SeasonSummary extends TournamentPnL {
  count: number;
  profitable: number;
  bestStanding: number | null;
  avgPercentile: number | null;
}

export function seasonSummary(tournaments: Tournament[]): SeasonSummary {
  let costs = 0, cashRevenue = 0, productRevenue = 0, profitable = 0;
  let bestStanding: number | null = null;
  const percentiles: number[] = [];
  for (const t of tournaments) {
    const p = tournamentPnL(t);
    costs += p.costs;
    cashRevenue += p.cashRevenue;
    productRevenue += p.productRevenue;
    if (p.net > 0) profitable += 1;
    if (t.standing !== undefined) {
      bestStanding = bestStanding === null ? t.standing : Math.min(bestStanding, t.standing);
      if (t.players) percentiles.push(t.standing / t.players);
    }
  }
  const revenue = cashRevenue + productRevenue;
  const net = revenue - costs;
  return {
    count: tournaments.length,
    profitable,
    bestStanding,
    avgPercentile: percentiles.length ? percentiles.reduce((a, b) => a + b, 0) / percentiles.length : null,
    costs,
    cashRevenue,
    productRevenue,
    revenue,
    net,
    roi: costs > 0 ? net / costs : null,
  };
}

export function formatRoi(roi: number | null): string {
  if (roi === null) return '—';
  const pct = Math.round(roi * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${pct.toString().replace('.', ',')}%`;
}
