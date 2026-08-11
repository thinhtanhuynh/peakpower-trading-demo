/*
 * Cross-portal trade-request link.
 *
 * Carries a trade request from the Customer Portal's trade wizard to the Back
 * Office Trade desk's "To price" queue. There is no backend in this POC, so
 * the transport is localStorage under a single versioned key, plus the
 * browser's own `storage` event for live cross-tab updates: submit a request
 * in one tab and it appears in a Back Office tab already open, with no reload
 * and no polling.
 *
 * Everything except read/write/subscribe is a pure function, so the request
 * shape and the volume/period maths are unit-testable in Node.
 *
 * Dual Node/browser module, same pattern as the other JS files here.
 */
(function (root) {
  "use strict";

  var STORAGE_KEY = "peakpower.tradeRequests.v1";

  // --- formatting -----------------------------------------------------------

  /** NL-style number: comma decimal, period thousands (1234.5 -> "1.234,50"). */
  function formatNL(value, decimals) {
    var sign = value < 0 ? "-" : "";
    var pieces = Math.abs(value).toFixed(decimals).split(".");
    var intPart = pieces[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + intPart + (pieces.length > 1 ? "," + pieces[1] : "");
  }

  /** "1,000 MW" — the Back Office desk's power format (3 decimals, NL comma). */
  function formatMw(mw) { return formatNL(mw, 3) + " MW"; }

  /** "768,00 MWh" — the Customer Portal's volume format. */
  function formatMwh(mwh) { return formatNL(mwh, 2) + " MWh"; }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /**
   * Customer-portal period label -> Back Office desk label:
   *   "Q1 2027" -> "Q1-27", "Sep 2026" -> "Sep-26", "Cal 2027" -> "Cal-27".
   * Anything unrecognised is passed through unchanged rather than mangled.
   */
  function toDeskPeriod(label) {
    var m = /^(Q[1-4]|Cal|[A-Z][a-z]{2})\s+(\d{4})$/.exec(String(label || "").trim());
    if (!m) { return String(label || ""); }
    return m[1] + "-" + m[2].slice(2);
  }

  // --- period maths ---------------------------------------------------------

  function parseISO(d) {
    var p = String(d).split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  /**
   * Delivery hours in [start, end] inclusive for a shape:
   *   base -> every hour of every day
   *   peak -> Mon-Fri 08:00-20:00 only (12h per weekday)
   * DST hour gain/loss is not adjusted for, matching hedge_blocks_2026.json's
   * documented simplification.
   */
  function hoursInPeriod(startISO, endISO, shape) {
    var start = parseISO(startISO), end = parseISO(endISO);
    if (isNaN(start) || isNaN(end) || end < start) { return 0; }
    var peak = String(shape).toLowerCase() === "peak";
    var hours = 0;
    for (var d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      var dow = d.getUTCDay(); // 0=Sun..6=Sat
      if (!peak) { hours += 24; }
      else if (dow >= 1 && dow <= 5) { hours += 12; }
    }
    return hours;
  }

  /** Contract volume in MWh for `powerMw` held across the period. */
  function volumeMwh(powerMw, startISO, endISO, shape) {
    return powerMw * hoursInPeriod(startISO, endISO, shape);
  }

  // --- request construction -------------------------------------------------

  /**
   * Turns the wizard's own state into a portable request record.
   *
   * `wizard` is the Customer Portal's state.wizard:
   *   { direction, shape, periodType, monthIdx, quarterIdx, volumes:{id:mw}, note }
   * `opts` supplies what the wizard doesn't own:
   *   { id, customer, connections:[{id,name,sub}], periods:{month:[],quarter:[]},
   *     year:{...}, submittedAt }
   */
  function buildRequest(wizard, opts) {
    opts = opts || {};
    var period = resolvePeriod(wizard, opts);
    var lines = [];
    var totalMw = 0;
    (opts.connections || []).forEach(function (c) {
      var mw = (wizard.volumes && wizard.volumes[c.id]) || 0;
      if (mw <= 0) { return; }
      totalMw += mw;
      lines.push({ id: c.id, name: c.name, sub: c.sub, powerMw: mw });
    });
    var mwh = volumeMwh(totalMw, period.start, period.end, wizard.shape);
    return {
      id: opts.id,
      customer: opts.customer || "",
      direction: wizard.direction,
      shape: wizard.shape,
      period: period.period,
      periodType: period.type,
      periodStart: period.start,
      periodEnd: period.end,
      indicativePrice: wizard.shape === "Peak" ? period.peak : period.base,
      powerMw: totalMw,
      volumeMwh: mwh,
      connections: lines,
      note: wizard.note || "",
      submittedAt: opts.submittedAt || null,
      status: "Awaiting price"
    };
  }

  /** The period row the wizard's periodType/index pair currently points at. */
  function resolvePeriod(wizard, opts) {
    var periods = opts.periods || {};
    var type = wizard.periodType;
    if (type === "year") {
      var y = opts.year || {};
      return { type: "year", period: y.period, start: y.start, end: y.end, base: y.base, peak: y.peak };
    }
    var list = periods[type] || [];
    var idx = type === "month" ? wizard.monthIdx : wizard.quarterIdx;
    var row = list[idx] || list[0] || {};
    return { type: type, period: row.period, start: row.start, end: row.end, base: row.base, peak: row.peak };
  }

  /**
   * Request -> Back Office Trade desk card. The desk renders every queue from
   * this shape, so a live request is indistinguishable from a seeded one.
   */
  function toDeskCard(req) {
    var deskPeriod = toDeskPeriod(req.period);
    var power = formatMw(req.powerMw);
    return {
      id: req.id,
      column: "toPrice",
      urgent: false,
      tag: "new",
      tagTone: "warning",
      customer: req.customer,
      shape: req.shape,
      period: deskPeriod,
      power: power,
      valueLabel: formatMwh(req.volumeMwh),
      meta: req.shape + " · " + deskPeriod + " · " + power,
      actionLabel: "open to price →",
      live: true,
      request: req
    };
  }

  // --- persistence ----------------------------------------------------------

  /** All published requests, oldest first. Never throws on corrupt storage. */
  function read(storage) {
    if (!storage) { return []; }
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) { return []; }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function write(storage, list) {
    if (!storage) { return false; }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false; // quota / private-mode: the portal still works, just unlinked
    }
  }

  /** Appends a request. Re-publishing the same id replaces the earlier copy. */
  function publish(storage, req) {
    var list = read(storage).filter(function (r) { return r.id !== req.id; });
    list.push(req);
    write(storage, list);
    return list;
  }

  function clear(storage) { return write(storage, []); }

  /**
   * Calls back whenever another tab publishes. Returns an unsubscribe fn.
   * `storage` events only fire in *other* tabs, which is exactly what the Back
   * Office needs, so no same-tab echo handling is required.
   */
  function subscribe(win, cb) {
    if (!win || !win.addEventListener) { return function () {}; }
    var handler = function (evt) {
      if (evt && evt.key && evt.key !== STORAGE_KEY) { return; }
      cb(read(win.localStorage));
    };
    win.addEventListener("storage", handler);
    return function () { win.removeEventListener("storage", handler); };
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    formatNL: formatNL,
    formatMw: formatMw,
    formatMwh: formatMwh,
    toDeskPeriod: toDeskPeriod,
    hoursInPeriod: hoursInPeriod,
    volumeMwh: volumeMwh,
    resolvePeriod: resolvePeriod,
    buildRequest: buildRequest,
    toDeskCard: toDeskCard,
    read: read,
    write: write,
    publish: publish,
    clear: clear,
    subscribe: subscribe
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.PortalTradeLink = api;
  }
})(typeof window !== "undefined" ? window : this);
