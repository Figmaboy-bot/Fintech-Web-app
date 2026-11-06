const { useState, useMemo } = React;
const { Ic, Sidebar } = Montra;
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const K = n => fmt(n * 1000, 'USD').replace(/\.00$/, '');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Monthly totals in $k, Nov 2025 to Oct 2026. October matches the 30 day figures on Overview ($193k in, $151k out). Sample data. */
const IN = [112, 118, 121, 135, 128, 142, 150, 161, 158, 172, 181, 193];
const OUT = [96, 101, 108, 112, 117, 121, 126, 133, 138, 142, 149, 151];
const BAL = [41, 44, 43, 49, 47, 52, 55, 58, 57, 63, 68, 76];
const ACCTS = [{ v: 48200, r: 1 }, { v: 12450.75, r: 1.08 }, { v: 8320.1, r: 1.27 }, { v: 6450000, r: 0.00065 }]; /* same accounts as Overview */
const CASH = ACCTS.reduce((s, a) => s + a.v * a.r, 0);
/* October spend by category ($k). Shares are applied to the total for the selected range. */
const CATS = [['Payroll and contractors', 68], ['Infrastructure', 21], ['Marketing', 18], ['Software', 14], ['Office', 11], ['Other', 10], ['Travel and meals', 9]];
/* October team expense spend against the monthly budgets set on Expenses. */
const TEAMS = [['Engineering', 9800, 12000], ['Marketing', 8600, 8000], ['Operations', 3900, 5000], ['Sales', 4700, 6000]];
const RANGES = [3, 6, 12];

const label = (i, i0) => { const d = new Date(2025, 10 + i); return MON[d.getMonth()] + (d.getMonth() === 0 || i === i0 ? ' ’' + String(d.getFullYear()).slice(2) : ''); };
const sum = a => a.reduce((s, v) => s + v, 0);
const pct = (c, p) => p ? (c - p) / p * 100 : null;
/* Least-squares line through the last n months, projected ahead. A simple estimate, not a promise. */
function trend(a, n = 6, ahead = 3) {
  const y = a.slice(-n), xm = (n - 1) / 2, ym = sum(y) / n; let num = 0, den = 0;
  y.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
  const b = num / den, a0 = ym - b * xm;
  return Array.from({ length: ahead }, (_, j) => Math.max(0, Math.round(a0 + b * (n + j))));
}
const FIN = trend(IN), FOUT = trend(OUT);

function save(name, rows) {
  const b = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }), u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}

function Delta({ v, good }) {
  if (v === null) return <span className="d mu">No earlier period to compare</span>;
  const up = v >= 0, ok = good === 'up' ? up : good === 'down' ? !up : null;
  return <span className={'d ni ' + (ok === null ? 'mu' : ok ? 'up' : 'dn')} style={{ gap: 4 }}><Ic n={up ? 'trend-up' : 'trend-down'} s={14} />{Math.abs(v).toFixed(1)}% vs previous period</span>;
}

function Chart({ inn, out, labels, nF }) {
  const W = 640, H = 230, P = 32, n = inn.length, max = Math.ceil(Math.max(...inn, ...out) / 50) * 50, bw = Math.min(18, (W - P * 2) / n / 2.6);
  const y = v => H - P - (v / max) * (H - P * 2), x = i => P + (i + .5) * (W - P * 2) / n, nA = n - nF;
  const net = inn.map((v, i) => v - out[i]), pts = (a, b) => net.slice(a, b).map((v, i) => `${x(a + i)},${y(v)}`).join(' ');
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Money in, money out and net cash flow by month, with a forecast for the next months">
    {[0, .5, 1].map(t => <g key={t}><line x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} stroke="var(--bd)" /><text x={0} y={y(max * t) + 4}>{max * t}k</text></g>)}
    {nF > 0 && <g><line x1={x(nA) - (W - P * 2) / n / 2} x2={x(nA) - (W - P * 2) / n / 2} y1={P - 8} y2={H - P} stroke="var(--mu)" strokeDasharray="3 3" /><text x={x(nA) - (W - P * 2) / n / 2 + 4} y={P - 2}>Forecast</text></g>}
    {labels.map((l, i) => {
      const f = i >= nA; return <g key={i}>
        <rect x={x(i) - bw - 1} y={y(inn[i])} width={bw} height={H - P - y(inn[i])} rx="3" fill="var(--ok)" fillOpacity={f ? .3 : 1} stroke={f ? 'var(--ok)' : 'none'} strokeDasharray="3 2"><title>{l} in: {K(inn[i])}{f ? ' (forecast)' : ''}</title></rect>
        <rect x={x(i) + 1} y={y(out[i])} width={bw} height={H - P - y(out[i])} rx="3" fill="var(--ac)" fillOpacity={f ? .3 : 1} stroke={f ? 'var(--ac)' : 'none'} strokeDasharray="3 2"><title>{l} out: {K(out[i])}{f ? ' (forecast)' : ''}</title></rect>
        <text x={x(i)} y={H - 10} textAnchor="middle">{l}</text></g>;
    })}
    <polyline points={pts(0, nA)} fill="none" stroke="var(--tx)" strokeWidth="1.6" />
    {nF > 0 && <polyline points={pts(nA - 1, n)} fill="none" stroke="var(--tx)" strokeWidth="1.6" strokeDasharray="4 3" />}
    {net.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--tx)"><title>{labels[i]} net: {K(v)}</title></circle>)}
  </svg>;
}

function Line({ d, labels }) {
  const W = 320, H = 130, P = 8, lo = Math.min(...d) - 4, hi = Math.max(...d) + 4, s = hi - lo;
  const p = d.map((v, i) => [P + i * (W - P * 2) / (d.length - 1), H - 22 - (v - lo) / s * (H - 36)]);
  const line = p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' '), last = p[p.length - 1];
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cash balance from ${K(d[0])} to ${K(d[d.length - 1])} over ${d.length} months`}>
    <path d={`${line} L${last[0]} ${H - 22} L${P} ${H - 22} Z`} fill="var(--acs)" /><path d={line} fill="none" stroke="var(--ac)" strokeWidth="2.5" strokeLinejoin="round" />
    <circle cx={last[0]} cy={last[1]} r="4" fill="var(--ac)" /><text x={P} y={H - 5}>{labels[0]}</text><text x={W - P} y={H - 5} textAnchor="end">{labels[labels.length - 1]}</text>
  </svg>;
}

function App() {
  const [page, setPage] = useState('Analytics'), [R, setR] = useState(6), [fc, setFc] = useState(true), [al, setAl] = useState([0, 1]), [toast, setToast] = useState('');
  const d = useMemo(() => {
    const nF = fc ? 3 : 0, i0 = 12 - R, labels = Array.from({ length: R + nF }, (_, i) => label(i0 + i, i0));
    const inn = [...IN.slice(-R), ...(fc ? FIN : [])], out = [...OUT.slice(-R), ...(fc ? FOUT : [])];
    const tin = sum(IN.slice(-R)), tout = sum(OUT.slice(-R)), full = IN.length >= R * 2;
    return { nF, labels, inn, out, tin, tout, pin: full ? sum(IN.slice(-R * 2, -R)) : 0, pout: full ? sum(OUT.slice(-R * 2, -R)) : 0, full };
  }, [R, fc]);
  const net = d.tin - d.tout, margin = net / d.tin * 100, octOut = sum(CATS.map(c => c[1]));
  const inG = pct(IN[11], IN[6]), outG = pct(OUT[11], OUT[6]), mk = TEAMS.find(t => t[1] > t[2]);
  const alerts = [
    [`Over the last 6 months money in grew ${inG.toFixed(0)}% and money out grew ${outG.toFixed(0)}%, so ${inG >= outG ? 'your monthly surplus is widening.' : 'your monthly surplus is shrinking.'}`, inG >= outG ? 'i' : 'w'],
    mk && [`${mk[0]} spent ${fmt(mk[1] - mk[2])} over its October budget of ${fmt(mk[2])}.`, 'w']
  ].filter(Boolean);
  const say = m => { setToast(m); setTimeout(() => setToast(''), 2400); };
  const cashRows = () => [['Month', 'Money in (USD)', 'Money out (USD)', 'Net (USD)', 'Type'], ...d.labels.map((l, i) => [l.replace('’', "'"), d.inn[i] * 1000, d.out[i] * 1000, (d.inn[i] - d.out[i]) * 1000, i >= R ? 'Forecast' : 'Actual'])];
  const catRows = () => [['Category', 'Spend (USD)', 'Share'], ...CATS.map(c => [c[0], Math.round(c[1] / octOut * d.tout * 1000), (c[1] / octOut * 100).toFixed(1) + '%'])];
  const teamRows = () => [['Team', 'October spend (USD)', 'Monthly budget (USD)', 'Used'], ...TEAMS.map(t => [t[0], t[1], t[2], Math.round(t[1] / t[2] * 100) + '%'])];
  const dl = (n, rows) => { save(n, rows); say(`Downloaded ${n}`); };
  const range = R + ' months';

  return <div className="app">
    <Sidebar here="Analytics" active={page} badges={{ 'Team & Approvals': 3 }} onNavigate={setPage} />
    <main>
      {page !== 'Analytics' ? <><h1>{page}</h1><p className="sub">Not designed yet – go back to Analytics.</p></> : <>
        <div className="top"><div><h1>Analytics</h1><p className="sub">Cash flow, spending and forecast for Northwind Studio.</p></div>
          <div className="qa"><div className="seg" role="group" aria-label="Time range">{RANGES.map(k => <button key={k} className={R === k ? 'on' : ''} aria-pressed={R === k} onClick={() => setR(k)}>{k}M</button>)}</div>
            <button className="btn p" onClick={() => dl(`cash-flow-${R}m.csv`, cashRows())}><Ic n="download-simple" />Export</button></div></div>

        {alerts.map((a, i) => al.includes(i) && <div key={i} className={'alert ' + a[1]}><span className="ni"><Ic n={a[1] === 'i' ? 'lightbulb' : 'warning'} w="fill" />{a[0]}</span><button aria-label="Dismiss" onClick={() => setAl(al.filter(x => x !== i))}><Ic n="x" /></button></div>)}

        <div className="stats">
          <div className="card stat"><small>Money in · {range}</small><b>{K(d.tin)}</b><Delta v={d.full ? pct(d.tin, d.pin) : null} good="up" /></div>
          <div className="card stat"><small>Money out · {range}</small><b>{K(d.tout)}</b><Delta v={d.full ? pct(d.tout, d.pout) : null} /></div>
          <div className="card stat"><small>Net cash flow</small><b className={net >= 0 ? 'up' : 'dn'}>{net >= 0 ? '+' : '−'}{K(Math.abs(net))}</b><span className="d mu">{margin.toFixed(0)}% of money in</span></div>
          <div className="card stat"><small>Cash balance (USD equivalent)</small><b>{fmt(CASH)}</b><span className="d mu">Across all four accounts</span></div></div>

        <div className="g g2">
          <div className="card"><div className="row"><h2><Ic n="chart-bar" />Cash flow</h2>
            <label className="chk"><input type="checkbox" checked={fc} onChange={e => setFc(e.target.checked)} />Show 3 month forecast</label></div>
            <Chart inn={d.inn} out={d.out} labels={d.labels} nF={d.nF} />
            <div className="leg"><span><i style={{ background: 'var(--ok)' }} />Money in</span><span><i style={{ background: 'var(--ac)' }} />Money out</span><span><i style={{ background: 'var(--tx)' }} />Net</span>{fc && <span><i className="fc" />Forecast</span>}</div>
            {fc && <p className="mu fine" style={{ margin: '8px 0 0' }}>The forecast extends the trend of the last 6 months. It is an estimate, not a promise.</p>}
            <details><summary>View as a table</summary><div className="wrap"><table><thead><tr><th>Month</th><th className="r">In</th><th className="r">Out</th><th className="r">Net</th><th>Type</th></tr></thead><tbody>
              {d.labels.map((l, i) => <tr key={i}><td>{l}</td><td className="r">{K(d.inn[i])}</td><td className="r">{K(d.out[i])}</td><td className={'r ' + (d.inn[i] >= d.out[i] ? 'up' : 'dn')}>{K(d.inn[i] - d.out[i])}</td><td className="mu">{i >= R ? 'Forecast' : 'Actual'}</td></tr>)}</tbody></table></div></details></div>

          <div className="card"><h2><Ic n="chart-pie-slice" />Where the money goes</h2><p className="mu fine" style={{ margin: '2px 0 0' }}>Money out by category · {range}</p>
            <div className="bars">{CATS.map(c => { const sh = c[1] / octOut; return <div className="bar" key={c[0]}><div className="row"><span>{c[0]}</span><span><b>{K(sh * d.tout)}</b> <span className="mu fine">{(sh * 100).toFixed(0)}%</span></span></div><div className="track" role="img" aria-label={`${c[0]}: ${(sh * 100).toFixed(0)}% of money out`}><i style={{ width: sh * 100 + '%' }} /></div></div>; })}</div></div></div>

        <div className="g g11">
          <div className="card"><h2><Ic n="trend-up" />Cash balance</h2><p className="mu fine" style={{ margin: '2px 0 6px' }}>Month end, USD equivalent · {range}</p>
            <Line d={BAL.slice(-R)} labels={d.labels.slice(0, R)} /></div>
          <div className="card"><h2><Ic n="users-three" />Team budgets</h2><p className="mu fine" style={{ margin: '2px 0 0' }}>October expense spend against monthly budget</p>
            <div className="bars">{TEAMS.map(t => {
              const u = t[1] / t[2], over = u > 1; return <div className="bar" key={t[0]}><div className="row"><span>{t[0]}</span><span>{fmt(t[1])} of {fmt(t[2])} {over ? <span className="pill failed">{fmt(t[1] - t[2])} over</span> : u > .85 ? <span className="pill pending">Close</span> : <span className="pill completed">On track</span>}</span></div>
                <div className="track" role="img" aria-label={`${t[0]} used ${Math.round(u * 100)}% of its budget`}><i className={over ? 'e' : u > .85 ? 'w' : ''} style={{ width: Math.min(100, u * 100) + '%' }} /></div></div>;
            })}</div></div></div>

        <div className="card"><h2><Ic n="file-text" />Reports</h2>
          {[['Cash flow summary', `Money in, out and net by month · ${range}${fc ? ' with forecast' : ''}`, `cash-flow-${R}m.csv`, cashRows], ['Spending by category', `Money out by category · ${range}`, `spending-by-category-${R}m.csv`, catRows], ['Team budgets', 'October spend against budget by team', 'team-budgets-oct.csv', teamRows]].map(r =>
            <div className="rep" key={r[0]}><div><b>{r[0]}</b><div className="mu fine">{r[1]}</div></div><button className="btn sm" onClick={() => dl(r[2], r[3]())}><Ic n="download-simple" s={14} />CSV</button></div>)}</div>
        {toast && <div className="toast" role="status">{toast}</div>}
      </>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);