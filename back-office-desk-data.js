/*
 * Seed data + queue assembly for the Back Office Trade desk (Live Data) page.
 *
 * TRADES and QUEUE_META are a verbatim port of Back Office Portal - Preview.html's
 * own bundled demo data (that file stays a pure design reference and is never
 * hand-edited). buildQueues() is the one piece of real logic: it merges live
 * trade requests published by the Customer Portal into the seeded columns.
 *
 * Dual Node/browser module, same pattern as the other JS files here.
 */
(function (root) {
  "use strict";

  var NAV = ["Home", "Trade desk", "Customers", "Wallets", "Settlements", "Data & feeds", "Reference data", "Audit"];
  var USER_LINE = "M. Bakker · Trading";

  var TRADES = [
    { id: "TRD-1058", column: "toPrice", urgent: false, tag: "6 min", tagTone: "warning", customer: "Van Dijk Glastuinbouw", shape: "Base", period: "Cal-27", power: "2,000 MW", valueLabel: "17.520 MWh", meta: "Base · Cal-27 · 2,000 MW", actionLabel: "open to price →" },
    { id: "TRD-1057", column: "toPrice", urgent: false, tag: "14 min", tagTone: "warning", customer: "Kramer Logistics", shape: "Peak", period: "Q4-26", power: "0,500 MW", valueLabel: "396 MWh", meta: "Peak · Q4-26 · 0,500 MW", actionLabel: "open to price →" },
    { id: "TRD-1056", column: "toPrice", urgent: true, tag: "31 min", tagTone: "critical", customer: "Meijer Koelhuizen", shape: "Base", period: "Sep-26", power: "0,250 MW", valueLabel: "180 MWh", meta: "Base · Sep-26 · 0,250 MW", actionLabel: "open to price →" },
    { id: "TRD-1051", column: "awaiting", urgent: true, tag: "04:12", tagTone: "critical", customer: "Vandersteen Koeling", shape: "Peak", period: "Q1-27", power: "1,000 MW", valueLabel: "€ 72.768", meta: "Peak · Q1-27 · 1,000 MW", actionLabel: "view offer →" },
    { id: "TRD-1053", column: "awaiting", urgent: false, tag: "11:48", tagTone: "warning", customer: "Hoekstra Staal", shape: "Base", period: "Q4-26", power: "0,750 MW", valueLabel: "€ 61.220", meta: "Base · Q4-26 · 0,750 MW", actionLabel: "view offer →" },
    { id: "TRD-1054", column: "awaiting", urgent: false, tag: "19:05", tagTone: "neutral", customer: "De Groot Papier", shape: "Peak", period: "Nov-26", power: "0,300 MW", valueLabel: "€ 22.150", meta: "Peak · Nov-26 · 0,300 MW", actionLabel: "view offer →" },
    { id: "TRD-1055", column: "awaiting", urgent: false, tag: "24:33", tagTone: "neutral", customer: "Nolte Chemie", shape: "Base", period: "Cal-27", power: "1,500 MW", valueLabel: "€ 21.045", meta: "Base · Cal-27 · 1,500 MW", actionLabel: "view offer →" },
    { id: "TRD-1050", column: "awaiting", urgent: false, tag: "27:51", tagTone: "neutral", customer: "Bosman Tuinbouw", shape: "Peak", period: "Dec-26", power: "0,100 MW", valueLabel: "€ 7.117", meta: "Peak · Dec-26 · 0,100 MW", actionLabel: "view offer →" },
    { id: "TRD-1049", column: "confirm", urgent: true, tag: "22 min", tagTone: "critical", customer: "Kramer Logistics", shape: "Base", period: "Q4-26", power: "0,500 MW", valueLabel: "€ 41.200", meta: "Base · Q4-26 · 0,500 MW", actionLabel: "confirm or fail →" },
    { id: "TRD-1052", column: "confirm", urgent: false, tag: "8 min", tagTone: "warning", customer: "Hoekstra Staal", shape: "Peak", period: "Sep-26", power: "0,800 MW", valueLabel: "€ 72.768", meta: "Peak · Sep-26 · 0,800 MW", actionLabel: "confirm or fail →" }
  ];

  var QUEUE_ORDER = ["toPrice", "awaiting", "confirm"];
  var QUEUE_META = {
    toPrice: { title: "To price", badgeTone: "warning" },
    awaiting: { title: "Awaiting customer", badgeTone: "info" },
    confirm: { title: "To confirm", badgeTone: "critical" }
  };

  var TAG_STYLE = {
    critical: { bg: "var(--pp-red-bg)", border: "var(--pp-red-border)", color: "var(--pp-red-text)" },
    warning: { bg: "var(--pp-amber-bg)", border: "var(--pp-amber-border)", color: "var(--pp-amber-text)" },
    neutral: { bg: "#ffffff", border: "var(--pp-border-strong)", color: "var(--pp-text-body)" }
  };

  /**
   * Per-seeded-trade detail (timeline, actions, wait label, summary rows) —
   * a verbatim port of the mockup's own tradeDetail(t), decoded from
   * scratchpad/bo-src/script.js. Only ever called for a SEEDED row (no live
   * `request` behind it) — a live linked request renders its own real detail
   * (connection table, pricing form, facts panel) in back-office-portal.html
   * and must never be replaced by this static version.
   */
  function tradeDetail(t) {
    var queueLabel = QUEUE_META[t.column].title;
    var statusTone = t.column === "confirm" ? "critical" : (t.column === "toPrice" ? "warning" : "brand");
    var timeline, actions, waitLabel;
    if (t.column === "toPrice") {
      waitLabel = "Time in queue";
      timeline = [
        { title: "Request received", subtitle: "From " + t.customer, tone: "info" },
        { title: "Awaiting pricing", subtitle: "In queue " + t.tag, tone: "warning" }
      ];
      actions = [{ label: "Send offer", variant: "primary" }, { label: "Decline request", variant: "secondary" }];
    } else if (t.column === "awaiting") {
      waitLabel = "Expires in";
      timeline = [
        { title: "Request received", subtitle: "From " + t.customer, tone: "info" },
        { title: "Priced by M. Bakker", subtitle: t.meta, tone: "info" },
        { title: "Offer sent to customer", subtitle: "Expires in " + t.tag, tone: "warning" }
      ];
      actions = [{ label: "Extend deadline", variant: "secondary" }, { label: "Withdraw offer", variant: "danger" }];
    } else {
      waitLabel = "Accepted, waiting";
      timeline = [
        { title: "Request received", subtitle: "From " + t.customer, tone: "info" },
        { title: "Priced by M. Bakker", subtitle: t.meta, tone: "info" },
        { title: "Offer sent to customer", tone: "info" },
        { title: "Customer accepted", subtitle: "Wallet reservation created", tone: "success" },
        { title: "Awaiting confirmation", subtitle: "Waiting " + t.tag, tone: "critical" }
      ];
      actions = [{ label: "Confirm trade", variant: "primary" }, { label: "Mark failed", variant: "danger" }];
    }
    var summaryRows = [
      { label: "Customer", value: t.customer },
      { label: "Product", value: t.shape + " · " + t.period },
      { label: "Contracted power", value: t.power },
      { label: "Value", value: t.valueLabel },
      { label: waitLabel, value: t.tag }
    ].map(function (r, i) { return { label: r.label, value: r.value, borderTop: i === 0 ? "none" : "1px solid var(--pp-border)" }; });
    return {
      id: t.id, statusValue: queueLabel, statusTone: statusTone, productValue: t.shape + " · " + t.period,
      power: t.power, valueLabel: t.valueLabel, summaryRows: summaryRows, timeline: timeline, actions: actions
    };
  }

  /**
   * TRD-1058's full "rich" detail — a verbatim port of the mockup's
   * TRD_1058_RICH constant, the one seeded row the mockup gives real
   * connection/market/wallet/chart detail rather than the compact
   * tradeDetail() view (see the mockup's own isRichDetail branch).
   */
  var BAR_HEIGHTS = [51.4, 53, 55, 55.7, 57.4, 58.3, 55.4, 57.8, 54.7, 58.1, 53.8, 54.2, 51.1, 53.8, 49.9, 49, 48.2, 49.9, 47.5, 46.3, 48.5, 49.2, 59.5, 63.6, 66, 67.9, 73.7, 73.7, 75.8, 81.4, 88.8, 90.5, 93.4, 93.6, 93.8, 101.8, 98.9, 98.6, 105.4, 109.9, 103.9, 110.2, 111.1, 114.5, 119.8, 113.5, 115.9, 120.5, 108.7, 113.8, 112.8, 116.4, 112.8, 116.2, 114.5, 112.3, 117.4, 115.7, 111.4, 113.8, 110.6, 116.9, 111.1, 109.7, 118.3, 113, 118.3, 109.2, 108.5, 113.3, 110.6, 114.5, 111.4, 109, 104.6, 103.9, 97.2, 95.8, 84.7, 87.4, 79.2, 74.6, 61.4, 64.3, 64.3, 59.5, 61.4, 60.2, 57.1, 56.9, 58.6, 60.2, 54.7, 59.3, 56.4, 57.6];

  function buildChart() {
    var gridLines = [
      { y: 416, ly: 420, label: "700", stroke: "var(--pp-border)" },
      { y: 458, ly: 462, label: "525", stroke: "var(--pp-border)" },
      { y: 500, ly: 504, label: "350", stroke: "var(--pp-border)" },
      { y: 542, ly: 546, label: "175", stroke: "var(--pp-border)" },
      { y: 584, ly: 588, label: "0", stroke: "var(--pp-border-strong)" }
    ];
    var xLabels = [
      { x: 308, anchor: "start", label: "00" }, { x: 408.7, anchor: "middle", label: "04" }, { x: 509.3, anchor: "middle", label: "08" },
      { x: 610, anchor: "middle", label: "12" }, { x: 710.7, anchor: "middle", label: "16" }, { x: 811.3, anchor: "middle", label: "20" }, { x: 912, anchor: "end", label: "24" }
    ];
    var n = BAR_HEIGHTS.length, x0 = 308, x1 = 912, step = (x1 - x0) / (n - 1), w = step * 0.95, bottom = 560;
    var chartBars = BAR_HEIGHTS.map(function (h, i) {
      return { x: (x0 + i * step).toFixed(1), y: (bottom - h).toFixed(1), w: w.toFixed(1), h: h.toFixed(1) };
    });
    return { gridLines: gridLines, xLabels: xLabels, chartBars: chartBars };
  }

  function withBorderTop(rows) {
    return rows.map(function (r, i) {
      var out = {};
      for (var k in r) { out[k] = r[k]; }
      out.borderTop = i === 0 ? "none" : "1px solid var(--pp-border)";
      return out;
    });
  }

  var TRD_1058_RICH = (function () {
    var rich = {
      requestSubtitle: "Buy · Base · Cal 2027 · submitted by K. van Dijk",
      requestedBy: "K. van Dijk · Energy Manager · +31 77 396 2210",
      customerName: "Van Dijk Glastuinbouw",
      totalRequested: "2,000 MW · 17.520,00 MWh",
      customerNote: "Customer note: “Locking in most of next year before the winter curve moves.”",
      connRows: [
        { name: "Kas Noord 1", ean: "…0114", forecast: "6.820 MWh", cover: "0,20 MW", coverColor: "var(--pp-text-heading)", requested: "0,800" },
        { name: "Kas Noord 2", ean: "…0122", forecast: "5.410 MWh", cover: "0,20 MW", coverColor: "var(--pp-text-heading)", requested: "0,700" },
        { name: "WKK-installatie", ean: "…0139", forecast: "4.180 MWh", cover: "—", coverColor: "var(--pp-text-faint)", requested: "0,500" }
      ],
      marketRows: withBorderTop([
        { label: "Indication at submission (14:22)", value: "€ 79,9000", color: "var(--pp-text-heading)" },
        { label: "Indication now (14:28)", value: "€ 80,1500", color: "var(--pp-amber)" },
        { label: "Cal-27 base, 30-day range", value: "€ 76,20 – € 82,40", color: "var(--pp-text-heading)" },
        { label: "Last traded with this customer", value: "€ 78,4000 (12 Jun)", color: "var(--pp-text-heading)" }
      ]),
      walletRows: withBorderTop([
        { label: "Settled balance", value: "€ 1.650.000,00", weight: 600 },
        { label: "Reserved", value: "€ 0,00", weight: 600 },
        { label: "Available", value: "€ 1.650.000,00", weight: 700 }
      ]),
      walletBadge: "SUFFICIENT FOR ~ € 1,65 M",
      offerPrice: "80,4500", offerValue: "€ 1.409.484,00", offerExpiry: "expires 14:58 · spread vs. indication + € 0,30"
    };
    var chart = buildChart();
    rich.gridLines = chart.gridLines;
    rich.xLabels = chart.xLabels;
    rich.chartBars = chart.chartBars;
    return rich;
  })();

  /** The mockup's own per-queue subtitles, recomputed from the live counts. */
  function queueSubtitle(key, n) {
    if (key === "toPrice") { return n + (n === 1 ? " request" : " requests"); }
    if (key === "awaiting") { return n + (n === 1 ? " offer" : " offers") + " counting down"; }
    return n + " accepted, awaiting execution";
  }

  /**
   * Merges live Customer Portal requests into the seeded desk columns.
   *
   * `liveCards` are PortalTradeLink.toDeskCard() results. Each one lands in
   * whichever column it declares — "To price" while unpriced, "Awaiting
   * customer" once the desk has priced it — and sits at the TOP of that
   * column (newest first) so recent activity is the first thing the desk sees.
   * A live card whose id already exists in the seed data replaces it, so
   * re-publishing can never double up a row.
   */
  function buildQueues(liveCards, seed) {
    var live = (liveCards || []).slice().reverse(); // newest first
    var liveIds = {};
    live.forEach(function (c) { liveIds[c.id] = true; });

    var base = (seed || TRADES).filter(function (t) { return !liveIds[t.id]; });

    return QUEUE_ORDER.map(function (key) {
      var seeded = base.filter(function (t) { return t.column === key; });
      var trades = live.filter(function (c) { return c.column === key; }).concat(seeded);
      return {
        key: key,
        title: QUEUE_META[key].title,
        badgeTone: QUEUE_META[key].badgeTone,
        subtitle: queueSubtitle(key, trades.length),
        countLabel: String(trades.length),
        trades: trades
      };
    });
  }

  var api = {
    NAV: NAV,
    USER_LINE: USER_LINE,
    TRADES: TRADES,
    QUEUE_ORDER: QUEUE_ORDER,
    QUEUE_META: QUEUE_META,
    TAG_STYLE: TAG_STYLE,
    tradeDetail: tradeDetail,
    TRD_1058_RICH: TRD_1058_RICH,
    queueSubtitle: queueSubtitle,
    buildQueues: buildQueues
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackOfficeDeskData = api;
  }
})(typeof window !== "undefined" ? window : this);
