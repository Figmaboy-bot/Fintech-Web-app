const { useState } = React;
const { Ic, Sidebar } = Montra;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const ACCTS = [{ c: 'USD', n: 'US Operating', v: 48200, r: 1, ch: 2.4 }, { c: 'EUR', n: 'EU Collections', v: 12450.75, r: 1.08, ch: -0.8 }, { c: 'GBP', n: 'UK Payouts', v: 8320.1, r: 1.27, ch: 1.1 }, { c: 'NGN', n: 'Lagos Local', v: 6450000, r: 0.00065, ch: 0.4 }];
const RANGES = {
  '7D': { l: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], i: [8.2, 12.4, 6.1, 15.8, 9.3, 2.1, 4.5], o: [5.4, 7.9, 9.2, 6.6, 11.4, 1.2, 2.8] },
  '30D': { l: ['Oct 3', 'Oct 8', 'Oct 13', 'Oct 18', 'Oct 23', 'Oct 28'], i: [24, 31, 28, 36, 33, 41], o: [19, 22, 30, 24, 27, 29] },
  '90D': { l: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'], i: [22, 28, 25, 31, 27, 35, 30, 38, 33, 36, 40, 44], o: [18, 21, 26, 22, 25, 27, 29, 26, 31, 30, 32, 35] }
};
const TX = [['Stripe payout', 'Revenue', 4200, 'USD', 'completed', 'Today'], ['AWS', 'Infrastructure', -1284.5, 'USD', 'completed', 'Today'], ['Amara Okafor', 'Contractor', -3200, 'USD', 'pending', 'Yesterday'], ['Lagos Fresh Ltd', 'Invoice INV-1042', 850000, 'NGN', 'completed', 'Oct 30'], ['Figma', 'Software', -180, 'USD', 'completed', 'Oct 30'], ['Acme GmbH', 'Invoice INV-1039', 2400, 'EUR', 'failed', 'Oct 29']];

const goSend = () => { location.href = '../send-money/send.html' };
const goTx = () => { location.href = '../Transactions/transactions.html' };
const goFund = () => { location.href = '../AddMoney/addmoney.html' };
const goExchange = () => { location.href = '../Exchange/exchange.html' };
const goInvoice = () => { location.href = '../Invoices/invoices.html#new' };
function Chart({ d }) {
  const W = 640, H = 210, P = 28, max = Math.ceil(Math.max(...d.i, ...d.o) / 10) * 10, n = d.l.length, bw = Math.min(22, (W - P * 2) / n / 3);
  const y = v => H - P - (v / max) * (H - P * 2), x = i => P + (i + .5) * (W - P * 2) / n;
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Money in and out chart">
    {[0, .5, 1].map(t => <g key={t}><line x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} stroke="var(--bd)" /><text x={0} y={y(max * t) + 4}>{Math.round(max * t)}k</text></g>)}
    {d.l.map((l, i) => <g key={l}>
      <rect x={x(i) - bw - 1} y={y(d.i[i])} width={bw} height={H - P - y(d.i[i])} rx="3" fill="var(--ok)"><title>{l} in: ${d.i[i]}k</title></rect>
      <rect x={x(i) + 1} y={y(d.o[i])} width={bw} height={H - P - y(d.o[i])} rx="3" fill="var(--ac)"><title>{l} out: ${d.o[i]}k</title></rect>
      <text x={x(i)} y={H - 8} textAnchor="middle">{l}</text></g>)}
  </svg>
}

function App() {
  const [rg, setRg] = useState('30D'), [page, setPage] = useState('Overview'), [al, setAl] = useState([0, 1]);
  const [ap, setAp] = useState([{ id: 1, t: 'Bulk payment · 8 contractors', a: '$30,000', by: 'Finance Manager', href: '../Bulk/bulk.html' }, { id: 2, t: 'Expense · Team offsite', a: '$4,250', by: 'Tolu A.', href: '../Expenses/expenses.html#EXP-1042' }, { id: 3, t: 'Card limit raise · Marketing', a: '$5,000', by: 'Dev K.', href: '../Cards/cards.html' }]);
  const d = RANGES[rg], inn = d.i.reduce((a, b) => a + b, 0), out = d.o.reduce((a, b) => a + b, 0), total = ACCTS.reduce((a, x) => a + x.v * x.r, 0);
  const alerts = [['USD operating balance covers about 3.1 months of current spend.', 'i'], ['EU Collections is 18% below its usual weekly inflow.', 'w']];
  return <div className="app">
    <Sidebar here="Overview" active={page} badges={{ 'Team & Approvals': ap.length }} onNavigate={setPage} />
    <main>
      {page !== 'Overview' ? <><h1>{page}</h1><p className="sub">Not designed yet – start with Overview.</p></> : <>
        <div className="top"><div><h1>Good morning, Tolu</h1><p className="sub">Here is how Northwind Studio is doing today.</p></div>
          <div className="qa"><button className="btn p" onClick={goSend}><Ic n="paper-plane-tilt" />Send</button><button className="btn" onClick={goFund}><Ic n="plus-circle" />Add Money</button><button className="btn" onClick={goExchange}><Ic n="arrows-left-right" />Exchange</button><button className="btn" onClick={goInvoice}><Ic n="file-text" />Create Invoice</button></div></div>
        {alerts.map((a, i) => al.includes(i) && <div key={i} className={'alert ' + a[1]}><span className="ni"><Ic n={a[1] === 'i' ? 'lightbulb' : 'warning'} w="fill" />{a[0]}</span><button aria-label="Dismiss" onClick={() => setAl(al.filter(x => x !== i))}><Ic n="x" /></button></div>)}
        <div className="stats">
          <div className="card stat"><small>Total balance (USD equivalent)</small><b>{fmt(total)}</b><span className="d up ni" style={{ gap: 4 }}><Ic n="trend-up" s={14} />3.2% vs last month</span></div>
          <div className="card stat"><small>Money in · {rg}</small><b>{fmt(inn * 1000)}</b><span className="d up ni" style={{ gap: 4 }}><Ic n="trend-up" s={14} />12%</span></div>
          <div className="card stat"><small>Money out · {rg}</small><b>{fmt(out * 1000)}</b><span className="d dn ni" style={{ gap: 4 }}><Ic n="trend-up" s={14} />5%</span></div>
          <div className="card stat"><small>Net cash flow</small><b className={inn >= out ? 'up' : 'dn'}>{inn >= out ? '+' : '-'}{fmt(Math.abs(inn - out) * 1000)}</b><span className="d mu">Income vs expenses</span></div></div>
        <div className="g g2">
          <div className="card"><div className="row"><h2><Ic n="chart-bar" />Cash flow</h2><div className="seg">{Object.keys(RANGES).map(k => <button key={k} className={rg === k ? 'on' : ''} onClick={() => setRg(k)}>{k}</button>)}</div></div>
            <Chart d={d} /><div className="leg"><span><i style={{ background: 'var(--ok)' }} />Money in</span><span><i style={{ background: 'var(--ac)' }} />Money out</span></div></div>
          <div className="card"><div className="row" style={{ marginBottom: 6 }}><h2><Ic n="wallet" />Accounts</h2><a className="btn sm" href="../Accounts/accounts.html">Manage</a></div>
            {ACCTS.map(a => <div className="acc" key={a.c}><div className="row"><span className="flag">{a.c}</span><div><b>{fmt(a.v, a.c)}</b><div className="mu" style={{ fontSize: 12 }}>{a.n}</div></div></div><span className={'d ni ' + (a.ch >= 0 ? 'up' : 'dn')} style={{ gap: 3 }}><Ic n={a.ch >= 0 ? 'caret-up' : 'caret-down'} w="fill" s={12} />{Math.abs(a.ch)}%</span></div>)}</div></div>
        <div className="g g2">
          <div className="card"><div className="row" style={{ marginBottom: 6 }}><h2><Ic n="arrows-left-right" />Recent transactions</h2><button className="btn sm" onClick={goTx}>View all</button></div>
            <div className="wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Date</th><th className="r">Amount</th></tr></thead><tbody>
              {TX.map((t, i) => <tr key={i}><td><b>{t[0]}</b><div className="mu" style={{ fontSize: 12 }}>{t[1]}</div></td><td><span className={'pill ' + t[4]}>{t[4]}</span></td><td className="mu">{t[5]}</td><td className={'r ' + (t[2] > 0 ? 'up' : '')}>{t[2] > 0 ? '+' : '−'}{fmt(Math.abs(t[2]), t[3])}</td></tr>)}</tbody></table></div></div>
          <div className="col">
            <div className="card"><h2><Ic n="seal-check" />Pending approvals</h2>{ap.length === 0 && <p className="mu">All caught up.</p>}
              {ap.map(a => <div className="item" key={a.id}><div className="row"><b>{a.t}</b><span>{a.a}</span></div><div className="row"><span className="mu" style={{ fontSize: 12 }}>by {a.by}</span>
                {a.href ? <a className="btn sm p" href={a.href}>Review</a> : <span><button className="btn sm" onClick={() => setAp(ap.filter(x => x.id !== a.id))}>Reject</button> <button className="btn sm p" onClick={() => setAp(ap.filter(x => x.id !== a.id))}>Approve</button></span>}</div></div>)}</div>
            <div className="card"><h2><Ic n="calendar-blank" />Upcoming scheduled</h2>
              {[['Nov 5', 'Office rent', '$3,800'], ['Nov 8', 'Gusto payroll', '$18,400'], ['Nov 12', 'Notion annual', '$960']].map(s => <div className="item row" key={s[1]}><span><b>{s[1]}</b><div className="mu" style={{ fontSize: 12 }}>{s[0]}</div></span><span>{s[2]}</span></div>)}</div>
          </div></div></>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);