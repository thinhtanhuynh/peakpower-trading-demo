/*
 * Cross-portal trade link.
 *
 * Carries a trade both ways between the two portals:
 *
 *   Customer wizard  --request-->  Back Office "To price"
 *   Back Office desk --offer---->  Customer Portal firm offer (with countdown)
 *
 * One record per trade holds the whole state, so there is a single source of
 * truth rather than a request list and a separate offer list to reconcile:
 *
 *   status "Awaiting price"   -- submitted, not yet priced (To price queue)
 *   status "Offer received"   -- priced, live countdown  (Awaiting customer)
 *   status "Offer expired"    -- the reaction window elapsed
 *
 * There is no backend in this POC, so the transport is localStorage under a
 * single versioned key, plus the browser's own `storage` event for live
 * cross-tab updates: act in one tab and the other updates with no reload and
 * no polling.
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

  // --- pricing (the Back Office -> Customer leg) -----------------------------

  var STATUS_AWAITING_PRICE = "Awaiting price";
  var STATUS_OFFER_RECEIVED = "Offer received";
  var STATUS_OFFER_EXPIRED = "Offer expired";
  var DEFAULT_REACTION_MINUTES = 30;

  // Anything before this is not a plausible "now" for this app.
  var MIN_PLAUSIBLE_MS = Date.UTC(2000, 0, 1);

  /**
   * Resolves an optional `now` to epoch ms, defaulting to the real clock.
   *
   * Small numbers are rejected rather than read as epoch-1970 timestamps:
   * these functions are natural `map()` callbacks, and `list.map(toDeskCard)`
   * would otherwise pass the array index as `now` and silently pin every
   * countdown to 1970. Guarding here makes that mistake harmless everywhere
   * instead of relying on each call site to wrap correctly.
   */
  function nowMs(now) {
    if (now == null) { return Date.now(); }
    var ms = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (!isFinite(ms) || ms < MIN_PLAUSIBLE_MS) { return Date.now(); }
    return ms;
  }

  /**
   * Attaches a firm offer to a request. Pure: returns a new record, leaving
   * the input untouched. Total value is derived from the request's own
   * computed volume, so the two portals can never disagree about it.
   */
  function priceRequest(req, offer) {
    offer = offer || {};
    var priceMwh = Number(offer.priceMwh);
    if (!isFinite(priceMwh) || priceMwh <= 0) { return null; }
    var minutes = offer.reactionMinutes > 0 ? offer.reactionMinutes : DEFAULT_REACTION_MINUTES;
    var pricedAtMs = nowMs(offer.now);
    var out = {};
    for (var k in req) { out[k] = req[k]; }
    out.status = STATUS_OFFER_RECEIVED;
    out.offer = {
      priceMwh: priceMwh,
      valueEur: priceMwh * req.volumeMwh,
      reactionMinutes: minutes,
      pricedBy: offer.pricedBy || "PeakPower Trading",
      pricedAt: new Date(pricedAtMs).toISOString(),
      expiresAt: new Date(pricedAtMs + minutes * 60000).toISOString()
    };
    return out;
  }

  /** Whole seconds left on an offer, floored at 0. */
  function secondsRemaining(req, now) {
    if (!req || !req.offer || !req.offer.expiresAt) { return 0; }
    var left = Math.floor((new Date(req.offer.expiresAt).getTime() - nowMs(now)) / 1000);
    return left > 0 ? left : 0;
  }

  function isPriced(req) { return !!(req && req.offer); }
  function isExpired(req, now) { return isPriced(req) && secondsRemaining(req, now) <= 0; }

  /** "mm:ss", or "hh:mm:ss" past an hour. */
  function mmss(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return (h > 0 ? h + ":" + pad(m) : "" + pad(m)) + ":" + pad(sec);
  }

  /** The status a record should read as right now (offers expire on a clock). */
  function effectiveStatus(req, now) {
    if (!isPriced(req)) { return req && req.status ? req.status : STATUS_AWAITING_PRICE; }
    return isExpired(req, now) ? STATUS_OFFER_EXPIRED : STATUS_OFFER_RECEIVED;
  }

  /** Desk countdown tone, matching the mockup's own thresholds. */
  function countdownTone(seconds) {
    if (seconds <= 5 * 60) { return "critical"; }
    if (seconds <= 15 * 60) { return "warning"; }
    return "neutral";
  }

  /**
   * Request -> Back Office Trade desk card. The desk renders every queue from
   * this shape, so a live request is indistinguishable from a seeded one.
   * An unpriced record sits in "To price"; a priced one moves to "Awaiting
   * customer" with a live countdown, exactly like the seeded rows.
   */
  function toDeskCard(req, now) {
    var deskPeriod = toDeskPeriod(req.period);
    var power = formatMw(req.powerMw);
    var base = {
      id: req.id,
      customer: req.customer,
      shape: req.shape,
      period: deskPeriod,
      power: power,
      meta: req.shape + " · " + deskPeriod + " · " + power,
      live: true,
      request: req
    };

    if (!isPriced(req)) {
      base.column = "toPrice";
      base.urgent = false;
      base.tag = "new";
      base.tagTone = "warning";
      base.valueLabel = formatMwh(req.volumeMwh);
      base.actionLabel = "open to price →";
      return base;
    }

    var left = secondsRemaining(req, now);
    base.column = "awaiting";
    base.urgent = left <= 5 * 60;
    base.tag = left > 0 ? mmss(left) : "expired";
    base.tagTone = left > 0 ? countdownTone(left) : "critical";
    base.valueLabel = "€ " + formatNL(req.offer.valueEur, 0);
    base.actionLabel = left > 0 ? "view offer →" : "offer expired";
    return base;
  }

  /**
   * Request -> the Customer Portal's own trade shape, so a linked trade renders
   * through exactly the same list/detail/banner code as the seeded ones.
   */
  function toCustomerTrade(req, now) {
    var power = formatMw(req.powerMw);
    var volume = formatMwh(req.volumeMwh);
    var status = effectiveStatus(req, now);
    var priced = isPriced(req);
    var left = priced ? secondsRemaining(req, now) : 0;
    var pending = priced && left > 0;

    var events = [{
      title: "Request submitted",
      actor: "J. de Vries · Energy Manager (you)",
      ts: req.submittedAt ? formatStamp(req.submittedAt) : "just now",
      body: req.note ? 'Comment: "' + req.note + '"'
        : req.direction + " " + req.shape + " " + req.period + " · " + power +
          " across " + req.connections.length + " connection" + (req.connections.length === 1 ? "" : "s") + ".",
      tone: "submit"
    }];
    var facts = [["Reference", req.id], ["Requested by", "J. de Vries"], ["State", status],
      ["Direction", req.direction], ["Shape", req.shape], ["Delivery period", req.period],
      ["Total power", power], ["Total volume", volume]];

    if (priced) {
      var o = req.offer;
      events.push({
        title: "Offer published",
        actor: o.pricedBy,
        ts: formatStamp(o.pricedAt),
        body: "Price € " + formatNL(o.priceMwh, 4) + "/MWh · total € " + formatNL(o.valueEur, 2) +
          " · reaction window " + o.reactionMinutes + " minutes.",
        tone: "indigo"
      });
      facts.push(["Offered price", "€ " + formatNL(o.priceMwh, 4) + " / MWh"]);
      if (!pending) {
        events.push({
          title: "Offer expired",
          actor: "PeakPower Trading",
          ts: formatStamp(o.expiresAt),
          body: "The reaction window closed before the offer was accepted.",
          tone: "red"
        });
      }
    }

    return {
      id: req.id, shape: req.shape, period: req.period, direction: req.direction,
      power: power, volume: volume,
      price: priced ? "€ " + formatNL(req.offer.priceMwh, 4) : null,
      value: priced ? "€ " + formatNL(req.offer.valueEur, 2) : null,
      status: status,
      statusTone: pending ? "warning" : (priced ? "critical" : "info"),
      pending: pending,
      expiresAt: priced ? req.offer.expiresAt : null,
      secondsRemaining: left,
      secondsTotal: priced ? req.offer.reactionMinutes * 60 : 0,
      events: events,
      facts: facts,
      linked: true
    };
  }

  /** "12 Aug 2026, 09:14:00" — the portals' own timeline stamp format. */
  function formatStamp(iso) {
    var d = new Date(iso);
    if (isNaN(d)) { return String(iso); }
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + ", " +
      pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
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

  /**
   * Appends a record. Re-publishing the same id replaces the earlier copy, so
   * pricing an existing request updates it in place rather than duplicating.
   * Returns the new list, or `false` if the write failed — callers rely on
   * that to fall back when storage is unavailable.
   */
  function publish(storage, req) {
    var list = read(storage).filter(function (r) { return r.id !== req.id; });
    list.push(req);
    return write(storage, list) ? list : false;
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
    STATUS_AWAITING_PRICE: STATUS_AWAITING_PRICE,
    STATUS_OFFER_RECEIVED: STATUS_OFFER_RECEIVED,
    STATUS_OFFER_EXPIRED: STATUS_OFFER_EXPIRED,
    DEFAULT_REACTION_MINUTES: DEFAULT_REACTION_MINUTES,
    priceRequest: priceRequest,
    secondsRemaining: secondsRemaining,
    isPriced: isPriced,
    isExpired: isExpired,
    effectiveStatus: effectiveStatus,
    countdownTone: countdownTone,
    mmss: mmss,
    formatStamp: formatStamp,
    toDeskCard: toDeskCard,
    toCustomerTrade: toCustomerTrade,
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
