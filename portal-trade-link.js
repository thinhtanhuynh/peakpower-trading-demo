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
   *   { direction, shape, periodType, monthIdx, quarterIdx, yearIdx, volumes:{id:mw}, note }
   * `opts` supplies what the wizard doesn't own:
   *   { id, customer, connections:[{id,name,sub}], periods:{month:[],quarter:[],year:[]},
   *     submittedAt }
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
      // The customer's Back Office id, so the desk can join a live trade to a
      // customer record without matching on a display name.
      customerId: opts.customerId || null,
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

  // A quoted period/shape has one price; Buy and Sell are not the same
  // number — a customer sells into the market's bid, not its ask, the same
  // spread every liquid day-ahead product quotes. WIZARD_PERIODS carries
  // only the one (buy-side) price per row, so Sell is derived rather than
  // hand-authored a second time: hand-picking 24 "plausible" sell numbers
  // (12 rows x base+peak) alongside the buy ones would be exactly the
  // fabrication CLAUDE.md's "Derived detail must not out-claim its source"
  // warns about — correct-looking numbers with no stated relationship to
  // the real ones. One named constant instead, applied uniformly, so the
  // relationship is a documented rule, not 24 independent authored values.
  var SELL_SPREAD = 0.02;

  /** The one place Buy vs Sell pricing is decided — both the wizard's own
   * display (customer-portal.html, via this same export) and a submitted
   * request's indicativePrice (resolvePeriod below) call this, so the two
   * can never quote a different number for the same shape+period+direction. */
  function sellAdjustedPrice(price, direction) {
    if (price == null) { return price; }
    return String(direction).toLowerCase() === "sell" ? price * (1 - SELL_SPREAD) : price;
  }

  /** The period row the wizard's periodType/index pair currently points at,
   * base/peak already adjusted for direction (see sellAdjustedPrice) — a
   * Sell wizard resolves to the lower, bid-side price with no separate step.
   * All three period types (month, quarter, year) resolve the same way —
   * one flat lookup into opts.periods[type], indexed by wizard[type + "Idx"] —
   * since WIZARD_PERIODS.year became a real array alongside month/quarter
   * rather than a single standalone object needing its own branch. */
  function resolvePeriod(wizard, opts) {
    var periods = opts.periods || {};
    var type = wizard.periodType;
    var list = periods[type] || [];
    var idx = wizard[type + "Idx"];
    var row = list[idx] || list[0] || {};
    return {
      type: type, period: row.period, start: row.start, end: row.end,
      base: sellAdjustedPrice(row.base, wizard.direction),
      peak: sellAdjustedPrice(row.peak, wizard.direction)
    };
  }

  // --- pricing (the Back Office -> Customer leg) -----------------------------

  var STATUS_AWAITING_PRICE = "Awaiting price";
  var STATUS_OFFER_RECEIVED = "Offer received";
  var STATUS_OFFER_EXPIRED = "Offer expired";
  var STATUS_ACCEPTED = "Accepted · awaiting execution";
  var STATUS_REJECTED = "Offer rejected";
  var STATUS_CONFIRMED = "Confirmed";
  // Customer-facing wording is an outcome ("Execution failed"); the desk's own
  // button (built by `cards`, not this module) reads "Mark failed" — the desk
  // performs an action, the customer reads what happened. Kept as one shared
  // status string here since both portals derive their copy from it via
  // toDeskCard/toCustomerTrade rather than hardcoding it twice.
  var STATUS_FAILED = "Execution failed";
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

  function isResolved(req) {
    return !!(req && req.response && (req.response.action === "accept" || req.response.action === "reject"));
  }

  /**
   * The status a record should read as right now.
   *
   * Once the customer has responded, that decision is final and outranks the
   * clock — an accepted trade must not later read as "expired" just because
   * its reaction window has since elapsed. Confirmed and failed are the two
   * terminal desk outcomes for an accepted trade, checked before the
   * response itself so either one wins over "Accepted · awaiting execution"
   * once the desk has acted — confirmTrade/failTrade guard against setting
   * both, but effectiveStatus doesn't rely on that; it just checks failed
   * first (a decision is a decision, order between the two never matters
   * since they're mutually exclusive by construction).
   */
  function effectiveStatus(req, now) {
    if (isFailed(req)) { return STATUS_FAILED; }
    if (isConfirmed(req)) { return STATUS_CONFIRMED; }
    if (isResolved(req)) {
      return req.response.action === "accept" ? STATUS_ACCEPTED : STATUS_REJECTED;
    }
    if (!isPriced(req)) { return req && req.status ? req.status : STATUS_AWAITING_PRICE; }
    return isExpired(req, now) ? STATUS_OFFER_EXPIRED : STATUS_OFFER_RECEIVED;
  }

  /**
   * Records the customer's decision on a live offer. Pure; returns a new
   * record, or null if the offer cannot be acted on — unpriced, already
   * answered, or expired. Expiry is re-checked here rather than trusted from
   * the UI, so a stale screen can't accept a dead offer (which is exactly what
   * the desk's own note warns about).
   */
  function respondToOffer(req, action, opts) {
    opts = opts || {};
    if (action !== "accept" && action !== "reject") { return null; }
    if (!isPriced(req) || isResolved(req)) { return null; }
    if (action === "accept" && isExpired(req, opts.now)) { return null; }
    var out = {};
    for (var k in req) { out[k] = req[k]; }
    out.status = action === "accept" ? STATUS_ACCEPTED : STATUS_REJECTED;
    out.response = {
      action: action,
      by: opts.by || "J. de Vries · Admin",
      at: new Date(nowMs(opts.now)).toISOString()
    };
    // The deposit schedule is attached at acceptance and frozen there — see
    // PortalTermsLink.buildSettlement for why it is a snapshot rather than a
    // live read of the Back Office setting. Built by the caller (this module
    // knows nothing about commercial terms) and simply carried, so a rejected
    // offer never picks one up.
    if (action === "accept" && opts.settlement) { out.settlement = opts.settlement; }
    return out;
  }

  function acceptOffer(req, opts) { return respondToOffer(req, "accept", opts); }
  function rejectOffer(req, opts) { return respondToOffer(req, "reject", opts); }

  /**
   * Whether a trade's balance can be paid — and therefore chased — yet.
   *
   * Only once the desk has executed it. An accepted trade can still fail, and
   * a failed one gives the deposit back rather than collecting more, so taking
   * the balance before execution risks charging for a block the customer never
   * gets. This is the single source of truth for the Pay balance button, the
   * overdue counts and the Dashboard's balance banner: an unconfirmed balance
   * is still shown as committed, but nobody asks for it.
   */
  function balancePayable(req, now) {
    return paymentWindow(req, now) === "open";
  }

  /** Local calendar day of `ms`, as YYYY-MM-DD. */
  function isoDay(ms) {
    var d = new Date(ms);
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd;
  }

  /**
   * The balance's payment window:
   *
   *   "paid"          settled, nothing further owed
   *   "not-executed"  the desk has not confirmed the block yet
   *   "open"          payable now
   *   "closed"        the due date has passed and delivery has started
   *
   * Null for a trade carrying no schedule at all — a Sell, or an offer nobody
   * has accepted.
   *
   * The window shuts the day after `dueDate`, which is itself the day before
   * delivery opens: once the period is running there is no longer a block to
   * pay for in advance, so the balance stops being collectable here and the
   * desk settles it instead.
   *
   * One exception. If the desk confirmed *after* that date, the customer never
   * had a window to miss — the delay was ours — so it stays open.
   *
   * The boundary is an ISO YYYY-MM-DD comparison, which is the same line
   * PortalTermsLink.daysUntilDue() draws at `< 0`; a test walks the days either
   * side of a due date and asserts the two still agree. The day *count* stays
   * that function's job — this one only decides which side of the line we are.
   */
  function paymentWindow(req, now) {
    if (!req || !req.settlement) { return null; }
    if (req.settlement.paidAt) { return "paid"; }
    if (!isConfirmed(req)) { return "not-executed"; }
    var due = req.settlement.dueDate;
    if (!due) { return "open"; }
    if (req.confirmation && req.confirmation.at &&
        isoDay(new Date(req.confirmation.at).getTime()) > due) { return "open"; }
    return isoDay(nowMs(now)) > due ? "closed" : "open";
  }

  /**
   * What has become of the deposit: "on-hold" while the desk has yet to act,
   * "applied" once the trade is executed, "released" once it has failed. Null
   * when the trade carries no schedule at all (a Sell, or an unanswered offer).
   *
   * Independent of `paidAt`, which is the *balance's* state, not the deposit's.
   */
  function depositState(req) {
    if (!req || !req.settlement) { return null; }
    if (isFailed(req)) { return "released"; }
    return isConfirmed(req) ? "applied" : "on-hold";
  }

  /**
   * Records the balance as paid. Pure; returns a new record, or null when
   * there is nothing to pay — no schedule on this trade, it is already
   * settled, or the desk has not executed it yet. Guarded here rather than
   * only in the UI, so a stale screen can neither pay the same balance twice
   * nor pay one for a block that may still fail.
   */
  function payBalance(req, opts) {
    opts = opts || {};
    if (!balancePayable(req, opts.now)) { return null; }
    var out = {};
    for (var k in req) { out[k] = req[k]; }
    var s = {};
    for (var f in req.settlement) { if (req.settlement.hasOwnProperty(f)) { s[f] = req.settlement[f]; } }
    s.paidAt = new Date(nowMs(opts.now)).toISOString();
    s.paidBy = opts.by || "J. de Vries · Admin";
    out.settlement = s;
    return out;
  }

  function isConfirmed(req) { return !!(req && req.confirmation); }
  function isFailed(req) { return !!(req && req.failure); }

  /**
   * The desk confirms execution of an accepted trade. Pure; returns a new
   * record, or null if the trade isn't in a confirmable state (only an
   * *accepted* offer can be confirmed — not an unpriced, unanswered, rejected,
   * already-confirmed, or already-failed one).
   */
  function confirmTrade(req, opts) {
    opts = opts || {};
    if (!isResolved(req) || req.response.action !== "accept") { return null; }
    if (isConfirmed(req) || isFailed(req)) { return null; }
    var out = {};
    for (var k in req) { out[k] = req[k]; }
    out.status = STATUS_CONFIRMED;
    out.confirmation = {
      by: opts.by || "PeakPower Trading",
      at: new Date(nowMs(opts.now)).toISOString(),
      reference: opts.reference || null
    };
    return out;
  }

  /**
   * The desk marks an accepted trade as failed to execute — a real terminal
   * outcome distinct from every other state: the desk accepted it, then
   * could not execute, so the customer's reservation must not stand. Pure;
   * mirrors confirmTrade exactly, including its guard (only an *accepted*
   * offer can fail — not an unpriced, unanswered, rejected, already-
   * confirmed, or already-failed one) rather than inventing a second rule.
   * `opts.reason` is carried through to the customer's timeline — a failure
   * whose cause the customer can't see is worse than useless.
   */
  function failTrade(req, opts) {
    opts = opts || {};
    if (!isResolved(req) || req.response.action !== "accept") { return null; }
    if (isConfirmed(req) || isFailed(req)) { return null; }
    var out = {};
    for (var k in req) { out[k] = req[k]; }
    out.status = STATUS_FAILED;
    out.failure = {
      by: opts.by || "PeakPower Trading",
      at: new Date(nowMs(opts.now)).toISOString(),
      reason: opts.reason || null
    };
    return out;
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

    // An answered offer leaves the countdown queue: accepted trades go to
    // "To confirm" for execution; rejected, confirmed and failed ones use the
    // sentinel column "done", which no queue matches, so they drop off the
    // desk once the desk has acted on them one way or the other.
    if (isConfirmed(req)) {
      base.column = "done";
      base.urgent = false;
      base.tag = "confirmed";
      base.tagTone = "neutral";
      base.valueLabel = "€ " + formatNL(req.offer.valueEur, 0);
      base.actionLabel = "executed";
      return base;
    }
    if (isFailed(req)) {
      base.column = "done";
      base.urgent = false;
      base.tag = "failed";
      base.tagTone = "critical";
      base.valueLabel = "€ " + formatNL(req.offer.valueEur, 0);
      base.actionLabel = "execution failed";
      return base;
    }
    if (isResolved(req)) {
      var accepted = req.response.action === "accept";
      base.column = accepted ? "confirm" : "done";
      base.urgent = false;
      base.tag = accepted ? "accepted" : "rejected";
      base.tagTone = accepted ? "warning" : "neutral";
      base.valueLabel = "€ " + formatNL(req.offer.valueEur, 0);
      base.actionLabel = accepted ? "confirm or fail →" : "rejected by customer";
      base.confirmable = accepted;
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
    var resolved = isResolved(req);
    var confirmed = isConfirmed(req);
    var failed = isFailed(req);
    var left = priced ? secondsRemaining(req, now) : 0;
    // Only an unanswered, unexpired offer is still actionable.
    var pending = priced && !resolved && left > 0;

    // Where the balance stands, folded into the status the customer reads.
    // Only once executed: before that the trade's own state is the headline
    // and the deposit's is said on the Payment card instead.
    var window = paymentWindow(req, now);
    var balanceSuffix = null, balanceTone = null;
    if (confirmed && window) {
      if (window === "paid") { balanceSuffix = "balance paid"; balanceTone = "success"; }
      else if (window === "closed") { balanceSuffix = "balance overdue"; balanceTone = "critical"; }
      else { balanceSuffix = "balance due"; balanceTone = "success"; }
    }

    var events = [{
      title: "Request submitted",
      actor: "J. de Vries · Admin (you)",
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
      if (resolved) {
        var acc = req.response.action === "accept";
        events.push({
          title: acc ? "Offer accepted" : "Offer rejected",
          actor: req.response.by,
          ts: formatStamp(req.response.at),
          // What was reserved is the DEPOSIT, not the whole value, whenever the
          // trade carries a schedule — saying "€ 76.800 reserved" when € 15.360
          // moved would be a plain misstatement of the customer's own wallet.
          body: acc
            ? (req.settlement
                ? "€ " + formatNL(req.settlement.depositEur, 2) + " deposit reserved on the company wallet (" +
                  formatNL(req.settlement.depositPct, 0) + " % of € " + formatNL(o.valueEur, 2) + "). Awaiting execution confirmation."
                : "€ " + formatNL(o.valueEur, 2) + " reserved on the company wallet. Awaiting execution confirmation.")
            : "The offer was declined. No volume was contracted.",
          tone: acc ? "amber" : "red"
        });
        facts.push([acc ? "Accepted by" : "Rejected by", req.response.by]);
        if (confirmed) {
          var c = req.confirmation;
          events.push({
            title: "Trade confirmed",
            actor: c.by,
            ts: formatStamp(c.at),
            body: "Executed on the market" + (c.reference ? ", reference " + c.reference : "") +
              (req.settlement
                ? ". Deposit of € " + formatNL(req.settlement.depositEur, 2) + " settled; balance of € " +
                  formatNL(req.settlement.balanceEur, 2) + " due " + (req.settlement.dueDate || "before delivery") + "."
                : ". Reservation settled — wallet debited € " + formatNL(o.valueEur, 2) + "."),
            tone: "green"
          });
          facts.push(["Confirmed by", c.by]);
          if (c.reference) { facts.push(["Market reference", c.reference]); }
        }
        if (failed) {
          var f = req.failure;
          events.push({
            title: "Execution failed",
            actor: f.by,
            ts: formatStamp(f.at),
            body: (f.reason ? f.reason + " " : "") +
              "The reservation has been released — no charge was made for this trade.",
            tone: "red"
          });
          facts.push(["Failed by", f.by]);
          if (f.reason) { facts.push(["Reason", f.reason]); }
        }
      } else if (!pending) {
        events.push({
          title: "Offer expired",
          actor: "PeakPower Trading",
          ts: formatStamp(o.expiresAt),
          body: "The reaction window closed before the offer was accepted.",
          tone: "red"
        });
      }
    }

    // The customer paying their balance is an event, not just a flag — it
    // belongs on the same timeline as the offer and the confirmation.
    if (req.settlement && req.settlement.paidAt) {
      events.push({
        title: "Balance paid",
        actor: req.settlement.paidBy || "J. de Vries · Admin",
        ts: formatStamp(req.settlement.paidAt),
        body: "€ " + formatNL(req.settlement.balanceEur, 2) + " paid from the company wallet. Nothing further is due on this trade.",
        tone: "green"
      });
    }

    return {
      id: req.id, shape: req.shape, period: req.period, direction: req.direction,
      // Carried through so the portal can frame its Consumption chart on this
      // trade's own period and connection. The display strings above are
      // formatted for reading and are not parseable back into dates.
      periodStart: req.periodStart || null,
      periodEnd: req.periodEnd || null,
      connections: req.connections || [],
      power: power, volume: volume,
      price: priced ? "€ " + formatNL(req.offer.priceMwh, 4) : null,
      value: priced ? "€ " + formatNL(req.offer.valueEur, 2) : null,
      // "Confirmed" alone says the block was executed but not whether the
      // balance behind it is settled, which is the other half of where a
      // bought trade stands. A Sell or an unaccepted offer has no schedule and
      // is left exactly as it was.
      status: balanceSuffix ? status + " · " + balanceSuffix : status,
      // Failed is bad news, not a pending state — critical (red), not the
      // amber "warning" tone accepted-and-awaiting-execution uses. Checked
      // before confirmed/resolved since it's a terminal outcome like they are.
      statusTone: failed ? "critical"
        : (balanceTone || (confirmed ? "success"
          : (resolved
              ? (req.response.action === "accept" ? "warning" : "critical")
              : (pending ? "warning" : (priced ? "critical" : "info"))))),
      balanceWindow: window,
      resolved: resolved,
      confirmed: confirmed,
      failed: failed,
      responseAction: resolved ? req.response.action : null,
      pending: pending,
      expiresAt: priced ? req.offer.expiresAt : null,
      secondsRemaining: left,
      secondsTotal: priced ? req.offer.reactionMinutes * 60 : 0,
      events: events,
      facts: facts,
      settlement: req.settlement || null,
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
    SELL_SPREAD: SELL_SPREAD,
    sellAdjustedPrice: sellAdjustedPrice,
    resolvePeriod: resolvePeriod,
    buildRequest: buildRequest,
    STATUS_AWAITING_PRICE: STATUS_AWAITING_PRICE,
    STATUS_OFFER_RECEIVED: STATUS_OFFER_RECEIVED,
    STATUS_OFFER_EXPIRED: STATUS_OFFER_EXPIRED,
    STATUS_ACCEPTED: STATUS_ACCEPTED,
    STATUS_REJECTED: STATUS_REJECTED,
    STATUS_CONFIRMED: STATUS_CONFIRMED,
    STATUS_FAILED: STATUS_FAILED,
    confirmTrade: confirmTrade,
    isConfirmed: isConfirmed,
    failTrade: failTrade,
    isFailed: isFailed,
    DEFAULT_REACTION_MINUTES: DEFAULT_REACTION_MINUTES,
    priceRequest: priceRequest,
    respondToOffer: respondToOffer,
    acceptOffer: acceptOffer,
    payBalance: payBalance,
    balancePayable: balancePayable,
    paymentWindow: paymentWindow,
    depositState: depositState,
    rejectOffer: rejectOffer,
    isResolved: isResolved,
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
