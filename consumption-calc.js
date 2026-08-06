(function (root) {
  "use strict";

  function resolveDate(dates, i) {
    return typeof dates === "string" ? dates : dates[i];
  }

  function computeIntervalHedge(dateStr, timeStr, hedgeBlocks) {
    var hour = parseInt(timeStr.slice(0, 2), 10);
    var dateParts = dateStr.split("-").map(Number);
    var weekday = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay(); // 0=Sun..6=Sat
    var isWeekday = weekday >= 1 && weekday <= 5;
    var isPeakHour = hour >= 8 && hour < 20;

    var hedgeVolumeKwh = 0;
    var hedgeCostEur = 0;
    for (var i = 0; i < hedgeBlocks.length; i++) {
      var b = hedgeBlocks[i];
      if (dateStr < b.periodStart || dateStr > b.periodEnd) { continue; }
      if (b.shape === "peak" && !(isWeekday && isPeakHour)) { continue; }
      var volume = b.powerKw * 0.25;
      hedgeVolumeKwh += volume;
      hedgeCostEur += volume * b.priceKwh;
    }
    var hedgePriceKwh = hedgeVolumeKwh > 0 ? hedgeCostEur / hedgeVolumeKwh : 0;
    return { hedgeVolumeKwh: hedgeVolumeKwh, hedgePriceKwh: hedgePriceKwh, hedgeCostEur: hedgeCostEur };
  }

  function computeIntervalSeries(times, prices, consumption, production, dates, hedgeBlocks) {
    var n = times.length;
    var netCost = [];
    var hedgeVolume = [];
    var hedgePrice = [];
    var hedgeCost = [];
    var uncovered = [];

    for (var i = 0; i < n; i++) {
      var netKwh = (consumption[i] - production[i]) * 0.25;
      var h = hedgeBlocks ? computeIntervalHedge(resolveDate(dates, i), times[i], hedgeBlocks)
                          : { hedgeVolumeKwh: 0, hedgePriceKwh: 0, hedgeCostEur: 0 };
      netCost.push(netKwh * prices[i]);
      hedgeVolume.push(h.hedgeVolumeKwh);
      hedgePrice.push(h.hedgePriceKwh);
      hedgeCost.push(h.hedgeCostEur);
      uncovered.push(netKwh - h.hedgeVolumeKwh);
    }

    return { netCost: netCost, hedgeVolume: hedgeVolume, hedgePrice: hedgePrice, hedgeCost: hedgeCost, uncovered: uncovered };
  }

  function computeDayStats(times, prices, consumption, production, dates, hedgeBlocks) {
    var n = times.length;
    var consumptionKwh = 0;
    var productionKwh = 0;
    var spotResultEur = 0;
    var peakKw = -Infinity;
    var peakTime = null;
    var hedgeCostEur = 0;
    var uncoveredKwh = 0;
    var hasHedge = !!(dates && hedgeBlocks);

    for (var i = 0; i < n; i++) {
      var c = consumption[i];
      var g = production[i];
      var netKwh = (c - g) * 0.25;
      consumptionKwh += c * 0.25;
      productionKwh += g * 0.25;
      spotResultEur += netKwh * prices[i];
      if (c > peakKw) {
        peakKw = c;
        peakTime = times[i];
      }
      if (hasHedge) {
        var h = computeIntervalHedge(resolveDate(dates, i), times[i], hedgeBlocks);
        hedgeCostEur += h.hedgeCostEur;
        uncoveredKwh += netKwh - h.hedgeVolumeKwh;
      }
    }

    return {
      consumptionKwh: consumptionKwh,
      productionKwh: productionKwh,
      netKwh: consumptionKwh - productionKwh,
      peakKw: peakKw,
      peakTime: peakTime,
      spotResultEur: spotResultEur,
      hedgeCostEur: hedgeCostEur,
      uncoveredKwh: uncoveredKwh
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
    computeIntervalHedge: computeIntervalHedge,
    computeIntervalSeries: computeIntervalSeries,
    formatNL: formatNL
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ConsumptionCalc = api;
  }
})(typeof window !== "undefined" ? window : this);
