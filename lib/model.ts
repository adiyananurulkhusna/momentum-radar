// Momentum Radar: rank pre-token protocols by growth-adjusted implied value.
//
// One snapshot of the protocol universe in, one ranked board out. The board covers every
// slug in the snapshot's watchlist (the floor, never a ceiling) and adds 160 pre-token
// protocols below the watchlist floor, by TVL: the early rows the radar exists to find.
// A protocol is pre-token when its index entry records no token (no market cap, no
// CoinGecko id, no symbol); live-token protocols are kept apart and shown with the
// market's own values, never mixed into the ranked board.
//
// The model, in one line per row:
//
//   base value   = tvl_usd x median(mcap_usd / tvl_usd over token-bearing protocols)
//   momentum     = 1 + 0.6 x clamp(change_7d, -40, +80) / 100
//   age factor   = 0.85 + min(age_days, 730) / 730 x 0.15
//   implied      = round(base value x momentum x age factor)
//
// The median ratio is computed from the snapshot itself on every run, never hard-coded.
// Growth is the whole point of this radar: a protocol whose TVL rose 40% in a week is
// worth chasing harder than one of the same size that shrank, so the momentum factor
// lifts fast growers and trims decliners. Age is a small stabiliser only — a protocol
// that has run two years with no token counts slightly more than one listed last month.
// No protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  age_floor: number;
  age_range: number;
  age_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -40,
  growth_cap: 80,
  age_floor: 0.85,
  age_range: 0.15,
  age_days: 730,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'momentum-1';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/**
 * Estimated all-in cost of ONE farm step (gas plus the usual swap/pool fee and slippage
 * allowance for a small position) on each chain, in whole US dollars. These are rough
 * planning estimates written by hand, not live prices: gas moves, and a step on Ethereum
 * costs far more than the same step on a cheap chain. Treat every figure here as an
 * estimate, never as a quote. Chains the table does not name cost $1.00 a step.
 */
export const GAS_USD_PER_STEP: Record<string, number> = {
  Ethereum: 6.0,
  Bitcoin: 2.5,
  Solana: 0.6,
  Binance: 0.8,
  Base: 0.9,
  Arbitrum: 1.2,
  Optimism: 1.0,
  Polygon: 0.5,
  Avalanche: 1.5,
  Sui: 0.6,
  Aptos: 0.6,
  Sei: 0.6,
  'Hyperliquid L1': 0.8,
  Ink: 0.9,
  Tron: 1.0,
  Monad: 0.6,
  Stellar: 0.4,
  Ripple: 0.4,
  Flare: 0.6,
  Starknet: 1.5,
  'zkSync Era': 1.0,
  Linea: 0.8,
  Scroll: 0.8,
  Mantle: 0.7,
  Berachain: 0.8,
  Unichain: 0.9,
  'World Chain': 0.8,
  Sonic: 0.7,
  Fantom: 0.7,
  Gnosis: 0.6,
  Cronos: 0.8,
  Kava: 0.7,
  Near: 0.5,
  Cosmos: 0.6,
  Osmosis: 0.6,
  TON: 0.5,
};

/** The fallback per-step estimate for a chain the table does not name. */
export const GAS_DEFAULT_USD = 1.0;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  /** Growth-adjusted implied value, whole dollars. The ranked column. */
  implied_value_usd: number;
  /** TVL x median ratio before the momentum and age factors, whole dollars. */
  base_value_usd: number;
  /** What running the farm plan costs, in dollars. */
  farm_cost_usd: number;
  model: {
    median_ratio: number;
    growth_pct: number;
    growth_multiplier: number;
    age_multiplier: number;
    farm_cost_usd: number;
    farm_steps: number;
    base_value_usd: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_value_usd: number;
  farm_cost_usd: number;
  growth_multiplier: number;
  age_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  median_ratio: number;
  gas_table: Record<string, number>;
  gas_default_usd: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The median market-cap/TVL ratio across every protocol in the snapshot that already has a
 * token with a market cap. The middle of the market, not its loudest corner: the mean is
 * dragged up by a few tiny-TVL tokens with huge caps, the median is not.
 */
export function medianMcapTvl(snapshot: Snapshot): number {
  const ratios = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => (p.mcap_usd as number) / p.tvl_usd)
    .sort((a, b) => a - b);
  if (ratios.length === 0) return 0;
  const mid = Math.floor(ratios.length / 2);
  return ratios.length % 2 === 1 ? ratios[mid]! : (ratios[mid - 1]! + ratios[mid]!) / 2;
}

/**
 * The multipliers and the implied value one protocol gets under `model`, given the snapshot's
 * median market-cap/TVL ratio. Growth is clamped to -40%..+80% and weighted 0.6, so a single
 * wild week moves the score but cannot dominate it; the age factor rises gently from 0.85
 * for a brand-new listing to 1.00 at two years.
 */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  medianRatio: number,
): { implied: number; baseValue: number; growthPct: number; growthMult: number; ageMult: number; farmCost: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  // Round the multipliers first: the dashboard recomputes the headline number from the
  // same rounded figures it carries, so its arithmetic and the board's data agree exactly.
  const growthMult = round4(1 + (growthPct / 100) * model.growth_weight);
  const ageForModel = age ?? model.unknown_age_days;
  const ageMult = round4(model.age_floor + (Math.min(Math.max(ageForModel, 0), model.age_days) / model.age_days) * model.age_range);
  const baseValue = Math.max(1, Math.round(protocol.tvl_usd * medianRatio));
  const implied = Math.max(1, Math.round(baseValue * growthMult * ageMult));
  const steps = farmSteps(protocol, age).length;
  const farmCost = round2(gasPerStepUsd(protocol) * steps);
  return { implied, baseValue, growthPct, growthMult, ageMult, farmCost, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const medianRatio = medianMcapTvl(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot,
  // but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a
  // replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, medianRatio);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    base_value_usd: s.v.baseValue,
    farm_cost_usd: s.v.farmCost,
    model: {
      median_ratio: round4(medianRatio),
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      age_multiplier: round4(s.v.ageMult),
      farm_cost_usd: s.v.farmCost,
      farm_steps: farmSteps(s.p, s.v.age).length,
      base_value_usd: s.v.baseValue,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
export function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The estimated all-in cost of one farm step on the protocol's main chain. */
export function gasPerStepUsd(p: SnapshotProtocol): number {
  return GAS_USD_PER_STEP[chainOf(p)] ?? GAS_DEFAULT_USD;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * The category's core farm actions, in the words a farmer can follow. Each entry is one step's
 * action; the plan builder adds the shared setup, weekly, hold and claim steps around them.
 */
function coreActions(p: SnapshotProtocol, capital: number, chain: string): string[] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return [
      `Supply $${capital} of USDC to ${name} on ${chain} and keep the lending position open`,
      `Borrow a small amount against the deposit, then repay half of it the same week`,
      `Vote on one governance proposal, or join the protocol's points quest if it has one`,
    ];
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return [
      `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open`,
      `Swap a small amount through ${name} once a week so the wallet shows trading activity`,
      `Stake the LP receipt if ${name} offers a gauge or farm for it`,
    ];
  }
  if (c.includes('bridge') || c.includes('canonical bridge')) {
    return [
      `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app`,
      `Bridge a second, smaller amount back the following week to show two-way use`,
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt`,
      `Restake or delegate the receipt once more if ${name} offers a second layer`,
    ];
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return [
      `Deposit $${capital} of USDC as margin on ${name} and open one small hedge`,
      `Close and reopen a small position once a week to show steady trading`,
      `Place one limit order as well as the market order, so both order types appear`,
    ];
  }
  if (c.includes('prediction')) {
    return [
      `Fund $${capital} and place one market position on ${name}`,
      `Settle or roll the position once a week and open a fresh one`,
    ];
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return [
      `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares`,
      `Move a small part of the deposit to a second vault run by the same curator`,
    ];
  }
  if (c.includes('stable')) {
    return [
      `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}`,
      `Provide the minted asset as liquidity in the protocol's own pool`,
    ];
  }
  if (c.includes('rwa')) {
    return [
      `Mint $${capital} of the protocol's yield asset on ${chain} and hold it`,
      `Use the yield asset as collateral in one lending market that accepts it`,
    ];
  }
  if (c.includes('insurance')) {
    return [
      `Buy $${capital} of cover from ${name} on ${chain} and keep the policy`,
      `Renew or extend the cover once before it lapses`,
    ];
  }
  if (c.includes('yield')) {
    return [
      `Deposit $${capital} into ${name}'s highest-TVL vault on ${chain} and keep the shares`,
      `Harvest or compound the yield once a week instead of letting it sit`,
      `Split a small part of the deposit into a second vault on the same protocol`,
    ];
  }
  if (c.includes('farm')) {
    return [
      `Deposit $${capital} into ${name}'s main farm on ${chain} and keep the position open`,
      `Harvest the farm rewards once a week and compound them back into the farm`,
      `Try a second pool on the same protocol with a small part of the deposit`,
    ];
  }
  return [
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open`,
    `Make one swap or interaction inside ${name}'s app each week`,
  ];
}

/**
 * A protocol's farm plan: 5 to 8 steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written
 * list of names. Every step carries its estimated cost, so the plan's total is the farm cost
 * the dashboard shows beside the ranking.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasPerStepUsd(p);
  const gasStr = `about $${gas.toFixed(2)} of gas and fees`;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, fund it on ${chain}, and keep its seed phrase offline.`,
      cost: gasStr,
      time: '5 minutes',
    },
  ];
  for (const action of coreActions(p, capital, chain)) {
    steps.push({ text: `${action}.`, cost: gasStr, time: '15 minutes to set up' });
  }
  steps.push(
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, so the wallet stays active.`,
      cost: gasStr,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  );
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan included. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_value_usd: row.base_value_usd,
    farm_cost_usd: row.farm_cost_usd,
    growth_multiplier: row.model.growth_multiplier,
    age_multiplier: row.model.age_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    median_ratio: round4(medianMcapTvl(snapshot)),
    gas_table: GAS_USD_PER_STEP,
    gas_default_usd: GAS_DEFAULT_USD,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
