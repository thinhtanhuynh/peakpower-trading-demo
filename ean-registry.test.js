/* node ean-registry.test.js */
var assert = require("assert");
var R = require("./ean-registry.js");

function test(name, fn) {
  try { fn(); console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}

/** localStorage's surface, for the parts this module uses. */
function fakeStorage(initial) {
  var data = initial || {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    _data: data
  };
}

function brokenStorage() {
  return {
    getItem: function () { throw new Error("private mode"); },
    setItem: function () { throw new Error("quota"); }
  };
}

console.log("ean-registry");

test("every pool row is complete and its EAN is eighteen digits", function () {
  var seen = {};
  R.UNASSIGNED.forEach(function (r) {
    assert.ok(/^\d{18}$/.test(r.ean), "bad EAN: " + r.ean);
    assert.ok(!seen[r.ean], "duplicate EAN: " + r.ean);
    seen[r.ean] = true;
    assert.ok(/^\d{4}[A-Z]{2}$/.test(r.postcode), "bad postcode: " + r.postcode);
    assert.ok(r.street && r.houseNumber && r.city, "incomplete address: " + r.ean);
    assert.ok(r.commodity === "Electricity" || r.commodity === "Gas", "bad commodity: " + r.commodity);
  });
});

// The seeded connections belong to Vandersteen already. Offering one as
// unassigned would let a second company take a metering point that is in use.
test("no pool row collides with a connection already in service", function () {
  var inService = ["871687100000000011", "871687100000000027", "871687100000000043",
    "871687100000000059", "871687100000000061", "871687100000000078", "871687100000000092"];
  R.UNASSIGNED.forEach(function (r) {
    assert.strictEqual(inService.indexOf(r.ean), -1, r.ean + " is already in service");
  });
});

test("an address reads street, number, postcode, city", function () {
  assert.strictEqual(
    R.formatAddress({ street: "Pekstraat", houseNumber: "24", postcode: "8232DP", city: "LELYSTAD" }),
    "Pekstraat 24, 8232DP LELYSTAD");
  assert.strictEqual(R.formatAddress(null), "");
});

test("an EAN displays in fours", function () {
  // Groups of four, so eighteen digits end in a pair — the grouping the
  // seeded connections already display (8716 8710 0000 0000 11).
  assert.strictEqual(R.formatEan("871687100000000114"), "8716 8710 0000 0001 14");
  assert.strictEqual(R.formatEan("8716 8710 0000 0000 11"), "8716 8710 0000 0000 11");
  assert.strictEqual(R.formatEan(""), "");
});

test("a postcode is the same however it is typed", function () {
  assert.strictEqual(R.normalisePostcode("3514 uh"), "3514UH");
  assert.strictEqual(R.normalisePostcode("3514UH"), "3514UH");
  assert.strictEqual(R.normalisePostcode("3514-Uh "), "3514UH");
});

test("digits alone are read as an EAN, letters and digits as an address", function () {
  assert.deepStrictEqual(R.parseQuery("8716871"), { kind: "ean", ean: "8716871" });
  assert.deepStrictEqual(R.parseQuery("8716 8710 0000"), { kind: "ean", ean: "871687100000" });
  assert.deepStrictEqual(R.parseQuery("8232DP"), { kind: "address", postcode: "8232DP", houseNumber: null });
  assert.deepStrictEqual(R.parseQuery("8232 dp 24"), { kind: "address", postcode: "8232DP", houseNumber: "24" });
  assert.deepStrictEqual(R.parseQuery("rotterdam"), { kind: "text", text: "rotterdam" });
  assert.deepStrictEqual(R.parseQuery("   "), { kind: "empty" });
});

test("a partial EAN finds the point, typed with or without spaces", function () {
  assert.strictEqual(R.search(R.UNASSIGNED, "871687100000000114").length, 1);
  assert.strictEqual(R.search(R.UNASSIGNED, "8716 8710 0000 0001 14")[0].ean, "871687100000000114");
  assert.strictEqual(R.search(R.UNASSIGNED, "000000114")[0].ean, "871687100000000114");
});

test("a postcode finds every point on it; adding the number narrows to one", function () {
  var onPostcode = R.search(R.UNASSIGNED, "5928 LA");
  assert.strictEqual(onPostcode.length, 2);
  var one = R.search(R.UNASSIGNED, "5928LA 18");
  assert.strictEqual(one.length, 1);
  assert.strictEqual(one[0].ean, "871687100000000122");
});

test("a house number that is not on that postcode finds nothing", function () {
  assert.deepStrictEqual(R.search(R.UNASSIGNED, "5928LA 999"), []);
});

test("free text matches the street or the city, never the commodity", function () {
  assert.ok(R.search(R.UNASSIGNED, "rotterdam").length >= 2);
  assert.ok(R.search(R.UNASSIGNED, "Pekstraat").length === 2);
  assert.deepStrictEqual(R.search(R.UNASSIGNED, "Electricity"), []);
});

test("an empty query offers the whole pool rather than nothing", function () {
  assert.strictEqual(R.search(R.UNASSIGNED, "").length, R.UNASSIGNED.length);
  assert.strictEqual(R.search(R.UNASSIGNED, null).length, R.UNASSIGNED.length);
});

test("claiming takes a point out of the pool for everyone", function () {
  var s = fakeStorage();
  var ean = R.UNASSIGNED[0].ean;
  var before = R.availableRows(R.read(s)).length;
  assert.ok(R.claim(s, ean, { kvk: "34215678", company: "Vandersteen Koeling B.V." }));
  var after = R.availableRows(R.read(s));
  assert.strictEqual(after.length, before - 1);
  assert.strictEqual(R.findByEan(after, ean), null);
});

test("a point cannot be claimed twice, whoever asks second", function () {
  var s = fakeStorage();
  var ean = R.UNASSIGNED[1].ean;
  assert.ok(R.claim(s, ean, { kvk: "34215678" }));
  assert.strictEqual(R.claim(s, ean, { kvk: "68812340" }), null);
  assert.strictEqual(R.read(s)[ean].kvk, "34215678");
});

test("an EAN that is not in the pool cannot be claimed", function () {
  var s = fakeStorage();
  assert.strictEqual(R.claim(s, "871687100000000011", { kvk: "34215678" }), null);
  assert.strictEqual(R.claim(s, "not an ean", { kvk: "34215678" }), null);
  assert.deepStrictEqual(R.read(s), {});
});

test("claimsFor returns one company's points, with the address kept", function () {
  var s = fakeStorage();
  R.claim(s, R.UNASSIGNED[0].ean, { kvk: "34215678", name: "Venlo dock" });
  R.claim(s, R.UNASSIGNED[2].ean, { kvk: "68812340", name: "Lelystad site" });
  var mine = R.claimsFor(R.read(s), "34215678");
  assert.strictEqual(mine.length, 1);
  assert.strictEqual(mine[0].ean, R.UNASSIGNED[0].ean);
  assert.strictEqual(mine[0].name, "Venlo dock");
  assert.strictEqual(mine[0].street, R.UNASSIGNED[0].street);
  assert.strictEqual(R.claimsFor(R.read(s), "99999999").length, 0);
});

test("releasing puts a point back", function () {
  var s = fakeStorage();
  var ean = R.UNASSIGNED[3].ean;
  R.claim(s, ean, { kvk: "34215678" });
  assert.strictEqual(R.release(s, ean), true);
  assert.ok(R.findByEan(R.availableRows(R.read(s)), ean));
  assert.strictEqual(R.release(s, ean), false);
});

// A broken link must never stop either portal rendering its own connections.
test("unreadable storage reads as nothing claimed, and never throws", function () {
  assert.deepStrictEqual(R.read(brokenStorage()), {});
  assert.deepStrictEqual(R.read(fakeStorage({ "peakpower.eanClaims.v1": "{{{" })), {});
  assert.deepStrictEqual(R.read(fakeStorage({ "peakpower.eanClaims.v1": "[1,2]" })), {});
  assert.strictEqual(R.availableRows(R.read(brokenStorage())).length, R.UNASSIGNED.length);
});

test("a write that cannot happen is not an exception", function () {
  var s = brokenStorage();
  s.getItem = function () { return null; };
  assert.doesNotThrow(function () { R.claim(s, R.UNASSIGNED[0].ean, { kvk: "34215678" }); });
});
