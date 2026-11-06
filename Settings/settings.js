const { useState, useEffect, useRef } = React;
const { Ic, Sidebar } = Montra;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const num = s => parseFloat(String(s).replace(/,/g, ''));
const TABS = ['Business', 'Profile', 'Security', 'Limits', 'Developers', 'Audit log'];
const BIZ = { name: 'Northwind Studio', legal: 'Northwind Studio Inc.', industry: 'Design and software', country: 'Nigeria', regno: 'RC 1847326', address: '14 Adeola Odeku Street, Victoria Island, Lagos', email: 'finance@northwind.studio' };
const ME = { name: 'Seun D.', email: 'seun@northwind.studio', phone: '+234 802 555 0147', tz: 'Africa/Lagos', cur: 'USD' };
const LIM = { transfer: '50000', daily: '150000', approval: '10000', auto: '100', adminOver: '2500' };
const PLAN_MAX = 100000; /* per-transfer ceiling for this plan */
const SESS = [{ id: 1, dev: 'Chrome on Mac', loc: 'Lagos, Nigeria', last: 'Active now', cur: true }, { id: 2, dev: 'Safari on iPhone', loc: 'Lagos, Nigeria', last: 'Yesterday' }, { id: 3, dev: 'Firefox on Windows', loc: 'Abuja, Nigeria', last: 'Oct 25' }];
const LOGINS = [['Chrome on Mac', 'Lagos, Nigeria', 'Today, 8:40 AM', 'Signed in'], ['Safari on iPhone', 'Lagos, Nigeria', 'Yesterday, 6:12 PM', 'Signed in'], ['Chrome on Windows', 'London, United Kingdom', 'Oct 27, 2:03 AM', 'Blocked']];
const KEYS = [{ id: 1, name: 'Accounting sync', tail: '4f2a', scope: 'Read only', made: 'Sep 14', used: 'Today' }, { id: 2, name: 'Payout webhook', tail: '9c71', scope: 'Read and write', made: 'Aug 2', used: 'Nov 1' }];
const INTEG = [{ id: 'slack', n: 'Slack', d: 'Post approval requests and alerts to a channel.', on: true, ic: 'slack-logo' }, { id: 'stripe', n: 'Stripe', d: 'Bring payouts into Transactions automatically.', on: true, ic: 'credit-card' }, { id: 'qb', n: 'QuickBooks', d: 'Send categorised transactions to your books.', on: false, ic: 'books' }];
const AUDIT = [['Seun D.', 'Team', 'Changed Ife B. from Employee to Accountant', 'Nov 1, 3:20 PM'], ['Kemi R.', 'Payments', 'Requested bulk payment · 8 contractors ($30,000)', 'Nov 3, 9:12 AM'], ['Seun D.', 'Security', 'Signed in from Chrome on Mac, Lagos', 'Nov 3, 8:40 AM'], ['Seun D.', 'Team', 'Suspended Bola S.', 'Oct 29, 11:05 AM'], ['Kemi R.', 'Payments', 'Approved Expense · Design software ($120)', 'Oct 28, 4:48 PM'], ['Seun D.', 'Security', 'Changed password', 'Oct 20, 10:30 AM'], ['Seun D.', 'Settings', 'Created API key “Payout webhook”', 'Aug 2, 1:15 PM']];

function save(name, rows) { const b = new Blob([rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="m-t"><div className="mb"><h2 id="m-t">{title}</h2>{children(() => ref.current.close())}</div></dialog>;
}
function Foot({ close, ok, danger }) { return <div className="qa" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className={'btn ' + (danger ? 'd' : 'p')}>{ok}</button></div>; }

function PwdForm({ onDone, close }) {
  const [a, setA] = useState(''), [b, setB] = useState(''), [c, setC] = useState(''), [err, setErr] = useState('');
  const go = e => {
    e.preventDefault();
    if (!a) return setErr('Enter your current password.');
    if (b.length < 10 || !/\d/.test(b) || !/[A-Za-z]/.test(b)) return setErr('Use at least 10 characters, with letters and a number.');
    if (b === a) return setErr('Choose a password you haven’t used here before.');
    if (b !== c) return setErr('The new passwords don’t match.');
    onDone(); close();
  };
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <label>Current password<input type="password" autoComplete="current-password" value={a} autoFocus onChange={e => { setA(e.target.value); setErr(''); }} /></label>
    <label>New password<input type="password" autoComplete="new-password" value={b} onChange={e => { setB(e.target.value); setErr(''); }} /></label>
    <label>Confirm new password<input type="password" autoComplete="new-password" value={c} onChange={e => { setC(e.target.value); setErr(''); }} /></label>
    <p className="err" role="alert">{err}</p><Foot close={close} ok="Change password" /></form>;
}
function TwoFaForm({ onDone, close }) {
  const [v, setV] = useState(''), [err, setErr] = useState('');
  const go = e => { e.preventDefault(); if (!/^\d{6}$/.test(v.trim())) return setErr('Enter the 6 digit code from your authenticator app.'); onDone(); close(); };
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <p style={{ margin: 0 }}>Add this key to an authenticator app such as Google Authenticator or 1Password, then enter the code it shows.</p>
    <div className="code" aria-label="Setup key">JBSW Y3DP EHPK 3PXP</div>
    <label>6 digit code<input value={v} inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus onChange={e => { setV(e.target.value); setErr(''); }} /></label>
    <p className="hint">In this prototype any 6 digit code works.</p><p className="err" role="alert">{err}</p><Foot close={close} ok="Turn on" /></form>;
}
function KeyForm({ onMake, close }) {
  const [n, setN] = useState(''), [sc, setSc] = useState('Read only'), [err, setErr] = useState(''), [key, setKey] = useState(null), [cp, setCp] = useState(false);
  const go = e => {
    e.preventDefault(); if (!n.trim()) return setErr('Give the key a name so you can recognise it later.');
    const k = 'ldg_live_' + Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join(''); setKey(k); onMake({ name: n.trim(), scope: sc, tail: k.slice(-4) });
  };
  if (key) return <div style={{ display: 'grid', gap: 12 }}><p style={{ margin: 0 }}><b>Copy your key now.</b> For your security we only show it once.</p><div className="code">{key}</div>
    <div className="qa" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(key); setCp(true); } catch (e) { setCp(false); } }}><Ic n="copy" />{cp ? 'Copied' : 'Copy key'}</button><button className="btn p" onClick={close}>Done</button></div></div>;
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <label>Name<input value={n} autoFocus placeholder="For example, Accounting sync" onChange={e => { setN(e.target.value); setErr(''); }} /></label>
    <label>Access<select value={sc} onChange={e => setSc(e.target.value)}><option>Read only</option><option>Read and write</option></select></label>
    <p className="err" role="alert">{err}</p><Foot close={close} ok="Create key" /></form>;
}

function App() {
  const [page, setPage] = useState('Settings'), [tab, setTab] = useState('Business'), [toast, setToast] = useState(''), [modal, setModal] = useState(null);
  const [biz, setBiz] = useState(BIZ), [bizS, setBizS] = useState(BIZ), [me, setMe] = useState(ME), [meS, setMeS] = useState(ME), [lim, setLim] = useState(LIM), [limS, setLimS] = useState(LIM);
  const [berr, setBerr] = useState(''), [lerr, setLerr] = useState(''), [twofa, setTwofa] = useState(true), [pwd, setPwd] = useState('Oct 20'), [sess, setSess] = useState(SESS), [keys, setKeys] = useState(KEYS), [integ, setInteg] = useState(INTEG);
  const [audit, setAudit] = useState(AUDIT), [aq, setAq] = useState(''), [at, setAt] = useState('All');
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id); }, [toast]);
  const say = (t, type, l) => { setToast(t); setAudit(a => [['Seun D.', type, l || t, 'Just now'], ...a]); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const saveBiz = () => { if (!biz.name.trim() || !biz.legal.trim()) return setBerr('Enter both the business name and the legal name.'); if (!/^\S+@\S+\.\S+$/.test(biz.email)) return setBerr('Enter a valid business email.'); setBerr(''); setBizS(biz); say('Business profile saved', 'Settings', 'Updated the business profile'); };
  const saveMe = () => { if (!me.name.trim()) return setBerr('Enter your name.'); setBerr(''); setMeS(me); say('Profile saved', 'Settings', 'Updated personal profile'); };
  const saveLim = () => {
    const v = Object.fromEntries(Object.entries(lim).map(([k, x]) => [k, num(x)]));
    if (Object.values(v).some(x => !(x > 0))) return setLerr('Every limit needs an amount greater than zero.');
    if (v.transfer > PLAN_MAX) return setLerr(`The per-transfer limit can’t be more than ${fmt(PLAN_MAX)} on your plan.`);
    if (v.approval > v.transfer) return setLerr('The approval threshold must be at or below the per-transfer limit.');
    if (v.transfer > v.daily) return setLerr('The daily limit must be at least the per-transfer limit.');
    if (v.auto > v.adminOver) return setLerr('Auto-approved expenses must stay under the Admin threshold.');
    setLerr(''); setLimS(lim); say('Limits saved', 'Settings', 'Changed transaction and approval limits');
  };
  const tabKey = (i, e) => { const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : null; if (n === null) return; e.preventDefault(); setTab(TABS[n]); document.getElementById('tab-' + n).focus(); };
  const rows = audit.filter(r => (at === 'All' || r[1] === at) && (r[0] + r[2]).toLowerCase().includes(aq.toLowerCase()));
  const Fld = (lbl, obj, set, k, extra = {}) => <label>{lbl}<input value={obj[k]} {...extra} onChange={e => { set({ ...obj, [k]: e.target.value }); setBerr(''); setLerr(''); }} /></label>;
  const LimF = (lbl, k, hint) => <label>{lbl}<input value={lim[k]} inputMode="decimal" onChange={e => { setLim({ ...lim, [k]: e.target.value }); setLerr(''); }} /><span className="hint">{hint}</span></label>;

  return <div className="app">
    <Sidebar here="Settings" active={page} badges={{ 'Team & Approvals': 3 }} onNavigate={setPage} />
    <main>
      {page !== 'Settings' ? <><h1>{page}</h1><p className="sub">Not designed yet – go back to Settings.</p></> : <>
        <div className="top"><div><h1>Settings</h1><p className="sub">Your business, your account and how Montra is secured.</p></div></div>
        <div className="tabs" role="tablist" aria-label="Settings sections">{TABS.map((t, i) => <button key={t} id={'tab-' + i} role="tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => { setTab(t); setBerr(''); setLerr(''); }} onKeyDown={e => tabKey(i, e)}>{t}</button>)}</div>
        <div role="tabpanel" aria-labelledby={'tab-' + TABS.indexOf(tab)}>

          {tab === 'Business' && <div className="g g2"><div className="card"><h2 style={{ marginBottom: 12 }}><Ic n="buildings" />Business profile</h2><div className="form">
            {Fld('Business name', biz, setBiz, 'name')}{Fld('Legal name', biz, setBiz, 'legal')}
            <div className="form2">{Fld('Industry', biz, setBiz, 'industry')}{Fld('Country', biz, setBiz, 'country', { disabled: true })}</div>
            {Fld('Registration number', biz, setBiz, 'regno', { disabled: true })}{Fld('Registered address', biz, setBiz, 'address')}{Fld('Business email', biz, setBiz, 'email', { type: 'email' })}
            <p className="hint">Country and registration number are locked after verification. Contact support to change them.</p>
            <p className="err" role="alert">{berr}</p><div className="qa"><button className="btn p" disabled={same(biz, bizS)} onClick={saveBiz}>Save changes</button>{!same(biz, bizS) && <button className="btn" onClick={() => { setBiz(bizS); setBerr(''); }}>Discard</button>}</div></div></div>
            <div className="card"><h2><Ic n="seal-check" />Business verification</h2><div className="line"><span>Status</span><span className="pill completed">Verified</span></div><div className="line"><span>Directors verified</span><b>2 of 2</b></div><div className="line"><span>Documents</span><b>Approved</b></div>
              <a className="btn sm" style={{ marginTop: 8 }} href="../Onboarding/onboarding.html">View verification</a></div></div>}

          {tab === 'Profile' && <div className="g g2"><div className="card"><h2 style={{ marginBottom: 12 }}><Ic n="user-circle" />Personal profile</h2><div className="form">
            {Fld('Full name', me, setMe, 'name')}{Fld('Email', me, setMe, 'email', { disabled: true })}{Fld('Phone', me, setMe, 'phone', { type: 'tel' })}
            <div className="form2"><label>Time zone<select value={me.tz} onChange={e => setMe({ ...me, tz: e.target.value })}>{['Africa/Lagos', 'Europe/London', 'Europe/Berlin', 'America/New_York'].map(z => <option key={z}>{z}</option>)}</select></label>
              <label>Show totals in<select value={me.cur} onChange={e => setMe({ ...me, cur: e.target.value })}>{['USD', 'EUR', 'GBP', 'NGN'].map(z => <option key={z}>{z}</option>)}</select></label></div>
            <p className="err" role="alert">{berr}</p><div className="qa"><button className="btn p" disabled={same(me, meS)} onClick={saveMe}>Save changes</button></div></div></div>
            <div className="card"><h2><Ic n="identification-badge" />Your access</h2><div className="line"><span>Role</span><b>Admin</b></div><div className="line"><span>Department</span><b>Operations</b></div>
              <p className="mu fine">Roles and approval limits are managed by Admins.</p><a className="btn sm" href="../Team/team.html">Open Team &amp; Approvals</a></div></div>}

          {tab === 'Security' && <div className="col">
            <div className="card"><h2 style={{ marginBottom: 4 }}><Ic n="lock-key" />Sign-in</h2>
              <div className="line"><div><b>Password</b><div className="mu fine">Last changed {pwd}</div></div><button className="btn" onClick={() => setModal('pwd')}>Change password</button></div>
              <div className="line"><div><b>Two-factor authentication</b><div className="mu fine">{twofa ? 'On. We ask for a code from your authenticator app when you sign in.' : 'Off. Turn it on to protect your account.'}</div></div>
                <span className="ni"><span className={'pill ' + (twofa ? 'completed' : 'pending')}>{twofa ? 'On' : 'Off'}</span><button className="btn" onClick={() => setModal(twofa ? 'off2' : 'on2')}>{twofa ? 'Turn off' : 'Turn on'}</button></span></div></div>
            <div className="card"><div className="row" style={{ marginBottom: 4 }}><h2><Ic n="devices" />Devices and sessions</h2><button className="btn sm" disabled={sess.length < 2} onClick={() => { setSess(s => s.filter(x => x.cur)); say('Signed out of other devices', 'Security', 'Signed out all other devices'); }}>Sign out other devices</button></div>
              {sess.map(s => <div className="line" key={s.id}><div><b>{s.dev}</b>{s.cur && <span className="pill info" style={{ marginLeft: 6 }}>This device</span>}<div className="mu fine">{s.loc} · {s.last}</div></div>{!s.cur && <button className="btn sm" onClick={() => { setSess(l => l.filter(x => x.id !== s.id)); say(`Signed out ${s.dev}`, 'Security', `Signed out ${s.dev}`); }}>Sign out</button>}</div>)}</div>
            <div className="card"><h2 style={{ marginBottom: 6 }}><Ic n="clock-counter-clockwise" />Login activity</h2><div className="wrap"><table><thead><tr><th>Device</th><th>Location</th><th>When</th><th>Result</th></tr></thead><tbody>
              {LOGINS.map((l, i) => <tr key={i}><td><b>{l[0]}</b></td><td className="mu">{l[1]}</td><td className="mu">{l[2]}</td><td><span className={'pill ' + (l[3] === 'Blocked' ? 'failed' : 'completed')}>{l[3]}</span></td></tr>)}</tbody></table></div></div></div>}

          {tab === 'Limits' && <div className="g g2"><div className="card"><h2 style={{ marginBottom: 12 }}><Ic n="gauge" />Transaction and approval limits</h2><div className="form">
            {LimF('Per-transfer limit (USD)', 'transfer', `Largest single transfer. Up to ${fmt(PLAN_MAX)} on your plan.`)}{LimF('Daily transfer limit (USD)', 'daily', 'Most you can send in one day, all accounts combined.')}
            {LimF('Transfers need approval over (USD)', 'approval', 'A Finance Manager must approve anything larger.')}{LimF('Expenses approved automatically under (USD)', 'auto', 'No review needed below this amount.')}{LimF('Expenses need an Admin over (USD)', 'adminOver', 'Between the two amounts a Finance Manager approves.')}
            <p className="err" role="alert">{lerr}</p><div className="qa"><button className="btn p" disabled={same(lim, limS)} onClick={saveLim}>Save limits</button>{!same(lim, limS) && <button className="btn" onClick={() => { setLim(limS); setLerr(''); }}>Discard</button>}</div></div></div>
            <div className="card"><h2><Ic n="info" />How limits work</h2><p className="mu">Limits protect the business if a login is misused. Changes apply to new requests only, and each change is recorded in the audit log.</p><p className="mu">Only Admins can change limits.</p></div></div>}

          {tab === 'Developers' && <div className="col">
            <div className="card"><div className="row" style={{ marginBottom: 6 }}><h2><Ic n="key" />API keys</h2><button className="btn sm p" onClick={() => setModal('key')}><Ic n="plus" s={14} />Create key</button></div>
              {keys.length === 0 ? <p className="mu">No API keys yet. Create one to connect your own tools.</p> : <div className="wrap"><table><thead><tr><th>Name</th><th>Key</th><th>Access</th><th>Created</th><th>Last used</th><th className="r"><span className="sr">Actions</span></th></tr></thead><tbody>
                {keys.map(k => <tr key={k.id}><td><b>{k.name}</b></td><td className="mu">ldg_live_••••{k.tail}</td><td>{k.scope}</td><td className="mu">{k.made}</td><td className="mu">{k.used}</td><td><div className="acts"><button className="btn sm d" onClick={() => setModal({ rev: k })}>Revoke</button></div></td></tr>)}</tbody></table></div>}</div>
            <div className="card"><h2 style={{ marginBottom: 4 }}><Ic n="plugs-connected" />Integrations</h2>
              {integ.map(i => <div className="line" key={i.id}><div className="ni"><span className="flag"><Ic n={i.ic} /></span><div><b>{i.n}</b><div className="mu fine">{i.d}</div></div></div>
                <span className="ni"><span className={'pill ' + (i.on ? 'completed' : 'off')}>{i.on ? 'Connected' : 'Not connected'}</span><button className="btn sm" onClick={() => { setInteg(l => l.map(x => x.id === i.id ? { ...x, on: !x.on } : x)); say(i.on ? `${i.n} disconnected` : `${i.n} connected`, 'Settings', i.on ? `Disconnected ${i.n}` : `Connected ${i.n}`); }}>{i.on ? 'Disconnect' : 'Connect'}</button></span></div>)}</div></div>}

          {tab === 'Audit log' && <div className="card"><div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}><h2><Ic n="list-magnifying-glass" />Audit log</h2><button className="btn sm" onClick={() => { save('audit-log.csv', [['Who', 'Type', 'What', 'When'], ...rows]); setToast('Downloaded audit-log.csv'); }}><Ic n="download-simple" s={14} />Export CSV</button></div>
            <div className="tools"><input type="search" aria-label="Search the audit log" placeholder="Search by person or action" value={aq} onChange={e => setAq(e.target.value)} /><select aria-label="Filter by type" value={at} onChange={e => setAt(e.target.value)}>{['All', 'Team', 'Payments', 'Security', 'Settings'].map(x => <option key={x}>{x}</option>)}</select></div>
            <div className="wrap"><table><thead><tr><th>Who</th><th>Type</th><th>What happened</th><th>When</th></tr></thead><tbody>
              {rows.map((r, i) => <tr key={i}><td><b>{r[0]}</b></td><td><span className="pill info">{r[1]}</span></td><td>{r[2]}</td><td className="mu">{r[3]}</td></tr>)}
              {rows.length === 0 && <tr><td colSpan="4" className="mu">Nothing matches. Try a different search or type.</td></tr>}</tbody></table></div></div>}
        </div>

        {modal === 'pwd' && <Modal title="Change password" onClose={() => setModal(null)}>{close => <PwdForm close={close} onDone={() => { setPwd('Just now'); say('Password changed', 'Security', 'Changed password'); }} />}</Modal>}
        {modal === 'on2' && <Modal title="Turn on two-factor authentication" onClose={() => setModal(null)}>{close => <TwoFaForm close={close} onDone={() => { setTwofa(true); say('Two-factor authentication is on', 'Security', 'Turned on two-factor authentication'); }} />}</Modal>}
        {modal === 'off2' && <Modal title="Turn off two-factor authentication?" onClose={() => setModal(null)}>{close => <><p style={{ margin: 0 }}>Without a code, anyone with your password can sign in. We recommend keeping it on.</p>
          <div className="qa" style={{ justifyContent: 'flex-end' }}><button className="btn p" onClick={close}>Keep it on</button><button className="btn d" onClick={() => { setTwofa(false); say('Two-factor authentication is off', 'Security', 'Turned off two-factor authentication'); close(); }}>Turn off</button></div></>}</Modal>}
        {modal === 'key' && <Modal title="Create API key" onClose={() => setModal(null)}>{close => <KeyForm close={close} onMake={k => { setKeys(l => [{ id: Date.now(), ...k, made: 'Today', used: 'Never' }, ...l]); say(`API key “${k.name}” created`, 'Settings', `Created API key “${k.name}”`); }} />}</Modal>}
        {modal && modal.rev && <Modal title={`Revoke “${modal.rev.name}”?`} onClose={() => setModal(null)}>{close => <><p style={{ margin: 0 }}>Anything using this key stops working right away. This can’t be undone.</p>
          <div className="qa" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={close}>Cancel</button><button className="btn d" onClick={() => { setKeys(l => l.filter(x => x.id !== modal.rev.id)); say(`API key “${modal.rev.name}” revoked`, 'Settings', `Revoked API key “${modal.rev.name}”`); close(); }}>Revoke key</button></div></>}</Modal>}
        {toast && <div className="toast" role="status">{toast}</div>}
      </>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
