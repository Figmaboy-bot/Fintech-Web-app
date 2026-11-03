const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Ledgerly;

const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const RATE = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 0.00065 };
const TODAY = new Date(2026, 10, 3);
const CATS = ['Software', 'Cloud', 'Advertising', 'Travel', 'Meals', 'Office', 'Contractors', 'ATM cash'];
const PEOPLE = ['Tolu A.', 'Dev K.', 'Amara O.', 'Ife B.', 'Marketing team'];
const APPROVE = 5000, MAXUSD = 25000;
const STATUS = { active: ['Active', 'completed'], frozen: ['Frozen', 'info'], pending: ['Awaiting approval', 'pending'], ordered: ['Shipping', 'info'], terminated: ['Terminated', 'off'] };
const ORDER = { active: 0, frozen: 1, ordered: 2, pending: 3, terminated: 4 };

const dshort = o => { const d = new Date(TODAY); d.setDate(d.getDate() - o); return o === 0 ? 'Today' : o === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
const expiry = m => { const d = new Date(TODAY); d.setMonth(d.getMonth() + m); return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2) };
const spent = c => c.txs.reduce((a, t) => a + t.a, 0);
const per = p => p === 'week' ? 'week' : 'month';

/* ---- sample data ---- */
const mk = (id, name, kind, holder, cur, limit, period, cats, last4, exp, status, txs, extra) => ({
  id, name, kind, holder, cur, limit, period, cats, online: true, intl: false, exp, last4, status,
  txs: txs.map(t => ({ m: t[0], d: t[1], a: t[2], rec: !!t[3] })), ...(extra || {})
});
const seed = () => [
  mk('c1', 'AWS & infrastructure', 'virtual', 'Dev K.', 'USD', 3000, 'month', ['Cloud'], '4821', '09/28', 'active', [['AWS EC2', 0, 642.25, 1], ['AWS S3', 3, 310.5, 1], ['AWS RDS', 9, 331.75, 1]]),
  mk('c2', 'Marketing ads', 'virtual', 'Marketing team', 'USD', 5000, 'month', ['Advertising'], '7730', '03/28', 'active', [['Google Ads', 1, 1420], ['Meta Ads', 4, 1100], ['LinkedIn Ads', 8, 640], ['Canva', 12, 560, 1]]),
  mk('c3', 'Software subscriptions', 'virtual', 'Tolu A.', 'USD', 1500, 'month', ['Software'], '1166', '11/27', 'active', [['Figma', 2, 180, 1], ['Notion', 6, 60, 1], ['Slack', 10, 220, 1], ['GitHub', 14, 180, 1]]),
  mk('c4', 'Team travel', 'physical', 'Tolu A.', 'USD', 4000, 'month', ['Travel', 'Meals'], '9054', '06/29', 'active', [['Delta Air Lines', 5, 980], ['Marriott', 5, 320], ['Uber', 7, 150]], { intl: true }),
  mk('c5', 'Contractor expenses', 'virtual', 'Ife B.', 'EUR', 2000, 'month', ['Contractors', 'Software'], '3382', '01/27', 'active', [['Upwork', 2, 900], ['Deel', 5, 950]]),
  mk('c6', 'Office supplies', 'physical', 'Amara O.', 'USD', 800, 'month', ['Office'], '2207', '08/27', 'frozen', [['Staples', 3, 212.4], ['Amazon Business', 11, 148.9]]),
  mk('c7', 'Conference 2025', 'virtual', 'Tolu A.', 'USD', 2500, 'week', ['Travel'], '6619', '12/26', 'terminated', [])];

/* ---- small parts ---- */
const Switch = ({ on, set, label, disabled }) => <button type="button" role="switch" aria-checked={on} aria-label={label} className="sw" disabled={disabled} onClick={() => set(!on)} />;
const Chips = ({ sel, set, disabled }) => <div className="chips" role="group" aria-label="Allowed merchant categories">{CATS.map(c => <button type="button" key={c} className="chip" aria-pressed={sel.includes(c)} disabled={disabled} onClick={() => set(sel.includes(c) ? sel.filter(x => x !== c) : [...sel, c])}>{c}</button>)}</div>;
function Face({ c, full }) {
  return <div className={'vc ' + c.kind + ' ' + c.status}>
    <div className="vt"><span className="vb">Ledger<b>ly</b></span>{c.status !== 'active' && <span className="tag">{STATUS[c.status][0]}</span>}</div>
    <div className="chip-i" />
    <div className="vn">{full ? '4242 4242 4242 ' + c.last4 : '•••• •••• •••• ' + c.last4}</div>
    <div className="vf"><span>{c.holder}</span><span>EXP {c.exp}</span><span className="kind">{c.kind}</span></div></div>;
}

/* ---- card details drawer ---- */
function Detail({ c, upd, remove, close, closeRef, say }) {
  const locked = c.status === 'terminated';
  const [name, setName] = useState(c.name), [limit, setLimit] = useState(String(c.limit)), [period, setPeriod] = useState(c.period);
  const [cats, setCats] = useState(c.cats), [online, setOnline] = useState(c.online), [intl, setIntl] = useState(c.intl);
  const [show, setShow] = useState(false), [confirmT, setConfirmT] = useState(false), [touched, setTouched] = useState(false);
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(false), 15000); return () => clearTimeout(t) }, [show]);
  const dirty = name !== c.name || +limit !== c.limit || period !== c.period || cats.join() !== c.cats.join() || online !== c.online || intl !== c.intl;
  const err = name.trim().length < 2 ? 'Give the card a name.' : !(+limit > 0) ? 'Enter a spending limit.' : +limit * RATE[c.cur] > MAXUSD ? 'Limits above $25,000 per card are not supported.' : '';
  const used = spent(c), pct = Math.min(100, Math.round(used / c.limit * 100));
  const rec = c.txs.filter(t => t.rec);
  const save = () => { setTouched(true); if (err) return; upd(c.id, { name: name.trim(), limit: +limit, period, cats, online, intl }); say('Card updated') };
  const copy = () => { try { navigator.clipboard.writeText('424242424242' + c.last4).then(() => say('Card number copied'), () => say('Could not copy')) } catch (e) { say('Could not copy') } };
  return <>
    <div className="row"><h2 id="dt"><Ic n="credit-card" />Card details</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close details"><Ic n="x" /></button></div>
    <div style={{ margin: '14px 0 10px' }}><Face c={c} full={show} /></div>
    <div className="row"><span className={'pill ' + STATUS[c.status][1]}>{STATUS[c.status][0]}</span>
      {c.status === 'active' || c.status === 'frozen' ? <span className="acts"><button className="btn sm" onClick={() => setShow(!show)}><Ic n={show ? 'eye-slash' : 'eye'} s={14} />{show ? 'Hide details' : 'Show details'}</button>{show && <button className="btn sm" onClick={copy}><Ic n="copy" s={14} />Copy</button>}</span> : null}</div>
    {show && <div className="kv" style={{ marginTop: 8 }}><span className="mu">CVV · hides in 15 seconds</span><span>318</span></div>}

    {c.status === 'pending' && <div className="alert"><Ic n="clock" w="fill" />This card needs Finance Manager approval because the limit is over {fmt(APPROVE)}. It activates once approved.</div>}
    {c.status === 'ordered' && <div className="alert i"><Ic n="package" w="fill" />Your physical card is on its way and should arrive in 5–7 business days.</div>}
    {c.status === 'frozen' && <div className="alert i"><Ic n="snowflake" w="fill" />This card is frozen. All new payments are declined until you unfreeze it.</div>}
    {locked && <div className="alert e"><Ic n="prohibit" w="fill" />This card was terminated and can no longer be used.</div>}

    <div className="sec">SPENDING</div>
    <div className="row sm2" style={{ marginBottom: 6 }}><span>{fmt(used, c.cur)} of {fmt(c.limit, c.cur)} this {per(c.period)}</span><span className="mu">{pct}%</span></div>
    <div className={'bar ' + (pct >= 100 ? 'full' : pct >= 90 ? 'warn' : '')} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Spent against limit"><i style={{ width: pct + '%' }} /></div>

    <div className="sec">CARD SETTINGS</div>
    <div className="field"><label className="f" htmlFor="cn">Card name</label><input id="cn" value={name} disabled={locked} onChange={e => setName(e.target.value)} /></div>
    <div className="two"><div className="field"><label className="f" htmlFor="cl">Spending limit ({c.cur})</label><input id="cl" type="number" min="0" step="any" inputMode="decimal" value={limit} disabled={locked} onChange={e => setLimit(e.target.value)} /></div>
      <div className="field"><label className="f" htmlFor="cp">Resets</label><select id="cp" value={period} disabled={locked} onChange={e => setPeriod(e.target.value)}><option value="month">Every month</option><option value="week">Every week</option></select></div></div>
    <div className="f" style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 6 }}>Allowed merchant categories</div>
    <Chips sel={cats} set={setCats} disabled={locked} /><div className="hint">Select none to allow every merchant.</div>
    <div className="opt"><span>Online payments</span><Switch on={online} set={setOnline} label="Online payments" disabled={locked} /></div>
    <div className="opt"><span>International payments</span><Switch on={intl} set={setIntl} label="International payments" disabled={locked} /></div>
    {touched && err && <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{err}</div>}
    {!locked && <div className="acts" style={{ marginTop: 8 }}><button className="btn p" disabled={!dirty} onClick={save}>Save changes</button>{dirty && <button className="btn" onClick={() => { setName(c.name); setLimit(String(c.limit)); setPeriod(c.period); setCats(c.cats); setOnline(c.online); setIntl(c.intl) }}>Reset</button>}</div>}

    {rec.length > 0 && <><div className="sec">RECURRING CHARGES</div>{rec.map(t => <div className="kv" key={t.m}><span>{t.m}</span><span className="mu">{fmt(t.a, c.cur)} / {per(c.period)}</span></div>)}</>}

    <div className="sec">RECENT ACTIVITY</div>
    {c.txs.length === 0 ? <p className="mu sm2" style={{ margin: 0 }}>No payments on this card yet.</p>
      : c.txs.slice().sort((a, b) => a.d - b.d).slice(0, 5).map(t => <div className="kv" key={t.m + t.d}><span>{t.m}<div className="mu sm2">{dshort(t.d)}</div></span><span>−{fmt(t.a, c.cur)}</span></div>)}

    {!locked && <><div className="sec">DANGER ZONE</div>
      {c.status === 'pending' ? <button className="btn danger" onClick={() => { remove(c.id); say('Card request cancelled') }}>Cancel request</button>
        : !confirmT ? <div className="acts">
          {(c.status === 'active' || c.status === 'frozen') && <button className="btn" onClick={() => { upd(c.id, { status: c.status === 'active' ? 'frozen' : 'active' }); say(c.status === 'active' ? 'Card frozen' : 'Card unfrozen') }}><Ic n="snowflake" />{c.status === 'active' ? 'Freeze card' : 'Unfreeze card'}</button>}
          <button className="btn danger" onClick={() => setConfirmT(true)}><Ic n="trash" />Terminate card</button></div>
          : <div className="alert e" style={{ display: 'block' }}><b>Terminate {c.name}?</b><div style={{ margin: '4px 0 10px' }}>This is permanent. Subscriptions billed to this card will fail.</div>
            <div className="acts"><button className="btn" onClick={() => setConfirmT(false)}>Keep card</button><button className="btn danger p" onClick={() => { upd(c.id, { status: 'terminated' }); say('Card terminated'); setConfirmT(false) }}>Terminate</button></div></div>}</>}
  </>;
}

/* ---- create card drawer ---- */
function Create({ onCreate, close, closeRef }) {
  const [kind, setKind] = useState('virtual'), [name, setName] = useState(''), [holder, setHolder] = useState(PEOPLE[0]), [cur, setCur] = useState('USD');
  const [limit, setLimit] = useState(''), [period, setPeriod] = useState('month'), [cats, setCats] = useState([]), [months, setMonths] = useState('12'), [touched, setTouched] = useState(false);
  const usd = (+limit || 0) * RATE[cur], needs = usd > APPROVE;
  const err = name.trim().length < 2 ? 'Give the card a name.' : !(+limit > 0) ? 'Enter a spending limit.' : usd > MAXUSD ? 'Limits above $25,000 per card are not supported.' : '';
  const submit = e => {
    e.preventDefault(); setTouched(true); if (err) return;
    onCreate({
      id: 'c' + Date.now(), name: name.trim(), kind, holder, cur, limit: +limit, period, cats, online: true, intl: false, exp: expiry(+months), last4: String(1000 + Math.floor(Math.random() * 9000)),
      status: needs ? 'pending' : kind === 'physical' ? 'ordered' : 'active', txs: []
    }, needs)
  };
  return <form onSubmit={submit} noValidate>
    <div className="row"><h2 id="dt"><Ic n="plus-circle" />Create a card</h2><button type="button" ref={closeRef} className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div className="sec">CARD TYPE</div>
    <div className="seg" role="radiogroup" aria-label="Card type">{[['virtual', 'Virtual'], ['physical', 'Physical']].map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
    <div className="hint">{kind === 'virtual' ? 'Ready to use the moment it is created, for online and subscription payments.' : 'Shipped to your business address in 5–7 business days. Use it in person and at ATMs.'}</div>
    <div className="field" style={{ marginTop: 16 }}><label className="f" htmlFor="nn">Card name</label><input id="nn" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Design tools" aria-invalid={touched && !!err && name.trim().length < 2} /></div>
    <div className="field"><label className="f" htmlFor="ho">Assign to</label><select id="ho" value={holder} onChange={e => setHolder(e.target.value)}>{PEOPLE.map(p => <option key={p}>{p}</option>)}</select></div>
    <div className="two"><div className="field"><label className="f" htmlFor="cu">Currency</label><select id="cu" value={cur} onChange={e => setCur(e.target.value)}>{['USD', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><label className="f" htmlFor="li">Spending limit</label><input id="li" type="number" min="0" step="any" inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value)} placeholder="0.00" /></div></div>
    <div className="two"><div className="field"><label className="f" htmlFor="pe">Limit resets</label><select id="pe" value={period} onChange={e => setPeriod(e.target.value)}><option value="month">Every month</option><option value="week">Every week</option></select></div>
      <div className="field"><label className="f" htmlFor="ex">Expires</label><select id="ex" value={months} onChange={e => setMonths(e.target.value)}><option value="1">In 1 month</option><option value="3">In 3 months</option><option value="12">In 1 year</option><option value="36">In 3 years</option></select></div></div>
    <div className="f" style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 6 }}>Allowed merchant categories</div>
    <Chips sel={cats} set={setCats} /><div className="hint">Select none to allow every merchant.</div>
    {needs && <div className="alert i"><Ic n="seal-check" w="fill" />Limits over {fmt(APPROVE)} need approval from a Finance Manager before the card activates.</div>}
    {touched && err && <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{err}</div>}
    <div className="acts" style={{ marginTop: 20, justifyContent: 'space-between' }}><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">{needs ? 'Request card' : kind === 'physical' ? 'Order card' : 'Create card'}</button></div>
  </form>;
}

/* ---- page ---- */
function App() {
  const [cards, setCards] = useState(seed), [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''), [type, setType] = useState('all'), [status, setStatus] = useState('all');
  const [drawer, setDrawer] = useState(null), [toast, setToast] = useState('');
  const lastRef = useRef(null), closeRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 450); return () => clearTimeout(t) }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast]);
  useEffect(() => {
    if (!drawer) return;
    if (closeRef.current) closeRef.current.focus();
    const k = e => { if (e.key === 'Escape') close() };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [drawer]);

  const open = (id, e) => { lastRef.current = e.currentTarget; setDrawer(id) };
  const close = () => { setDrawer(null); setTimeout(() => { if (lastRef.current && lastRef.current.focus) lastRef.current.focus() }, 0) };
  const upd = (id, p) => setCards(cs => cs.map(c => c.id === id ? { ...c, ...p } : c));
  const remove = id => { setCards(cs => cs.filter(c => c.id !== id)); setDrawer(null) };
  const create = (card, needs) => {
    setCards(cs => [card, ...cs]);
    setToast(needs ? 'Card requested. A Finance Manager needs to approve the limit.' : card.kind === 'physical' ? 'Physical card ordered. It arrives in 5–7 business days.' : 'Virtual card created and ready to use.');
    setDrawer(card.id);
  };
  const active = q || type !== 'all' || status !== 'all';
  const clear = () => { setQ(''); setType('all'); setStatus('all') };

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return cards.filter(c => (type === 'all' || c.kind === type) && (status === 'all' || c.status === status) && (!ql || (c.name + ' ' + c.holder + ' ' + c.last4).toLowerCase().includes(ql)))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  }, [cards, q, type, status]);

  const live = cards.filter(c => c.status === 'active' || c.status === 'frozen');
  const limitUsd = live.reduce((a, c) => a + c.limit * RATE[c.cur] * (c.period === 'week' ? 4 : 1), 0);
  const spentUsd = cards.filter(c => c.status !== 'terminated').reduce((a, c) => a + spent(c) * RATE[c.cur], 0);
  const sel = cards.find(c => c.id === drawer);
  const stat = (l, v, d) => <div className="card stat"><small>{l}</small><b>{loading ? '—' : v}</b><span className="d">{d}</span></div>;

  return <div className="app"><Sidebar here="Cards" />
    <main>
      <div className="top"><div><h1>Cards</h1><p className="sub">Issue virtual and physical cards, set limits, and control where they can be used.</p></div>
        <button className="btn p" onClick={e => { lastRef.current = e.currentTarget; setDrawer('new') }}><Ic n="plus" />Create card</button></div>

      <div className="stats">
        {stat('Active cards', cards.filter(c => c.status === 'active').length, 'Ready to spend')}
        {stat('Monthly limits', '≈ ' + fmt(limitUsd), 'USD equivalent, weekly limits ×4')}
        {stat('Spent this month', '≈ ' + fmt(spentUsd), 'USD equivalent, all cards')}
        {stat('Frozen', cards.filter(c => c.status === 'frozen').length, 'Payments paused')}
      </div>

      <div className="filters" role="search">
        <div className="srch"><span className="si"><Ic n="magnifying-glass" s={16} /></span><input aria-label="Search cards" placeholder="Search by name, holder or last 4 digits" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="seg" role="radiogroup" aria-label="Card type">{[['all', 'All'], ['virtual', 'Virtual'], ['physical', 'Physical']].map(([k, l]) => <button key={k} role="radio" aria-checked={type === k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}</div>
        <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k][0]}</option>)}</select>
        {active && <button className="btn sm" onClick={clear}>Clear filters</button>}
      </div>

      {loading ? <div className="grid" aria-busy="true">{[0, 1, 2].map(i => <div className="sk" key={i} />)}</div>
        : rows.length === 0 ? <div className="card empty"><Ic n="credit-card" s={36} /><b>{cards.length === 0 ? 'No cards yet' : 'No cards match'}</b>{active ? 'Try a different search or clear your filters.' : 'Create your first card to start spending.'}
          <div>{active ? <button className="btn" onClick={clear}>Clear filters</button> : <button className="btn p" onClick={e => { lastRef.current = e.currentTarget; setDrawer('new') }}>Create card</button>}</div></div>
          : <div className="grid">{rows.map(c => {
            const u = spent(c), pct = Math.min(100, Math.round(u / c.limit * 100)), st = STATUS[c.status];
            return <div key={c.id} className={'cw' + (c.status === 'terminated' ? ' dim' : '')}>
              <button className="vbtn" onClick={e => open(c.id, e)} aria-label={`${c.name}, ${c.kind} card ending ${c.last4}, ${st[0]}. Open details`}><Face c={c} /></button>
              <div className="row"><b>{c.name}</b><span className={'pill ' + st[1]}>{st[0]}</span></div>
              <div className="mu sm2" style={{ marginTop: -8 }}>{c.holder} · {c.cur}</div>
              <div><div className="row sm2" style={{ marginBottom: 5 }}><span>{fmt(u, c.cur)} of {fmt(c.limit, c.cur)}</span><span className="mu">per {per(c.period)}</span></div>
                <div className={'bar ' + (pct >= 100 ? 'full' : pct >= 90 ? 'warn' : '')} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={`${c.name} spend`}><i style={{ width: pct + '%' }} /></div></div>
              <div className="acts">
                {(c.status === 'active' || c.status === 'frozen') && <button className="btn sm" onClick={() => { upd(c.id, { status: c.status === 'active' ? 'frozen' : 'active' }); setToast(c.status === 'active' ? 'Card frozen' : 'Card unfrozen') }}><Ic n="snowflake" s={14} />{c.status === 'active' ? 'Freeze' : 'Unfreeze'}</button>}
                <button className="btn sm" onClick={e => open(c.id, e)}>Details</button></div>
            </div>
          })}</div>}

      {drawer && <><div className="ov" onClick={close} />
        <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dt">
          {drawer === 'new' ? <Create onCreate={create} close={close} closeRef={closeRef} />
            : sel ? <Detail key={sel.id} c={sel} upd={upd} remove={remove} close={close} closeRef={closeRef} say={setToast} /> : null}</div></>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);