const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Ledgerly;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const ROLES = ['Admin', 'Finance Manager', 'Accountant', 'Employee', 'Viewer'];
const DEPTS = ['Engineering', 'Marketing', 'Operations', 'Sales'];
const LIMIT = 50000; /* per-transfer limit, same as Send money */
/* Same rules the Send money, Expenses and Cards pages enforce. */
const RULES = [['Expense under $100', 'Approved automatically'], ['Expense $100 to $2,500', 'Finance Manager'], ['Expense over $2,500', 'Admin'], ['Transfer over $10,000', 'Finance Manager'], ['Transfer over $50,000', 'Not allowed'], ['Card limit change', 'Finance Manager']];
/* 1 = yes, 0 = no, text = partial. Order follows ROLES. */
const PERM = [
  ['View balances and transactions', [1, 1, 1, 'Own only', 1]],
  ['Send money', [1, 1, 0, 0, 0]],
  ['Approve payments', [1, 'Up to $50,000', 0, 0, 0]],
  ['Submit expenses', [1, 1, 1, 1, 0]],
  ['Approve expenses', [1, 'Up to $2,500', 0, 0, 0]],
  ['Manage cards', [1, 1, 0, 'Own card', 0]],
  ['Create invoices', [1, 1, 1, 0, 0]],
  ['Export reports', [1, 1, 1, 0, 0]],
  ['Manage team and roles', [1, 0, 0, 0, 0]]
];
const MEMBERS = [
  { id: 1, name: 'Seun D.', email: 'seun@northwind.studio', role: 'Admin', dept: 'Operations', limit: null, status: 'active', you: true },
  { id: 2, name: 'Kemi R.', email: 'kemi@northwind.studio', role: 'Finance Manager', dept: 'Operations', limit: 50000, status: 'active' },
  { id: 3, name: 'Ife B.', email: 'ife@northwind.studio', role: 'Accountant', dept: 'Operations', limit: null, status: 'active' },
  { id: 4, name: 'Tolu A.', email: 'tolu@northwind.studio', role: 'Employee', dept: 'Sales', limit: null, status: 'active' },
  { id: 5, name: 'Dev K.', email: 'dev@northwind.studio', role: 'Employee', dept: 'Engineering', limit: null, status: 'active' },
  { id: 6, name: 'Amara O.', email: 'amara@northwind.studio', role: 'Employee', dept: 'Marketing', limit: null, status: 'active' },
  { id: 7, name: 'Chidi N.', email: 'chidi@northwind.studio', role: 'Viewer', dept: 'Operations', limit: null, status: 'active' },
  { id: 8, name: 'Bola S.', email: 'bola@northwind.studio', role: 'Employee', dept: 'Sales', limit: null, status: 'suspended' }
];
const INVITES = [
  { id: 'i1', email: 'ngozi@northwind.studio', role: 'Employee', dept: 'Sales', sent: 'Nov 1' },
  { id: 'i2', email: 'accounts@brightbooks.co', role: 'Accountant', dept: 'Operations', sent: 'Oct 30' }
];
const APPROVALS = [
  { id: 1, t: 'Bulk payment · 8 contractors', a: 30000, by: 'Kemi R.', need: 'Admin' },
  { id: 2, t: 'Expense · Team offsite', a: 4250, by: 'Tolu A.', need: 'Admin', href: '../Expenses/expenses.html#EXP-1042' },
  { id: 3, t: 'Card limit raise · Marketing', a: 5000, by: 'Dev K.', need: 'Finance Manager', href: '../Cards/cards.html' }
];
const LOG = [['Kemi R.', 'Requested bulk payment · 8 contractors', 'Today'], ['Seun D.', 'Changed Ife B. from Employee to Accountant', 'Nov 1'], ['Seun D.', 'Suspended Bola S.', 'Oct 29'], ['Kemi R.', 'Approved Expense · Design software', 'Oct 28']];
const ini = n => n.split(' ').map(x => x[0]).join('').slice(0, 2);
const needsLimit = r => r === 'Finance Manager';

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="m-t"><div className="mb"><h2 id="m-t">{title}</h2>{children(() => ref.current.close())}</div></dialog>;
}

function MemberForm({ m, members, invites, lastAdmin, onSave, close }) {
  const [email, setEmail] = useState(m ? m.email : ''), [role, setRole] = useState(m ? m.role : 'Employee'), [dept, setDept] = useState(m ? m.dept : DEPTS[0]);
  const [lim, setLim] = useState(m && m.limit ? String(m.limit) : String(LIMIT)), [err, setErr] = useState('');
  const submit = e => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!m) {
      if (!/^\S+@\S+\.\S+$/.test(em)) return setErr('Enter a valid email address.');
      if (members.some(x => x.email === em) || invites.some(x => x.email === em)) return setErr('This person is already on the team or has a pending invitation.');
    }
    if (m && lastAdmin && role !== 'Admin') return setErr('You need at least one active Admin. Make someone else an Admin first.');
    let limit = null;
    if (needsLimit(role)) {
      limit = parseFloat(lim.replace(/,/g, ''));
      if (!(limit > 0 && limit <= LIMIT)) return setErr(`Enter an approval limit between $1 and ${fmt(LIMIT)}.`);
    }
    onSave({ email: em, role, dept, limit }); close();
  };
  return <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
    <label>Work email<input type="email" value={email} disabled={!!m} autoFocus={!m} placeholder="name@company.com" onChange={e => { setEmail(e.target.value); setErr(''); }} /></label>
    <label>Role<select value={role} onChange={e => { setRole(e.target.value); setErr(''); }}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></label>
    <label>Department<select value={dept} onChange={e => setDept(e.target.value)}>{DEPTS.map(d => <option key={d}>{d}</option>)}</select></label>
    {needsLimit(role) && <label>Can approve up to (USD)<input value={lim} inputMode="decimal" onChange={e => { setLim(e.target.value); setErr(''); }} /></label>}
    {role === 'Admin' && <p className="hint">Admins can approve any amount within the {fmt(LIMIT)} per-transfer limit.</p>}
    <p className="err" role="alert">{err}</p>
    <div className="qa" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">{m ? 'Save changes' : 'Send invitation'}</button></div>
  </form>;
}

function App() {
  const [page, setPage] = useState('Team & Approvals'), [tab, setTab] = useState('Members');
  const [members, setMembers] = useState(MEMBERS), [invites, setInvites] = useState(INVITES), [aps, setAps] = useState(APPROVALS), [log, setLog] = useState(LOG);
  const [q, setQ] = useState(''), [modal, setModal] = useState(null), [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2400); return () => clearTimeout(id); }, [toast]);
  const say = (t, l) => { setToast(t); setLog(x => [['Seun D.', l || t, 'Just now'], ...x]); };
  const admins = members.filter(m => m.role === 'Admin' && m.status === 'active').length;
  const lastAdmin = m => m.role === 'Admin' && m.status === 'active' && admins <= 1;
  const shown = useMemo(() => members.filter(m => (m.name + m.email + m.role + m.dept).toLowerCase().includes(q.toLowerCase())), [members, q]);
  const tabs = [['Members', members.length], ['Approvals', aps.length], ['Roles & permissions'], ['Activity']];
  const key = (i, e) => { const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : null; if (n === null) return; e.preventDefault(); setTab(tabs[n][0]); document.getElementById('tab-' + n).focus(); };

  const invite = v => { setInvites(l => [{ id: 'i' + Date.now(), ...v, sent: 'Today' }, ...l]); say(`Invitation sent to ${v.email}`, `Invited ${v.email} as ${v.role}`); };
  const edit = (m, v) => { setMembers(l => l.map(x => x.id === m.id ? { ...x, role: v.role, dept: v.dept, limit: v.limit } : x)); say(`Updated ${m.name}`, v.role !== m.role ? `Changed ${m.name} from ${m.role} to ${v.role}` : `Updated ${m.name}’s details`); };
  const toggle = m => { const s = m.status === 'active' ? 'suspended' : 'active'; setMembers(l => l.map(x => x.id === m.id ? { ...x, status: s } : x)); say(s === 'suspended' ? `${m.name} suspended` : `${m.name} reactivated`, `${s === 'suspended' ? 'Suspended' : 'Reactivated'} ${m.name}`); };
  const remove = m => { setMembers(l => l.filter(x => x.id !== m.id)); say(`${m.name} removed`, `Removed ${m.name} from the team`); };
  const decide = (a, ok) => { setAps(l => l.filter(x => x.id !== a.id)); say(`${ok ? 'Approved' : 'Rejected'} ${a.t}`, `${ok ? 'Approved' : 'Rejected'} ${a.t} (${fmt(a.a)})`); };
  const why = m => m.you ? 'You can’t change your own access' : lastAdmin(m) ? 'The only active Admin can’t be suspended or removed' : '';

  return <div className="app">
    <Sidebar here="Team & Approvals" active={page} badges={{ 'Team & Approvals': aps.length }} onNavigate={setPage} />
    <main>
      {page !== 'Team & Approvals' ? <><h1>{page}</h1><p className="sub">Not designed yet – go back to Team &amp; Approvals.</p></> : <>
        <div className="top"><div><h1>Team &amp; Approvals</h1><p className="sub">Who can do what at Northwind Studio, and what is waiting for a decision.</p></div>
          <div className="qa"><button className="btn p" onClick={() => setModal({ k: 'invite' })}><Ic n="user-plus" />Invite member</button></div></div>

        <div className="tabs" role="tablist" aria-label="Team sections">{tabs.map((t, i) =>
          <button key={t[0]} id={'tab-' + i} role="tab" aria-selected={tab === t[0]} tabIndex={tab === t[0] ? 0 : -1} onClick={() => setTab(t[0])} onKeyDown={e => key(i, e)}>
            {t[0]}{t[1] > 0 && <span className={t[0] === 'Approvals' ? 'n' : 'mu'}>{t[1]}</span>}</button>)}</div>

        <div role="tabpanel" aria-labelledby={'tab-' + tabs.findIndex(t => t[0] === tab)}>
          {tab === 'Members' && <div className="col">
            <div className="card"><div className="tools"><input type="search" aria-label="Search team" placeholder="Search by name, email, role or department" value={q} onChange={e => setQ(e.target.value)} /></div>
              <div className="wrap"><table><thead><tr><th>Member</th><th>Role</th><th>Department</th><th>Can approve up to</th><th>Status</th><th className="r"><span className="sr">Actions</span></th></tr></thead><tbody>
                {shown.map(m => <tr key={m.id} className={m.status === 'suspended' ? 'off' : ''}>
                  <td><div className="ni"><span className="flag">{ini(m.name)}</span><div><b>{m.name}</b>{m.you && <span className="pill info" style={{ marginLeft: 6 }}>You</span>}<div className="mu fine">{m.email}</div></div></div></td>
                  <td>{m.role}</td><td>{m.dept}</td>
                  <td>{m.role === 'Admin' ? 'No limit' : m.limit ? fmt(m.limit) : <span className="mu">Can’t approve</span>}</td>
                  <td><span className={'pill ' + (m.status === 'active' ? 'completed' : 'pending')}>{m.status === 'active' ? 'Active' : 'Suspended'}</span></td>
                  <td><div className="acts">
                    <button className="btn sm" onClick={() => setModal({ k: 'edit', m })}>Edit</button>
                    <button className="btn sm" disabled={!!why(m)} title={why(m)} onClick={() => toggle(m)}>{m.status === 'active' ? 'Suspend' : 'Reactivate'}</button>
                    <button className="btn sm d" disabled={!!why(m)} title={why(m)} onClick={() => setModal({ k: 'remove', m })}>Remove</button></div></td></tr>)}
                {shown.length === 0 && <tr><td colSpan="6" className="mu">No one matches “{q}”. Try a different name or role.</td></tr>}</tbody></table></div></div>

            <div className="card"><h2><Ic n="envelope-simple" />Pending invitations</h2>
              {invites.length === 0 ? <p className="mu">No pending invitations. Invite a member to give them access.</p> :
                <div className="wrap"><table><thead><tr><th>Email</th><th>Role</th><th>Department</th><th>Sent</th><th className="r"><span className="sr">Actions</span></th></tr></thead><tbody>
                  {invites.map(i => <tr key={i.id}><td><b>{i.email}</b></td><td>{i.role}</td><td>{i.dept}</td><td className="mu">{i.sent}</td>
                    <td><div className="acts"><button className="btn sm" onClick={() => setToast(`Invitation resent to ${i.email}`)}>Resend</button>
                      <button className="btn sm d" onClick={() => { setInvites(l => l.filter(x => x.id !== i.id)); say(`Invitation to ${i.email} revoked`, `Revoked invitation to ${i.email}`); }}>Revoke</button></div></td></tr>)}</tbody></table></div>}</div>
          </div>}

          {tab === 'Approvals' && <div className="g g2">
            <div className="card"><h2><Ic n="seal-check" />Waiting for approval</h2>
              {aps.length === 0 && <p className="mu">All caught up. New requests that need approval show up here.</p>}
              {aps.map(a => <div className="item" key={a.id}><div className="row"><b>{a.t}</b><span>{fmt(a.a)}</span></div>
                <div className="row" style={{ marginTop: 4 }}><span className="mu fine">Requested by {a.by}. Needs {a.need}.</span>
                  {a.href ? <a className="btn sm p" href={a.href}>Review</a> : <span className="acts"><button className="btn sm" onClick={() => decide(a, false)}>Reject</button><button className="btn sm p" onClick={() => decide(a, true)}>Approve</button></span>}</div></div>)}</div>
            <div className="card"><h2><Ic n="list-checks" />Approval rules</h2>
              {RULES.map(r => <div className="rule" key={r[0]}><span>{r[0]}</span><b>{r[1]}</b></div>)}
              <p className="mu fine" style={{ margin: '10px 0 0' }}>These match the limits on Send money, Expenses and Cards.</p></div></div>}

          {tab === 'Roles & permissions' && <div className="card"><div className="wrap"><table className="matrix"><thead><tr><th>Permission</th>{ROLES.map(r => <th key={r} className="c">{r}</th>)}</tr></thead><tbody>
            {PERM.map(([p, v]) => <tr key={p}><td>{p}</td>{v.map((x, i) => <td key={i} className="c">{x === 1 ? <span className="up"><Ic n="check-circle" w="fill" /><span className="sr">Yes</span></span> : x === 0 ? <span className="mu">–<span className="sr">No</span></span> : <span className="mu fine">{x}</span>}</td>)}</tr>)}</tbody></table></div></div>}

          {tab === 'Activity' && <div className="card"><h2><Ic n="clock-counter-clockwise" />Team activity</h2><ul className="log">{log.map((l, i) => <li key={i}><b>{l[0]}</b><span>{l[1]}</span><time>{l[2]}</time></li>)}</ul></div>}
        </div>

        {modal && modal.k === 'invite' && <Modal title="Invite a team member" onClose={() => setModal(null)}>{close => <MemberForm members={members} invites={invites} onSave={invite} close={close} />}</Modal>}
        {modal && modal.k === 'edit' && <Modal title={`Edit ${modal.m.name}`} onClose={() => setModal(null)}>{close => <MemberForm m={modal.m} members={members} invites={invites} lastAdmin={lastAdmin(modal.m)} onSave={v => edit(modal.m, v)} close={close} />}</Modal>}
        {modal && modal.k === 'remove' && <Modal title={`Remove ${modal.m.name}?`} onClose={() => setModal(null)}>{close => <>
          <p style={{ margin: 0 }}>{modal.m.name} loses access right away. Their past activity stays in the log.</p>
          <div className="qa" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={close}>Cancel</button><button className="btn p" onClick={() => { remove(modal.m); close(); }}>Remove member</button></div></>}</Modal>}
        {toast && <div className="toast" role="status">{toast}</div>}
      </>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);