const { useState, useEffect } = React;
const { Ic, Sidebar } = Ledgerly;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const rateFmt = n => n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 2 : 4 });
const FXFEE = 0.006, APPROVAL = 10000, LOCK = 30; /* same fee and approval limit as Send money */
const INIT = [{ c: 'USD', n: 'US Operating', v: 48200, r: 1 }, { c: 'EUR', n: 'EU Collections', v: 12450.75, r: 1.08 }, { c: 'GBP', n: 'UK Payouts', v: 8320.1, r: 1.27 }, { c: 'NGN', n: 'Lagos Local', v: 6450000, r: 0.00065 }];
const BASE = Object.fromEntries(INIT.map(a => [a.c, a.r])); /* value of 1 unit in USD */
const walk = p => Object.fromEntries(Object.entries(p).map(([c, v]) => [c, c === 'USD' ? 1 : v * (1 + (Math.random() - .5) * .0016)]));
const seed = () => { const t = [BASE]; for (let i = 1; i < 24; i++) t.push(walk(t[i - 1])); return t; };
const PAIRS = [['USD', 'NGN'], ['EUR', 'USD'], ['GBP', 'USD'], ['GBP', 'NGN']];
const HIST = [
  { id: 'EX-1031', d: 'Oct 29', f: 'USD', fa: 2000, t: 'NGN', ta: 3058461, rate: 1538.46, s: 'Completed' },
  { id: 'EX-1027', d: 'Oct 21', f: 'EUR', fa: 3000, t: 'USD', ta: 3216.1, rate: 1.0804, s: 'Completed' },
  { id: 'EX-1019', d: 'Oct 9', f: 'USD', fa: 12500, t: 'GBP', ta: 9692.3, rate: 0.7874, s: 'Completed' }
];
const ALERTS = [{ id: 1, f: 'USD', t: 'NGN', dir: 'above', target: 1550 }, { id: 2, f: 'GBP', t: 'USD', dir: 'below', target: 1.25 }];

function Mini({ d }) {
  const lo = Math.min(...d), hi = Math.max(...d), s = hi - lo || 1;
  const p = d.map((v, i) => `${i ? 'L' : 'M'}${(i * 84 / (d.length - 1)).toFixed(1)} ${(24 - (v - lo) / s * 22).toFixed(1)}`).join(' ');
  return <svg viewBox="0 0 84 26" aria-hidden="true"><path d={p} fill="none" stroke="var(--ac)" strokeWidth="2" strokeLinejoin="round" /></svg>;
}
function Modal({ title, onClose, children }) {
  const ref = React.useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="m-t"><div className="mb"><h2 id="m-t">{title}</h2>{children(() => ref.current.close())}</div></dialog>;
}
function AlertForm({ accts, onSave, close }) {
  const [f, setF] = useState('USD'), [t, setT] = useState('NGN'), [dir, setDir] = useState('above'), [v, setV] = useState(''), [err, setErr] = useState('');
  const go = e => { e.preventDefault(); const n = parseFloat(v.replace(/,/g, '')); if (f === t) return setErr('Choose two different currencies.'); if (!(n > 0)) return setErr('Enter a target rate greater than zero.'); onSave({ f, t, dir, target: n }); close(); };
  const opts = accts.map(a => <option key={a.c}>{a.c}</option>);
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <div className="field"><label>From<select value={f} onChange={e => { setF(e.target.value); setErr(''); }}>{opts}</select></label><label>To<select value={t} onChange={e => { setT(e.target.value); setErr(''); }}>{opts}</select></label></div>
    <label>Tell me when the rate goes<select value={dir} onChange={e => setDir(e.target.value)}><option value="above">Above</option><option value="below">Below</option></select></label>
    <label>Target rate<input value={v} inputMode="decimal" autoFocus placeholder="0.00" onChange={e => { setV(e.target.value); setErr(''); }} /></label>
    <p className="err" role="alert">{err}</p>
    <div className="qa" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn p" type="submit">Create alert</button></div></form>;
}

function App() {
  const [page, setPage] = useState('Currency Exchange'), [accts, setAccts] = useState(INIT), [ticks, setTicks] = useState(seed);
  const [from, setFrom] = useState('USD'), [to, setTo] = useState('NGN'), [amt, setAmt] = useState(''), [err, setErr] = useState('');
  const [step, setStep] = useState('form'), [quote, setQuote] = useState(null), [left, setLeft] = useState(LOCK), [hist, setHist] = useState(HIST), [alerts, setAlerts] = useState(ALERTS);
  const [modal, setModal] = useState(false), [toast, setToast] = useState(''), [done, setDone] = useState(null);
  useEffect(() => { const id = setInterval(() => setTicks(t => [...t.slice(-23), walk(t[t.length - 1])]), 4000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { if (step !== 'review') return; const id = setInterval(() => setLeft(Math.max(0, Math.ceil(LOCK - (Date.now() - quote.at) / 1000))), 500); return () => clearInterval(id); }, [step, quote]);
  const live = ticks[ticks.length - 1], open = ticks[0], pr = (f, t, x = live) => x[f] / x[t];
  const A = c => accts.find(a => a.c === c), fa = A(from), ta = A(to);
  const a = parseFloat(amt.replace(/,/g, '')) || 0, fee = a * FXFEE, net = a - fee, rate = step === 'review' ? quote.rate : pr(from, to), got = net * rate, usd = a * live[from], needs = usd > APPROVAL;
  const reset = () => { setStep('form'); setQuote(null); setErr(''); };
  const review = e => {
    e.preventDefault();
    if (from === to) return setErr('Choose two different accounts.');
    if (!(a > 0)) return setErr('Enter an amount to exchange.');
    if (a > fa.v) return setErr(`Not enough in ${fa.n}. Available: ${fmt(fa.v, from)}.`);
    setErr(''); setQuote({ rate: pr(from, to), at: Date.now() }); setLeft(LOCK); setStep('review');
  };
  const confirm = () => {
    if (left <= 0) return;
    const id = 'EX-' + (1032 + hist.length - 3), item = { id, d: 'Today', f: from, fa: a, t: to, ta: got, rate: quote.rate, s: needs ? 'Pending approval' : 'Completed' };
    if (!needs) setAccts(l => l.map(x => x.c === from ? { ...x, v: x.v - a } : x.c === to ? { ...x, v: x.v + got } : x));
    setHist(h => [item, ...h]); setDone(item); setStep('done'); setAmt('');
  };
  const reached = al => { const r = pr(al.f, al.t); return al.dir === 'above' ? r >= al.target : r <= al.target; };
  return <div className="app">
    <Sidebar here="Currency Exchange" active={page} badges={{ 'Team & Approvals': 3 }} onNavigate={setPage} />
    <main>
      {page !== 'Currency Exchange' ? <><h1>{page}</h1><p className="sub">Not designed yet – go back to Currency Exchange.</p></> : <>
        <div className="top"><div><h1>Currency Exchange</h1><p className="sub">Move money between your accounts at the live rate, with the fee shown up front.</p></div></div>
        <div className="g g2">
          <div className="col">
            <div className="card">
              {step === 'form' && <form onSubmit={review} noValidate>
                <div className="row" style={{ marginBottom: 10 }}><h2><Ic n="arrows-left-right" />Exchange</h2><span className="live">Live rate</span></div>
                <label>You exchange<div className="field"><select aria-label="From account" value={from} onChange={e => { setFrom(e.target.value); setErr(''); }}>{accts.map(x => <option key={x.c} value={x.c}>{x.n} ({fmt(x.v, x.c)})</option>)}</select>
                  <input aria-label="Amount" value={amt} inputMode="decimal" autoComplete="off" placeholder="0.00" onChange={e => { setAmt(e.target.value); setErr(''); }} /></div></label>
                <div className="swap"><button type="button" aria-label="Swap accounts" onClick={() => { setFrom(to); setTo(from); setErr(''); }}><Ic n="arrows-down-up" /></button></div>
                <label>You get<div className="field"><select aria-label="To account" value={to} onChange={e => { setTo(e.target.value); setErr(''); }}>{accts.map(x => <option key={x.c} value={x.c}>{x.n} ({fmt(x.v, x.c)})</option>)}</select>
                  <div className="recv" aria-live="polite">{a > 0 && from !== to ? fmt(got, to) : <span className="mu">0.00</span>}</div></div></label>
                {from !== to && <div className="brk">
                  <div className="rw"><span className="mu">Rate</span><span>1 {from} = {rateFmt(pr(from, to))} {to}</span></div>
                  <div className="rw"><span className="mu">Fee ({(FXFEE * 100).toFixed(1)}%)</span><span>{a > 0 ? fmt(fee, from) : '–'}</span></div>
                  <div className="rw"><span className="mu">Amount converted</span><span>{a > 0 ? fmt(net, from) : '–'}</span></div>
                  <div className="rw"><span>You get</span><span>{a > 0 ? fmt(got, to) : '–'}</span></div></div>}
                {needs && <div className="alert i" style={{ marginTop: 12 }}><span className="ni"><Ic n="seal-check" w="fill" />Exchanges over {fmt(APPROVAL)} need approval from a Finance Manager before they go through.</span></div>}
                <p className="err" role="alert" style={{ marginTop: 8 }}>{err}</p>
                <button className="btn p" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Review exchange</button></form>}
              {step === 'review' && <div>
                <h2 style={{ marginBottom: 10 }}><Ic n="seal-check" />Review your exchange</h2>
                <div className="kv"><span className="mu">You exchange</span><b>{fmt(a, from)} from {fa.n}</b></div>
                <div className="kv"><span className="mu">Rate</span><span>1 {from} = {rateFmt(quote.rate)} {to}</span></div>
                <div className="kv"><span className="mu">Fee ({(FXFEE * 100).toFixed(1)}%)</span><span>{fmt(fee, from)}</span></div>
                <div className="kv"><span className="mu">You get</span><b>{fmt(got, to)} in {ta.n}</b></div>
                {needs && <div className="alert i" style={{ marginTop: 12 }}><span className="ni"><Ic n="seal-check" w="fill" />This will wait for Finance Manager approval. Your balances don’t change until it’s approved.</span></div>}
                <p style={{ margin: '12px 0' }} aria-live="polite">{left > 0 ? <>Rate locked for <span className="lock">0:{String(left).padStart(2, '0')}</span></> : <span className="dn"><b>This rate has expired.</b> Get a new rate to continue.</span>}</p>
                <div className="qa"><button className="btn" onClick={reset}>Back</button>
                  {left > 0 ? <button className="btn p" onClick={confirm}>Confirm exchange</button> : <button className="btn p" onClick={() => { setQuote({ rate: pr(from, to), at: Date.now() }); setLeft(LOCK); }}>Get a new rate</button>}</div></div>}
              {step === 'done' && done && <div className="done">
                <div className="tick"><Ic n={done.s === 'Completed' ? 'check' : 'hourglass-medium'} w="bold" s={26} /></div>
                <h2 style={{ justifyContent: 'center' }}>{done.s === 'Completed' ? 'Exchange complete' : 'Sent for approval'}</h2>
                <p className="mu">{fmt(done.fa, done.f)} → {fmt(done.ta, done.t)} · Reference {done.id}</p>
                <div className="qa" style={{ justifyContent: 'center' }}><button className="btn p" onClick={() => { reset(); setDone(null); }}>Exchange again</button><a className="btn" href="../Transactions/transactions.html">View transactions</a></div></div>}
            </div>
            <div className="card"><h2 style={{ marginBottom: 6 }}><Ic n="clock-counter-clockwise" />Exchange history</h2>
              <div className="wrap"><table><thead><tr><th>Reference</th><th>Date</th><th>From</th><th>To</th><th>Rate</th><th>Status</th></tr></thead><tbody>
                {hist.map(h => <tr key={h.id}><td><b>{h.id}</b></td><td className="mu">{h.d}</td><td>{fmt(h.fa, h.f)}</td><td>{fmt(h.ta, h.t)}</td><td className="mu">{rateFmt(h.rate)}</td>
                  <td><span className={'pill ' + (h.s === 'Completed' ? 'completed' : 'pending')}>{h.s}</span></td></tr>)}</tbody></table></div></div>
          </div>
          <div className="col">
            <div className="card"><div className="row"><h2><Ic n="chart-line-up" />Live rates</h2><span className="live">Updating</span></div>
              {PAIRS.map(([f, t]) => { const r = pr(f, t), ch = (r / pr(f, t, open) - 1) * 100; return <div className="rate" key={f + t}>
                <div><b>{f}/{t}</b><div className="mu fine">1 {f} = {rateFmt(r)} {t}</div></div><Mini d={ticks.map(x => pr(f, t, x))} />
                <span className={'fine ' + (ch >= 0 ? 'up' : 'dn')}>{ch >= 0 ? '+' : '−'}{Math.abs(ch).toFixed(2)}%</span></div>; })}
              <p className="mu fine" style={{ margin: '8px 0 0' }}>Sample rates for the prototype.</p></div>
            <div className="card"><div className="row" style={{ marginBottom: 6 }}><h2><Ic n="bell-ringing" />Rate alerts</h2><button className="btn sm" onClick={() => setModal(true)}><Ic n="plus" s={14} />New alert</button></div>
              {alerts.length === 0 && <p className="mu">No alerts yet. Create one to hear when a rate reaches your target.</p>}
              {alerts.map(al => <div className="rate" key={al.id}><div><b>{al.f}/{al.t} {al.dir} {rateFmt(al.target)}</b><div className="mu fine">Now {rateFmt(pr(al.f, al.t))}</div></div>
                <span className="acts"><span className={'pill ' + (reached(al) ? 'completed' : 'info')}>{reached(al) ? 'Reached' : 'Watching'}</span>
                  <button className="btn sm d" aria-label={`Delete alert ${al.f}/${al.t}`} onClick={() => { setAlerts(l => l.filter(x => x.id !== al.id)); setToast('Alert deleted'); }}><Ic n="trash" s={14} /></button></span></div>)}</div>
          </div></div>
        {modal && <Modal title="New rate alert" onClose={() => setModal(false)}>{close => <AlertForm accts={accts} close={close} onSave={v => { setAlerts(l => [{ id: Date.now(), ...v }, ...l]); setToast('Alert created'); }} />}</Modal>}
        {toast && <div className="toast" role="status">{toast}</div>}
      </>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
