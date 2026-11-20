# Momentum Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/adiyananurulkhusna/momentum-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/adiyananurulkhusna/momentum-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

**Momentum Radar** ranks pre-token protocols by growth-adjusted implied value —
not by size alone. A protocol whose TVL rose 40% in a week is worth chasing harder
than one of the same size that shrank, so this board multiplies each protocol's
TVL by the median market-cap/TVL ratio of token-bearing protocols, then lifts fast
growers and trims decliners with a momentum factor. This entry is for the make.fun
bounty **token-radar-01** ("Build the best token launch radar", $1,325), scored
against the frozen DefiLlama snapshot of 2026-11-14.

## The model

Every row is scored by the same function, from the snapshot's own figures. No protocol
name is special-cased and no row is hand-picked.

**1. Base value.** Take the protocol's TVL and multiply it by the median
market-cap/TVL ratio of the protocols in the snapshot that already have a token
(computed from the snapshot on every run — in this snapshot the median is about 0.20).
The median, not the mean, because a few tiny-TVL tokens with huge caps drag the mean
far above the typical protocol.

**2. Momentum.** The 7-day TVL change, clamped to −40%…+80% and weighted by 0.6:

```
momentum = 1 + clamp(change_7d, -40, +80) / 100 × 0.6
```

A protocol that grew 40% in a week gets a momentum factor of 1.24; one that shrank
20% gets 0.88. One wild week moves the score but cannot dominate it, because the
clamp and the 0.6 weight cap the swing.

**3. Age factor.** A protocol that has run longer with no token counts slightly more:

```
age factor = 0.85 + min(age in days, 730) / 730 × 0.15
```

0.85 for a brand-new listing, 1.00 at two years. An unknown listing date counts as
365 days. Age is a small stabiliser only — growth does the ranking work.

**4. The ranked column.**

```
implied_value_usd = round(base value × momentum × age factor)
```

Rows are sorted by that number, highest first.

## Coverage

- The board covers **all 40 watchlist slugs** (TVL ≥ $50M, no token on record), plus
  160 pre-token protocols below the floor, picked by TVL — 200 rows in total.
- Protocols that already have a token are set aside in a separate "Live token" view
  with their real market caps, never mixed into the ranking.
- Exchanges, versioned pools and wrapped/staked products are not ranked.

## The dashboard

`dashboard/` is a static page with no network and no build step: it reads `data.js`,
which `main.ts` writes from the same board.

- Search by name, category or chain; filter by category, chain and minimum TVL;
  a watchlist-only toggle; sorts by implied value, base value, TVL, 7-day growth,
  age, farm cost and name.
- A **detail drawer** per protocol: the model's full breakdown (TVL, median ratio,
  base value, momentum and age multipliers, growth-adjusted implied value), the farm
  cost, and the step-by-step farm plan with its estimated cost per step.
- A **fastest growers** panel: the five board rows with the largest 7-day TVL change.
- A **farm cost table** with the per-step estimate for every chain.

## How to run

Node 22, standard library only — nothing to install:

```sh
node main.ts --input /path/to/snapshot.json --output ./out
```

This writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/`
and `out/dossier.json`. Then open `out/dashboard/index.html` in a browser. The
program exits non-zero if the board fails the gate (missing watchlist slugs, wrong
order, bad farm steps, or fewer than 3 screenshots).

## Caveats

- **Implied value is a model, not a price prediction.** It says what a token might
  be worth *if* the market priced this protocol like the median token-bearing
  protocol today, adjusted for how fast it is growing. It is not a forecast of any
  token's price, and an airdrop is never guaranteed: a protocol may never issue a
  token at all.
- Farm costs are estimates, not live gas prices. Check the real cost before you
  spend anything, use a fresh wallet that holds only what you plan to farm, and
  never pay anyone to claim an airdrop — claim only from links the protocol itself
  publishes.
- The snapshot is frozen at 2026-11-14. Protocols change; this board does not move
  with them.
