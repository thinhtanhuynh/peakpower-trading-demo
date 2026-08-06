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

console.log("consumption-calc.test.js: all assertions passed");
