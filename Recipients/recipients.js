const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Montra;
const Store = MontraStore;

const CUR = ['USD', 'EUR', 'GBP', 'NGN'];
const COUNTRIES = { Nigeria: 'NGN', 'United States': 'USD', 'United Kingdom': 'GBP', Germany: 'EUR', Finland: 'EUR', France: 'EUR', Ireland: 'EUR', Netherlands: 'EUR' };
const SCHEDULED = { 3: 1 }; /* demo: Acme GmbH has one scheduled payment */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);

const show = b => {
  const a = Store.clean(b.acct);
  return b.cur === 'EUR' ? a.replace(/(.{4})/g, '$1 ').trim() : b.cur === 'GBP' && a.length === 14 ? `${a.slice(0, 2)}-${a.slice(2, 4)}-${a.slice(4, 6)} ${a.slice(6)}` : a;
};
const mask = b => '•••• ' + Store.clean(b.acct).slice(-4);
const tokens = s => s.toUpperCase().replace(/\b(LIMITED|LTD|LLC|GMBH|AB)\b/g, '').split(/\s+/).filter(Boolean);
const sameName = (a, b) => {
  const x = tokens(a), y = tokens(b), [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.length > 0 && s.every(t => l.some(u => u === t || (Math.min(t.length, u.length) >= 3 && (u.startsWith(t) || t.startsWith(u)))));
};
const pill = b => b.verified ? ['completed', 'Verified'] : b.vnote === 'mismatch' || b.vnote === 'notfound' ? ['pending', 'Check details'] : b.vnote === 'format' ? ['info', 'Format checked'] : ['off', 'Not verified'];
const last = b => (b.hist && b.hist[0] ? b.hist[0].d : '—');

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="m-t"><div className="mb"><h2 id="m-t">{title}</h2>{children(() => ref.current.close())}</div></dialog>;
}

function Form({ b, list, onSave, close }) {
  const [type, setType] = useState(b ? b.type : 'Business'), [name, setName] = useState(b ? b.name : ''), [country, setCountry] = useState(b ? b.country || 'Nigeria' : 'Nigeria');
  const [cur, setCur] = useState(b ? b.cur : 'NGN'), [bank, setBank] = useState(b ? b.bank : ''), [acct, setAcct] = useState(b ? show(b) : ''), [email, setEmail] = useState(b ? b.email || '' : ''), [err, setErr] = useState('');
  const pickCountry = c => { setCountry(c); setCur(COUNTRIES[c]); };
  const go = e => {
    e.preventDefault();
    const a = Store.clean(acct), twin = list.find(x => x.id !== (b && b.id) && x.cur === cur && Store.clean(x.acct) === a);
    const m = name.trim().length < 2 ? 'Enter the recipient’s name.' : !bank.trim() ? 'Enter the bank name.' : Store.checkAccount(cur, a)
      || (twin ? `This account is already saved as ${twin.name}.` : email.trim() && !EMAIL.test(email.trim()) ? 'Enter a valid email address, or leave it empty.' : '');
    if (m) return setErr(m);
    const changed = b && (a !== Store.clean(b.acct) || cur !== b.cur);
    onSave({ ...(b || { id: Date.now(), hist: [] }), type, name: name.trim(), country, cur, bank: bank.trim(), acct: a, email: email.trim(), ...(changed || !b ? { verified: false, vnote: '', bankName: '' } : {}) });
    close();
  };
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <div className="seg full" role="radiogroup" aria-label="Recipient type">{['Business', 'Individual'].map(t => <button type="button" key={t} role="radio" aria-checked={type === t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t}</button>)}</div>
    <label>{type === 'Business' ? 'Business name' : 'Full name'}<input value={name} onChange={e => { setName(e.target.value); setErr(''); }} autoFocus /></label>
    <div className="two"><label>Country<select value={country} onChange={e => pickCountry(e.target.value)}>{Object.keys(COUNTRIES).map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Currency<select value={cur} onChange={e => { setCur(e.target.value); setErr(''); }}>{CUR.map(c => <option key={c}>{c}</option>)}</select></label></div>
    <label>Bank name<input value={bank} onChange={e => { setBank(e.target.value); setErr(''); }} /></label>
    <label>{Store.rules[cur].label}<input value={acct} onChange={e => { setAcct(e.target.value); setErr(''); }} autoComplete="off" spellCheck="false" /></label>
    <label>Email <span className="mu" style={{ fontWeight: 400 }}>(optional, for payment notices)</span><input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} /></label>
    <p className="err" role="alert">{err}</p>
    <div className="row"><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">{b ? 'Save changes' : 'Add recipient'}</button></div>
  </form>;
}

function Detail({ b, busy, onVerify, onEdit, onDelete, onFixName, close, closeRef, say }) {
  const [p, t] = pill(b), hist = b.hist || [], paid = hist.filter(h => h.st === 'completed').reduce((a, h) => a + h.amt, 0);
  const copy = () => { try { navigator.clipboard.writeText(Store.clean(b.acct)).then(() => say('Account number copied'), () => say('Could not copy')); } catch (e) { say('Could not copy'); } };
  return <>
    <div className="row"><h2 id="dt"><Ic n="address-book" />Recipient</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close details"><Ic n="x" /></button></div>
    <div className="dh"><div className="who"><span className="flag">{b.cur}</span><div><div className="big">{b.name}</div><div className="mu fine">{b.type}{b.cur !== 'NGN' ? ' · International' : ''}</div></div></div>
      <div style={{ marginTop: 8 }}><span className={'pill ' + p}>{t}</span></div></div>
    {b.vnote === 'mismatch' && <div className="note w" role="alert"><Ic n="warning" w="fill" /><div>The bank shows this account as <b>{b.bankName}</b>, which does not clearly match “{b.name}”. Check before you pay.<div><button className="btn sm" onClick={() => onFixName(b)}>Use the bank’s name</button></div></div></div>}
    {b.vnote === 'notfound' && <div className="note e" role="alert"><Ic n="x-circle" w="fill" />No account with this number was found at {b.bank}. Check the number before you pay.</div>}
    {b.vnote === 'format' && <div className="note i"><Ic n="info" w="fill" />{b.cur} accounts can’t be checked against the bank yet. The number format is valid, but double-check the name and bank.</div>}
    {b.verified && <div className="note i"><Ic n="seal-check" w="fill" />The bank shows this account as <b>{b.bankName || b.name}</b>.</div>}
    <div className="acts" style={{ justifyContent: 'flex-start', margin: '14px 0 0' }}>
      <a className="btn p" href={`../send-money/send.html#to=${b.id}`}><Ic n="paper-plane-tilt" />Send money</a>
      <button className="btn" onClick={() => onVerify(b)} disabled={busy}>{busy ? 'Checking…' : 'Verify details'}</button>
      <button className="btn" onClick={() => onEdit(b)}><Ic n="pencil-simple" />Edit</button></div>
    <div className="sec">BANK DETAILS</div>
    <div className="kv"><span className="mu">Bank</span><span>{b.bank}</span></div>
    <div className="kv"><span className="mu">{Store.rules[b.cur].label}</span><span className="mono">{show(b)} <button className="btn sm" onClick={copy} aria-label="Copy account number"><Ic n="copy" s={14} /></button></span></div>
    <div className="kv"><span className="mu">Currency</span><span>{b.cur}</span></div>
    <div className="kv"><span className="mu">Country</span><span>{b.country || '—'}</span></div>
    <div className="kv"><span className="mu">Email</span><span>{b.email || '—'}</span></div>
    <div className="sec">PAYMENT HISTORY</div>
    {hist.length === 0 ? <p className="mu fine" style={{ margin: 0 }}>No payments to {b.name} yet.</p> : <>
      <div className="mu fine" style={{ marginBottom: 4 }}>{fmt(paid, b.cur)} paid across {hist.filter(h => h.st === 'completed').length} payments</div>
      {hist.map((h, i) => <div className="hist" key={i}><span className="mu fine">{h.d}</span><span>{h.ref}</span><span className={'pill ' + h.st}>{h.st}</span><span className="r">{fmt(h.amt, b.cur)}</span></div>)}</>}
    <div className="sec">DANGER ZONE</div>
    <div><button className="btn d" onClick={() => onDelete(b)}><Ic n="trash" />Delete recipient</button></div>
  </>;
}

function App() {
  const [list, setList] = useState(() => Store.beneficiaries()), [loading, setLoading] = useState(true), [q, setQ] = useState(''), [type, setType] = useState('all'), [scope, setScope] = useState('all');
  const [sel, setSel] = useState(null), [form, setForm] = useState(null), [del, setDel] = useState(null), [ver, setVer] = useState(null), [toast, setToast] = useState('');
  const lastRef = useRef(null), closeRef = useRef(null), ready = useRef(false);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (ready.current) Store.saveBeneficiaries(list); else ready.current = true; }, [list]);
  useEffect(() => {
    if (!sel) return;
    if (closeRef.current) closeRef.current.focus();
    const k = e => { if (e.key === 'Escape' && !form && !del) close(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [sel, form, del]);

  const open = (b, e) => { lastRef.current = e.currentTarget; setSel(b.id); };
  const close = () => { setSel(null); setTimeout(() => { if (lastRef.current && lastRef.current.focus) lastRef.current.focus(); }, 0); };
  const patch = (id, p) => setList(l => l.map(x => x.id === id ? { ...x, ...p } : x));
  const save = b => { const isNew = !list.some(x => x.id === b.id); setList(l => isNew ? [b, ...l] : l.map(x => x.id === b.id ? b : x)); setToast(isNew ? `${b.name} added` : 'Changes saved'); if (isNew) setSel(b.id); };
  const remove = b => { setList(l => l.filter(x => x.id !== b.id)); setSel(null); setDel(null); setToast(`${b.name} deleted`); };
  const verify = b => {
    setVer(b.id);
    setTimeout(() => {
      const bank = Store.lookup(b.cur, b.acct);
      if (bank === undefined) patch(b.id, { verified: false, vnote: 'format', bankName: '' });
      else if (bank === null) patch(b.id, { verified: false, vnote: 'notfound', bankName: '' });
      else if (sameName(bank, b.name)) patch(b.id, { verified: true, vnote: '', bankName: bank });
      else patch(b.id, { verified: false, vnote: 'mismatch', bankName: bank });
      setVer(null);
    }, 700);
  };
  const active = q || type !== 'all' || scope !== 'all';
  const clear = () => { setQ(''); setType('all'); setScope('all'); };
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return list.filter(b => (type === 'all' || b.type === type) && (scope === 'all' || (scope === 'intl') === (b.cur !== 'NGN')) && (!ql || (b.name + ' ' + b.bank + ' ' + b.acct).toLowerCase().includes(ql)));
  }, [list, q, type, scope]);
  const cur = list.find(b => b.id === sel);
  const stat = (l, v, d) => <div className="card stat"><small>{l}</small><b>{loading ? '—' : v}</b><span className="fine mu">{d}</span></div>;

  return <div className="app"><Sidebar here="Recipients" active="Payments" />
    <main>
      <div className="top"><div><h1>Recipients</h1><p className="sub">Everyone you pay, with their bank details and payment history.</p></div>
        <div className="qa"><a className="btn" href="../Bulk/bulk.html"><Ic n="rows" />Bulk payment</a><button className="btn p" onClick={e => { lastRef.current = e.currentTarget; setForm({ b: null }); }}><Ic n="plus" />Add recipient</button></div></div>

      <div className="stats">
        {stat('Recipients', list.length, 'Saved to your account')}
        {stat('Businesses', list.filter(b => b.type === 'Business').length, 'Companies and vendors')}
        {stat('Individuals', list.filter(b => b.type === 'Individual').length, 'People and contractors')}
        {stat('Not verified', list.filter(b => !b.verified).length, 'Verify before large payments')}
      </div>

      <div className="card">
        <div className="filters" role="search">
          <div className="srch"><span className="si"><Ic n="magnifying-glass" s={16} /></span><input aria-label="Search recipients" placeholder="Search name, bank or account number" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="seg" role="radiogroup" aria-label="Recipient type">{[['all', 'All'], ['Business', 'Businesses'], ['Individual', 'Individuals']].map(([k, l]) => <button key={k} role="radio" aria-checked={type === k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}</div>
          <select aria-label="Location" style={{ width: 'auto' }} value={scope} onChange={e => setScope(e.target.value)}><option value="all">Local and international</option><option value="local">Local (NGN)</option><option value="intl">International</option></select>
          {active && <button className="btn sm" onClick={clear}>Clear filters</button>}
        </div>

        {!loading && rows.length === 0
          ? <div className="empty"><Ic n="address-book" s={32} /><b>{active ? 'No recipients match' : 'No recipients yet'}</b>{active ? 'Try a different search or clear your filters.' : 'Add the people and businesses you pay.'}<div>{active ? <button className="btn" onClick={clear}>Clear filters</button> : <button className="btn p" onClick={() => setForm({ b: null })}>Add recipient</button>}</div></div>
          : <div className="wrap"><table aria-busy={loading}>
            <thead><tr><th>Recipient</th><th className="hide-s">Bank and account</th><th className="hide-s">Type</th><th>Status</th><th className="hide-s">Last payment</th><th><span className="sr">Actions</span></th></tr></thead>
            <tbody>{loading ? [0, 1, 2, 3, 4].map(i => <tr key={i}>{[150, 130, 70, 80, 60, 60].map((w, j) => <td key={j} className={j === 1 || j === 2 || j === 4 ? 'hide-s' : ''}><div className="sk" style={{ width: w }} /></td>)}</tr>)
              : rows.map(b => { const [p, t] = pill(b); return <tr key={b.id} className="rw" onClick={e => open(b, e)}>
                <td><div className="who"><span className="flag">{b.cur}</span><div><button className="lnk" onClick={e => { e.stopPropagation(); open(b, e); }}>{b.name}</button><div className="mu fine">{b.country || '—'}{b.cur !== 'NGN' ? ' · International' : ''}</div></div></div></td>
                <td className="hide-s">{b.bank}<div className="mu fine mono">{mask(b)}</div></td><td className="hide-s">{b.type}</td>
                <td><span className={'pill ' + p}>{t}</span></td><td className="hide-s mu nw">{last(b)}</td>
                <td><div className="acts"><a className="btn sm" href={`../send-money/send.html#to=${b.id}`} onClick={e => e.stopPropagation()}>Send</a></div></td></tr>; })}</tbody></table></div>}
      </div>

      {sel && cur && <><div className="ov" onClick={close} /><div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dt">
        <Detail key={cur.id + (cur.vnote || '') + cur.verified} b={cur} busy={ver === cur.id} onVerify={verify} onEdit={b => setForm({ b })} onDelete={setDel} onFixName={b => { patch(b.id, { name: b.bankName.replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase()), verified: true, vnote: '' }); setToast('Name updated to match the bank'); }} close={close} closeRef={closeRef} say={setToast} /></div></>}
      {form && <Modal title={form.b ? 'Edit recipient' : 'Add recipient'} onClose={() => setForm(null)}>{c => <Form b={form.b} list={list} onSave={save} close={c} />}</Modal>}
      {del && <Modal title={`Delete ${del.name}?`} onClose={() => setDel(null)}>{c => <>
        <p style={{ margin: 0 }}>This removes {del.name} from your saved recipients. Past payments stay in your transaction history.</p>
        {SCHEDULED[del.id] ? <div className="alert"><Ic n="warning" w="fill" />{SCHEDULED[del.id]} scheduled payment to {del.name} will be cancelled.</div> : null}
        <div className="row"><button className="btn" onClick={c}>Keep recipient</button><button className="btn d p" onClick={() => { remove(del); c(); }}>Delete</button></div></>}</Modal>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
