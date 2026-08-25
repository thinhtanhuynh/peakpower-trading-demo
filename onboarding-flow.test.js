/**
 * Tests for onboarding-flow.js — the step model and the two rules that decide
 * whether an application can move forward.
 *
 *   node onboarding-flow.test.js
 */
var assert = require("assert");
var Flow = require("./onboarding-flow.js");

/** A state sitting on `step` with everything before it filled in. */
function stateAt(step, patch) {
  var s = Flow.defaultState();
  s.step = step;
  s.f = {
    firstName: "Peter", lastName: "de Vries", email: "p.devries@vandersteen.nl",
    password: "correct-horse-battery", orgName: "Vandersteen Koeling B.V.", kvk: "24398112",
    street: "Havenweg 22", city: "Rotterdam", postcode: "3089 JJ"
  };
  s.agreed = true;
  s.volumeIndex = 3;
  s.authorityIndex = 0;
  s.signatories = [{ first: "Peter", last: "de Vries", email: "p.devries@vandersteen.nl", locked: true }];
  Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
  return s;
}

// --- the flow's own shape ---------------------------------------------------
(function () {
  assert.strictEqual(Flow.STEPS.length, 9, "nine steps");
  assert.strictEqual(Flow.LAST_STEP, 9);
  Flow.STEPS.forEach(function (st, i) {
    assert.strictEqual(st.n, i + 1, "step numbers are 1..9 in order");
    assert.ok(st.group && st.label && st.title && st.intro, "every step is fully labelled");
  });
  // The rail groups steps, so a group must never reappear after another one
  // starts — the "show the heading when it changes" rule would print it twice.
  var seen = [];
  Flow.STEPS.forEach(function (st) {
    if (seen.indexOf(st.group) === -1) { seen.push(st.group); return; }
    assert.strictEqual(seen[seen.length - 1], st.group, "groups are contiguous: " + st.group);
  });
})();

// --- defaultState is genuinely empty ---------------------------------------
(function () {
  var s = Flow.defaultState();
  assert.strictEqual(s.step, 1);
  assert.strictEqual(s.volumeIndex, -1, "-1, not 0: 0 is a real volume band");
  assert.strictEqual(s.authorityIndex, -1, "-1, not 0: 0 is a real authority answer");
  assert.strictEqual(s.signatories.length, 1);
  assert.strictEqual(Flow.stepValid(s), false, "an empty application cannot leave step 1");
})();

// --- step 1 --------------------------------------------------------------
(function () {
  var base = { step: 1 };
  assert.strictEqual(Flow.stepValid(stateAt(1)), true);

  assert.strictEqual(Flow.stepValid(stateAt(1, { agreed: false })), false, "terms are required");
  assert.strictEqual(Flow.hint(stateAt(1, { agreed: false })), "Accept the Terms of Use to create the account.");

  var shortPw = stateAt(1);
  shortPw.f.password = "12345678901"; // 11
  assert.strictEqual(Flow.stepValid(shortPw), false, "11 characters is short");
  assert.ok(/12 characters/.test(Flow.hint(shortPw)));
  shortPw.f.password = "123456789012"; // 12
  assert.strictEqual(Flow.stepValid(shortPw), true, "12 characters is exactly enough");

  var noAt = stateAt(1);
  noAt.f.email = "peter.devries.nl";
  assert.strictEqual(Flow.stepValid(noAt), false);
  assert.strictEqual(Flow.hint(noAt), "Enter the email address you will sign in with.");

  // "@company.nl" has the @ at index 0 — there is no local part, so it is not
  // an address. This is the one case a bare indexOf("@") >= 0 would let past.
  var leadingAt = stateAt(1);
  leadingAt.f.email = "@vandersteen.nl";
  assert.strictEqual(Flow.stepValid(leadingAt), false, "an @ in first position is not an address");

  var spaces = stateAt(1);
  spaces.f.firstName = "   ";
  assert.strictEqual(Flow.stepValid(spaces), false, "whitespace is not a name");
  assert.strictEqual(Flow.hint(spaces), "Enter your first and last name to continue.");
})();

// --- step 2: the KvK number -------------------------------------------------
(function () {
  assert.strictEqual(Flow.stepValid(stateAt(2)), true);

  var noOrg = stateAt(2);
  noOrg.f.orgName = "";
  assert.strictEqual(Flow.stepValid(noOrg), false);
  assert.strictEqual(Flow.hint(noOrg), "Enter the organization name as registered.");

  var short = stateAt(2);
  short.f.kvk = "2439811";
  assert.strictEqual(Flow.stepValid(short), false, "seven digits is not a KvK number");
  assert.strictEqual(Flow.hint(short), "The KvK number is eight digits.");

  // Pasted from a letterhead: spaces and dots are formatting, not digits.
  var spaced = stateAt(2);
  spaced.f.kvk = "24 39 81 12";
  assert.strictEqual(Flow.stepValid(spaced), true, "a spaced number is still eight digits");
  assert.strictEqual(Flow.kvkDigits("24.398.112"), "24398112");

  var tooLong = stateAt(2);
  tooLong.f.kvk = "243981123";
  assert.strictEqual(Flow.stepValid(tooLong), false, "nine digits is not eight");
})();

// --- the always-passable steps ---------------------------------------------
(function () {
  // Blank address, no industry, unverified bank: all deliberately fine.
  var blankAddress = stateAt(3);
  blankAddress.f.street = ""; blankAddress.f.city = ""; blankAddress.f.postcode = "";
  assert.strictEqual(Flow.stepValid(blankAddress), true, "an unregistered address does not block");

  assert.strictEqual(Flow.stepValid(stateAt(4, { industryIndex: 0 })), true, "industry is optional");
  assert.strictEqual(Flow.stepValid(stateAt(6, { bankVerified: false })), true, "the cent can arrive later");
  assert.strictEqual(Flow.stepValid(stateAt(9)), true, "step 9 is a receipt, not a question");
})();

// --- steps 5 and 7: index 0 is a real answer --------------------------------
(function () {
  assert.strictEqual(Flow.stepValid(stateAt(5, { volumeIndex: -1 })), false);
  assert.strictEqual(Flow.hint(stateAt(5, { volumeIndex: -1 })), "Pick the band that matches your yearly volume.");
  assert.strictEqual(Flow.stepValid(stateAt(5, { volumeIndex: 0 })), true,
    "the first band is an answer, not an absence");

  assert.strictEqual(Flow.stepValid(stateAt(7, { authorityIndex: -1 })), false);
  assert.strictEqual(Flow.hint(stateAt(7, { authorityIndex: -1 })), "Choose one option to continue.");
  assert.strictEqual(Flow.stepValid(stateAt(7, { authorityIndex: 0 })), true,
    "the first authority option is an answer, not an absence");
})();

// --- step 8: every signatory is complete ------------------------------------
(function () {
  assert.strictEqual(Flow.stepValid(stateAt(8)), true);

  var halfFilled = stateAt(8, {
    signatories: [
      { first: "Peter", last: "de Vries", email: "p.devries@vandersteen.nl", locked: true },
      { first: "Marieke", last: "", email: "", locked: false }
    ]
  });
  assert.strictEqual(Flow.stepValid(halfFilled), false, "one blank row blocks the step");
  assert.strictEqual(Flow.hint(halfFilled), "Every signatory needs a first name, last name and email address.");

  assert.strictEqual(Flow.stepValid(stateAt(8, { signatories: [] })), false,
    "no signatories at all is not a signed agreement — [].every() is true, so this needs its own guard");
})();

// --- "together with another" means two, and the flow enforces it ------------
(function () {
  assert.strictEqual(Flow.minSignatories(0), 1, "signing alone needs one");
  assert.strictEqual(Flow.minSignatories(1), 2, "signing together needs two");
  assert.strictEqual(Flow.minSignatories(2), 1, "someone else signing needs one");
  assert.strictEqual(Flow.minSignatories(-1), 1, "unanswered falls back to one, never to zero");

  // The applicant alone, under an answer that says two people sign: complete
  // on its own terms, and still refused.
  var oneUnderTwo = stateAt(8, {
    authorityIndex: 1,
    signatories: [{ first: "Peter", last: "de Vries", email: "p.devries@vandersteen.nl", locked: true }]
  });
  assert.strictEqual(Flow.stepValid(oneUnderTwo), false,
    "one signer contradicts the answer that two sign");
  assert.strictEqual(Flow.hint(oneUnderTwo), "You answered that two people sign — add the second signatory.");

  var twoUnderTwo = stateAt(8, {
    authorityIndex: 1,
    signatories: [
      { first: "Peter", last: "de Vries", email: "p.devries@vandersteen.nl", locked: true },
      { first: "Marieke", last: "Vandersteen", email: "m.vandersteen@vandersteen.nl", locked: false }
    ]
  });
  assert.strictEqual(Flow.stepValid(twoUnderTwo), true);

  // The same single row is fine under the answers that ask for one.
  assert.strictEqual(Flow.stepValid(stateAt(8, { authorityIndex: 0 })), true);
  assert.strictEqual(Flow.stepValid(stateAt(8, { authorityIndex: 2 })), true);
})();

// --- hint answers every refusal ---------------------------------------------
(function () {
  // The pairing that matters: whenever a step refuses, the hint must say
  // something other than the encouraging line it shows when the step passes.
  var refusals = [
    stateAt(1, { agreed: false }),
    stateAt(2, { f: Object.assign({}, stateAt(2).f, { kvk: "1" }) }),
    stateAt(5, { volumeIndex: -1 }),
    stateAt(7, { authorityIndex: -1 }),
    stateAt(8, { signatories: [{ first: "", last: "", email: "", locked: false }] })
  ];
  refusals.forEach(function (s) {
    assert.strictEqual(Flow.stepValid(s), false, "fixture is meant to be invalid at step " + s.step);
    var refusedHint = Flow.hint(s);
    assert.ok(refusedHint && refusedHint.length > 0, "step " + s.step + " refuses with a reason");
    assert.notStrictEqual(refusedHint, Flow.hint(stateAt(s.step)),
      "step " + s.step + "'s refusal reads differently from its all-clear");
  });
})();

// --- the authority answer reshapes the signatory list -----------------------
(function () {
  var f = stateAt(7).f;

  var alone = Flow.signatoriesForAuthority(0, f);
  assert.strictEqual(alone.length, 1);
  assert.strictEqual(alone[0].locked, true, "the applicant's own row is not editable here");
  assert.strictEqual(alone[0].email, f.email);

  var together = Flow.signatoriesForAuthority(1, f);
  assert.strictEqual(together.length, 2, "a second, blank row makes the requirement visible");
  assert.strictEqual(together[0].locked, true);
  assert.strictEqual(together[1].locked, false);
  assert.strictEqual(Flow.signatoryComplete(together[1]), false, "and it is genuinely blank");

  var someoneElse = Flow.signatoriesForAuthority(2, f);
  assert.strictEqual(someoneElse.length, 1);
  assert.strictEqual(someoneElse[0].locked, false);
  assert.strictEqual(someoneElse[0].email, "",
    "the applicant is dropped: they manage the account but do not sign it");
})();

// --- summary reads back everything, including what was skipped --------------
(function () {
  var rows = Flow.summaryRows(stateAt(9));
  assert.strictEqual(rows.length, 12);
  var byKey = {};
  rows.forEach(function (r) { byKey[r.k] = r.v; });
  assert.strictEqual(byKey.Account, "Peter de Vries");
  assert.strictEqual(byKey["KvK number"], "24398112");
  assert.strictEqual(byKey["Annual volume"], Flow.VOLUMES[3]);
  assert.strictEqual(byKey["Bank account"], "Not verified yet");

  var empty = Flow.defaultState();
  var emptyRows = {};
  Flow.summaryRows(empty).forEach(function (r) { emptyRows[r.k] = r.v; });
  assert.strictEqual(emptyRows.Account, "—", "a blank answer is shown as blank, never omitted");
  assert.strictEqual(emptyRows["Registered address"], "Not registered");
  assert.strictEqual(emptyRows["Annual volume"], "Not given");
  assert.strictEqual(emptyRows["Signing authority"], "—");
  assert.strictEqual(Flow.summaryRows(empty).length, 12, "the same twelve rows, answered or not");
})();

// --- prefilledState fills EVERY field, not only the gated ones --------------
(function () {
  var p = Flow.prefilledState();
  var d = Flow.defaultState();

  // The strongest statement of "complete": every step validates.
  for (var n = 1; n <= Flow.LAST_STEP; n++) {
    p.step = n;
    assert.strictEqual(Flow.stepValid(p), true, "prefilled application passes step " + n);
  }

  // Every text field answered.
  Object.keys(d.f).forEach(function (k) {
    assert.ok(String(p.f[k]).trim().length > 0, "prefill fills f." + k);
  });

  // Every choice answered — including the two that are not gated by any step,
  // which is exactly where an incomplete prefill hides.
  assert.ok(p.entityIndex >= 0, "entity type is chosen");
  assert.strictEqual(Flow.ENTITY_TYPES[p.entityIndex], "BV");
  assert.ok(p.industryIndex > 0, "industry is a real choice, not 'Not specified'");
  assert.strictEqual(Flow.INDUSTRIES[p.industryIndex], "Cold storage & refrigeration");
  assert.strictEqual(Flow.FLOWS[p.flowIndex], "Both");
  assert.ok(p.volumeIndex >= 0);
  assert.ok(p.authorityIndex >= 0);
  assert.strictEqual(p.agreed, true, "terms accepted");
  assert.strictEqual(p.bankVerified, true, "the cent is a real answer to step 6");

  // The signatories match the authority answer that was given.
  assert.strictEqual(p.signatories.length, Flow.minSignatories(p.authorityIndex));
  p.signatories.forEach(function (x, i) {
    assert.strictEqual(Flow.signatoryComplete(x), true, "signatory " + i + " is complete");
  });
  assert.strictEqual(p.signatories[0].locked, true, "the applicant's own row stays locked");
  assert.strictEqual(p.signatories[0].email, p.f.email, "and carries the email from step 1");

  // Nothing on step 9's read-back is left blank.
  Flow.summaryRows(p).forEach(function (r) {
    assert.notStrictEqual(r.v, "—", "prefilled summary has no blank: " + r.k);
    assert.notStrictEqual(r.v, "Not given", "prefilled summary has no blank: " + r.k);
    assert.notStrictEqual(r.v, "Not registered", "prefilled summary has no blank: " + r.k);
    assert.notStrictEqual(r.v, "Not verified yet", "prefilled summary has no blank: " + r.k);
  });

  // It starts where an empty one does; the page decides which step to show.
  assert.strictEqual(Flow.prefilledState().step, 1);
  // And it is a fresh object each time — a shared one would let the page's
  // edits leak into the next toggle.
  var a = Flow.prefilledState();
  a.f.firstName = "changed";
  assert.strictEqual(Flow.prefilledState().f.firstName, "Peter", "each call is a fresh state");
})();

// --- clampStep keeps a deep link on a real step -----------------------------
(function () {
  assert.strictEqual(Flow.clampStep(0), 1);
  assert.strictEqual(Flow.clampStep(-4), 1);
  assert.strictEqual(Flow.clampStep(1), 1);
  assert.strictEqual(Flow.clampStep(9), 9);
  assert.strictEqual(Flow.clampStep(12), 9);
  assert.strictEqual(Flow.clampStep(4.6), 5);
  assert.strictEqual(Flow.clampStep("3"), 3);
  assert.strictEqual(Flow.clampStep("nonsense"), 1, "garbage lands on step 1, never on NaN");
  assert.strictEqual(Flow.clampStep(undefined), 1);
})();

console.log("onboarding-flow.test.js: all assertions passed");
