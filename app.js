/* Zambux Admin (web). Plain JavaScript, no build step.
   - Real mode: signs in with an admin account and calls the admin-only database functions.
   - Sample mode (add ?demo=1 to the address): fake data for looking at the layout. It never touches the database. */
(function () {
  'use strict';

  var DEMO = /[?&]demo=1/.test(location.search);
  var GOAL_HOURS = 48;
  var METHODS = [
    ['phone_callback', 'Phone call back'], ['public_listing', 'Public listing matches'], ['domain_email', 'Email on the business domain'],
    ['storefront_photo', 'Storefront photo'], ['documents', 'Documents'], ['in_person', 'Seen in person'], ['postcard', 'Postcard'], ['other', 'Other']
  ];
  var VERTICALS = { food_drink: 'Food & Drink' };

  // ---------- small helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(cents) { var d = (cents || 0) / 100; return '$' + d.toLocaleString('en-US', { minimumFractionDigits: d % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function num(n) { return (n || 0).toLocaleString('en-US'); }
  function vname(v) { return VERTICALS[v] || String(v || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function hoursText(h) { if (h == null) return ''; if (h < 1) return 'under 1 hour'; if (h < 48) return h + ' hour' + (h === 1 ? '' : 's'); var d = Math.round(h / 24); return d + ' day' + (d === 1 ? '' : 's'); }
  function dateText(iso) { if (!iso) return 'never'; return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function friendly(e) {
    var t = (e && (e.message || e.code) ? e.message || e.code : String(e)).toLowerCase();
    if (t.indexOf('not_admin') >= 0) return 'This account is not an admin.';
    if (t.indexOf('evidence_required') >= 0 || t.indexOf('methods_required') >= 0) return 'Pick at least one thing you checked before approving.';
    if (t.indexOf('reason_required') >= 0) return 'Add a short reason first.';
    if (t.indexOf('not_found_or_verified') >= 0) return 'That business is already approved or no longer exists.';
    if (t.indexOf('invalid login') >= 0) return 'That email and password do not match.';
    if (t.indexOf('failed to fetch') >= 0 || t.indexOf('network') >= 0) return "Can't reach Zambux. Check your connection.";
    return (e && e.message) || 'Something went wrong.';
  }
  var $app = document.getElementById('app');
  var state = { user: null, overview: null, list: null, loading: false, error: null, drawer: null, notice: null };

  // ---------- data: real ----------
  var sb = null;
  var api = {
    overview: function () { return sb.rpc('admin_overview').then(unwrap); },
    list: function (f) {
      return sb.rpc('admin_list_businesses', {
        p_search: f.q || null, p_status: f.status, p_plan: f.plan, p_vertical: f.vertical, p_view: f.view,
        p_sort: f.sort, p_limit: f.size, p_offset: (f.page - 1) * f.size
      }).then(unwrap);
    },
    approve: function (id, methods, notes) { return sb.rpc('admin_log_verification', { p_business_id: id, p_action: 'approved', p_methods: methods, p_notes: notes || null }).then(unwrap); },
    unverify: function (id, reason) { return sb.rpc('admin_log_verification', { p_business_id: id, p_action: 'unverified', p_methods: [], p_notes: reason }).then(unwrap); },
    reject: function (id, reason) { return sb.rpc('admin_reject_business', { p_business_id: id, p_reason: reason }).then(unwrap); },
    setTier: function (id, tier) { return sb.rpc('admin_set_tier', { p_business_id: id, p_tier: tier }).then(unwrap); }
  };
  function unwrap(res) { if (res.error) throw res.error; return res.data; }

  // ---------- data: sample (layout only) ----------
  var demoRows = null;
  function buildDemo() {
    var names = ['La Cantina', 'Smokehouse 512', 'Pie Society', 'Brunch Club', 'Corner Taqueria', 'Barton Springs Barbers', 'South Lamar Yoga', 'Hyde Park Bakery', 'East 6th Tattoo', 'Mueller Smoothies', 'Zilker Climbing Gym', 'Clarksville Hardware', 'Rainey Street Ramen', 'Domain Nails', 'Lakeline Pizza', 'Allandale Books', 'Cherrywood Coffee', 'Travis Heights Tacos'];
    var plans = ['free', 'free', 'starter', 'pro', 'free'];
    var rows = [], now = Date.now();
    for (var i = 0; i < 137; i++) {
      var pending = i < 6 || i % 23 === 0, name = names[i % names.length] + (i >= names.length ? ' ' + (Math.floor(i / names.length) + 1) : '');
      var hrs = pending ? (i < 6 ? [41, 30, 14, 9, 5, 2][i] : 3 + ((i * 7) % 40)) : null;
      var plan = pending ? 'free' : plans[i % plans.length];
      var deals = pending ? 0 : (i % 7 === 0 ? 0 : 3 + (i % 9)), grabs = deals * 5, red = Math.round(grabs * (0.6 + (i % 5) * 0.07));
      rows.push({
        id: 'demo-' + i, name: name, street: (100 + i * 7) + ' S Congress Ave', zip: ['78704', '78701', '78702', '78751'][i % 4], city: 'Austin',
        vertical: i % 6 === 0 ? 'fitness' : (i % 5 === 0 ? 'beauty_wellness' : 'food_drink'), categories: ['Tacos'], verified: !pending, plan: plan, regulated_approved: false,
        created_at: new Date(now - (pending ? hrs * 3600e3 : (30 + i * 5) * 86400e3)).toISOString(),
        owner_email: name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14) + '@example.com', deals_30d: deals, grabs_30d: grabs, redeemed_30d: red,
        last_deal_at: deals ? new Date(now - 86400e3 * (i % 20)).toISOString() : null, wants_plan: (i % 4 === 0 && plan === 'free') ? ['pro'] : [],
        mrr_cents: plan === 'pro' ? 9900 : plan === 'starter' ? 4900 : 0, show_up_pct: grabs ? Math.round(100 * red / Math.max(grabs - 1, 1)) : null, waiting_hours: hrs
      });
    }
    return rows;
  }
  function demoFilter(f) {
    var r = demoRows.filter(function (b) {
      if (f.status === 'approved' && !b.verified) return false;
      if (f.status === 'pending' && b.verified) return false;
      if (f.plan !== 'all' && b.plan !== f.plan) return false;
      if (f.vertical !== 'all' && b.vertical !== f.vertical) return false;
      if (f.view === 'pending' && b.verified) return false;
      if (f.view === 'waiting_24h' && !(!b.verified && b.waiting_hours >= 24)) return false;
      if (f.view === 'wants_plan' && !b.wants_plan.length) return false;
      if (f.view === 'dormant_30d' && !(b.verified && b.deals_30d === 0)) return false;
      if (f.q) { var q = f.q.toLowerCase(); if (!(b.name.toLowerCase().indexOf(q) >= 0 || b.owner_email.indexOf(q) >= 0 || b.street.toLowerCase().indexOf(q) >= 0 || b.zip.indexOf(q) === 0)) return false; }
      return true;
    });
    r.sort(function (a, b) {
      if (f.sort === 'name') return a.name.localeCompare(b.name);
      if (f.sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (f.sort === 'waiting') return (b.verified ? 0 : 1) - (a.verified ? 0 : 1) || new Date(a.created_at) - new Date(b.created_at);
      if (f.sort === 'active') return b.deals_30d - a.deals_30d;
      if (f.sort === 'revenue') return b.mrr_cents - a.mrr_cents;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return r;
  }
  function demoApi() {
    demoRows = buildDemo();
    var p = function (v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 120); }); };
    return {
      overview: function () {
        var all = demoRows, pend = all.filter(function (b) { return !b.verified; }), by = function (pl) { return all.filter(function (b) { return b.plan === pl; }).length; };
        var mrr = by('starter') * 4900 + by('pro') * 9900, ind = {};
        all.forEach(function (b) { ind[b.vertical] = ind[b.vertical] || { vertical: b.vertical, businesses: 0, mrr_cents: 0 }; ind[b.vertical].businesses++; ind[b.vertical].mrr_cents += b.mrr_cents; });
        var interest = all.filter(function (b) { return b.wants_plan.length; });
        return p({
          businesses: { total: all.length, approved: all.length - pend.length, pending: pend.length }, by_plan: { free: by('free'), starter: by('starter'), pro: by('pro') },
          projected_mrr_cents: mrr, prices: { starter: 4900, pro: 9900 }, plan_interest: { businesses: interest.length, starter: 0, pro: interest.length, value_cents: interest.length * 9900 },
          activity_30d: { deals: 412, grabs: 2210, redeemed: 1790, settled: 2204 }, open_reports: 2,
          queue: pend.sort(function (a, b) { return b.waiting_hours - a.waiting_hours; }).slice(0, 8).map(function (b) { return { id: b.id, name: b.name, vertical: b.vertical, zip: b.zip, owner_email: b.owner_email, waiting_hours: b.waiting_hours }; }),
          by_industry: Object.keys(ind).map(function (k) { return ind[k]; }).sort(function (a, b) { return b.businesses - a.businesses; }),
          by_city: [{ city: 'Austin', businesses: all.length, approved: all.length - pend.length, paying: by('starter') + by('pro'), mrr_cents: mrr }],
          funnel: { created: all.length, verified: all.length - pend.length, posted: Math.round(all.length * 0.72), redeemed: Math.round(all.length * 0.6), paying: by('starter') + by('pro') }
        });
      },
      list: function (f) { var r = demoFilter(f); return p({ total: r.length, rows: r.slice((f.page - 1) * f.size, f.page * f.size) }); },
      approve: function (id) { var b = demoRows.filter(function (x) { return x.id === id; })[0]; b.verified = true; b.waiting_hours = null; return p({}); },
      unverify: function (id) { var b = demoRows.filter(function (x) { return x.id === id; })[0]; b.verified = false; b.waiting_hours = 1; return p({}); },
      reject: function (id) { demoRows = demoRows.filter(function (x) { return x.id !== id; }); return p({}); },
      setTier: function (id, tier) { var b = demoRows.filter(function (x) { return x.id === id; })[0]; b.plan = tier; b.mrr_cents = tier === 'pro' ? 9900 : tier === 'starter' ? 4900 : 0; return p({}); }
    };
  }

  // ---------- routing (filters live in the address) ----------
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), parts = h.split('?'), page = parts[0] || 'overview', q = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var s = kv.split('='); q[decodeURIComponent(s[0])] = decodeURIComponent((s[1] || '').replace(/\+/g, ' ')); });
    return { page: page, q: q };
  }
  function filtersFromQ(q) {
    return { q: q.q || '', status: q.status || 'all', plan: q.plan || 'all', vertical: q.vertical || 'all', view: q.view || 'all', sort: q.sort || 'newest', size: parseInt(q.size, 10) || 25, page: Math.max(1, parseInt(q.page, 10) || 1) };
  }
  function go(page, q) {
    var parts = []; Object.keys(q || {}).forEach(function (k) { var v = q[k]; if (v !== '' && v != null && v !== 'all' && !(k === 'page' && v === 1) && !(k === 'size' && v === 25) && !(k === 'sort' && v === 'newest')) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
    var next = '#/' + page + (parts.length ? '?' + parts.join('&') : '');
    if (location.hash === next) route(); else location.hash = next;
  }

  // ---------- shell ----------
  function shell(active, body, extraHead) {
    var pend = state.overview ? state.overview.businesses.pending : '';
    var nav = [['overview', 'Overview'], ['businesses', 'Businesses'], ['queue', 'Verification queue'], ['revenue', 'Revenue']].map(function (n) {
      var href = n[0] === 'queue' ? '#/businesses?view=pending&sort=waiting' : '#/' + n[0];
      var badge = n[0] === 'queue' && pend ? '<span class="badge">' + esc(pend) + '</span>' : (n[0] === 'businesses' && state.overview ? '<span style="color:#C9D6EA;font-weight:500">' + num(state.overview.businesses.total) + '</span>' : '');
      return '<a href="' + href + '"' + (active === n[0] ? ' class="on"' : '') + '><span>' + n[1] + '</span>' + badge + '</a>';
    }).join('');
    return '<div class="shell"><aside class="side"><div class="brand">Zambux <span>Admin</span></div><nav class="nav" aria-label="Sections">' + nav + '</nav>' +
      '<div class="who">' + esc(state.user ? state.user.email : '') + '<br><button id="signout">Sign out</button></div></aside>' +
      '<main class="main"><div class="head"><div><h1>' + esc(extraHead.title) + '</h1><div class="sub">' + extraHead.sub + '</div></div>' +
      (DEMO ? '<div class="sample">Sample data. Nothing here is real, and nothing is saved.</div>' : '') + '</div>' +
      (state.notice ? '<div class="ok" role="status">' + esc(state.notice) + '</div>' : '') +
      (state.error ? '<div class="err" role="alert">' + esc(state.error) + '</div>' : '') + body + '</main></div>' + (state.drawer ? drawer(state.drawer) : '');
  }

  // ---------- pages ----------
  function overviewPage() {
    var o = state.overview;
    if (!o) return shell('overview', '<div class="card empty">Loading…</div>', { title: 'Overview', sub: '' });
    var settled = o.activity_30d.settled, rate = settled ? Math.round(100 * o.activity_30d.redeemed / settled) : null;
    var oldest = o.queue.length ? o.queue[0].waiting_hours : 0, late = o.queue.filter(function (q) { return q.waiting_hours >= GOAL_HOURS; }).length;
    var paying = o.by_plan.starter + o.by_plan.pro;
    var kpis = [
      ['Projected monthly revenue', money(o.projected_mrr_cents), '<span class="sm2">if plans were billed today. Nothing is billed yet.</span>'],
      ['Paying businesses', num(paying), '<span class="sm2">' + num(o.by_plan.starter) + ' Starter, ' + num(o.by_plan.pro) + ' Pro</span>'],
      ['Plan interest', num(o.plan_interest.businesses), '<span class="sm2">businesses asked for a paid plan, worth ' + money(o.plan_interest.value_cents) + ' a month</span>'],
      ['Show-up, last 30 days', rate == null ? '-' : rate + '%', '<span class="sm2">' + num(o.activity_30d.redeemed) + ' of ' + num(settled) + ' finished grabs were scanned</span>'],
      ['Needs attention', num(o.businesses.pending + o.open_reports), (late ? '<span class="bad">' + late + ' past ' + GOAL_HOURS + ' hours</span> ' : '') + '<span class="sm2">' + num(o.businesses.pending) + ' to verify, ' + num(o.open_reports) + ' reports</span>']
    ].map(function (k) { return '<div class="card kpi"><div class="lbl">' + k[0] + '</div><div class="v">' + k[1] + '</div><div class="d">' + k[2] + '</div></div>'; }).join('');

    var queue = o.queue.length ? o.queue.map(function (q) {
      var pct = Math.min(100, Math.round(100 * q.waiting_hours / GOAL_HOURS)), late = q.waiting_hours >= GOAL_HOURS, hot = q.waiting_hours >= 36;
      return '<a href="#/businesses?view=pending&sort=waiting&open=' + encodeURIComponent(q.id) + '" style="display:block;text-decoration:none;color:inherit;padding:8px 0"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(q.name) + '</b><span class="' + (hot ? 'bad' : '') + '">' + esc(hoursText(q.waiting_hours)) + ' waiting</span></div>' +
        '<div class="sm2">' + esc(vname(q.vertical)) + ', ' + esc(q.zip) + (q.owner_email ? ', ' + esc(q.owner_email) : '') + '</div>' +
        '<div class="track" style="margin-top:6px"><div class="fill" style="width:' + pct + '%;background:' + (hot ? '#C4263B' : '#0B2545') + '"></div></div>' + (late ? '<div class="bad" style="font-size:12px;margin-top:2px">Past the ' + GOAL_HOURS + ' hour goal</div>' : '') + '</a>';
    }).join('') : '<div class="sm2">Nobody is waiting. Nice.</div>';

    var maxI = Math.max.apply(null, o.by_industry.map(function (i) { return i.businesses; }).concat([1]));
    var ind = o.by_industry.map(function (i) {
      return '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b>' + esc(vname(i.vertical)) + '</b><span class="n">' + num(i.businesses) + ' &middot; ' + money(i.mrr_cents) + '</span></div><div class="track" style="margin-top:6px"><div class="fill" style="width:' + Math.round(100 * i.businesses / maxI) + '%"></div></div></div>';
    }).join('');
    var cities = o.by_city.map(function (c) {
      return '<tr><td><a href="#/businesses?q=' + encodeURIComponent(c.city) + '" style="font-weight:700;text-decoration:none">' + esc(c.city) + '</a></td><td class="n">' + num(c.businesses) + '</td><td class="n">' + num(c.approved) + '</td><td class="n">' + num(c.paying) + '</td><td class="n">' + money(c.mrr_cents) + '</td></tr>';
    }).join('');
    var f = o.funnel, steps = [['Created a business account', f.created], ['Verified', f.verified], ['Posted a first zambux', f.posted], ['Got a first redemption', f.redeemed], ['Paying', f.paying]];
    var funnel = steps.map(function (s) {
      var pct = f.created ? Math.round(100 * s[1] / f.created) : 0;
      return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-bottom:10px"><div style="flex:0 0 220px;font-weight:600">' + s[0] + '</div><div class="track" style="flex:1 1 220px;height:16px"><div class="fill" style="width:' + pct + '%"></div></div><div style="flex:0 0 130px"><b>' + num(s[1]) + '</b> <span class="sm2">' + pct + '%</span></div></div>';
    }).join('');

    var body = '<section class="kpis">' + kpis + '</section>' +
      '<section class="cols"><div class="card" style="flex:2 1 460px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="font-size:20px">Waiting for approval</h2><a href="#/businesses?view=pending&sort=waiting" style="font-weight:600">Open queue</a></div><div class="sub" style="margin-bottom:6px">Oldest first. Goal: every business checked within ' + GOAL_HOURS + ' hours.</div>' + queue + '</div>' +
      '<div class="card" style="flex:1 1 320px"><h2 style="font-size:20px;margin-bottom:12px">By industry</h2>' + ind + '</div></section>' +
      '<section class="cols"><div class="card" style="flex:1 1 420px"><h2 style="font-size:20px">By city</h2><div class="sub" style="margin-bottom:8px">One row per market.</div><div class="tablewrap"><table class="t"><thead><tr><th>City</th><th class="n">Businesses</th><th class="n">Approved</th><th class="n">Paying</th><th class="n">Projected MRR</th></tr></thead><tbody>' + cities + '</tbody></table></div></div>' +
      '<div class="card" style="flex:2 1 460px"><h2 style="font-size:20px">From sign-up to paying</h2><div class="sub" style="margin-bottom:12px">Where businesses drop off.</div>' + funnel + '</div></section>';
    return shell('overview', body, { title: 'Overview', sub: 'Austin. Numbers update each time you open this page.' });
  }

  var VIEWS = [['all', 'All'], ['pending', 'Waiting for approval'], ['waiting_24h', 'Waiting over 24 hours'], ['wants_plan', 'Wants a paid plan'], ['dormant_30d', 'No zambux in 30 days']];
  function pill(text, bg, fg) { return '<span class="pill" style="background:' + bg + ';color:' + fg + '">' + esc(text) + '</span>'; }
  function planPill(p) { return p === 'pro' ? pill('Pro', '#0B2545', '#fff') : p === 'starter' ? pill('Starter', '#D6E6FB', '#0B2545') : pill('Free', '#E6EEF9', '#0B2545'); }
  function statusPill(b) { return b.verified ? pill('Approved', '#DCFCE7', '#14532D') : pill('Pending', '#FFF1E0', '#7A3A00'); }

  function businessesPage(q) {
    var f = filtersFromQ(q), L = state.list;
    var verts = (state.overview ? state.overview.by_industry : []).map(function (i) { return i.vertical; });
    var tabs = VIEWS.map(function (v) { return '<button class="tab' + (f.view === v[0] ? ' on' : '') + '" data-view="' + v[0] + '">' + v[1] + '</button>'; }).join('');
    function sel(id, val, opts) { return '<select id="' + id + '" aria-label="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
    var filters = '<section class="card"><div class="filters"><label class="grow"><span class="lbl" style="display:block;margin-bottom:4px">Search</span><input id="f-q" type="text" style="width:100%" placeholder="Business name, owner email, address or ZIP" value="' + esc(f.q) + '"></label>' +
      '<label><span class="lbl" style="display:block;margin-bottom:4px">Status</span>' + sel('f-status', f.status, [['all', 'All'], ['approved', 'Approved'], ['pending', 'Pending']]) + '</label>' +
      '<label><span class="lbl" style="display:block;margin-bottom:4px">Plan</span>' + sel('f-plan', f.plan, [['all', 'All'], ['free', 'Free'], ['starter', 'Starter'], ['pro', 'Pro']]) + '</label>' +
      '<label><span class="lbl" style="display:block;margin-bottom:4px">Industry</span>' + sel('f-vertical', f.vertical, [['all', 'All']].concat(verts.map(function (v) { return [v, vname(v)]; }))) + '</label>' +
      '<label><span class="lbl" style="display:block;margin-bottom:4px">Sort</span>' + sel('f-sort', f.sort, [['newest', 'Newest'], ['oldest', 'Oldest'], ['waiting', 'Waiting longest'], ['name', 'Name'], ['active', 'Most active'], ['revenue', 'Projected revenue']]) + '</label>' +
      '<button class="btn sm" id="f-clear" style="align-self:flex-end">Clear filters</button></div></section>';

    var table;
    if (!L) table = '<div class="empty">Loading…</div>';
    else if (!L.rows.length) table = '<div class="empty">No businesses match these filters.</div>';
    else {
      table = '<div class="tablewrap"><table class="t"><thead><tr><th>Business</th><th>Plan</th><th>Status</th><th class="n">Zambux, 30d</th><th class="n">Show-up</th><th class="n">Projected MRR</th></tr></thead><tbody>' +
        L.rows.map(function (b) {
          var open = state.drawer && state.drawer.id === b.id;
          return '<tr class="row' + (open ? ' sel' : '') + '" data-open="' + esc(b.id) + '" tabindex="0"><td><b>' + esc(b.name) + '</b><div class="sm2">' + esc(vname(b.vertical)) + ', ' + esc(b.zip) + (b.owner_email ? ', ' + esc(b.owner_email) : '') + '</div></td><td>' + planPill(b.plan) + (b.wants_plan && b.wants_plan.length ? ' <span class="sm2">wants ' + esc(b.wants_plan.join(', ')) + '</span>' : '') + '</td><td>' + statusPill(b) + (b.waiting_hours != null ? '<div class="sm2 ' + (b.waiting_hours >= 36 ? 'bad' : '') + '">' + esc(hoursText(b.waiting_hours)) + ' waiting</div>' : '') + '</td><td class="n">' + num(b.deals_30d) + '</td><td class="n">' + (b.show_up_pct == null ? '-' : b.show_up_pct + '%') + '</td><td class="n">' + money(b.mrr_cents) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var total = L ? L.total : 0, from = total ? (f.page - 1) * f.size + 1 : 0, to = Math.min(total, f.page * f.size), pages = Math.max(1, Math.ceil(total / f.size));
    var pager = '<div class="pager"><span class="sm2">' + (L ? 'Showing ' + num(from) + ' to ' + num(to) + ' of ' + num(total) : '') + '</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="sm2">Rows ' + sel('f-size', String(f.size), [['25', '25'], ['50', '50'], ['100', '100']]) + '</label><button class="btn sm" id="prev"' + (f.page <= 1 ? ' disabled' : '') + '>Previous</button><span>Page ' + f.page + ' of ' + pages + '</span><button class="btn sm" id="next"' + (f.page >= pages ? ' disabled' : '') + '>Next</button></div></div>';
    var body = '<div class="tabs" role="group" aria-label="Saved views">' + tabs + '</div>' + filters + '<section class="card" style="padding:6px 14px 14px">' + table + pager + '</section>';
    return shell('businesses', body, { title: 'Businesses', sub: L ? num(L.total) + ' match your filters. Only ' + f.size + ' are loaded at a time, so this stays fast at any size.' : '' });
  }

  function revenuePage() {
    var o = state.overview;
    if (!o) return shell('revenue', '<div class="card empty">Loading…</div>', { title: 'Revenue', sub: '' });
    var s = o.by_plan.starter, p = o.by_plan.pro, ps = o.prices.starter || 0, pp = o.prices.pro || 0;
    var interestStarter = o.plan_interest.starter, interestPro = o.plan_interest.pro;
    var body = '<section class="kpis"><div class="card kpi"><div class="lbl">Billed this month</div><div class="v">$0</div><div class="d">Paid plans are not for sale yet</div></div>' +
      '<div class="card kpi"><div class="lbl">Projected monthly revenue</div><div class="v">' + money(o.projected_mrr_cents) + '</div><div class="d">Each business on a paid plan times that plan\'s planned price</div></div>' +
      '<div class="card kpi"><div class="lbl">Yearly run rate</div><div class="v">' + money(o.projected_mrr_cents * 12) + '</div><div class="d">Projected monthly revenue times 12</div></div>' +
      '<div class="card kpi"><div class="lbl">Plan interest</div><div class="v">' + money(o.plan_interest.value_cents) + '</div><div class="d">a month if every business that asked for a plan subscribed</div></div></section>' +
      '<section class="cols"><div class="card" style="flex:2 1 460px"><h2 style="font-size:20px">By plan</h2><div class="sub" style="margin-bottom:8px">Planned prices come from the plan_prices table.</div><div class="tablewrap"><table class="t"><thead><tr><th>Plan</th><th class="n">Price a month</th><th class="n">Businesses</th><th class="n">Projected</th><th class="n">Asked for it</th></tr></thead><tbody>' +
      '<tr><td><b>Free</b></td><td class="n">$0</td><td class="n">' + num(o.by_plan.free) + '</td><td class="n">$0</td><td class="n">-</td></tr>' +
      '<tr><td><b>Starter</b></td><td class="n">' + money(ps) + '</td><td class="n">' + num(s) + '</td><td class="n">' + money(s * ps) + '</td><td class="n">' + num(interestStarter) + '</td></tr>' +
      '<tr><td><b>Pro</b></td><td class="n">' + money(pp) + '</td><td class="n">' + num(p) + '</td><td class="n">' + money(p * pp) + '</td><td class="n">' + num(interestPro) + '</td></tr></tbody></table></div></div>' +
      '<div class="card" style="flex:1 1 340px"><h2 style="font-size:20px">What if some of them subscribe?</h2><div class="sub" style="margin-bottom:10px">Move the box to try a share of the businesses that asked for a plan.</div>' +
      '<label class="field"><span class="lbl">Share that subscribe</span><input id="conv" type="text" value="30" inputmode="numeric" style="max-width:120px"> <span class="sm2">percent</span></label>' +
      '<div style="margin-top:12px" class="kv"><span>Extra monthly revenue</span><b id="conv-out">' + money(Math.round(o.plan_interest.value_cents * 0.3)) + '</b></div>' +
      '<div class="kv"><span>Total with them</span><b id="conv-total">' + money(o.projected_mrr_cents + Math.round(o.plan_interest.value_cents * 0.3)) + '</b></div></div></section>' +
      '<div class="card sm2">This page projects. It does not show money collected. Real revenue, cancellations and scenarios arrive once plans are for sale and subscriptions are recorded.</div>';
    return shell('revenue', body, { title: 'Revenue', sub: 'What the paid plans would bring in, based on today\'s businesses.' });
  }

  // ---------- drawer ----------
  function drawer(b) {
    var pending = !b.verified;
    var actions = '';
    if (pending) {
      actions = '<div><div class="lbl">What you checked</div>' + METHODS.map(function (m) { return '<label class="check"><input type="checkbox" name="method" value="' + m[0] + '"> ' + m[1] + '</label>'; }).join('') + '</div>' +
        '<label class="field"><span class="lbl">Notes (saved to the audit log)</span><textarea id="d-notes" placeholder="What you verified"></textarea></label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="d-approve">Approve</button><button class="btn danger" id="d-rejectgo">Reject&hellip;</button></div>' +
        '<div id="d-reject" hidden><label class="field"><span class="lbl">Reason for rejecting (required)</span><textarea id="d-reason"></textarea></label><button class="btn danger" id="d-rejectdo" style="margin-top:8px">Reject this business</button></div>';
    } else {
      actions = '<div id="d-un"><button class="btn danger" id="d-ungo">Take approval away&hellip;</button></div><div id="d-unbox" hidden><label class="field"><span class="lbl">Reason (required)</span><textarea id="d-unreason"></textarea></label><button class="btn danger" id="d-undo" style="margin-top:8px">Take approval away</button></div>';
    }
    return '<div class="drawer-bg" id="d-bg"></div><aside class="drawer" role="dialog" aria-label="' + esc(b.name) + '">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><div class="lbl">Business</div><h2 style="font-size:22px">' + esc(b.name) + '</h2><div class="sm2">' + esc(b.street) + ', ' + esc(b.city || 'Austin') + ' ' + esc(b.zip) + '</div></div><button class="btn sm" id="d-close" aria-label="Close">Close</button></div>' +
      '<div>' + statusPill(b) + ' ' + planPill(b.plan) + '</div>' +
      '<div><div class="kv" style="border-top:0"><span>Owner</span><span>' + esc(b.owner_email || '-') + '</span></div><div class="kv"><span>Industry</span><span>' + esc(vname(b.vertical)) + ' &middot; ' + esc((b.categories || []).join(', ')) + '</span></div><div class="kv"><span>Joined</span><span>' + dateText(b.created_at) + '</span></div>' +
      (pending ? '<div class="kv"><span>Waiting</span><span class="' + (b.waiting_hours >= GOAL_HOURS ? 'bad' : '') + '">' + esc(b.waiting_hours + ' of ' + GOAL_HOURS + ' hours') + '</span></div>' : '') +
      '<div class="kv"><span>Wants a plan</span><span>' + esc(b.wants_plan && b.wants_plan.length ? b.wants_plan.join(', ') : 'No') + '</span></div>' +
      '<div class="kv"><span>Zambux, 30 days</span><span>' + num(b.deals_30d) + ' (last ' + esc(dateText(b.last_deal_at)) + ')</span></div>' +
      '<div class="kv"><span>Grabs / scanned, 30 days</span><span>' + num(b.grabs_30d) + ' / ' + num(b.redeemed_30d) + (b.show_up_pct != null ? ' (' + b.show_up_pct + '%)' : '') + '</span></div></div>' +
      '<label class="field"><span class="lbl">Plan</span><select id="d-plan" style="width:100%"><option value="free"' + (b.plan === 'free' ? ' selected' : '') + '>Free</option><option value="starter"' + (b.plan === 'starter' ? ' selected' : '') + '>Starter</option><option value="pro"' + (b.plan === 'pro' ? ' selected' : '') + '>Pro</option></select></label>' +
      '<div id="d-msg" role="alert"></div>' + actions + '</aside>';
  }

  // ---------- rendering + events ----------
  var searchTimer = null;
  function render() {
    var r = parseHash(), html;
    if (!state.user) { renderLogin(); return; }
    if (r.page === 'businesses') html = businessesPage(r.q); else if (r.page === 'revenue') html = revenuePage(); else html = overviewPage();
    var keep = document.activeElement && document.activeElement.id === 'f-q' ? document.activeElement.selectionStart : null;
    $app.innerHTML = html;
    if (keep != null) { var el = document.getElementById('f-q'); if (el) { el.focus(); el.setSelectionRange(keep, keep); } }
    bind(r);
  }
  function bind(r) {
    var $ = function (id) { return document.getElementById(id); };
    var so = $('signout'); if (so) so.onclick = signOut;
    if (r.page === 'businesses') {
      var f = filtersFromQ(r.q);
      var upd = function (patch) { var q = Object.assign({}, r.q, patch); delete q.open; go('businesses', q); };
      Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) { b.onclick = function () { upd({ view: b.getAttribute('data-view'), page: 1 }); }; });
      ['status', 'plan', 'vertical', 'sort', 'size'].forEach(function (k) { var e = $('f-' + k); if (e) e.onchange = function () { var p = { page: 1 }; p[k] = e.value; upd(p); }; });
      var qi = $('f-q'); if (qi) qi.oninput = function () { clearTimeout(searchTimer); searchTimer = setTimeout(function () { upd({ q: qi.value, page: 1 }); }, 350); };
      var cl = $('f-clear'); if (cl) cl.onclick = function () { go('businesses', {}); };
      var pv = $('prev'), nx = $('next'); if (pv) pv.onclick = function () { upd({ page: f.page - 1 }); }; if (nx) nx.onclick = function () { upd({ page: f.page + 1 }); };
      Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (row) {
        var open = function () { var id = row.getAttribute('data-open'); state.drawer = state.list.rows.filter(function (b) { return b.id === id; })[0] || null; state.error = null; state.notice = null; render(); };
        row.onclick = open; row.onkeydown = function (e) { if (e.key === 'Enter') open(); };
      });
    }
    if (r.page === 'revenue') {
      var cv = $('conv'); if (cv) cv.oninput = function () { var p = Math.max(0, Math.min(100, parseFloat(cv.value) || 0)), extra = Math.round(state.overview.plan_interest.value_cents * p / 100); $('conv-out').textContent = money(extra); $('conv-total').textContent = money(state.overview.projected_mrr_cents + extra); };
    }
    if (state.drawer) bindDrawer(r);
  }
  function bindDrawer(r) {
    var $ = function (id) { return document.getElementById(id); }, b = state.drawer;
    var close = function () { state.drawer = null; render(); };
    $('d-bg').onclick = close; $('d-close').onclick = close;
    var msg = function (t, good) { var m = $('d-msg'); m.innerHTML = t ? '<div class="' + (good ? 'ok' : 'err') + '">' + esc(t) + '</div>' : ''; };
    var done = function (text) { state.notice = text; state.drawer = null; return reload(); };
    var run = function (btn, fn) { btn.disabled = true; msg(''); fn().catch(function (e) { msg(friendly(e)); btn.disabled = false; }); };
    $('d-plan').onchange = function () { var sel = $('d-plan'); run(sel, function () { return api.setTier(b.id, sel.value).then(function () { return done(b.name + ' is now on the ' + sel.value + ' plan.'); }); }); };
    if ($('d-approve')) {
      $('d-approve').onclick = function () {
        var methods = Array.prototype.map.call(document.querySelectorAll('input[name=method]:checked'), function (c) { return c.value; });
        if (!methods.length) { msg('Pick at least one thing you checked before approving.'); return; }
        run($('d-approve'), function () { return api.approve(b.id, methods, $('d-notes').value.trim()).then(function () { return done(b.name + ' is approved.'); }); });
      };
      $('d-rejectgo').onclick = function () { $('d-reject').hidden = false; $('d-reason').focus(); };
      $('d-rejectdo').onclick = function () { var why = $('d-reason').value.trim(); if (!why) { msg('Add a short reason first.'); return; } run($('d-rejectdo'), function () { return api.reject(b.id, why).then(function () { return done(b.name + ' was rejected and removed.'); }); }); };
    }
    if ($('d-ungo')) {
      $('d-ungo').onclick = function () { $('d-unbox').hidden = false; $('d-unreason').focus(); };
      $('d-undo').onclick = function () { var why = $('d-unreason').value.trim(); if (!why) { msg('Add a short reason first.'); return; } run($('d-undo'), function () { return api.unverify(b.id, why).then(function () { return done('Approval taken away from ' + b.name + '.'); }); }); };
    }
  }

  // ---------- loading ----------
  function reload() {
    var r = parseHash();
    state.loading = true; state.error = null;
    var jobs = [api.overview().then(function (o) { state.overview = o; })];
    if (r.page === 'businesses') jobs.push(api.list(filtersFromQ(r.q)).then(function (l) { state.list = l; }));
    return Promise.all(jobs).then(function () {
      if (r.page === 'businesses' && r.q.open && !state.drawer && state.list) state.drawer = state.list.rows.filter(function (b) { return b.id === r.q.open; })[0] || null;
    }).catch(function (e) { state.error = friendly(e); }).then(function () { state.loading = false; render(); });
  }
  function route() { state.drawer = null; state.notice = null; if (!state.user) { render(); return; } state.list = state.list; reload(); }

  // ---------- sign in ----------
  function renderLogin(message) {
    $app.innerHTML = '<div class="login"><div class="brand" style="padding:0;color:#0B2545">Zambux <span>Admin</span></div><form class="card" id="login"><h1 style="font-size:22px">Sign in</h1><div class="sub">Admin accounts only.</div>' +
      (message ? '<div class="err" role="alert">' + esc(message) + '</div>' : '') +
      '<label class="field"><span class="lbl">Email</span><input id="em" type="email" autocomplete="username" required></label><label class="field"><span class="lbl">Password</span><input id="pw" type="password" autocomplete="current-password" required></label><button class="btn pri" id="go" type="submit">Sign in</button></form></div>';
    document.getElementById('login').onsubmit = function (e) {
      e.preventDefault(); var b = document.getElementById('go'); b.disabled = true; b.textContent = 'Signing in…';
      sb.auth.signInWithPassword({ email: document.getElementById('em').value.trim(), password: document.getElementById('pw').value }).then(function (res) {
        if (res.error) throw res.error; return afterSignIn(res.data.user);
      }).catch(function (err) { renderLogin(friendly(err)); });
    };
  }
  function afterSignIn(user) {
    return sb.from('admins').select('user_id').eq('user_id', user.id).then(function (res) {
      if (res.error || !res.data || !res.data.length) { return sb.auth.signOut().then(function () { renderLogin('This account is not an admin.'); }); }
      state.user = user; if (!location.hash) location.hash = '#/overview'; route();
    });
  }
  function signOut() { if (DEMO) { location.search = ''; return; } sb.auth.signOut().then(function () { state.user = null; state.overview = null; state.list = null; renderLogin(); }); }

  // ---------- start ----------
  window.addEventListener('hashchange', route);
  if (DEMO) {
    api = demoApi(); state.user = { email: 'you@example.com (sample)' }; route();
  } else {
    sb = window.supabase.createClient(window.ZAMBUX_ADMIN.url, window.ZAMBUX_ADMIN.key, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      if (s) return afterSignIn(s.user); renderLogin();
    }).catch(function () { renderLogin(); });
  }
})();
