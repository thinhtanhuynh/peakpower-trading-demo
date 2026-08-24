/*
 * Seed data for the Back Office screens cloned from Back Office Portal -
 * Preview.html: Home, Customers, Wallets, Settlements and Data & feeds.
 *
 * Every constant here is a VERBATIM port of that mockup's own bundled demo data
 * (the mockup stays a pure design reference and is never hand-edited), plus the
 * few small build* helpers its renderVals() applies to them. There is no live
 * source behind any of these screens — the mockup is itself a static seeded
 * demo, so matching it means matching its numbers, not deriving new ones.
 *
 * The Trade desk's own seed data lives in back-office-desk-data.js, and
 * TAG_STYLE is taken from there rather than duplicated.
 *
 * Dual Node/browser module, same pattern as the other JS files here.
 */
(function (root) {
  "use strict";

  var BackOfficeDeskData = root.BackOfficeDeskData ||
    (typeof require !== "undefined" ? require("./back-office-desk-data.js") : null);

  // ---- home --------------------------------------------------------------

  /* --- Home (Operations dashboard) ---------------------------------------- *
   * Seed data ported verbatim from the Back Office mockup's component script.
   * TAG_STYLE and INTEGRATIONS are top-level constants there; ATTENTION_ITEMS,
   * EXPOSURE_TOP and EXPOSURE_BOTTOM are the literal arrays built inside
   * renderVals(), lifted out unchanged. The two build* helpers below are the
   * .map() decorations renderVals() applies to them (zebra rowBg, first-row
   * borderTop 'none', TAG_STYLE lookup).
   *
   * NOTE: TAG_STYLE is byte-identical to BackOfficeDeskData.TAG_STYLE — if this
   * fragment lands in a module that already has it, drop this copy and use that
   * one instead. It is repeated here only so the fragment stands alone.
   */


  var INTEGRATIONS = [
    { name: "PVNed timeseries", mode: "Inbound push", last: "30 Jul 06:12", detail: "412 documents today", statusTone: "success", statusLabel: "Healthy" },
    { name: "Montel — indications", mode: "Poll · 5 min", last: "30 Jul 14:22", detail: "5 of 6 products fresh", statusTone: "warning", statusLabel: "Degraded" },
    { name: "Montel — day-ahead", mode: "Poll · daily", last: "30 Jul 13:04", detail: "31 Jul complete (96/96)", statusTone: "success", statusLabel: "Healthy" },
    { name: "CM.com payments", mode: "Webhook", last: "30 Jul 09:14", detail: "3 payments today", statusTone: "success", statusLabel: "Healthy" },
    { name: "Odoo", mode: "Push", last: "05 Jul 02:41", detail: "last run: 47 settlements", statusTone: "success", statusLabel: "Healthy" }
  ];

  var ATTENTION_ITEMS = [
    { tag: "04:12", tone: "critical", title: "Offer expiring", sub: "Vandersteen Koeling · TRD-1051 · Peak Q1-27 · € 72.768", tradeId: "TRD-1051" },
    { tag: "22 min", tone: "critical", title: "Accepted, not confirmed", sub: "Kramer Logistics · TRD-1049 · € 41.200", tradeId: "TRD-1049" },
    { tag: "06 min", tone: "warning", title: "New request", sub: "Van Dijk Glastuinbouw · Base Cal-27 · 2,00 MW", tradeId: "TRD-1058" },
    { tag: "1h 42", tone: "warning", title: "Montel feed stale", sub: "NL_POWER_PEAK_Y1 · last observed 12:40", tradeId: null },
    { tag: "2 days", tone: "warning", title: "No metering data", sub: "Vandersteen Koeling · Almere office (…0059)", tradeId: null }
  ];

  var EXPOSURE_TOP = [
    { label: "Open offers (5)", value: "€ 184.300,00", color: "var(--pp-text-heading)" },
    { label: "Accepted, unconfirmed (2)", value: "€ 113.968,00", color: "var(--pp-red)" }
  ];

  var EXPOSURE_BOTTOM = [
    { label: "Requests received", value: "38", color: "var(--pp-text-heading)" },
    { label: "Offers made", value: "35", color: "var(--pp-text-heading)" },
    { label: "Accepted", value: "27 (77 %)", color: "var(--pp-green)" },
    { label: "Median request → offer", value: "18 min", color: "var(--pp-green)" }
  ];

  /**
   * renderVals()'s attentionItems decoration: the first row has no top border
   * (the Card's own subtitle margin is the separator), every other row gets
   * one, and the tag's three colours come out of TAG_STYLE by tone.
   */
  function buildAttentionItems() {
    return ATTENTION_ITEMS.map(function (a, i) {
      var style = BackOfficeDeskData.TAG_STYLE[a.tone];
      return {
        tag: a.tag, tone: a.tone, title: a.title, sub: a.sub, tradeId: a.tradeId,
        borderTop: i === 0 ? "none" : "1px solid var(--pp-border)",
        tagBg: style.bg, tagBorder: style.border, tagColor: style.color
      };
    });
  }

  /** renderVals()'s integrations decoration: zebra striping on odd rows. */
  function buildIntegrations() {
    return INTEGRATIONS.map(function (i, idx) {
      return {
        name: i.name, mode: i.mode, last: i.last, detail: i.detail,
        statusTone: i.statusTone, statusLabel: i.statusLabel,
        rowBg: idx % 2 === 1 ? "var(--pp-surface-zebra)" : "transparent"
      };
    });
  }

  // ---- customers ---------------------------------------------------------

  /* ------------------------------------------------------------------ *
   * Customers screen — seed data, ported verbatim from the Back Office
   * mockup's component script (Back Office Portal - Preview.html).
   * Same values, same key names, same order as the mockup.
   * ------------------------------------------------------------------ */

  var METERING = [
    {ean:'…0011', name:'Rotterdam DC', nameColor:'var(--pp-text-heading)', commodity:'Electricity', commodityColor:'var(--pp-text-heading)', validFrom:'01-01-2024', validTo:'—', validToColor:'var(--pp-text-faint)', dataTone:'success', dataLabel:'OK'},
    {ean:'…0027', name:'Venlo cold store', nameColor:'var(--pp-text-heading)', commodity:'Electricity', commodityColor:'var(--pp-text-heading)', validFrom:'01-01-2024', validTo:'—', validToColor:'var(--pp-text-faint)', dataTone:'success', dataLabel:'OK'},
    {ean:'…0043', name:'Tilburg plant', nameColor:'var(--pp-text-heading)', commodity:'Electricity', commodityColor:'var(--pp-text-heading)', validFrom:'01-04-2024', validTo:'—', validToColor:'var(--pp-text-faint)', dataTone:'success', dataLabel:'OK'},
    {ean:'…0059', name:'Almere office', nameColor:'var(--pp-text-heading)', commodity:'Electricity', commodityColor:'var(--pp-text-heading)', validFrom:'01-01-2025', validTo:'—', validToColor:'var(--pp-text-faint)', dataTone:'critical', dataLabel:'2d silent'},
    {ean:'…0061', name:'— none set —', nameColor:'var(--pp-text-faint)', commodity:'Electricity', commodityColor:'var(--pp-text-heading)', validFrom:'01-06-2026', validTo:'—', validToColor:'var(--pp-text-faint)', dataTone:'success', dataLabel:'OK'},
    {ean:'…0078', name:'Breda warehouse', nameColor:'var(--pp-text-heading)', commodity:'Electricity', commodityColor:'var(--pp-text-heading)', validFrom:'01-01-2024', validTo:'31-12-2026', validToColor:'var(--pp-amber)', dataTone:'success', dataLabel:'OK'},
    {ean:'…0092', name:'Tilburg plant — gas', nameColor:'var(--pp-text-heading)', commodity:'Gas', commodityColor:'var(--pp-text-body)', validFrom:'01-04-2024', validTo:'—', validToColor:'var(--pp-text-faint)', dataTone:'neutral', dataLabel:'Not tradeable'}
  ];

  /**
   * The three roles an account can hold, weakest first. Cumulative: each one
   * grants everything the role above it does, so `extra` lists only what it
   * adds. `ROLE_ADMIN` and friends are the stored value — a role is matched by
   * label, so these strings are the vocabulary.
   */
  var ROLE_VIEWER = 'Viewer', ROLE_TRADER = 'Trader', ROLE_ADMIN = 'Admin';
  var ACCOUNT_ROLES = [
    {label: ROLE_VIEWER, tone:'neutral', summary:'can see everything, change nothing',
      extra:['View connections, consumption, prices, trades, the wallet and settlements']},
    {label: ROLE_TRADER, tone:'info', summary:'a Viewer who can also trade and deposit',
      extra:['Request and accept trades', 'Deposit funds into the wallet']},
    {label: ROLE_ADMIN, tone:'brand', summary:'a Trader who can also move money and manage the account',
      extra:['Withdraw funds', 'Add and remove EANs', 'Manage users and their roles',
        'Turn four-eyes approval on and off']}
  ];

  // The mockup's four accounts, with its job titles mapped onto the roles
  // above: the column carries one vocabulary or it means nothing.
  var ACCOUNTS = [
    {name:'J. de Vries', role: ROLE_ADMIN, username:'jdevries', lastSignIn:'30 Jul 14:25', statusTone:'success', statusLabel:'Active', actionLabel:'edit', textColor:'var(--pp-text-heading)'},
    {name:'M. Vandersteen', role: ROLE_ADMIN, username:'mvandersteen', lastSignIn:'30 Jul 14:44', statusTone:'success', statusLabel:'Active', actionLabel:'edit', textColor:'var(--pp-text-heading)'},
    {name:'P. Aksoy', role: ROLE_TRADER, username:'paksoy', lastSignIn:'12 Jul 09:02', statusTone:'success', statusLabel:'Active', actionLabel:'edit', textColor:'var(--pp-text-heading)'},
    {name:'R. Smit', role: ROLE_VIEWER, username:'rsmit', lastSignIn:'—', statusTone:'warning', statusLabel:'Invited 6d', actionLabel:'resend', textColor:'var(--pp-text-faint)'}
  ];

  /** A role's tone for the accounts table's badge; unknown roles stay neutral. */
  function roleTone(label) {
    for (var i = 0; i < ACCOUNT_ROLES.length; i++) {
      if (ACCOUNT_ROLES[i].label === label) { return ACCOUNT_ROLES[i].tone; }
    }
    return 'neutral';
  }

  var COMPANY_FIELDS = [
    {label:'Legal name', value:'Vandersteen Koeling B.V.'},
    {label:'Trade name', value:'Vandersteen Cooling'},
    {label:'KvK', value:'34215678'},
    {label:'VAT', value:'NL812345678B01'},
    {label:'IBAN', value:'NL18 INGB 0002 4455 66'},
    {label:'BIC', value:'INGBNL2A'},
    {label:'Account holder', value:'Vandersteen Koeling B.V.'},
    {label:'Billing address', value:'Havenweg 22, Rotterdam'},
    {label:'Primary contact', value:'J. de Vries · +31 10 240 1188'}
  ];

  var CUSTOMER_LIST = [
    {name:'Vandersteen Koeling B.V.', kvk:'34215678', connections:'7', status:'Active', statusTone:'success', available:'€ 19.722,00', availableTone:'warning', openTrades:'2', lastSettlement:'€ 18.110,00', contact:'J. de Vries', city:'Rotterdam'},
    {name:'Kramer Logistics B.V.', kvk:'68812340', connections:'9', status:'Active', statusTone:'success', available:'€ 179.200,00', availableTone:'default', openTrades:'1', lastSettlement:'€ 110.374,26', contact:'R. Kramer', city:'Venlo'},
    {name:'Van Dijk Glastuinbouw', kvk:'70012399', connections:'3', status:'Active', statusTone:'success', available:'€ 1.650.000,00', availableTone:'default', openTrades:'1', lastSettlement:'€ 172.884,97', contact:'K. van Dijk', city:'Bleiswijk'},
    {name:'Meijer Koelhuizen', kvk:'61234567', connections:'4', status:'Active', statusTone:'success', available:'€ −4.210,00', availableTone:'critical', openTrades:'1', lastSettlement:'—', contact:'T. Meijer', city:'Barendrecht'},
    {name:'Hoekstra Staal B.V.', kvk:'65543210', connections:'5', status:'Active', statusTone:'success', available:'—', availableTone:'default', openTrades:'2', lastSettlement:'—', contact:'S. Hoekstra', city:'Enschede'},
    {name:'De Groot Papier', kvk:'63321098', connections:'4', status:'Active', statusTone:'success', available:'€ 19.650,00', availableTone:'warning', openTrades:'0', lastSettlement:'€ 70.426,97', contact:'A. de Groot', city:'Eerbeek'},
    {name:'Nolte Chemie', kvk:'69988771', connections:'3', status:'Onboarding', statusTone:'warning', available:'—', availableTone:'default', openTrades:'1', lastSettlement:'—', contact:'M. Nolte', city:'Delfzijl'},
    {name:'Bosman Tuinbouw', kvk:'67554433', connections:'2', status:'Active', statusTone:'success', available:'€ 1.823,00', availableTone:'critical', openTrades:'0', lastSettlement:'—', contact:'J. Bosman', city:'Naaldwijk'}
  ];

  /**
   * The mockup's `.map((f,i) => ({...f, borderTop: i === 0 ? 'none' : ...}))`
   * over a {label, value} list, as an ES5 helper. The first row of a
   * key/value stack has no top border; every later row has one.
   */
  function customersWithBorders(fields) {
    return fields.map(function (f, i) {
      return {
        label: f.label,
        value: f.value,
        borderTop: i === 0 ? 'none' : '1px solid var(--pp-border)'
      };
    });
  }

  /**
   * Vandersteen Koeling B.V. is the mockup's one fully-authored customer;
   * every other row gets a detail synthesised from its list entry. Ported
   * verbatim, including the synthesis rules.
   */
  function buildCustomerDetail(c) {
    var i;
    if (c.name === 'Vandersteen Koeling B.V.') {
      return {
        status: 'Active', statusTone: 'success', connections: '7', available: '€ 19.722,00', availableTone: 'warning',
        openTrades: '2', lastSettlement: '€ 18.110,00', meteringSummary: '7 · 1 ending 31 Dec 2026',
        companyFields: customersWithBorders(COMPANY_FIELDS),
        metering: METERING, accounts: ACCOUNTS, accountsSummary: '4 · 3 active'
      };
    }
    var kvk = c.kvk;
    var company = customersWithBorders([
      {label:'Legal name', value: c.name},
      {label:'Trade name', value: c.name.replace(' B.V.', '')},
      {label:'KvK', value: kvk},
      {label:'VAT', value: 'NL8' + kvk + 'B01'},
      {label:'IBAN', value: 'NL' + (20 + c.kvk.length) + ' INGB ' + kvk.slice(0, 4) + ' ' + kvk.slice(4, 8)},
      {label:'BIC', value: 'INGBNL2A'},
      {label:'Account holder', value: c.name},
      {label:'Billing address', value: 'Bedrijfsweg 1, ' + c.city},
      {label:'Primary contact', value: c.contact + ' · +31 6 ' + kvk.slice(0, 4) + ' ' + kvk.slice(4, 8)}
    ]);
    var connCount = Math.min(parseInt(c.connections, 10) || 1, 4);
    var metering = [];
    for (i = 0; i < connCount; i++) {
      metering.push({
        ean: '…' + (parseInt(kvk.slice(-4), 10) + i), name: c.city + ' site ' + (i + 1), nameColor: 'var(--pp-text-heading)',
        commodity: 'Electricity', commodityColor: 'var(--pp-text-heading)', validFrom: '01-01-2024', validTo: '—', validToColor: 'var(--pp-text-faint)',
        dataTone: 'success', dataLabel: 'OK'
      });
    }
    var accounts = [
      {name: c.contact, role: ROLE_ADMIN, username: c.contact.split(' ').pop().toLowerCase(), lastSignIn:'30 Jul 14:25', statusTone:'success', statusLabel:'Active', actionLabel:'edit', textColor:'var(--pp-text-heading)'},
      {name: c.contact.charAt(0) + '. Finance', role: ROLE_TRADER, username: c.contact.split(' ').pop().toLowerCase() + 'f', lastSignIn:'28 Jul 10:12', statusTone:'success', statusLabel:'Active', actionLabel:'edit', textColor:'var(--pp-text-heading)'}
    ];
    return {
      status: c.status, statusTone: c.statusTone, connections: c.connections, available: c.available, availableTone: c.availableTone,
      openTrades: c.openTrades, lastSettlement: c.lastSettlement, meteringSummary: c.connections + ' connections',
      companyFields: company, metering: metering, accounts: accounts, accountsSummary: '2 · 2 active'
    };
  }

  /**
   * The editable Commercial settings. `money` fields are edited as a bare
   * number between a fixed prefix/suffix; the other two are read-only text
   * even in edit mode. The page holds a mutable copy in
   * `state.commercialFields` (see customers.render.js).
   */
  var COMMERCIAL_FIELDS = [
    // The one field with teeth: the Customer Portal reads it (through
    // portal-terms-link.js) and will not let a block be entered for less than
    // this share of its value. `key` marks it as the field the terms link
    // owns; the mockup's own fields have no key and stay decorative.
    {label:'Deposit on a bought block', value:'20 %', color:'var(--pp-teal-700)', money:true, key:'depositPct', prefix:'', numeric:'20', suffix:' %'},
    {label:'Surcharge (from 1 Jan 2026)', value:'€ 4,5000 / MWh', color:'var(--pp-text-heading)', money:true, prefix:'€ ', numeric:'4,5000', suffix:' / MWh'},
    {label:'Previous (2025)', value:'€ 5,2000 / MWh', color:'var(--pp-text-heading)', money:true, prefix:'€ ', numeric:'5,2000', suffix:' / MWh'},
    {label:'Wallet minimum — warning', value:'€ 25.000,00', color:'var(--pp-text-heading)', money:true, prefix:'€ ', numeric:'25.000,00', suffix:''},
    {label:'Wallet minimum — critical', value:'€ 10.000,00', color:'var(--pp-text-heading)', money:true, prefix:'€ ', numeric:'10.000,00', suffix:''},
    {label:'Surplus settlement policy', value:'Day-ahead', color:'var(--pp-text-heading)', money:false},
    {label:'Short selling', value:'Not permitted', color:'var(--pp-red)', money:false},
    // Editable, per customer, and an Admin on the customer's own side can turn
    // it on and off too. Nothing enforces it yet — no second-approver step
    // exists in either portal — so the card says what it would gate.
    {label:'Four-eyes approval', value:'Off', color:'var(--pp-text-heading)', money:false,
      key:'fourEyes', choices:['Off', 'On']}
  ];

  // ---- wallets -----------------------------------------------------------

var WALLETS = [
  {name:'Meijer Koelhuizen', settled:'€ −4.210,00', settledColor:'var(--pp-red)', reserved:'€ 0,00', available:'€ −4.210,00', availableColor:'var(--pp-red)', minimum:'€ 15.000,00', statusTone:'critical', statusLabel:'Negative', lastMovement:'01-08 settlement'},
  {name:'Bosman Tuinbouw', settled:'€ 8.940,00', settledColor:'var(--pp-text-heading)', reserved:'€ 7.117,00', available:'€ 1.823,00', availableColor:'var(--pp-red)', minimum:'€ 10.000,00', statusTone:'critical', statusLabel:'Critical', lastMovement:'29-07 reserved'},
  {name:'Vandersteen Koeling', settled:'€ 29.122,00', settledColor:'var(--pp-text-heading)', reserved:'€ 9.400,00', available:'€ 19.722,00', availableColor:'var(--pp-amber)', minimum:'€ 25.000,00', statusTone:'warning', statusLabel:'Warning', lastMovement:'13-08 reserved'},
  {name:'De Groot Papier', settled:'€ 41.800,00', settledColor:'var(--pp-text-heading)', reserved:'€ 22.150,00', available:'€ 19.650,00', availableColor:'var(--pp-amber)', minimum:'€ 20.000,00', statusTone:'warning', statusLabel:'Warning', lastMovement:'30-07 reserved'},
  {name:'Kramer Logistics', settled:'€ 220.400,00', settledColor:'var(--pp-text-heading)', reserved:'€ 41.200,00', available:'€ 179.200,00', availableColor:'var(--pp-text-heading)', minimum:'€ 50.000,00', statusTone:'success', statusLabel:'Healthy', lastMovement:'30-07 reserved'},
  {name:'Van Dijk Glastuinbouw', settled:'€ 1.650.000,00', settledColor:'var(--pp-text-heading)', reserved:'€ 0,00', available:'€ 1.650.000,00', availableColor:'var(--pp-text-heading)', minimum:'€ 200.000,00', statusTone:'success', statusLabel:'Healthy', lastMovement:'18-07 deposit'},
];

// The four stat cards above the Wallets table. Not in the mockup's script.js —
// they are hardcoded <StatCard> props in its markup, lifted here verbatim
// (label / value / tone / sublabel, in the mockup's own order).
var WALLET_STATS = [
  {label:'TOTAL SETTLED', value:'€ 8.418.220', tone:'', sublabel:'across 47 wallets'},
  {label:'TOTAL RESERVED', value:'€ 298.268', tone:'warning', sublabel:'7 open reservations'},
  {label:'BELOW MINIMUM', value:'4', tone:'critical', sublabel:'1 negative'},
  {label:'RECONCILIATION', value:'OK', tone:'success', sublabel:'last check 03:00 · 0 mismatches'},
];

  // ---- settlements ---------------------------------------------------------

  /* --- Settlements (settlement run — August 2026) -------------------------------
   * Ported verbatim from the Back Office mockup's script (SKIPPED, DRAFTS).
   * Both lists are static seed data — the mockup's settlement run is read-only.
   */

  var SKIPPED = [
    {customer:'Nolte Chemie', reason:'MISSING_METERING_DATA', detail:'3 delivery dates without data · EAN …0417', fixOwner:'Data team'},
    {customer:'Bosman Tuinbouw', reason:'INCOMPLETE_METERING_DATA', detail:'29 Aug is PARTIAL (72 of 96 intervals)', fixOwner:'Data team'},
    {customer:'Meijer Koelhuizen', reason:'MISSING_DAY_AHEAD_PRICE', detail:'31 Aug 22:00–24:00 missing from the curve', fixOwner:'Platform'},
    {customer:'Dekker Betonwaren', reason:'MISSING_IMBALANCE_DATA', detail:'No imbalance report received for August', fixOwner:'PVNed'},
    {customer:'Van Loon Transport', reason:'MISSING_METERING_DATA', detail:'Quarantined series — EAN not registered', fixOwner:'Account manager'}
  ];

  var DRAFTS = [
    {customer:'Van Dijk Glastuinbouw', connections:'3', volume:'1.418,2 MWh', subtotal:'€ 142.880,14', vat:'€ 30.004,83', total:'€ 172.884,97', dataTone:'success', dataLabel:'Final'},
    {customer:'Kramer Logistics', connections:'9', volume:'904,7 MWh', subtotal:'€ 91.218,40', vat:'€ 19.155,86', total:'€ 110.374,26', dataTone:'success', dataLabel:'Final'},
    {customer:'Vandersteen Koeling', connections:'6', volume:'1.291,4 MWh', subtotal:'€ 34.397,48', vat:'€ 7.223,47', total:'€ 41.620,95', dataTone:'warning', dataLabel:'4 provisional'},
    {customer:'De Groot Papier', connections:'4', volume:'612,9 MWh', subtotal:'€ 58.204,11', vat:'€ 12.222,86', total:'€ 70.426,97', dataTone:'success', dataLabel:'Final'},
    {customer:'Hendriks Vlees', connections:'2', volume:'188,4 MWh', subtotal:'€ 19.044,02', vat:'€ 3.999,24', total:'€ 23.043,26', dataTone:'warning', dataLabel:'1 provisional'}
  ];

  /* The five run-summary figures above the tables. The mockup writes these
   * straight into five <StatCard> calls rather than into a data constant; they
   * are lifted here unchanged (label, value, tone, sublabel), in the mockup's
   * own order, so the render fragment stays a loop. `tone:""` is the DS
   * StatCard default tone (heading colour). */
  var SETTLEMENT_RUN_STATS = [
    {label:'DRAFTED', value:'41', tone:'success', sublabel:'ready for review'},
    {label:'SKIPPED', value:'5', tone:'warning', sublabel:'pre-flight gate'},
    {label:'FAILED', value:'1', tone:'critical', sublabel:'volume identity'},
    {label:'TOTAL VALUE', value:'€ 1,84 M', tone:'', sublabel:'excluding VAT'},
    {label:'DURATION', value:'26 min', tone:'success', sublabel:'target < 30 min'}
  ];

  /* The DS <Banner tone="critical"> above the tables, verbatim. */
  var SETTLEMENT_RUN_BANNER = {
    tone: 'critical',
    title: 'Hoekstra Staal — calculation halted: volume identity did not reconcile on EAN …0233 (difference 4,182 MWh)',
    body: 'This indicates a coverage or calendar defect, not a data gap. No draft was produced. Engineering has been alerted.'
  };

  // ---- datafeeds ---------------------------------------------------------

  // --- Data & feeds -------------------------------------------------------
  // Ported verbatim from the Back Office mockup's own seeded constants
  // (CELL_TONE / CONNECTIONS_RAW / LEGEND / MESSAGES / buildConnections).
  // Same values, same key names, same order — only `const`/arrow syntax is
  // rewritten to the repo's ES5 flavour.

  var CELL_TONE = {
    success: { code: "F", bg: "var(--pp-green-bg)", border: "var(--pp-green-border)" },
    warning: { code: "P", bg: "var(--pp-amber-bg)", border: "var(--pp-amber-border)" },
    info: { code: "C", bg: "var(--pp-indigo-bg)", border: "#a5b4fc" },
    critical: { code: "N", bg: "var(--pp-red-bg)", border: "var(--pp-red-border)" },
    purple: { code: "A", bg: "#f3e8ff", border: "#d8b4fe" }
  };

  var CONNECTIONS_RAW = [
    { name: "Vandersteen · Almere office", ean: "…0059", tones: ["success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","critical","critical","critical"] },
    { name: "Nolte Chemie · Reactor 2", ean: "…0417", tones: ["success","success","success","critical","critical","success","success","success","success","success","success","success","critical","success","success","success","success","success","success","warning","warning"] },
    { name: "Bosman · Kas 4", ean: "…0308", tones: ["success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","purple","warning","warning","warning"] },
    { name: "Vandersteen · Rotterdam DC", ean: "…0011", tones: ["success","success","success","success","success","success","success","success","info","success","success","success","success","success","success","success","success","warning","warning","warning","warning"] },
    { name: "Kramer · Hub Venlo", ean: "…0512", tones: ["success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","success","warning","warning","warning","warning"] }
  ];

  var LEGEND = [
    { label: "F final", color: "var(--pp-green-border)" },
    { label: "P provisional", color: "var(--pp-amber-border)" },
    { label: "C corrected", color: "#a5b4fc" },
    { label: "N no data", color: "var(--pp-red-border)" },
    { label: "A partial", color: "#d8b4fe" }
  ];

  var MESSAGES = [
    { received: "06:12:04", type: "A23 allocation", docId: "8ff18bca…c6c8", series: "84", statusTone: "success", statusLabel: "Processed", detail: "42 EANs · 12 Aug", detailColor: "var(--pp-text-body)" },
    { received: "06:11:47", type: "A12 imbalance", docId: "3e09aa9e…0614", series: "10", statusTone: "success", statusLabel: "Processed", detail: "portfolio · 12 Aug", detailColor: "var(--pp-text-body)" },
    { received: "06:11:20", type: "A23 allocation", docId: "c7e23533…2f93", series: "2", statusTone: "warning", statusLabel: "Quarantined", detail: "EAN …0644 not registered", detailColor: "var(--pp-amber)" },
    { received: "06:10:58", type: "A23 allocation", docId: "4cd0eb39…555f", series: "2", statusTone: "critical", statusLabel: "Failed", detail: "INCOMPLETE_PERIOD 94/96", detailColor: "var(--pp-red)" },
    { received: "06:10:31", type: "A23 allocation", docId: "855b6a61…e834", series: "2", statusTone: "neutral", statusLabel: "Duplicate", detail: "identical payload 06:09", detailColor: "var(--pp-text-body)" },
    { received: "05:58:02", type: "A23 allocation", docId: "59d79ae3…74b7", series: "96", statusTone: "success", statusLabel: "Processed", detail: "correction · 31 Jul", detailColor: "var(--pp-indigo)" }
  ];

  /** CONNECTIONS_RAW with each tone expanded into a drawable day cell. */
  function buildConnections() {
    return CONNECTIONS_RAW.map(function (c) {
      return {
        name: c.name,
        ean: c.ean,
        cells: c.tones.map(function (t) {
          return { code: CELL_TONE[t].code, bg: CELL_TONE[t].bg, border: CELL_TONE[t].border };
        })
      };
    });
  }

  var api = {
    INTEGRATIONS: INTEGRATIONS,
    ATTENTION_ITEMS: ATTENTION_ITEMS,
    EXPOSURE_TOP: EXPOSURE_TOP,
    EXPOSURE_BOTTOM: EXPOSURE_BOTTOM,
    METERING: METERING,
    ACCOUNTS: ACCOUNTS,
    ACCOUNT_ROLES: ACCOUNT_ROLES,
    ROLE_VIEWER: ROLE_VIEWER,
    ROLE_TRADER: ROLE_TRADER,
    ROLE_ADMIN: ROLE_ADMIN,
    roleTone: roleTone,
    COMPANY_FIELDS: COMPANY_FIELDS,
    CUSTOMER_LIST: CUSTOMER_LIST,
    COMMERCIAL_FIELDS: COMMERCIAL_FIELDS,
    WALLETS: WALLETS,
    WALLET_STATS: WALLET_STATS,
    SKIPPED: SKIPPED,
    DRAFTS: DRAFTS,
    SETTLEMENT_RUN_STATS: SETTLEMENT_RUN_STATS,
    SETTLEMENT_RUN_BANNER: SETTLEMENT_RUN_BANNER,
    CELL_TONE: CELL_TONE,
    CONNECTIONS_RAW: CONNECTIONS_RAW,
    LEGEND: LEGEND,
    MESSAGES: MESSAGES,
    buildAttentionItems: buildAttentionItems,
    buildIntegrations: buildIntegrations,
    customersWithBorders: customersWithBorders,
    buildCustomerDetail: buildCustomerDetail,
    buildConnections: buildConnections
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackOfficeScreensData = api;
  }
})(typeof window !== "undefined" ? window : this);
