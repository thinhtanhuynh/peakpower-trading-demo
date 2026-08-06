var assert = require("assert");
var ConsumptionCalc = require("./consumption-calc.js");

function assertClose(actual, expected, message) {
  var epsilon = 1e-9;
  assert.ok(Math.abs(actual - expected) < epsilon,
    (message || "") + " expected " + expected + " got " + actual);
}

// computeDayStats: totals, peak, spot result
(function () {
  var times = ["00:00", "00:15"];
  var prices = [0.10, 0.20];
  var consumption = [100, 200];
  var production = [0, 50];
  var stats = ConsumptionCalc.computeDayStats(times, prices, consumption, production);

  assertClose(stats.consumptionKwh, 75, "consumptionKwh");
  assertClose(stats.productionKwh, 12.5, "productionKwh");
  assertClose(stats.netKwh, 62.5, "netKwh");
  assert.strictEqual(stats.peakKw, 200, "peakKw");
  assert.strictEqual(stats.peakTime, "00:15", "peakTime");
  assertClose(stats.spotResultEur, 10, "spotResultEur");
})();

// computeDayStats: net exporter (production > consumption) gives negative net/spot result
(function () {
  var stats = ConsumptionCalc.computeDayStats(["12:00"], [0.10], [50], [200]);
  assertClose(stats.netKwh, -37.5, "netKwh (exporter)");
  assertClose(stats.spotResultEur, -3.75, "spotResultEur (exporter)");
})();

// formatNL: comma decimal, dot thousands, negative sign
(function () {
  assert.strictEqual(ConsumptionCalc.formatNL(612.4, 1), "612,4");
  assert.strictEqual(ConsumptionCalc.formatNL(1234.5, 1), "1.234,5");
  assert.strictEqual(ConsumptionCalc.formatNL(-62.5, 1), "-62,5");
  assert.strictEqual(ConsumptionCalc.formatNL(0.0896, 4), "0,0896");
  assert.strictEqual(ConsumptionCalc.formatNL(0, 1), "0,0");
})();

// computeIntervalHedge: weekend interval -> base only, peak inactive despite being in the 8-20 hour window
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  // 2026-01-03 is a Saturday
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-03", "10:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 250, "weekend hedgeVolumeKwh (base only)");
  assertClose(h.hedgePriceKwh, 0.07, "weekend hedgePriceKwh (base only)");
  assertClose(h.hedgeCostEur, 17.5, "weekend hedgeCostEur (base only)");
})();

// computeIntervalHedge: weekday during peak hours -> base+peak both active, blended price
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  // 2026-01-05 is a Monday
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-05", "10:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 500, "weekday-peak hedgeVolumeKwh (base+peak)");
  assertClose(h.hedgeCostEur, 41.25, "weekday-peak hedgeCostEur (base+peak)");
  assertClose(h.hedgePriceKwh, 0.0825, "weekday-peak blended hedgePriceKwh");
})();

// computeIntervalHedge: same weekday, outside peak hours -> base only
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-05", "21:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 250, "weekday off-hours hedgeVolumeKwh (base only)");
})();

// computeIntervalHedge: date outside the block's period -> no hedge at all, div-by-zero guarded
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-06-01", periodEnd: "2026-06-30", powerKw: 1000, priceKwh: 0.07 }
  ];
  var h = ConsumptionCalc.computeIntervalHedge("2026-01-05", "10:00", hedgeBlocks);
  assertClose(h.hedgeVolumeKwh, 0, "out-of-period hedgeVolumeKwh");
  assertClose(h.hedgePriceKwh, 0, "out-of-period hedgePriceKwh guards div-by-zero");
  assertClose(h.hedgeCostEur, 0, "out-of-period hedgeCostEur");
})();

// computeIntervalSeries: single dateStr applied to every index (Day-view usage)
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 }
  ];
  var series = ConsumptionCalc.computeIntervalSeries(
    ["10:00", "10:15"], [0.10, 0.20], [600, 600], [0, 0], "2026-01-03", hedgeBlocks
  );
  assertClose(series.netCost[0], 15, "netCost[0] = (600kW*0.25h)*0.10");
  assertClose(series.hedgeVolume[0], 250, "hedgeVolume[0]");
  assertClose(series.uncovered[0], 150 - 250, "uncovered[0] = netKwh - hedgeVolume");
  assertClose(series.netCost[1], 30, "netCost[1] = (600kW*0.25h)*0.20");
})();

// computeIntervalSeries: per-index dates array (Month-view usage) -> different weekday per index
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
    { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
  ];
  // index 0: Saturday 2026-01-03 10:00 (base only); index 1: Monday 2026-01-05 10:00 (base+peak)
  var series = ConsumptionCalc.computeIntervalSeries(
    ["10:00", "10:00"], [0.10, 0.10], [600, 600], [0, 0],
    ["2026-01-03", "2026-01-05"], hedgeBlocks
  );
  assertClose(series.hedgeVolume[0], 250, "per-index dates: Saturday base-only");
  assertClose(series.hedgeVolume[1], 500, "per-index dates: Monday base+peak");
})();

// computeIntervalSeries: no hedgeBlocks given -> all hedge fields zero, uncovered = full netKwh
(function () {
  var series = ConsumptionCalc.computeIntervalSeries(["10:00"], [0.10], [600], [0], "2026-01-03", null);
  assertClose(series.hedgeVolume[0], 0, "no hedge -> hedgeVolume 0");
  assertClose(series.uncovered[0], 150, "no hedge -> uncovered = full netKwh");
})();

// computeDayStats: existing 4-arg call still works, new fields default to 0
(function () {
  var stats = ConsumptionCalc.computeDayStats(["00:00", "00:15"], [0.10, 0.20], [100, 200], [0, 50]);
  assertClose(stats.consumptionKwh, 75, "4-arg computeDayStats still computes consumptionKwh");
  assertClose(stats.hedgeCostEur, 0, "4-arg computeDayStats: hedgeCostEur 0 without hedge args");
  assertClose(stats.uncoveredKwh, 0, "4-arg computeDayStats: uncoveredKwh 0 without hedge args");
})();

// computeDayStats: 6-arg call aggregates hedge cost/uncovered across the day
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 }
  ];
  var stats = ConsumptionCalc.computeDayStats(
    ["10:00", "10:15"], [0.10, 0.10], [600, 600], [0, 0], "2026-01-03", hedgeBlocks
  );
  assertClose(stats.hedgeCostEur, 17.5 * 2, "computeDayStats hedgeCostEur sums both intervals");
  assertClose(stats.uncoveredKwh, (150 - 250) * 2, "computeDayStats uncoveredKwh sums both intervals");
})();

console.log("consumption-calc.test.js: all assertions passed");
