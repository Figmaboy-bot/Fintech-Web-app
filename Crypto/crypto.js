const { useState, useEffect, useMemo, useRef } = React;
const { Ic, Sidebar } = Montra;

/* DEMO DATA ONLY: prices, balances, addresses and hashes below are made up. */
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'NGN' ? 0 : 2 }).format(n);
const TODAY = new Date(2026, 10, 3);
const FIAT = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 0.00065 };
const ASSETS = {
  USDC: { name: 'USD Coin', type: 'stable', peg: 'USD', price: 1.0001, chg: 0.01, dec: 2, nets: ['Ethereum', 'Base', 'Solana', 'Polygon'] },
  USDT: { name: 'Tether', type: 'stable', peg: 'USD', price: 0.9998, chg: -0.02, dec: 2, nets: ['Ethereum', 'Tron', 'Solana'] },
  EURC: { name: 'Euro Coin', type: 'stable', peg: 'EUR', price: 1.0812, chg: 0.05, dec: 2, nets: ['Ethereum', 'Base', 'Solana'] },
  cNGN: { name: 'Naira stablecoin', type: 'stable', peg: 'NGN', price: 0.00065, chg: 0.1, dec: 2, nets: ['Ethereum', 'Base'] },
  BTC: { name: 'Bitcoin', type: 'crypto', price: 104200, chg: 1.8, dec: 6, nets: ['Bitcoin'] },
  ETH: { name: 'Ethereum', type: 'crypto', price: 3480, chg: -0.9, dec: 4, nets: ['Ethereum'] },
  SOL: { name: 'Solana', type: 'crypto', price: 178, chg: 3.2, dec: 3, nets: ['Solana'] }
};
const EVM = /^0x[a-fA-F0-9]{40}$/, B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const NETS = {
  Ethereum: { fee: 4.2, time: 'about 2 minutes', need: 12, re: EVM, ex: '0x…' },
  Base: { fee: 0.05, time: 'about 10 seconds', need: 12, re: EVM, ex: '0x…' },
  Polygon: { fee: 0.03, time: 'about 1 minute', need: 12, re: EVM, ex: '0x…' },
  Solana: { fee: 0.02, time: 'about 15 seconds', need: 32, re: B58, ex: 'base58 address' },
  Tron: { fee: 1, time: 'about 1 minute', need: 19, re: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, ex: 'starts with T' },
  Bitcoin: { fee: 3.5, time: 'about 30 minutes', need: 3, re: /^(bc1[a-z0-9]{25,60}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/, ex: 'starts with bc1, 1 or 3' }
};
const DEPOSIT = { EVM: '0x4b2D9a07C1e83F56a0d94E7c3B18f2A65D0e91c7', Solana: 'Hq3vN8bR2mWx5TfYc9LdKe4ZsJp7UaGo1PiXnV6rBtCw', Tron: 'TQn9Yb4rXc2MwVe7LsKd5HfJp8UaZgR3Nt', Bitcoin: 'bc1qw5n8ke3x7rd2yv9mt4uj6hpz0sc8lag3f2q9xe' };
const depositFor = n => n === 'Solana' ? DEPOSIT.Solana : n === 'Tron' ? DEPOSIT.Tron : n === 'Bitcoin' ? DEPOSIT.Bitcoin : DEPOSIT.EVM;
const APPROVAL = 10000, MIN_CONVERT = 10;
const TXST = { completed: ['Completed', 'completed'], confirming: ['Confirming', 'pending'], approval: ['Needs approval', 'info'], failed: ['Failed', 'failed'], cancelled: ['Cancelled', 'failed'] };

const price = a => ASSETS[a] ? ASSETS[a].price : FIAT[a];
const isFiat = a => !!FIAT[a] && !ASSETS[a];
const qty = (n, a) => isFiat(a) ? fmt(n, a) : n.toLocaleString('en-US', { minimumFractionDigits: ASSETS[a].type === 'stable' ? 2 : 0, maximumFractionDigits: ASSETS[a].dec }) + ' ' + a;
const short = s => s.length > 16 ? s.slice(0, 8) + '…' + s.slice(-6) : s;
const dshort = o => { const d = new Date(TODAY); d.setDate(d.getDate() - o); return o <= 0 ? 'Today' : o === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
const dfull = o => { const d = new Date(TODAY); d.setDate(d.getDate() - o); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) };
const rh = (net, n) => { const c = net === 'Solana' ? '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' : '0123456789abcdef'; let s = net === 'Solana' ? '' : '0x'; for (let i = 0; i < n; i++)s += c[Math.floor(Math.random() * c.length)]; return s };
const feeRate = (a, b) => (ASSETS[a] && ASSETS[a].type === 'crypto') || (ASSETS[b] && ASSETS[b].type === 'crypto') ? 0.005 : (ASSETS[a] && ASSETS[b]) ? 0.001 : 0.002;

/* ---- sample data ---- */
const BAL0 = { USDC: 18450.32, USDT: 6200, EURC: 2400, cNGN: 3500000, BTC: 0.1842, ETH: 2.35, SOL: 42, USD: 48200, EUR: 12450.75, GBP: 8320.1, NGN: 6450000 };
const T = (id, kind, asset, amt, net, status, off, party, x) => ({ id, kind, asset, amt, net, status, off, party, conf: status === 'completed' ? NETS[net || 'Ethereum'].need : 0, need: net ? NETS[net].need : 0, hash: net ? rh(net, net === 'Solana' ? 64 : 64) : '', fee: 0, ...x });
const seedTx = () => [
  T('t4', 'receive', 'ETH', 0.5, 'Ethereum', 'confirming', 0, 'External wallet', { conf: 7, credit: true }),
  T('t5', 'send', 'USDC', 12000, 'Ethereum', 'approval', 0, 'Acme GmbH treasury', { fee: 4.2, addr: '0x9C41f8a2D07b3E65c1A4d8F0e7B29a3c5D61e0F8' }),
  T('t1', 'receive', 'USDC', 4800, 'Base', 'completed', 1, 'Pixel Forge LLC'),
  T('t2', 'send', 'USDT', 1500, 'Tron', 'completed', 2, 'Amara Okafor', { fee: 1, addr: 'TXk4Rb7NqW2yLd9PcVe5HsJm8UaZgF3Qv1' }),
  T('t3', 'convert', 'USD', 5000, null, 'completed', 3, 'USD to USDC', { to: 'USDC', toAmt: 4985, feeUsd: 10 }),
  T('t6', 'convert', 'USDC', 2000, null, 'completed', 5, 'USDC to EURC', { to: 'EURC', toAmt: 1848.1, feeUsd: 2 }),
  T('t7', 'receive', 'BTC', 0.05, 'Bitcoin', 'completed', 8, 'External wallet'),
  T('t8', 'send', 'SOL', 10, 'Solana', 'failed', 10, 'Hq3v…BtCw', { fee: 0.02, why: 'The network was congested and the transfer timed out. No funds left your wallet.' }),
  T('t9', 'convert', 'EUR', 3000, null, 'completed', 14, 'EUR to USDC', { to: 'USDC', toAmt: 3234, feeUsd: 6.48 })];
const BOOK0 = [
  { id: 'b1', name: 'Pixel Forge treasury', net: 'Base', addr: '0x2eA5c93B07d41F8a6C0b9E3d71A58f2C4e60B9d3' },
  { id: 'b2', name: 'Amara Okafor', net: 'Tron', addr: 'TXk4Rb7NqW2yLd9PcVe5HsJm8UaZgF3Qv1' },
  { id: 'b3', name: 'Acme GmbH treasury', net: 'Ethereum', addr: '0x9C41f8a2D07b3E65c1A4d8F0e7B29a3c5D61e0F8' }];

/* ---- small parts ---- */
const Icon = ({ a }) => <span className={'ico ' + (ASSETS[a] && ASSETS[a].type === 'crypto' ? 'c' : '')} aria-hidden="true">{a.slice(0, 4)}</span>;
const Chg = ({ v }) => <span className={v >= 0 ? 'up' : 'dn'}>{v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(2)}%</span>;
const Err = ({ t }) => t ? <div className="err" role="alert"><Ic n="warning-circle" w="fill" s={15} />{t}</div> : null;
function Qr({ seed }) { /* decorative placeholder, not a scannable code */
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 25, cells = [], finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const ring = (x, y, ox, oy) => { const dx = x - ox, dy = y - oy; return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) };
  for (let y = 0; y < n; y++)for (let x = 0; x < n; x++) {
    let on; if (finder(x, y)) on = x < 7 && y < 7 ? ring(x, y, 0, 0) : x >= n - 7 && y < 7 ? ring(x, y, n - 7, 0) : ring(x, y, 0, n - 7);
    else { h = (h * 1664525 + 1013904223) >>> 0; on = (h >>> 16) % 2 === 0 }
    if (on) cells.push(<rect key={x + '-' + y} x={x} y={y} width="1" height="1" />)
  }
  return <svg className="qr" viewBox={`-1 -1 ${n + 2} ${n + 2}`} role="img" aria-label="Decorative QR placeholder, not scannable" shapeRendering="crispEdges" fill="#14171f">{cells}</svg>;
}

/* ---- receive ---- */
function Receive({ init, close, closeRef, say }) {
  const [a, setA] = useState(init || 'USDC'), [net, setNet] = useState(ASSETS[init || 'USDC'].nets[0]);
  const pick = v => { setA(v); setNet(ASSETS[v].nets[0]) };
  const addr = depositFor(net);
  const copy = () => { try { navigator.clipboard.writeText(addr).then(() => say('Address copied'), () => say('Could not copy')) } catch (e) { say('Could not copy') } };
  return <>
    <div className="row"><h2 id="dt"><Ic n="arrow-down-left" />Receive crypto</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div className="two" style={{ marginTop: 16 }}><div className="field"><label className="f" htmlFor="ra">Asset</label><select id="ra" value={a} onChange={e => pick(e.target.value)}>{Object.keys(ASSETS).map(k => <option key={k} value={k}>{k} · {ASSETS[k].name}</option>)}</select></div>
      <div className="field"><label className="f" htmlFor="rn">Network</label><select id="rn" value={net} onChange={e => setNet(e.target.value)}>{ASSETS[a].nets.map(n => <option key={n}>{n}</option>)}</select></div></div>
    <Qr seed={addr + a} /><div className="hint" style={{ textAlign: 'center' }}>Demo placeholder. Not a real, scannable code.</div>
    <div className="addr"><span className="mono">{addr}</span><button className="btn sm" onClick={copy}><Ic n="copy" s={14} />Copy</button></div>
    <div className="alert"><Ic n="warning" w="fill" /><div>Only send <b>{a}</b> on the <b>{net}</b> network to this address. Other assets or networks can be lost permanently, and we cannot recover them.</div></div>
    <div className="kv" style={{ marginTop: 12 }}><span className="mu">Arrives after</span><span>{NETS[net].need} confirmations ({NETS[net].time})</span></div>
    <div className="kv"><span className="mu">Deposit fee</span><span>Free</span></div>
  </>;
}

/* ---- send ---- */
function Send({ init, initNet, initAddr, bal, book, onSend, close, closeRef }) {
  const owned = Object.keys(ASSETS).filter(k => bal[k] > 0), a0 = init && bal[init] > 0 ? init : owned[0];
  const [a, setA] = useState(a0), [net, setNet] = useState(ASSETS[a0].nets.includes(initNet) ? initNet : ASSETS[a0].nets[0]);
  const alive = useRef(true); useEffect(() => () => { alive.current = false }, []);
  const [addr, setAddr] = useState(ASSETS[a0].nets.includes(initNet) && initAddr ? initAddr : ''), [amt, setAmt] = useState(''), [ack, setAck] = useState(false), [step, setStep] = useState(0), [touched, setTouched] = useState(false), [busy, setBusy] = useState(false);
  const A = ASSETS[a], N = NETS[net], n = parseFloat(amt) || 0, feeA = N.fee / A.price, usd = n * A.price, total = n + feeA;
  const saved = book.find(b => b.addr === addr.trim() && b.net === net), isNew = addr.trim() && !saved, needs = usd > APPROVAL;
  const errs = {
    addr: !addr.trim() ? 'Enter the recipient address.' : !N.re.test(addr.trim()) ? 'That is not a valid ' + net + ' address (' + N.ex + ').' : '',
    amt: n <= 0 ? 'Enter an amount.' : total > bal[a] ? 'Not enough ' + a + '. Available: ' + qty(bal[a], a) + ', and the network fee is ' + qty(feeA, a) + '.' : '',
    ack: isNew && !ack ? 'Confirm you checked the address and network.' : ''
  };
  const bad = Object.keys(errs).find(k => errs[k]);
  const pickA = v => { setA(v); setNet(ASSETS[v].nets[0]); setAddr(''); setAmt('') };
  const max = () => setAmt(String(Math.max(0, Math.floor((bal[a] - feeA) * 10 ** A.dec) / 10 ** A.dec)));
  const review = e => { e.preventDefault(); setTouched(true); if (!bad) setStep(1) };
  const go = () => { setBusy(true); setTimeout(() => { if (alive.current) onSend({ asset: a, amt: n, net, addr: addr.trim(), party: saved ? saved.name : short(addr.trim()), fee: feeA, usd, needs }) }, 700) };
  if (step === 1) return <>
    <div className="row"><h2 id="dt"><Ic n="seal-check" />Review transfer</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div style={{ marginTop: 10 }}>
      <div className="kv"><span className="mu">You send</span><span><b>{qty(n, a)}</b><div className="mu sm2">≈ {fmt(usd)}</div></span></div>
      <div className="kv"><span className="mu">Network</span><span>{net}</span></div>
      <div className="kv"><span className="mu">To</span><span>{saved && <b>{saved.name}<br /></b>}<span className="mono">{addr.trim()}</span></span></div>
      <div className="kv"><span className="mu">Network fee</span><span>{qty(feeA, a)} <span className="mu">(≈ {fmt(N.fee)})</span></span></div>
      <div className="kv t"><span>Total from wallet</span><span>{qty(total, a)}</span></div>
      <div className="kv"><span className="mu">Arrives</span><span>{needs ? 'After approval, then ' : ''}{N.time}</span></div></div>
    <div className="alert"><Ic n="warning" w="fill" />Blockchain transfers cannot be reversed. Check the address and network once more.</div>
    {needs && <div className="alert i"><Ic n="seal-check" w="fill" />Transfers over {fmt(APPROVAL)} need approval from a Finance Manager. Funds are held until then.</div>}
    <div className="row" style={{ marginTop: 18 }}><button className="btn" onClick={() => setStep(0)} disabled={busy}><Ic n="arrow-left" s={15} />Back</button><button className="btn p" onClick={go} disabled={busy}>{busy ? 'Sending…' : needs ? 'Submit for approval' : 'Confirm and send'}</button></div>
  </>;
  return <form onSubmit={review} noValidate>
    <div className="row"><h2 id="dt"><Ic n="arrow-up-right" />Send crypto</h2><button type="button" ref={closeRef} className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div className="two" style={{ marginTop: 16 }}><div className="field"><label className="f" htmlFor="sa">Asset</label><select id="sa" value={a} onChange={e => pickA(e.target.value)}>{owned.map(k => <option key={k} value={k}>{k} · {qty(bal[k], k)}</option>)}</select></div>
      <div className="field"><label className="f" htmlFor="sn">Network</label><select id="sn" value={net} onChange={e => { setNet(e.target.value); setAddr('') }}>{A.nets.map(x => <option key={x}>{x}</option>)}</select></div></div>
    <div className="field"><label className="f" htmlFor="sb">Saved address</label><select id="sb" value={saved ? saved.id : ''} onChange={e => { const b = book.find(x => x.id === e.target.value); setAddr(b ? b.addr : '') }}>
      <option value="">Choose, or paste an address below</option>{book.filter(b => b.net === net).map(b => <option key={b.id} value={b.id}>{b.name} · {short(b.addr)}</option>)}</select></div>
    <div className="field"><label className="f" htmlFor="sd">Recipient address ({net})</label><input id="sd" value={addr} onChange={e => { setAddr(e.target.value); setAck(false) }} autoComplete="off" spellCheck="false" aria-invalid={touched && !!errs.addr} />{touched && <Err t={errs.addr} />}</div>
    <div className="field"><label className="f" htmlFor="sm">Amount</label><div className="amtw"><input id="sm" type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={amt} onChange={e => setAmt(e.target.value)} aria-invalid={touched && !!errs.amt} /><span>{a}</span></div>
      {touched && <Err t={errs.amt} />}<div className="row" style={{ marginTop: 6 }}><span className="hint" style={{ margin: 0 }}>Available {qty(bal[a], a)}{n > 0 && ' · ≈ ' + fmt(usd)}</span><button type="button" className="btn sm" onClick={max}>Use max</button></div></div>
    {isNew && N.re.test(addr.trim()) && <div className="alert"><Ic n="warning" w="fill" /><div>First time sending to this address. For a large amount, send a small test transfer first.</div></div>}
    {isNew && N.re.test(addr.trim()) && <label className="chk"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /><span>I checked that this is the right address and the right network.</span></label>}
    {touched && <Err t={errs.ack} />}
    <div className="kv" style={{ marginTop: 10 }}><span className="mu">Network fee</span><span>≈ {fmt(N.fee)} · {N.time}</span></div>
    {needs && <div className="alert i"><Ic n="seal-check" w="fill" />Over {fmt(APPROVAL)}: this will need Finance Manager approval.</div>}
    <div className="row" style={{ marginTop: 18 }}><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">Review</button></div>
  </form>;
}

/* ---- convert ---- */
const QUOTE = 30;
function Convert({ init, bal, onConvert, close, closeRef }) {
  const all = [...Object.keys(FIAT), ...Object.keys(ASSETS)];
  const [from, setFrom] = useState(init || 'USD'), [to, setTo] = useState(init === 'USDC' ? 'USD' : 'USDC'), [amt, setAmt] = useState(''), [touched, setTouched] = useState(false), [left, setLeft] = useState(QUOTE);
  useEffect(() => { setLeft(QUOTE) }, [from, to]);
  useEffect(() => { if (!(parseFloat(amt) > 0)) return; const t = setInterval(() => setLeft(l => l > 0 ? l - 1 : 0), 1000); return () => clearInterval(t) }, [amt]);
  const n = parseFloat(amt) || 0, rate = price(from) / price(to), rr = feeRate(from, to), fee = n * rr, out = (n - fee) * rate, usd = n * price(from);
  const err = from === to ? 'Choose two different assets.' : n <= 0 ? 'Enter an amount.' : n > bal[from] ? 'Not enough ' + from + '. Available: ' + qty(bal[from], from) + '.' : usd < MIN_CONVERT ? 'The minimum conversion is ' + fmt(MIN_CONVERT) + '.' : '';
  const flip = () => { setFrom(to); setTo(from) };
  const submit = e => { e.preventDefault(); setTouched(true); if (err) return; if (left === 0) { setLeft(QUOTE); return } onConvert({ from, to, amt: n, out, fee, feeUsd: fee * price(from) }) };
  const rate1 = n => n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : n.toPrecision(3);
  const opts = <>{<optgroup label="Bank accounts">{Object.keys(FIAT).map(k => <option key={k} value={k}>{k}</option>)}</optgroup>}<optgroup label="Stablecoins">{Object.keys(ASSETS).filter(k => ASSETS[k].type === 'stable').map(k => <option key={k}>{k}</option>)}</optgroup><optgroup label="Crypto">{Object.keys(ASSETS).filter(k => ASSETS[k].type === 'crypto').map(k => <option key={k}>{k}</option>)}</optgroup></>;
  return <form onSubmit={submit} noValidate>
    <div className="row"><h2 id="dt"><Ic n="arrows-left-right" />Convert</h2><button type="button" ref={closeRef} className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div className="field" style={{ marginTop: 16 }}><label className="f" htmlFor="cf">From</label>
      <div className="amtw"><input id="cf" type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={amt} onChange={e => setAmt(e.target.value)} aria-invalid={touched && !!err} /><select aria-label="From asset" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto', border: 0, background: 'none' }}>{opts}</select></div>
      <div className="hint">Available {qty(bal[from], from)}</div></div>
    <div style={{ textAlign: 'center', margin: '-6px 0 6px' }}><button type="button" className="btn sm" onClick={flip} aria-label="Swap from and to"><Ic n="arrows-down-up" s={14} /></button></div>
    <div className="field"><label className="f" htmlFor="ct">To</label><select id="ct" value={to} onChange={e => setTo(e.target.value)}>{opts}</select></div>
    {touched && <Err t={err} />}
    {n > 0 && from !== to && <div style={{ marginTop: 10 }}>
      <div className="kv"><span className="mu">You receive</span><span><b>{qty(out, to)}</b></span></div>
      <div className="kv"><span className="mu">Rate</span><span>1 {from} = {rate1(rate)} {to}</span></div>
      <div className="kv"><span className="mu">Fee ({(rr * 100).toFixed(rr < 0.002 ? 2 : 1)}%)</span><span>{qty(fee, from)} <span className="mu">(≈ {fmt(fee * price(from))})</span></span></div>
      <div className={'hint'} aria-live="polite">{left > 0 ? 'Rate locked for ' + left + ' seconds.' : 'This rate expired. Refresh to get the latest one.'}</div></div>}
    {ASSETS[from] && ASSETS[from].type === 'crypto' || ASSETS[to] && ASSETS[to].type === 'crypto' ? <div className="alert"><Ic n="warning" w="fill" />Crypto prices move quickly. Once confirmed, a conversion cannot be undone.</div> : null}
    <div className="row" style={{ marginTop: 18 }}><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn p">{n > 0 && left === 0 ? 'Refresh rate' : 'Convert'}</button></div>
  </form>;
}

/* ---- transaction details ---- */
function TxDetail({ t, cancel, close, closeRef, say }) {
  const [conf, setConf] = useState(false);
  const kind = t.kind === 'receive' ? 'Received' : t.kind === 'send' ? 'Sent' : 'Converted';
  const copy = () => { try { navigator.clipboard.writeText(t.hash).then(() => say('Hash copied'), () => say('Could not copy')) } catch (e) { say('Could not copy') } };
  const pct = t.need ? Math.round(t.conf / t.need * 100) : 100;
  return <>
    <div className="row"><h2 id="dt"><Ic n="receipt" />Transaction</h2><button ref={closeRef} className="btn sm" onClick={close} aria-label="Close"><Ic n="x" /></button></div>
    <div style={{ padding: '14px 0 6px' }}><div className="mu">{kind}</div><div style={{ fontSize: 26, fontWeight: 700, margin: '2px 0 8px' }}>{qty(t.amt, t.asset)}</div><span className={'pill ' + TXST[t.status][1]}>{TXST[t.status][0]}</span></div>
    {t.status === 'failed' && <div className="alert e" role="alert"><Ic n="warning" w="fill" />{t.why}</div>}
    {t.status === 'approval' && <div className="alert i"><Ic n="seal-check" w="fill" />Waiting for a Finance Manager to approve. Funds are on hold and nothing has been sent.</div>}
    {t.status === 'cancelled' && <div className="alert e"><Ic n="prohibit" w="fill" />This request was cancelled and the funds were returned to your wallet.</div>}
    {t.status === 'confirming' && <><div className="row sm2" style={{ marginTop: 12 }}><span>Confirmations</span><span className="mu">{t.conf} of {t.need}</span></div><div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Confirmations"><i style={{ width: pct + '%' }} /></div></>}
    <div className="sec">DETAILS</div>
    <div className="kv"><span className="mu">Date</span><span>{dfull(t.off)}</span></div>
    {t.kind === 'convert' ? <><div className="kv"><span className="mu">Converted to</span><span>{qty(t.toAmt, t.to)}</span></div><div className="kv"><span className="mu">Fee</span><span>≈ {fmt(t.feeUsd)}</span></div></>
      : <><div className="kv"><span className="mu">{t.kind === 'send' ? 'To' : 'From'}</span><span>{t.party}</span></div>
        <div className="kv"><span className="mu">Network</span><span>{t.net}</span></div>
        {t.addr && <div className="kv"><span className="mu">Address</span><span className="mono">{t.addr}</span></div>}
        {t.fee > 0 && <div className="kv"><span className="mu">Network fee</span><span>{qty(t.fee, t.asset)}</span></div>}
        <div className="kv"><span className="mu">Hash</span><span><span className="mono">{short(t.hash)}</span> <button className="btn sm" onClick={copy}><Ic n="copy" s={14} /></button></span></div></>}
    <div className="kv"><span className="mu">Value</span><span>≈ {fmt(t.amt * price(t.asset))}</span></div>
    {t.status === 'approval' && <div style={{ marginTop: 16 }}>{!conf ? <button className="btn danger" onClick={() => setConf(true)}>Cancel request</button>
      : <div className="alert e" style={{ display: 'block' }}><b>Cancel this transfer?</b><div style={{ margin: '4px 0 10px' }}>The held funds go back to your wallet.</div><div className="acts"><button className="btn" onClick={() => setConf(false)}>Keep it</button><button className="btn danger p" onClick={() => cancel(t.id)}>Cancel transfer</button></div></div>}</div>}
  </>;
}

/* ---- page ---- */
function App() {
  const [bal, setBal] = useState(BAL0), [txs, setTxs] = useState(seedTx), [book, setBook] = useState(BOOK0), [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null), [toast, setToast] = useState(''), [adding, setAdding] = useState(false), [nb, setNb] = useState({ name: '', net: 'Ethereum', addr: '' }), [nbT, setNbT] = useState(false);
  const lastRef = useRef(null), closeRef = useRef(null), credited = useRef(new Set()), seq = useRef(100);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 450); return () => clearTimeout(t) }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) }, [toast]);
  useEffect(() => { /* simulate blocks arriving */
    const t = setInterval(() => setTxs(ts => ts.some(x => x.status === 'confirming') ? ts.map(x => x.status !== 'confirming' ? x : x.conf + 1 >= x.need ? { ...x, conf: x.need, status: 'completed' } : { ...x, conf: x.conf + 1 }) : ts), 1800);
    return () => clearInterval(t)
  }, []);
  useEffect(() => { /* credit incoming deposits once, when they complete */
    txs.forEach(x => { if (x.credit && x.status === 'completed' && !credited.current.has(x.id)) { credited.current.add(x.id); setBal(b => ({ ...b, [x.asset]: b[x.asset] + x.amt })); setToast('Received ' + qty(x.amt, x.asset)) } });
  }, [txs]);
  useEffect(() => {
    if (!drawer) return;
    if (closeRef.current) closeRef.current.focus();
    const k = e => { if (e.key === 'Escape') close() };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [drawer]);

  const open = (d, e) => { lastRef.current = e.currentTarget; setDrawer(d) };
  const close = () => { setDrawer(null); setTimeout(() => { if (lastRef.current && lastRef.current.focus) lastRef.current.focus() }, 0) };
  const nid = () => 't' + (seq.current++);

  const send = x => {
    setBal(b => ({ ...b, [x.asset]: b[x.asset] - x.amt - x.fee }));
    const id = nid();
    setTxs(ts => [{ id, kind: 'send', asset: x.asset, amt: x.amt, net: x.net, status: x.needs ? 'approval' : 'confirming', off: 0, party: x.party, addr: x.addr, fee: x.fee, conf: 0, need: NETS[x.net].need, hash: rh(x.net, 64) }, ...ts]);
    setDrawer({ m: 'tx', id }); setToast(x.needs ? 'Submitted for approval' : 'Transfer sent. Waiting for confirmations.');
  };
  const convert = x => {
    setBal(b => ({ ...b, [x.from]: b[x.from] - x.amt, [x.to]: b[x.to] + x.out }));
    setTxs(ts => [{ id: nid(), kind: 'convert', asset: x.from, amt: x.amt, net: null, status: 'completed', off: 0, party: x.from + ' to ' + x.to, to: x.to, toAmt: x.out, feeUsd: x.feeUsd, conf: 0, need: 0, hash: '', fee: 0 }, ...ts]);
    setDrawer(null); setToast('Converted ' + qty(x.amt, x.from) + ' to ' + qty(x.out, x.to));
  };
  const cancel = id => {
    const t = txs.find(x => x.id === id);
    setBal(b => ({ ...b, [t.asset]: b[t.asset] + t.amt + t.fee }));
    setTxs(ts => ts.map(x => x.id === id ? { ...x, status: 'cancelled' } : x)); setToast('Transfer cancelled');
  };
  const addBook = e => {
    e.preventDefault(); setNbT(true); if (nbErr) return;
    setBook(b => [{ id: 'b' + Date.now(), name: nb.name.trim(), net: nb.net, addr: nb.addr.trim() }, ...b]); setNb({ name: '', net: 'Ethereum', addr: '' }); setNbT(false); setAdding(false); setToast('Address saved');
  };
  const nbErr = nb.name.trim().length < 2 ? 'Give the address a name.' : !NETS[nb.net].re.test(nb.addr.trim()) ? 'That is not a valid ' + nb.net + ' address (' + NETS[nb.net].ex + ').' : '';

  const val = k => bal[k] * ASSETS[k].price;
  const stables = Object.keys(ASSETS).filter(k => ASSETS[k].type === 'stable'), cryptos = Object.keys(ASSETS).filter(k => ASSETS[k].type === 'crypto');
  const vS = stables.reduce((a, k) => a + val(k), 0), vC = cryptos.reduce((a, k) => a + val(k), 0), tot = vS + vC;
  const dayChg = cryptos.reduce((a, k) => a + val(k) * ASSETS[k].chg / 100, 0);
  const stat = (l, v, d) => <div className="card stat"><small>{l}</small><b>{loading ? '—' : v}</b><span className="d">{d}</span></div>;
  const sel = drawer && drawer.m === 'tx' ? txs.find(x => x.id === drawer.id) : null;

  const table = (title, icon, keys, note) => <div className="card"><h2><Ic n={icon} />{title}</h2>{note && <p className="note" style={{ margin: '6px 0 8px' }}>{note}</p>}
    <div className="wrap"><table aria-busy={loading}><thead><tr><th>Asset</th><th className="r">Balance</th><th className="r hide-s">Value</th><th className="r hide-s">Price · 24h</th><th><span className="sr" style={{ position: 'absolute', left: -9999 }}>Actions</span></th></tr></thead>
      <tbody>{loading ? keys.map(k => <tr key={k}>{[130, 100, 70, 90, 120].map((w, j) => <td key={j} className={j === 2 || j === 3 ? 'hide-s' : ''}><div className="sk" style={{ width: w, marginLeft: j > 0 && j < 4 ? 'auto' : 0 }} /></td>)}</tr>)
        : keys.map(k => {
          const A = ASSETS[k]; return <tr key={k}>
            <td><div className="as"><Icon a={k} /><div><b>{k}</b><div className="mu sm2">{A.name}{A.type === 'stable' && ' · pegged to ' + A.peg}</div></div></div></td>
            <td className="r nw">{qty(bal[k], k)}</td><td className="r nw hide-s">{fmt(val(k))}</td>
            <td className="r nw hide-s">{A.price < 0.01 ? '$' + A.price.toPrecision(2) : fmt(A.price)}<div className="sm2"><Chg v={A.chg} /></div></td>
            <td><div className="acts end"><button className="btn sm" disabled={!(bal[k] > 0)} onClick={e => open({ m: 'send', a: k }, e)}>Send</button><button className="btn sm" onClick={e => open({ m: 'receive', a: k }, e)}>Receive</button><button className="btn sm" onClick={e => open({ m: 'convert', a: k }, e)}>Convert</button></div></td></tr>
        })}</tbody></table></div></div>;

  return <div className="app"><Sidebar here="Crypto" />
    <main>
      <div className="top"><div><h1>Crypto</h1><p className="sub">Hold stablecoins and crypto, move money on-chain, and convert to and from your bank accounts.</p></div>
        <div className="qa"><button className="btn" onClick={e => open({ m: 'receive' }, e)}><Ic n="arrow-down-left" />Receive</button><button className="btn" onClick={e => open({ m: 'convert' }, e)}><Ic n="arrows-left-right" />Convert</button><button className="btn p" onClick={e => open({ m: 'send' }, e)}><Ic n="arrow-up-right" />Send</button></div></div>

      <div className="stats">
        {stat('Total value', '≈ ' + fmt(tot), 'Stablecoins and crypto')}
        {stat('Stablecoins', '≈ ' + fmt(vS), Math.round(vS / tot * 100) + '% of your wallet')}
        {stat('Crypto', '≈ ' + fmt(vC), Math.round(vC / tot * 100) + '% of your wallet')}
        {stat('Crypto · 24h', <span className={dayChg >= 0 ? 'up' : 'dn'}>{dayChg >= 0 ? '+' : '−'}{fmt(Math.abs(dayChg))}</span>, 'Change in crypto value')}
      </div>

      {table('Stablecoins', 'coins', stables, 'Stablecoins aim to hold a steady value, so they suit payments and treasury. A peg can break, so spread large balances across issuers.')}
      {table('Crypto', 'currency-btc', cryptos, 'Prices can swing sharply in a day. Only hold what your business can afford to see fall.')}

      <div className="card"><h2><Ic n="clock-counter-clockwise" />Recent activity</h2>
        {!loading && txs.length === 0 ? <div className="empty">No crypto activity yet.</div>
          : <div className="wrap"><table aria-busy={loading}><thead><tr><th>Date</th><th>Transaction</th><th className="hide-s">Network</th><th>Status</th><th className="r">Amount</th></tr></thead>
            <tbody>{loading ? [0, 1, 2, 3].map(i => <tr key={i}>{[60, 160, 70, 80, 90].map((w, j) => <td key={j} className={j === 2 ? 'hide-s' : ''}><div className="sk" style={{ width: w, marginLeft: j === 4 ? 'auto' : 0 }} /></td>)}</tr>)
              : txs.map(t => <tr key={t.id} className="rw" onClick={e => open({ m: 'tx', id: t.id }, e)}>
                <td className="mu nw">{dshort(t.off)}</td>
                <td><button className="lnk" onClick={e => { e.stopPropagation(); open({ m: 'tx', id: t.id }, e) }}>{t.kind === 'receive' ? 'Received ' + t.asset : t.kind === 'send' ? 'Sent ' + t.asset : 'Converted ' + t.asset}</button><div className="mu sm2">{t.kind === 'receive' ? 'From ' : t.kind === 'send' ? 'To ' : ''}{t.party}</div></td>
                <td className="hide-s mu">{t.net || 'Internal'}</td>
                <td><span className={'pill ' + TXST[t.status][1]}>{TXST[t.status][0]}</span>{t.status === 'confirming' && <div className="mu sm2">{t.conf} of {t.need}</div>}</td>
                <td className={'r nw ' + (t.kind === 'receive' ? 'up' : '')}>{t.kind === 'receive' ? '+' : t.kind === 'send' ? '−' : ''}{qty(t.amt, t.asset)}</td></tr>)}</tbody></table></div>}</div>

      <div className="card"><div className="row"><h2><Ic n="address-book" />Saved addresses</h2><button className="btn sm" onClick={() => { setAdding(!adding); setNbT(false) }}><Ic n={adding ? 'x' : 'plus'} s={14} />{adding ? 'Cancel' : 'Add address'}</button></div>
        {adding && <form onSubmit={addBook} noValidate style={{ marginTop: 12 }}>
          <div className="two"><div className="field"><label className="f" htmlFor="bn">Name</label><input id="bn" value={nb.name} onChange={e => setNb({ ...nb, name: e.target.value })} /></div>
            <div className="field"><label className="f" htmlFor="bw">Network</label><select id="bw" value={nb.net} onChange={e => setNb({ ...nb, net: e.target.value })}>{Object.keys(NETS).map(n => <option key={n}>{n}</option>)}</select></div></div>
          <div className="field"><label className="f" htmlFor="ba">Address</label><input id="ba" value={nb.addr} onChange={e => setNb({ ...nb, addr: e.target.value })} autoComplete="off" spellCheck="false" />{nbT && <Err t={nbErr} />}</div>
          <button type="submit" className="btn p">Save address</button></form>}
        <div style={{ marginTop: 8 }}>{book.length === 0 ? <div className="empty">No saved addresses yet.</div> : book.map(b => <div className="bk" key={b.id}><div><b>{b.name}</b><div className="mu sm2">{b.net} · <span className="mono">{short(b.addr)}</span></div></div>
          <span className="acts"><button className="btn sm" onClick={e => open({ m: 'send', book: b }, e)}>Send</button><button className="btn sm" aria-label={'Remove ' + b.name} onClick={() => { setBook(l => l.filter(x => x.id !== b.id)); setToast('Address removed') }}><Ic n="trash" s={14} /></button></span></div>)}</div></div>

      <p className="note"><Ic n="info" s={14} />Demo data. Prices, balances, addresses and transaction hashes are sample values, and no real funds move.</p>

      {drawer && <><div className="ov" onClick={close} />
        <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dt">
          {drawer.m === 'receive' ? <Receive init={drawer.a} close={close} closeRef={closeRef} say={setToast} />
            : drawer.m === 'send' ? <Send key={drawer.a || (drawer.book && drawer.book.id) || 's'} init={drawer.a || (drawer.book && Object.keys(ASSETS).find(k => ASSETS[k].nets.includes(drawer.book.net) && bal[k] > 0))} initNet={drawer.book && drawer.book.net} initAddr={drawer.book && drawer.book.addr} bal={bal} book={book} onSend={send} close={close} closeRef={closeRef} />
              : drawer.m === 'convert' ? <Convert init={drawer.a} bal={bal} onConvert={convert} close={close} closeRef={closeRef} />
                : sel ? <TxDetail key={sel.id + sel.status} t={sel} cancel={cancel} close={close} closeRef={closeRef} say={setToast} /> : null}</div></>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);