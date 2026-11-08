const { useState, useEffect, useRef } = React;
const { Ic, Sidebar } = Montra;

const CURS = ['USD', 'EUR', 'GBP', 'NGN'];
const BAL0 = { USD: 48230.5, EUR: 12400, GBP: 6150, NGN: 8450000 };
const USD_PER = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 0.00065 }; /* demo rates, to size the approval limit */
const LIMIT = 10000; /* USD equivalent: larger withdrawals need approval, larger card top-ups are refused */
const FEE = 0.029;
const DETAILS = {
  USD: [['Account name', 'Montra Payments for Tolu Studio'], ['Bank', 'Evolve Bank & Trust'], ['Routing number', '084106768'], ['Account number', '9600241873'], ['Method', 'ACH or domestic wire']],
  EUR: [['Account name', 'Tolu Studio Ltd'], ['Bank', 'Clear Junction Ltd'], ['IBAN', 'GB29 NWBK 6016 1331 9268 19'], ['BIC', 'CLJUGB21'], ['Method', 'SEPA transfer']],
  GBP: [['Account name', 'Tolu Studio Ltd'], ['Bank', 'Clear Junction Ltd'], ['Sort code', '04-00-04'], ['Account number', '73218845'], ['Method', 'Faster Payments']],
  NGN: [['Account name', 'Tolu Studio Ltd'], ['Bank', 'Wema Bank'], ['Account number', '8120456731'], ['Method', 'NIP transfer']]
};
const BANKS = [{ id: 'b1', name: 'GTBank', mask: '4417', cur: 'NGN' }, { id: 'b2', name: 'Chase', mask: '8821', cur: 'USD' }, { id: 'b3', name: 'Barclays', mask: '0932', cur: 'GBP' }];
const DEMO = { '4242424242424242': 'ok', '4000000000000002': 'declined', '4000000000009995': 'funds' };

const money = (n, c) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const usd = (n, c) => n * USD_PER[c];
const luhn = s => { let t = 0, d = false; for (let i = s.length - 1; i >= 0; i--) { let n = +s[i]; if (d) { n *= 2; if (n > 9) n -= 9; } t += n; d = !d; } return t % 10 === 0; };
const code = () => 'MTR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)).toUpperCase(); return { tab: h === 'WITHDRAW' ? 'withdraw' : 'add', cur: CURS.includes(h) ? h : 'USD' }; };

function Copy({ text, say }) {
  const go = () => { try { navigator.clipboard.writeText(text).then(() => say('Copied'), () => say('Could not copy')); } catch (e) { say('Could not copy'); } };
  return <button className="btn sm" onClick={go} aria-label={'Copy ' + text}><Ic n="copy" s={14} /></button>;
}

function Bank({ cur, say, onSent }) {
  const [ref] = useState(code), [amt, setAmt] = useState(''), [err, setErr] = useState('');
  const rows = [...DETAILS[cur], ['Reference', ref]];
  const sent = e => {
    e.preventDefault(); const n = Number(amt);
    if (!(n > 0)) return setErr('Enter the amount you sent.');
    setErr(''); onSent(n, ref); setAmt('');
  };
  return <>
    <div className="alert i"><Ic n="info" w="fill" />Send {cur} from your own bank using these details. Put the reference in the payment note so we can match it.</div>
    {rows.map(([k, v]) => <div className="kv" key={k}><span className="mu">{k}</span><span className="v"><span className={k === 'Reference' ? 'ref' : ''}>{v}</span>{k !== 'Method' && <Copy text={v} say={say} />}</span></div>)}
    <form onSubmit={sent} noValidate style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      <label>Amount you sent ({cur})<input inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^0-9.]/g, '')); setErr(''); }} aria-invalid={!!err} /></label>
      <p className="err" role="alert">{err}</p>
      <div><button className="btn p" type="submit">I’ve sent it</button></div>
      <p className="hint">Bank transfers are free. They usually arrive within minutes, and up to one business day for wires.</p>
    </form></>;
}

function Card({ cur, onPaid }) {
  const [num, setNum] = useState(''), [exp, setExp] = useState(''), [cvc, setCvc] = useState(''), [amt, setAmt] = useState(''), [err, setErr] = useState({}), [busy, setBusy] = useState(false), [fail, setFail] = useState('');
  const n = Number(amt) || 0, fee = Math.round(n * FEE * 100) / 100, cap = LIMIT / USD_PER[cur];
  const go = e => {
    e.preventDefault();
    const d = num.replace(/\s/g, ''), m = /^(\d\d)\/(\d\d)$/.exec(exp), x = {};
    if (!/^\d{13,19}$/.test(d) || !luhn(d)) x.num = 'Check the card number.';
    if (!m || +m[1] < 1 || +m[1] > 12 || new Date(2000 + +m[2], +m[1], 1) <= new Date()) x.exp = 'Use a future date as MM/YY.';
    if (!/^\d{3,4}$/.test(cvc)) x.cvc = '3 or 4 digits.';
    if (!(n > 0)) x.amt = 'Enter an amount.'; else if (n > cap) x.amt = `Card top-ups are limited to ${money(cap, cur)}. Use a bank transfer for more.`;
    setErr(x); setFail(''); if (Object.keys(x).length) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false); const r = DEMO[d] || 'ok';
      if (r === 'declined') return setFail('The card was declined. Try another card.');
      if (r === 'funds') return setFail('The card has insufficient funds.');
      onPaid(n, d.slice(-4)); setNum(''); setExp(''); setCvc(''); setAmt('');
    }, 900);
  };
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    {fail && <div className="alert e" role="alert"><Ic n="x-circle" w="fill" />{fail}</div>}
    <label>Card number<input inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={num} onChange={e => setNum(e.target.value.replace(/[^\d ]/g, '').slice(0, 23))} aria-invalid={!!err.num} /><span className="err">{err.num}</span></label>
    <div className="two"><label>Expiry<input placeholder="MM/YY" value={exp} onChange={e => { let v = e.target.value.replace(/[^\d]/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); setExp(v); }} aria-invalid={!!err.exp} /><span className="err">{err.exp}</span></label>
      <label>CVC<input inputMode="numeric" value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-invalid={!!err.cvc} /><span className="err">{err.cvc}</span></label></div>
    <label>Amount to add ({cur})<input inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} aria-invalid={!!err.amt} /><span className="err">{err.amt}</span></label>
    {n > 0 && <div className="fee"><div className="kv"><span className="mu">Card fee (2.9%)</span><span>{money(fee, cur)}</span></div><div className="kv t"><span>Total charged</span><span>{money(n + fee, cur)}</span></div></div>}
    <div><button className="btn p" type="submit" disabled={busy}>{busy ? 'Charging card…' : 'Add money'}</button></div>
    <p className="hint">Demo cards: 4242 4242 4242 4242 succeeds. 4000 0000 0000 0002 is declined. Use any future expiry and any CVC.</p>
  </form>;
}

function Withdraw({ cur, bal, onOut }) {
  const opts = BANKS.filter(b => b.cur === cur), [bank, setBank] = useState(''), [amt, setAmt] = useState(''), [err, setErr] = useState('');
  useEffect(() => { setBank(opts[0] ? opts[0].id : ''); setAmt(''); setErr(''); }, [cur]);
  const n = Number(amt) || 0, big = usd(n, cur) > LIMIT;
  const go = e => {
    e.preventDefault();
    if (!bank) return setErr(`Link a ${cur} bank account first.`);
    if (!(n > 0)) return setErr('Enter an amount.');
    if (n > bal) return setErr(`You only have ${money(bal, cur)} available.`);
    setErr(''); onOut(n, opts.find(b => b.id === bank), big); setAmt('');
  };
  if (!opts.length) return <div className="empty"><Ic n="bank" s={32} /><b>No {cur} bank linked</b>Link a {cur} bank account in Settings to withdraw.</div>;
  return <form onSubmit={go} noValidate style={{ display: 'grid', gap: 12 }}>
    <label>Withdraw to<select value={bank} onChange={e => setBank(e.target.value)}>{opts.map(b => <option key={b.id} value={b.id}>{b.name} •••• {b.mask}</option>)}</select></label>
    <label>Amount ({cur}) <span className="mu" style={{ fontWeight: 400 }}>· available {money(bal, cur)}</span><input inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^0-9.]/g, '')); setErr(''); }} aria-invalid={!!err} /></label>
    {big && <div className="alert"><Ic n="warning" w="fill" />Withdrawals over {money(LIMIT, 'USD')} need Finance Manager approval before they are sent.</div>}
    <p className="err" role="alert">{err}</p>
    <div><button className="btn p" type="submit">{big ? 'Request withdrawal' : 'Withdraw'}</button></div>
  </form>;
}

function App() {
  const init = fromHash();
  const [tab, setTab] = useState(init.tab), [cur, setCur] = useState(init.cur), [method, setMethod] = useState('bank'), [bals, setBals] = useState(BAL0), [acts, setActs] = useState([]), [toast, setToast] = useState('');
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { try { history.replaceState(null, '', '#' + (tab === 'withdraw' ? 'withdraw' : cur)); } catch (e) { } }, [tab, cur]);

  const log = a => { const id = Date.now() + Math.random(); setActs(l => [{ id, ...a }, ...l]); return id; };
  const upd = (id, p) => setActs(l => l.map(a => a.id === id ? { ...a, ...p } : a));
  const credit = (c, n) => setBals(b => ({ ...b, [c]: b[c] + n }));
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const sent = (n, ref) => { const id = log({ kind: 'Bank transfer in', cur, amt: n, st: 'pending', note: ref }); setToast('Thanks. We’re watching for your transfer.'); later(() => { credit(cur, n); upd(id, { st: 'completed' }); setToast(`${money(n, cur)} has arrived`); }, 4000); };
  const paid = (n, last4) => { credit(cur, n); log({ kind: 'Card top-up', cur, amt: n, st: 'completed', note: 'Card •••• ' + last4 }); setToast(`${money(n, cur)} added to your ${cur} account`); };
  const out = (n, b, big) => {
    if (big) { log({ kind: 'Withdrawal', cur, amt: -n, st: 'pending', note: 'Awaiting approval · ' + b.name }); return setToast('Sent for approval'); }
    setBals(x => ({ ...x, [cur]: x[cur] - n }));
    const id = log({ kind: 'Withdrawal', cur, amt: -n, st: 'pending', note: `${b.name} •••• ${b.mask}` }); setToast(`${money(n, cur)} is on its way to ${b.name}`);
    later(() => upd(id, { st: 'completed' }), 3500);
  };

  return <div className="app"><Sidebar here="Add money" active="Accounts" />
    <main><div className="wrapc">
      <div className="top"><div><h1>{tab === 'add' ? 'Add money' : 'Withdraw'}</h1><p className="sub">{tab === 'add' ? 'Top up an account by bank transfer or card.' : 'Move money out to a linked bank account.'}</p></div>
        <a className="btn" href="../Accounts/accounts.html"><Ic n="arrow-left" />Accounts</a></div>

      <div className="tabs" role="tablist">{[['add', 'Add money'], ['withdraw', 'Withdraw']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="cur" role="radiogroup" aria-label="Currency">{CURS.map(c => <button key={c} role="radio" aria-checked={cur === c} onClick={() => setCur(c)}><span className="flag" style={{ width: 24, height: 24, fontSize: 9 }}>{c}</span>{money(bals[c], c)}</button>)}</div>

      <div className="card">
        {tab === 'add' ? <>
          <div className="seg" role="radiogroup" aria-label="Method" style={{ marginBottom: 14 }}>{[['bank', 'Bank transfer'], ['card', 'Card']].map(([k, l]) => <button key={k} role="radio" aria-checked={method === k} className={method === k ? 'on' : ''} onClick={() => setMethod(k)}>{l}</button>)}</div>
          {method === 'bank' ? <Bank key={cur} cur={cur} say={setToast} onSent={sent} /> : <Card key={cur} cur={cur} onPaid={paid} />}
        </> : <Withdraw cur={cur} bal={bals[cur]} onOut={out} />}
      </div>

      {acts.length > 0 && <div className="card" style={{ marginTop: 14 }}><h2 style={{ marginBottom: 6 }}>This session</h2>
        {acts.map(a => <div className="pend" key={a.id}><span className="flag"><Ic n={a.amt < 0 ? 'arrow-up-right' : 'arrow-down-left'} s={16} /></span>
          <div className="g"><b>{a.kind}</b><span className="mu fine">{a.note}</span></div>
          <span className={a.amt < 0 ? '' : 'up'}><b>{a.amt < 0 ? '−' : '+'}{money(Math.abs(a.amt), a.cur)}</b></span><span className={'pill ' + a.st}>{a.st}</span></div>)}</div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div></main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
