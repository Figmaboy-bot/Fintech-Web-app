const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Ledgerly;

const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const RATE = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 0.00065 };
const ACCT = { USD: 'US Operating', EUR: 'EU Collections', GBP: 'UK Payouts', NGN: 'Lagos Local' };
const CATS = ['Revenue', 'Infrastructure', 'Software', 'Contractors', 'Payroll', 'Rent', 'Marketing', 'Travel', 'Taxes', 'Other'];
const PAGE = 10;
const TODAY = new Date(2026, 10, 3);

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dfmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const tfmt = d => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const dshort = d => { const n = Math.round((TODAY - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
const signed = (n, c) => (n > 0 ? '+' : '−') + fmt(Math.abs(n), c);

/* ---- sample data (deterministic, so the page looks the same every load) ---- */
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 } }
const TPL = [ // name, description, category, currency, min, max, direction, method
  ['Stripe payout', 'Weekly payout', 'Revenue', 'USD', 2800, 9200, 1, 'Stripe'],
  ['AWS', 'Cloud infrastructure', 'Infrastructure', 'USD', 900, 1900, -1, 'Card'],
  ['Figma', 'Design software', 'Software', 'USD', 150, 420, -1, 'Card'],
  ['Notion', 'Workspace subscription', 'Software', 'USD', 60, 960, -1, 'Card'],
  ['Amara Okafor', 'Contractor payment', 'Contractors', 'USD', 1500, 3600, -1, 'Bank transfer'],
  ['Lagos Fresh Ltd', 'Invoice payment', 'Revenue', 'NGN', 420000, 1250000, 1, 'Bank transfer'],
  ['Acme GmbH', 'Invoice payment', 'Revenue', 'EUR', 1200, 4800, 1, 'Bank transfer'],
  ['Gusto', 'Payroll run', 'Payroll', 'USD', 16800, 18900, -1, 'Direct debit'],
  ['Harbor Design Ltd', 'Design retainer', 'Contractors', 'GBP', 1800, 3200, -1, 'Bank transfer'],
  ['Office rent', 'Monthly rent', 'Rent', 'USD', 3800, 3800, -1, 'Direct debit'],
  ['Google Ads', 'Ad spend', 'Marketing', 'USD', 600, 2400, -1, 'Card'],
  ['Delta Air Lines', 'Team travel', 'Travel', 'USD', 320, 1450, -1, 'Card'],
  ['Pixel Forge LLC', 'Invoice payment', 'Revenue', 'USD', 2000, 7500, 1, 'Bank transfer']];
function build() {
  const r = rng(7), out = [];
  for (let i = 0; i < 46; i++) {
    const t = TPL[Math.floor(r() * TPL.length)];
    const off = Math.min(89, Math.floor(i * 1.95 + r() * 2));
    const d = new Date(TODAY); d.setDate(d.getDate() - off); d.setHours(8 + Math.floor(r() * 10), Math.floor(r() * 60));
    let a = t[4] + r() * (t[5] - t[4]); a = t[3] === 'NGN' ? Math.round(a / 1000) * 1000 : Math.round(a * 100) / 100;
    const status = i < 2 ? 'pending' : i === 8 ? 'failed' : (r() > 0.93 && t[6] > 0 ? 'failed' : 'completed');
    out.push({ id: 'TXN-' + (48210 - i), d, name: t[0], desc: t[1], cat: t[2], cur: t[3], amt: t[6] * a, status, acct: ACCT[t[3]], method: t[7], note: '', flag: false, receipt: '' });
  }
  return out;
}

/* ---- transaction detail drawer ---- */
function Detail({ tx, upd, close, closeRef, say }) {
  const [note, setNote] = useState(tx.note);
  const inn = tx.amt > 0, when = dfmt(tx.d) + ' · ' + tfmt(tx.d);
  const steps = tx.status === 'completed' ? [['Created · ' + when, 'd1'], ['Processing', 'd1'], ['Completed', 'd1']]
    : tx.status === 'pending' ? [['Created · ' + when, 'd1'], ['Processing with bank', 'd2'], ['Completed', '']]
      : [['Created · ' + when, 'd1'], ['Processing', 'd1'], ['Failed', 'd3']];
  const why = inn ? "The payer's bank declined this payment. No money moved." : "The recipient's bank rejected this transfer. Any funds were returned to your account.";
  const copy = () => { try { navigator.clipboard.writeText(tx.id).then(() => say('Reference copied'), () => say('Could not copy')) } catch (e) { say('Could not copy') } };
  const receipt = () => {
    const t = ['Ledgerly transaction receipt', 'Reference: ' + tx.id, 'Date: ' + when, 'Name: ' + tx.name, 'Description: ' + tx.desc, 'Account: ' + tx.acct, 'Method: ' + tx.method, 'Status: ' + tx.status, 'Amount: ' + signed(tx.amt, tx.cur)].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' })); a.download = tx.id + '.txt'; a.click();
  };
  return <>
    <div className="row"><h2 id="dt"><Ic n="receipt" />Transaction details</h2>
      <button ref={closeRef} className="btn sm" onClick={close} aria-label="Close details"><Ic n="x" /></button></div>
    <div className="dh"><div className="mu">{tx.name}</div>
      <div className={'big ' + (inn ? 'up' : '')}>{signed(tx.amt, tx.cur)}</div>
      <span className={'pill ' + tx.status}>{tx.status}</span>{tx.flag && <> <span className="pill failed"><Ic n="flag" w="fill" s={12} />Flagged</span></>}</div>
    {tx.status === 'failed' && <div className="alert" role="alert"><Ic n="warning" w="fill" />{why}</div>}
    <div className="sec">DETAILS</div>
    <div className="kv"><span className="mu">Reference</span><span>{tx.id}</span></div>
    <div className="kv"><span className="mu">Date</span><span>{when}</span></div>
    <div className="kv"><span className="mu">Description</span><span>{tx.desc}</span></div>
    <div className="kv"><span className="mu">Account</span><span>{tx.acct} · {tx.cur}</span></div>
    <div className="kv"><span className="mu">Method</span><span>{tx.method}</span></div>
    <div className="sec">CATEGORY</div>
    <select aria-label="Category" value={tx.cat} onChange={e => { upd(tx.id, { cat: e.target.value }); say('Category updated') }}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
    <div className="sec">STATUS</div>
    <ul className="tl" aria-label="Status history">{steps.map(([t, c]) => <li key={t} className={c}><Ic n={c === 'd1' ? 'check-circle' : c === 'd2' ? 'clock' : c === 'd3' ? 'x-circle' : 'circle'} w={c ? 'fill' : 'regular'} />{t}</li>)}</ul>
    <div className="sec">NOTE</div>
    <textarea aria-label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note for your accountant" />
    <div className="acts"><button className="btn sm" disabled={note === tx.note} onClick={() => { upd(tx.id, { note }); say('Note saved') }}>Save note</button></div>
    <div className="sec">RECEIPT</div>
    {tx.receipt ? <div className="row"><span><Ic n="paperclip" s={16} /> {tx.receipt}</span><button className="btn sm" onClick={() => { upd(tx.id, { receipt: '' }); say('Receipt removed') }}>Remove</button></div>
      : <input type="file" aria-label="Attach receipt" accept="image/*,.pdf" onChange={e => { const f = e.target.files[0]; if (f) { upd(tx.id, { receipt: f.name }); say('Receipt attached') } }} />}
    <div className="acts" style={{ marginTop: 22 }}>
      <button className="btn" onClick={receipt}><Ic n="download-simple" />Receipt</button>
      <button className="btn" onClick={copy}><Ic n="copy" />Copy reference</button>
      <button className="btn" onClick={() => { upd(tx.id, { flag: !tx.flag }); say(tx.flag ? 'Flag removed' : 'Flagged as suspicious') }}><Ic n="flag" w={tx.flag ? 'fill' : 'regular'} />{tx.flag ? 'Remove flag' : 'Flag as suspicious'}</button>
    </div>
  </>;
}

/* ---- page ---- */
function App() {
  const [txs, setTxs] = useState(build), [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''), [status, setStatus] = useState('all'), [type, setType] = useState('all'), [ccy, setCcy] = useState('all'), [range, setRange] = useState('all');
  const [sort, setSort] = useState({ k: 'date', dir: 'desc' }), [page, setPage] = useState(0);
  const [sel, setSel] = useState(null), [toast, setToast] = useState('');
  const lastRef = useRef(null), closeRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 450); return () => clearTimeout(t) }, []);
  useEffect(() => { setPage(0) }, [q, status, type, ccy, range, sort]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t) }, [toast]);
  useEffect(() => {
    if (!sel) return;
    if (closeRef.current) closeRef.current.focus();
    const k = e => { if (e.key === 'Escape') close() };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [sel]);

  const open = (t, e) => { lastRef.current = e.currentTarget; setSel(t.id) };
  const close = () => { setSel(null); setTimeout(() => { if (lastRef.current && lastRef.current.focus) lastRef.current.focus() }, 0) };
  const upd = (id, patch) => setTxs(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
  const toggle = k => setSort(s => s.k === k ? { k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: 'desc' });
  const active = q || status !== 'all' || type !== 'all' || ccy !== 'all' || range !== 'all';
  const clear = () => { setQ(''); setStatus('all'); setType('all'); setCcy('all'); setRange('all') };

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase(), cut = range === 'all' ? 0 : TODAY.getTime() - (+range) * 864e5, m = sort.dir === 'asc' ? 1 : -1;
    return txs.filter(t => (status === 'all' || t.status === status) && (type === 'all' || (type === 'in') === (t.amt > 0)) && (ccy === 'all' || t.cur === ccy) && t.d.getTime() >= cut
      && (!ql || (t.name + ' ' + t.desc + ' ' + t.id + ' ' + t.cat + ' ' + t.note).toLowerCase().includes(ql)))
      .sort((a, b) => sort.k === 'amount' ? m * (a.amt * RATE[a.cur] - b.amt * RATE[b.cur]) : m * (a.d - b.d));
  }, [txs, q, status, type, ccy, range, sort]);

  const live = rows.filter(t => t.status !== 'failed');
  const inn = live.filter(t => t.amt > 0).reduce((a, t) => a + t.amt * RATE[t.cur], 0);
  const out = live.filter(t => t.amt < 0).reduce((a, t) => a - t.amt * RATE[t.cur], 0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)), shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const tx = txs.find(t => t.id === sel);

  const exportCsv = () => {
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['Date', 'Reference', 'Name', 'Description', 'Category', 'Account', 'Currency', 'Amount', 'Status', 'Note'].join(',')]
      .concat(rows.map(t => [iso(t.d), t.id, t.name, t.desc, t.cat, t.acct, t.cur, t.amt, t.status, t.note].map(esc).join(',')));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'ledgerly-transactions.csv'; a.click();
    setToast(rows.length + ' transactions exported');
  };
  const sortBtn = (k, l) => <button className="th" onClick={() => toggle(k)}>{l}<Ic n={sort.k !== k ? 'caret-up-down' : sort.dir === 'asc' ? 'caret-up' : 'caret-down'} s={12} /></button>;
  const ariaSort = k => sort.k === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const stat = (l, v, d, c) => <div className="card stat"><small>{l}</small><b className={c}>{loading ? '—' : v}</b><span className="d">{d}</span></div>;

  return <div className="app"><Sidebar here="Transactions" />
    <main>
      <div className="top"><div><h1>Transactions</h1><p className="sub">Search, filter and review every payment in and out of your accounts.</p></div>
        <div className="qa noprint"><button className="btn" onClick={() => window.print()}><Ic n="printer" />Print</button><button className="btn p" onClick={exportCsv} disabled={!rows.length}><Ic n="download-simple" />Export CSV</button></div></div>

      <div className="stats">
        {stat('Transactions', rows.length, active ? 'Matching your filters' : 'Last 90 days')}
        {stat('Money in', '≈ ' + fmt(inn), 'USD equivalent, excl. failed', 'up')}
        {stat('Money out', '≈ ' + fmt(out), 'USD equivalent, excl. failed')}
        {stat('Net', '≈ ' + (inn >= out ? '+' : '−') + fmt(Math.abs(inn - out)), 'Money in minus money out', inn >= out ? 'up' : 'dn')}
      </div>

      <div className="card">
        <div className="filters noprint" role="search">
          <div className="srch"><span className="si"><Ic n="magnifying-glass" s={16} /></span><input aria-label="Search transactions" placeholder="Search name, reference or category" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="seg" role="radiogroup" aria-label="Direction">{[['all', 'All'], ['in', 'Money in'], ['out', 'Money out']].map(([k, l]) => <button key={k} role="radio" aria-checked={type === k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}</div>
          <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option></select>
          <select aria-label="Currency" value={ccy} onChange={e => setCcy(e.target.value)}><option value="all">All currencies</option>{Object.keys(ACCT).map(c => <option key={c}>{c}</option>)}</select>
          <select aria-label="Date range" value={range} onChange={e => setRange(e.target.value)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
          {active && <button className="btn sm" onClick={clear}>Clear filters</button>}
        </div>

        {!loading && rows.length === 0 ?
          <div className="empty"><Ic n="magnifying-glass" s={32} /><b>No transactions match</b>Try a different search or clear your filters.<div><button className="btn" onClick={clear}>Clear filters</button></div></div>
          : <div className="wrap"><table aria-busy={loading}>
            <thead><tr><th aria-sort={ariaSort('date')}>{sortBtn('date', 'Date')}</th><th>Transaction</th><th className="hide-s">Category</th><th className="hide-s">Account</th><th>Status</th><th className="r" aria-sort={ariaSort('amount')}>{sortBtn('amount', 'Amount')}</th></tr></thead>
            <tbody>{loading ? [0, 1, 2, 3, 4, 5].map(i => <tr key={i}>{[60, 160, 80, 90, 70, 80].map((w, j) => <td key={j} className={j === 2 || j === 3 ? 'hide-s' : ''}><div className="sk" style={{ width: w, marginLeft: j === 5 ? 'auto' : 0 }} /></td>)}</tr>)
              : shown.map(t => <tr key={t.id} className="rw" onClick={e => open(t, e)}>
                <td className="mu nw">{dshort(t.d)}</td>
                <td><button className="lnk" onClick={e => { e.stopPropagation(); open(t, e) }}>{t.name}</button>{t.flag && <Ic n="flag" w="fill" s={14} />}<div className="mu sm2">{t.desc} · {t.id}</div></td>
                <td className="hide-s">{t.cat}</td><td className="hide-s mu">{t.acct}</td>
                <td><span className={'pill ' + t.status}>{t.status}</span></td>
                <td className={'r nw ' + (t.amt > 0 ? 'up' : '')}>{signed(t.amt, t.cur)}</td></tr>)}</tbody></table></div>}

        {!loading && rows.length > 0 && <div className="pg noprint"><span className="mu">{page * PAGE + 1}–{page * PAGE + shown.length} of {rows.length}</span>
          <span><button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button> <button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></span></div>}
      </div>

      {tx && <><div className="ov" onClick={close} />
        <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dt"><Detail key={tx.id} tx={tx} upd={upd} close={close} closeRef={closeRef} say={setToast} /></div></>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);