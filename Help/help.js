const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Montra;

const KEY = 'montra-tickets';
const FAQ = [
  ['Sending money', 'How long do transfers take?', 'Local NGN transfers arrive in minutes. USD ACH takes 1 to 2 business days, SEPA and Faster Payments usually arrive the same day, and international wires take up to 3 business days.'],
  ['Sending money', 'Why does my transfer need approval?', 'Transfers over $10,000 need a Finance Manager to approve them. Anything over $50,000 in a single transfer is refused. You can follow approvals under Team & Approvals.'],
  ['Sending money', 'Can I pay many people at once?', 'Yes. Bulk payment lets you upload a CSV, paste rows or pick saved recipients, then review the whole batch before sending.'],
  ['Accounts', 'How do I add money?', 'Open Add money, pick a currency, then send a bank transfer using the details shown (include your reference) or top up by card. Card top-ups have a 2.9% fee.'],
  ['Accounts', 'How do I withdraw?', 'Open Add money, choose the Withdraw tab, pick a linked bank in the same currency and enter an amount. Withdrawals over $10,000 need approval.'],
  ['Cards', 'My card was declined. What should I do?', 'Check the card is active and not frozen, that the amount is inside its spending limit, and that the account has enough balance. You can freeze and unfreeze cards from Cards.'],
  ['Invoices', 'Can I send invoices in other currencies?', 'Yes. Pick the currency when you create the invoice. Payment lands in the matching account.'],
  ['Security', 'How do I secure my account?', 'Turn on two-factor authentication and review team permissions in Settings. Give people the lowest role they need.'],
  ['Security', 'Someone I don’t know is on my team list.', 'Remove them from Team & Approvals right away, then contact support so we can review recent activity.']
];
const SYSTEMS = [['Payments', 'Operational'], ['Cards', 'Operational'], ['Bank transfers', 'Operational'], ['Crypto', 'Operational']];
const LIMITS = [['Transfers needing approval', 'Over $10,000'], ['Per-transfer limit', '$50,000'], ['Card top-up limit', '$10,000'], ['Card top-up fee', '2.9%'], ['Bank transfers in', 'Free'], ['Local NGN transfers', 'Free']];
const TOPICS = ['Payments', 'Accounts', 'Cards', 'Invoices', 'Team', 'Security', 'Other'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nowTxt = () => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const save = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { } };

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="m-t"><div className="mb"><h2 id="m-t">{title}</h2>{children(() => ref.current.close())}</div></dialog>;
}

function Contact({ onSend, close }) {
  const [topic, setTopic] = useState('Payments'), [email, setEmail] = useState('tolu@tolustudio.com'), [subject, setSubject] = useState(''), [body, setBody] = useState(''), [err, setErr] = useState('');
  const go = e => {
    e.preventDefault();
    const m = !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : subject.trim().length < 4 ? 'Add a short subject.' : body.trim().length < 15 ? 'Tell us a bit more (at least 15 characters).' : '';
    if (m) return setErr(m);
    onSend({ topic, email: email.trim(), subject: subject.trim(), body: body.trim() }); close();
  };
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <label>Topic<select value={topic} onChange={e => setTopic(e.target.value)}>{TOPICS.map(t => <option key={t}>{t}</option>)}</select></label>
    <label>Reply to<input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} /></label>
    <label>Subject<input value={subject} onChange={e => { setSubject(e.target.value); setErr(''); }} autoFocus /></label>
    <label>Message<textarea value={body} onChange={e => { setBody(e.target.value); setErr(''); }} /></label>
    <p className="err" role="alert">{err}</p>
    <div className="row"><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">Send to support</button></div>
  </form>;
}

function Ticket({ t, onReply, onResolve, close, closeRef }) {
  const [txt, setTxt] = useState('');
  const send = e => { e.preventDefault(); if (!txt.trim()) return; onReply(t.id, txt.trim()); setTxt(''); };
  return <>
    <div className="row"><h2 id="dt"><Ic n="lifebuoy" />{t.id}</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close ticket"><Ic n="x" /></button></div>
    <div style={{ margin: '8px 0' }}><b style={{ fontSize: 17 }}>{t.subject}</b><div className="mu fine">{t.topic} · opened {t.at}</div><div style={{ marginTop: 6 }}><span className={'pill ' + (t.status === 'Resolved' ? 'completed' : t.status === 'Answered' ? 'info' : 'pending')}>{t.status}</span></div></div>
    {t.msgs.map((m, i) => <div key={i} className={'msg ' + (m.me ? 'me' : '')}><small>{m.me ? 'You' : 'Montra support'} · {m.at}</small>{m.text}</div>)}
    {t.status !== 'Resolved' ? <>
      <form onSubmit={send} style={{ display: 'grid', gap: 8, marginTop: 8 }}><label>Reply<textarea value={txt} onChange={e => setTxt(e.target.value)} /></label>
        <div className="row"><button type="button" className="btn" onClick={() => onResolve(t.id)}><Ic n="check" />Mark as resolved</button><button className="btn p" type="submit" disabled={!txt.trim()}>Send reply</button></div></form></>
      : <div className="alert ok" style={{ marginTop: 10 }}><Ic n="check-circle" w="fill" />This ticket is resolved. Open a new one if you need more help.</div>}
  </>;
}

function App() {
  const [q, setQ] = useState(''), [open, setOpen] = useState(null), [tickets, setTickets] = useState(load), [form, setForm] = useState(false), [sel, setSel] = useState(null), [toast, setToast] = useState('');
  const lastRef = useRef(null), closeRef = useRef(null), ready = useRef(false), timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (ready.current) save(tickets); else ready.current = true; }, [tickets]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);
  const close = () => { setSel(null); setTimeout(() => { if (lastRef.current && lastRef.current.focus) lastRef.current.focus(); }, 0); };
  useEffect(() => {
    if (!sel) return; if (closeRef.current) closeRef.current.focus();
    const k = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [sel]);

  const faqs = useMemo(() => { const s = q.trim().toLowerCase(); return FAQ.filter(f => !s || (f[1] + ' ' + f[2] + ' ' + f[0]).toLowerCase().includes(s)); }, [q]);
  const groups = [...new Set(faqs.map(f => f[0]))];
  const cur = tickets.find(t => t.id === sel);
  const patch = (id, fn) => setTickets(l => l.map(t => t.id === id ? fn(t) : t));

  const create = d => {
    const id = 'TKT-' + (1000 + tickets.length + 1);
    setTickets(l => [{ id, ...d, at: nowTxt(), status: 'Open', msgs: [{ me: true, at: nowTxt(), text: d.body }] }, ...l]);
    setToast(`Ticket ${id} created. We usually reply within a few hours.`);
    timers.current.push(setTimeout(() => patch(id, t => t.status === 'Resolved' ? t : ({ ...t, status: 'Answered', msgs: [...t.msgs, { me: false, at: nowTxt(), text: 'Thanks for getting in touch. We’re looking into this and will update you here. (Demo reply.)' }] })), 3500));
  };
  const reply = (id, text) => patch(id, t => ({ ...t, status: 'Open', msgs: [...t.msgs, { me: true, at: nowTxt(), text }] }));
  const resolve = id => { patch(id, t => ({ ...t, status: 'Resolved' })); setToast('Ticket marked as resolved'); };

  return <div className="app"><Sidebar here="Help & Support" />
    <main>
      <div className="top"><div><h1>Help & Support</h1><p className="sub">Find answers fast, or talk to a person.</p></div>
        <button className="btn p" onClick={e => { lastRef.current = e.currentTarget; setForm(true); }}><Ic n="chat-circle-text" />Contact support</button></div>

      <div className="g g2">
        <div className="card">
          <div className="srch" role="search"><span className="si"><Ic n="magnifying-glass" s={16} /></span><input aria-label="Search help" placeholder="Search help, e.g. approval, fees, cards" value={q} onChange={e => setQ(e.target.value)} /></div>
          {faqs.length === 0 ? <div className="empty"><Ic n="question" s={32} /><b>No answers for “{q}”</b>Try different words, or contact support.<div><button className="btn p" onClick={() => setForm(true)}>Contact support</button></div></div>
            : groups.map(g => <div key={g} style={{ marginTop: 14 }}><div className="mu fine" style={{ fontWeight: 600, letterSpacing: '.04em' }}>{g.toUpperCase()}</div>
              {faqs.filter(f => f[0] === g).map(f => { const k = f[1], on = open === k || !!q.trim() && faqs.length <= 3; return <div className="faq" key={k}>
                <button aria-expanded={on} onClick={() => setOpen(open === k ? null : k)}>{f[1]}<span className="cv"><Ic n="caret-down" s={16} /></span></button>{on && <div>{f[2]}</div>}</div>; })}</div>)}
        </div>
        <div className="col">
          <div className="card"><h2 style={{ marginBottom: 6 }}><Ic n="pulse" />System status</h2>{SYSTEMS.map(([n, s]) => <div className="sys" key={n}><span className="dot" aria-hidden="true" /><span className="g">{n}</span><span className="mu fine">{s}</span></div>)}</div>
          <div className="card"><h2 style={{ marginBottom: 6 }}><Ic n="scales" />Limits and fees</h2>{LIMITS.map(([k, v]) => <div className="sys" key={k}><span className="g">{k}</span><b>{v}</b></div>)}</div>
        </div>
      </div>

      <div className="card"><div className="row" style={{ marginBottom: 8 }}><h2>Your tickets ({tickets.length})</h2></div>
        {tickets.length === 0 ? <div className="empty"><Ic n="lifebuoy" s={32} /><b>No tickets yet</b>When you contact support, your conversation shows up here.</div>
          : <div className="wrap"><table><thead><tr><th>Ticket</th><th>Subject</th><th className="hide-s">Topic</th><th>Status</th><th className="hide-s">Opened</th></tr></thead>
            <tbody>{tickets.map(t => <tr key={t.id}><td className="nw"><b>{t.id}</b></td><td><button className="btn sm" onClick={e => { lastRef.current = e.currentTarget; setSel(t.id); }}>{t.subject}</button></td><td className="hide-s">{t.topic}</td>
              <td><span className={'pill ' + (t.status === 'Resolved' ? 'completed' : t.status === 'Answered' ? 'info' : 'pending')}>{t.status}</span></td><td className="hide-s mu nw">{t.at}</td></tr>)}</tbody></table></div>}
      </div>

      {sel && cur && <><div className="ov" onClick={close} /><div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dt"><Ticket t={cur} onReply={reply} onResolve={resolve} close={close} closeRef={closeRef} /></div></>}
      {form && <Modal title="Contact support" onClose={() => setForm(false)}>{c => <Contact onSend={create} close={c} />}</Modal>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
