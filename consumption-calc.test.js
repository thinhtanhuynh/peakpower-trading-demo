var assert = require("assert");
var ConsumptionCalc = require("./consumption-calc.js");

function assertClose(actual, expected, message) {
  var epsilon = 1e-6;
  assert.ok(Math.abs(actual - expected) < epsilon,
    (message || "") + " expected " + expected + " got " + actual);
}

// Fixture hedge blocks matching PeakPowerTrading-CalculationSample.csv:
// a single 1 MW base block (all year) + a single 1 MW peak block (Mon-Fri
// 08:15-20:00 inclusive), i.e. 250 kWh base / 250 kWh peak per interval.
var SAMPLE_HEDGE = [
  { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000 },
  { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000 }
];
// 2026-01-05 is a Monday.
var MONDAY = "2026-01-05";

// Real rows lifted from PeakPowerTrading-CalculationSample.csv (kWh values
// there are per-interval energy, so consumptionKw/productionKw below are
// back-converted ×4 to get the same kWh after this module's ×0.25 step).

// 00:00 — Case A (0 <= Actual Usage <= Hedge Volume): surplus hedge sold at EPEX.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("00:00", 180 * 4, 0, 0.17965, MONDAY, SAMPLE_HEDGE);
  assertClose(row.usageCost, 34.137, "00:00 usageCost");
  assertClose(row.actualUsage, 180, "00:00 actualUsage");
  assertClose(row.baseVolumeKwh, 250, "00:00 baseVolume");
  assertClose(row.peakVolumeKwh, 0, "00:00 peakVolume (outside 08:00-20:00)");
  assertClose(row.hedgeVolumeKwh, 250, "00:00 hedgeVolume");
  assertClose(row.uncovered, -70, "00:00 uncovered");
  assertClose(row.long, 70, "00:00 long");
  assertClose(row.short, 0, "00:00 short");
  assertClose(row.deltaCost, -12.5755, "00:00 deltaCost");
})();

// 07:00 — Case B (Actual Usage > Hedge Volume), still before the peak window.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("07:00", 303 * 4, 50 * 4, 0.20143, MONDAY, SAMPLE_HEDGE);
  assertClose(row.actualUsage, 253, "07:00 actualUsage");
  assertClose(row.peakVolumeKwh, 0, "07:00 peakVolume (before 08:00)");
  assertClose(row.hedgeVolumeKwh, 250, "07:00 hedgeVolume");
  assertClose(row.uncovered, 3, "07:00 uncovered");
  assertClose(row.short, 3, "07:00 short");
  assertClose(row.long, 0, "07:00 long");
  assertClose(row.deltaCost, 0.60429, "07:00 deltaCost");
})();

// 08:00 — a record's timestamp marks the END of its window, so "08:00"
// covers 07:45-08:00 — still BEFORE the 08:00 peak block starts. Peak stays
// inactive here even though the label reads "08:00" (this intentionally
// diverges from PeakPowerTrading-CalculationSample.csv's literal "8:00" row,
// which assumed a start-of-interval timestamp convention — see the comment
// on isPeakWindow in consumption-calc.js).
(function () {
  var row = ConsumptionCalc.computeIntervalRow("08:00", 427 * 4, 100 * 4, 0.19532, MONDAY, SAMPLE_HEDGE);
  assertClose(row.actualUsage, 327, "08:00 actualUsage");
  assertClose(row.baseVolumeKwh, 250, "08:00 baseVolume");
  assertClose(row.peakVolumeKwh, 0, "08:00 peakVolume (still before the block; window is 07:45-08:00)");
  assertClose(row.hedgeVolumeKwh, 250, "08:00 hedgeVolume");
  assertClose(row.uncovered, 77, "08:00 uncovered");
  assertClose(row.short, 77, "08:00 short");
  assertClose(row.long, 0, "08:00 long");
  assertClose(row.deltaCost, 15.03964, "08:00 deltaCost");
})();

// 08:15 — the first interval whose window (08:00-08:15) is fully inside the
// peak block; matches the sample's "8:15" row (which was already >= 08:00
// under either convention, so it's unaffected by the boundary fix).
(function () {
  var row = ConsumptionCalc.computeIntervalRow("08:15", 458 * 4, 116 * 4, 0.18974, MONDAY, SAMPLE_HEDGE);
  assertClose(row.actualUsage, 342, "08:15 actualUsage");
  assertClose(row.peakVolumeKwh, 250, "08:15 peakVolume (first interval inside the block)");
  assertClose(row.hedgeVolumeKwh, 500, "08:15 hedgeVolume");
  assertClose(row.uncovered, -158, "08:15 uncovered");
  assertClose(row.long, 158, "08:15 long");
  assertClose(row.deltaCost, -29.97892, "08:15 deltaCost");
})();

// 13:00 — Case C (Actual Usage < 0, net export): Delta Cost = Usage Cost - Hedge Volume*EPEX.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("13:00", 384 * 4, 540 * 4, 0.11394, MONDAY, SAMPLE_HEDGE);
  assertClose(row.usageCost, -16.63464, "13:00 usageCost");
  assertClose(row.actualUsage, -156, "13:00 actualUsage");
  assertClose(row.hedgeVolumeKwh, 500, "13:00 hedgeVolume");
  assertClose(row.deltaCost, -73.60464, "13:00 deltaCost (net-export case)");
})();

// 20:00 — peak window's closing boundary is inclusive (still peak).
(function () {
  var row = ConsumptionCalc.computeIntervalRow("20:00", 680 * 4, 0, 0.17959, MONDAY, SAMPLE_HEDGE);
  assertClose(row.peakVolumeKwh, 250, "20:00 peakVolume (inclusive boundary)");
  assertClose(row.hedgeVolumeKwh, 500, "20:00 hedgeVolume");
  assertClose(row.uncovered, 180, "20:00 uncovered");
  assertClose(row.short, 180, "20:00 short");
  assertClose(row.deltaCost, 32.3262, "20:00 deltaCost");
})();

// 20:15 — one interval later, peak window has closed.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("20:15", 632 * 4, 0, 0.21122, MONDAY, SAMPLE_HEDGE);
  assertClose(row.peakVolumeKwh, 0, "20:15 peakVolume (window closed)");
  assertClose(row.hedgeVolumeKwh, 250, "20:15 hedgeVolume");
  assertClose(row.uncovered, 382, "20:15 uncovered");
  assertClose(row.short, 382, "20:15 short");
  assertClose(row.deltaCost, 80.68604, "20:15 deltaCost");
})();

// 22:00 — Case B example quoted directly in the spec.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("22:00", 300 * 4, 0, 0.23879, MONDAY, SAMPLE_HEDGE);
  assertClose(row.actualUsage, 300, "22:00 actualUsage");
  assertClose(row.hedgeVolumeKwh, 250, "22:00 hedgeVolume");
  assertClose(row.deltaCost, 11.9395, "22:00 deltaCost");
})();

// Peak block does not apply on weekends, even inside the 08:00-20:00 window.
(function () {
  // 2026-01-03 is a Saturday.
  var row = ConsumptionCalc.computeIntervalRow("10:00", 400, 0, 0.15, "2026-01-03", SAMPLE_HEDGE);
  assertClose(row.baseVolumeKwh, 250, "weekend baseVolume still active");
  assertClose(row.peakVolumeKwh, 0, "weekend peakVolume inactive despite time window");
  assertClose(row.hedgeVolumeKwh, 250, "weekend hedgeVolume (base only)");
})();

// Hedge block outside its period contributes nothing (guards div-by-zero-free math).
(function () {
  var hedge = [{ shape: "base", periodStart: "2026-06-01", periodEnd: "2026-06-30", powerKw: 1000 }];
  var row = ConsumptionCalc.computeIntervalRow("10:00", 400, 0, 0.15, MONDAY, hedge);
  assertClose(row.hedgeVolumeKwh, 0, "out-of-period hedgeVolume");
  assertClose(row.uncovered, 100, "out-of-period uncovered = full actualUsage");
});

// No hedgeBlocks at all -> zero hedge volume, uncovered = full actual usage.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("10:00", 400, 0, 0.15, MONDAY, null);
  assertClose(row.hedgeVolumeKwh, 0, "no hedge -> hedgeVolume 0");
  assertClose(row.uncovered, 100, "no hedge -> uncovered = full actualUsage");
  assertClose(row.short, 100, "no hedge -> short = full actualUsage");
})();

// Multiple simultaneously-active blocks of the same shape stack (e.g. YEAR + QUARTER base).
(function () {
  var hedge = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000 },
    { shape: "base", periodStart: "2026-04-01", periodEnd: "2026-06-30", powerKw: 2000 },
    { shape: "peak", periodStart: "2026-04-01", periodEnd: "2026-06-30", powerKw: 1000 }
  ];
  // 2026-04-06 is a Monday, inside Q2 2026.
  var row = ConsumptionCalc.computeIntervalRow("10:00", 800, 0, 0.15, "2026-04-06", hedge);
  assertClose(row.baseVolumeKwh, 750, "stacked base volumes: (1000+2000)kW * 0.25h");
  assertClose(row.peakVolumeKwh, 250, "single active peak block");
  assertClose(row.hedgeVolumeKwh, 1000, "hedgeVolume sums base+peak");
})();

// computeIntervalSeries: per-index dates array (Month-view usage) -> different weekday per index.
(function () {
  // index 0: Saturday 2026-01-03 10:00 (base only); index 1: Monday 2026-01-05 10:00 (base+peak)
  var series = ConsumptionCalc.computeIntervalSeries(
    ["10:00", "10:00"], [0.15, 0.15], [400, 400], [0, 0],
    ["2026-01-03", "2026-01-05"], SAMPLE_HEDGE
  );
  assertClose(series.hedgeVolume[0], 250, "per-index dates: Saturday base-only");
  assertClose(series.hedgeVolume[1], 500, "per-index dates: Monday base+peak");
})();

// computeIntervalSeries: single dateStr applied to every index (Day-view usage).
(function () {
  var series = ConsumptionCalc.computeIntervalSeries(
    ["10:00", "10:15"], [0.10, 0.20], [600, 600], [0, 0], "2026-01-05", SAMPLE_HEDGE
  );
  assertClose(series.actualUsage[0], 150, "actualUsage[0] = 600kW * 0.25h");
  assertClose(series.usageCost[0], 150 * 0.11, "usageCost[0] = 150kWh * (0.10+0.01)");
  assertClose(series.hedgeVolume[0], 500, "hedgeVolume[0] (weekday, peak window)");
})();

// computeDayStats: aggregates sums across intervals, including nonlinear long/short/deltaCost.
(function () {
  var stats = ConsumptionCalc.computeDayStats(
    ["00:00", "08:00"], [0.17965, 0.19532], [180 * 4, 427 * 4], [0, 100 * 4], MONDAY, SAMPLE_HEDGE
  );
  assertClose(stats.consumptionKwh, 180 + 427, "computeDayStats consumptionKwh");
  assertClose(stats.productionKwh, 100, "computeDayStats productionKwh");
  assertClose(stats.actualUsageKwh, 180 + 327, "computeDayStats actualUsageKwh");
  assertClose(stats.peakKw, 427 * 4, "computeDayStats peakKw picks the highest consumption interval");
  assert.strictEqual(stats.peakTime, "08:00", "computeDayStats peakTime");
  assertClose(stats.baseVolumeKwh, 250 + 250, "computeDayStats baseVolumeKwh sums both intervals");
  assertClose(stats.peakVolumeKwh, 0 + 0, "computeDayStats peakVolumeKwh (08:00 itself is still before the peak block)");
  assertClose(stats.hedgeVolumeKwh, 250 + 250, "computeDayStats hedgeVolumeKwh sums both intervals");
  assertClose(stats.longKwh, 70 + 0, "computeDayStats longKwh sums both intervals");
  assertClose(stats.shortKwh, 0 + 77, "computeDayStats shortKwh (08:00 interval is now under-hedged)");
  assertClose(stats.deltaCostEur, -12.5755 + 15.03964, "computeDayStats deltaCostEur sums both intervals");
})();

// computeDayStats: works with no hedgeBlocks (4/5-arg call), new fields default to 0.
(function () {
  var stats = ConsumptionCalc.computeDayStats(["00:00", "00:15"], [0.10, 0.20], [400, 800], [0, 200]);
  assertClose(stats.consumptionKwh, 300, "no-hedge computeDayStats consumptionKwh");
  assertClose(stats.hedgeVolumeKwh, 0, "no-hedge computeDayStats hedgeVolumeKwh");
  assertClose(stats.uncoveredKwh, stats.actualUsageKwh, "no-hedge uncoveredKwh = full actualUsageKwh");
})();

// formatNL: comma decimal, dot thousands, negative sign (unchanged).
(function () {
  assert.strictEqual(ConsumptionCalc.formatNL(612.4, 1), "612,4");
  assert.strictEqual(ConsumptionCalc.formatNL(1234.5, 1), "1.234,5");
  assert.strictEqual(ConsumptionCalc.formatNL(-62.5, 1), "-62,5");
  assert.strictEqual(ConsumptionCalc.formatNL(0.0896, 4), "0,0896");
  assert.strictEqual(ConsumptionCalc.formatNL(0, 1), "0,0");
})();

console.log("consumption-calc.test.js: all assertions passed");
