var assert = require("assert");
var ConsumptionCalc = require("./consumption-calc.js");

function assertClose(actual, expected, message) {
  var epsilon = 1e-6;
  assert.ok(Math.abs(actual - expected) < epsilon,
    (message || "") + " expected " + expected + " got " + actual);
}

// Fixture hedge blocks matching PeakPowerTrading-CalculationSample.csv:
// a single 1 MW base block (all year) + a single 1 MW peak block (Mon-Fri
// 08:00 up to but not including 20:00), i.e. 250 kWh base / 250 kWh peak per interval.
// Prices match hedge_blocks_2026.json's YEAR row (€70/MWh base, €95/MWh peak),
// so hedge cost per interval is 250*0.07 = 17.50 base, 250*0.095 = 23.75 peak.
var SAMPLE_HEDGE = [
  { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 },
  { shape: "peak", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.095 }
];
// 2026-01-05 is a Monday.
var MONDAY = "2026-01-05";

// Real rows lifted from PeakPowerTrading-CalculationSample.csv (kWh values
// there are per-interval energy, so consumptionKw/productionKw below are
// back-converted ×4 to get the same kWh after this module's ×0.25 step).

// 00:00 — Case A (0 <= Actual Usage <= Hedge Volume): surplus hedge sold at EPEX.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("00:00", 180 * 4, 0, 0.17965, MONDAY, SAMPLE_HEDGE);
  assertClose(row.usageCost, 32.337, "00:00 usageCost");
  assertClose(row.actualUsage, 180, "00:00 actualUsage");
  assertClose(row.baseVolumeKwh, 250, "00:00 baseVolume");
  assertClose(row.peakVolumeKwh, 0, "00:00 peakVolume (outside 08:00-20:00)");
  assertClose(row.hedgeVolumeKwh, 250, "00:00 hedgeVolume");
  assertClose(row.uncovered, -70, "00:00 uncovered");
  assertClose(row.long, 70, "00:00 long");
  assertClose(row.short, 0, "00:00 short");
  assertClose(row.deltaCost, -12.5755, "00:00 deltaCost");
  assertClose(row.hedgeCost, 17.5, "00:00 hedgeCost (base block only)");
  assertClose(row.totalCost, -12.5755 + 17.5, "00:00 totalCost = delta + hedge");
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

// 08:00 — interval labels are the interval's START, so "08:00" covers
// 08:00-08:15: the FIRST interval of the peak block. This is one of the two
// rows where the code deliberately diverges from
// PeakPowerTrading-CalculationSample.csv, whose "8:00" row shows no peak
// volume — see the comment on isPeakWindow in consumption-calc.js. Product
// direction: the block starts at 08:00, on the hour.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("08:00", 427 * 4, 100 * 4, 0.19532, MONDAY, SAMPLE_HEDGE);
  assertClose(row.actualUsage, 327, "08:00 actualUsage");
  assertClose(row.baseVolumeKwh, 250, "08:00 baseVolume");
  assertClose(row.peakVolumeKwh, 250, "08:00 peakVolume (first interval of the block)");
  assertClose(row.hedgeVolumeKwh, 500, "08:00 hedgeVolume");
  assertClose(row.uncovered, -173, "08:00 uncovered");
  assertClose(row.short, 0, "08:00 short");
  assertClose(row.long, 173, "08:00 long");
  assertClose(row.deltaCost, -173 * 0.19532, "08:00 deltaCost");
})();

// 08:15 — well inside the block under either convention, so it matches the
// sample's "8:15" row and pins that the fix moved only the boundary.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("08:15", 458 * 4, 116 * 4, 0.18974, MONDAY, SAMPLE_HEDGE);
  assertClose(row.actualUsage, 342, "08:15 actualUsage");
  assertClose(row.peakVolumeKwh, 250, "08:15 peakVolume");
  assertClose(row.hedgeVolumeKwh, 500, "08:15 hedgeVolume");
  assertClose(row.uncovered, -158, "08:15 uncovered");
  assertClose(row.long, 158, "08:15 long");
  assertClose(row.deltaCost, -29.97892, "08:15 deltaCost");
  assertClose(row.hedgeCost, 17.5 + 23.75, "08:15 hedgeCost (base + peak, each at its own price)");
  assertClose(row.totalCost, -29.97892 + 41.25, "08:15 totalCost = delta + hedge");
})();

// 13:00 — net export (Actual Usage < 0). Delta Cost is still simply
// Uncovered x EPEX; there is no longer a separate net-export branch.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("13:00", 384 * 4, 540 * 4, 0.11394, MONDAY, SAMPLE_HEDGE);
  assertClose(row.usageCost, -17.77464, "13:00 usageCost");
  assertClose(row.actualUsage, -156, "13:00 actualUsage");
  assertClose(row.hedgeVolumeKwh, 500, "13:00 hedgeVolume");
  assertClose(row.deltaCost, -74.74464, "13:00 deltaCost (net-export case)");
})();

// 19:45 — covers 19:45-20:00, the LAST interval of the block.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("19:45", 657 * 4, 25 * 4, 0.20968, MONDAY, SAMPLE_HEDGE);
  assertClose(row.actualUsage, 632, "19:45 actualUsage");
  assertClose(row.peakVolumeKwh, 250, "19:45 peakVolume (last interval of the block)");
  assertClose(row.hedgeVolumeKwh, 500, "19:45 hedgeVolume");
  assertClose(row.uncovered, 132, "19:45 uncovered");
  assertClose(row.short, 132, "19:45 short");
})();

// 20:00 — covers 20:00-20:15: the block has closed. The second row where the
// sample disagrees (it shows peak volume here).
(function () {
  var row = ConsumptionCalc.computeIntervalRow("20:00", 680 * 4, 0, 0.17959, MONDAY, SAMPLE_HEDGE);
  assertClose(row.peakVolumeKwh, 0, "20:00 peakVolume (block has closed)");
  assertClose(row.hedgeVolumeKwh, 250, "20:00 hedgeVolume");
  assertClose(row.uncovered, 430, "20:00 uncovered");
  assertClose(row.short, 430, "20:00 short");
  assertClose(row.deltaCost, 430 * 0.17959, "20:00 deltaCost");
})();

// 20:15 — one interval further out, still base-only.
(function () {
  var row = ConsumptionCalc.computeIntervalRow("20:15", 632 * 4, 0, 0.21122, MONDAY, SAMPLE_HEDGE);
  assertClose(row.peakVolumeKwh, 0, "20:15 peakVolume");
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
  assertClose(series.usageCost[0], 150 * 0.10, "usageCost[0] = 150kWh * EPEX 0.10");
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
  assertClose(stats.peakVolumeKwh, 0 + 250, "computeDayStats peakVolumeKwh (08:00 is the block's first interval)");
  assertClose(stats.hedgeVolumeKwh, 250 + 500, "computeDayStats hedgeVolumeKwh sums both intervals");
  assertClose(stats.longKwh, 70 + 173, "computeDayStats longKwh sums both intervals");
  assertClose(stats.shortKwh, 0, "computeDayStats shortKwh (both intervals over-hedged)");
  assertClose(stats.deltaCostEur, -12.5755 + -173 * 0.19532, "computeDayStats deltaCostEur sums both intervals");
  assertClose(stats.hedgeCostEur, 17.5 + (17.5 + 23.75), "computeDayStats hedgeCostEur (base on both, peak on 08:00)");
  assertClose(stats.totalCostEur, stats.deltaCostEur + stats.hedgeCostEur, "computeDayStats totalCostEur = delta + hedge");
})();

// computeDayStats: works with no hedgeBlocks (4/5-arg call), new fields default to 0.
(function () {
  var stats = ConsumptionCalc.computeDayStats(["00:00", "00:15"], [0.10, 0.20], [400, 800], [0, 200]);
  assertClose(stats.consumptionKwh, 300, "no-hedge computeDayStats consumptionKwh");
  assertClose(stats.hedgeVolumeKwh, 0, "no-hedge computeDayStats hedgeVolumeKwh");
  assertClose(stats.uncoveredKwh, stats.actualUsageKwh, "no-hedge uncoveredKwh = full actualUsageKwh");
})();

// intervalEndLabel / intervalRangeLabel: stored labels are interval STARTS,
// every label the UI shows is the interval's END. The day's last interval,
// "23:45", is displayed "00:00" — the midnight that closes the day.
(function () {
  assert.strictEqual(ConsumptionCalc.intervalEndLabel("00:00"), "00:15", "first interval of the day");
  assert.strictEqual(ConsumptionCalc.intervalEndLabel("00:15"), "00:30", "intervalEndLabel steps 15 minutes");
  assert.strictEqual(ConsumptionCalc.intervalEndLabel("09:45"), "10:00", "intervalEndLabel rolls the hour");
  assert.strictEqual(ConsumptionCalc.intervalEndLabel("23:45"), "00:00", "last interval of the day ends at midnight");
  // The peak window, spoken in the labels the UI uses: 08:15 through 20:00.
  assert.strictEqual(ConsumptionCalc.intervalEndLabel("08:00"), "08:15", "first peak interval displays 08:15");
  assert.strictEqual(ConsumptionCalc.intervalEndLabel("19:45"), "20:00", "last peak interval displays 20:00");
  assert.ok(ConsumptionCalc.isPeakInterval(MONDAY, "08:00"), "…and that 08:15-displayed interval IS peak");
  assert.ok(ConsumptionCalc.isPeakInterval(MONDAY, "19:45"), "…as is the 20:00-displayed one");
  assert.ok(!ConsumptionCalc.isPeakInterval(MONDAY, "20:00"), "…while the 20:15-displayed one is not");
  assert.strictEqual(ConsumptionCalc.intervalRangeLabel("08:00"), "08:00 – 08:15", "range label spans the interval");
  assert.strictEqual(ConsumptionCalc.intervalRangeLabel("23:45"), "23:45 – 00:00", "range label crosses midnight");
})();

// formatNL: comma decimal, dot thousands, negative sign (unchanged).
(function () {
  assert.strictEqual(ConsumptionCalc.formatNL(612.4, 1), "612,4");
  assert.strictEqual(ConsumptionCalc.formatNL(1234.5, 1), "1.234,5");
  assert.strictEqual(ConsumptionCalc.formatNL(-62.5, 1), "-62,5");
  assert.strictEqual(ConsumptionCalc.formatNL(0.0896, 4), "0,0896");
  assert.strictEqual(ConsumptionCalc.formatNL(0, 1), "0,0");
})();

// formatEurAbbr / formatKwhAbbr: the Consumption stat cards' iPad-tier
// abbreviation, a threshold not a blanket transform — null below 100,000
// so the caller falls back to full precision. The threshold sits at
// 100,000 rather than the round "1 M" the worked examples suggested,
// because rendering the real page at iPad landscape (1024px) showed
// 6-digit figures like "€ 932.147,88" and "418.890,3 kWh" ALSO overflow
// their card at that width even at the smallest legible font — abbreviate
// too late and the mid-size figures break the same way the large ones did.
(function () {
  assert.strictEqual(ConsumptionCalc.formatEurAbbr(1412678.48), "1,41 M");
  // Six-digit figures get "k", not "M" — "€ 0,93 M" reads worse than the
  // number it replaced (a leading "0," costs both precision and legibility,
  // and diverges from the Back Office convention this borrows, which only
  // ever shows "M" for a genuine million).
  assert.strictEqual(ConsumptionCalc.formatEurAbbr(-932147.88), "-932 k"); // above the 100,000 threshold, below 1 M
  assert.strictEqual(ConsumptionCalc.formatEurAbbr(4788.62), null); // single-day range — stays exact
  assert.strictEqual(ConsumptionCalc.formatEurAbbr(-1500000), "-1,50 M"); // sign preserved, genuine million
  assert.strictEqual(ConsumptionCalc.formatEurAbbr(99999.99), null); // just under the threshold
  // Rounds up into the M tier rather than printing "1.000 k", which would
  // read as a million while claiming not to be one.
  assert.strictEqual(ConsumptionCalc.formatEurAbbr(999999.99), "1,00 M");

  assert.strictEqual(ConsumptionCalc.formatKwhAbbr(18803000), "18.803,0 MWh");
  assert.strictEqual(ConsumptionCalc.formatKwhAbbr(8490285.4), "8.490,3 MWh");
  assert.strictEqual(ConsumptionCalc.formatKwhAbbr(418890.3), "418,9 MWh"); // above the 100,000 threshold too
  assert.strictEqual(ConsumptionCalc.formatKwhAbbr(57273.375), null); // single-day range — stays exact

  // The one failure worse than a cramped layout (per explicit review
  // note): kWh->MWh is a unit change, not just fewer digits, so the
  // number and the "MWh" label must always travel together. Assert this
  // directly rather than trusting the string-equality checks above to
  // catch a regression by accident — a caller could change the divisor
  // without touching the suffix and every assertion above would still
  // read as "close enough" at a glance.
  assert.ok(/ MWh$/.test(ConsumptionCalc.formatKwhAbbr(18803000)), "abbreviated kWh must carry the MWh label, not the original kWh one");
  assert.strictEqual(ConsumptionCalc.formatKwhAbbr(18803000).indexOf("kWh"), -1, "must not contain a stray kWh label after converting to MWh");
})();

console.log("consumption-calc.test.js: all assertions passed");
