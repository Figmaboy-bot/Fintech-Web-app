const { useState, useEffect } = React;
const { Ic, Sidebar } = Montra;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const OVERVIEW = '../overview/overview.html';
const ACCTS = [{ c: 'USD', n: 'US Operating', v: 48200, r: 1 }, { c: 'EUR', n: 'EU Collections', v: 12450.75, r: 1.08 }, { c: 'GBP', n: 'UK Payouts', v: 8320.1, r: 1.27 }, { c: 'NGN', n: 'Lagos Local', v: 6450000, r: 0.00065 }];
const FLAT = { USD: 1, EUR: 1, GBP: 1, NGN: 50 }, FXFEE = 0.006, APPROVAL = 10000, LIMIT = 50000;
const r2 = x => Math.round(x * 100) / 100;
const fr = r => r >= 1 ? r.toLocaleString('en-US', { maximumFractionDigits: 2 }) : r.toPrecision(3);
const dl = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const mask = b => '•••• ' + b.acct.replace(/\s/g, '').slice(-4);
const goOverview = () => { location.href = OVERVIEW };

const kv = (k, v, cls) => <div className={'kv ' + (cls || '')} key={k}><span className="mu">{k}</span><span>{v}</span></div>;

function SendMoney() {
  const [step, setStep] = useState(0), [bens, setBens] = useState(() => MontraStore.beneficiaries()), [bid, setBid] = useState(() => { const m = /[#&]to=(\d+)/.exec(location.hash); return m && MontraStore.beneficiaries().some(b => String(b.id) === m[1]) ? Number(m[1]) : null; }), [q, setQ] = useState(''), [adding, setAdding] = useState(false);
  const [nb, setNb] = useState({ name: '', bank: '', acct: '', cur: 'USD' });
  const [from, setFrom] = useState('USD'), [amt, setAmt] = useState(''), [ref, setRef] = useState(''), [when, setWhen] = useState('now'), [date, setDate] = useState('');
  const [touched, setTouched] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(null);
  useEffect(() => { window.scrollTo(0, 0) }, [step, done]);
  const first = React.useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } MontraStore.saveBeneficiaries(bens); }, [bens]);
  const acctErr = nb.acct.trim() ? MontraStore.checkAccount(nb.cur, nb.acct) : '';

  const ben = bens.find(b => b.id === bid), acc = ACCTS.find(a => a.c === from);
  const n = parseFloat(amt) || 0, cross = !!ben && ben.cur !== from;
  const rate = ben ? acc.r / ACCTS.find(a => a.c === ben.cur).r : 1;
  const fx = cross ? r2(n * FXFEE) : 0, flat = n > 0 ? FLAT[from] : 0, fee = r2(flat + fx), total = r2(n + fee), recv = n * rate, usd = n * acc.r;
  const needsApproval = usd > APPROVAL;
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const est = ben && ben.cur === 'NGN' && from === 'NGN' ? 'Within minutes' : cross ? '1–2 business days' : 'Same day';
  const err = n <= 0 ? 'Enter an amount to send.' : total > acc.v ? `Not enough in ${acc.n}. Available: ${fmt(acc.v, from)}.` : usd > LIMIT ? 'This is above the $50,000 per-transfer limit.' : when === 'later' && !date ? 'Choose a date for the scheduled transfer.' : '';

  const list = bens.filter(b => (b.name + ' ' + b.bank).toLowerCase().includes(q.toLowerCase()));
  const addBen = () => { const b = { id: Date.now(), name: nb.name.trim(), bank: nb.bank.trim() || 'Bank', acct: MontraStore.clean(nb.acct), cur: nb.cur, type: 'Business', country: '', email: '', verified: false, hist: [] }; setBens([b, ...bens]); setBid(b.id); setAdding(false); setNb({ name: '', bank: '', acct: '', cur: 'USD' }) };
  const useMax = () => setAmt(String(Math.max(0, Math.floor((acc.v - FLAT[from]) / (1 + (cross ? FXFEE : 0)) * 100) / 100)));
  const next = () => { setTouched(true); if (!err) setStep(2) };
  const confirm = () => { setBusy(true); setTimeout(() => { setDone({ id: 'TRF-' + Math.floor(100000 + Math.random() * 900000), ben, acc, n, fee, total, recv, cross, rate, ref, when, date, needsApproval, est }); setBusy(false) }, 900) };
  const reset = () => { setStep(0); setBid(null); setAmt(''); setRef(''); setWhen('now'); setDate(''); setTouched(false); setDone(null); setQ('') };
  const receipt = r => { const t = ['Montra transfer receipt', 'Reference: ' + r.id, 'To: ' + r.ben.name + ' (' + r.ben.bank + ')', 'Amount: ' + fmt(r.n, r.acc.c), 'Fee: ' + fmt(r.fee, r.acc.c), 'Total debited: ' + fmt(r.total, r.acc.c), 'Recipient gets: ' + fmt(r.recv, r.ben.cur)].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' })); a.download = r.id + '.txt'; a.click() };

  if (done) {
    const r = done, later = r.when === 'later', pend = r.needsApproval && !later;
    const title = later ? 'Transfer scheduled' : pend ? 'Sent for approval' : 'Transfer initiated';
    const tone = later ? 'b' : pend ? 'w' : '';
    const tl = later ? [['Created', 'd1'], ['Scheduled for ' + dl(r.date), 'd2'], ['Sent to bank', ''], ['Delivered', '']]
      : pend ? [['Created', 'd1'], ['Awaiting approval from Finance Manager', 'd2'], ['Sent to bank', ''], ['Delivered', '']]
        : [['Created', 'd1'], ['Sent to bank', 'd1'], ['Processing', 'd2'], ['Delivered · ' + r.est, '']];
    return <div style={{ maxWidth: 560, margin: '0 auto' }}><div className="card">
      <div className="hero"><div className={'big ' + tone}><Ic n={later ? 'calendar-check' : pend ? 'clock' : 'check-circle'} w="fill" s={30} /></div>
        <h1>{title}</h1><p className="sub">{fmt(r.n, r.acc.c)} to {r.ben.name}</p></div>
      {kv('Reference', r.id)}{kv('Recipient gets', fmt(r.recv, r.ben.cur))}{kv('Total debited', fmt(r.total, r.acc.c))}{kv('Fee', fmt(r.fee, r.acc.c))}{r.ref && kv('Note', r.ref)}
      <ul className="tl" style={{ marginTop: 12 }} aria-label="Transfer progress">{tl.map(([t, c]) => <li key={t} className={c}><Ic n={c === 'd1' ? 'check-circle' : c === 'd2' ? 'clock' : 'circle'} w={c ? 'fill' : 'regular'} s={18} />{t}</li>)}</ul>
      <div className="actions" style={{ flexWrap: 'wrap' }}><button className="btn" onClick={() => receipt(r)}><Ic n="download-simple" />Receipt</button>
        <span style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={reset}>Send another</button><button className="btn p" onClick={goOverview}>Back to overview</button></span></div>
    </div></div>
  }

  const summary = <div className="card"><h2><Ic n="receipt" />Summary</h2><div style={{ marginTop: 6 }}>
    {kv('To', ben ? ben.name : '—')}{kv('From', acc.n)}{kv('You send', n > 0 ? fmt(n, from) : '—')}
    {cross && kv('Rate', '1 ' + from + ' = ' + fr(rate) + ' ' + ben.cur)}
    {n > 0 && kv('Transfer fee', fmt(flat, from))}{cross && n > 0 && kv('FX fee (0.6%)', fmt(fx, from))}
    {kv('Total debited', n > 0 ? fmt(total, from) : '—', 't')}
    {ben && n > 0 && kv('Recipient gets', fmt(recv, ben.cur))}
    {ben && kv('Arrival', when === 'later' && date ? 'On ' + dl(date) : est)}
  </div><p className="mu fine" style={{ margin: '10px 0 0' }}>Limit: {fmt(LIMIT)} per transfer. Over {fmt(APPROVAL)} needs approval.</p></div>;

  return <>
    <div className="steps" aria-label="Progress">{['Recipient', 'Amount', 'Review'].map((s, i) => <div key={s} className={'stp ' + (i === step ? 'on' : i < step ? 'ok' : '')} aria-current={i === step ? 'step' : undefined}><i>{i < step ? <Ic n="check" w="bold" s={13} /> : i + 1}</i>{s}</div>)}</div>
    <div className="g g2">
      {step === 0 && <div className="card">
        <div className="row" style={{ marginBottom: 12 }}><h2><Ic n="users" />Choose a recipient</h2><button className="btn sm" onClick={() => setAdding(!adding)}><Ic n={adding ? 'x' : 'plus'} s={14} />{adding ? 'Cancel' : 'New recipient'}</button></div>
        {adding && <div className="card" style={{ background: 'var(--bg)', marginBottom: 12 }}>
          <div className="field"><label className="f" htmlFor="nn">Name</label><input id="nn" value={nb.name} onChange={e => setNb({ ...nb, name: e.target.value })} placeholder="Business or person" /></div>
          <div className="two"><div className="field"><label className="f" htmlFor="nbk">Bank</label><input id="nbk" value={nb.bank} onChange={e => setNb({ ...nb, bank: e.target.value })} /></div>
            <div className="field"><label className="f" htmlFor="nc">Currency</label><select id="nc" value={nb.cur} onChange={e => setNb({ ...nb, cur: e.target.value })}>{ACCTS.map(a => <option key={a.c}>{a.c}</option>)}</select></div></div>
          <div className="field"><label className="f" htmlFor="na">Account number or IBAN</label><input id="na" value={nb.acct} onChange={e => setNb({ ...nb, acct: e.target.value })} aria-invalid={!!acctErr} />{acctErr && <p className="err" role="alert">{acctErr}</p>}</div>
          <button className="btn p" disabled={!nb.name.trim() || !nb.acct.trim() || !!acctErr} onClick={addBen}>Save and select</button></div>}
        <div className="field"><label className="f" htmlFor="q">Search saved recipients</label><input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="Name or bank" /></div>
        <div role="radiogroup" aria-label="Recipients">{list.map(b => <button key={b.id} role="radio" aria-checked={bid === b.id} className="opt" onClick={() => setBid(b.id)}>
          <span className="flag">{b.cur}</span><span className="grow"><b>{b.name}</b><small>{b.bank} · {mask(b)} · {b.type}</small></span>{bid === b.id && <Ic n="check-circle" w="fill" />}</button>)}
          {list.length === 0 && <p className="mu">No recipients match “{q}”.</p>}</div>
        <div className="actions"><button className="btn" onClick={goOverview}>Cancel</button><button className="btn p" disabled={!ben} onClick={() => setStep(1)}>Continue</button></div>
      </div>}

      {step === 1 && <div className="card"><h2><Ic n="coins" />Amount and timing</h2>
        <div className="field" style={{ marginTop: 14 }}><label className="f" htmlFor="from">From account</label><select id="from" value={from} onChange={e => setFrom(e.target.value)}>{ACCTS.map(a => <option key={a.c} value={a.c}>{a.n} · {fmt(a.v, a.c)}</option>)}</select></div>
        <div className="field"><label className="f" htmlFor="amt">You send</label>
          <div className="amtw"><span>{from}</span><input id="amt" type="number" inputMode="decimal" min="0" step="any" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} aria-invalid={touched && !!err} /></div>
          {touched && err && <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{err}</div>}
          <div className="row" style={{ marginTop: 6 }}><span className="mu fine">Available {fmt(acc.v, from)}</span><button className="btn sm" onClick={useMax}>Use max</button></div></div>
        {ben && n > 0 && <div className="recv"><span className="mu fine">{ben.name} receives</span><b>{fmt(recv, ben.cur)}</b></div>}
        <div className="field"><label className="f" htmlFor="ref">Reference (optional)</label><input id="ref" maxLength={60} value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. Invoice INV-1042" /></div>
        <div className="field"><div className="f" style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 5 }}>When</div>
          <div className="seg" role="radiogroup" aria-label="When to send"><button role="radio" aria-checked={when === 'now'} className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}>Send now</button><button role="radio" aria-checked={when === 'later'} className={when === 'later' ? 'on' : ''} onClick={() => setWhen('later')}>Schedule</button></div>
          {when === 'later' && <div style={{ marginTop: 10, maxWidth: 220 }}><label className="f" htmlFor="dt">Send on</label><input id="dt" type="date" min={tomorrow} value={date} onChange={e => setDate(e.target.value)} /></div>}</div>
        {needsApproval && <div className="alert i"><Ic n="seal-check" w="fill" />Transfers over {fmt(APPROVAL)} need approval from a Finance Manager before they are sent.</div>}
        <div className="actions"><button className="btn" onClick={() => setStep(0)}><Ic n="arrow-left" s={15} />Back</button><button className="btn p" onClick={next}>Review transfer</button></div>
      </div>}

      {step === 2 && <div className="card"><h2><Ic n="seal-check" />Review your transfer</h2>
        <div style={{ marginTop: 6 }}>
          {kv('Recipient', <><b>{ben.name}</b> <button className="btn sm" onClick={() => setStep(0)}>Edit</button><div className="mu fine">{ben.bank} · {mask(ben)}</div></>)}
          {kv('Amount', <><b>{fmt(n, from)}</b> <button className="btn sm" onClick={() => setStep(1)}>Edit</button><div className="mu fine">from {acc.n}</div></>)}
          {kv('When', when === 'later' ? 'On ' + dl(date) : 'Now')}
          {kv('Reference', ref || 'None')}
        </div>
        {needsApproval && <div className="alert i"><Ic n="seal-check" w="fill" />Funds stay in your account until a Finance Manager approves this transfer.</div>}
        {when === 'later' && <div className="alert i"><Ic n="calendar-check" w="fill" />Funds are debited on the scheduled date, not today.</div>}
        <div className="actions"><button className="btn" onClick={() => setStep(1)} disabled={busy}><Ic n="arrow-left" s={15} />Back</button>
          <button className="btn p" onClick={confirm} disabled={busy}>{busy ? 'Sending…' : needsApproval ? 'Submit for approval' : when === 'later' ? 'Schedule transfer' : 'Confirm and send'}</button></div>
      </div>}
      {summary}
    </div></>;
}

function App() {
  return <div className="app">
    <Sidebar here="Payments" />
    <main>
      <div className="top"><div><h1>Send money</h1><p className="sub">Pay a saved recipient or add a new one. You will review everything before it goes out.</p></div>
        <div className="qa"><a className="btn" href="../Recipients/recipients.html"><Ic n="address-book" s={15} />Recipients</a><a className="btn" href="../Bulk/bulk.html"><Ic n="rows" s={15} />Bulk payment</a><button className="btn" onClick={goOverview}><Ic n="arrow-left" s={15} />Overview</button></div></div>
      <SendMoney />
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);