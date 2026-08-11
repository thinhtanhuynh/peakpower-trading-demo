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

  var NAV = ["Home", "Trade desk", "Customers", "Wallets", "Invoicing", "Data & feeds", "Reference data", "Audit"];
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

  /** The mockup's own per-queue subtitles, recomputed from the live counts. */
  function queueSubtitle(key, n) {
    if (key === "toPrice") { return n + (n === 1 ? " request" : " requests"); }
    if (key === "awaiting") { return n + (n === 1 ? " offer" : " offers") + " counting down"; }
    return n + " accepted, awaiting execution";
  }

  /**
   * Merges live Customer Portal requests into the seeded desk columns.
   *
   * `liveCards` are PortalTradeLink.toDeskCard() results. They go at the TOP of
   * "To price" (newest request first) so a just-submitted trade is the first
   * thing the desk sees. A live card whose id already exists in the seed data
   * replaces it, so re-publishing can never double up a row.
   */
  function buildQueues(liveCards, seed) {
    var live = (liveCards || []).slice().reverse(); // newest first
    var liveIds = {};
    live.forEach(function (c) { liveIds[c.id] = true; });

    var base = (seed || TRADES).filter(function (t) { return !liveIds[t.id]; });

    return QUEUE_ORDER.map(function (key) {
      var seeded = base.filter(function (t) { return t.column === key; });
      var trades = key === "toPrice"
        ? live.filter(function (c) { return c.column === "toPrice"; }).concat(seeded)
        : seeded;
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
    queueSubtitle: queueSubtitle,
    buildQueues: buildQueues
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackOfficeDeskData = api;
  }
})(typeof window !== "undefined" ? window : this);
