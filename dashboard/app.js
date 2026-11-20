// Momentum Radar dashboard. Reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, filters, a per-protocol detail drawer with the model's
// own inputs and the protocol's farm plan, plus a momentum leaders panel. No network:
// every byte it shows is in data.js. The page recomputes each row's headline number
// from the snapshot figures it carries, so the page's arithmetic and the board's data
// are visibly the same.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = {
    q: '', category: 'all', chain: 'all', tvl: 0, watchlist: false,
    tab: 'pre-token', sort: 'value', dir: -1, selected: null
  };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (k === 'checked') node.checked = !!attrs[k];
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The model in one function: base value times the momentum and age multipliers.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.base_value_usd * row.growth_multiplier * row.age_multiplier));
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tvl')) state.tvl = Number(params.get('tvl')) || 0;
    if (params.get('wl') === '1') state.watchlist = true;
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tvl) params.set('tvl', String(state.tvl));
    if (state.watchlist) params.set('wl', '1');
    if (state.sort !== 'value') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function isWatchlist(r) { return r.tvl_usd >= DATA.floor_usd; }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.tvl && r.tvl_usd < state.tvl) return false;
      if (state.watchlist && !isWatchlist(r)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'base') { av = a.base_value_usd; bv = b.base_value_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'cost') { av = a.farm_cost_usd; bv = b.farm_cost_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Momentum Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Follow the growth, not just the size' }),
        el('p', { text: 'A protocol whose TVL rose 40% in a week is worth chasing harder than one of the same size that shrank. This board multiplies each protocol\u2019s TVL by the median market-cap/TVL ratio of token-bearing protocols, then lifts fast growers and trims decliners with a momentum factor. The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Median mcap / TVL' }), el('b', { text: String(DATA.median_ratio) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chain = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); render(); });
    var tvl = el('select', { id: 'tvl', 'aria-label': 'Filter by minimum TVL' },
      [[0, 'Any TVL'], [50e6, 'TVL \u2265 $50M'], [100e6, 'TVL \u2265 $100M'], [500e6, 'TVL \u2265 $500M'], [1e9, 'TVL \u2265 $1B']].map(function (o) {
        return el('option', { value: String(o[0]), text: o[1], selected: state.tvl === o[0] ? 'selected' : null });
      })
    );
    tvl.addEventListener('change', function () { state.tvl = Number(tvl.value); writeHash(); render(); });
    var sort = el('select', { id: 'sort', 'aria-label': 'Sort the board' },
      [['value', 'Implied value'], ['base', 'Base value'], ['tvl', 'TVL'], ['growth', '7-day growth'], ['age', 'Age'], ['cost', 'Farm cost'], ['name', 'Name']].map(function (o) {
        return el('option', { value: o[0], text: o[1], selected: state.sort === o[0] ? 'selected' : null });
      })
    );
    sort.addEventListener('change', function () { state.sort = sort.value; state.dir = state.sort === 'name' || state.sort === 'cost' ? 1 : -1; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'wl', checked: state.watchlist });
    wl.addEventListener('change', function () { state.watchlist = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chain),
      el('div', { class: 'field' }, el('label', { for: 'tvl', text: 'TVL' }), tvl),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort by' }), sort),
      el('label', { class: 'check', for: 'wl' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = (key === 'name' || key === 'cost') ? 1 : -1; } writeHash(); render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u25bc' : ' \u25b2' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category, chain or TVL to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tvl = 0; state.watchlist = false; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var mom = r.change_7d === null ? null : el('span', { class: 'mom ' + (r.change_7d >= 0 ? 'up' : 'down'), text: (r.change_7d >= 0 ? 'rising' : 'falling') });
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: '$' + r.farm_cost_usd.toFixed(2) }),
        el('td', null, el('div', { class: 'val-cell' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'val', text: money(r.implied_value_usd) })
        ), mom),
        el('td', null, el('span', { class: 'status', text: isWatchlist(r) ? 'watchlist' : 'early' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, best growth-adjusted implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('value', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('cost', 'Farm cost'),
            sortHeader('value', 'Implied value'),
            el('th', { scope: 'col', text: 'Set' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel section' },
      el('h2', { text: 'How the ranking is computed' }),
      el('div', { class: 'formula' },
        'base value = tvl_usd x ' + DATA.median_ratio + ' (median mcap/TVL of token-bearing protocols)'
      ),
      el('div', { class: 'formula' }, 'momentum = 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight),
      el('div', { class: 'formula' }, 'age factor = ' + m.age_floor + ' + min(age_days, ' + m.age_days + ') / ' + m.age_days + ' x ' + m.age_range),
      el('div', { class: 'formula' }, 'implied value = round(base value x momentum x age factor)'),
      el('p', { text: 'Growth is the whole point: a protocol that grew 40% in a week gets a momentum factor of 1.24, one that shrank 20% gets 0.88. Age is a small stabiliser only — 0.85 for a brand-new listing, 1.00 at two years, and an unknown listing date uses ' + m.unknown_age_days + ' days. No protocol name is special-cased, and no row is hand-picked.' }),
      el('p', { text: 'Implied value is a model, not a price prediction: it says what a token might be worth if the market priced this protocol like the median token-bearing protocol, adjusted for how fast it is growing. Airdrops are never guaranteed.' })
    );
  }

  function leadersPanel() {
    var leaders = DATA.rows.slice().sort(function (a, b) {
      var av = a.change_7d === null ? -Infinity : a.change_7d;
      var bv = b.change_7d === null ? -Infinity : b.change_7d;
      return bv - av;
    }).slice(0, 5);
    return el('section', { class: 'panel section' },
      el('h2', { text: 'Fastest growers this week' }),
      el('p', { text: 'The five board rows with the largest 7-day TVL change. Momentum lifts them, but a single hot week is not a promise — check the detail view before you farm.' }),
      el('table', { class: 'mini-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Rank' }), el('th', { text: 'Protocol' }), el('th', { text: '7d growth' }), el('th', { text: 'Implied value' }))),
        el('tbody', null, leaders.map(function (r) {
          return el('tr', { onclick: function () { openDetail(r.slug); } },
            el('td', { text: '#' + r.rank }),
            el('td', null, el('b', { text: r.name })),
            el('td', { class: r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg', text: fmtPct(r.change_7d) }),
            el('td', { text: money(r.implied_value_usd) })
          );
        }))
      )
    );
  }

  function costPanel() {
    var entries = Object.entries(DATA.gas_table).sort(function (a, b) { return a[1] - b[1] || (a[0] < b[0] ? -1 : 1); });
    return el('section', { class: 'panel section' },
      el('h2', { text: 'Farm cost table' }),
      el('p', { text: 'Estimated all-in cost of one farm step per chain (gas plus the usual swap/pool fee and slippage allowance for a small position). These are planning estimates, not live prices — gas moves, and the ranking uses them only to show what a farm plan costs. A chain the table does not name costs $' + DATA.gas_default_usd.toFixed(2) + ' a step.' }),
      el('table', { class: 'mini-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Chain' }), el('th', { text: 'Est. cost / step' }))),
        el('tbody', null, entries.map(function (e) {
          return el('tr', null, el('td', { text: e[0] }), el('td', { text: '$' + e[1].toFixed(2) }));
        }))
      )
    );
  }

  var drawer = el('aside', { class: 'drawer', id: 'detail', hidden: true, 'aria-label': 'Protocol detail' });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    drawer.hidden = false;
    drawer.textContent = '';
    var perStep = row.farm_steps.length ? (row.farm_cost_usd / row.farm_steps.length) : 0;
    drawer.appendChild(el('div', { class: 'drawer-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (isWatchlist(row) ? ' · watchlist' : ' · early radar') }),
        el('h2', { text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { closeDetail(); } })
    ));
    drawer.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Implied value breakdown' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Median mcap / TVL' }), el('b', { class: 'num', text: String(DATA.median_ratio) })),
        el('div', null, el('span', { text: 'Base value (TVL x ratio)' }), el('b', { class: 'num', text: fmtUsd(row.base_value_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Momentum multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Age multiplier' }), el('b', { class: 'num', text: String(row.age_multiplier) })),
        el('div', null, el('span', { text: 'Growth-adjusted implied value' }), el('b', { class: 'big', text: money(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. Recomputed in this page as ' + money(impliedOf(row)) + (impliedOf(row) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') })
    ));
    drawer.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Farm cost' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Main chain' }), el('b', { class: 'num', text: (row.chains && row.chains.length ? row.chains[0] : 'n/a') })),
        el('div', null, el('span', { text: 'Farm steps' }), el('b', { class: 'num', text: String(row.farm_steps.length) })),
        el('div', null, el('span', { text: 'Est. cost per step' }), el('b', { class: 'num', text: '$' + perStep.toFixed(2) })),
        el('div', null, el('span', { text: 'Total farm cost' }), el('b', { class: 'num', text: '$' + row.farm_cost_usd.toFixed(2) }))
      )
    ));
    drawer.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    drawer.focus();
  }

  function closeDetail() {
    state.selected = null;
    drawer.hidden = true;
    writeHash();
    render();
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      shell.appendChild(el('div', { class: 'two-col' }, leadersPanel(), costPanel()));
      shell.appendChild(modelPanel());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!drawer.isConnected) app.appendChild(drawer);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hidden) closeDetail();
  });
})();
