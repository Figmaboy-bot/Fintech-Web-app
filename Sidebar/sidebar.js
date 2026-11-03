/* global React */
/* eslint-env browser */
/* Ledgerly shared sidebar.
   Plain JS (no JSX) so it loads from file:// without Babel. Load after React, before the page script.
   Usage in a page:  const {Ic, Sidebar} = Ledgerly;
     <Sidebar here="Overview" active="Overview" badges={{'Team & Approvals': 3}} onNavigate={setPage}/>
   here       label of the page this file is (that item stays in-page instead of linking)
   active     label to highlight (defaults to here)
   badges     { label: count } red counters
   onNavigate called with the label for items that have no page yet (omit to show them disabled) */
(function () {
  var h = React.createElement, useState = React.useState, useEffect = React.useEffect;
  var KEY = 'ledgerly-theme';

  /* Pages that exist, relative to the page that loads this file (every page sits one folder deep). Add a line when a new screen ships. */
  var PAGES = {
    'Overview': '../overview/overview.html',
    'Payments': '../send-money/send.html',
    'Transactions': '../transactions/transactions.html',
    'Cards': '../cards/cards.html',
    'Expenses': '../expenses/expenses.html'
  };

  var NAV = [
    ['WORKSPACE', [['Overview', 'house'], ['Accounts', 'bank'], ['Payments', 'paper-plane-tilt'], ['Transactions', 'arrows-left-right'], ['Cards', 'credit-card']]],
    ['MANAGE', [['Expenses', 'receipt'], ['Invoices', 'file-text'], ['Bills & Subscriptions', 'calendar-check'], ['Team & Approvals', 'users-three']]],
    ['INSIGHTS', [['Analytics', 'chart-line-up'], ['Currency Exchange', 'currency-circle-dollar']]],
    ['OTHERS', [['Notifications', 'bell'], ['Settings', 'gear'], ['Help & Support', 'question']]]
  ];

  var THEMES = [['light', 'Light', 'sun'], ['system', 'Auto', 'desktop'], ['dark', 'Dark', 'moon']];

  function readTheme() { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } }
  function applyTheme(t) {
    var r = document.documentElement;
    if (t === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
  }
  applyTheme(readTheme()); /* runs at load so the page never flashes the wrong theme */

  function Ic(p) { return h('ph-' + p.n, { weight: p.w || 'regular', size: p.s || 18, color: 'currentColor' }); }

  function ThemeToggle() {
    var st = useState(readTheme), t = st[0], setT = st[1];
    useEffect(function () { applyTheme(t); try { localStorage.setItem(KEY, t); } catch (e) { } }, [t]);
    return h('div', { className: 'theme', role: 'radiogroup', 'aria-label': 'Theme' }, THEMES.map(function (x) {
      var k = x[0];
      return h('button', { key: k, type: 'button', role: 'radio', 'aria-checked': t === k, className: t === k ? 'on' : '', onClick: function () { setT(k); } },
        h(Ic, { n: x[2], w: t === k ? 'fill' : 'regular', s: 15 }), h('span', null, x[1]));
    }));
  }

  function Sidebar(p) {
    var here = p.here, active = p.active || here, badges = p.badges || {}, go = p.onNavigate;
    return h('aside', null,
      h('div', { className: 'logo' }, 'Ledger', h('b', null, 'ly')),
      h('div', { className: 'ws' }, 'Business workspace'),
      h('nav', { 'aria-label': 'Main' }, NAV.map(function (g) {
        return h('div', { key: g[0], className: 'sb-g' },
          h('div', { className: 'grp' }, g[0]),
          g[1].map(function (it) {
            var label = it[0], on = active === label, href = PAGES[label], n = badges[label];
            var kids = [
              h(Ic, { key: 'i', n: it[1], w: on ? 'fill' : 'regular' }),
              h('span', { key: 't' }, label),
              n > 0 ? h('span', { key: 'b', className: 'dot' }, n) : null
            ];
            var props = { key: label, className: 'nv' + (on ? ' on' : ''), 'aria-current': on ? 'page' : undefined };
            if (href && label !== here) return h('a', Object.assign(props, { href: href }), kids);
            if (go) return h('button', Object.assign(props, { type: 'button', onClick: function () { go(label); } }), kids);
            return h('button', Object.assign(props, { type: 'button', 'aria-disabled': true, title: 'Not designed yet' }), kids);
          }));
      })),
      h(ThemeToggle));
  }

  window.Ledgerly = { Ic: Ic, Sidebar: Sidebar, ThemeToggle: ThemeToggle };
})();