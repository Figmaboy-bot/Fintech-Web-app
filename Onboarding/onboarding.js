const { useState, useEffect, useRef } = React;
const { Ic, ThemeToggle } = Montra;

const KEY = 'Montra-kyb';
const STEPS = [['Business details', 'buildings'], ['Business address', 'map-pin'], ['Directors & owners', 'users-three'], ['Documents', 'files'], ['Review & submit', 'seal-check']];
const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'United Kingdom', 'United States', 'Germany'];
const TYPES = ['Limited company (Ltd / LLC)', 'Sole proprietorship', 'Partnership', 'Non-profit', 'Other'];
const INDUSTRIES = ['Software and technology', 'Agency and creative services', 'E-commerce and retail', 'Consulting', 'Education', 'Food and hospitality', 'Logistics', 'Other'];
const REGNO = {
  Nigeria: { re: /^RC\d{5,8}$/i, ex: 'RC1234567', name: 'CAC registration number' },
  'United Kingdom': { re: /^[A-Z0-9]{8}$/i, ex: '12345678', name: 'Companies House number' },
  'United States': { re: /^\d{2}-?\d{7}$/, ex: '12-3456789', name: 'EIN' },
  Germany: { re: /^HR[AB]\s?\d{3,6}$/i, ex: 'HRB 123456', name: 'Commercial register number' },
  Ghana: { re: /^[A-Z0-9-]{5,20}$/i, ex: 'CS123456789', name: 'Registration number' },
  Kenya: { re: /^[A-Z0-9./-]{5,20}$/i, ex: 'PVT-ABC1234', name: 'Registration number' }
};
const ROLES = ['Director', 'Beneficial owner', 'Director and beneficial owner'];
const MAXMB = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST = { label: 'Bank statement, last 3 months', reason: 'The address on your proof of address does not match the registered address. A recent bank statement showing the registered address will resolve this.' };

const blank = () => ({
  step: 0, max: 0, status: 'draft', ref: '', submitted: '', requested: null, decl: false,
  biz: { name: '', legal: '', country: 'Nigeria', type: TYPES[0], regno: '', inc: '', industry: '', site: '', desc: '' },
  addr: { l1: '', l2: '', city: '', state: '', zip: '', country: '' },
  people: [], docs: { cert: null, addr: null, aoa: null }, extra: null
});
const load = () => { try { const s = localStorage.getItem(KEY); return s ? { ...blank(), ...JSON.parse(s) } : blank() } catch (e) { return blank() } };

/* ---- helpers ---- */
const isDir = p => p.role.includes('Director'), isOwn = p => p.role.includes('owner');
const todayIso = () => new Date().toISOString().slice(0, 10);
const age = s => { const b = new Date(s + 'T00:00:00'), t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a };
const size = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fileErr = f => !/\.(pdf|jpe?g|png)$/i.test(f.name) ? 'Upload a PDF, JPG or PNG file.' : f.size > MAXMB * 1048576 ? 'That file is larger than ' + MAXMB + ' MB.' : '';
const owned = d => d.people.reduce((a, p) => a + (isOwn(p) ? +p.pct || 0 : 0), 0);
const longDate = s => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function errorsFor(step, d) {
  const e = {}, b = d.biz, a = d.addr;
  if (step === 0) {
    if (b.name.trim().length < 2) e.name = 'Enter the name customers know you by.';
    if (b.legal.trim().length < 2) e.legal = 'Enter the name on your registration documents.';
    const R = REGNO[b.country]; if (!R.re.test(b.regno.trim())) e.regno = 'Enter a valid ' + R.name + ' (for example ' + R.ex + ').';
    if (!b.inc) e.inc = 'Enter the date the business was registered.'; else if (b.inc > todayIso()) e.inc = 'The date cannot be in the future.'; else if (b.inc < '1900-01-01') e.inc = 'Enter a valid date.';
    if (!b.industry) e.industry = 'Choose your industry.';
    if (b.site && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/.test(b.site.trim())) e.site = 'Enter a valid website, or leave it empty.';
  }
  if (step === 1) {
    if (a.l1.trim().length < 3) e.l1 = 'Enter the street address.';
    if (a.city.trim().length < 2) e.city = 'Enter the city.';
    if (a.state.trim().length < 2) e.state = 'Enter the state or region.';
    if (a.zip.trim().length < 3) e.zip = 'Enter the postal code.';
    if (!a.country) e.country = 'Choose a country.';
  }
  if (step === 2) {
    if (!d.people.some(isDir)) e.people = 'Add at least one director.';
    else if (owned(d) > 100) e.people = 'Ownership adds up to ' + owned(d) + '%. It cannot be more than 100%.';
  }
  if (step === 3) {
    if (!d.docs.cert) e.cert = 'Upload your certificate of incorporation.';
    if (!d.docs.addr) e.addr = 'Upload a proof of business address.';
    d.people.forEach(p => { if (!p.idDoc) e['id-' + p.id] = 'Upload an ID document for ' + p.name + '.' });
  }
  if (step === 4 && !d.decl) e.decl = 'Confirm the declaration to submit.';
  return e;
}

/* ---- form parts ---- */
const Err = ({ t }) => t ? <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{t}</div> : null;
function Field({ id, label, err, hint, children }) { return <div className="field"><label className="f" htmlFor={id}>{label}</label>{children}{hint && !err && <div className="hint">{hint}</div>}<Err t={err} /></div> }
function FileSlot({ id, label, help, value, onChange, required, error }) {
  const [local, setLocal] = useState('');
  const pick = e => { const f = e.target.files[0]; if (!f) return; const m = fileErr(f); setLocal(m); if (!m) onChange({ name: f.name, size: f.size }); e.target.value = '' };
  const msg = local || error;
  return <div className="docs"><div className="lab"><span id={id + '-l'}>{label}{required ? '' : ' (optional)'}</span></div>
    {help && <div className="hint" style={{ margin: '-2px 0 8px' }}>{help}</div>}
    {value ? <div className="file"><span><Ic n="file-text" s={18} /> {value.name}{value.size ? <span className="mu sm2"> · {size(value.size)}</span> : null}</span><button className="btn sm" onClick={() => { onChange(null); setLocal('') }}>Remove</button></div>
      : <div className={'drop'}><input id={id} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" aria-labelledby={id + '-l'} aria-invalid={!!msg} onChange={pick} /><div className="hint">PDF, JPG or PNG, up to {MAXMB} MB</div></div>}
    <Err t={msg} /></div>;
}

/* ---- steps ---- */
function StepBusiness({ d, set, E }) {
  const b = d.biz, R = REGNO[b.country];
  return <>
    <div className="two"><Field id="bn" label="Business name" err={E.name} hint="The name your customers know."><input id="bn" value={b.name} onChange={e => set('biz', 'name', e.target.value)} aria-invalid={!!E.name} autoComplete="organization" /></Field>
      <Field id="bl" label="Registered legal name" err={E.legal}><input id="bl" value={b.legal} onChange={e => set('biz', 'legal', e.target.value)} aria-invalid={!!E.legal} /></Field></div>
    <div className="two"><Field id="bc" label="Country of registration"><select id="bc" value={b.country} onChange={e => set('biz', 'country', e.target.value)}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field id="bt" label="Business type"><select id="bt" value={b.type} onChange={e => set('biz', 'type', e.target.value)}>{TYPES.map(c => <option key={c}>{c}</option>)}</select></Field></div>
    <div className="two"><Field id="br" label={R.name} err={E.regno} hint={'For example ' + R.ex}><input id="br" value={b.regno} onChange={e => set('biz', 'regno', e.target.value)} aria-invalid={!!E.regno} autoComplete="off" /></Field>
      <Field id="bi" label="Date of registration" err={E.inc}><input id="bi" type="date" max={todayIso()} value={b.inc} onChange={e => set('biz', 'inc', e.target.value)} aria-invalid={!!E.inc} /></Field></div>
    <Field id="bd" label="Industry" err={E.industry}><select id="bd" value={b.industry} onChange={e => set('biz', 'industry', e.target.value)} aria-invalid={!!E.industry}><option value="">Select an industry</option>{INDUSTRIES.map(c => <option key={c}>{c}</option>)}</select></Field>
    <Field id="bw" label="Website (optional)" err={E.site}><input id="bw" value={b.site} onChange={e => set('biz', 'site', e.target.value)} aria-invalid={!!E.site} placeholder="northwindstudio.co" inputMode="url" /></Field>
    <Field id="bx" label="What does your business do? (optional)"><textarea id="bx" value={b.desc} maxLength={240} onChange={e => set('biz', 'desc', e.target.value)} /></Field>
  </>;
}
function StepAddress({ d, set, E }) {
  const a = d.addr;
  return <>
    <div className="alert i" style={{ marginTop: 0, marginBottom: 16 }}><Ic n="info" w="fill" />Use the address on your registration documents. We will ask for proof of it in a later step.</div>
    <Field id="a1" label="Street address" err={E.l1}><input id="a1" value={a.l1} onChange={e => set('addr', 'l1', e.target.value)} aria-invalid={!!E.l1} autoComplete="address-line1" /></Field>
    <Field id="a2" label="Apartment, suite or floor (optional)"><input id="a2" value={a.l2} onChange={e => set('addr', 'l2', e.target.value)} autoComplete="address-line2" /></Field>
    <div className="two"><Field id="ac" label="City" err={E.city}><input id="ac" value={a.city} onChange={e => set('addr', 'city', e.target.value)} aria-invalid={!!E.city} autoComplete="address-level2" /></Field>
      <Field id="as" label="State or region" err={E.state}><input id="as" value={a.state} onChange={e => set('addr', 'state', e.target.value)} aria-invalid={!!E.state} autoComplete="address-level1" /></Field></div>
    <div className="two"><Field id="az" label="Postal code" err={E.zip}><input id="az" value={a.zip} onChange={e => set('addr', 'zip', e.target.value)} aria-invalid={!!E.zip} autoComplete="postal-code" /></Field>
      <Field id="an" label="Country" err={E.country}><select id="an" value={a.country} onChange={e => set('addr', 'country', e.target.value)} aria-invalid={!!E.country}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></Field></div>
  </>;
}
function StepPeople({ d, setD, E }) {
  const [f, setF] = useState(null), [t, setT] = useState(false);
  const tot = owned(d);
  const fe = f && {
    name: f.name.trim().length < 2 ? 'Enter their full legal name.' : '',
    email: !EMAIL.test(f.email.trim()) ? 'Enter a valid email address.' : '',
    dob: !f.dob ? 'Enter their date of birth.' : f.dob > todayIso() || age(f.dob) < 18 ? 'They must be at least 18 years old.' : age(f.dob) > 110 ? 'Enter a valid date of birth.' : '',
    pct: isOwn(f) ? (!(+f.pct >= 25 && +f.pct <= 100) ? 'Beneficial owners hold between 25% and 100%.' : '') : ''
  };
  const bad = f && Object.values(fe).some(Boolean);
  const save = ev => {
    ev.preventDefault(); setT(true); if (bad) return;
    const p = { ...f, name: f.name.trim(), email: f.email.trim(), pct: isOwn(f) ? +f.pct : 0 };
    setD(o => ({ ...o, people: f.id ? o.people.map(x => x.id === f.id ? { ...x, ...p } : x) : [...o.people, { ...p, id: 'p' + Date.now(), idDoc: null }] })); setF(null); setT(false)
  };
  const first = !f && d.people.length === 0;
  return <>
    <p className="mu" style={{ marginTop: 0 }}>List every director, and everyone who owns 25% or more of the business. We will email each person a secure link to verify their identity.</p>
    {d.people.map(p => <div className="pp" key={p.id}><div><b>{p.name}</b><div className="mu sm2">{p.role}{isOwn(p) && ' · ' + p.pct + '%'} · {p.email}</div></div>
      <span><button className="btn sm" onClick={() => { setF({ ...p, pct: String(p.pct || '') }); setT(false) }}>Edit</button> <button className="btn sm" aria-label={'Remove ' + p.name} onClick={() => setD(o => ({ ...o, people: o.people.filter(x => x.id !== p.id) }))}><Ic n="trash" s={14} /></button></span></div>)}
    {d.people.length > 0 && <><div className="row sm2" style={{ marginTop: 12 }}><span>Ownership listed</span><span className={tot > 100 ? '' : 'mu'} style={tot > 100 ? { color: 'var(--er)' } : null}>{tot}%</span></div><div className={'tot' + (tot > 100 ? ' over' : '')}><i style={{ width: Math.min(100, tot) + '%' }} /></div></>}
    <Err t={E.people} />
    {!f && <button className={'btn' + (first ? ' p' : '')} style={{ marginTop: 12 }} onClick={() => { setF({ id: '', name: '', email: '', role: ROLES[0], pct: '', dob: '', nat: 'Nigeria' }); setT(false) }}><Ic n="plus" s={16} />{first ? 'Add the first person' : 'Add another person'}</button>}
    {f && <form className="card" style={{ background: 'var(--bg)', marginTop: 12, marginBottom: 0 }} onSubmit={save} noValidate>
      <h2 style={{ marginBottom: 12 }}>{f.id ? 'Edit person' : 'Add a person'}</h2>
      <Field id="pn" label="Full legal name" err={t && fe.name}><input id="pn" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} aria-invalid={t && !!fe.name} autoFocus /></Field>
      <Field id="pe" label="Email" err={t && fe.email}><input id="pe" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} aria-invalid={t && !!fe.email} /></Field>
      <div className="two"><Field id="pr" label="Role"><select id="pr" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></Field>
        {isOwn(f) && <Field id="pp" label="Ownership (%)" err={t && fe.pct}><input id="pp" type="number" min="25" max="100" step="any" inputMode="decimal" value={f.pct} onChange={e => setF({ ...f, pct: e.target.value })} aria-invalid={t && !!fe.pct} /></Field>}</div>
      <div className="two"><Field id="pd" label="Date of birth" err={t && fe.dob}><input id="pd" type="date" max={todayIso()} value={f.dob} onChange={e => setF({ ...f, dob: e.target.value })} aria-invalid={t && !!fe.dob} /></Field>
        <Field id="pt" label="Nationality"><select id="pt" value={f.nat} onChange={e => setF({ ...f, nat: e.target.value })}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></Field></div>
      <div className="nav" style={{ marginTop: 6 }}><button type="button" className="btn" onClick={() => { setF(null); setT(false) }}>Cancel</button><button type="submit" className="btn p">{f.id ? 'Save changes' : 'Add person'}</button></div></form>}
  </>;
}
function StepDocs({ d, setD, E }) {
  const setDoc = (k, v) => setD(o => ({ ...o, docs: { ...o.docs, [k]: v } }));
  return <>
    <FileSlot id="dc" required label="Certificate of incorporation" help="The official certificate from the registry." value={d.docs.cert} onChange={v => setDoc('cert', v)} error={E.cert} />
    <FileSlot id="da" required label="Proof of business address" help="A utility bill or bank statement from the last 3 months showing the registered address." value={d.docs.addr} onChange={v => setDoc('addr', v)} error={E.addr} />
    <FileSlot id="dm" label="Articles of association" help="Helps us verify who can act for the business." value={d.docs.aoa} onChange={v => setDoc('aoa', v)} />
    {d.people.length > 0 && <><h2 style={{ margin: '22px 0 12px' }}><Ic n="identification-card" />Identity documents</h2>
      {d.people.map(p => <FileSlot key={p.id} id={'di-' + p.id} required label={p.name + ' · passport, national ID or driver\'s licence'} value={p.idDoc} onChange={v => setD(o => ({ ...o, people: o.people.map(x => x.id === p.id ? { ...x, idDoc: v } : x) }))} error={E['id-' + p.id]} />)}</>}
    <div className="alert i"><Ic n="lock" w="fill" />Your documents are encrypted and only used to verify your business.</div>
  </>;
}
function StepReview({ d, setD, E, go }) {
  const b = d.biz, a = d.addr;
  const miss = [0, 1, 2, 3].flatMap(s => Object.values(errorsFor(s, d)).map(m => [s, m]));
  const sec = (t, s, rows) => <div className="card"><div className="row" style={{ marginBottom: 6 }}><h2>{t}</h2><button className="btn sm" onClick={() => go(s)}>Edit</button></div>{rows.map(([k, v]) => <div className="kv" key={k}><span className="mu">{k}</span><span>{v || '—'}</span></div>)}</div>;
  return <>
    {miss.length > 0 && <div className="alert" role="alert" style={{ marginTop: 0, marginBottom: 14 }}><Ic n="warning" w="fill" /><div><b>A few things are missing</b><ul>{miss.map(([s, m], i) => <li key={i}>{m} <button className="lk" onClick={() => go(s)}>Fix</button></li>)}</ul></div></div>}
    {sec('Business', 0, [['Name', b.name], ['Legal name', b.legal], ['Type', b.type], [REGNO[b.country].name, b.regno], ['Registered', b.inc && longDate(b.inc)], ['Industry', b.industry]])}
    {sec('Address', 1, [['Address', [a.l1, a.l2, a.city, a.state, a.zip, a.country].filter(Boolean).join(', ')]])}
    {sec('Directors and owners', 2, d.people.map(p => [p.name, p.role + (isOwn(p) ? ' · ' + p.pct + '%' : '')]))}
    {sec('Documents', 3, [['Certificate of incorporation', d.docs.cert && d.docs.cert.name], ['Proof of address', d.docs.addr && d.docs.addr.name], ['Articles of association', d.docs.aoa && d.docs.aoa.name], ['Identity documents', d.people.filter(p => p.idDoc).length + ' of ' + d.people.length + ' uploaded']])}
    <label className="chk"><input type="checkbox" checked={d.decl} onChange={e => setD(o => ({ ...o, decl: e.target.checked }))} aria-invalid={!!E.decl} /><span>I confirm the information is true and complete, and I am authorised to open this account for the business.</span></label>
    <Err t={E.decl} />
  </>;
}

/* ---- status page ---- */
function Status({ d, setD, say }) {
  const [up, setUp] = useState(null), [reset, setReset] = useState(false);
  const st = d.status;
  const flow = { review: ['done', 'active', 'todo', 'todo', 'todo'], info: ['done', 'action', 'todo', 'todo', 'todo'], approved: ['done', 'done', 'done', 'done', 'done'], rejected: ['done', 'done', 'done', 'done', 'fail'] }[st];
  const names = ['Application submitted', 'Documents check', 'Identity checks', 'Compliance review', 'Decision'];
  const text = {
    0: longDate(d.submitted),
    1: st === 'review' ? 'In progress' : st === 'info' ? 'We need one more document' : 'Complete',
    2: d.people.length + (d.people.length === 1 ? ' person' : ' people') + (st === 'approved' || st === 'rejected' ? ' verified' : ' invited by email'),
    3: st === 'approved' || st === 'rejected' ? 'Complete' : 'Not started',
    4: st === 'approved' ? 'Approved' : st === 'rejected' ? 'We could not approve this application' : 'Usually within 1 to 2 business days'
  };
  const icon = { done: 'check-circle', active: 'clock', action: 'warning', todo: 'circle', fail: 'x-circle' };
  const set = (status, extra) => setD(o => ({ ...o, status, ...extra }));
  const head = {
    review: ['clock', '', 'We are reviewing your application', 'Most reviews take 1 to 2 business days. We will email ' + (d.people[0] ? d.people[0].email : 'you') + ' when there is an update.'],
    info: ['warning', 'w', 'We need one more document', 'Upload it below and we will pick your review back up.'],
    approved: ['check-circle', 'o', 'Your business is verified', 'You can now send and receive money, issue cards and invoice customers.'],
    rejected: ['x-circle', 'e', 'We could not verify your business', 'Here is what happened and what you can do next.']
  }[st];
  const resubmit = () => { set('review', { requested: null, extra: up }); setUp(null); say('Thanks. We will take another look.') };
  return <div>
    <div className="card"><div className="hero"><div className={'big ' + head[1]}><Ic n={head[0]} w="fill" s={32} /></div><h1 tabIndex={-1}>{head[2]}</h1><p className="sub">{head[3]}</p><p className="mu sm2" style={{ marginTop: 8 }}>Application {d.ref} for {d.biz.name}</p></div>
      {st === 'info' && <div style={{ marginTop: 14 }}><div className="alert" style={{ marginTop: 0 }}><Ic n="info" w="fill" />{REQUEST.reason}</div><div style={{ marginTop: 14 }}><FileSlot id="ex" required label={REQUEST.label} value={up} onChange={setUp} /></div><button className="btn p" disabled={!up} onClick={resubmit}>Send document</button></div>}
      {st === 'approved' && <div style={{ marginTop: 14 }}><div className="kv"><span className="mu">Transfer limit</span><span>$50,000 per transfer</span></div><div className="kv"><span className="mu">Accounts</span><span>USD, EUR, GBP and NGN</span></div><div className="kv"><span className="mu">Cards</span><span>Virtual and physical</span></div>
        <div className="nav"><span /><a className="btn p" href="../overview/overview.html">Go to your dashboard</a></div></div>}
      {st === 'rejected' && <div style={{ marginTop: 14 }}><div className="alert e" style={{ marginTop: 0 }}><Ic n="warning" w="fill" />We could not match your registration number to the company registry. Check the number against your certificate and apply again.</div>
        <div className="nav">{!reset ? <button className="btn" onClick={() => setReset(true)}>Start a new application</button> : <span className="row" style={{ gap: 8 }}><span className="mu sm2">This clears what you entered.</span><button className="btn" onClick={() => setReset(false)}>Cancel</button><button className="btn danger p" onClick={() => { setD(blank()); setReset(false) }}>Start again</button></span>}<a className="btn" href="mailto:support@Montra.app">Contact support</a></div></div>}</div>

    <div className="card"><h2 style={{ marginBottom: 6 }}><Ic n="list-checks" />Progress</h2>
      <ol className="tl" aria-label="Verification progress">{names.map((n, i) => <li key={n} className={flow[i]}><Ic n={icon[flow[i]]} w={flow[i] === 'todo' ? 'regular' : 'fill'} s={22} /><div><b>{n}</b><div className="sm2">{text[i]}</div></div></li>)}</ol></div>
    <div className="card"><h2 style={{ marginBottom: 6 }}><Ic n="users-three" />Identity checks</h2>
      {d.people.map(p => <div className="pp" key={p.id}><div><b>{p.name}</b><div className="mu sm2">{p.role}</div></div><span className={'pill ' + (st === 'approved' || st === 'rejected' ? 'completed' : 'pending')}>{st === 'approved' || st === 'rejected' ? 'Verified' : 'Pending'}</span></div>)}</div>

    <div className="demo"><b className="sm2">PROTOTYPE CONTROLS</b><div className="mu sm2">Simulate the reviewer's decision to see every state of this screen.</div>
      <div className="acts"><button className="btn sm" onClick={() => set('review', { requested: null })}>Under review</button><button className="btn sm" onClick={() => set('info', { requested: REQUEST })}>Request more documents</button><button className="btn sm" onClick={() => set('approved')}>Approve</button><button className="btn sm" onClick={() => set('rejected')}>Reject</button></div></div>
  </div>;
}

/* ---- page ---- */
function App() {
  const [d, setD] = useState(load), [touched, setTouched] = useState({}), [busy, setBusy] = useState(false), [toast, setToast] = useState('');
  const head = useRef(null);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch (e) { } }, [d]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast]);
  useEffect(() => { if (head.current) head.current.focus(); window.scrollTo(0, 0) }, [d.step, d.status]);
  useEffect(() => { if (d.step === 1 && !d.addr.country) setD(o => ({ ...o, addr: { ...o.addr, country: o.biz.country } })) }, [d.step]);

  const set = (sec, k, v) => setD(o => ({ ...o, [sec]: { ...o[sec], [k]: v } }));
  const s = d.step, E = touched[s] ? errorsFor(s, d) : {};
  const focusBad = () => setTimeout(() => { const el = document.querySelector('[aria-invalid="true"]'); if (el && el.focus) el.focus() }, 0);
  const go = i => setD(o => ({ ...o, step: i }));
  const next = () => {
    setTouched(t => ({ ...t, [s]: true }));
    if (Object.keys(errorsFor(s, d)).length) { focusBad(); return }
    if (s < 4) setD(o => ({ ...o, step: s + 1, max: Math.max(o.max, s + 1) }));
    else submit();
  };
  const submit = () => {
    const all = [0, 1, 2, 3].some(i => Object.keys(errorsFor(i, d)).length);
    if (all) { window.scrollTo(0, 0); return }
    setBusy(true);
    setTimeout(() => { setD(o => ({ ...o, status: 'review', submitted: new Date().toISOString(), ref: 'KYB-' + Math.floor(100000 + Math.random() * 900000) })); setBusy(false) }, 900);
  };
  const exit = () => { setToast('Progress saved'); setTimeout(() => { location.href = '../overview/overview.html' }, 500) };

  const bar = <header className="bar"><div className="logo">Montra<b>ly</b></div><div className="r">{d.status === 'draft' && <button className="lk" onClick={exit} style={{ color: 'var(--tx)' }}>Save and exit</button>}<ThemeToggle /></div></header>;
  if (d.status !== 'draft') return <div className="page">{bar}<main className="wiz single"><div style={{ marginBottom: 16 }}><span className="mu sm2">Business verification</span></div><Status d={d} setD={setD} say={setToast} />{toast && <div className="toast" role="status">{toast}</div>}</main></div>;

  const titles = [['Tell us about your business', 'We use this to set up your account and verify the company.'], ['Where is your business registered?', 'This must match your registration documents.'], ['Who runs and owns the business?', 'Regulations require us to verify these people.'], ['Upload your documents', 'Clear photos or scans are fine.'], ['Review and submit', 'Check everything before you send it for review.']];
  const body = [<StepBusiness d={d} set={set} E={E} />, <StepAddress d={d} set={set} E={E} />, <StepPeople d={d} setD={setD} E={E} />, <StepDocs d={d} setD={setD} E={E} />, <StepReview d={d} setD={setD} E={E} go={go} />][s];
  const done = i => i < d.max || (i < s);
  return <div className="page">{bar}
    <main className="wiz">
      <nav aria-label="Verification steps"><ol className="steps">{STEPS.map(([t], i) => <li key={t}><button className={'stp' + (i === s ? ' on' : '') + (done(i) && i !== s ? ' ok' : '')} disabled={i > d.max} aria-current={i === s ? 'step' : undefined} onClick={() => go(i)}><i>{done(i) && i !== s ? <Ic n="check" w="bold" s={14} /> : i + 1}</i>{t}</button></li>)}</ol></nav>
      <section>
        <div className="mini"><span className="mu sm2">Step {s + 1} of 5 · {STEPS[s][0]}</span><div className="tot"><i style={{ width: (s + 1) * 20 + '%' }} /></div></div>
        <div style={{ marginBottom: 16 }}><h1 ref={head} tabIndex={-1}>{titles[s][0]}</h1><p className="sub">{titles[s][1]}</p></div>
        <div className="card">{body}
          <div className="nav"><button className="btn" onClick={() => go(s - 1)} disabled={s === 0 || busy}><Ic n="arrow-left" s={15} />Back</button>
            <button className="btn p" onClick={next} disabled={busy}>{s === 4 ? (busy ? 'Submitting…' : 'Submit for review') : 'Continue'}</button></div></div>
        <p className="mu sm2">Your progress is saved automatically on this device.</p>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);