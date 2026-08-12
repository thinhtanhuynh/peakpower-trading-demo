var assert = require("assert");
var Loader = require("./consumption-data-loader.js");

var ROT_EAN = Loader.SITE_META[0].ean;   // rot
var VENLO_EAN = Loader.SITE_META[1].ean; // venlo
var UNKNOWN_EAN = "999999999999999999"; // not in SITE_META (e.g. tilburg-gas)

function makeRow(ean, date, isp, hhmm, epex, consumption, production) {
  return {
    EAN: ean,
    delivery_day: date,
    isp: isp,
    timestamp: date + " " + hhmm + ":00.000000",
    epex: epex,
    consumption: consumption,
    production: production
  };
}

function makeHedgeRow(ean, shape, periodStart, periodEnd, powerKw, priceKwh) {
  return {
    EAN: ean,
    shape: shape,
    periodStart: periodStart,
    periodEnd: periodEnd,
    powerKw: powerKw,
    priceKwh: priceKwh,
    organization_name: "irrelevant for this function",
    periodType: "YEAR"
  };
}

// buildCompactDataset: groups by site and date
(function () {
  var rows = [
    makeRow(ROT_EAN, "2026-01-01", 1, "00:00", 0.1000, 100.0, 0.0),
    makeRow(ROT_EAN, "2026-01-01", 2, "00:15", 0.2000, 200.0, 10.0)
  ];
  var result = Loader.buildCompactDataset(rows);
  assert.deepStrictEqual(result.byDate["2026-01-01"].t, ["00:00", "00:15"]);
  assert.deepStrictEqual(result.byDate["2026-01-01"].p, [0.1, 0.2]);
  assert.deepStrictEqual(result.bySite.rot["2026-01-01"].c, [100.0, 200.0]);
  assert.deepStrictEqual(result.bySite.rot["2026-01-01"].g, [0.0, 10.0]);
})();

// buildCompactDataset: sorts by isp even if input is unordered
(function () {
  var rows = [
    makeRow(ROT_EAN, "2026-01-01", 2, "00:15", 0.2000, 200.0, 0.0),
    makeRow(ROT_EAN, "2026-01-01", 1, "00:00", 0.1000, 100.0, 0.0)
  ];
  var result = Loader.buildCompactDataset(rows);
  assert.deepStrictEqual(result.byDate["2026-01-01"].t, ["00:00", "00:15"]);
  assert.deepStrictEqual(result.bySite.rot["2026-01-01"].c, [100.0, 200.0]);
})();

// buildCompactDataset: rounds consumption/production/price
(function () {
  var rows = [makeRow(ROT_EAN, "2026-01-01", 1, "00:00", 0.089621, 612.449, 0.049)];
  var result = Loader.buildCompactDataset(rows);
  assert.deepStrictEqual(result.byDate["2026-01-01"].p, [0.0896]);
  assert.deepStrictEqual(result.bySite.rot["2026-01-01"].c, [612.4]);
  assert.deepStrictEqual(result.bySite.rot["2026-01-01"].g, [0.0]);
})();

// buildCompactDataset: unknown EAN is ignored
(function () {
  var rows = [makeRow(UNKNOWN_EAN, "2026-01-01", 1, "00:00", 0.1, 1.0, 0.0)];
  var result = Loader.buildCompactDataset(rows);
  assert.deepStrictEqual(result.byDate, {});
  Object.keys(result.bySite).forEach(function (id) {
    assert.deepStrictEqual(result.bySite[id], {});
  });
})();

// buildCompactDataset: multiple sites share a date but keep their own series
(function () {
  var rows = [
    makeRow(ROT_EAN, "2026-01-01", 1, "00:00", 0.10, 100.0, 0.0),
    makeRow(VENLO_EAN, "2026-01-01", 1, "00:00", 0.10, 500.0, 0.0)
  ];
  var result = Loader.buildCompactDataset(rows);
  assert.strictEqual(Object.keys(result.byDate).length, 1);
  assert.deepStrictEqual(result.bySite.rot["2026-01-01"].c, [100.0]);
  assert.deepStrictEqual(result.bySite.venlo["2026-01-01"].c, [500.0]);
})();

// buildCompactDataset: sites list matches SITE_META
(function () {
  var result = Loader.buildCompactDataset([]);
  assert.deepStrictEqual(result.sites, Loader.SITE_META);
})();

// buildHedgeSection: groups by site with only the needed fields
(function () {
  var rows = [
    makeHedgeRow(ROT_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07),
    makeHedgeRow(ROT_EAN, "peak", "2026-01-01", "2026-12-31", 1000.0, 0.095)
  ];
  var result = Loader.buildHedgeSection(rows);
  assert.deepStrictEqual(result.rot, [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000.0, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000.0, priceKwh: 0.095 }
  ]);
})();

// buildHedgeSection: unknown EAN is ignored
(function () {
  var rows = [makeHedgeRow(UNKNOWN_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07)];
  var result = Loader.buildHedgeSection(rows);
  Object.keys(result).forEach(function (id) {
    assert.deepStrictEqual(result[id], []);
  });
})();

// buildHedgeSection: all sites present even when empty
(function () {
  var result = Loader.buildHedgeSection([]);
  assert.deepStrictEqual(
    Object.keys(result).sort(),
    Loader.SITE_META.map(function (m) { return m.id; }).sort()
  );
})();

// buildHedgeSection: a site can carry multiple periods at once (e.g. YEAR + QUARTER + MONTH)
// -- this is exactly what adding a new hedge period to hedge_blocks_2026.json produces.
(function () {
  var rows = [
    makeHedgeRow(ROT_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07),
    makeHedgeRow(ROT_EAN, "base", "2026-04-01", "2026-06-30", 2000.0, 0.06639),
    makeHedgeRow(ROT_EAN, "peak", "2026-04-01", "2026-06-30", 1000.0, 0.09115),
    makeHedgeRow(ROT_EAN, "base", "2026-07-01", "2026-07-31", 2000.0, 0.07779)
  ];
  var result = Loader.buildHedgeSection(rows);
  assert.strictEqual(result.rot.length, 4, "all periods for a site are kept, not just the first");
  assert.strictEqual(result.rot[1].periodStart, "2026-04-01");
  assert.strictEqual(result.rot[3].periodStart, "2026-07-01");
})();

// assembleDataset: wires buildCompactDataset + buildHedgeSection together
(function () {
  var rows = [makeRow(ROT_EAN, "2026-01-01", 1, "00:00", 0.10, 100.0, 0.0)];
  var hedgeRows = [makeHedgeRow(ROT_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07)];
  var dataset = Loader.assembleDataset(rows, hedgeRows);
  assert.deepStrictEqual(dataset.bySite.rot["2026-01-01"].c, [100.0]);
  assert.strictEqual(dataset.hedge.rot.length, 1);
  assert.strictEqual(dataset.hedge.venlo.length, 0);
})();

// attachHedge: merges a hedge section onto an already-pre-grouped dataset
// (the shape consumption_compact_2026.json ships as) -- this is the merge
// step loadConsumptionData() performs after its two fetches resolve, pulled
// out here so it's covered without needing a fetch/browser environment.
(function () {
  var precomputedDataset = {
    sites: Loader.SITE_META,
    byDate: { "2026-01-01": { t: ["00:00"], p: [0.1] } },
    bySite: { rot: { "2026-01-01": { c: [100.0], g: [0.0] } } }
  };
  var hedgeRows = [makeHedgeRow(ROT_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07)];
  var result = Loader.attachHedge(precomputedDataset, hedgeRows);
  assert.strictEqual(result, precomputedDataset, "mutates and returns the same dataset object");
  assert.strictEqual(result.hedge.rot.length, 1);
  assert.strictEqual(result.hedge.venlo.length, 0);
  // the pre-grouped parts are untouched
  assert.deepStrictEqual(result.bySite.rot["2026-01-01"].c, [100.0]);
})();

// attachHedge: defaults siteMeta to Loader.SITE_META when omitted
(function () {
  var result = Loader.attachHedge({ byDate: {}, bySite: {} }, []);
  assert.deepStrictEqual(
    Object.keys(result.hedge).sort(),
    Loader.SITE_META.map(function (m) { return m.id; }).sort()
  );
})();

console.log("consumption-data-loader.test.js: all assertions passed");
