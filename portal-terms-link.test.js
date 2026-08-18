/*
 * Unit tests for portal-terms-link.js — the deposit percentage and the
 * settlement maths behind it. Node only, no browser, no fixtures to fetch:
 *
 *   node portal-terms-link.test.js
 */
var assert = require("assert");
var Terms = require("./portal-terms-link.js");

function close(a, b, msg) {
  assert.ok(Math.abs(a - b) < 1e-9, msg + " (expected " + b + ", got " + a + ")");
}

/** Minimal localStorage stand-in. */
function fakeStorage(initial) {
  var data = initial || {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    _data: data
  };
}

// --- parsePct: accepts what a person types, refuses what they can't mean ----
(function () {
  assert.strictEqual(Terms.parsePct("20"), 20, "plain integer");
  assert.strictEqual(Terms.parsePct("20,5"), 20.5, "NL comma decimal");
  assert.strictEqual(Terms.parsePct("20.5"), 20.5, "dot decimal");
  assert.strictEqual(Terms.parsePct(" 20 % "), 20, "spaces and a stray percent sign");
  assert.strictEqual(Terms.parsePct(35), 35, "a number, not a string");
  // 0 and 100 are real commercial terms, not edge cases to reject.
  assert.strictEqual(Terms.parsePct("0"), 0, "0 % — everything falls due before delivery");
  assert.strictEqual(Terms.parsePct("100"), 100, "100 % — paid in full up front");
  assert.strictEqual(Terms.parsePct("101"), null, "over 100 is not a share of anything");
  assert.strictEqual(Terms.parsePct("-5"), null, "negative");
  assert.strictEqual(Terms.parsePct("twenty"), null, "words");
  assert.strictEqual(Terms.parsePct(""), null, "empty");
  assert.strictEqual(Terms.parsePct(null), null, "null");
  assert.strictEqual(Terms.parsePct(NaN), null, "NaN");
})();

// --- the setting: default, override, isolation ------------------------------
(function () {
  assert.strictEqual(Terms.DEFAULT_DEPOSIT_PCT, 20, "the stated default");
  assert.strictEqual(Terms.depositPctFor({}, "34215678"), 20, "unknown customer falls back to the default");
  assert.strictEqual(Terms.depositPctFor(null, "34215678"), 20, "no terms at all falls back");
  assert.strictEqual(Terms.depositPctFor({ "34215678": { depositPct: "junk" } }, "34215678"), 20,
    "a corrupted stored value falls back to the default, never to 0");

  var terms = Terms.setDepositPct({}, "34215678", "35");
  assert.strictEqual(Terms.depositPctFor(terms, "34215678"), 35, "set then read");
  assert.strictEqual(Terms.depositPctFor(terms, "68812340"), 20, "another customer is unaffected");

  var two = Terms.setDepositPct(terms, "68812340", 50);
  assert.strictEqual(Terms.depositPctFor(two, "34215678"), 35, "setting one customer leaves the other alone");
  assert.strictEqual(Terms.depositPctFor(two, "68812340"), 50, "…and stores the new one");
  // Pure: the input map must not have been mutated.
  assert.strictEqual(terms["68812340"], undefined, "setDepositPct does not mutate its input");

  assert.strictEqual(Terms.setDepositPct(terms, "34215678", "abc"), null, "a rejected edit returns null");
  assert.strictEqual(Terms.setDepositPct(terms, null, 20), null, "no customer id is not a usable edit");
  assert.strictEqual(Terms.depositPctFor(terms, "34215678"), 35, "…and leaves the stored terms untouched");
})();

// --- storage round-trip, and the failure modes ------------------------------
(function () {
  var s = fakeStorage();
  assert.deepStrictEqual(Terms.read(s), {}, "empty storage reads as an empty map");

  assert.strictEqual(Terms.write(s, Terms.setDepositPct({}, "34215678", 25)), true, "write reports success");
  assert.strictEqual(Terms.depositPctFor(Terms.read(s), "34215678"), 25, "round-trips through storage");

  var corrupt = fakeStorage();
  corrupt.setItem(Terms.STORAGE_KEY, "{not json");
  assert.deepStrictEqual(Terms.read(corrupt), {}, "unparseable storage reads as empty, not a throw");
  assert.strictEqual(Terms.depositPctFor(Terms.read(corrupt), "34215678"), 20,
    "…so a corrupt link still charges the default deposit");

  var wrongShape = fakeStorage();
  wrongShape.setItem(Terms.STORAGE_KEY, "[1,2,3]");
  assert.deepStrictEqual(Terms.read(wrongShape), {}, "an array is not a terms map");

  var broken = { getItem: function () { throw new Error("denied"); }, setItem: function () { throw new Error("quota"); } };
  assert.deepStrictEqual(Terms.read(broken), {}, "a storage that throws on read");
  assert.strictEqual(Terms.write(broken, {}), false, "a storage that throws on write returns false");
})();

// --- splitDeposit: the two halves must add back to the whole -----------------
(function () {
  var s = Terms.splitDeposit(76800, 20);
  close(s.depositEur, 15360, "20 % of 76.800");
  close(s.balanceEur, 61440, "the remaining 80 %");
  close(s.depositEur + s.balanceEur, 76800, "deposit + balance = value");

  // The balance is the remainder, not its own percentage: at 33,33 % two
  // independent roundings would miss the total by a cent.
  var odd = Terms.splitDeposit(100, 33.33);
  close(odd.depositEur, 33.33, "33,33 % of 100");
  close(odd.depositEur + odd.balanceEur, 100, "still adds up exactly");

  var third = Terms.splitDeposit(0.01, 50);
  close(third.depositEur + third.balanceEur, 0.01, "a single cent still splits without leaking");

  close(Terms.splitDeposit(76800, 0).depositEur, 0, "0 % takes nothing up front");
  close(Terms.splitDeposit(76800, 0).balanceEur, 76800, "…and everything falls due later");
  close(Terms.splitDeposit(76800, 100).depositEur, 76800, "100 % takes it all up front");
  close(Terms.splitDeposit(76800, 100).balanceEur, 0, "…leaving nothing due");

  close(Terms.splitDeposit(76800, "junk").depositEur, 15360, "an unusable pct falls back to the default");
})();

// --- the due date is the day BEFORE delivery starts -------------------------
(function () {
  assert.strictEqual(Terms.balanceDueDate("2027-01-01"), "2026-12-31", "crosses the year boundary");
  assert.strictEqual(Terms.balanceDueDate("2026-07-01"), "2026-06-30", "crosses a month boundary");
  assert.strictEqual(Terms.balanceDueDate("2026-03-01"), "2026-02-28", "February, non-leap");
  assert.strictEqual(Terms.balanceDueDate("2026-07-15"), "2026-07-14", "mid-month");
  assert.strictEqual(Terms.balanceDueDate(null), null, "no period start, no due date");
})();

// --- appliesTo: a Sell owes nothing ----------------------------------------
(function () {
  assert.ok(Terms.appliesTo({ direction: "Buy" }), "a Buy carries a deposit");
  assert.ok(Terms.appliesTo({ direction: "buy" }), "…case-insensitively");
  assert.ok(!Terms.appliesTo({ direction: "Sell" }), "a Sell does not — the customer is the one being paid");
  assert.ok(!Terms.appliesTo(null), "no trade, no schedule");
})();

// --- balanceState: paid outranks the clock ----------------------------------
(function () {
  var due = Terms.buildSettlement(76800, 20, "2027-01-01");
  assert.strictEqual(due.dueDate, "2026-12-31", "settlement carries the due date");
  assert.strictEqual(due.paidAt, null, "…and starts unpaid");
  close(due.depositEur, 15360, "…with the deposit split in");

  assert.strictEqual(Terms.balanceState(due, "2026-08-18T10:00:00Z"), "scheduled", "months out");
  assert.strictEqual(Terms.balanceState(due, "2026-12-20T10:00:00Z"), "due-soon", "inside the 14-day horizon");
  assert.strictEqual(Terms.balanceState(due, "2026-12-31T09:00:00Z"), "due-soon",
    "the due date itself is still on time — counted in whole days, not 24h blocks");
  assert.strictEqual(Terms.balanceState(due, "2027-01-01T00:30:00Z"), "overdue", "the day after");

  assert.strictEqual(Terms.daysUntilDue(due, "2026-12-31T09:00:00Z"), 0, "0 days left on the due date");
  assert.strictEqual(Terms.daysUntilDue(due, "2027-01-03T09:00:00Z"), -3, "negative once past");

  var paid = Terms.buildSettlement(76800, 20, "2027-01-01");
  paid.paidAt = "2026-12-30T12:00:00Z";
  assert.strictEqual(Terms.balanceState(paid, "2027-06-01T00:00:00Z"), "paid",
    "a balance paid on time never later reads as overdue");

  var noPeriod = Terms.buildSettlement(1000, 20, null);
  assert.strictEqual(Terms.balanceState(noPeriod, "2026-08-18T10:00:00Z"), "scheduled",
    "no due date is not overdue");
})();

console.log("portal-terms-link.test.js: all assertions passed");
