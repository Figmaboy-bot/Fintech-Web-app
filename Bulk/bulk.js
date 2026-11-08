const { useState, useEffect, useRef } = React;
const { Ic, Sidebar } = Montra;
const Store = MontraStore;

const CURS = ['USD', 'EUR', 'GBP', 'NGN'];
const BAL = { USD: 48230.5, EUR: 12400, GBP: 6150, NGN: 8450000 };
const USD_PER = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 0.00065 };
const APPROVAL = 10000, PER_TRANSFER = 50000, MAX_ROWS = 200;
const TEMPLATE = 'name,account,bank,currency,amount,reference\nJane Doe,0012345678,Chase,USD,1500,March invoice\n';
const SAMPLE = [['Maya Chen', '000123450001', 'Chase', 3500], ['Luis Ortega', '000123450002', 'Wells Fargo', 4200], ['Priya Nair', '000123450003', 'Bank of America', 3000], ['Tom Becker', '000123450004', 'Citibank', 3800], ['Sara Haddad', '000123450005', 'Chase', 4500], ['Noah Kim', '000123450006', 'US Bank', 3200], ['Zoe Adams', '000123450007', 'Capital One', 4000], ['Omar Said', '000123450008', 'Chase', 3800]]
  .map(([name, acct, bank, a]) => ({ name, acct, bank, cur: 'USD', amt: String(a), ref: 'Contractor payout' }));

const money = (n, c) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
let uid = 1;
const mk = r => ({ id: uid++, name: '', acct: '', bank: '', cur: 'USD', amt: '', ref: '', ...r });

function csv(text) {
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim())) out.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim())) out.push(row);
  return out;
}
function parse(text) {
  const rows = csv(text); if (!rows.length) return { rows: [], note: 'No rows found.' };
  const head = rows[0].map(x => x.trim().toLowerCase());
  const hasHead = head.includes('name') && head.includes('amount');
  const ix = k => hasHead ? head.indexOf(k) : ['name', 'account', 'bank', 'currency', 'amount', 'reference'].indexOf(k);
  const data = hasHead ? rows.slice(1) : rows, g = (r, k) => (ix(k) >= 0 ? (r[ix(k)] || '') : '').trim();
  const list = data.slice(0, MAX_ROWS).map(r => mk({ name: g(r, 'name'), acct: g(r, 'account'), bank: g(r, 'bank'), cur: (g(r, 'currency') || 'USD').toUpperCase(), amt: g(r, 'amount').replace(/[,\s$€£₦]/g, ''), ref: g(r, 'reference') }));
  return { rows: list, note: data.length > MAX_ROWS ? `Only the first ${MAX_ROWS} rows were read.` : '' };
}
function problems(r, all) {
  const e = [], n = Number(r.amt);
  if (r.name.trim().length < 2) e.push('Name is missing');
  if (!CURS.includes(r.cur)) e.push('Currency must be USD, EUR, GBP or NGN');
  else { const m = Store.checkAccount(r.cur, r.acct); if (m) e.push(m); }
  if (!r.bank.trim()) e.push('Bank is missing');
  if (!(n > 0)) e.push('Enter an amount above zero');
  else if (CURS.includes(r.cur) && n * USD_PER[r.cur] > PER_TRANSFER) e.push(`Over the ${money(PER_TRANSFER, 'USD')} per-transfer limit`);
  if (CURS.includes(r.cur) && all.some(o => o.id < r.id && o.cur === r.cur && Store.clean(o.acct) === Store.clean(r.acct) && r.acct.trim())) e.push('Duplicate of an earlier row');
  return e;
}
const download = (name, text) => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); } catch (e) { } };

function Picker({ onAdd, close }) {
  const [list] = useState(() => Store.beneficiaries()), [sel, setSel] = useState({});
  const n = Object.values(sel).filter(Boolean).length;
  return <><div className="picks">{list.map(b => <label className="chk" key={b.id}><input type="checkbox" checked={!!sel[b.id]} onChange={e => setSel({ ...sel, [b.id]: e.target.checked })} /><span><b>{b.name}</b> <span className="mu fine">{b.cur} · {b.bank}</span></span></label>)}</div>
    <div className="row"><button className="btn" onClick={close}>Cancel</button><button className="btn p" disabled={!n} onClick={() => { onAdd(list.filter(b => sel[b.id])); close(); }}>Add {n || ''} {n === 1 ? 'recipient' : 'recipients'}</button></div></>;
}
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="m-t"><div className="mb"><h2 id="m-t">{title}</h2>{children(() => ref.current.close())}</div></dialog>;
}

function App() {
  const [step, setStep] = useState(1), [rows, setRows] = useState([]), [text, setText] = useState(''), [note, setNote] = useState(''), [when, setWhen] = useState('now'), [date, setDate] = useState(''), [pick, setPick] = useState(false), [done, setDone] = useState(null), [toast, setToast] = useState(''), [busy, setBusy] = useState(false), [showErr, setShowErr] = useState(false);
  const file = useRef(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);

  const errs = rows.map(r => problems(r, rows)), bad = errs.filter(e => e.length).length;
  const totals = CURS.map(c => [c, rows.filter(r => r.cur === c).reduce((a, r) => a + (Number(r.amt) || 0), 0)]).filter(t => t[1] > 0);
  const short = totals.filter(([c, t]) => t > BAL[c]);
  const usdTotal = totals.reduce((a, [c, t]) => a + t * USD_PER[c], 0), needsApproval = usdTotal > APPROVAL;
  const minDate = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const dateBad = when === 'later' && !(date >= minDate);

  const load = (t, replace) => { const p = parse(t); setNote(p.note || (p.rows.length ? '' : 'No rows found. Check the format.')); if (p.rows.length) { setRows(r => replace ? p.rows : [...r, ...p.rows]); setText(''); setToast(`${p.rows.length} rows added`); } };
  const onFile = e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 1e6) return setNote('That file is too large. Keep it under 1 MB.'); const r = new FileReader(); r.onload = () => load(String(r.result), false); r.onerror = () => setNote('Could not read that file.'); r.readAsText(f); };
  const set = (id, p) => setRows(l => l.map(r => r.id === id ? { ...r, ...p } : r));
  const review = () => { setShowErr(true); if (!rows.length || bad) return; setStep(2); };
  const submit = () => {
    if (short.length || dateBad || busy) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); setDone({ ref: 'BLK-' + Math.random().toString(36).slice(2, 7).toUpperCase(), n: rows.length, totals, approval: needsApproval, when: when === 'later' ? date : '' }); setStep(3); }, 900);
  };
  const reset = () => { setRows([]); setStep(1); setDone(null); setShowErr(false); setWhen('now'); setDate(''); };

  return <div className="app"><Sidebar here="Bulk payment" active="Payments" />
    <main><div className="wrapb">
      <div className="top"><div><h1>Bulk payment</h1><p className="sub">Pay many people at once from a file, or build the list here.</p></div>
        <div className="qa"><a className="btn" href="../Recipients/recipients.html"><Ic n="address-book" />Recipients</a><a className="btn" href="../send-money/send.html"><Ic n="paper-plane-tilt" />Single payment</a></div></div>
      <div className="steps" aria-label="Progress">{['Add payments', 'Review', 'Done'].map((s, i) => <div key={s} className={'stp ' + (step === i + 1 ? 'on' : step > i + 1 ? 'ok' : '')} aria-current={step === i + 1 ? 'step' : undefined}><i>{step > i + 1 ? '✓' : i + 1}</i>{s}</div>)}</div>

      {step === 1 && <>
        <div className="two-col" style={{ marginBottom: 14 }}>
          <div className="card col"><h2><Ic n="file-csv" />Upload or paste a file</h2>
            <p className="hint" style={{ margin: 0 }}>Columns: name, account, bank, currency, amount, reference.</p>
            <textarea className="paste" aria-label="Paste CSV rows" placeholder={'Jane Doe,0012345678,Chase,USD,1500,March invoice'} value={text} onChange={e => setText(e.target.value)} />
            <div className="qa"><button className="btn p" disabled={!text.trim()} onClick={() => load(text, false)}>Add pasted rows</button>
              <input ref={file} type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFile} /><button className="btn" onClick={() => file.current.click()}><Ic n="upload-simple" />Upload CSV</button>
              <button className="btn" onClick={() => download('montra-bulk-template.csv', TEMPLATE)}><Ic n="download-simple" />Template</button></div>
            {note && <p className="err" role="alert">{note}</p>}</div>
          <div className="card col"><h2><Ic n="users" />Other ways to add</h2>
            <button className="btn" onClick={() => setPick(true)}><Ic n="address-book" />Choose from recipients</button>
            <button className="btn" onClick={() => setRows(r => [...r, mk({})])}><Ic n="plus" />Add a blank row</button>
            <button className="btn" onClick={() => { setRows(SAMPLE.map(mk)); setNote(''); }}><Ic n="flask" />Try a sample file (8 contractors)</button>
            <p className="hint" style={{ margin: 0 }}>Transfers over {money(APPROVAL, 'USD')} in total need Finance Manager approval. Each payment is limited to {money(PER_TRANSFER, 'USD')}.</p></div>
        </div>

        <div className="card"><div className="row" style={{ marginBottom: 8 }}><h2>Payments ({rows.length})</h2>{rows.length > 0 && <div className="qa">{bad > 0 && <button className="btn sm" onClick={() => setRows(r => r.filter((x, i) => !errs[i].length))}>Remove {bad} invalid</button>}<button className="btn sm" onClick={() => setRows([])}>Clear all</button></div>}</div>
          {rows.length === 0 ? <div className="empty"><Ic n="rows" s={32} /><b>No payments yet</b>Upload a file, paste rows, or choose from your recipients.</div> :
            <div className="wrap"><table><thead><tr><th>Name</th><th>Account</th><th>Bank</th><th>Cur.</th><th className="r">Amount</th><th>Reference</th><th><span className="sr">Remove</span></th></tr></thead>
              <tbody>{rows.map((r, i) => { const e = errs[i], show = showErr && e.length; return <tr key={r.id} className={show ? 'bad' : ''}>
                <td><input className="cell" aria-label="Name" value={r.name} onChange={x => set(r.id, { name: x.target.value })} /></td>
                <td><input className="cell" aria-label="Account" value={r.acct} onChange={x => set(r.id, { acct: x.target.value })} />{show ? <div className="rowerr">{e[0]}</div> : null}</td>
                <td><input className="cell" aria-label="Bank" value={r.bank} onChange={x => set(r.id, { bank: x.target.value })} /></td>
                <td><select className="cell" aria-label="Currency" value={r.cur} onChange={x => set(r.id, { cur: x.target.value })}>{CURS.map(c => <option key={c}>{c}</option>)}</select></td>
                <td><input className="cell amt" aria-label="Amount" inputMode="decimal" value={r.amt} onChange={x => set(r.id, { amt: x.target.value.replace(/[^0-9.]/g, '') })} /></td>
                <td><input className="cell" aria-label="Reference" value={r.ref} onChange={x => set(r.id, { ref: x.target.value })} /></td>
                <td><button className="btn sm" aria-label={'Remove row ' + (i + 1)} onClick={() => setRows(l => l.filter(x => x.id !== r.id))}><Ic n="x" s={14} /></button></td></tr>; })}</tbody></table></div>}
          {showErr && bad > 0 && <div className="alert e" role="alert" style={{ marginTop: 12 }}><Ic n="x-circle" w="fill" />{bad} {bad === 1 ? 'row needs' : 'rows need'} fixing before you can continue.</div>}
          <div className="row" style={{ marginTop: 14 }}><span className="mu">{totals.map(([c, t]) => money(t, c)).join(' · ') || 'Nothing to pay yet'}</span><button className="btn p" disabled={!rows.length} onClick={review}>Review payments</button></div></div></>}

      {step === 2 && <div className="card col">
        <h2>Review {rows.length} payments</h2>
        <div className="tot">{totals.map(([c, t]) => <span key={c} className={'pill ' + (t > BAL[c] ? 'failed' : 'info')}>{money(t, c)}</span>)}</div>
        {short.map(([c, t]) => <div className="alert e" role="alert" key={c}><Ic n="x-circle" w="fill" />Not enough {c}. You need {money(t, c)} and have {money(BAL[c], c)}. <a href={`../AddMoney/addmoney.html#${c}`}>Add money</a></div>)}
        {needsApproval && !short.length && <div className="alert"><Ic n="warning" w="fill" />This batch is over {money(APPROVAL, 'USD')}, so a Finance Manager must approve it before anything is sent.</div>}
        <div className="wrap"><table><thead><tr><th>Recipient</th><th>Bank</th><th>Reference</th><th className="r">Amount</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}><td><b>{r.name}</b><div className="mu fine">•••• {Store.clean(r.acct).slice(-4)}</div></td><td>{r.bank}</td><td className="mu">{r.ref || '—'}</td><td className="r nw">{money(Number(r.amt), r.cur)}</td></tr>)}</tbody></table></div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: 600, marginBottom: 6 }}>When to send</legend>
          <div className="seg" role="radiogroup" aria-label="When to send">{[['now', needsApproval ? 'After approval' : 'Now'], ['later', 'Schedule']].map(([k, l]) => <button key={k} role="radio" aria-checked={when === k} className={when === k ? 'on' : ''} onClick={() => setWhen(k)}>{l}</button>)}</div>
          {when === 'later' && <label style={{ marginTop: 10, maxWidth: 220 }}>Send on<input type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} aria-invalid={dateBad} /></label>}
          {dateBad && <p className="err" role="alert">Pick a date from tomorrow onwards.</p>}</fieldset>
        <div className="row"><button className="btn" onClick={() => setStep(1)}>Back</button><button className="btn p" disabled={busy || short.length > 0 || dateBad} onClick={submit}>{busy ? 'Submitting…' : needsApproval ? 'Submit for approval' : when === 'later' ? 'Schedule payments' : `Send ${rows.length} payments`}</button></div>
      </div>}

      {step === 3 && done && <div className="card"><div className="hero"><div className={'big ' + (done.approval ? 'w' : '')}><Ic n={done.approval ? 'clock' : 'check-circle'} w="fill" s={30} /></div>
        <h2 style={{ justifyContent: 'center' }}>{done.approval ? 'Waiting for approval' : done.when ? 'Payments scheduled' : 'Payments on their way'}</h2>
        <p className="sub">{done.n} payments · {done.totals.map(([c, t]) => money(t, c)).join(' + ')}{done.when ? ` · sends ${done.when}` : ''}</p></div>
        <div className="kv"><span className="mu">Batch reference</span><span><b>{done.ref}</b></span></div>
        <div className="kv"><span className="mu">Status</span><span><span className={'pill ' + (done.approval ? 'pending' : 'completed')}>{done.approval ? 'Pending approval' : done.when ? 'Scheduled' : 'Processing'}</span></span></div>
        {done.approval && <div className="alert i" style={{ marginTop: 12 }}><Ic n="info" w="fill" />Finance Managers can approve it from Team & Approvals. Nothing is sent until they do.</div>}
        <div className="qa" style={{ marginTop: 14 }}>{done.approval && <a className="btn p" href="../Team/team.html">Go to approvals</a>}<a className="btn" href="../Transactions/transactions.html">View transactions</a><button className="btn" onClick={reset}>New batch</button></div></div>}

      {pick && <Modal title="Choose recipients" onClose={() => setPick(false)}>{c => <Picker close={c} onAdd={l => { setRows(r => [...r, ...l.map(b => mk({ name: b.name, acct: b.acct, bank: b.bank, cur: b.cur }))]); setToast(`${l.length} added. Enter the amounts.`); }} />}</Modal>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div></main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
