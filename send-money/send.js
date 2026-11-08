const { useEffect } = React;
const { Ic, Sidebar } = Montra;
const OVERVIEW = '../overview/overview.html';
const SendMoney = MontraSend.Flow;

function App() {
  return <div className="app">
    <Sidebar here="Payments" />
    <main>
      <div className="top"><div><h1>Send money</h1><p className="sub">Pay a saved recipient or add a new one. You will review everything before it goes out.</p></div>
        <div className="qa"><a className="btn" href="../Recipients/recipients.html"><Ic n="address-book" s={15} />Recipients</a><a className="btn" href="../Bulk/bulk.html"><Ic n="rows" s={15} />Bulk payment</a><button className="btn" onClick={() => { location.href = OVERVIEW }}><Ic n="arrow-left" s={15} />Overview</button></div></div>
      <SendMoney />
    </main></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);