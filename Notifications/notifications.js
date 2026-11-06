const { useState, useEffect } = React;
const { Ic, Sidebar } = Montra;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const CATS = [
  ['payments', 'Payments', 'arrow-down-left', 'Money arrives or a payment fails'],
  ['transfers', 'Transfers', 'paper-plane-tilt', 'Status updates on money you send'],
  ['balance', 'Low balance', 'warning', 'An account falls below your alert level'],
  ['approvals', 'Approvals', 'seal-check', 'Something needs your decision'],
  ['expenses', 'Expenses', 'receipt', 'Expense requests and decisions'],
  ['cards', 'Cards', 'credit-card', 'Card spending and limit changes'],
  ['invoices', 'Invoices', 'file-text', 'Invoices paid, due or overdue'],
  ['security', 'Security', 'shield-check', 'Sign-ins and account changes']
];
const NOTES = [
  { id: 1, cat: 'approvals', day: 'Today', time: '9:12 AM', title: 'Bulk payment is waiting for approval', body: '8 contractors, $30,000, requested by Kemi R.', href: '../Team/team.html', read: false },
  { id: 2, cat: 'security', day: 'Today', time: '8:40 AM', title: 'New sign-in from Lagos, Nigeria', body: 'Chrome on Mac. If this wasn’t you, change your password now.', href: '../Settings/settings.html', read: false },
  { id: 3, cat: 'payments', day: 'Today', time: '8:05 AM', title: 'Payment received: $4,200.00', body: 'Stripe payout landed in US Operating.', href: '../Transactions/transactions.html', read: false },
  { id: 4, cat: 'cards', day: 'Today', time: '7:30 AM', title: 'Card limit raise requested', body: 'Marketing card, $5,000, requested by Dev K.', href: '../Cards/cards.html', read: false },
  { id: 5, cat: 'balance', day: 'Yesterday', time: '4:18 PM', title: 'EU Collections is below your alert level', body: 'Balance is €12,450.75. Your alert level is €15,000.', href: '../Accounts/accounts.html', read: false },
  { id: 6, cat: 'payments', tone: 'er', day: 'Earlier', time: 'Oct 29', title: 'Payment from Acme GmbH failed', body: '€2,400.00 for INV-1039 didn’t go through. Ask them to try again.', href: '../Invoices/invoices.html', read: true },
  { id: 7, cat: 'invoices', day: 'Earlier', time: 'Oct 30', title: 'Invoice INV-1042 was paid', body: 'Lagos Fresh Ltd paid ₦850,000.', href: '../Invoices/invoices.html', read: true },
  { id: 8, cat: 'expenses', day: 'Earlier', time: 'Oct 28', title: 'Expense approved: Design software', body: '$120.00, approved by Kemi R.', href: '../Expenses/expenses.html', read: true },
  { id: 9, cat: 'security', day: 'Earlier', time: 'Oct 20', title: 'Your password was changed', body: 'If you didn’t do this, contact support right away.', href: '../Settings/settings.html', read: true }
];
const TONE = { payments: 'ok', invoices: 'ok', balance: 'wn', approvals: 'wn', cards: '', transfers: '', expenses: '', security: '' };
const FREQ = ['Instant', 'Daily digest', 'Weekly digest'];
const initPrefs = () => Object.fromEntries(CATS.map(c => [c[0], { app: true, email: !['expenses', 'cards'].includes(c[0]) }]));

function App() {
  const [page, setPage] = useState('Notifications'), [tab, setTab] = useState('Inbox'), [notes, setNotes] = useState(NOTES), [cat, setCat] = useState('all'), [unreadOnly, setUnreadOnly] = useState(false);
  const [prefs, setPrefs] = useState(initPrefs), [freq, setFreq] = useState('Instant'), [lv, setLv] = useState({ USD: '10000', EUR: '15000', GBP: '5000', NGN: '2000000' }), [lerr, setLerr] = useState(''), [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2400); return () => clearTimeout(id); }, [toast]);
  const unread = notes.filter(n => !n.read).length, C = k => CATS.find(c => c[0] === k);
  const shown = notes.filter(n => (cat === 'all' || n.cat === cat) && (!unreadOnly || !n.read));
  const set = (id, p) => setNotes(l => l.map(n => n.id === id ? { ...n, ...p } : n));
  const flip = (k, ch) => { if (k === 'security' && ch === 'app') return; setPrefs(p => ({ ...p, [k]: { ...p[k], [ch]: !p[k][ch] } })); setToast('Preference saved'); };
  const saveLv = () => { const bad = Object.entries(lv).find(([, v]) => !(parseFloat(v.replace(/,/g, '')) >= 0) || v.trim() === ''); if (bad) return setLerr(`Enter a number for the ${bad[0]} alert level, or 0 to turn it off.`); setLerr(''); setToast('Alert levels saved'); };
  const groups = ['Today', 'Yesterday', 'Earlier'].map(g => [g, shown.filter(n => n.day === g)]).filter(g => g[1].length);
  const tabs = [['Inbox', unread], ['Preferences', 0]];

  return <div className="app">
    <Sidebar here="Notifications" active={page} badges={{ 'Team & Approvals': 3, Notifications: unread }} onNavigate={setPage} />
    <main>
      {page !== 'Notifications' ? <><h1>{page}</h1><p className="sub">Not designed yet – go back to Notifications.</p></> : <>
        <div className="top"><div><h1>Notifications</h1><p className="sub">{unread ? `${unread} unread` : 'You’re all caught up'}</p></div>
          <div className="qa"><button className="btn" disabled={!unread} onClick={() => { setNotes(l => l.map(n => ({ ...n, read: true }))); setToast('All notifications marked as read'); }}><Ic n="checks" />Mark all as read</button></div></div>
        <div className="tabs" role="tablist" aria-label="Notification sections">{tabs.map((t, i) => <button key={t[0]} id={'tab-' + i} role="tab" aria-selected={tab === t[0]} tabIndex={tab === t[0] ? 0 : -1} onClick={() => setTab(t[0])}
          onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = 1 - i; setTab(tabs[n][0]); document.getElementById('tab-' + n).focus(); } }}>{t[0]}{t[1] > 0 && <span className="n">{t[1]}</span>}</button>)}</div>

        <div role="tabpanel" aria-labelledby={'tab-' + (tab === 'Inbox' ? 0 : 1)}>
          {tab === 'Inbox' && <div className="card">
            <div className="tools"><div className="chips" role="group" aria-label="Filter by type">
              <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>{CATS.map(c => <button key={c[0]} aria-pressed={cat === c[0]} onClick={() => setCat(c[0])}>{c[1]}</button>)}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} />Unread only</label></div>
            {groups.length === 0 && <p className="mu" style={{ margin: '20px 0' }}>{unreadOnly || cat !== 'all' ? 'Nothing matches these filters. Try showing all notifications.' : 'No notifications yet. We’ll tell you when money moves or something needs you.'}</p>}
            {groups.map(([g, list]) => <div key={g}><div className="grp">{g}</div><ul className="nl">{list.map(n => <li key={n.id} className={n.read ? '' : 'unread'}>
              <span className={'ic ' + (n.tone || TONE[n.cat])}><Ic n={C(n.cat)[2]} w="fill" /></span>
              <div><div className="nt">{!n.read && <><span className="dot" aria-hidden="true" /><span className="sr">Unread: </span></>}{n.title}</div><div className="mu">{n.body}</div><div className="mu fine">{C(n.cat)[1]} · {n.time}</div></div>
              <div className="side"><a className="btn sm p" href={n.href} onClick={() => set(n.id, { read: true })}>View</a>
                <span className="acts"><button className="btn sm" onClick={() => set(n.id, { read: !n.read })}>{n.read ? 'Mark unread' : 'Mark read'}</button>
                  <button className="btn sm" aria-label={`Dismiss ${n.title}`} onClick={() => { setNotes(l => l.filter(x => x.id !== n.id)); setToast('Notification dismissed'); }}><Ic n="x" s={14} /></button></span></div></li>)}</ul></div>)}</div>}

          {tab === 'Preferences' && <div className="col">
            <div className="card"><h2 style={{ marginBottom: 4 }}><Ic n="bell" />What you hear about</h2><p className="mu" style={{ margin: '0 0 8px' }}>Email goes to seun@northwind.studio.</p>
              <div className="wrap"><table className="pt"><thead><tr><th>Type</th><th>In the app</th><th>By email</th></tr></thead><tbody>
                {CATS.map(c => <tr key={c[0]}><td><b>{c[1]}</b><div className="mu fine">{c[3]}</div></td>
                  {['app', 'email'].map(ch => <td key={ch}><button type="button" role="switch" className="sw" aria-checked={prefs[c[0]][ch]} aria-label={`${c[1]} ${ch === 'app' ? 'in the app' : 'by email'}`} disabled={c[0] === 'security' && ch === 'app'} onClick={() => flip(c[0], ch)} /></td>)}</tr>)}</tbody></table></div>
              <p className="mu fine" style={{ margin: '8px 0 0' }}>Security alerts always show in the app so you never miss a sign-in or password change.</p></div>
            <div className="card"><h2><Ic n="envelope-simple" />Email timing</h2>
              <label style={{ maxWidth: 280, marginTop: 8 }}>How often should we email you?<select value={freq} onChange={e => { setFreq(e.target.value); setToast('Preference saved'); }}>{FREQ.map(f => <option key={f}>{f}</option>)}</select></label>
              <p className="mu fine" style={{ margin: '8px 0 0' }}>Security alerts are always sent straight away.</p></div>
            <div className="card"><h2><Ic n="warning" />Low balance alert levels</h2><p className="mu" style={{ margin: '4px 0 0' }}>We’ll tell you when an account falls below its level. Enter 0 to turn one off.</p>
              <div className="lvl">{Object.keys(lv).map(c => <label key={c}>{c} account<input value={lv[c]} inputMode="decimal" onChange={e => { setLv({ ...lv, [c]: e.target.value }); setLerr(''); }} /></label>)}</div>
              <p className="err" role="alert" style={{ marginTop: 8 }}>{lerr}</p><button className="btn p" onClick={saveLv}>Save alert levels</button></div>
          </div>}
        </div>
        {toast && <div className="toast" role="status">{toast}</div>}
      </>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
