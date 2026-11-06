const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Montra;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const ACCTS = [{ c: 'USD', n: 'US Operating', v: 48200, r: 1 }, { c: 'EUR', n: 'EU Collections', v: 12450.75, r: 1.08 }, { c: 'GBP', n: 'UK Payouts', v: 8320.1, r: 1.27 }, { c: 'NGN', n: 'Lagos Local', v: 6450000, r: 0.00065 }];
const APPROVAL = 10000; /* same approval limit as Send money */
const TODAY = new Date(2026, 10, 3);
const CATS = ['Software', 'Infrastructure', 'Rent', 'Payroll', 'Utilities', 'Other'];
const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const days = s => Math.round((D(s) - TODAY) / 864e5);
const short = s => D(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const next = (s, rep) => { const d = D(s); if (rep === 'Monthly') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1); return iso(d); };
const SEED = [
  { id: 1, vendor: 'Ikeja Electric', cat: 'Utilities', amt: 185000, cur: 'NGN', due: '2026-11-01', rep: 'Monthly', auto: false, sub: false, status: 'open' },
  { id: 2, vendor: 'Office rent', cat: 'Rent', amt: 3800, cur: 'USD', due: '2026-11-05', rep: 'Monthly', auto: true, sub: false, status: 'open' },
  { id: 3, vendor: 'Gusto payroll', cat: 'Payroll', amt: 18400, cur: 'USD', due: '2026-11-08', rep: 'Monthly', auto: false, sub: false, status: 'approval' },
  { id: 4, vendor: 'Notion annual', cat: 'Software', amt: 960, cur: 'USD', due: '2026-11-12', rep: 'Yearly', auto: false, sub: true, remind: true, status: 'open' },
  { id: 5, vendor: 'AWS', cat: 'Infrastructure', amt: 1284.5, cur: 'USD', due: '2026-11-15', rep: 'Monthly', auto: true, sub: true, remind: false, status: 'open' },
  { id: 6, vendor: 'Google Workspace', cat: 'Software', amt: 144, cur: 'USD', due: '2026-11-18', rep: 'Monthly', auto: true, sub: true, remind: false, status: 'open' },
  { id: 7, vendor: 'Slack', cat: 'Software', amt: 96, cur: 'USD', due: '2026-11-20', rep: 'Monthly', auto: true, sub: true, remind: true, status: 'open' },
  { id: 8, vendor: 'Figma', cat: 'Software', amt: 180, cur: 'USD', due: '2026-11-30', rep: 'Monthly', auto: true, sub: true, remind: true, status: 'open' },
  { id: 9, vendor: 'Office rent', cat: 'Rent', amt: 3800, cur: 'USD', due: '2026-10-05', rep: 'Monthly', paidOn: 'Oct 5', status: 'paid' },
  { id: 10, vendor: 'Gusto payroll', cat: 'Payroll', amt: 18400, cur: 'USD', due: '2026-10-08', rep: 'Monthly', paidOn: 'Oct 8', status: 'paid' },
  { id: 11, vendor: 'AWS', cat: 'Infrastructure', amt: 1284.5, cur: 'USD', due: '2026-10-15', rep: 'Monthly', paidOn: 'Oct 15', status: 'paid' },
  { id: 12, vendor: 'Figma', cat: 'Software', amt: 180, cur: 'USD', due: '2026-10-30', rep: 'Monthly', paidOn: 'Oct 30', status: 'paid' }
];
const usd = b => b.amt * ACCTS.find(a => a.c === b.cur).r;
const duePill = b => { const n = days(b.due); return n < 0 ? ['failed', `Overdue ${-n} day${n === -1 ? '' : 's'}`] : n === 0 ? ['pending', 'Due today'] : n <= 7 ? ['pending', `Due in ${n} day${n === 1 ? '' : 's'}`] : ['info', short(b.due)]; };

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="m-t"><div className="mb"><h2 id="m-t">{title}</h2>{children(() => ref.current.close())}</div></dialog>;
}
function BillForm({ b, vendors, onSave, onDelete, close }) {
  const [vendor, setVendor] = useState(b ? b.vendor : ''), [amt, setAmt] = useState(b ? String(b.amt) : ''), [cur, setCur] = useState(b ? b.cur : 'USD'), [cat, setCat] = useState(b ? b.cat : 'Software');
  const [due, setDue] = useState(b ? b.due : iso(new Date(2026, 10, 10))), [rep, setRep] = useState(b ? b.rep : 'None'), [auto, setAuto] = useState(b ? !!b.auto : false), [err, setErr] = useState('');
  const go = e => {
    e.preventDefault(); const n = parseFloat(String(amt).replace(/,/g, ''));
    if (!vendor.trim()) return setErr('Enter who this bill is from.');
    if (!(n > 0)) return setErr('Enter an amount greater than zero.');
    if (!due) return setErr('Choose a due date.');
    onSave({ vendor: vendor.trim(), amt: n, cur, cat, due, rep, auto, sub: b ? b.sub : (cat === 'Software' || cat === 'Infrastructure') && rep !== 'None' }); close();
  };
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <label>Vendor<input value={vendor} list="vend" autoFocus={!b} disabled={!!b} placeholder="Who are you paying?" onChange={e => { setVendor(e.target.value); setErr(''); }} /><datalist id="vend">{vendors.map(v => <option key={v} value={v} />)}</datalist></label>
    <div className="field"><label>Amount<input value={amt} inputMode="decimal" placeholder="0.00" onChange={e => { setAmt(e.target.value); setErr(''); }} /></label>
      <label>Currency<select value={cur} disabled={!!b} onChange={e => setCur(e.target.value)}>{ACCTS.map(a => <option key={a.c}>{a.c}</option>)}</select></label></div>
    <div className="field"><label>Due date<input type="date" value={due} onChange={e => { setDue(e.target.value); setErr(''); }} /></label>
      <label>Repeats<select value={rep} onChange={e => setRep(e.target.value)}><option>None</option><option>Monthly</option><option>Yearly</option></select></label></div>
    <label>Category<select value={cat} onChange={e => setCat(e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="chk"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />Pay automatically on the due date from the {cur} account</label>
    <p className="err" role="alert">{err}</p>
    <div className="qa">{b && <button type="button" className="btn d" onClick={() => { onDelete(); close(); }}>Delete bill</button>}<span className="sp" /><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">{b ? 'Save changes' : 'Add bill'}</button></div></form>;
}

function App() {
  const [page, setPage] = useState('Bills & Subscriptions'), [tab, setTab] = useState('Upcoming'), [bills, setBills] = useState(SEED), [accts, setAccts] = useState(ACCTS);
  const [modal, setModal] = useState(null), [toast, setToast] = useState(''), [perr, setPerr] = useState('');
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id); }, [toast]);
  const open = bills.filter(b => b.status !== 'paid' && !b.cancelled).sort((a, b) => a.due.localeCompare(b.due)), paid = bills.filter(b => b.status === 'paid').sort((a, b) => b.due.localeCompare(a.due));
  const subs = bills.filter(b => b.sub && b.status !== 'paid'), vendors = [...new Set(bills.map(b => b.vendor))];
  const patch = (id, p) => setBills(l => l.map(b => b.id === id ? { ...b, ...p } : b));
  const bal = c => accts.find(a => a.c === c).v;
  const stats = useMemo(() => {
    const od = open.filter(b => days(b.due) < 0), wk = open.filter(b => days(b.due) >= 0 && days(b.due) <= 7), m30 = open.filter(b => days(b.due) >= 0 && days(b.due) <= 30);
    return { od, wk, m30, sum: a => a.reduce((s, b) => s + usd(b), 0) };
  }, [bills]);
  const subMonthly = subs.filter(b => !b.cancelled).reduce((s, b) => s + usd(b) / (b.rep === 'Yearly' ? 12 : 1), 0);
  const pay = b => {
    if (usd(b) > APPROVAL) { patch(b.id, { status: 'approval' }); setToast(`${b.vendor} sent for approval`); return true; }
    if (b.amt > bal(b.cur)) { setPerr(`Not enough in the ${b.cur} account. Available: ${fmt(bal(b.cur), b.cur)}.`); return false; }
    setAccts(l => l.map(a => a.c === b.cur ? { ...a, v: a.v - b.amt } : a));
    setBills(l => [...l.map(x => x.id === b.id ? { ...x, status: 'paid', paidOn: 'Today' } : x), ...(b.rep !== 'None' ? [{ ...b, id: Date.now(), due: next(b.due, b.rep), status: 'open', paidOn: undefined }] : [])]);
    setToast(`Paid ${b.vendor}`); return true;
  };
  const tabs = [['Upcoming', open.length], ['Subscriptions', subs.length], ['Vendors', vendors.length], ['History', paid.length]];
  const key = (i, e) => { const n = e.key === 'ArrowRight' ? (i + 1) % 4 : e.key === 'ArrowLeft' ? (i + 3) % 4 : null; if (n === null) return; e.preventDefault(); setTab(tabs[n][0]); document.getElementById('tab-' + n).focus(); };
  const acct = c => accts.find(a => a.c === c).n;

  return <div className="app">
    <Sidebar here="Bills & Subscriptions" active={page} badges={{ 'Team & Approvals': 3 }} onNavigate={setPage} />
    <main>
      {page !== 'Bills & Subscriptions' ? <><h1>{page}</h1><p className="sub">Not designed yet – go back to Bills &amp; Subscriptions.</p></> : <>
        <div className="top"><div><h1>Bills &amp; Subscriptions</h1><p className="sub">Everything Northwind Studio owes, and when it’s due.</p></div>
          <div className="qa"><button className="btn p" onClick={() => setModal({ k: 'add' })}><Ic n="plus" />Add bill</button></div></div>
        <div className="stats">
          <div className="card stat"><small>Overdue</small><b className={stats.od.length ? 'dn' : ''}>{stats.od.length ? fmt(stats.sum(stats.od)) : 'None'}</b><span className="fine mu">{stats.od.length} bill{stats.od.length === 1 ? '' : 's'} (USD equivalent)</span></div>
          <div className="card stat"><small>Due in the next 7 days</small><b>{fmt(stats.sum(stats.wk))}</b><span className="fine mu">{stats.wk.length} bill{stats.wk.length === 1 ? '' : 's'}</span></div>
          <div className="card stat"><small>Due in the next 30 days</small><b>{fmt(stats.sum(stats.m30))}</b><span className="fine mu">{stats.m30.length} bills</span></div></div>

        <div className="tabs" role="tablist" aria-label="Bills sections">{tabs.map((t, i) => <button key={t[0]} id={'tab-' + i} role="tab" aria-selected={tab === t[0]} tabIndex={tab === t[0] ? 0 : -1} onClick={() => setTab(t[0])} onKeyDown={e => key(i, e)}>{t[0]}<span className="mu">{t[1]}</span></button>)}</div>
        <div role="tabpanel" aria-labelledby={'tab-' + tabs.findIndex(t => t[0] === tab)}>
          {tab === 'Upcoming' && <div className="card"><div className="wrap"><table><thead><tr><th>Vendor</th><th>Due</th><th>Repeats</th><th className="r">Amount</th><th className="r"><span className="sr">Actions</span></th></tr></thead><tbody>
            {open.map(b => {
              const [k, t] = duePill(b); return <tr key={b.id}><td><b>{b.vendor}</b><div className="mu fine">{b.cat}{b.auto ? ' · Auto-pay on' : ''}</div></td>
                <td>{b.status === 'approval' ? <span className="pill pending">Waiting for approval</span> : <span className={'pill ' + k}>{t}</span>}</td><td className="mu">{b.rep === 'None' ? 'One-off' : b.rep}</td><td className="r">{fmt(b.amt, b.cur)}</td>
                <td><div className="acts">{b.status === 'approval' ? <a className="btn sm" href="../Team/team.html">Review</a> : <button className="btn sm p" onClick={() => { setPerr(''); setModal({ k: 'pay', b }); }}>Pay now</button>}<button className="btn sm" onClick={() => setModal({ k: 'edit', b })}>Edit</button></div></td></tr>;
            })}
            {open.length === 0 && <tr><td colSpan="5" className="mu">You’re all caught up. Add a bill to keep track of what’s coming.</td></tr>}</tbody></table></div></div>}

          {tab === 'Subscriptions' && <>
            <div className="stats"><div className="card stat"><small>Monthly cost</small><b>{fmt(subMonthly)}</b><span className="fine mu">Yearly plans counted per month</span></div>
              <div className="card stat"><small>Yearly cost</small><b>{fmt(subMonthly * 12)}</b><span className="fine mu">At current prices</span></div>
              <div className="card stat"><small>Renewing in 30 days</small><b>{subs.filter(b => !b.cancelled && days(b.due) <= 30).length}</b><span className="fine mu">of {subs.filter(b => !b.cancelled).length} active subscriptions</span></div></div>
            <div className="subs">{subs.sort((a, b) => a.due.localeCompare(b.due)).map(b => <div key={b.id} className={'card sub-c' + (b.cancelled ? ' x' : '')}>
              <div className="line"><b>{b.vendor}</b><span className={'pill ' + (b.cancelled ? 'off' : 'completed')}>{b.cancelled ? 'Cancelled' : 'Active'}</span></div>
              <div className="amt">{fmt(b.amt, b.cur)}<span className="mu fine"> / {b.rep === 'Yearly' ? 'year' : 'month'}</span></div>
              <div className="mu fine">Renews {short(b.due)} · {b.cat} · paid from {acct(b.cur)}</div>
              <div className="line"><label className="sw-l"><button type="button" role="switch" className="sw" aria-checked={!!b.remind} aria-label={`Remind me 3 days before ${b.vendor} renews`} onClick={() => patch(b.id, { remind: !b.remind })} />Remind me 3 days before</label>
                {b.cancelled ? <button className="btn sm" onClick={() => patch(b.id, { cancelled: false })}>Undo</button> : <button className="btn sm d" onClick={() => setModal({ k: 'cancel', b })}>Cancel</button>}</div></div>)}</div></>}

          {tab === 'Vendors' && <div className="card"><div className="wrap"><table><thead><tr><th>Vendor</th><th>Category</th><th>Open bills</th><th>Next due</th><th className="r">Paid so far</th></tr></thead><tbody>
            {vendors.map(v => { const o = open.filter(b => b.vendor === v), p = bills.filter(b => b.vendor === v && b.status === 'paid'); return <tr key={v}><td><b>{v}</b></td><td className="mu">{bills.find(b => b.vendor === v).cat}</td><td>{o.length}</td><td className="mu">{o.length ? short(o[0].due) : '–'}</td><td className="r">{fmt(p.reduce((s, b) => s + usd(b), 0))}</td></tr>; })}</tbody></table></div></div>}

          {tab === 'History' && <div className="card"><div className="wrap"><table><thead><tr><th>Vendor</th><th>Paid</th><th>From</th><th className="r">Amount</th><th className="r"><span className="sr">Receipt</span></th></tr></thead><tbody>
            {paid.map(b => <tr key={b.id}><td><b>{b.vendor}</b><div className="mu fine">{b.cat}</div></td><td className="mu">{b.paidOn}</td><td className="mu">{acct(b.cur)}</td><td className="r">{fmt(b.amt, b.cur)}</td>
              <td className="r"><button className="btn sm" onClick={() => setToast(`Receipt for ${b.vendor} downloaded`)}>Receipt</button></td></tr>)}</tbody></table></div></div>}
        </div>

        {modal && modal.k === 'add' && <Modal title="Add a bill" onClose={() => setModal(null)}>{close => <BillForm vendors={vendors} close={close} onSave={v => { setBills(l => [{ id: Date.now(), ...v, status: 'open', remind: false }, ...l]); setToast(`${v.vendor} added`); }} />}</Modal>}
        {modal && modal.k === 'edit' && <Modal title={`Edit ${modal.b.vendor}`} onClose={() => setModal(null)}>{close => <BillForm b={modal.b} vendors={vendors} close={close} onSave={v => { patch(modal.b.id, v); setToast('Bill updated'); }} onDelete={() => { setBills(l => l.filter(x => x.id !== modal.b.id)); setToast(`${modal.b.vendor} deleted`); }} />}</Modal>}
        {modal && modal.k === 'pay' && <Modal title={`Pay ${modal.b.vendor}`} onClose={() => setModal(null)}>{close => <>
          <div className="kv"><span className="mu">Amount</span><b>{fmt(modal.b.amt, modal.b.cur)}</b></div>
          <div className="kv"><span className="mu">Paid from</span><span>{acct(modal.b.cur)} ({fmt(bal(modal.b.cur), modal.b.cur)})</span></div>
          {usd(modal.b) > APPROVAL && <div className="alert i"><span className="ni"><Ic n="seal-check" w="fill" />Payments over {fmt(APPROVAL)} need Finance Manager approval first.</span></div>}
          <p className="err" role="alert">{perr}</p>
          <div className="qa" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={close}>Cancel</button><button className="btn p" onClick={() => { if (pay(modal.b)) close(); }}>{usd(modal.b) > APPROVAL ? 'Send for approval' : 'Pay now'}</button></div></>}</Modal>}
        {modal && modal.k === 'cancel' && <Modal title={`Cancel ${modal.b.vendor}?`} onClose={() => setModal(null)}>{close => <>
          <p style={{ margin: 0 }}>We’ll stop tracking this subscription and turn off auto-pay. You may still need to cancel with {modal.b.vendor} directly.</p>
          <div className="qa" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={close}>Keep it</button><button className="btn p" onClick={() => { patch(modal.b.id, { cancelled: true, auto: false }); setToast(`${modal.b.vendor} cancelled`); close(); }}>Cancel subscription</button></div></>}</Modal>}
        {toast && <div className="toast" role="status">{toast}</div>}
      </>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
