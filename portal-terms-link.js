/*
 * Cross-portal commercial terms.
 *
 * One setting travels the other way from a trade: the Back Office sets it,
 * the Customer Portal obeys it.
 *
 *   Back Office "Commercial settings"  --deposit %-->  Customer Portal wizard,
 *                                                      offer, wallet
 *
 * The deposit percentage is the share of a bought block's value the customer
 * pays up front. The rest — the balance — falls due before delivery starts.
 * Default 20 %, so a € 76.800 block costs € 15.360 to enter and € 61.440 on
 * the day before the delivery period opens.
 *
 * Same transport as portal-trade-link.js (localStorage under one versioned
 * key, plus the browser's `storage` event), and the same rule: a broken link
 * must never break either portal. Every read failure lands on the default
 * rather than throwing, which for this setting means "20 %", never "free".
 *
 * Everything except read/write/subscribe is pure, so the money maths is
 * unit-testable in Node (see portal-terms-link.test.js).
 *
 * Dual Node/browser module, same pattern as the other JS files here.
 */
(function (root) {
  "use strict";

  var STORAGE_KEY = "peakpower.commercialTerms.v1";

  /**
   * The default every customer starts on, and the fallback for every failure
   * mode — no link, unparseable storage, unknown customer, junk value.
   *
   * It is deliberately not 0: a missing setting must never read as "no deposit
   * required". The safe direction to fail in is asking for money we might not
   * need, not letting a block through unpaid.
   */
  var DEFAULT_DEPOSIT_PCT = 20;

  // --- storage --------------------------------------------------------------

  /**
   * Every customer's terms, keyed by customer id (the Back Office's `kvk`):
   * `{ "34215678": { depositPct: 20 } }`.
   *
   * Returns {} for anything unreadable, so callers always get an object and
   * fall through to the default per customer.
   */
  function read(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) { return {}; }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) { return {}; }
      return parsed;
    } catch (e) {
      return {};
    }
  }

  /** Persists the whole terms map. Returns false rather than throwing. */
  function write(storage, terms) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(terms || {}));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fires `cb` when another tab writes the terms. `storage` events only fire
   * in *other* tabs, so there is no same-tab echo to guard against; the pages
   * cover the same-tab case with their own re-render after a write.
   */
  function subscribe(win, cb) {
    function onStorage(e) {
      if (!e || e.key === null || e.key === STORAGE_KEY) { cb(); }
    }
    win.addEventListener("storage", onStorage);
    return function () { win.removeEventListener("storage", onStorage); };
  }

  // --- the setting ----------------------------------------------------------

  /**
   * Accepts what a person actually types into the Back Office field: "20",
   * "20,5", "20.5", " 20 % ". Returns null for anything that is not a number
   * in 0..100, so the caller can reject the edit rather than silently storing
   * a percentage that means nothing.
   *
   * 0 is allowed and means "no deposit — the whole value falls due before
   * delivery", which is a real commercial term. 100 means "paid in full up
   * front", which is the other end of the same axis. Both are accepted; it is
   * only *junk* that is refused.
   */
  function parsePct(input) {
    if (typeof input === "number") {
      return isFinite(input) && input >= 0 && input <= 100 ? input : null;
    }
    var s = String(input == null ? "" : input).replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
    if (s === "" || !/^\d+(\.\d+)?$/.test(s)) { return null; }
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }

  /** This customer's deposit %, or the default if it has never been set. */
  function depositPctFor(terms, customerId) {
    var row = terms && customerId ? terms[customerId] : null;
    var pct = row ? parsePct(row.depositPct) : null;
    return pct == null ? DEFAULT_DEPOSIT_PCT : pct;
  }

  /**
   * Pure: returns a new terms map with this customer's deposit % set, or null
   * if the value is not a usable percentage (see parsePct) — a rejected edit
   * must leave the stored terms exactly as they were.
   */
  function setDepositPct(terms, customerId, pct) {
    var n = parsePct(pct);
    if (n == null || !customerId) { return null; }
    var out = {};
    for (var k in terms) { if (terms.hasOwnProperty(k)) { out[k] = terms[k]; } }
    var row = {};
    for (var f in out[customerId]) { if (out[customerId].hasOwnProperty(f)) { row[f] = out[customerId][f]; } }
    row.depositPct = n;
    out[customerId] = row;
    return out;
  }

  // --- settlement maths -----------------------------------------------------

  /** Two-decimal round, so the two halves always add back to the total. */
  function round2(v) { return Math.round(v * 100) / 100; }

  /**
   * Splits a trade's value into what is paid now and what falls due later.
   *
   * The balance is the *remainder*, not its own percentage calculation, so
   * deposit + balance === value exactly — at 33,33 % the two would otherwise
   * miss the total by a cent and every screen showing all three would look
   * wrong.
   */
  function splitDeposit(valueEur, pct) {
    var value = Number(valueEur) || 0;
    var p = parsePct(pct);
    if (p == null) { p = DEFAULT_DEPOSIT_PCT; }
    var deposit = round2(value * p / 100);
    return { depositPct: p, valueEur: round2(value), depositEur: deposit, balanceEur: round2(value - deposit) };
  }

  /**
   * The day before delivery starts, as an ISO date — "before the first day of
   * the period" is a deadline, so it resolves to the last day the customer can
   * still pay on time.
   */
  function balanceDueDate(periodStart) {
    if (!periodStart) { return null; }
    var p = String(periodStart).split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() - 1);
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd;
  }

  /**
   * A trade's full settlement schedule, built once at acceptance and then
   * frozen onto the record.
   *
   * Frozen deliberately: the Back Office can change a customer's deposit % at
   * any time, and a change must not retroactively alter what an already-agreed
   * trade owes. The stored `depositPct` is what applied on the day the
   * customer accepted, which is also why every screen reads the percentage off
   * the trade rather than off the live setting.
   */
  function buildSettlement(valueEur, pct, periodStart) {
    var split = splitDeposit(valueEur, pct);
    return {
      depositPct: split.depositPct,
      valueEur: split.valueEur,
      depositEur: split.depositEur,
      balanceEur: split.balanceEur,
      dueDate: balanceDueDate(periodStart),
      paidAt: null
    };
  }

  /**
   * Whether a trade carries a deposit schedule at all.
   *
   * Only a **Buy** does. On a Sell the customer is the one being paid, so
   * there is no deposit to take and no balance to chase — showing "balance
   * due" against a sale would invent an obligation that does not exist.
   */
  function appliesTo(req) {
    return !!req && String(req.direction || "").toLowerCase() === "buy";
  }

  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  /** Midnight local time on an ISO date. */
  function dayStartMs(isoDate) {
    var p = String(isoDate).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).getTime();
  }

  /**
   * Whole days from `now` to the due date: positive while there is time left,
   * 0 on the due date itself, negative once it has passed. Counted in whole
   * local days rather than 24h blocks, so "due today" does not become
   * "overdue" at lunchtime.
   */
  function daysUntilDue(settlement, now) {
    if (!settlement || !settlement.dueDate) { return null; }
    var nowMs = now == null ? Date.now() : (now instanceof Date ? now.getTime() : new Date(now).getTime());
    var today = new Date(nowMs);
    var todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return Math.round((dayStartMs(settlement.dueDate) - todayMs) / MS_PER_DAY);
  }

  /** Alerting horizon: inside this many days the balance is called "due soon". */
  var DUE_SOON_DAYS = 14;

  /**
   * The one place a balance's state is decided, so no screen invents its own
   * threshold: "paid" | "overdue" | "due-soon" | "scheduled".
   *
   * `paid` outranks the clock — a balance settled on time never later reads as
   * overdue just because the date has since passed, the same rule the trade
   * link applies to an accepted offer whose window has since elapsed.
   */
  function balanceState(settlement, now) {
    if (!settlement) { return null; }
    if (settlement.paidAt) { return "paid"; }
    var days = daysUntilDue(settlement, now);
    if (days == null) { return "scheduled"; }
    if (days < 0) { return "overdue"; }
    return days <= DUE_SOON_DAYS ? "due-soon" : "scheduled";
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_DEPOSIT_PCT: DEFAULT_DEPOSIT_PCT,
    DUE_SOON_DAYS: DUE_SOON_DAYS,
    read: read,
    write: write,
    subscribe: subscribe,
    parsePct: parsePct,
    depositPctFor: depositPctFor,
    setDepositPct: setDepositPct,
    splitDeposit: splitDeposit,
    balanceDueDate: balanceDueDate,
    buildSettlement: buildSettlement,
    appliesTo: appliesTo,
    daysUntilDue: daysUntilDue,
    balanceState: balanceState
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.PortalTermsLink = api;
  }
})(typeof window !== "undefined" ? window : this);
