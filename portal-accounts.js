/* Who can sign in, and under which company — derived from the desk's own
   customer roster rather than listed a second time. See CLAUDE.md
   "Signing in as any account". */
(function (root) {
  "use strict";

  /**
   * The password every demo sign-in takes.
   *
   * This is NOT authentication: it is a string shipped to the browser, checked
   * against a directory also shipped to the browser, in a portal whose every
   * figure is synthetic. Nothing here is a credential.
   */
  var DEMO_PASSWORD = "peakpower";

  /** Dropped from a company name before it becomes a domain or a trading name. */
  var LEGAL_FORMS = ["bv", "nv", "vof", "cv", "cooperatie"];

  var FOLD = {
    "à": "a", "á": "a", "â": "a", "ä": "a", "ç": "c",
    "è": "e", "é": "e", "ê": "e", "ë": "e", "ì": "i",
    "í": "i", "î": "i", "ï": "i", "ñ": "n", "ò": "o",
    "ó": "o", "ô": "o", "ö": "o", "ù": "u", "ú": "u",
    "û": "u", "ü": "u"
  };

  /** Lowercase, diacritics folded to their base letter, everything else dropped. */
  function fold(value) {
    return String(value == null ? "" : value).toLowerCase()
      .replace(/[^\u0000-\u007F]/g, function (ch) { return FOLD[ch] || ""; })
      .replace(/[^a-z0-9 ]/g, "");
  }

  function words(value) {
    return fold(value).split(/\s+/).filter(Boolean);
  }

  function isLegalForm(word) { return LEGAL_FORMS.indexOf(word) !== -1; }

  /** "Vandersteen Koeling B.V." -> "vandersteenkoeling.nl" */
  function companyDomain(legalName) {
    var parts = words(legalName).filter(function (w) { return !isLegalForm(w); });
    return parts.length ? parts.join("") + ".nl" : "";
  }

  /**
   * "Vandersteen Koeling B.V." -> "Vandersteen Koeling".
   *
   * The customer-facing name, which is the legal name minus its legal form —
   * not a trade name. A trade name is a separate registration and is only ever
   * a stored field.
   */
  function tradingName(legalName) {
    var kept = String(legalName == null ? "" : legalName).split(/\s+/).filter(function (w) {
      return w && !isLegalForm(fold(w).replace(/\s/g, ""));
    });
    return kept.join(" ");
  }

  /** "J. de Vries" -> "j.devries" — one dot, after the first name only. */
  function emailLocalPart(personName) {
    var parts = words(personName);
    if (!parts.length) { return ""; }
    if (parts.length === 1) { return parts[0]; }
    return parts[0] + "." + parts.slice(1).join("");
  }

  /** "J. de Vries" at "Vandersteen Koeling B.V." -> "j.devries@vandersteenkoeling.nl" */
  function accountEmail(personName, legalName) {
    var local = emailLocalPart(personName);
    var domain = companyDomain(legalName);
    return (local && domain) ? local + "@" + domain : "";
  }

  /** "J. de Vries" -> "JV" — first and last, never a middle particle. */
  function initialsFor(personName) {
    var parts = words(personName);
    if (!parts.length) { return "?"; }
    if (parts.length === 1) { return parts[0].slice(0, 2).toUpperCase(); }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * The address an account signs in with.
   *
   * A desk-created account already stores one, because the Add customer wizard
   * asks for it; the seeded fixtures store a bare handle from the mockup and
   * get one derived. One rule covers both, so the desk's accounts table and the
   * Customer Portal's sign-in can only ever name the same address.
   */
  function signInEmail(account, legalName) {
    var stored = String((account && account.username) || "").trim().toLowerCase();
    if (stored.indexOf("@") > 0) { return stored; }
    return accountEmail(account && account.name, legalName);
  }

  /**
   * Every person with an account, across every company.
   *
   * `customers` is the desk's own customer list and `accountsFor` its own
   * per-customer accounts — read, never copied. A duplicate address is dropped
   * rather than shadowing the company that claimed it first.
   */
  function buildDirectory(customers, accountsFor) {
    var seen = {};
    var out = [];
    (customers || []).forEach(function (c) {
      (accountsFor(c) || []).forEach(function (a) {
        var email = signInEmail(a, c.name);
        if (!email || seen[email]) { return; }
        seen[email] = true;
        out.push({
          email: email,
          kvk: String(c.kvk),
          legalName: c.name,
          customerName: tradingName(c.name),
          userName: a.name,
          userRole: a.role,
          initials: initialsFor(a.name)
        });
      });
    });
    return out;
  }

  function findByEmail(directory, email) {
    var wanted = String(email == null ? "" : email).trim().toLowerCase();
    if (!wanted) { return null; }
    for (var i = 0; i < (directory || []).length; i++) {
      if (directory[i].email === wanted) { return directory[i]; }
    }
    return null;
  }

  var api = {
    DEMO_PASSWORD: DEMO_PASSWORD,
    companyDomain: companyDomain,
    tradingName: tradingName,
    emailLocalPart: emailLocalPart,
    accountEmail: accountEmail,
    initialsFor: initialsFor,
    signInEmail: signInEmail,
    buildDirectory: buildDirectory,
    findByEmail: findByEmail
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.PortalAccounts = api;
  }
})(typeof window !== "undefined" ? window : this);
