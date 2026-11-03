const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Ledgerly;

const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const RATE = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 0.00065 };
const TODAY = new Date(2026, 10, 3);
const CO = { name: 'Northwind Studio', addr: ['14 Adeola Odeku Street', 'Victoria Island, Lagos'], email: 'billing@northwindstudio.co' };
const TERMS = [['0', 'Due on receipt'], ['7', 'Net 7'], ['14', 'Net 14'], ['30', 'Net 30']];
const REC = { none: 'Does not repeat', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' };
const METHODS = ['Bank transfer', 'Card', 'Cash'];
const STATUS = { draft: ['Draft', 'off'], sent: ['Awaiting payment', 'info'], overdue: ['Overdue', 'failed'], paid: ['Paid', 'completed'], void: ['Void', 'off'] };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const dateOf = o => { const d = new Date(TODAY); d.setDate(d.getDate() - o); return d };
const dfmt = o => dateOf(o).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const offOf = s => Math.round((TODAY - new Date(s + 'T00:00:00')) / 864e5);
const uid = (() => { let n = 0; return () => 'k' + (++n) })();

/* ---- invoice maths and status ---- */
const sub = i => i.items.reduce((a, x) => a + (+x.q || 0) * (+x.p || 0), 0);
const taxOf = i => sub(i) * (+i.tax || 0) / 100;
const total = i => sub(i) + taxOf(i);
const dueOff = i => i.issueOff - (+i.terms);
const statusOf = i => i.voided ? 'void' : i.paidOff !== null ? 'paid' : i.sentOff === null ? 'draft' : dueOff(i) > 0 ? 'overdue' : 'sent';
const usd = i => total(i) * RATE[i.cur];
const nextRun = i => {
  if (i.rec === 'none') return null;
  const d = dateOf(i.issueOff);
  for (let n = 0; n < 60 && d <= TODAY; n++) { if (i.rec === 'weekly') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + (i.rec === 'monthly' ? 1 : 3)) }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const link = i => 'pay.ledgerly.app/' + i.id.toLowerCase();

/* ---- sample data ---- */
const CUSTS = [
  { id: 'c1', name: 'Lagos Fresh Ltd', email: 'billing@lagosfresh.ng', cur: 'NGN', addr: '12 Allen Avenue, Ikeja, Lagos' },
  { id: 'c2', name: 'Acme GmbH', email: 'accounts@acme-gmbh.de', cur: 'EUR', addr: 'Friedrichstrasse 112, 10117 Berlin' },
  { id: 'c3', name: 'Pixel Forge LLC', email: 'ap@pixelforge.io', cur: 'USD', addr: '450 Mission Street, San Francisco, CA' },
  { id: 'c4', name: 'Harbor Design Ltd', email: 'finance@harbordesign.co.uk', cur: 'GBP', addr: '8 Quay Street, Bristol' }];
const mk = (id, cust, cur, issueOff, terms, items, x) => ({
  id, cust, cur, issueOff, terms: String(terms), tax: 0, notes: 'Thank you for your business.', rec: 'none', auto: true,
  sentOff: null, paidOff: null, method: '', voided: false, reminders: [], failed: null, sentTo: '',
  items: items.map(r => ({ k: uid(), d: r[0], q: r[1], p: r[2] })), ...x
});
const seed = () => [
  mk('INV-1048', 'c3', 'USD', 0, 14, [['Landing page design', 1, 2800], ['Brand guidelines', 1, 1200]], {}),
  mk('INV-1047', 'c4', 'GBP', 2, 14, [['UX audit', 1, 3200], ['Workshop facilitation', 2, 450]], { tax: 20, sentOff: 2, sentTo: 'finance@harbordesign.co.uk' }),
  mk('INV-1046', 'c3', 'USD', 11, 14, [['Design system build', 1, 6400]], { sentOff: 11, sentTo: 'ap@pixelforge.io' }),
  mk('INV-1045', 'c1', 'NGN', 18, 14, [['Social media creatives (October)', 1, 420000]], { sentOff: 18, sentTo: 'billing@lagosfresh.ng', reminders: [2] }),
  mk('INV-1044', 'c2', 'EUR', 24, 14, [['Website redesign, phase 1', 1, 3600]], { sentOff: 24, sentTo: 'accounts@acme-gmbh.de', paidOff: 15, method: 'Bank transfer' }),
  mk('INV-1043', 'c3', 'USD', 30, 30, [['Product illustration pack', 3, 900]], { sentOff: 30, sentTo: 'ap@pixelforge.io', paidOff: 12, method: 'Bank transfer' }),
  mk('INV-1042', 'c1', 'NGN', 34, 7, [['Brand strategy retainer', 1, 850000]], { sentOff: 34, sentTo: 'billing@lagosfresh.ng', paidOff: 4, method: 'Bank transfer' }),
  mk('INV-1041', 'c4', 'GBP', 47, 30, [['Packaging concepts', 1, 2100]], { sentOff: 47, sentTo: 'finance@harbordesign.co.uk', paidOff: 20, method: 'Card' }),
  mk('INV-1040', 'c2', 'EUR', 9, 14, [['Maintenance retainer', 1, 650]], { sentOff: 9, sentTo: 'accounts@acme-gmbh.de', rec: 'monthly' }),
  mk('INV-1039', 'c2', 'EUR', 19, 14, [['Website redesign, phase 2', 1, 1600], ['Copywriting', 1, 800]], { sentOff: 19, sentTo: 'accounts@acme-gmbh.de', reminders: [3], failed: 5 })];

/* ---- the invoice document ---- */
function Paper({ inv, cust, st }) {
  const due = dateOf(dueOff(inv)), issue = dateOf(inv.issueOff), f = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rows = inv.items.filter(x => x.d || +x.p);
  return <div className="paper" aria-label="Invoice preview">
    {st === 'paid' && <div className="stamp">PAID</div>}
    <div className="ph"><div><b className="pn">{CO.name}</b>{CO.addr.map(a => <div key={a}>{a}</div>)}<div>{CO.email}</div></div>
      <div style={{ textAlign: 'right' }}><div className="pt">INVOICE</div><div>{inv.id || 'Draft'}</div></div></div>
    <div className="pm"><div><small>Bill to</small><b>{cust ? cust.name : 'Select a customer'}</b>{cust && <><div>{cust.addr}</div><div>{cust.email}</div></>}</div>
      <div><small>Issued</small>{f(issue)}<small style={{ marginTop: 8 }}>Due</small><b>{f(due)}</b></div></div>
    <table><thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Amount</th></tr></thead>
      <tbody>{rows.length ? rows.map(x => <tr key={x.k}><td>{x.d || '—'}</td><td className="r">{+x.q || 0}</td><td className="r">{fmt(+x.p || 0, inv.cur)}</td><td className="r">{fmt((+x.q || 0) * (+x.p || 0), inv.cur)}</td></tr>)
        : <tr><td colSpan="4" style={{ color: '#6b7280' }}>No line items yet</td></tr>}</tbody></table>
    <div className="pt2"><div><span>Subtotal</span><span>{fmt(sub(inv), inv.cur)}</span></div>
      {+inv.tax > 0 && <div><span>Tax ({+inv.tax}%)</span><span>{fmt(taxOf(inv), inv.cur)}</span></div>}
      <div className="g"><span>Total due</span><span>{fmt(total(inv), inv.cur)}</span></div></div>
    {inv.notes && <div className="nt">{inv.notes}</div>}
  </div>;
}

/* ---- send dialog ---- */
function SendModal({ inv, cust, onSend, close }) {
  const first = useRef(null);
  const [to, setTo] = useState(inv.sentTo || (cust ? cust.email : '')), [subject, setSubject] = useState((inv.sentOff !== null ? 'Reminder: ' : '') + 'Invoice ' + inv.id + ' from ' + CO.name);
  const [msg, setMsg] = useState('Hi ' + (cust ? cust.name : 'there') + ',\n\nPlease find invoice ' + inv.id + ' for ' + fmt(total(inv), inv.cur) + ', due ' + dfmt(dueOff(inv)) + '.\nYou can pay online using the link below.\n\nThanks,\n' + CO.name);
  const [copy, setCopy] = useState(true), [pdf, setPdf] = useState(true), [touched, setTouched] = useState(false);
  useEffect(() => { if (first.current) first.current.focus(); const k = e => { if (e.key === 'Escape') close() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, []);
  const err = !EMAIL.test(to.trim()) ? 'Enter a valid email address.' : '';
  const submit = e => { e.preventDefault(); setTouched(true); if (!err) onSend(to.trim()) };
  return <form className="modal" role="dialog" aria-modal="true" aria-labelledby="sm" onSubmit={submit} noValidate>
    <div className="row"><h2 id="sm"><Ic n="paper-plane-tilt" />{inv.sentOff !== null ? 'Send reminder' : 'Send invoice'}</h2><button type="button" className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div className="field" style={{ marginTop: 14 }}><label className="f" htmlFor="to">To</label><input id="to" ref={first} type="email" value={to} onChange={e => setTo(e.target.value)} aria-invalid={touched && !!err} />
      {touched && err && <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{err}</div>}</div>
    <div className="field"><label className="f" htmlFor="sj">Subject</label><input id="sj" value={subject} onChange={e => setSubject(e.target.value)} /></div>
    <div className="field"><label className="f" htmlFor="ms">Message</label><textarea id="ms" rows={7} value={msg} onChange={e => setMsg(e.target.value)} /></div>
    <div className="opt"><span>Attach invoice as PDF</span><button type="button" role="switch" aria-checked={pdf} aria-label="Attach PDF" className="sw" onClick={() => setPdf(!pdf)} /></div>
    <div className="opt"><span>Send me a copy</span><button type="button" role="switch" aria-checked={copy} aria-label="Send me a copy" className="sw" onClick={() => setCopy(!copy)} /></div>
    <div className="hint">The email includes a secure link: {link(inv)}</div>
    <div className="acts" style={{ marginTop: 16, justifyContent: 'space-between' }}><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p"><Ic n="paper-plane-tilt" />{inv.sentOff !== null ? 'Send reminder' : 'Send invoice'}</button></div>
  </form>;
}

/* ---- editor ---- */
function Editor({ init, custs, addCust, onSave, onSend, back }) {
  const blank = { cust: '', cur: 'USD', issue: iso(TODAY), terms: '14', items: [{ k: uid(), d: '', q: 1, p: '' }], tax: '0', notes: 'Thank you for your business.', rec: 'none', auto: true };
  const [f, setF] = useState(init ? { cust: init.cust, cur: init.cur, issue: iso(dateOf(init.issueOff)), terms: init.terms, items: init.items.length ? init.items.map(x => ({ ...x })) : blank.items, tax: String(init.tax), notes: init.notes, rec: init.rec, auto: init.auto } : blank);
  const [id, setId] = useState(init ? init.id : null), [nc, setNc] = useState(null), [touched, setTouched] = useState(false), [saved, setSaved] = useState(false);
  const set = (k, v) => { setF(o => ({ ...o, [k]: v })); setSaved(false) };
  const cust = custs.find(c => c.id === f.cust);
  const setItem = (k, p) => set('items', f.items.map(x => x.k === k ? { ...x, ...p } : x));
  const inv = {
    id, cust: f.cust, cur: f.cur, issueOff: offOf(f.issue || iso(TODAY)), terms: f.terms, items: f.items, tax: f.tax, notes: f.notes, rec: f.rec, auto: f.auto,
    sentOff: init ? init.sentOff : null, paidOff: null, method: '', voided: false, reminders: init ? init.reminders : [], failed: null, sentTo: init ? init.sentTo : ''
  };
  const used = f.items.filter(x => x.d.trim() || +x.p);
  const errs = {
    cust: !f.cust ? 'Choose who this invoice is for.' : '',
    items: used.length === 0 ? 'Add at least one line item.' : used.some(x => !x.d.trim() || !(+x.p > 0) || !(+x.q > 0)) ? 'Each line needs a description, a quantity and a price above zero.' : '',
    issue: !f.issue ? 'Pick an issue date.' : offOf(f.issue) < 0 ? 'The issue date cannot be in the future.' : ''
  };
  const bad = Object.keys(errs).find(k => errs[k]);
  const E = k => touched && errs[k] ? <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{errs[k]}</div> : null;
  const persist = () => { const nid = onSave({ ...inv, id, items: used }); setId(nid); setSaved(true); return nid };
  const draft = () => { if (!f.cust) { setTouched(true); return } persist(); };
  const send = () => { setTouched(true); if (bad) return; onSend(persist()) };
  const pickCust = v => { if (v === '__new') { setNc({ name: '', email: '', cur: f.cur, addr: '' }); return } set('cust', v); const c = custs.find(x => x.id === v); if (c) set('cur', c.cur); setNc(null) };
  const ncErr = nc && (nc.name.trim().length < 2 ? 'Enter the customer name.' : !EMAIL.test(nc.email.trim()) ? 'Enter a valid email address.' : '');
  const [ncTouched, setNcTouched] = useState(false);
  const saveNc = () => { setNcTouched(true); if (ncErr) return; const c = { id: 'c' + Date.now(), name: nc.name.trim(), email: nc.email.trim(), cur: nc.cur, addr: nc.addr.trim() || 'No address added' }; addCust(c); setF(o => ({ ...o, cust: c.id, cur: c.cur })); setNc(null); setNcTouched(false) };
  const sum = sub(inv), tx = taxOf(inv);
  return <>
    <button className="btn sm back" onClick={back}><Ic n="arrow-left" s={14} />All invoices</button>
    <div className="top"><div><h1>{id ? 'Edit invoice ' + id : 'New invoice'}</h1><p className="sub">Fill in the details and check the preview. Nothing is sent until you confirm.</p></div>
      <div className="qa">{saved && <span className="mu sm2"><Ic n="check" s={14} /> Draft saved</span>}<button className="btn" onClick={draft}>Save draft</button><button className="btn p" onClick={send}><Ic n="paper-plane-tilt" />Review and send</button></div></div>
    <div className="ed">
      <div className="card">
        <div className="field"><label className="f" htmlFor="cs">Customer</label>
          <select id="cs" value={nc ? '__new' : f.cust} onChange={e => pickCust(e.target.value)} aria-invalid={touched && !!errs.cust}><option value="">Select a customer</option>{custs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="__new">+ New customer</option></select>{E('cust')}</div>
        {nc && <div className="card" style={{ background: 'var(--bg)', marginBottom: 14 }}>
          <div className="field"><label className="f" htmlFor="nn">Customer name</label><input id="nn" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} /></div>
          <div className="two"><div className="field"><label className="f" htmlFor="ne">Billing email</label><input id="ne" type="email" value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} /></div>
            <div className="field"><label className="f" htmlFor="nu">Currency</label><select id="nu" value={nc.cur} onChange={e => setNc({ ...nc, cur: e.target.value })}>{Object.keys(RATE).map(c => <option key={c}>{c}</option>)}</select></div></div>
          <div className="field"><label className="f" htmlFor="na">Address (optional)</label><input id="na" value={nc.addr} onChange={e => setNc({ ...nc, addr: e.target.value })} /></div>
          {ncTouched && ncErr && <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{ncErr}</div>}
          <div className="acts" style={{ marginTop: 8 }}><button className="btn" onClick={() => { setNc(null); setNcTouched(false) }}>Cancel</button><button className="btn p" onClick={saveNc}>Add customer</button></div></div>}
        <div className="two"><div className="field"><label className="f" htmlFor="is">Issue date</label><input id="is" type="date" max={iso(TODAY)} value={f.issue} onChange={e => set('issue', e.target.value)} />{E('issue')}</div>
          <div className="field"><label className="f" htmlFor="tm">Payment terms</label><select id="tm" value={f.terms} onChange={e => set('terms', e.target.value)}>{TERMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div>
        <div className="two"><div className="field"><label className="f" htmlFor="cu">Currency</label><select id="cu" value={f.cur} onChange={e => set('cur', e.target.value)}>{Object.keys(RATE).map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label className="f" htmlFor="tx">Tax (%)</label><input id="tx" type="number" min="0" max="100" step="any" inputMode="decimal" value={f.tax} onChange={e => set('tax', e.target.value)} /></div></div>

        <div className="f" style={{ fontSize: 12, fontWeight: 600, color: 'var(--mu)', marginBottom: 6 }}>Line items</div>
        {f.items.map((x, n) => <div className="li" key={x.k}>
          <input aria-label={'Description, item ' + (n + 1)} placeholder="Description" value={x.d} onChange={e => setItem(x.k, { d: e.target.value })} />
          <input aria-label={'Quantity, item ' + (n + 1)} type="number" min="0" step="any" inputMode="decimal" value={x.q} onChange={e => setItem(x.k, { q: e.target.value })} />
          <input aria-label={'Unit price, item ' + (n + 1)} type="number" min="0" step="any" inputMode="decimal" placeholder="0.00" value={x.p} onChange={e => setItem(x.k, { p: e.target.value })} />
          <button className="x" aria-label={'Remove item ' + (n + 1)} disabled={f.items.length === 1} onClick={() => set('items', f.items.filter(y => y.k !== x.k))}><Ic n="trash" s={16} /></button></div>)}
        {E('items')}
        <button className="btn sm" style={{ marginTop: 6 }} onClick={() => set('items', [...f.items, { k: uid(), d: '', q: 1, p: '' }])}><Ic n="plus" s={14} />Add line</button>
        <div className="tot"><div><span className="mu">Subtotal</span><span>{fmt(sum, f.cur)}</span></div>{+f.tax > 0 && <div><span className="mu">Tax</span><span>{fmt(tx, f.cur)}</span></div>}<div className="g"><span>Total</span><span>{fmt(sum + tx, f.cur)}</span></div></div>

        <div className="field" style={{ marginTop: 18 }}><label className="f" htmlFor="nt">Notes to customer</label><textarea id="nt" value={f.notes} onChange={e => set('notes', e.target.value)} maxLength={300} /></div>
        <div className="field"><label className="f" htmlFor="rp">Repeat</label><select id="rp" value={f.rec} onChange={e => set('rec', e.target.value)}>{Object.keys(REC).map(k => <option key={k} value={k}>{REC[k]}</option>)}</select>
          {f.rec !== 'none' && <div className="hint">A copy of this invoice is created and sent {REC[f.rec].toLowerCase()}.</div>}</div>
        <div className="opt"><span>Automatic payment reminders<div className="hint" style={{ margin: 0 }}>3 days before the due date, and every 7 days once overdue.</div></span><button type="button" role="switch" aria-checked={f.auto} aria-label="Automatic payment reminders" className="sw" onClick={() => set('auto', !f.auto)} /></div>
      </div>
      <div className="pv"><Paper inv={inv} cust={cust} st="draft" /></div>
    </div></>;
}

/* ---- detail drawer ---- */
function Detail({ inv, cust, onEdit, onSend, onPay, onVoid, onDelete, onDup, close, closeRef, say }) {
  const st = statusOf(inv), open = st === 'sent' || st === 'overdue';
  const [paying, setPaying] = useState(false), [method, setMethod] = useState(METHODS[0]), [confirm, setConfirm] = useState('');
  const copyLink = () => { try { navigator.clipboard.writeText('https://' + link(inv)).then(() => say('Payment link copied'), () => say('Could not copy')) } catch (e) { say('Could not copy') } };
  const steps = [['Created · ' + dfmt(inv.issueOff), 'd1']];
  if (inv.sentOff !== null) steps.push(['Sent to ' + inv.sentTo + ' · ' + dfmt(inv.sentOff), 'd1']);
  inv.reminders.forEach(r => steps.push(['Reminder sent · ' + dfmt(r), 'd1']));
  if (inv.failed !== null) steps.push(['Payment attempt failed · ' + dfmt(inv.failed), 'd3']);
  if (inv.paidOff !== null) steps.push(['Paid by ' + inv.method.toLowerCase() + ' · ' + dfmt(inv.paidOff), 'd1']);
  else if (open) steps.push([st === 'overdue' ? 'Overdue since ' + dfmt(dueOff(inv)) : 'Due ' + dfmt(dueOff(inv)), st === 'overdue' ? 'd3' : 'd2']);
  else if (st === 'draft') steps.push(['Not sent yet', 'd2']);
  return <>
    <div className="row"><h2 id="dt"><Ic n="file-text" />{inv.id}</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close details"><Ic n="x" /></button></div>
    <div style={{ margin: '10px 0 4px' }}><span className={'pill ' + STATUS[st][1]}>{STATUS[st][0]}</span>{st === 'overdue' && <span className="mu sm2"> · {dueOff(inv)} days late</span>}</div>
    {inv.failed !== null && open && <div className="alert e" role="alert"><Ic n="warning" w="fill" />The customer's last payment attempt on {dfmt(inv.failed)} failed. A reminder may help.</div>}
    <div className="acts" style={{ margin: '14px 0' }}>
      {st === 'draft' && <><button className="btn p" onClick={() => onSend(inv.id)}><Ic n="paper-plane-tilt" />Send</button><button className="btn" onClick={() => onEdit(inv.id)}><Ic n="pencil-simple" />Edit</button></>}
      {open && <><button className="btn p" onClick={() => onSend(inv.id)}><Ic n="bell" />Send reminder</button><button className="btn" onClick={() => setPaying(!paying)}><Ic n="hand-coins" />Record payment</button></>}
      <button className="btn" onClick={() => { window.print() }}><Ic n="download-simple" />Download PDF</button>
      <button className="btn" onClick={() => onDup(inv.id)}><Ic n="copy" />Duplicate</button></div>
    {paying && <div className="card" style={{ background: 'var(--bg)', marginBottom: 14 }}><label className="f" htmlFor="pm">Payment method</label>
      <select id="pm" value={method} onChange={e => setMethod(e.target.value)} style={{ width: '100%' }}>{METHODS.map(m => <option key={m}>{m}</option>)}</select>
      <div className="hint">This records {fmt(total(inv), inv.cur)} received today.</div>
      <div className="acts" style={{ marginTop: 10 }}><button className="btn" onClick={() => setPaying(false)}>Cancel</button><button className="btn p" onClick={() => { onPay(inv.id, method); setPaying(false) }}>Mark as paid</button></div></div>}
    <Paper inv={inv} cust={cust} st={st} />
    <div className="hint" style={{ marginTop: 8 }}>Choose “Save as PDF” in the print dialog.</div>

    <div className="sec">ACTIVITY</div>
    <ul className="tl" aria-label="Invoice activity">{steps.map(([t, c], i) => <li key={i} className={c}><Ic n={c === 'd1' ? 'check-circle' : c === 'd3' ? 'warning-circle' : 'clock'} w="fill" />{t}</li>)}</ul>

    {inv.sentOff !== null && <><div className="sec">PAYMENT</div>
      <div className="kv"><span className="mu">Payment link</span><span><button className="btn sm" onClick={copyLink}><Ic n="link" s={14} />Copy link</button></span></div>
      <div className="kv"><span className="mu">Reminders</span><span>{inv.auto ? 'Automatic' : 'Off'}</span></div>
      {inv.paidOff !== null && <div className="kv"><span className="mu">Received</span><span>{fmt(total(inv), inv.cur)} · {dfmt(inv.paidOff)}</span></div>}</>}
    {inv.rec !== 'none' && <div className="kv"><span className="mu">Repeats</span><span>{REC[inv.rec]} · next {nextRun(inv)}</span></div>}

    {(st === 'draft' || open) && <><div className="sec">DANGER ZONE</div>
      {!confirm ? <button className="btn danger" onClick={() => setConfirm(st === 'draft' ? 'delete' : 'void')}><Ic n="trash" />{st === 'draft' ? 'Delete draft' : 'Void invoice'}</button>
        : <div className="alert e" style={{ display: 'block' }}><b>{confirm === 'delete' ? 'Delete this draft?' : 'Void ' + inv.id + '?'}</b><div style={{ margin: '4px 0 10px' }}>{confirm === 'delete' ? 'This cannot be undone.' : 'The customer can no longer pay it. This cannot be undone.'}</div>
          <div className="acts"><button className="btn" onClick={() => setConfirm('')}>Keep it</button><button className="btn danger p" onClick={() => confirm === 'delete' ? onDelete(inv.id) : onVoid(inv.id)}>{confirm === 'delete' ? 'Delete' : 'Void invoice'}</button></div></div>}</>}
  </>;
}

/* ---- page ---- */
function App() {
  const [invs, setInvs] = useState(seed), [custs, setCusts] = useState(CUSTS), [loading, setLoading] = useState(true);
  const [view, setView] = useState({ m: 'list' }), [drawer, setDrawer] = useState(null), [sendFor, setSendFor] = useState(null), [toast, setToast] = useState('');
  const [tab, setTab] = useState('all'), [q, setQ] = useState('');
  const lastRef = useRef(null), closeRef = useRef(null), nextNum = useRef(1049);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 450); return () => clearTimeout(t) }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast]);
  useEffect(() => {
    if (!drawer || sendFor) return;
    if (closeRef.current) closeRef.current.focus();
    const k = e => { if (e.key === 'Escape') close() };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [drawer, sendFor]);

  const custOf = id => custs.find(c => c.id === id);
  const open = (id, e) => { lastRef.current = e.currentTarget; setDrawer(id) };
  const close = () => { setDrawer(null); setTimeout(() => { if (lastRef.current && lastRef.current.focus) lastRef.current.focus() }, 0) };
  const patch = (id, fn) => setInvs(l => l.map(x => x.id === id ? fn(x) : x));

  const save = inv => { const id = inv.id || 'INV-' + (nextNum.current++), rec = { ...inv, id }; setInvs(l => l.some(x => x.id === id) ? l.map(x => x.id === id ? rec : x) : [rec, ...l]); return id };
  const confirmSend = to => {
    const id = sendFor, inv = invs.find(x => x.id === id), first = inv.sentOff === null;
    patch(id, x => first ? { ...x, sentOff: 0, sentTo: to } : { ...x, sentTo: to, reminders: [...x.reminders, 0] });
    setSendFor(null); setView({ m: 'list' }); setDrawer(id);
    setToast(first ? 'Invoice ' + id + ' sent to ' + to : 'Reminder sent to ' + to);
  };
  const pay = (id, method) => { patch(id, x => ({ ...x, paidOff: 0, method, failed: null })); setToast('Payment recorded') };
  const voidInv = id => { patch(id, x => ({ ...x, voided: true })); setToast('Invoice voided') };
  const del = id => { setInvs(l => l.filter(x => x.id !== id)); setDrawer(null); setToast('Draft deleted') };
  const dup = id => { const x = invs.find(y => y.id === id); const nid = save({ ...x, id: null, issueOff: 0, sentOff: null, paidOff: null, method: '', voided: false, reminders: [], failed: null, sentTo: '', items: x.items.map(i => ({ ...i, k: uid() })) }); setDrawer(nid); setToast('Duplicated as ' + nid + ' (draft)') };

  const live = invs.filter(i => statusOf(i) !== 'void');
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return live.filter(i => (tab === 'all' || statusOf(i) === tab) && (!ql || (i.id + ' ' + (custOf(i.cust) || { name: '' }).name).toLowerCase().includes(ql))).sort((a, b) => a.issueOff - b.issueOff || (a.id < b.id ? 1 : -1));
  }, [invs, tab, q, custs]);
  const cnt = s => live.filter(i => statusOf(i) === s).length;
  const sumUsd = l => l.reduce((a, i) => a + usd(i), 0);
  const outst = live.filter(i => ['sent', 'overdue'].includes(statusOf(i))), over = live.filter(i => statusOf(i) === 'overdue'), paid30 = live.filter(i => statusOf(i) === 'paid' && i.paidOff <= 30);
  const stat = (l, v, d) => <div className="card stat"><small>{l}</small><b>{loading ? '—' : v}</b><span className="d">{d}</span></div>;
  const sel = invs.find(i => i.id === drawer), editing = view.m === 'edit' ? invs.find(i => i.id === view.id) : null;
  const tabs = [['all', 'All'], ['draft', 'Drafts (' + cnt('draft') + ')'], ['sent', 'Awaiting payment (' + cnt('sent') + ')'], ['overdue', 'Overdue (' + cnt('overdue') + ')'], ['paid', 'Paid']];
  const sendInv = sendFor && invs.find(x => x.id === sendFor);

  if (view.m === 'edit') return <div className="app"><Sidebar here="Invoices" /><main>
    <Editor key={view.id || 'new'} init={editing} custs={custs} addCust={c => setCusts(l => [...l, c])} onSave={save} onSend={id => setSendFor(id)} back={() => setView({ m: 'list' })} />
    {sendInv && <><div className="ov hi" onClick={() => setSendFor(null)} /><SendModal inv={sendInv} cust={custOf(sendInv.cust)} onSend={confirmSend} close={() => setSendFor(null)} /></>}
    {toast && <div className="toast" role="status">{toast}</div>}</main></div>;

  return <div className="app"><Sidebar here="Invoices" />
    <main>
      <div className="top"><div><h1>Invoices</h1><p className="sub">Create invoices, send them to customers and keep track of who has paid.</p></div>
        <button className="btn p" onClick={() => setView({ m: 'edit', id: null })}><Ic n="plus" />Create invoice</button></div>

      <div className="stats">
        {stat('Outstanding', '≈ ' + fmt(sumUsd(outst)), outst.length + ' unpaid invoices')}
        {stat('Overdue', '≈ ' + fmt(sumUsd(over)), over.length ? over.length + ' need a follow-up' : 'Nothing overdue')}
        {stat('Paid · last 30 days', '≈ ' + fmt(sumUsd(paid30)), paid30.length + ' invoices')}
        {stat('Drafts', cnt('draft'), 'Not sent yet')}
      </div>

      <div className="card">
        <div className="filters" role="search">
          <div className="seg" role="tablist" aria-label="Invoice status">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div className="srch"><span className="si"><Ic n="magnifying-glass" s={16} /></span><input aria-label="Search invoices" placeholder="Search invoice number or customer" value={q} onChange={e => setQ(e.target.value)} /></div>
          {(q || tab !== 'all') && <button className="btn sm" onClick={() => { setQ(''); setTab('all') }}>Clear filters</button>}
        </div>
        {!loading && rows.length === 0 ?
          <div className="empty"><Ic n="file-text" s={32} /><b>{q || tab !== 'all' ? 'No invoices match' : 'No invoices yet'}</b>{q || tab !== 'all' ? 'Try a different search or clear your filters.' : 'Create your first invoice to get paid.'}
            <div>{q || tab !== 'all' ? <button className="btn" onClick={() => { setQ(''); setTab('all') }}>Clear filters</button> : <button className="btn p" onClick={() => setView({ m: 'edit', id: null })}>Create invoice</button>}</div></div>
          : <div className="wrap"><table aria-busy={loading}>
            <thead><tr><th>Invoice</th><th className="hide-s">Issued</th><th className="hide-s">Due</th><th>Status</th><th className="r">Amount</th></tr></thead>
            <tbody>{loading ? [0, 1, 2, 3, 4].map(i => <tr key={i}>{[150, 70, 70, 90, 80].map((w, j) => <td key={j} className={j === 1 || j === 2 ? 'hide-s' : ''}><div className="sk" style={{ width: w, marginLeft: j === 4 ? 'auto' : 0 }} /></td>)}</tr>)
              : rows.map(i => {
                const st = statusOf(i), c = custOf(i.cust);
                return <tr key={i.id} className="rw" onClick={e => open(i.id, e)}>
                  <td><button className="lnk" onClick={e => { e.stopPropagation(); open(i.id, e) }}>{c ? c.name : 'No customer'}</button><div className="mu sm2">{i.id}{i.rec !== 'none' && ' · repeats ' + i.rec}</div></td>
                  <td className="hide-s mu nw">{dfmt(i.issueOff)}</td><td className="hide-s mu nw">{i.sentOff === null ? '—' : dfmt(dueOff(i))}</td>
                  <td><span className={'pill ' + STATUS[st][1]}>{STATUS[st][0]}</span>{st === 'overdue' && <div className="mu sm2">{dueOff(i)} days late</div>}</td>
                  <td className="r nw">{fmt(total(i), i.cur)}</td></tr>
              })}</tbody></table></div>}
      </div>

      {drawer && sel && <><div className="ov" onClick={close} />
        <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dt">
          <Detail key={sel.id} inv={sel} cust={custOf(sel.cust)} onEdit={id => { setDrawer(null); setView({ m: 'edit', id }) }} onSend={id => setSendFor(id)} onPay={pay} onVoid={voidInv} onDelete={del} onDup={dup} close={close} closeRef={closeRef} say={setToast} /></div></>}
      {sendInv && <><div className="ov hi" onClick={() => setSendFor(null)} /><SendModal inv={sendInv} cust={custOf(sendInv.cust)} onSend={confirmSend} close={() => setSendFor(null)} /></>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);