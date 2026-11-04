const { useState, useEffect, useRef } = React;
const { Ic, Sidebar } = Ledgerly;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const COLOR = { USD: 'var(--ac)', EUR: 'var(--ok)', GBP: 'var(--wn)', NGN: 'var(--mu)' };
/* Same four accounts as Overview and Send money (c = currency, n = name, v = balance, r = rate to USD). Details are sample data. */
const INIT = [
  {
    c: 'USD', n: 'US Operating', v: 48200, r: 1, frozen: false, hist: [31, 33, 32, 36, 38, 37, 41, 43, 42, 45, 47, 48],
    det: [['Account name', 'Northwind Studio Inc.'], ['Account number', '4021 8830 1156'], ['Routing number', '026 073 150'], ['Account type', 'Business checking'], ['Supports', 'ACH and wire']],
    act: [['Stripe payout', 4200, 'Today'], ['AWS', -1284.5, 'Today'], ['Figma', -180, 'Oct 30']]
  },
  {
    c: 'EUR', n: 'EU Collections', v: 12450.75, r: 1.08, frozen: false, hist: [14, 14, 13, 15, 14, 13, 12, 13, 13, 12, 12, 12],
    det: [['Account name', 'Northwind Studio Inc.'], ['IBAN', 'DE89 3704 0044 0532 0130 00'], ['BIC / SWIFT', 'LDGRDEFF'], ['Account type', 'Business current'], ['Supports', 'SEPA and SEPA Instant']],
    act: [['Klarheit GmbH', 6800, 'Nov 1'], ['Atelier Roux', -2400, 'Oct 28']]
  },
  {
    c: 'GBP', n: 'UK Payouts', v: 8320.1, r: 1.27, frozen: false, hist: [6, 7, 7, 8, 7, 8, 8, 9, 8, 9, 8, 8],
    det: [['Account name', 'Northwind Studio Inc.'], ['Sort code', '04-00-75'], ['Account number', '61840927'], ['IBAN', 'GB29 LDGR 0400 7561 8409 27'], ['Supports', 'Faster Payments and CHAPS']],
    act: [['Brightwell Ltd', 3150, 'Oct 30'], ['Kestrel Studio', -980, 'Oct 25']]
  },
  {
    c: 'NGN', n: 'Lagos Local', v: 6450000, r: 0.00065, frozen: false, hist: [4.2, 4.6, 4.4, 5, 5.3, 5.1, 5.6, 5.9, 6, 6.2, 6.3, 6.45],
    det: [['Account name', 'Northwind Studio Inc.'], ['Account number', '0987654321'], ['Bank', 'Ledgerly Partner Bank'], ['Account type', 'Business current'], ['Supports', 'NIP transfers']],
    act: [['Lagos Fresh Ltd', 850000, 'Oct 30'], ['Payroll run', -1900000, 'Oct 28']]
  }
];
const MONTHS = ['October 2026', 'September 2026', 'August 2026', 'July 2026'];
const TABS = ['Details', 'Statements', 'Activity'];

function Spark({ d }) {
  const W = 600, H = 90, P = 6, lo = Math.min(...d), hi = Math.max(...d), s = hi - lo || 1;
  const p = d.map((v, i) => [P + i * (W - P * 2) / (d.length - 1), H - P - (v - lo) / s * (H - P * 2)]);
  const line = p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
  return <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Balance over the last 12 weeks">
    <path d={`${line} L${W - P} ${H} L${P} ${H} Z`} fill="var(--acs)" />
    <path d={line} fill="none" stroke="var(--ac)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
  </svg>;
}

function MoveDialog({ accts, from0, onClose, onMove }) {
  const ref = useRef(null);
  const [f, setF] = useState(from0), [t, setT] = useState(accts.find(a => a.c !== from0).c), [amt, setAmt] = useState(''), [err, setErr] = useState('');
  useEffect(() => { ref.current.showModal(); }, []);
  const A = c => accts.find(a => a.c === c), fa = A(f), ta = A(t), v = parseFloat(amt.replace(/,/g, '')), rate = fa.r / ta.r;
  const submit = e => {
    e.preventDefault();
    if (f === t) return setErr('Choose two different accounts.');
    if (!(v > 0)) return setErr('Enter an amount greater than zero.');
    if (fa.frozen) return setErr(`${fa.n} is frozen. Unfreeze it to move money out.`);
    if (ta.frozen) return setErr(`${ta.n} is frozen. Unfreeze it to move money in.`);
    if (v > fa.v) return setErr(`Not enough funds. ${fa.n} has ${fmt(fa.v, f)}.`);
    onMove(f, t, v); ref.current.close();
  };
  const opts = accts.map(a => <option key={a.c} value={a.c}>{a.n} ({fmt(a.v, a.c)}){a.frozen ? ' – frozen' : ''}</option>);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="mv-t">
    <form onSubmit={submit} noValidate>
      <h2 id="mv-t">Move money between accounts</h2>
      <label>From<select value={f} onChange={e => { setF(e.target.value); setErr(''); }}>{opts}</select></label>
      <label>To<select value={t} onChange={e => { setT(e.target.value); setErr(''); }}>{opts}</select></label>
      <label>Amount ({f})<input value={amt} inputMode="decimal" autoComplete="off" placeholder="0.00" autoFocus onChange={e => { setAmt(e.target.value); setErr(''); }} /></label>
      <p className="hint">{f !== t && `Rate: 1 ${f} = ${rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${t}`}{f !== t && v > 0 && `. They receive about ${fmt(v * rate, t)}.`}</p>
      <p className="err" role="alert">{err}</p>
      <div className="qa" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={() => ref.current.close()}>Cancel</button>
        <button type="submit" className="btn p">Move money</button>
      </div>
    </form>
  </dialog>;
}

function App() {
  const [page, setPage] = useState('Accounts'), [accts, setAccts] = useState(INIT), [sel, setSel] = useState('USD'), [tab, setTab] = useState('Details');
  const [move, setMove] = useState(false), [toast, setToast] = useState(() => location.hash === '#fund' ? 'To add money, use the US Operating details below' : '');
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2400); return () => clearTimeout(id); }, [toast]);
  const total = accts.reduce((s, a) => s + a.v * a.r, 0), a = accts.find(x => x.c === sel);
  const patch = (c, fn) => setAccts(l => l.map(x => x.c === c ? fn(x) : x));
  const copy = async v => { try { await navigator.clipboard.writeText(v); setToast('Copied to clipboard'); } catch (e) { setToast('Couldn’t copy. Select the text and copy it manually.'); } };
  const doMove = (f, t, v) => {
    const fa = accts.find(x => x.c === f), ta = accts.find(x => x.c === t), got = v * fa.r / ta.r;
    patch(f, x => ({ ...x, v: x.v - v, act: [[`Moved to ${ta.n}`, -v, 'Today'], ...x.act] }));
    patch(t, x => ({ ...x, v: x.v + got, act: [[`Moved from ${fa.n}`, got, 'Today'], ...x.act] }));
    setSel(t); setTab('Activity'); setToast(`Moved ${fmt(v, f)} to ${ta.n}`);
  };
  const toTab = i => e => {
    const n = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : null;
    if (n === null) return; e.preventDefault(); setTab(TABS[n]); document.getElementById('tab-' + TABS[n]).focus();
  };
  return <div className="app">
    <Sidebar here="Accounts" active={page} badges={{ 'Team & Approvals': 3 }} onNavigate={setPage} />
    <main>
      {page !== 'Accounts' ? <><h1>{page}</h1><p className="sub">Not designed yet – go back to Accounts.</p></> : <>
        <div className="top"><div><h1>Accounts</h1><p className="sub">Balances and payment details for Northwind Studio.</p></div>
          <div className="qa"><button className="btn" onClick={() => setMove(true)}><Ic n="arrows-left-right" />Move money</button>
            <button className="btn p" onClick={() => { setTab('Details'); setToast(`${a.n} funding details are under Details`); }}><Ic n="plus-circle" />Add Money</button></div></div>

        <div className="card total"><small>Total balance (USD equivalent)</small><b className="big">{fmt(total)}</b>
          <div className="mix" role="img" aria-label="Share of total balance by currency">{accts.map(x => <i key={x.c} title={x.c} style={{ flex: x.v * x.r, background: COLOR[x.c] }} />)}</div>
          <div className="leg">{accts.map(x => <span key={x.c}><i style={{ background: COLOR[x.c] }} />{x.c} {Math.round(x.v * x.r / total * 100)}%</span>)}</div></div>

        <div className="wallets" role="group" aria-label="Choose an account">{accts.map(x =>
          <button key={x.c} className={'wallet' + (x.frozen ? ' fz' : '')} aria-pressed={x.c === sel} onClick={() => setSel(x.c)}>
            <span className="row"><span className="flag">{x.c}</span><span className={'pill ' + (x.frozen ? 'pending' : 'completed')}>{x.frozen ? 'Frozen' : 'Active'}</span></span>
            <b>{fmt(x.v, x.c)}</b><span className="mu">{x.n}</span></button>)}</div>

        <div className="card">
          {a.frozen && <div className="banner"><Ic n="snowflake" w="fill" />This account is frozen. Money can’t be sent or moved out until you unfreeze it.</div>}
          <div className="row ph"><div><h2><Ic n="bank" />{a.n}</h2><b className="amt">{fmt(a.v, a.c)}</b></div>
            <button className="btn" onClick={() => { patch(a.c, x => ({ ...x, frozen: !x.frozen })); setToast(a.frozen ? `${a.n} unfrozen` : `${a.n} frozen`); }}><Ic n="snowflake" />{a.frozen ? 'Unfreeze account' : 'Freeze account'}</button></div>
          <Spark d={a.hist} /><div className="cap"><span>12 weeks ago</span><span>Today</span></div>
          <div className="tabs" role="tablist" aria-label="Account sections">{TABS.map((k, i) =>
            <button key={k} id={'tab-' + k} role="tab" aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)} onKeyDown={toTab(i)}>{k}</button>)}</div>
          <div role="tabpanel" aria-labelledby={'tab-' + tab}>
            {tab === 'Details' && <>{a.det.map(([k, v]) => <div className="kv" key={k}><span className="mu">{k}</span><span>{v}</span><button className="btn sm" onClick={() => copy(v)}><Ic n="copy" s={14} />Copy</button></div>)}
              <p className="note">Share these details to receive {a.c} payments. Sample numbers for the prototype.</p></>}
            {tab === 'Statements' && <div className="wrap"><table><thead><tr><th>Period</th><th>Format</th><th className="r">Download</th></tr></thead><tbody>
              {MONTHS.map(m => <tr key={m}><td><b>{m}</b></td><td className="mu">PDF</td><td className="r"><button className="btn sm" onClick={() => setToast(`Statement for ${m} downloaded`)}><Ic n="download-simple" s={14} />Download</button></td></tr>)}</tbody></table></div>}
            {tab === 'Activity' && (a.act.length ? <div className="wrap"><table><thead><tr><th>Name</th><th>Date</th><th className="r">Amount</th></tr></thead><tbody>
              {a.act.map((t, i) => <tr key={i}><td><b>{t[0]}</b></td><td className="mu">{t[2]}</td><td className={'r ' + (t[1] > 0 ? 'up' : '')}>{t[1] > 0 ? '+' : '−'}{fmt(Math.abs(t[1]), a.c)}</td></tr>)}</tbody></table></div> : <p className="mu">No activity yet. Add money to get started.</p>)}
          </div>
        </div>
        {move && <MoveDialog accts={accts} from0={sel} onClose={() => setMove(false)} onMove={doMove} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);