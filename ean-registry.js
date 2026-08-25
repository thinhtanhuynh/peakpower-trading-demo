/* The unassigned metering points, how they are searched, and which company
   took which. See CLAUDE.md "Adding a connection". */
(function (root) {
  "use strict";

  /**
   * Metering points registered with the grid operators and not yet on any
   * customer. Both portals draw from this one pool: the desk assigns one to a
   * customer, a customer claims one themselves, and either way it leaves the
   * pool for everyone.
   *
   * The EANs deliberately start past the seeded connections (…011 to …092),
   * which already belong to Vandersteen Koeling and are not free to take.
   */
  var UNASSIGNED = [
    { ean: "871687100000000114", street: "Ceresstraat", houseNumber: "16", postcode: "5928LA", city: "VENLO",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 2500 },
    { ean: "871687100000000122", street: "Ceresstraat", houseNumber: "18", postcode: "5928LA", city: "VENLO",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 1250 },
    { ean: "871687100000000130", street: "Pekstraat", houseNumber: "24", postcode: "8232DP", city: "LELYSTAD",
      commodity: "Electricity", gridOperator: "Liander", capacityKw: 1600 },
    { ean: "871687100000000148", street: "Pekstraat", houseNumber: "26", postcode: "8232DP", city: "LELYSTAD",
      commodity: "Gas", gridOperator: "Liander", capacityKw: 0 },
    { ean: "871687100000000155", street: "Waalhaven Zuidzijde", houseNumber: "12", postcode: "3089JH", city: "ROTTERDAM",
      commodity: "Electricity", gridOperator: "Stedin", capacityKw: 3200 },
    { ean: "871687100000000163", street: "Botlekweg", houseNumber: "175", postcode: "3197KA", city: "ROTTERDAM",
      commodity: "Electricity", gridOperator: "Stedin", capacityKw: 5400 },
    { ean: "871687100000000171", street: "Hornweg", houseNumber: "8", postcode: "1044AN", city: "AMSTERDAM",
      commodity: "Electricity", gridOperator: "Liander", capacityKw: 2100 },
    { ean: "871687100000000189", street: "Kabelweg", houseNumber: "41", postcode: "1014BA", city: "AMSTERDAM",
      commodity: "Electricity", gridOperator: "Liander", capacityKw: 900 },
    { ean: "871687100000000197", street: "Croy", houseNumber: "3", postcode: "5653LC", city: "EINDHOVEN",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 1800 },
    { ean: "871687100000000205", street: "De Schakel", houseNumber: "22", postcode: "5651GH", city: "EINDHOVEN",
      commodity: "Gas", gridOperator: "Enexis", capacityKw: 0 },
    { ean: "871687100000000213", street: "Vossenberg", houseNumber: "40", postcode: "5051DV", city: "TILBURG",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 4100 },
    { ean: "871687100000000221", street: "Hogering", houseNumber: "162", postcode: "1362AA", city: "ALMERE",
      commodity: "Electricity", gridOperator: "Liander", capacityKw: 750 },
    { ean: "871687100000000239", street: "Rouaanstraat", houseNumber: "9", postcode: "9723CD", city: "GRONINGEN",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 1400 },
    { ean: "871687100000000247", street: "Konijnenberg", houseNumber: "70", postcode: "4825BD", city: "BREDA",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 2600 },
    { ean: "871687100000000254", street: "Marsweg", houseNumber: "31", postcode: "8013PD", city: "ZWOLLE",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 1150 },
    { ean: "871687100000000262", street: "Westervoortsedijk", houseNumber: "73", postcode: "6827AV", city: "ARNHEM",
      commodity: "Electricity", gridOperator: "Liander", capacityKw: 3300 },
    { ean: "871687100000000270", street: "Binckhorstlaan", houseNumber: "215", postcode: "2516BA", city: "DEN HAAG",
      commodity: "Electricity", gridOperator: "Stedin", capacityKw: 980 },
    { ean: "871687100000000288", street: "Vlijtseweg", houseNumber: "144", postcode: "7317AH", city: "APELDOORN",
      commodity: "Electricity", gridOperator: "Liander", capacityKw: 1750 },
    { ean: "871687100000000296", street: "Nieuwe Dukenburgseweg", houseNumber: "20", postcode: "6534AD", city: "NIJMEGEN",
      commodity: "Electricity", gridOperator: "Liander", capacityKw: 2200 },
    { ean: "871687100000000304", street: "Karveelweg", houseNumber: "12", postcode: "6222NJ", city: "MAASTRICHT",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 1300 },
    { ean: "871687100000000312", street: "Josink Esweg", houseNumber: "34", postcode: "7545PN", city: "ENSCHEDE",
      commodity: "Electricity", gridOperator: "Enexis", capacityKw: 2900 },
    { ean: "871687100000000320", street: "Newtonweg", houseNumber: "7", postcode: "3208KD", city: "SPIJKENISSE",
      commodity: "Electricity", gridOperator: "Stedin", capacityKw: 1050 }
  ];

  /** Where the two portals agree about who took what. */
  var CLAIMS_KEY = "peakpower.eanClaims.v1";

  function eanDigits(value) { return String(value == null ? "" : value).replace(/\D/g, ""); }

  /** "8716 8710 0000 0000 11" — the grouping both portals display EANs in. */
  function formatEan(value) {
    var d = eanDigits(value);
    return d.replace(/(.{4})(?=.)/g, "$1 ").trim();
  }

  /** "3514 uh" and "3514UH" are the same postcode. */
  function normalisePostcode(value) {
    return String(value == null ? "" : value).toUpperCase().replace(/[^0-9A-Z]/g, "");
  }

  /** "Pekstraat 24, 8232DP LELYSTAD" */
  function formatAddress(row) {
    if (!row) { return ""; }
    return row.street + " " + row.houseNumber + ", " + row.postcode + " " + row.city;
  }

  /**
   * What the search box was given.
   *
   * Digits alone are an EAN — nothing else in this data is a bare number long
   * enough to confuse it. A Dutch postcode is four digits and two letters, and
   * a house number may follow it; anything else is treated as free text over
   * the street and the city, so typing "Rotterdam" still finds something.
   */
  function parseQuery(query) {
    var raw = String(query == null ? "" : query).trim();
    if (!raw) { return { kind: "empty" }; }
    if (/^[\d\s.-]+$/.test(raw)) {
      var digits = eanDigits(raw);
      return digits ? { kind: "ean", ean: digits } : { kind: "empty" };
    }
    var pc = raw.match(/(\d{4})\s*([A-Za-z]{2})(?![A-Za-z])\s*([0-9][0-9A-Za-z\-]*)?/);
    if (pc) {
      return {
        kind: "address",
        postcode: normalisePostcode(pc[1] + pc[2]),
        houseNumber: pc[3] ? String(pc[3]).toUpperCase() : null
      };
    }
    return { kind: "text", text: raw.toLowerCase() };
  }

  function matches(row, parsed) {
    if (parsed.kind === "empty") { return true; }
    if (parsed.kind === "ean") { return row.ean.indexOf(parsed.ean) !== -1; }
    if (parsed.kind === "address") {
      if (normalisePostcode(row.postcode) !== parsed.postcode) { return false; }
      return !parsed.houseNumber || String(row.houseNumber).toUpperCase() === parsed.houseNumber;
    }
    return (row.street + " " + row.city).toLowerCase().indexOf(parsed.text) !== -1;
  }

  /** Rows matching the query, in pool order. An empty query returns them all. */
  function search(rows, query) {
    var parsed = parseQuery(query);
    return (rows || []).filter(function (r) { return matches(r, parsed); });
  }

  function findByEan(rows, ean) {
    var d = eanDigits(ean);
    var found = (rows || []).filter(function (r) { return r.ean === d; })[0];
    return found || null;
  }

  // --- who took what --------------------------------------------------------
  //
  // Same transport and the same failure discipline as the trade and terms
  // links: one versioned key, and every read problem landing on "nothing
  // claimed" rather than throwing. A broken link must never stop either portal
  // rendering its own connections.

  function read(storage) {
    try {
      var raw = storage.getItem(CLAIMS_KEY);
      if (!raw) { return {}; }
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function write(storage, claims) {
    try { storage.setItem(CLAIMS_KEY, JSON.stringify(claims)); return true; } catch (e) { return false; }
  }

  /**
   * Take a metering point for a company.
   *
   * Refuses an EAN that is not in the pool or that someone already holds, so a
   * stale screen cannot assign the same point twice — the check is here rather
   * than in whichever button was clicked.
   */
  function claim(storage, ean, owner) {
    var d = eanDigits(ean);
    if (!findByEan(UNASSIGNED, d)) { return null; }
    var claims = read(storage);
    if (claims[d]) { return null; }
    claims[d] = {
      kvk: String((owner && owner.kvk) || ""),
      company: String((owner && owner.company) || ""),
      name: String((owner && owner.name) || ""),
      by: String((owner && owner.by) || ""),
      at: String((owner && owner.at) || "")
    };
    write(storage, claims);
    return claims[d];
  }

  function release(storage, ean) {
    var d = eanDigits(ean);
    var claims = read(storage);
    if (!claims[d]) { return false; }
    delete claims[d];
    write(storage, claims);
    return true;
  }

  /** The pool minus everything already taken — what a search should offer. */
  function availableRows(claims) {
    var taken = claims || {};
    return UNASSIGNED.filter(function (r) { return !taken[r.ean]; });
  }

  /** One company's claimed points, as pool rows with the claim folded in. */
  function claimsFor(claims, kvk) {
    var wanted = String(kvk == null ? "" : kvk);
    var taken = claims || {};
    var out = [];
    UNASSIGNED.forEach(function (r) {
      var c = taken[r.ean];
      if (!c || String(c.kvk) !== wanted) { return; }
      out.push({
        ean: r.ean, street: r.street, houseNumber: r.houseNumber, postcode: r.postcode, city: r.city,
        commodity: r.commodity, gridOperator: r.gridOperator, capacityKw: r.capacityKw,
        name: c.name, claimedBy: c.by, claimedAt: c.at
      });
    });
    return out;
  }

  var api = {
    UNASSIGNED: UNASSIGNED,
    CLAIMS_KEY: CLAIMS_KEY,
    eanDigits: eanDigits,
    formatEan: formatEan,
    normalisePostcode: normalisePostcode,
    formatAddress: formatAddress,
    parseQuery: parseQuery,
    search: search,
    findByEan: findByEan,
    read: read,
    claim: claim,
    release: release,
    availableRows: availableRows,
    claimsFor: claimsFor
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.EanRegistry = api;
  }
})(typeof window !== "undefined" ? window : this);
