(function (root) {
  "use strict";

  function computeDayStats(times, prices, consumption, production) {
    var n = times.length;
    var consumptionKwh = 0;
    var productionKwh = 0;
    var spotResultEur = 0;
    var peakKw = -Infinity;
    var peakTime = null;

    for (var i = 0; i < n; i++) {
      var c = consumption[i];
      var g = production[i];
      var net = c - g;
      consumptionKwh += c * 0.25;
      productionKwh += g * 0.25;
      spotResultEur += net * 0.25 * prices[i];
      if (c > peakKw) {
        peakKw = c;
        peakTime = times[i];
      }
    }

    return {
      consumptionKwh: consumptionKwh,
      productionKwh: productionKwh,
      netKwh: consumptionKwh - productionKwh,
      peakKw: peakKw,
      peakTime: peakTime,
      spotResultEur: spotResultEur
    };
  }

  function formatNL(value, decimals) {
    var sign = value < 0 ? "-" : "";
    var abs = Math.abs(value);
    var fixed = abs.toFixed(decimals);
    var pieces = fixed.split(".");
    var intPart = pieces[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    var decPart = pieces.length > 1 ? pieces[1] : "";
    return sign + intPart + (decPart ? "," + decPart : "");
  }

  var api = {
    computeDayStats: computeDayStats,
    formatNL: formatNL
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ConsumptionCalc = api;
  }
})(typeof window !== "undefined" ? window : this);
