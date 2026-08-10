/*
 * Per-interval trading calculation, following
 * PeakPowerTrading-CalculationSample.csv column-for-column:
 *
 *   Usage Cost   = Consumption×(EPEX+TUF) − Production×(EPEX+FDF)
 *   Actual Usage = Consumption − Production
 *   Base Volume  = sum of active "base" hedge blocks for the interval (kWh)
 *   Peak Volume  = sum of active "peak" hedge blocks for the interval (kWh)
 *                  — peak blocks are only active Mon–Fri, from 08:15
 *                  through 20:00 inclusive. Each interval's timestamp marks
 *                  the END of its 15-minute window (e.g. "08:00" covers
 *                  07:45-08:00, before the peak block starts), so "08:00"
 *                  itself is excluded and "08:15" (covering 08:00-08:15,
 *                  the first window actually inside the block) is the
 *                  first peak interval; "20:00" (covering 19:45-20:00) is
 *                  still peak, "20:15" is not.
 *   Hedge Volume = Base Volume + Peak Volume
 *   Uncovered    = Actual Usage − Hedge Volume
 *   Long         = max(0, −Uncovered)   -- over-hedged; surplus sold at spot
 *   Short        = max(0, Uncovered)    -- under-hedged; shortfall bought at spot
 *   Delta Cost   = Actual Usage < 0
 *                    ? Usage Cost − (Hedge Volume × EPEX)
 *                    : EPEX × (Actual Usage − Hedge Volume)
 *
 * consumptionKw/productionKw are instantaneous average power (kW, the
 * source data's unit) — converted to kWh internally (× 0.25 h) to match
 * the sample, which works in per-interval kWh throughout.
 */
(function (root) {
  "use strict";

  // €/kWh — small fixed grid fees layered on top of the EPEX spot price.
  // Not present in any source data file; held constant across all sites for
  // this POC (see CLAUDE.md).
  var DEFAULT_TUF = 0.01;   // added when buying (consumption) extra retail volume
  var DEFAULT_FDF = 0.005;  // added when feeding (production) into the grid

  function resolveDate(dates, i) {
    return typeof dates === "string" ? dates : dates[i];
  }

  function isWeekday(dateStr) {
    var p = dateStr.split("-").map(Number);
    var weekday = new Date(p[0], p[1] - 1, p[2]).getDay(); // 0=Sun..6=Sat
    return weekday >= 1 && weekday <= 5;
  }

  // Excludes exactly "08:00" (that interval's usage window is 07:45-08:00,
  // before the block starts); includes "08:15" through "20:00" inclusive
  // ("20:00" covers 19:45-20:00, still inside the block; "20:15" is not).
  function isPeakWindow(timeStr) {
    return timeStr > "08:00" && timeStr <= "20:00";
  }

  /** Splits a date+time's active hedge blocks into Base Volume vs Peak Volume (kWh). */
  function computeIntervalHedgeVolumes(dateStr, timeStr, hedgeBlocks) {
    var baseVolumeKwh = 0;
    var peakVolumeKwh = 0;
    if (hedgeBlocks) {
      var peakActive = isWeekday(dateStr) && isPeakWindow(timeStr);
      for (var i = 0; i < hedgeBlocks.length; i++) {
        var b = hedgeBlocks[i];
        if (dateStr < b.periodStart || dateStr > b.periodEnd) { continue; }
        if (b.shape === "base") {
          baseVolumeKwh += b.powerKw * 0.25;
        } else if (b.shape === "peak" && peakActive) {
          peakVolumeKwh += b.powerKw * 0.25;
        }
      }
    }
    return { baseVolumeKwh: baseVolumeKwh, peakVolumeKwh: peakVolumeKwh, hedgeVolumeKwh: baseVolumeKwh + peakVolumeKwh };
  }

  /** Full per-interval row — every column of the reference calculation sample. */
  function computeIntervalRow(timeStr, consumptionKw, productionKw, epex, dateStr, hedgeBlocks, tuf, fdf) {
    tuf = tuf === undefined ? DEFAULT_TUF : tuf;
    fdf = fdf === undefined ? DEFAULT_FDF : fdf;

    var consumptionKwh = consumptionKw * 0.25;
    var productionKwh = productionKw * 0.25;
    var usageCost = consumptionKwh * (epex + tuf) - productionKwh * (epex + fdf);
    var actualUsage = consumptionKwh - productionKwh;

    var hedge = hedgeBlocks
      ? computeIntervalHedgeVolumes(dateStr, timeStr, hedgeBlocks)
      : { baseVolumeKwh: 0, peakVolumeKwh: 0, hedgeVolumeKwh: 0 };

    var uncovered = actualUsage - hedge.hedgeVolumeKwh;
    var long = Math.max(0, -uncovered);
    var short = Math.max(0, uncovered);
    var deltaCost = actualUsage < 0
      ? usageCost - hedge.hedgeVolumeKwh * epex
      : epex * (actualUsage - hedge.hedgeVolumeKwh);

    return {
      tuf: tuf,
      fdf: fdf,
      epex: epex,
      consumptionKwh: consumptionKwh,
      productionKwh: productionKwh,
      usageCost: usageCost,
      actualUsage: actualUsage,
      baseVolumeKwh: hedge.baseVolumeKwh,
      peakVolumeKwh: hedge.peakVolumeKwh,
      hedgeVolumeKwh: hedge.hedgeVolumeKwh,
      uncovered: uncovered,
      long: long,
      short: short,
      deltaCost: deltaCost
    };
  }

  /** Per-interval arrays across a Day (single dateStr) or Month (dates[] per index). */
  function computeIntervalSeries(times, prices, consumption, production, dates, hedgeBlocks, tuf, fdf) {
    var n = times.length;
    var out = {
      consumptionKwh: [], productionKwh: [], usageCost: [], actualUsage: [],
      baseVolume: [], peakVolume: [], hedgeVolume: [],
      uncovered: [], long: [], short: [], deltaCost: []
    };
    for (var i = 0; i < n; i++) {
      var dateStr = dates ? resolveDate(dates, i) : null;
      var row = computeIntervalRow(times[i], consumption[i], production[i], prices[i], dateStr, hedgeBlocks, tuf, fdf);
      out.consumptionKwh.push(row.consumptionKwh);
      out.productionKwh.push(row.productionKwh);
      out.usageCost.push(row.usageCost);
      out.actualUsage.push(row.actualUsage);
      out.baseVolume.push(row.baseVolumeKwh);
      out.peakVolume.push(row.peakVolumeKwh);
      out.hedgeVolume.push(row.hedgeVolumeKwh);
      out.uncovered.push(row.uncovered);
      out.long.push(row.long);
      out.short.push(row.short);
      out.deltaCost.push(row.deltaCost);
    }
    return out;
  }

  /** Day/Month aggregate totals, plus peak demand. */
  function computeDayStats(times, prices, consumption, production, dates, hedgeBlocks, tuf, fdf) {
    var n = times.length;
    var consumptionKwh = 0, productionKwh = 0, usageCostEur = 0;
    var baseVolumeKwh = 0, peakVolumeKwh = 0, hedgeVolumeKwh = 0;
    var uncoveredKwh = 0, longKwh = 0, shortKwh = 0, deltaCostEur = 0;
    var peakKw = -Infinity, peakTime = null;

    for (var i = 0; i < n; i++) {
      var dateStr = dates ? resolveDate(dates, i) : null;
      var row = computeIntervalRow(times[i], consumption[i], production[i], prices[i], dateStr, hedgeBlocks, tuf, fdf);
      consumptionKwh += row.consumptionKwh;
      productionKwh += row.productionKwh;
      usageCostEur += row.usageCost;
      baseVolumeKwh += row.baseVolumeKwh;
      peakVolumeKwh += row.peakVolumeKwh;
      hedgeVolumeKwh += row.hedgeVolumeKwh;
      uncoveredKwh += row.uncovered;
      longKwh += row.long;
      shortKwh += row.short;
      deltaCostEur += row.deltaCost;
      if (consumption[i] > peakKw) {
        peakKw = consumption[i];
        peakTime = times[i];
      }
    }

    return {
      consumptionKwh: consumptionKwh,
      productionKwh: productionKwh,
      actualUsageKwh: consumptionKwh - productionKwh,
      peakKw: peakKw,
      peakTime: peakTime,
      usageCostEur: usageCostEur,
      baseVolumeKwh: baseVolumeKwh,
      peakVolumeKwh: peakVolumeKwh,
      hedgeVolumeKwh: hedgeVolumeKwh,
      uncoveredKwh: uncoveredKwh,
      longKwh: longKwh,
      shortKwh: shortKwh,
      deltaCostEur: deltaCostEur
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
    DEFAULT_TUF: DEFAULT_TUF,
    DEFAULT_FDF: DEFAULT_FDF,
    computeIntervalHedgeVolumes: computeIntervalHedgeVolumes,
    computeIntervalRow: computeIntervalRow,
    computeIntervalSeries: computeIntervalSeries,
    computeDayStats: computeDayStats,
    formatNL: formatNL
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ConsumptionCalc = api;
  }
})(typeof window !== "undefined" ? window : this);
