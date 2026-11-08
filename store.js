/* Montra shared demo data. Plain JS, load before the page script.
   Recipients live here once, so Send money, Recipients and Bulk payments all show the same people.
   Changes are kept in localStorage (this browser only). All names, banks and numbers are made up. */
(function () {
  var KEY = 'montra-beneficiaries';
  var H = function (d, ref, amt, st) { return { d: d, ref: ref, amt: amt, st: st || 'completed' }; };
  var SEED = [
    { id: 1, name: 'Amara Okafor', bank: 'GTBank', acct: '0123456789', cur: 'NGN', type: 'Individual', country: 'Nigeria', email: 'amara@okafor.ng', verified: true, hist: [H('Nov 1', 'Design retainer', 350000), H('Oct 3', 'Design retainer', 350000)] },
    { id: 2, name: 'Lagos Fresh Ltd', bank: 'Access Bank', acct: '0456781234', cur: 'NGN', type: 'Business', country: 'Nigeria', email: 'accounts@lagosfresh.ng', verified: true, hist: [H('Oct 30', 'Refund INV-1030', 120000)] },
    { id: 3, name: 'Acme GmbH', bank: 'Deutsche Bank', acct: 'DE89370400440532013000', cur: 'EUR', type: 'Business', country: 'Germany', email: 'ap@acme-gmbh.de', verified: false, hist: [H('Oct 12', 'Licence fee', 1800), H('Sep 12', 'Licence fee', 1800)] },
    { id: 4, name: 'Harbor Design Ltd', bank: 'Barclays', acct: '20000055779911', cur: 'GBP', type: 'Business', country: 'United Kingdom', email: 'finance@harbordesign.co.uk', verified: false, hist: [H('Oct 18', 'UX audit', 3200)] },
    { id: 5, name: 'Pixel Forge LLC', bank: 'Chase', acct: '000000004821', cur: 'USD', type: 'Business', country: 'United States', email: 'ap@pixelforge.io', verified: false, hist: [H('Nov 2', 'Illustration pack', 2700), H('Oct 2', 'Illustration pack', 2700), H('Sep 4', 'Illustration pack', 2700, 'failed')] },
    { id: 6, name: 'Dev Kumar', bank: 'Bank of America', acct: '0000112233', cur: 'USD', type: 'Individual', country: 'United States', email: 'dev@kumar.dev', verified: false, hist: [H('Oct 28', 'Contract work', 2400)] },
    { id: 7, name: 'Ife Bello', bank: 'UBA', acct: '2109876543', cur: 'NGN', type: 'Individual', country: 'Nigeria', email: 'ife@bello.ng', verified: true, hist: [] },
    { id: 8, name: 'Nordic Print AB', bank: 'Nordea', acct: 'FI2112345600000785', cur: 'EUR', type: 'Business', country: 'Finland', email: 'billing@nordicprint.fi', verified: false, hist: [H('Oct 8', 'Print run', 940)] }
  ];
  /* account names a bank lookup would return, for the "Verify" demo (Nigeria only, like real name enquiry) */
  var REGISTRY = { '0123456789': 'AMARA OKAFOR', '0456781234': 'LAGOS FRESH LIMITED', '2109876543': 'BELLO IFEOLUWA', '0112233445': 'CHIDI EZE' };

  function read() { try { var s = localStorage.getItem(KEY), v = s && JSON.parse(s); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
  function clean(a) { return String(a || '').replace(/[\s-]/g, '').toUpperCase(); }
  function iban(a) {
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(a)) return false;
    var s = (a.slice(4) + a.slice(0, 4)).replace(/[A-Z]/g, function (c) { return c.charCodeAt(0) - 55; }), r = 0;
    for (var i = 0; i < s.length; i += 7) r = Number(r + s.slice(i, i + 7)) % 97;
    return r === 1;
  }
  var RULES = {
    NGN: { re: /^\d{10}$/, msg: 'Nigerian account numbers have 10 digits.', label: 'Account number (10 digits)' },
    USD: { re: /^\d{4,17}$/, msg: 'US account numbers have 4 to 17 digits.', label: 'Account number' },
    GBP: { re: /^\d{14}$/, msg: 'Use the 6-digit sort code followed by the 8-digit account number.', label: 'Sort code + account number' },
    EUR: { test: iban, msg: 'That IBAN is not valid. Check it for typos.', label: 'IBAN' }
  };

  window.MontraStore = {
    rules: RULES,
    clean: clean,
    /* '' when the number is fine for this currency, otherwise a message */
    checkAccount: function (cur, acct) {
      var r = RULES[cur], a = clean(acct);
      if (!a) return 'Enter the account number.';
      return (r.test ? r.test(a) : r.re.test(a)) ? '' : r.msg;
    },
    /* demo name enquiry: returns the registered name, or null when the bank has no such account */
    lookup: function (cur, acct) { return cur === 'NGN' ? (REGISTRY[clean(acct)] || null) : undefined; },
    beneficiaries: function () { return read() || JSON.parse(JSON.stringify(SEED)); },
    saveBeneficiaries: function (list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} },
    resetBeneficiaries: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
