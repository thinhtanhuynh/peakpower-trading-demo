/*
 * Unit tests for portal-demo-clock.js — the demo clock, and the states it is
 * built to reach. Node only, no browser:
 *
 *   node portal-demo-clock.test.js
 *
 * Pinned to Europe/Amsterdam because two of these tests are about what happens
 * across a DST boundary, which is only a boundary in a zone that has one. Set
 * before anything reads a Date.
 */
process.env.TZ = "Europe/Amsterdam";

var assert = require("assert");
var Clock = require("./portal-demo-clock.js");
var Terms = require("./portal-terms-link.js");

/** Minimal localStorage stand-in. */
function fakeStorage(initial) {
  var data = initial || {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    _data: data
  };
}

/** Local ms for a date/time, so the tests read as wall-clock times. */
function at(y, m, d, hh, mm) { return new Date(y, m - 1, d, hh || 0, mm || 0).getTime(); }

// --- parseOffset: whole days, plausible range -------------------------------
(function () {
  assert.strictEqual(Clock.parseOffset(0), 0, "zero is a real offset, not a missing one");
  assert.strictEqual(Clock.parseOffset(43), 43, "a plain integer");
  assert.strictEqual(Clock.parseOffset(-5), -5, "backwards is allowed too");
  assert.strictEqual(Clock.parseOffset("43"), 43, "a stored string parses");
  assert.strictEqual(Clock.parseOffset(1.5), null, "half a day is not a day");
  assert.strictEqual(Clock.parseOffset("1.5"), null, "…and a stored \"1.5\" is refused too, not truncated to 1");
  assert.strictEqual(Clock.parseOffset("43abc"), null, "a string is matched whole, not up to the first bad character");
  assert.strictEqual(Clock.parseOffset("-5"), -5, "a negative string still parses");
  assert.strictEqual(Clock.parseOffset(" 43 "), 43, "surrounding space is fine");
  assert.strictEqual(Clock.parseOffset("abc"), null, "words");
  assert.strictEqual(Clock.parseOffset(null), null, "null");
  assert.strictEqual(Clock.parseOffset(NaN), null, "NaN");
  assert.strictEqual(Clock.parseOffset(Infinity), null, "infinity");
  assert.strictEqual(Clock.parseOffset(Clock.MAX_OFFSET_DAYS), 3650, "the edge of the range is in range");
  assert.strictEqual(Clock.parseOffset(Clock.MAX_OFFSET_DAYS + 1), null, "past it is corruption, not intent");
  assert.strictEqual(Clock.parseOffset(-Clock.MAX_OFFSET_DAYS - 1), null, "…in both directions");
})();

// --- storage: round trip, and every failure landing on the real clock -------
(function () {
  var s = fakeStorage();
  assert.strictEqual(Clock.read(s), 0, "nothing stored reads as the real clock");

  assert.strictEqual(Clock.write(s, 43), true, "a whole-day offset is stored");
  assert.strictEqual(Clock.read(s), 43, "…and reads back");

  assert.strictEqual(Clock.write(s, -5), true, "backwards stores too");
  assert.strictEqual(Clock.read(s), -5, "…and reads back");

  // A refused write must leave what was already there untouched.
  assert.strictEqual(Clock.write(s, 1.5), false, "a fractional offset is refused");
  assert.strictEqual(Clock.read(s), -5, "…and the stored offset is unchanged");
  assert.strictEqual(Clock.write(s, 99999), false, "an out-of-range offset is refused");
  assert.strictEqual(Clock.read(s), -5, "…and the stored offset is still unchanged");

  // Keyed off Clock.STORAGE_KEY, not a copy of the literal: with a hardcoded
  // key that drifted from the module's, read() would simply find nothing,
  // return 0, and every one of these would pass without touching the
  // corruption path it claims to test.
  function corrupt(value) { var o = {}; o[Clock.STORAGE_KEY] = value; return fakeStorage(o); }
  assert.strictEqual(Clock.read(corrupt('{"offsetDays":43}')), 43,
    "the fixture really is stored where read() looks — the other four mean nothing otherwise");
  assert.strictEqual(Clock.read(corrupt("{not json")), 0,
    "unparseable storage reads as the real clock, never throws");
  assert.strictEqual(Clock.read(corrupt("[]")), 0, "an array is not a settings object");
  assert.strictEqual(Clock.read(corrupt('{"offsetDays":"junk"}')), 0,
    "a corrupted offset reads as the real clock");
  assert.strictEqual(Clock.read(corrupt('{"offsetDays":"1.5"}')), 0,
    "a stored fraction is refused the same way the number 1.5 is, not truncated to 1");
  assert.strictEqual(Clock.read(corrupt('{"offsetDays":99999}')), 0,
    "an out-of-range stored offset reads as the real clock");

  // Private mode: setItem throws. write() must report the failure, not raise.
  var hostile = { getItem: function () { return null; }, setItem: function () { throw new Error("QuotaExceeded"); } };
  assert.strictEqual(Clock.write(hostile, 10), false, "a storage failure returns false rather than throwing");
  assert.strictEqual(Clock.read({ getItem: function () { throw new Error("blocked"); } }), 0,
    "a read failure lands on the real clock");
})();

// --- now(): an offset, not a freeze ----------------------------------------
(function () {
  var real = at(2026, 8, 20, 14, 30);
  assert.strictEqual(Clock.now(0, real), real, "no offset is the real clock, untouched");
  assert.strictEqual(Clock.now(null, real), real, "an absent offset is the real clock");
  assert.strictEqual(Clock.now("junk", real), real, "a corrupted offset is the real clock");

  assert.strictEqual(Clock.now(43, real), at(2026, 10, 2, 14, 30), "+43 days lands on 2 Oct, same time of day");
  assert.strictEqual(Clock.now(-5, real), at(2026, 8, 15, 14, 30), "−5 days goes backwards");

  // The clock still runs: two real instants a minute apart stay a minute apart
  // in the faked present, which is what keeps an offer's countdown ticking.
  var a = Clock.now(43, real);
  var b = Clock.now(43, real + 60000);
  assert.strictEqual(b - a, 60000, "the faked clock advances with the real one");
})();

// --- DST: shifted by calendar days, not by 86_400_000 ms --------------------
(function () {
  // 2026-03-29 is the spring-forward day in Europe/Amsterdam: 02:00 -> 03:00,
  // so the day is 23 hours long. Adding a flat 24h from the evening before
  // overshoots into the 30th; adding a calendar day does not.
  var eve = at(2026, 3, 28, 23, 30);
  assert.strictEqual(Clock.now(1, eve), at(2026, 3, 29, 23, 30),
    "+1 day across spring forward keeps the wall-clock time");
  assert.strictEqual(Clock.dateForOffset(1, eve), "2026-03-29",
    "…and therefore lands on the intended date, not the one after");
  assert.notStrictEqual(Clock.now(1, eve), eve + 86400000,
    "a flat 24 hours would have been a different instant — that is the point");

  // The autumn change runs the other way: the clocks go back at 03:00 on
  // 2026-10-25, so that day is 25 hours long. The pair has to STRADDLE 03:00
  // to test anything — 24th 00:30 -> 25th 00:30 is a flat 24 hours and would
  // pass under the very arithmetic this is here to rule out.
  var autumnEve = at(2026, 10, 25, 0, 30);
  assert.strictEqual((at(2026, 10, 26, 0, 30) - autumnEve) / 3600000, 25,
    "the chosen pair really does straddle the transition");
  assert.strictEqual(Clock.now(1, autumnEve), at(2026, 10, 26, 0, 30),
    "+1 day across fall back keeps the wall-clock time");
  assert.notStrictEqual(Clock.now(1, autumnEve), autumnEve + 86400000,
    "a flat 24 hours would have landed at 23:30 on the 25th — the wrong day");
})();

// --- offsetForDate / dateForOffset: exact, and inverse of each other --------
(function () {
  var real = at(2026, 8, 20, 14, 30);
  assert.strictEqual(Clock.offsetForDate("2026-08-20", real), 0, "today is no offset");
  assert.strictEqual(Clock.offsetForDate("2026-10-02", real), 43, "counted in whole days");
  assert.strictEqual(Clock.offsetForDate("2026-08-15", real), -5, "a past date is negative");

  // Late in the evening the answer must not drift by a day.
  var lateReal = at(2026, 8, 20, 23, 55);
  assert.strictEqual(Clock.offsetForDate("2026-10-02", lateReal), 43, "counted between midnights, not from 'now'");
  var earlyReal = at(2026, 8, 20, 0, 5);
  assert.strictEqual(Clock.offsetForDate("2026-10-02", earlyReal), 43, "…at either end of the day");

  // Across the spring-forward boundary the interval is one hour short of
  // 8 × 24h; rounding between midnights is what keeps it a clean 8.
  assert.strictEqual(Clock.offsetForDate("2026-04-05", at(2026, 3, 28, 12, 0)), 8,
    "whole days across a DST change");

  assert.strictEqual(Clock.offsetForDate("junk", real), null, "an unparseable date");
  assert.strictEqual(Clock.offsetForDate("2026-02-30", real), null,
    "30 February does not exist — refused, not silently rolled forward to 2 March");
  assert.strictEqual(Clock.offsetForDate("2026-13-45", real), null, "a month and day that cannot exist");
  assert.strictEqual(Clock.offsetForDate("2026-8-20", real), null, "an unpadded date is not the format <input type=date> emits");
  assert.strictEqual(Clock.offsetForDate("2026-02-28", real), -173, "…while a real February date is fine");
  assert.strictEqual(Clock.offsetForDate("", real), null, "an empty date");
  assert.strictEqual(Clock.offsetForDate(null, real), null, "no date");
  assert.strictEqual(Clock.offsetForDate("2099-01-01", real), null, "beyond the plausible range");

  // Round trip: setting a date then reading it back gives the same date.
  ["2026-08-20", "2026-10-02", "2026-12-31", "2027-03-01", "2026-03-29"].forEach(function (iso) {
    var off = Clock.offsetForDate(iso, real);
    assert.strictEqual(Clock.dateForOffset(off, real), iso, "round trip through " + iso);
  });
})();

// --- label ------------------------------------------------------------------
(function () {
  assert.strictEqual(Clock.label(0), "today", "no offset says so in words");
  assert.strictEqual(Clock.label(null), "today", "an absent offset reads as today");
  assert.strictEqual(Clock.label("junk"), "today", "so does a corrupted one");
  assert.strictEqual(Clock.label(1), "+1 day", "singular");
  assert.strictEqual(Clock.label(43), "+43 days", "plural");
  assert.strictEqual(Clock.label(-1), "−1 day", "backwards, singular, real minus sign");
  assert.strictEqual(Clock.label(-5), "−5 days", "backwards, plural");
})();

// --- what the clock is FOR: walking a balance to overdue and paying it ------
//
// The demo narrative, pinned end to end. A Q4-2026 block accepted on 20 Aug
// has its balance due 30 Sep — 41 days out, so nothing on any screen says
// anything is owed yet. These are the three clock positions a demo needs.
(function () {
  var real = at(2026, 8, 20, 14, 30);
  var settlement = Terms.buildSettlement(76800, 20, "2026-10-01");

  assert.strictEqual(settlement.dueDate, "2026-09-30", "due the day before delivery starts");
  assert.strictEqual(settlement.depositEur, 15360, "20 % paid up front");
  assert.strictEqual(settlement.balanceEur, 61440, "80 % is what the demo goes on to pay");

  function stateAt(iso) {
    return Terms.balanceState(settlement, Clock.now(Clock.offsetForDate(iso, real), real));
  }

  assert.strictEqual(stateAt("2026-08-20"), "scheduled",
    "on the real day of the demo nothing is owed yet — which is why the clock exists");
  assert.strictEqual(stateAt("2026-09-15"), "scheduled", "15 days out is still outside the 14-day horizon");
  assert.strictEqual(stateAt("2026-09-16"), "due-soon", "14 days out is the first day it is called due soon");
  assert.strictEqual(stateAt("2026-09-30"), "due-soon", "the due date itself is due, not yet late");
  assert.strictEqual(stateAt("2026-10-01"), "overdue", "the day delivery starts, it is late");
  assert.strictEqual(stateAt("2026-10-02"), "overdue", "…and stays late");

  var jumped = Clock.now(Clock.offsetForDate("2026-10-02", real), real);
  assert.strictEqual(Terms.daysUntilDue(settlement, jumped), -2, "overdue by exactly 2 days");

  // Paid outranks the clock: a balance settled on time never reads as overdue
  // later just because the demo clock has been pushed past the due date.
  var paid = {};
  for (var k in settlement) { paid[k] = settlement[k]; }
  paid.paidAt = "2026-09-29T10:00:00.000Z";
  assert.strictEqual(Terms.balanceState(paid, jumped), "paid",
    "paying then jumping forward still reads as paid, never overdue");
})();

console.log("portal-demo-clock.test.js: all assertions passed");
