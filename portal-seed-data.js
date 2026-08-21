/*
 * Static seed/mock data for the Dashboard, Connections, Prices, Trading,
 * Wallet, and Settlements screens of the Customer Portal (Live Data) page.
 *
 * This is a verbatim port of Customer Portal - Preview.html's own bundled
 * demo data/state (that mockup is itself a static seeded demo — every one
 * of these six screens renders from hardcoded JS arrays/objects, not live
 * data). Porting it here lets the Live Data page's native rebuild of those
 * six screens match the mockup exactly, both in copy and in numbers.
 * Consumption remains the only screen backed by real per-interval data
 * (consumption-calc.js / consumption-data-loader.js) and does not use
 * anything in this file.
 *
 * Dual Node/browser module, same pattern as the other JS files here.
 */
(function (root) {
  "use strict";

  var NAV = ["Dashboard", "Connections", "Consumption", "Prices", "Trading", "Wallet", "Settlements"];
  var USER_LINE = "J. de Vries · Vandersteen Koeling B.V.";
  // How the Back Office desk names this customer (no "B.V.", matching the
  // Back Office mockup's own seeded trades).
  var CUSTOMER_NAME = "Vandersteen Koeling";
  // This customer's id in the Back Office's own CUSTOMER_LIST (its `kvk`).
  // It is what the commercial terms link is keyed by, so the deposit % the
  // desk sets on Vandersteen's Commercial settings is the one this portal
  // obeys — matching by display name would not survive the Back Office
  // calling the same company "Vandersteen Koeling B.V.".
  var CUSTOMER_ID = "34215678";
  var TONE_COLOR = { submit: "#0d9488", indigo: "#4f46e5", amber: "#d97706", green: "#15803d", red: "#dc2626" };

  var CONNECTIONS = [
    { id: "rot", name: "Rotterdam DC", ean: "8716 8710 0000 0000 11", commodity: "Electricity", status: "Active", statusTone: "success", latestDate: "12 Aug 2026", latestNote: "provisional", volume: "385,4 MWh", coverage: 94,
      description: "Data centre — 3 halls", gridOperator: "Stedin", capacity: "4.200 kW", address: "Waalhaven Zuidzijde 8, Rotterdam", activeSince: "1 January 2024", contractUntil: "open-ended", lastChanged: "2 Feb 2026",
      dq: ["F","F","F","F","F","F","F","F","C","F","F","F","F","F"],
      blocks: [
        { trade: "TRD-1042", shape: "Base", period: "Aug 2026", allocated: "0,200 MW", price: "€ 72,4000", volume: "148,80 MWh", status: "Confirmed" },
        { trade: "TRD-1051", shape: "Peak", period: "Q1 2027", allocated: "0,200 MW", price: "€ 94,7500", volume: "153,60 MWh", status: "Confirmed" }
      ] },
    { id: "venlo", name: "Venlo cold store", ean: "8716 8710 0000 0000 27", commodity: "Electricity", status: "Active", statusTone: "success", latestDate: "12 Aug 2026", latestNote: "provisional", volume: "291,7 MWh", coverage: 71,
      description: "Freezer hall + dock 3 compressors", gridOperator: "Enexis", capacity: "2.500 kW", address: "Ceresstraat 14, Venlo", activeSince: "1 January 2024", contractUntil: "open-ended", lastChanged: "14 Mar 2026",
      dq: ["F","F","F","F","F","F","F","F","C","F","P","P","P","N"],
      blocks: [
        { trade: "TRD-1042", shape: "Base", period: "Aug 2026", allocated: "0,300 MW", price: "€ 72,4000", volume: "223,20 MWh", status: "Confirmed" },
        { trade: "TRD-1051", shape: "Peak", period: "Q3 2026", allocated: "0,200 MW", price: "€ 96,1500", volume: "50,40 MWh", status: "Confirmed" },
        { trade: "TRD-1867", shape: "Base (sell)", period: "Aug 2026", allocated: "−0,040 MW", price: "€ 78,2000", volume: "−29,76 MWh", status: "Confirmed", negative: true }
      ] },
    { id: "tilburg", name: "Tilburg plant", ean: "8716 8710 0000 0000 43", commodity: "Electricity", status: "Active", statusTone: "success", latestDate: "12 Aug 2026", latestNote: "provisional", volume: "612,0 MWh", coverage: 83,
      description: "Logistics hub — 2 cold docks", gridOperator: "Enexis", capacity: "3.800 kW", address: "Vossenberg 22, Tilburg", activeSince: "1 January 2024", contractUntil: "open-ended", lastChanged: "2 Feb 2026",
      dq: ["F","F","F","F","F","F","F","F","F","F","F","F","P","P"],
      blocks: [
        { trade: "TRD-1051", shape: "Peak", period: "Q1 2027", allocated: "0,400 MW", price: "€ 94,7500", volume: "307,20 MWh", status: "Confirmed" },
        { trade: "TRD-1867", shape: "Base (sell)", period: "Aug 2026", allocated: "−0,030 MW", price: "€ 78,2000", volume: "−22,32 MWh", status: "Confirmed", negative: true }
      ] },
    { id: "almere", name: "Almere office", ean: "8716 8710 0000 0000 59", commodity: "Electricity", status: "Active", statusTone: "success", latestDate: "10 Aug 2026", latestNote: "no data 2 days", volume: "18,2 MWh", coverage: 0,
      description: "Office + small server room", gridOperator: "Liander", capacity: "800 kW", address: "Hogering 145, Almere", activeSince: "1 January 2024", contractUntil: "open-ended", lastChanged: "—",
      dq: ["F","F","F","F","F","F","F","F","F","F","F","N","N","N"],
      blocks: [
        { trade: "TRD-1051", shape: "Peak", period: "Q1 2027", allocated: "0,100 MW", price: "€ 94,7500", volume: "76,80 MWh", status: "Confirmed" }
      ] },
    { id: "unnamed", name: "— no name set —", ean: "8716 8710 0000 0000 61", commodity: "Electricity", status: "Active", statusTone: "success", latestDate: "12 Aug 2026", latestNote: "", volume: "44,9 MWh", coverage: 35,
      description: "—", gridOperator: "Enexis", capacity: "1.200 kW", address: "—", activeSince: "—", contractUntil: "—", lastChanged: "—",
      dq: ["F","F","F","F","F","F","F","F","F","F","F","F","F","F"],
      blocks: [] },
    { id: "breda", name: "Breda warehouse", ean: "8716 8710 0000 0000 78", commodity: "Electricity", status: "Ending 31 Dec", statusTone: "warning", latestDate: "12 Aug 2026", latestNote: "", volume: "102,3 MWh", coverage: 60,
      description: "Warehouse — ends this year", gridOperator: "Enexis", capacity: "1.600 kW", address: "Konijnenberg 30, Breda", activeSince: "1 January 2024", contractUntil: "31 December 2026", lastChanged: "20 Jan 2026",
      dq: ["F","F","F","F","F","F","F","F","C","F","F","P","P","P"],
      blocks: [ { trade: "TRD-1867", shape: "Base (sell)", period: "Aug 2026", allocated: "−0,020 MW", price: "€ 78,2000", volume: "−14,88 MWh", status: "Confirmed", negative: true } ] },
    { id: "tilburg-gas", name: "Tilburg plant — gas", ean: "8716 8710 0000 0000 92", commodity: "Gas", status: "Not tradeable", statusTone: "neutral", latestDate: "—", latestNote: "", volume: "—", coverage: null, notTradeable: true }
  ];

  // Full EANs are read live from CONNECTIONS by id (customer-portal.html's
  // buildWizardVolumeTable) rather than duplicated here — a second copy is a
  // copy that can drift. consumption/cover used to be static seed strings;
  // both are computed live now (2026-08-18) — consumption was dropped from
  // the picker entirely, cover reads real hedge + confirmed-trade coverage
  // for whichever period is selected. `note` carries only what a bare EAN
  // doesn't already say (e.g. an expiring contract) — see CLAUDE.md,
  // "One shared volume is the total, not per connection".
  var WIZARD_CONNECTIONS = [
    { id: "rot", name: "Rotterdam DC" },
    { id: "venlo", name: "Venlo cold store" },
    { id: "tilburg", name: "Tilburg plant" },
    { id: "almere", name: "Almere office" },
    { id: "breda", name: "Breda warehouse", note: "ends 31 Dec 2026", notEligible: true }
  ];

  var WIZARD_PERIODS = {
    month: [
      { period: "Sep 2026", base: 78.45, peak: 96.15, observed: "14:22", start: "2026-09-01", end: "2026-09-30" },
      { period: "Oct 2026", base: 80.10, peak: 99.40, observed: "14:22", start: "2026-10-01", end: "2026-10-31" },
      { period: "Nov 2026", base: 82.30, peak: 101.80, observed: "14:22", start: "2026-11-01", end: "2026-11-30" },
      { period: "Dec 2026", base: 85.60, peak: 105.20, observed: "14:22", start: "2026-12-01", end: "2026-12-31" },
      { period: "Jan 2027", base: 88.20, peak: 108.90, observed: "14:22", start: "2027-01-01", end: "2027-01-31" },
      { period: "Feb 2027", base: 84.75, peak: 104.30, observed: "14:22", start: "2027-02-01", end: "2027-02-28" }
    ],
    quarter: [
      { period: "Q4 2026", base: 84.20, peak: 103.70, observed: "14:22", start: "2026-10-01", end: "2026-12-31" },
      { period: "Q1 2027", base: 82.75, peak: 94.75, observed: "14:22", start: "2027-01-01", end: "2027-03-31" },
      { period: "Q2 2027", base: 77.40, peak: 90.10, observed: "14:22", start: "2027-04-01", end: "2027-06-30" },
      { period: "Q3 2027", base: 75.90, peak: 88.60, observed: "14:22", start: "2027-07-01", end: "2027-09-30" }
    ],
    // Folded into WIZARD_PERIODS as a third array (was a standalone
    // WIZARD_YEAR object, one row only) so every reader that already does
    // WIZARD_PERIODS[periodType][idx] for month/quarter needs no special
    // case for year — see CLAUDE.md "Three period rows, one selection"
    // for why. Cal 2028's base/peak continue the Q2/Q3-2027 rows' own
    // downward drift rather than being an arbitrary new number.
    year: [
      { period: "Cal 2027", base: 79.90, peak: 98.25, observed: "12:40", start: "2027-01-01", end: "2027-12-31" },
      { period: "Cal 2028", base: 76.80, peak: 91.40, observed: "12:40", start: "2028-01-01", end: "2028-12-31" }
    ]
  };

  var PRICES = [
    { shape: "Base", label: "Next month", period: "Sep 2026", price: 78.45, delta: "+1,25", up: true, observed: "14:22" },
    { shape: "Base", label: "Next quarter", period: "Q4 2026", price: 84.20, delta: "−0,45", up: false, observed: "14:22" },
    { shape: "Base", label: "Next calendar year", period: "Cal 2027", price: 79.90, delta: "+0,35", up: true, observed: "14:22" },
    { shape: "Peak", label: "Next month", period: "Sep 2026", price: 96.15, delta: "+2,10", up: true, observed: "14:22" },
    { shape: "Peak", label: "Next quarter", period: "Q4 2026", price: 103.70, delta: "−1,05", up: false, observed: "14:22" },
    { shape: "Peak", label: "Next calendar year", period: "Cal 2027", price: 98.25, delta: "+0,80", up: true, observed: "12:40", stale: true }
  ];

  var TRADES_SEED = [
    // The demo's showcase pending offer. The structured fields below exist so
    // the Consumption chart can DRAW it as a provisional layer — the display
    // strings above it are for the Trading screen and are not parseable.
    { id: "TRD-1078", shape: "Base", period: "Nov 2026", direction: "Buy",
      periodStart: "2026-11-01", periodEnd: "2026-11-30", powerMw: 0.200, priceMwh: 102.40,
      connections: [{ id: "rot", name: "Rotterdam DC", sub: "…0011", powerMw: 0.200 }], power: "0,200 MW", volume: "144,00 MWh", price: "€ 102,4000", value: "€ 14.745,60", status: "Awaiting your response", statusTone: "warning", pending: true,
      expiresLabel: "15:01", secondsRemaining: 1487, secondsTotal: 1800,
      events: [
        { title: "Request submitted", actor: "J. de Vries · Admin (you)", ts: "12 Aug 2026, 09:10:00", body: "Base Nov-2026 · 0,200 MW indicative request.", tone: "submit" },
        { title: "Offer published", actor: "PeakPower Trading", ts: "12 Aug 2026, 09:14:00", body: "Price € 102,4000/MWh · total € 14.745,60 · reaction window 30 minutes, expiring 15:01:00. All 3 active accounts notified.", tone: "indigo" }
      ],
      facts: [["Reference","TRD-1078"],["Requested by","J. de Vries"],["State","Awaiting your response"],["Direction","Buy"],["Shape","Base"],["Delivery period","Nov 2026"],["Total power","0,200 MW"],["Total volume","144,00 MWh"],["Offered price","€ 102,4000 / MWh"]] },
    { id: "TRD-1072", shape: "Base", period: "Oct 2026", direction: "Buy", power: "0,120 MW", volume: "89,28 MWh", price: "€ 96,8000", value: "€ 8.642,30", status: "Reserved · executing", statusTone: "warning",
      events: [
        { title: "Request submitted", actor: "P. Aksoy · Procurement", ts: "13 Aug 2026, 09:58:00", body: "Base Oct-2026 · 0,120 MW.", tone: "submit" },
        { title: "Offer published", actor: "PeakPower Trading", ts: "13 Aug 2026, 10:04:00", body: "Price € 96,8000/MWh · total € 8.642,30 · reaction window 30 minutes.", tone: "indigo" },
        { title: "Offer accepted", actor: "P. Aksoy · Procurement", ts: "13 Aug 2026, 10:15:00", body: "€ 9.400,00 reserved on the company wallet. Awaiting execution confirmation.", tone: "amber" }
      ],
      facts: [["Reference","TRD-1072"],["Requested by","P. Aksoy"],["Accepted by","P. Aksoy"],["State","Reserved · executing"],["Direction","Buy"],["Shape","Base"],["Delivery period","Oct 2026"],["Total power","0,120 MW"],["Total volume","89,28 MWh"],["Agreed price","€ 96,8000 / MWh"]] },
    { id: "TRD-1051", shape: "Peak", period: "Q1 2027", direction: "Buy", power: "1,000 MW", volume: "768,00 MWh", price: "€ 94,7500", value: "€ 72.768,00", status: "Confirmed", statusTone: "success",
      events: [
        { title: "Request submitted", actor: "J. de Vries · Admin (you)", ts: "30 Jul 2026, 14:25:02", body: 'Peak Q1-2027 · 1,000 MW across 4 connections. Comment: "Hedging Q1 baseload growth." Indication at submission: € 96,1500/MWh.', tone: "submit" },
        { title: "Offer published", actor: "PeakPower Trading", ts: "30 Jul 2026, 14:31:00", body: "Price € 94,7500/MWh · total € 72.768,00 · reaction window 30 minutes, expiring 15:01:00. All 3 active accounts notified.", tone: "indigo" },
        { title: "Offer accepted", actor: "M. Vandersteen · Finance Director", ts: "30 Jul 2026, 14:44:18", body: "€ 72.768,00 reserved on the company wallet. Reservation RES-0912. Accepted by a different colleague than the requester.", tone: "amber" },
        { title: "Trade confirmed", actor: "PeakPower Trading", ts: "30 Jul 2026, 14:52:41", body: "Executed on the market, reference ICE-88213-A. Reservation settled — wallet debited € 72.768,00. Block BLK-0431 created with 4 allocations.", tone: "green" }
      ],
      facts: [["Reference","TRD-1051"],["Requested by","J. de Vries"],["Accepted by","M. Vandersteen"],["State","Confirmed"],["Direction","Buy"],["Shape","Peak"],["Delivery period","Q1 2027"],["Peak calendar","NL-POWER-PEAK v2027.1"],["Total power","1,000 MW"],["Total volume","768,00 MWh"],["Agreed price","€ 94,7500 / MWh"]],
      linked: [
        { label: "Block", value: "BLK-0431", note: "now visible on your charts" },
        { label: "Reservation", value: "RES-0912", note: "settled 30 Jul 14:52" },
        { label: "Ledger entry #4471", value: "Funds reserved", note: "− € 72.768,00 available" },
        { label: "Ledger entry #4472", value: "Trade settled", note: "− € 72.768,00 settled" },
        { label: "Settlement", value: "from Jan 2027", note: "block energy lines" }
      ] },
    { id: "TRD-1042", shape: "Base", period: "Aug 2026", direction: "Buy", power: "1,000 MW", volume: "744,00 MWh", price: "€ 72,4000", value: "€ 53.865,60", status: "Confirmed", statusTone: "success",
      events: [
        { title: "Request submitted", actor: "J. de Vries · Admin (you)", ts: "28 Jul 2026, 11:02:00", body: "Base Aug-2026 · 1,000 MW across 4 connections.", tone: "submit" },
        { title: "Offer published", actor: "PeakPower Trading", ts: "28 Jul 2026, 11:09:00", body: "Price € 72,4000/MWh · total € 53.865,60.", tone: "indigo" },
        { title: "Trade confirmed", actor: "PeakPower Trading", ts: "28 Jul 2026, 11:20:00", body: "Executed on the market. Block BLK-0409 created with 4 allocations.", tone: "green" }
      ],
      facts: [["Reference","TRD-1042"],["Requested by","J. de Vries"],["State","Confirmed"],["Direction","Buy"],["Shape","Base"],["Delivery period","Aug 2026"],["Total power","1,000 MW"],["Total volume","744,00 MWh"],["Agreed price","€ 72,4000 / MWh"]],
      linked: [ { label: "Block", value: "BLK-0409", note: "now visible on your charts" } ] },
    { id: "TRD-1867", shape: "Base (sell)", period: "Aug 2026", direction: "Sell", power: "−0,090 MW", volume: "−67,00 MWh", price: "€ 78,2000", value: "€ 5.239,40", status: "Confirmed", statusTone: "success",
      events: [
        { title: "Request submitted", actor: "J. de Vries · Admin (you)", ts: "27 Jul 2026, 08:40:00", body: "Base (sell) Aug-2026 · surplus volume above measured consumption.", tone: "submit" },
        { title: "Trade confirmed", actor: "PeakPower Trading", ts: "27 Jul 2026, 08:55:00", body: "Executed on the market at € 78,2000/MWh. Wallet credited € 5.239,40.", tone: "green" }
      ],
      facts: [["Reference","TRD-1867"],["Requested by","J. de Vries"],["State","Confirmed"],["Direction","Sell"],["Shape","Base"],["Delivery period","Aug 2026"],["Total power","−0,090 MW"],["Total volume","−67,00 MWh"],["Agreed price","€ 78,2000 / MWh"]] },
    { id: "TRD-1048", shape: "Peak", period: "Sep 2026", direction: "Buy", power: "0,050 MW", volume: "13,20 MWh", price: null, value: null, status: "Failed", statusTone: "critical",
      events: [
        { title: "Request submitted", actor: "J. de Vries · Admin (you)", ts: "05 Aug 2026, 15:20:00", body: "Peak Sep-2026 · 0,050 MW.", tone: "submit" },
        { title: "Offer published", actor: "PeakPower Trading", ts: "05 Aug 2026, 15:26:00", body: "Price € 105,0000/MWh · total € 1.386,00.", tone: "indigo" },
        { title: "Offer accepted", actor: "J. de Vries · Admin (you)", ts: "05 Aug 2026, 15:40:00", body: "€ 4.420,00 reserved on the company wallet.", tone: "amber" },
        { title: "Trade failed", actor: "PeakPower Trading", ts: "05 Aug 2026, 16:03:00", body: "Counterparty withdrew before execution. Full reservation released — € 4.420,00 back to available balance.", tone: "red" }
      ],
      facts: [["Reference","TRD-1048"],["Requested by","J. de Vries"],["State","Failed"],["Direction","Buy"],["Shape","Peak"],["Delivery period","Sep 2026"],["Total power","0,050 MW"],["Total volume","13,20 MWh"]] }
  ];

  var WALLET_LEDGER = [
    { date: "13-08 10:15", type: "Funds reserved", tone: "warning", desc: "Base Oct-26 · 0,12 MW", by: "P. Aksoy", byNote: "", ref: "TRD-1072", refKind: "trade", debit: "€ 9.400,00", credit: "", after: "€ 19.722,00" },
    { date: "12-08 09:14", type: "Deposit (iDEAL)", tone: "success", desc: "Deposit via iDEAL", by: "J. de Vries", byNote: "", ref: "PAY-2291", refKind: "none", debit: "", credit: "€ 25.000,00", after: "€ 29.122,00" },
    { date: "05-08 16:03", type: "Reservation released", tone: "info", desc: "TRD-1048 failed — counterparty withdrew", by: "M. Bakker", byNote: "PeakPower", ref: "TRD-1048", refKind: "trade", debit: "", credit: "€ 3.900,00", after: "€ 4.122,00" },
    { date: "05-08 15:22", type: "Funds reserved", tone: "warning", desc: "Base Sep-26 · 0,05 MW", by: "J. de Vries", byNote: "", ref: "TRD-1048", refKind: "trade", debit: "€ 3.900,00", credit: "", after: "€ 222,00" },
    { date: "01-08 00:04", type: "Settlement", tone: "neutral", desc: "July 2026 · 6 connections", by: "System", byNote: "automatic", ref: "STL-2026-07-0042", refKind: "settlement", debit: "€ 18.110,00", credit: "", after: "€ 4.122,00" },
    { date: "30-07 14:52", type: "Trade confirmed", tone: "success", desc: "Peak Q1-27 · reservation settled", by: "M. Bakker", byNote: "PeakPower", ref: "TRD-1051", refKind: "trade", debit: "€ 72.768,00", credit: "€ 72.768,00", after: "€ 22.232,00" },
    { date: "30-07 14:44", type: "Funds reserved", tone: "warning", desc: "Peak Q1-27 · 1,0 MW", by: "M. Vandersteen", byNote: "", ref: "TRD-1051", refKind: "trade", debit: "€ 72.768,00", credit: "", after: "€ 22.232,00" },
    { date: "28-07 11:20", type: "Trade confirmed", tone: "success", desc: "Base Aug-26 · reservation settled", by: "J. de Vries", byNote: "", ref: "TRD-1042", refKind: "trade", debit: "€ 53.865,60", credit: "€ 53.865,60", after: "€ 95.000,00" },
    { date: "28-07 11:09", type: "Funds reserved", tone: "warning", desc: "Base Aug-26 · 1,0 MW", by: "J. de Vries", byNote: "", ref: "TRD-1042", refKind: "trade", debit: "€ 53.865,60", credit: "", after: "€ 95.000,00" },
    { date: "28-07 08:30", type: "Deposit (bank)", tone: "success", desc: "Transfer · ref PP-4821-QK", by: "S. Willems", byNote: "PeakPower", ref: "DEP-0118", refKind: "none", debit: "", credit: "€ 76.500,00", after: "€ 148.865,60" },
    { date: "27-07 08:55", type: "Trade confirmed", tone: "success", desc: "Base (sell) Aug-26 · surplus sold", by: "J. de Vries", byNote: "", ref: "TRD-1867", refKind: "trade", debit: "", credit: "€ 5.239,40", after: "€ 72.365,60" },
    { date: "24-07 16:11", type: "Adjustment", tone: "info", desc: "Correction — duplicate deposit reversed", by: "S. Willems", byNote: "PeakPower", ref: "ADJ-0031", refKind: "none", debit: "€ 1.500,00", credit: "", after: "€ 67.126,20" }
  ];
  var TOPUPS = [
    { date: "12 Aug 2026, 09:14", method: "iDEAL · ING", ref: "PAY-2291", status: "Succeeded", amount: "€ 25.000,00" },
    { date: "28 Jul 2026, 08:30", method: "Bank transfer", ref: "DEP-0118", status: "Credited", amount: "€ 40.000,00" }
  ];

  var SETTLEMENT_LINES_AUG = [
    { n: "1", desc: "Base block Aug-26", sub: "block energy at the agreed price", ref: "TRD-1042", volume: "297,60 MWh", unitPrice: "€ 72,4000", amount: "€ 21.546,24" },
    { n: "2", desc: "Peak block Q3-26 — August portion", sub: "block energy at the agreed price", ref: "TRD-1051", volume: "50,40 MWh", unitPrice: "€ 96,1500", amount: "€ 4.845,96" },
    { n: "3", desc: "Day-ahead purchase — uncovered volume", sub: "volume-weighted average price", ref: "intervals", volume: "84,12 MWh", unitPrice: "€ 91,2400", amount: "€ 7.675,11" },
    { n: "4", desc: "Day-ahead sale — surplus volume", sub: "block volume above consumption", ref: "intervals", volume: "−46,70 MWh", unitPrice: "€ 38,9100", amount: "− € 1.817,10", green: true },
    { n: "5", desc: "Imbalance — pro-rata allocation", sub: "portfolio imbalance allocated on consumption", ref: "PVNed", volume: "—", unitPrice: "—", amount: "€ 412,88" },
    { n: "6", desc: "Surcharge", sub: "contractual adder, valid from 1 Jan 2026", ref: "SUR-0007", volume: "385,42 MWh", unitPrice: "€ 4,5000", amount: "€ 1.734,39" },
    { n: "7", desc: "Energiebelasting — tier 3", sub: "cumulative year-to-date basis · tariff 2026 v1", ref: "tariff 2026", volume: "385.420 kWh", unitPrice: "tier rate", amount: "€ 0,00", faint: true }
  ];
  var SETTLEMENT_LINES_JUL = [
    { n: "1", desc: "Base block Jul-26", sub: "block energy at the agreed price", ref: "TRD-1042", volume: "138,00 MWh", unitPrice: "€ 69,8000", amount: "€ 9.632,40" },
    { n: "2", desc: "Peak block Q3-26 — July portion", sub: "block energy at the agreed price", ref: "TRD-1051", volume: "24,00 MWh", unitPrice: "€ 93,2000", amount: "€ 2.236,80" },
    { n: "3", desc: "Day-ahead purchase — uncovered volume", sub: "volume-weighted average price", ref: "intervals", volume: "22,60 MWh", unitPrice: "€ 88,9000", amount: "€ 2.009,14" },
    { n: "4", desc: "Day-ahead sale — surplus volume", sub: "block volume above consumption", ref: "intervals", volume: "−5,00 MWh", unitPrice: "€ 36,4000", amount: "− € 182,00", green: true }
  ];
  var SETTLEMENT_LINES_JUN = [
    { n: "1", desc: "Base block Jun-26", sub: "block energy at the agreed price", ref: "TRD-1042", volume: "132,00 MWh", unitPrice: "€ 68,4000", amount: "€ 9.028,80" },
    { n: "2", desc: "Peak block Q2-26 — June portion", sub: "block energy at the agreed price", ref: "TRD-1051", volume: "26,00 MWh", unitPrice: "€ 91,0000", amount: "€ 2.366,00" },
    { n: "3", desc: "Day-ahead purchase — uncovered volume", sub: "volume-weighted average price", ref: "intervals", volume: "21,30 MWh", unitPrice: "€ 85,6000", amount: "€ 1.823,28" },
    { n: "4", desc: "Day-ahead sale — surplus volume", sub: "block volume above consumption", ref: "intervals", volume: "−4,00 MWh", unitPrice: "€ 35,1000", amount: "− € 140,40", green: true }
  ];
  var SETTLEMENT_LINES_MAY = [
    { n: "1", desc: "Base block May-26", sub: "block energy at the agreed price", ref: "TRD-1042", volume: "126,00 MWh", unitPrice: "€ 66,9000", amount: "€ 8.429,40" },
    { n: "2", desc: "Peak block Q2-26 — May portion", sub: "block energy at the agreed price", ref: "TRD-1051", volume: "22,00 MWh", unitPrice: "€ 89,4000", amount: "€ 1.966,80" },
    { n: "3", desc: "Day-ahead purchase — uncovered volume", sub: "volume-weighted average price", ref: "intervals", volume: "22,00 MWh", unitPrice: "€ 83,2000", amount: "€ 1.830,40" },
    { n: "4", desc: "Day-ahead sale — surplus volume", sub: "block volume above consumption", ref: "intervals", volume: "−3,00 MWh", unitPrice: "€ 34,2000", amount: "− € 102,60", green: true }
  ];
  var SETTLEMENTS = [
    { id: "STL-2026-08-0042", period: "August 2026", total: "€ 41.620,95", volume: "1.291,4 MWh", connectionsCount: 6, coverage: "78,4 %", settledDate: "7 Sep 2026", settledNote: "wallet debit · ledger #4488",
      provisionalNote: "4 of 31 delivery dates were still provisional when this settlement was calculated. Any correction is settled in the January annual true-up.",
      sectionTitle: "Rotterdam DC — EAN 8716 8710 0000 0000 11", sectionSubtitle: "Section 1 of 6 · measured consumption 385,42 MWh",
      lines: SETTLEMENT_LINES_AUG, volumeCheck: "297,60 + 50,40 + 84,12 − 46,70 = 385,42 MWh — reconciles to measured consumption", subtotal: "€ 34.397,48" },
    { id: "STL-2026-07-0042", period: "July 2026", total: "€ 18.110,00", volume: "602,8 MWh", connectionsCount: 6, coverage: "74,2 %", settledDate: "1 Aug 2026", settledNote: "wallet debit",
      sectionTitle: "Rotterdam DC — EAN 8716 8710 0000 0000 11", sectionSubtitle: "Section 1 of 6 · measured consumption 179,60 MWh",
      lines: SETTLEMENT_LINES_JUL, volumeCheck: "138,00 + 24,00 + 22,60 − 5,00 = 179,60 MWh — reconciles to measured consumption", subtotal: "€ 13.696,34" },
    { id: "STL-2026-06-0042", period: "June 2026", total: "€ 22.480,50", volume: "588,1 MWh", connectionsCount: 6, coverage: "71,8 %", settledDate: "1 Jul 2026", settledNote: "wallet debit",
      sectionTitle: "Rotterdam DC — EAN 8716 8710 0000 0000 11", sectionSubtitle: "Section 1 of 6 · measured consumption 175,30 MWh",
      lines: SETTLEMENT_LINES_JUN, volumeCheck: "132,00 + 26,00 + 21,30 − 4,00 = 175,30 MWh — reconciles to measured consumption", subtotal: "€ 13.077,68" },
    { id: "STL-2026-05-0042", period: "May 2026", total: "€ 19.905,10", volume: "560,4 MWh", connectionsCount: 5, coverage: "69,5 %", settledDate: "1 Jun 2026", settledNote: "wallet debit",
      sectionTitle: "Rotterdam DC — EAN 8716 8710 0000 0000 11", sectionSubtitle: "Section 1 of 6 · measured consumption 167,00 MWh",
      lines: SETTLEMENT_LINES_MAY, volumeCheck: "126,00 + 22,00 + 22,00 − 3,00 = 167,00 MWh — reconciles to measured consumption", subtotal: "€ 12.124,00" }
  ];

  var WALLET_AVAILABLE_BALANCE = 19722.00;

  var DASHBOARD_PRICE_TILES = [
    ["Base — Sep 26", "€ 78,45", "+1,25", true], ["Peak — Sep 26", "€ 96,15", "+2,10", true],
    ["Base — Q4 26", "€ 84,20", "−0,45", false], ["Peak — Q4 26", "€ 103,70", "−1,05", false],
    ["Base — Cal 27", "€ 79,90", "+0,35", true], ["Peak — Cal 27", "€ 98,25", "+0,80", true]
  ];
  var DASHBOARD_RECENT_ACTIVITY = [
    ["Funds reserved", "€ 9.400,00 · TRD-1072 · Base Oct-26", "13 Aug 10:15", "indigo"],
    ["Wallet deposit", "€ 25.000,00 via iDEAL", "12 Aug 09:14", "green"],
    ["Trade failed", "TRD-1048 · counterparty withdrew", "05 Aug 16:03", "red"],
    ["Settlement issued", "STL-2026-07-0042 · € 18.110,00", "01 Aug 00:04", "faint"]
  ];

  var BANK_DETAILS = {
    accountHolder: "PeakPower Trading B.V.",
    iban: "NL18 INGB 0007 2519 44",
    bic: "INGBNL2A",
    reference: "PP-4821-QK"
  };

  /** Dutch-locale currency formatting: "€ 12.345,67" (negative: "− € ...") */
  function formatEUR(value) {
    var sign = value < 0 ? "− " : "";
    var abs = Math.abs(value);
    var fixed = abs.toFixed(2);
    var pieces = fixed.split(".");
    var intPart = pieces[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + "€ " + intPart + "," + pieces[1];
  }

  /**
   * Builds the ledger row + top-up-history row + updated balances for a
   * wallet top-up of `amount`, mirroring the mockup's performTopup()
   * transition. Pure function (no DOM/state mutation) so it stays testable.
   */
  function simulateTopup(amount, currentAvailable, currentSettled, now, existingTopupCount) {
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var ledgerDate = pad(now.getDate()) + "-" + pad(now.getMonth() + 1) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
    var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var topupDate = now.getDate() + " " + monthNames[now.getMonth()] + " " + now.getFullYear() + ", " + pad(now.getHours()) + ":" + pad(now.getMinutes());
    var ref = "PAY-" + (2292 + existingTopupCount);
    var newAvailable = currentAvailable + amount;
    var newSettled = currentSettled + amount;
    return {
      newAvailable: newAvailable,
      newSettled: newSettled,
      ledgerEntry: {
        date: ledgerDate, type: "Deposit (iDEAL)", tone: "success", desc: "Deposit via iDEAL",
        by: "J. de Vries", byNote: "", ref: ref, refKind: "none", debit: "", credit: formatEUR(amount), after: formatEUR(newAvailable)
      },
      topupEntry: { date: topupDate, method: "iDEAL · ING", ref: ref, status: "Succeeded", amount: formatEUR(amount) }
    };
  }

  var api = {
    NAV: NAV,
    USER_LINE: USER_LINE,
    CUSTOMER_NAME: CUSTOMER_NAME,
    CUSTOMER_ID: CUSTOMER_ID,
    TONE_COLOR: TONE_COLOR,
    CONNECTIONS: CONNECTIONS,
    WIZARD_CONNECTIONS: WIZARD_CONNECTIONS,
    WIZARD_PERIODS: WIZARD_PERIODS,
    PRICES: PRICES,
    TRADES_SEED: TRADES_SEED,
    WALLET_LEDGER: WALLET_LEDGER,
    TOPUPS: TOPUPS,
    SETTLEMENTS: SETTLEMENTS,
    WALLET_AVAILABLE_BALANCE: WALLET_AVAILABLE_BALANCE,
    DASHBOARD_PRICE_TILES: DASHBOARD_PRICE_TILES,
    DASHBOARD_RECENT_ACTIVITY: DASHBOARD_RECENT_ACTIVITY,
    BANK_DETAILS: BANK_DETAILS,
    formatEUR: formatEUR,
    simulateTopup: simulateTopup
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.PortalSeedData = api;
  }
})(typeof window !== "undefined" ? window : this);
