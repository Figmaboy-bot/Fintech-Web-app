const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Montra;

const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const RATE = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 0.00065 };
const TODAY = new Date(2026, 10, 3);
const CATS = ['Software', 'Travel', 'Meals', 'Office', 'Marketing', 'Equipment', 'Training', 'Other'];
const BUDGET = { Engineering: 12000, Marketing: 8000, Operations: 5000, Sales: 6000 };
const AUTO = 100, ADMIN_OVER = 2500, RECEIPT_OVER = 50;
const ROLES = { employee: { label: 'Employee', who: 'Tolu A.' }, finance: { label: 'Finance Manager', who: 'Kemi R.' }, admin: { label: 'Admin', who: 'Seun D.' } };
const STATUS = { pending: ['Pending', 'pending'], approved: ['Approved', 'completed'], rejected: ['Rejected', 'failed'], paid: ['Paid', 'info'], withdrawn: ['Withdrawn', 'off'] };

const dateOf = o => { const d = new Date(TODAY); d.setDate(d.getDate() - o); return d };
const dfmt = o => dateOf(o).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dshort = o => o <= 0 ? 'Today' : o === 1 ? 'Yesterday' : dateOf(o).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ---- policy ---- */
const usd = e => e.amt * RATE[e.cur];
const chainFor = u => u < AUTO ? [] : u <= ADMIN_OVER ? ['Finance Manager'] : ['Finance Manager', 'Admin'];
const newChain = u => chainFor(u).map(r => ({ role: r, st: 'pending', who: '', off: null, note: '' }));
const policyText = u => u < AUTO ? 'Approved automatically (under ' + fmt(AUTO) + ').' : u <= ADMIN_OVER ? 'Needs Finance Manager approval.' : 'Needs Finance Manager approval, then Admin approval.';
const statusOf = e => e.withdrawn ? 'withdrawn' : e.chain.some(s => s.st === 'rejected') ? 'rejected' : e.chain.every(s => s.st === 'approved') ? (e.paid ? 'paid' : 'approved') : 'pending';
const stepOf = e => statusOf(e) === 'pending' ? e.chain.findIndex(s => s.st === 'pending') : -1;
const canAct = (e, role) => {
  const i = stepOf(e); if (i < 0 || role === 'employee' || e.by === ROLES[role].who) return false;
  return role === 'admin' || e.chain[i].role === 'Finance Manager';
};
const owed = e => statusOf(e) === 'approved' && e.pay === 'reimburse';

/* ---- sample data ---- */
const mk = (id, merchant, desc, cat, dept, cur, amt, off, by, pay, chain) => ({
  id, merchant, desc, cat, dept, cur, amt, off, by, pay, paid: false, withdrawn: false,
  receipt: amt * RATE[cur] > RECEIPT_OVER ? merchant.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf' : '',
  chain: chain.map(c => ({ role: c[0], st: c[1], who: c[2] || '', off: c.length > 3 ? c[3] : null, note: c[4] || '' }))
});
const seed = () => {
  const x = [
    mk('EXP-1042', 'Lagos Event Centre', 'Team offsite venue', 'Other', 'Operations', 'USD', 4250, 0, 'Tolu A.', 'company', [['Finance Manager', 'approved', 'Kemi R.', 0], ['Admin', 'pending']]),
    mk('EXP-1041', 'Delta Air Lines', 'Flights to Lagos for client workshop', 'Travel', 'Sales', 'USD', 1380, 1, 'Ife B.', 'reimburse', [['Finance Manager', 'pending']]),
    mk('EXP-1040', 'Wacom', 'Drawing tablet for design team', 'Equipment', 'Engineering', 'USD', 329, 2, 'Dev K.', 'company', [['Finance Manager', 'pending']]),
    mk('EXP-1039', 'Uber', 'Client visit rides', 'Travel', 'Sales', 'USD', 86.4, 3, 'Amara O.', 'reimburse', []),
    mk('EXP-1038', 'Udemy', 'Frontend testing courses', 'Training', 'Engineering', 'USD', 240, 5, 'Dev K.', 'reimburse', [['Finance Manager', 'approved', 'Kemi R.', 4]]),
    mk('EXP-1037', 'Meta Ads', 'Campaign boost', 'Marketing', 'Marketing', 'USD', 1800, 6, 'Ife B.', 'company', [['Finance Manager', 'approved', 'Kemi R.', 6]]),
    mk('EXP-1036', 'Zuma Restaurant', 'Client dinner', 'Meals', 'Sales', 'EUR', 310, 8, 'Tolu A.', 'reimburse', [['Finance Manager', 'approved', 'Kemi R.', 7]]),
    mk('EXP-1035', 'Apple', 'MacBook Pro for new engineer', 'Equipment', 'Engineering', 'USD', 3200, 9, 'Dev K.', 'company', [['Finance Manager', 'approved', 'Kemi R.', 8], ['Admin', 'approved', 'Seun D.', 8]]),
    mk('EXP-1034', 'Workstation Lagos', 'Coworking day pass', 'Office', 'Operations', 'NGN', 45000, 11, 'Amara O.', 'reimburse', []),
    mk('EXP-1033', 'Config Conference', 'Conference ticket', 'Training', 'Marketing', 'GBP', 620, 13, 'Tolu A.', 'company', [['Finance Manager', 'rejected', 'Kemi R.', 12, "Not in this quarter's training budget. Please resubmit in January."]]),
    mk('EXP-1032', 'Figma', 'Four extra design seats', 'Software', 'Engineering', 'USD', 540, 15, 'Dev K.', 'company', [['Finance Manager', 'approved', 'Kemi R.', 14]]),
    mk('EXP-1031', 'Officemart', 'Stationery', 'Office', 'Operations', 'USD', 64.2, 18, 'Tolu A.', 'reimburse', []),
    mk('EXP-1030', 'Amazon Web Services', 'Credits top-up', 'Software', 'Engineering', 'USD', 2000, 21, 'Dev K.', 'company', [['Finance Manager', 'approved', 'Kemi R.', 20]]),
    mk('EXP-1029', 'Chicken Republic', 'Team lunch', 'Meals', 'Operations', 'USD', 215, 26, 'Ife B.', 'company', [['Finance Manager', 'approved', 'Kemi R.', 25]]),
    mk('EXP-1028', 'Google Workspace', 'Extra seats', 'Software', 'Operations', 'USD', 144, 30, 'Tolu A.', 'company', [['Finance Manager', 'approved', 'Kemi R.', 29]])];
  x.find(e => e.id === 'EXP-1036').paid = true; x.find(e => e.id === 'EXP-1034').paid = true; x.find(e => e.id === 'EXP-1031').paid = true;
  return x;
};

/* ---- detail drawer ---- */
function Detail({ e, role, who, decide, withdraw, pay, resubmit, close, closeRef }) {
  const [rej, setRej] = useState(false), [reason, setReason] = useState(''), [wd, setWd] = useState(false), [touched, setTouched] = useState(false);
  const st = statusOf(e), u = usd(e), i = stepOf(e), own = e.by === who, can = canAct(e, role);
  const blockedSelf = st === 'pending' && own && role !== 'employee' && (role === 'admin' || e.chain[i].role === 'Finance Manager');
  const rejected = e.chain.find(s => s.st === 'rejected');
  const reasonErr = touched && reason.trim().length < 5 ? 'Add a short reason so the requester knows what to fix.' : '';
  return <>
    <div className="row"><h2 id="dt"><Ic n="receipt" />Expense details</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close details"><Ic n="x" /></button></div>
    <div className="dh"><div className="mu">{e.merchant}</div><div className="big">{fmt(e.amt, e.cur)}</div>
      <span className={'pill ' + STATUS[st][1]}>{STATUS[st][0]}</span>{e.cur !== 'USD' && <span className="mu sm2"> · about {fmt(u)}</span>}</div>
    {st === 'rejected' && rejected && <div className="alert e" role="alert"><Ic n="warning" w="fill" /><div><b>Rejected by {rejected.who}</b><div>{rejected.note}</div></div></div>}
    {owed(e) && <div className="alert i"><Ic n="hand-coins" w="fill" />Approved. This reimbursement is waiting to be paid out to {e.by}.</div>}

    <div className="sec">DETAILS</div>
    <div className="kv"><span className="mu">Reference</span><span>{e.id}</span></div>
    <div className="kv"><span className="mu">Requested by</span><span>{e.by}</span></div>
    <div className="kv"><span className="mu">Date</span><span>{dfmt(e.off)}</span></div>
    <div className="kv"><span className="mu">Description</span><span>{e.desc || '—'}</span></div>
    <div className="kv"><span className="mu">Category</span><span>{e.cat}</span></div>
    <div className="kv"><span className="mu">Department</span><span>{e.dept}</span></div>
    <div className="kv"><span className="mu">Paid</span><span>{e.pay === 'reimburse' ? 'Out of pocket (reimburse)' : 'Company funds'}</span></div>
    <div className="kv"><span className="mu">Receipt</span><span>{e.receipt ? <><Ic n="paperclip" s={14} /> {e.receipt}</> : 'Not required'}</span></div>

    <div className="sec">APPROVAL</div>
    <ol className="chain" aria-label="Approval steps">
      <li className="d1"><Ic n="check-circle" w="fill" /><div><b>Submitted</b> by {e.by}<div className="q">{dfmt(e.off)}</div></div></li>
      {e.chain.length === 0 && <li className="d1"><Ic n="check-circle" w="fill" /><div><b>Approved automatically</b><div className="q">Under the {fmt(AUTO)} approval threshold</div></div></li>}
      {e.chain.map((s, j) => {
        const c = s.st === 'approved' ? 'd1' : s.st === 'rejected' ? 'd3' : j === i ? 'd2' : '';
        const ic = s.st === 'approved' ? 'check-circle' : s.st === 'rejected' ? 'x-circle' : j === i ? 'clock' : 'circle';
        return <li key={j} className={c}><Ic n={ic} w={c ? 'fill' : 'regular'} /><div>
          <b>{s.st === 'approved' ? 'Approved' : s.st === 'rejected' ? 'Rejected' : j === i ? 'Waiting for' : 'Then'}</b> {s.st === 'pending' ? s.role : 'by ' + s.who + ' (' + s.role + ')'}
          {s.off !== null && <div className="q">{dfmt(s.off)}</div>}</div></li>
      })}
      {e.pay === 'reimburse' && st !== 'rejected' && st !== 'withdrawn' && <li className={e.paid ? 'd1' : st === 'approved' ? 'd2' : ''}><Ic n={e.paid ? 'check-circle' : st === 'approved' ? 'clock' : 'circle'} w={e.paid || st === 'approved' ? 'fill' : 'regular'} /><div><b>{e.paid ? 'Reimbursement paid' : st === 'approved' ? 'Awaiting payout' : 'Then reimbursement'}</b></div></li>}
    </ol>

    {can && !rej && <div className="acts" style={{ marginTop: 16 }}><button className="btn p" onClick={() => decide(e.id, true)}><Ic n="check" />Approve</button><button className="btn danger" onClick={() => setRej(true)}>Reject</button></div>}
    {can && rej && <div style={{ marginTop: 16 }}>
      <label className="f" htmlFor="rr">Reason for rejecting</label>
      <textarea id="rr" value={reason} onChange={ev => setReason(ev.target.value)} placeholder="Tell the requester what to change" aria-invalid={!!reasonErr} />
      {reasonErr && <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{reasonErr}</div>}
      <div className="acts" style={{ marginTop: 10 }}><button className="btn" onClick={() => { setRej(false); setTouched(false) }}>Cancel</button>
        <button className="btn danger p" onClick={() => { setTouched(true); if (reason.trim().length >= 5) decide(e.id, false, reason.trim()) }}>Reject expense</button></div></div>}
    {blockedSelf && <div className="alert i"><Ic n="info" w="fill" />You can't approve your own request. Someone else on the approval chain needs to.</div>}
    {st === 'approved' && e.pay === 'reimburse' && role !== 'employee' && <div className="acts" style={{ marginTop: 16 }}><button className="btn p" onClick={() => pay(e.id)}><Ic n="hand-coins" />Mark as paid</button></div>}

    {own && st === 'pending' && <div style={{ marginTop: 16 }}>{!wd ? <button className="btn" onClick={() => setWd(true)}>Withdraw request</button>
      : <div className="alert e" style={{ display: 'block' }}><b>Withdraw this request?</b><div style={{ margin: '4px 0 10px' }}>It will be removed from the approval queue.</div>
        <div className="acts"><button className="btn" onClick={() => setWd(false)}>Keep it</button><button className="btn danger p" onClick={() => withdraw(e.id)}>Withdraw</button></div></div>}</div>}
    {own && st === 'rejected' && <div className="acts" style={{ marginTop: 16 }}><button className="btn p" onClick={() => resubmit(e)}><Ic n="arrow-counter-clockwise" />Edit and resubmit</button></div>}
  </>;
}

/* ---- new expense drawer ---- */
function Create({ init, who, onCreate, close, closeRef }) {
  const i0 = init || {};
  const [merchant, setMerchant] = useState(i0.merchant || ''), [amt, setAmt] = useState(i0.amt ? String(i0.amt) : ''), [cur, setCur] = useState(i0.cur || 'USD'), [date, setDate] = useState(iso(TODAY));
  const [cat, setCat] = useState(i0.cat || CATS[0]), [dept, setDept] = useState(i0.dept || 'Engineering'), [desc, setDesc] = useState(i0.desc || ''), [pay, setPay] = useState(i0.pay || 'company'), [receipt, setReceipt] = useState(i0.receipt || ''), [touched, setTouched] = useState(false);
  const n = parseFloat(amt) || 0, u = n * RATE[cur], needsReceipt = u > RECEIPT_OVER;
  const errs = {
    merchant: merchant.trim().length < 2 ? 'Enter the merchant or vendor.' : '',
    amt: n <= 0 ? 'Enter the amount.' : u > 50000 ? 'Amounts above $50,000 need a purchase order. Contact your admin.' : '',
    date: !date ? 'Pick the date of the expense.' : new Date(date + 'T00:00:00') > TODAY ? 'The date cannot be in the future.' : '',
    receipt: needsReceipt && !receipt ? 'Attach a receipt. It is required for expenses over ' + fmt(RECEIPT_OVER) + '.' : ''
  };
  const bad = Object.keys(errs).find(k => errs[k]);
  const E = k => touched && errs[k] ? <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{errs[k]}</div> : null;
  const submit = ev => {
    ev.preventDefault(); setTouched(true); if (bad) return;
    const off = Math.round((TODAY - new Date(date + 'T00:00:00')) / 864e5);
    onCreate({ merchant: merchant.trim(), desc: desc.trim(), cat, dept, cur, amt: n, off, by: who, pay, receipt, paid: false, withdrawn: false, chain: newChain(u) })
  };
  return <form onSubmit={submit} noValidate>
    <div className="row"><h2 id="dt"><Ic n="plus-circle" />{init ? 'Resubmit expense' : 'New expense'}</h2><button type="button" ref={closeRef} className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div className="field" style={{ marginTop: 16 }}><label className="f" htmlFor="mc">Merchant</label><input id="mc" value={merchant} onChange={ev => setMerchant(ev.target.value)} placeholder="e.g. Delta Air Lines" aria-invalid={touched && !!errs.merchant} />{E('merchant')}</div>
    <div className="two"><div className="field"><label className="f" htmlFor="am">Amount</label><input id="am" type="number" min="0" step="any" inputMode="decimal" value={amt} onChange={ev => setAmt(ev.target.value)} placeholder="0.00" aria-invalid={touched && !!errs.amt} /></div>
      <div className="field"><label className="f" htmlFor="cu">Currency</label><select id="cu" value={cur} onChange={ev => setCur(ev.target.value)}>{Object.keys(RATE).map(c => <option key={c}>{c}</option>)}</select></div></div>
    {E('amt')}
    <div className="field" style={{ marginTop: 14 }}><label className="f" htmlFor="dt2">Date of expense</label><input id="dt2" type="date" max={iso(TODAY)} value={date} onChange={ev => setDate(ev.target.value)} />{E('date')}</div>
    <div className="two"><div className="field"><label className="f" htmlFor="ct">Category</label><select id="ct" value={cat} onChange={ev => setCat(ev.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><label className="f" htmlFor="dp">Department</label><select id="dp" value={dept} onChange={ev => setDept(ev.target.value)}>{Object.keys(BUDGET).map(c => <option key={c}>{c}</option>)}</select></div></div>
    <div className="field"><label className="f" htmlFor="ds">What was it for? (optional)</label><textarea id="ds" value={desc} onChange={ev => setDesc(ev.target.value)} maxLength={140} /></div>
    <div className="f" style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 6 }}>How was it paid?</div>
    <div className="seg" role="radiogroup" aria-label="How was it paid">{[['company', 'Company funds'], ['reimburse', 'My own money']].map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={pay === k} className={pay === k ? 'on' : ''} onClick={() => setPay(k)}>{l}</button>)}</div>
    <div className="hint">{pay === 'reimburse' ? 'Once approved, Finance will pay you back.' : 'Use this when a company card or transfer covered it.'}</div>
    <div className="field" style={{ marginTop: 16 }}><label className="f" htmlFor="rc">Receipt{needsReceipt ? ' (required)' : ' (optional)'}</label>
      {receipt ? <div className="row"><span><Ic n="paperclip" s={16} /> {receipt}</span><button type="button" className="btn sm" onClick={() => setReceipt('')}>Remove</button></div>
        : <input id="rc" type="file" accept="image/*,.pdf" onChange={ev => { const f = ev.target.files[0]; if (f) setReceipt(f.name) }} />}{E('receipt')}</div>
    {n > 0 && <div className={'alert ' + (u < AUTO ? 'i' : '')}><Ic n={u < AUTO ? 'check-circle' : 'seal-check'} w="fill" />{policyText(u)}</div>}
    <div className="acts" style={{ marginTop: 20, justifyContent: 'space-between' }}><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">Submit expense</button></div>
  </form>;
}

/* ---- page ---- */
function App() {
  const hashId = decodeURIComponent(location.hash.slice(1)), linked = seed().find(e => e.id === hashId);
  const [exps, setExps] = useState(seed), [loading, setLoading] = useState(true), [role, setRole] = useState(linked && canAct(linked, 'admin') && !canAct(linked, 'finance') ? 'admin' : 'finance');
  const [tab, setTab] = useState('review'), [q, setQ] = useState(''), [status, setStatus] = useState('all'), [cat, setCat] = useState('all');
  const [drawer, setDrawer] = useState(linked ? { id: linked.id } : null), [toast, setToast] = useState(null);
  const lastRef = useRef(null), closeRef = useRef(null), nextId = useRef(1043);
  const who = ROLES[role].who, isEmp = role === 'employee';

  useEffect(() => { const t = setTimeout(() => setLoading(false), 450); return () => clearTimeout(t) }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 2600); return () => clearTimeout(t) }, [toast]);
  useEffect(() => {
    if (!drawer) return;
    if (closeRef.current) closeRef.current.focus();
    const k = ev => { if (ev.key === 'Escape') close() };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [drawer]);

  const say = (msg, undo) => setToast({ msg, undo });
  const open = (d, ev) => { lastRef.current = ev.currentTarget; setDrawer(d) };
  const close = () => { setDrawer(null); setTimeout(() => { if (lastRef.current && lastRef.current.focus) lastRef.current.focus() }, 0) };
  const switchRole = r => { setRole(r); setTab(r === 'employee' ? 'mine' : 'review'); setDrawer(null); setQ(''); setStatus('all'); setCat('all') };
  const patch = (id, fn) => setExps(es => es.map(e => e.id === id ? fn(e) : e));

  const decide = (id, ok, note) => {
    const prev = exps.find(e => e.id === id), i = stepOf(prev); if (i < 0) return;
    patch(id, e => ({ ...e, chain: e.chain.map((s, j) => j === i ? { ...s, st: ok ? 'approved' : 'rejected', who, off: 0, note: note || '' } : s) }));
    if (ok) say('Approved ' + prev.merchant, () => { setExps(es => es.map(e => e.id === id ? prev : e)); setToast(null) });
    else say('Rejected. ' + prev.by + ' will see your reason.');
  };
  const withdraw = id => { patch(id, e => ({ ...e, withdrawn: true })); say('Request withdrawn') };
  const pay = id => { patch(id, e => ({ ...e, paid: true })); say('Marked as paid') };
  const resubmit = e => { setDrawer({ redo: { merchant: e.merchant, desc: e.desc, cat: e.cat, dept: e.dept, cur: e.cur, amt: e.amt, pay: e.pay, receipt: e.receipt } }) };
  const create = x => {
    const id = 'EXP-' + (nextId.current++), e = { ...x, id };
    setExps(es => [e, ...es]); setTab('mine'); setStatus('all'); setCat('all'); setQ('');
    say(e.chain.length === 0 ? 'Submitted and approved automatically.' : 'Submitted. Waiting for ' + e.chain[0].role + '.');
    setDrawer({ id });
  };

  const scope = useMemo(() => isEmp ? exps.filter(e => e.by === who) : exps, [exps, isEmp, who]);
  const toReview = exps.filter(e => canAct(e, role));
  const tabs = isEmp ? [['mine', 'My requests']] : [['review', 'To approve (' + toReview.length + ')'], ['mine', 'My requests'], ['all', 'All expenses']];
  const base = tab === 'review' ? toReview : tab === 'mine' ? exps.filter(e => e.by === who) : scope;
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return base.filter(e => (status === 'all' || statusOf(e) === status) && (cat === 'all' || e.cat === cat) && (!ql || (e.merchant + ' ' + e.desc + ' ' + e.id + ' ' + e.by).toLowerCase().includes(ql))).sort((a, b) => a.off - b.off);
  }, [base, q, status, cat]);
  const active = q || status !== 'all' || cat !== 'all';
  const clear = () => { setQ(''); setStatus('all'); setCat('all') };

  const pend = scope.filter(e => statusOf(e) === 'pending'), appr = scope.filter(e => ['approved', 'paid'].includes(statusOf(e)) && e.off <= 30), owing = scope.filter(owed);
  const sum = l => l.reduce((a, e) => a + usd(e), 0);
  const spend = d => exps.filter(e => e.dept === d && ['approved', 'paid'].includes(statusOf(e)) && e.off <= 30).reduce((a, e) => a + usd(e), 0);
  const committed = d => exps.filter(e => e.dept === d && statusOf(e) === 'pending').reduce((a, e) => a + usd(e), 0);
  const stat = (l, v, d) => <div className="card stat"><small>{l}</small><b>{loading ? '—' : v}</b><span className="d">{d}</span></div>;
  const sel = drawer && drawer.id ? exps.find(e => e.id === drawer.id) : null;

  const exportCsv = () => {
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['Reference', 'Date', 'Merchant', 'Description', 'Category', 'Department', 'Requested by', 'Currency', 'Amount', 'Status'].join(',')]
      .concat(rows.map(e => [e.id, iso(dateOf(e.off)), e.merchant, e.desc, e.cat, e.dept, e.by, e.cur, e.amt, statusOf(e)].map(esc).join(',')));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'Montra-expenses.csv'; a.click();
    say(rows.length + ' expenses exported');
  };

  return <div className="app"><Sidebar here="Expenses" />
    <main>
      <div className="top"><div><h1>Expenses</h1><p className="sub">Request spending, attach receipts and follow every request through approval.</p></div>
        <div className="qa"><div className="role"><label htmlFor="rs">Viewing as</label><select id="rs" value={role} onChange={ev => switchRole(ev.target.value)}>{Object.keys(ROLES).map(k => <option key={k} value={k}>{ROLES[k].label} · {ROLES[k].who}</option>)}</select></div>
          {!isEmp && <button className="btn" onClick={exportCsv} disabled={!rows.length}><Ic n="download-simple" />Export CSV</button>}
          <button className="btn p" onClick={ev => open('new', ev)}><Ic n="plus" />New expense</button></div></div>

      <div className="stats">
        {stat('Pending approval', pend.length, '≈ ' + fmt(sum(pend)) + ' waiting')}
        {stat('Approved · last 30 days', '≈ ' + fmt(sum(appr)), appr.length + ' expenses')}
        {stat('To reimburse', '≈ ' + fmt(sum(owing)), owing.length + ' approved, not yet paid')}
        {isEmp ? stat('Rejected', scope.filter(e => statusOf(e) === 'rejected').length, 'Needs your changes') : stat('Needs your approval', toReview.length, toReview.length ? 'Waiting on you' : 'You are all caught up')}
      </div>

      {!isEmp && <div className="card" style={{ marginBottom: 14 }}><h2><Ic n="chart-pie-slice" />Department budgets · last 30 days</h2>
        <div className="bud">{Object.keys(BUDGET).map(d => {
          const s = spend(d), c = committed(d), pct = Math.min(100, Math.round(s / BUDGET[d] * 100));
          return <div key={d}><div className="row sm2"><b>{d}</b><span className="mu">{pct}%</span></div>
            <div className={'bar ' + (pct >= 100 ? 'full' : pct >= 85 ? 'warn' : '')} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={d + ' budget used'}><i style={{ width: pct + '%' }} /></div>
            <div className="sm2 mu">{fmt(s)} of {fmt(BUDGET[d])}{c > 0 && ' · ' + fmt(c) + ' pending'}</div></div>
        })}</div></div>}

      <div className="card">
        <div className="filters" role="search">
          <div className="seg" role="tablist" aria-label="Expense view">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div className="srch"><span className="si"><Ic n="magnifying-glass" s={16} /></span><input aria-label="Search expenses" placeholder="Search merchant, reference or person" value={q} onChange={ev => setQ(ev.target.value)} /></div>
          <select aria-label="Status" value={status} onChange={ev => setStatus(ev.target.value)}><option value="all">All statuses</option>{Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k][0]}</option>)}</select>
          <select aria-label="Category" value={cat} onChange={ev => setCat(ev.target.value)}><option value="all">All categories</option>{CATS.map(c => <option key={c}>{c}</option>)}</select>
          {active && <button className="btn sm" onClick={clear}>Clear filters</button>}
        </div>

        {!loading && rows.length === 0 ?
          <div className="empty"><Ic n={tab === 'review' && !active ? 'check-circle' : 'receipt'} s={32} />
            <b>{active ? 'No expenses match' : tab === 'review' ? 'Nothing to approve' : 'No expenses yet'}</b>
            {active ? 'Try a different search or clear your filters.' : tab === 'review' ? 'You are all caught up. New requests will show up here.' : 'Submit your first expense to start the approval flow.'}
            <div>{active ? <button className="btn" onClick={clear}>Clear filters</button> : tab !== 'review' && <button className="btn p" onClick={ev => open('new', ev)}>New expense</button>}</div></div>
          : <div className="wrap"><table aria-busy={loading}>
            <thead><tr><th>Date</th><th>Expense</th><th className="hide-s">Requested by</th><th className="hide-s">Category</th><th>Status</th><th className="r">Amount</th></tr></thead>
            <tbody>{loading ? [0, 1, 2, 3, 4].map(i => <tr key={i}>{[60, 170, 80, 70, 80, 80].map((w, j) => <td key={j} className={j === 2 || j === 3 ? 'hide-s' : ''}><div className="sk" style={{ width: w, marginLeft: j === 5 ? 'auto' : 0 }} /></td>)}</tr>)
              : rows.map(e => {
                const st = statusOf(e), i = stepOf(e);
                return <tr key={e.id} className="rw" onClick={ev => open({ id: e.id }, ev)}>
                  <td className="mu nw">{dshort(e.off)}</td>
                  <td><button className="lnk" onClick={ev => { ev.stopPropagation(); open({ id: e.id }, ev) }}>{e.merchant}</button>{e.receipt && <Ic n="paperclip" s={14} />}<div className="mu sm2">{e.desc || e.cat} · {e.id}</div></td>
                  <td className="hide-s">{e.by}</td><td className="hide-s">{e.cat}</td>
                  <td><span className={'pill ' + STATUS[st][1]}>{STATUS[st][0]}</span>{st === 'pending' && <div className="mu sm2">Waiting for {e.chain[i].role}</div>}{owed(e) && <div className="mu sm2">Awaiting payout</div>}</td>
                  <td className="r nw">{fmt(e.amt, e.cur)}</td></tr>
              })}</tbody></table></div>}
      </div>

      {drawer && <><div className="ov" onClick={close} />
        <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dt">
          {drawer === 'new' ? <Create who={who} onCreate={create} close={close} closeRef={closeRef} />
            : drawer.redo ? <Create init={drawer.redo} who={who} onCreate={create} close={close} closeRef={closeRef} />
              : sel ? <Detail key={sel.id + role} e={sel} role={role} who={who} decide={decide} withdraw={withdraw} pay={pay} resubmit={resubmit} close={close} closeRef={closeRef} /> : null}</div></>}
      {toast && <div className="toast" role="status">{toast.msg}{toast.undo && <button onClick={toast.undo}>Undo</button>}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);