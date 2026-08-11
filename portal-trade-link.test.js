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

console.log("portal-trade-link.test.js: all assertions passed");
