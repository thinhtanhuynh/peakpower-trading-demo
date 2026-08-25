/* node portal-accounts.test.js */
var assert = require("assert");
var PA = require("./portal-accounts.js");
var S = require("./back-office-screens-data.js");

function test(name, fn) {
  try { fn(); console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}

console.log("portal-accounts");

test("a legal form is dropped from the domain", function () {
  assert.strictEqual(PA.companyDomain("Vandersteen Koeling B.V."), "vandersteenkoeling.nl");
  assert.strictEqual(PA.companyDomain("Kramer Logistics B.V."), "kramerlogistics.nl");
  assert.strictEqual(PA.companyDomain("Van Dijk Glastuinbouw"), "vandijkglastuinbouw.nl");
});

test("diacritics fold rather than disappearing", function () {
  assert.strictEqual(PA.companyDomain("Grönland Koeling"), "gronlandkoeling.nl");
  assert.strictEqual(PA.emailLocalPart("J. Grönland"), "j.gronland");
});

test("the local part keeps one dot, after the first name only", function () {
  assert.strictEqual(PA.emailLocalPart("J. de Vries"), "j.devries");
  assert.strictEqual(PA.emailLocalPart("K. van Dijk"), "k.vandijk");
  assert.strictEqual(PA.emailLocalPart("Vandersteen"), "vandersteen");
});

test("a blank name yields no address rather than a bare domain", function () {
  assert.strictEqual(PA.accountEmail("", "Kramer Logistics B.V."), "");
  assert.strictEqual(PA.accountEmail("R. Kramer", ""), "");
  assert.strictEqual(PA.accountEmail(null, null), "");
});

test("initials take the first and last part, never a middle particle", function () {
  assert.strictEqual(PA.initialsFor("J. de Vries"), "JV");
  assert.strictEqual(PA.initialsFor("K. van Dijk"), "KD");
  assert.strictEqual(PA.initialsFor("Vandersteen"), "VA");
  assert.strictEqual(PA.initialsFor(""), "?");
});

test("trading name keeps the original casing, minus the legal form", function () {
  assert.strictEqual(PA.tradingName("Vandersteen Koeling B.V."), "Vandersteen Koeling");
  assert.strictEqual(PA.tradingName("Van Dijk Glastuinbouw"), "Van Dijk Glastuinbouw");
});

test("a stored address wins over a derived one", function () {
  var stored = { name: "S. Bakker", username: "s.bakker@bakkervries.nl" };
  assert.strictEqual(PA.signInEmail(stored, "Bakker Vriesopslag B.V."), "s.bakker@bakkervries.nl");
  var handle = { name: "J. de Vries", username: "jdevries" };
  assert.strictEqual(PA.signInEmail(handle, "Vandersteen Koeling B.V."), "j.devries@vandersteenkoeling.nl");
});

test("a stored address is matched case-insensitively", function () {
  var stored = { name: "S. Bakker", username: "  S.Bakker@BakkerVries.NL " };
  assert.strictEqual(PA.signInEmail(stored, "Bakker Vriesopslag B.V."), "s.bakker@bakkervries.nl");
});

// The one rule the feature rests on: the directory is derived from the desk's
// own roster, so a company the desk knows about can always be signed in to.
function directory() {
  return PA.buildDirectory(S.CUSTOMER_LIST, function (c) { return S.buildCustomerDetail(c).accounts; });
}

test("every seeded customer contributes at least one sign-in", function () {
  var dir = directory();
  S.CUSTOMER_LIST.forEach(function (c) {
    var mine = dir.filter(function (e) { return e.kvk === String(c.kvk); });
    assert.ok(mine.length >= 1, c.name + " has no sign-in");
  });
});

test("every entry carries a usable address, kvk, name and role", function () {
  directory().forEach(function (e) {
    assert.ok(e.email.indexOf("@") > 0, "bad address: " + e.email);
    assert.ok(/^\d{8}$/.test(e.kvk), "bad kvk: " + e.kvk);
    assert.ok(e.userName && e.userRole && e.initials, "incomplete entry: " + e.email);
  });
});

test("addresses are unique across every company", function () {
  var seen = {};
  directory().forEach(function (e) {
    assert.ok(!seen[e.email], "duplicate address: " + e.email);
    seen[e.email] = true;
  });
});

test("a duplicate address stays with the company that claimed it first", function () {
  var customers = [{ name: "Alpha B.V.", kvk: "11111111" }, { name: "Alpha B.V.", kvk: "22222222" }];
  var dir = PA.buildDirectory(customers, function () { return [{ name: "A. One", role: "Admin" }]; });
  assert.strictEqual(dir.length, 1);
  assert.strictEqual(dir[0].kvk, "11111111");
});

test("findByEmail ignores case and surrounding space, and misses cleanly", function () {
  var dir = directory();
  var wanted = dir[0].email;
  assert.strictEqual(PA.findByEmail(dir, "  " + wanted.toUpperCase() + " ").email, wanted);
  assert.strictEqual(PA.findByEmail(dir, "nobody@nowhere.nl"), null);
  assert.strictEqual(PA.findByEmail(dir, ""), null);
  assert.strictEqual(PA.findByEmail(dir, null), null);
});

// The Customer Portal keys its whole trade book on the KvK, so two companies
// sharing one would share a trade book with nothing on screen saying so.
test("no two customers share a KvK", function () {
  var seen = {};
  S.CUSTOMER_LIST.forEach(function (c) {
    assert.ok(!seen[c.kvk], "duplicate KvK: " + c.kvk);
    seen[c.kvk] = true;
  });
});

// The desk joins a trade to a customer by name prefix when it carries no
// customerId, so the portal's shortened name has to stay a prefix of the legal
// one — a legal form outside LEGAL_FORMS would silently break that join.
test("the customer name stays a prefix of the legal name", function () {
  directory().forEach(function (e) {
    assert.ok(e.legalName.indexOf(e.customerName) === 0,
      e.customerName + " is not a prefix of " + e.legalName);
    assert.ok(e.customerName.length > 0, "empty customer name for " + e.legalName);
  });
});

test("every company contributes all of its accounts, none dropped", function () {
  var dir = directory();
  var total = S.CUSTOMER_LIST.reduce(function (n, c) {
    return n + S.buildCustomerDetail(c).accounts.length;
  }, 0);
  assert.strictEqual(dir.length, total);
  assert.strictEqual(dir.length, 18);
});

// One unbuildable row must not take sign-in down for everyone else.
test("a row with no derivable address drops, it does not throw", function () {
  var customers = [{ name: "Alpha B.V.", kvk: "11111111" }, { name: "", kvk: "22222222" }];
  var dir = PA.buildDirectory(customers, function (c) {
    return c.kvk === "11111111" ? [{ name: "A. One", role: "Admin" }] : [{ name: "", role: "Admin" }];
  });
  assert.strictEqual(dir.length, 1);
  assert.strictEqual(dir[0].email, "a.one@alpha.nl");
});

test("the seeded customer's four staff are all signed-in-able", function () {
  var dir = directory();
  var mine = dir.filter(function (e) { return e.kvk === "34215678"; });
  assert.strictEqual(mine.length, S.ACCOUNTS.length);
  assert.deepStrictEqual(mine.map(function (e) { return e.userRole; }),
    S.ACCOUNTS.map(function (a) { return a.role; }));
});
