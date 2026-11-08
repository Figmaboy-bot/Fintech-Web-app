/* Montraly landing page: the live Montra, the approval demo and the theme toggle. Plain JS, no dependencies. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  /* ---------- the Montra ---------- */
  var MAX_ROWS = 7;
  var rows = $('#rows'), balance = 0, day = 5;
  var START = [
    { d: 'Nov 2', t: 'Opening balance', open: 12480 },
    { d: 'Nov 2', t: 'INV-2041 paid · Northwind Studio', amt: 4200 },
    { d: 'Nov 3', t: 'Card ••4821 · Design software', amt: -45 },
    { d: 'Nov 4', t: 'Payroll · 4 people', amt: -8400 },
    { d: 'Nov 5', t: 'INV-2042 paid · Harbor & Pine', amt: 3150 }
  ];
  var MORE = {
    'in': [['INV-2043 paid · Brightside Co', 2750], ['INV-2044 paid · Okafor & Sons', 1180], ['Client deposit · Lumen Labs', 5400]],
    out: [['Supplier · Printhouse Ltd', -860], ['Rent · Studio 4B', -1500], ['Contractor · J. Adeyemi', -950]],
    card: [['Card ••4821 · Ad spend', -340], ['Card ••7710 · Taxi', -28.5], ['Card ••4821 · Design software', -96]]
  };
  var cursor = { 'in': 0, out: 0, card: 0 };

  function cell(cls, text) { var td = document.createElement('td'); td.className = cls; td.textContent = text; td.title = cls === 'desc' ? text : ''; return td; }

  function post(e, animate) {
    if (e.open !== undefined) balance = e.open; else balance += e.amt;
    var tr = document.createElement('tr');
    tr.appendChild(cell('date', e.d));
    tr.appendChild(cell('desc', e.t));
    tr.appendChild(cell('num tn ' + (e.amt > 0 ? 'in' : 'out'), e.amt === undefined ? '' : (e.amt > 0 ? '+' : '−') + fmt(Math.abs(e.amt))));
    tr.appendChild(cell('num tn bal', fmt(balance)));
    if (animate && !reduce) tr.className = 'arrive';
    rows.appendChild(tr);
    while (rows.children.length > MAX_ROWS) rows.removeChild(rows.firstChild);
    return tr;
  }

  function open() {
    if (reduce) { START.forEach(function (e) { post(e, false); }); return; }
    START.forEach(function (e, i) { setTimeout(function () { post(e, true); }, 250 + i * 230); });
  }

  function add(kind) {
    var list = MORE[kind], pick = list[cursor[kind]++ % list.length];
    day = day >= 30 ? 6 : day + 1;
    var tr = post({ d: 'Nov ' + day, t: pick[0], amt: pick[1] }, true);
    if (!reduce) { tr.classList.add('fresh'); }
    $('#Montra-state').textContent = 'Posted ' + (pick[1] > 0 ? '+' : '−') + '$' + fmt(Math.abs(pick[1]));
  }

  if (rows) {
    open();
    document.querySelectorAll('[data-kind]').forEach(function (b) {
      b.addEventListener('click', function () { add(b.getAttribute('data-kind')); });
    });
  }

  /* ---------- approval demo ---------- */
  var act = $('#ask-act'), done = $('#ask-done'), pill = $('#ask-pill');
  if (act) {
    act.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-answer]'); if (!b) return;
      var ok = b.getAttribute('data-answer') === 'approved';
      pill.textContent = ok ? 'Approved by you' : 'Declined by you';
      pill.className = 'pill ' + (ok ? 'ok' : 'no');
      act.hidden = true; done.hidden = false;
      $('#ask-undo').focus();
    });
    $('#ask-undo').addEventListener('click', function () { done.hidden = true; act.hidden = false; act.querySelector('button').focus(); });
  }

  /* ---------- fee calculator ---------- */
  var amt = $('#amt'), rng = $('#amt-r');
  if (amt && rng) {
    var money = function (n) { return '$' + fmt(n); };
    var calc = function (n) {
      var fee = Math.max(0.5, Math.round(n * 0.005 * 100) / 100);
      if (!(n > 0)) fee = 0;
      $('#fee').textContent = money(fee); $('#tot').textContent = money(n + fee); $('#get').textContent = money(n);
    };
    var parse = function () { var n = parseFloat(amt.value.replace(/[^0-9.]/g, '')); return isFinite(n) ? Math.min(n, 1000000) : 0; };
    amt.addEventListener('input', function () { var n = parse(); calc(n); rng.value = Math.min(Math.max(n, 100), 20000); });
    amt.addEventListener('blur', function () { amt.value = fmt(parse()); });
    rng.addEventListener('input', function () { var n = +rng.value; amt.value = fmt(n); calc(n); });
  }

  /* ---------- tour tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab]'));
  function pick(t, focus) {
    tabs.forEach(function (x) {
      var on = x === t;
      x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) t.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pick(t); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : null;
      if (n === null) return; e.preventDefault(); pick(tabs[(n + tabs.length) % tabs.length], true);
    });
  });

  /* ---------- mobile menu ---------- */
  var mb = $('#menu-btn'), menu = $('#menu');
  function setMenu(o) { menu.classList.toggle('open', o); mb.setAttribute('aria-expanded', o ? 'true' : 'false'); mb.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); mb.querySelector('use').setAttribute('href', o ? '#i-x' : '#i-menu'); }
  mb.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- theme (same storage key as the app, so the choice carries over) ---------- */
  var KEY = 'Montraly-theme', btn = $('#theme'), root = document.documentElement;
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function effective() {
    var t = root.getAttribute('data-theme');
    return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function paint() {
    var m = effective();
    btn.setAttribute('data-mode', m);
    btn.setAttribute('aria-label', m === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  var s = stored(); if (s === 'light' || s === 'dark') root.setAttribute('data-theme', s);
  paint();
  btn.addEventListener('click', function () {
    var next = effective() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) { }
    paint();
  });
})();