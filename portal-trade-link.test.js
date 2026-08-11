var assert = require("assert");
var Link = require("./portal-trade-link.js");

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-6,
    (message || "") + " expected " + expected + " got " + actual);
}

/** Minimal in-memory Storage stand-in (localStorage's surface, no browser). */
function fakeStorage(initial) {
  var data = initial || {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
    _data: data
  };
}

// --- formatting -------------------------------------------------------------
(function () {
  assert.strictEqual(Link.formatNL(1234.5, 2), "1.234,50");
  assert.strictEqual(Link.formatNL(0.5, 3), "0,500");
  assert.strictEqual(Link.formatMw(1), "1,000 MW", "desk power format");
  assert.strictEqual(Link.formatMw(0.5), "0,500 MW");
  assert.strictEqual(Link.formatMwh(768), "768,00 MWh");
})();

// --- desk period labels -----------------------------------------------------
(function () {
  assert.strictEqual(Link.toDeskPeriod("Q1 2027"), "Q1-27");
  assert.strictEqual(Link.toDeskPeriod("Sep 2026"), "Sep-26");
  assert.strictEqual(Link.toDeskPeriod("Cal 2027"), "Cal-27");
  // Unrecognised labels pass through rather than being mangled.
  assert.strictEqual(Link.toDeskPeriod("Whenever"), "Whenever");
  assert.strictEqual(Link.toDeskPeriod(""), "");
})();

// --- period hours -----------------------------------------------------------
(function () {
  // Q1 2027 Peak = 768 h, which is exactly the "1,000 MW -> 768,00 MWh" pair
  // the Customer Portal mockup hardcodes for its submitted trade.
  assert.strictEqual(Link.hoursInPeriod("2027-01-01", "2027-03-31", "Peak"), 768, "Q1 2027 peak hours");
  assert.strictEqual(Link.hoursInPeriod("2027-01-01", "2027-03-31", "Base"), 90 * 24, "Q1 2027 base hours");
  // A single weekday: 24 h base, 12 h peak. 2027-01-04 is a Monday.
  assert.strictEqual(Link.hoursInPeriod("2027-01-04", "2027-01-04", "Base"), 24);
  assert.strictEqual(Link.hoursInPeriod("2027-01-04", "2027-01-04", "Peak"), 12);
  // A single weekend day contributes nothing to peak. 2027-01-02 is a Saturday.
  assert.strictEqual(Link.hoursInPeriod("2027-01-02", "2027-01-02", "Peak"), 0);
  assert.strictEqual(Link.hoursInPeriod("2027-01-02", "2027-01-02", "Base"), 24);
  // Shape matching is case-insensitive (portal uses "Peak", data uses "peak").
  assert.strictEqual(Link.hoursInPeriod("2027-01-04", "2027-01-04", "peak"), 12);
  // Reversed / invalid ranges are 0, not negative or NaN.
  assert.strictEqual(Link.hoursInPeriod("2027-03-31", "2027-01-01", "Base"), 0);
  assertClose(Link.volumeMwh(0.5, "2027-01-01", "2027-03-31", "Peak"), 384, "half the power, half the volume");
})();

// --- fixtures mirroring portal-seed-data's wizard inputs ---------------------
var PERIODS = {
  month: [{ period: "Sep 2026", base: 78.45, peak: 96.15, start: "2026-09-01", end: "2026-09-30" },
          { period: "Oct 2026", base: 80.10, peak: 99.40, start: "2026-10-01", end: "2026-10-31" }],
  quarter: [{ period: "Q4 2026", base: 84.20, peak: 103.70, start: "2026-10-01", end: "2026-12-31" },
            { period: "Q1 2027", base: 82.75, peak: 94.75, start: "2027-01-01", end: "2027-03-31" }]
};
var YEAR = { period: "Cal 2027", base: 79.90, peak: 98.25, start: "2027-01-01", end: "2027-12-31" };
var CONNS = [
  { id: "rot", name: "Rotterdam DC", sub: "…0011" },
  { id: "venlo", name: "Venlo cold store", sub: "…0027" },
  { id: "tilburg", name: "Tilburg plant", sub: "…0043" },
  { id: "almere", name: "Almere office", sub: "…0059" }
];
function opts(extra) {
  var o = { id: "TRD-1079", customer: "Vandersteen Koeling", connections: CONNS, periods: PERIODS, year: YEAR };
  for (var k in (extra || {})) { o[k] = extra[k]; }
  return o;
}

// --- resolvePeriod ----------------------------------------------------------
(function () {
  var q = Link.resolvePeriod({ periodType: "quarter", quarterIdx: 1 }, opts());
  assert.strictEqual(q.period, "Q1 2027", "quarterIdx picks from the quarter list");
  var m = Link.resolvePeriod({ periodType: "month", monthIdx: 1 }, opts());
  assert.strictEqual(m.period, "Oct 2026", "monthIdx picks from the month list");
  var y = Link.resolvePeriod({ periodType: "year" }, opts());
  assert.strictEqual(y.period, "Cal 2027", "year ignores the indices");
  // Out-of-range index falls back to the first row rather than undefined.
  var oob = Link.resolvePeriod({ periodType: "quarter", quarterIdx: 99 }, opts());
  assert.strictEqual(oob.period, "Q4 2026");
})();

// --- buildRequest -----------------------------------------------------------
(function () {
  // The wizard's own default state: Peak / Q1 2027 / 1.0 MW across 4 sites --
  // the combination the portal mockup hardcodes as "1,000 MW / 768,00 MWh".
  var wizard = { direction: "Buy", shape: "Peak", periodType: "quarter", monthIdx: 0, quarterIdx: 1,
                 volumes: { rot: 0.200, venlo: 0.300, tilburg: 0.400, almere: 0.100 }, note: "" };
  var req = Link.buildRequest(wizard, opts({ submittedAt: "2026-08-11T10:00:00Z" }));

  assert.strictEqual(req.id, "TRD-1079");
  assert.strictEqual(req.customer, "Vandersteen Koeling");
  assert.strictEqual(req.direction, "Buy");
  assert.strictEqual(req.shape, "Peak");
  assert.strictEqual(req.period, "Q1 2027");
  assert.strictEqual(req.periodType, "quarter");
  assertClose(req.powerMw, 1.0, "power sums the per-connection volumes");
  assertClose(req.volumeMwh, 768, "volume = power x peak hours in Q1 2027");
  assertClose(req.indicativePrice, 94.75, "Peak shape takes the period's peak price");
  assert.strictEqual(req.status, "Awaiting price");
  assert.strictEqual(req.connections.length, 4, "only connections with volume are carried");
  assert.deepStrictEqual(req.connections[0], { id: "rot", name: "Rotterdam DC", sub: "…0011", powerMw: 0.2 });

  // Base shape takes the base price and the full-hours volume.
  var baseReq = Link.buildRequest({ ...wizard, shape: "Base" }, opts());
  assertClose(baseReq.indicativePrice, 82.75, "Base shape takes the base price");
  assertClose(baseReq.volumeMwh, 1.0 * 90 * 24, "base volume spans every hour");

  // Zero-volume connections are dropped entirely.
  var sparse = Link.buildRequest({ ...wizard, volumes: { rot: 0.5, venlo: 0, tilburg: 0 } }, opts());
  assert.strictEqual(sparse.connections.length, 1, "zero-volume connections are omitted");
  assertClose(sparse.powerMw, 0.5);

  // No volumes at all -> a well-formed request with zero power, not a crash.
  var empty = Link.buildRequest({ ...wizard, volumes: {} }, opts());
  assertClose(empty.powerMw, 0);
  assertClose(empty.volumeMwh, 0);
  assert.strictEqual(empty.connections.length, 0);
})();

// --- toDeskCard -------------------------------------------------------------
(function () {
  var wizard = { direction: "Buy", shape: "Peak", periodType: "quarter", quarterIdx: 1,
                 volumes: { rot: 0.200, venlo: 0.300, tilburg: 0.400, almere: 0.100 }, note: "" };
  var card = Link.toDeskCard(Link.buildRequest(wizard, opts()));
  assert.strictEqual(card.id, "TRD-1079");
  assert.strictEqual(card.column, "toPrice", "live requests land in the To price queue");
  assert.strictEqual(card.customer, "Vandersteen Koeling");
  assert.strictEqual(card.period, "Q1-27", "desk uses the short period label");
  assert.strictEqual(card.power, "1,000 MW");
  assert.strictEqual(card.valueLabel, "768,00 MWh");
  assert.strictEqual(card.meta, "Peak · Q1-27 · 1,000 MW", "meta matches the seeded cards' format");
  assert.strictEqual(card.actionLabel, "open to price →");
  assert.strictEqual(card.live, true, "live cards are distinguishable from seeded ones");
  assert.strictEqual(card.request.note, "");
})();

// --- persistence ------------------------------------------------------------
(function () {
  var s = fakeStorage();
  assert.deepStrictEqual(Link.read(s), [], "empty storage reads as an empty list");

  Link.publish(s, { id: "TRD-1079", customer: "A" });
  Link.publish(s, { id: "TRD-1080", customer: "B" });
  var list = Link.read(s);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].id, "TRD-1079", "oldest first");
  assert.strictEqual(list[1].id, "TRD-1080");

  // Re-publishing an id replaces rather than duplicating.
  Link.publish(s, { id: "TRD-1079", customer: "A2" });
  var after = Link.read(s);
  assert.strictEqual(after.length, 2, "re-publishing does not duplicate");
  assert.strictEqual(after[after.length - 1].customer, "A2", "the newer copy wins");

  Link.clear(s);
  assert.deepStrictEqual(Link.read(s), []);

  // publish reports write failure, so callers can fall back.
  assert.strictEqual(Link.publish({ getItem: function () { return null; },
    setItem: function () { throw new Error("quota"); } }, { id: "x" }), false,
    "publish returns false when the write fails");
  assert.ok(Link.publish(fakeStorage(), { id: "x" }), "publish returns the list on success");

  // Corrupt / non-array payloads degrade to empty instead of throwing.
  assert.deepStrictEqual(Link.read(fakeStorage({ "peakpower.tradeRequests.v1": "{not json" })), []);
  assert.deepStrictEqual(Link.read(fakeStorage({ "peakpower.tradeRequests.v1": '{"a":1}' })), []);
  assert.deepStrictEqual(Link.read(null), [], "no storage at all is survivable");

  // A storage that throws (quota / private mode) must not break the caller.
  var hostile = { getItem: function () { throw new Error("nope"); },
                  setItem: function () { throw new Error("nope"); } };
  assert.deepStrictEqual(Link.read(hostile), []);
  assert.strictEqual(Link.write(hostile, []), false, "write reports failure rather than throwing");
})();

// --- subscribe --------------------------------------------------------------
(function () {
  var handlers = {};
  var s = fakeStorage();
  var win = {
    localStorage: s,
    addEventListener: function (t, h) { handlers[t] = h; },
    removeEventListener: function (t) { delete handlers[t]; }
  };
  var seen = null;
  var off = Link.subscribe(win, function (list) { seen = list; });
  Link.publish(s, { id: "TRD-1079" });

  handlers.storage({ key: "peakpower.tradeRequests.v1" });
  assert.strictEqual(seen.length, 1, "fires for our key");

  seen = null;
  handlers.storage({ key: "something.else" });
  assert.strictEqual(seen, null, "ignores other keys");

  off();
  assert.strictEqual(handlers.storage, undefined, "unsubscribe detaches the listener");
  assert.doesNotThrow(function () { Link.subscribe(null, function () {})(); }, "no window is survivable");
})();

// --- pricing: the Back Office -> Customer leg -------------------------------
var WIZ = { direction: "Buy", shape: "Peak", periodType: "quarter", quarterIdx: 1,
            volumes: { rot: 0.200, venlo: 0.300, tilburg: 0.400, almere: 0.100 }, note: "" };
var T0 = "2026-08-11T10:00:00.000Z";
function pricedFixture(extra) {
  var req = Link.buildRequest(WIZ, opts({ submittedAt: T0 }));
  var o = { priceMwh: 94.75, now: T0 };
  for (var k in (extra || {})) { o[k] = extra[k]; }
  return Link.priceRequest(req, o);
}

(function () {
  var req = Link.buildRequest(WIZ, opts({ submittedAt: T0 }));
  assert.strictEqual(Link.isPriced(req), false, "a fresh request is unpriced");
  assert.strictEqual(Link.effectiveStatus(req), "Awaiting price");

  var priced = Link.priceRequest(req, { priceMwh: 94.75, now: T0 });
  assert.strictEqual(req.offer, undefined, "priceRequest does not mutate its input");
  assert.strictEqual(Link.isPriced(priced), true);
  assert.strictEqual(priced.status, "Offer received");
  assertClose(priced.offer.priceMwh, 94.75);
  // Value is derived from the request's own computed volume (768 MWh).
  assertClose(priced.offer.valueEur, 94.75 * 768, "value = price x volume");
  assert.strictEqual(priced.offer.reactionMinutes, 30, "default reaction window");
  assert.strictEqual(priced.offer.pricedBy, "PeakPower Trading");
  assert.strictEqual(priced.offer.expiresAt, "2026-08-11T10:30:00.000Z", "expiry = priced + window");

  // A custom window and desk operator carry through.
  var custom = Link.priceRequest(req, { priceMwh: 80, reactionMinutes: 5, pricedBy: "M. Bakker", now: T0 });
  assert.strictEqual(custom.offer.expiresAt, "2026-08-11T10:05:00.000Z");
  assert.strictEqual(custom.offer.pricedBy, "M. Bakker");

  // Invalid prices are rejected rather than producing a broken offer.
  [0, -5, NaN, "abc", null, undefined].forEach(function (bad) {
    assert.strictEqual(Link.priceRequest(req, { priceMwh: bad }), null, "rejects price " + bad);
  });
})();

// --- countdown --------------------------------------------------------------
(function () {
  var priced = pricedFixture();
  assert.strictEqual(Link.secondsRemaining(priced, T0), 1800, "full window at t=0");
  assert.strictEqual(Link.secondsRemaining(priced, "2026-08-11T10:29:00.000Z"), 60);
  assert.strictEqual(Link.secondsRemaining(priced, "2026-08-11T10:30:00.000Z"), 0, "exactly at expiry");
  assert.strictEqual(Link.secondsRemaining(priced, "2026-08-11T11:00:00.000Z"), 0, "never negative");
  assert.strictEqual(Link.secondsRemaining({ id: "x" }), 0, "unpriced has no countdown");

  assert.strictEqual(Link.isExpired(priced, T0), false);
  assert.strictEqual(Link.isExpired(priced, "2026-08-11T10:30:01.000Z"), true);
  assert.strictEqual(Link.effectiveStatus(priced, "2026-08-11T10:31:00.000Z"), "Offer expired");

  assert.strictEqual(Link.mmss(0), "00:00");
  assert.strictEqual(Link.mmss(59), "00:59");
  assert.strictEqual(Link.mmss(60), "01:00");
  assert.strictEqual(Link.mmss(1800), "30:00");
  assert.strictEqual(Link.mmss(3661), "1:01:01", "past an hour");
  assert.strictEqual(Link.mmss(-5), "00:00", "floors at zero");

  // These are natural map() callbacks, so a bare `list.map(toDeskCard)` would
  // pass the array index as `now`. Small numbers must fall back to the real
  // clock rather than being read as epoch-1970, which would show a countdown
  // of hundreds of thousands of hours.
  var mapped = [priced].map(Link.toDeskCard);
  assert.ok(/^\d{1,2}:\d{2}(:\d{2})?$/.test(mapped[0].tag) || mapped[0].tag === "expired",
    "index-as-now must not produce a 1970 countdown, got " + mapped[0].tag);
  // (The fixture's expiry is a fixed timestamp, so against the real clock the
  // remainder is some sane bounded value — the point is that it is not the
  // ~500,000 hours an epoch-1970 baseline would give.)
  var mappedTrade = [priced].map(Link.toCustomerTrade);
  assert.ok(mappedTrade[0].secondsRemaining < 24 * 3600,
    "index-as-now must not inflate secondsRemaining, got " + mappedTrade[0].secondsRemaining);
  assert.strictEqual(Link.secondsRemaining(priced, "not a date") >= 0, true, "garbage now falls back safely");

  assert.strictEqual(Link.countdownTone(4 * 60), "critical");
  assert.strictEqual(Link.countdownTone(10 * 60), "warning");
  assert.strictEqual(Link.countdownTone(20 * 60), "neutral");
})();

// --- priced request -> desk card --------------------------------------------
(function () {
  var priced = pricedFixture();
  var card = Link.toDeskCard(priced, T0);
  assert.strictEqual(card.column, "awaiting", "a priced request leaves the To price queue");
  assert.strictEqual(card.tag, "30:00", "tag is the live countdown");
  assert.strictEqual(card.tagTone, "neutral", "30 min out is not yet urgent");
  assert.strictEqual(card.valueLabel, "€ " + Link.formatNL(94.75 * 768, 0), "desk shows the offer value");
  assert.strictEqual(card.actionLabel, "view offer →");
  assert.strictEqual(card.urgent, false);

  var soon = Link.toDeskCard(priced, "2026-08-11T10:26:00.000Z");
  assert.strictEqual(soon.tag, "04:00");
  assert.strictEqual(soon.tagTone, "critical");
  assert.strictEqual(soon.urgent, true, "under 5 minutes is urgent");

  var gone = Link.toDeskCard(priced, "2026-08-11T10:31:00.000Z");
  assert.strictEqual(gone.tag, "expired");
  assert.strictEqual(gone.actionLabel, "offer expired");
  assert.strictEqual(gone.column, "awaiting", "an expired offer stays in its column");
})();

// --- request -> customer trade ----------------------------------------------
(function () {
  // Unpriced: shows as awaiting price, not pending, no price/value.
  var req = Link.buildRequest(WIZ, opts({ submittedAt: T0 }));
  var t = Link.toCustomerTrade(req, T0);
  assert.strictEqual(t.id, "TRD-1079");
  assert.strictEqual(t.status, "Awaiting price");
  assert.strictEqual(t.pending, false);
  assert.strictEqual(t.price, null);
  assert.strictEqual(t.value, null);
  assert.strictEqual(t.power, "1,000 MW");
  assert.strictEqual(t.volume, "768,00 MWh");
  assert.strictEqual(t.events.length, 1, "only the submission event");
  assert.strictEqual(t.linked, true, "linked trades are distinguishable from seeded ones");

  // Priced and live: pending, with a countdown the portal's banner can render.
  var priced = pricedFixture();
  var pt = Link.toCustomerTrade(priced, T0);
  assert.strictEqual(pt.status, "Offer received");
  assert.strictEqual(pt.pending, true, "a live offer is pending, driving the firm-offer banner");
  assert.strictEqual(pt.statusTone, "warning");
  assert.strictEqual(pt.secondsRemaining, 1800);
  assert.strictEqual(pt.secondsTotal, 1800);
  assert.strictEqual(pt.price, "€ 94,7500");
  assert.strictEqual(pt.value, "€ " + Link.formatNL(94.75 * 768, 2));
  assert.strictEqual(pt.events.length, 2, "submission + offer published");
  assert.strictEqual(pt.events[1].title, "Offer published");
  assert.ok(pt.facts.some(function (f) { return f[0] === "Offered price"; }), "facts carry the offered price");

  // Priced but expired: no longer pending, and says so on the timeline.
  var ex = Link.toCustomerTrade(priced, "2026-08-11T10:31:00.000Z");
  assert.strictEqual(ex.status, "Offer expired");
  assert.strictEqual(ex.pending, false, "an expired offer must not keep counting down");
  assert.strictEqual(ex.statusTone, "critical");
  assert.strictEqual(ex.secondsRemaining, 0);
  assert.strictEqual(ex.events.length, 3, "submission + offer + expiry");
  assert.strictEqual(ex.events[2].title, "Offer expired");

  // A note becomes the submission event's body.
  var noted = Link.buildRequest({ ...WIZ, note: "Hedging Q1 growth." }, opts({ submittedAt: T0 }));
  assert.ok(/Hedging Q1 growth\./.test(Link.toCustomerTrade(noted, T0).events[0].body));
})();

// --- accept / reject --------------------------------------------------------
(function () {
  var priced = pricedFixture();

  // Accept.
  var acc = Link.acceptOffer(priced, { by: "M. Vandersteen · Finance", now: T0 });
  assert.strictEqual(priced.response, undefined, "acceptOffer does not mutate its input");
  assert.strictEqual(Link.isResolved(acc), true);
  assert.strictEqual(acc.response.action, "accept");
  assert.strictEqual(acc.response.by, "M. Vandersteen · Finance");
  assert.strictEqual(Link.effectiveStatus(acc, T0), "Accepted · awaiting execution");

  // Reject.
  var rej = Link.rejectOffer(priced, { now: T0 });
  assert.strictEqual(rej.response.action, "reject");
  assert.strictEqual(Link.effectiveStatus(rej, T0), "Offer rejected");

  // A decision is final: it outranks the clock, so an accepted trade must not
  // later read as "expired" once its window elapses.
  assert.strictEqual(Link.effectiveStatus(acc, "2026-08-11T11:00:00.000Z"), "Accepted · awaiting execution",
    "an accepted trade never reverts to expired");
  assert.strictEqual(Link.effectiveStatus(rej, "2026-08-11T11:00:00.000Z"), "Offer rejected");

  // Guards: cannot act twice, cannot act on an unpriced request, and cannot
  // accept an expired offer even if a stale screen still shows the button.
  assert.strictEqual(Link.acceptOffer(acc, { now: T0 }), null, "cannot accept twice");
  assert.strictEqual(Link.rejectOffer(acc, { now: T0 }), null, "cannot reject an accepted offer");
  assert.strictEqual(Link.acceptOffer(Link.buildRequest(WIZ, opts()), { now: T0 }), null,
    "cannot accept an unpriced request");
  assert.strictEqual(Link.acceptOffer(priced, { now: "2026-08-11T10:31:00.000Z" }), null,
    "cannot accept after expiry");
  assert.strictEqual(Link.respondToOffer(priced, "maybe", { now: T0 }), null, "unknown action rejected");
  // Rejecting an expired offer is still allowed — it just records the decline.
  assert.ok(Link.rejectOffer(priced, { now: "2026-08-11T10:31:00.000Z" }), "an expired offer can still be declined");

  // Desk routing: accepted -> To confirm, rejected -> off the desk.
  var accCard = Link.toDeskCard(acc, T0);
  assert.strictEqual(accCard.column, "confirm", "accepted trades move to To confirm");
  assert.strictEqual(accCard.tag, "accepted");
  assert.strictEqual(accCard.actionLabel, "confirm or fail →");
  var rejCard = Link.toDeskCard(rej, T0);
  assert.strictEqual(rejCard.column, "done", "rejected trades leave the three desk queues");

  // Customer view: no longer pending, with the decision on the timeline.
  var accT = Link.toCustomerTrade(acc, T0);
  assert.strictEqual(accT.pending, false, "an answered offer is no longer actionable");
  assert.strictEqual(accT.resolved, true);
  assert.strictEqual(accT.responseAction, "accept");
  // Accepted is amber, not green: the trade is reserved but not yet executed.
  // Green is reserved for Confirmed (see the confirm section below).
  assert.strictEqual(accT.statusTone, "warning");
  assert.strictEqual(accT.events.length, 3, "submitted + offered + accepted");
  assert.strictEqual(accT.events[2].title, "Offer accepted");
  assert.ok(accT.facts.some(function (f) { return f[0] === "Accepted by"; }));
  var rejT = Link.toCustomerTrade(rej, T0);
  assert.strictEqual(rejT.statusTone, "critical");
  assert.strictEqual(rejT.events[2].title, "Offer rejected");
  assert.ok(rejT.facts.some(function (f) { return f[0] === "Rejected by"; }));

  // Round-trips through storage intact.
  var s = fakeStorage();
  Link.publish(s, acc);
  var back = Link.read(s)[0];
  assert.strictEqual(Link.isResolved(back), true);
  assert.strictEqual(Link.toDeskCard(back, T0).column, "confirm");
})();

// --- confirm ----------------------------------------------------------------
(function () {
  var priced = pricedFixture();
  var acc = Link.acceptOffer(priced, { now: T0 });
  var rej = Link.rejectOffer(priced, { now: T0 });

  var conf = Link.confirmTrade(acc, { by: "M. Bakker · Trading", reference: "ICE-1079-A", now: T0 });
  assert.strictEqual(acc.confirmation, undefined, "confirmTrade does not mutate its input");
  assert.strictEqual(Link.isConfirmed(conf), true);
  assert.strictEqual(conf.status, "Confirmed");
  assert.strictEqual(Link.effectiveStatus(conf, T0), "Confirmed");
  assert.strictEqual(conf.confirmation.by, "M. Bakker · Trading");
  assert.strictEqual(conf.confirmation.reference, "ICE-1079-A");

  // Confirmation outranks the clock too.
  assert.strictEqual(Link.effectiveStatus(conf, "2026-08-11T11:00:00.000Z"), "Confirmed");

  // Only an accepted trade can be confirmed.
  assert.strictEqual(Link.confirmTrade(priced, { now: T0 }), null, "cannot confirm an unanswered offer");
  assert.strictEqual(Link.confirmTrade(rej, { now: T0 }), null, "cannot confirm a rejected offer");
  assert.strictEqual(Link.confirmTrade(Link.buildRequest(WIZ, opts()), { now: T0 }), null,
    "cannot confirm an unpriced request");
  assert.strictEqual(Link.confirmTrade(conf, { now: T0 }), null, "cannot confirm twice");

  // Desk: a confirmed trade leaves every queue.
  var accCard = Link.toDeskCard(acc, T0);
  assert.strictEqual(accCard.column, "confirm");
  assert.strictEqual(accCard.confirmable, true, "accepted cards expose a Confirm action");
  var confCard = Link.toDeskCard(conf, T0);
  assert.strictEqual(confCard.column, "done", "a confirmed trade clears out of To confirm");
  assert.strictEqual(confCard.tag, "confirmed");

  // Customer: status Confirmed, success tone, with the execution on the timeline.
  var ct = Link.toCustomerTrade(conf, T0);
  assert.strictEqual(ct.status, "Confirmed");
  assert.strictEqual(ct.confirmed, true);
  assert.strictEqual(ct.statusTone, "success");
  assert.strictEqual(ct.pending, false);
  assert.strictEqual(ct.events.length, 4, "submitted + offered + accepted + confirmed");
  assert.strictEqual(ct.events[3].title, "Trade confirmed");
  assert.ok(/ICE-1079-A/.test(ct.events[3].body), "the market reference is on the timeline");
  assert.ok(ct.facts.some(function (f) { return f[0] === "Confirmed by"; }));
  assert.ok(ct.facts.some(function (f) { return f[0] === "Market reference"; }));
  // An accepted-but-unconfirmed trade is amber, not green.
  assert.strictEqual(Link.toCustomerTrade(acc, T0).statusTone, "warning");

  // Round-trips through storage.
  var s = fakeStorage();
  Link.publish(s, conf);
  var back = Link.read(s)[0];
  assert.strictEqual(Link.isConfirmed(back), true);
  assert.strictEqual(Link.toCustomerTrade(back, T0).status, "Confirmed");
})();

// --- formatStamp ------------------------------------------------------------
(function () {
  // Local-time formatting, so assert against a locally-constructed date rather
  // than a fixed string (the suite must pass in any timezone).
  var d = new Date(2026, 7, 11, 9, 5, 3);
  assert.strictEqual(Link.formatStamp(d.toISOString()), "11 Aug 2026, 09:05:03");
  assert.strictEqual(Link.formatStamp("not a date"), "not a date", "garbage passes through");
})();

// --- round trip through storage ---------------------------------------------
(function () {
  var s = fakeStorage();
  var req = Link.buildRequest(WIZ, opts({ submittedAt: T0 }));
  Link.publish(s, req);
  assert.strictEqual(Link.read(s)[0].status, "Awaiting price");

  // The desk prices it and re-publishes under the same id.
  Link.publish(s, Link.priceRequest(Link.read(s)[0], { priceMwh: 94.75, now: T0 }));
  var list = Link.read(s);
  assert.strictEqual(list.length, 1, "pricing replaces rather than appending");
  assert.strictEqual(list[0].status, "Offer received");
  assertClose(list[0].offer.priceMwh, 94.75);
  // ...and survives JSON serialisation intact.
  assert.strictEqual(Link.toDeskCard(list[0], T0).column, "awaiting");
  assert.strictEqual(Link.toCustomerTrade(list[0], T0).pending, true);
})();

console.log("portal-trade-link.test.js: all assertions passed");
