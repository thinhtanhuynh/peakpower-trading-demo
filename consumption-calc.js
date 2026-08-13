/*
 * Per-interval trading calculation, following
 * PeakPowerTrading-CalculationSample.csv column-for-column:
 *
 *   Usage Cost   = (Consumption − Production) × EPEX
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
 *   Delta Cost   = Uncovered × EPEX
 *   Hedge Cost   = Base Volume × base block price/kWh
 *                  + Peak Volume × peak block price/kWh
 *   Total Cost   = Delta Cost + Hedge Cost
 *
 * consumptionKw/productionKw are instantaneous average power (kW, the
 * source data's unit) — converted to kWh internally (× 0.25 h) to match
 * the sample, which works in per-interval kWh throughout.
 */
(function (root) {
  "use strict";

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

  /**
   * Whether a date+time falls in a "peak" hedge block's active window
   * (Mon-Fri, 08:15-20:00 inclusive) — exported so any caller needing the
   * same base-vs-peak distinction (e.g. picking which indicative forward
   * price applies to a projected interval) reuses this exact convention
   * rather than re-deriving it. computeIntervalHedgeVolumes uses the same
   * two private functions internally.
   */
  function isPeakInterval(dateStr, timeStr) {
    return isWeekday(dateStr) && isPeakWindow(timeStr);
  }

  /**
   * Splits a date+time's active hedge blocks into Base Volume vs Peak Volume
   * (kWh), and prices each block's own volume at its own contract price to
   * give the interval's Hedge Cost (€).
   */
  function computeIntervalHedgeVolumes(dateStr, timeStr, hedgeBlocks) {
    var baseVolumeKwh = 0;
    var peakVolumeKwh = 0;
    var hedgeCost = 0;
    if (hedgeBlocks) {
      var peakActive = isWeekday(dateStr) && isPeakWindow(timeStr);
      for (var i = 0; i < hedgeBlocks.length; i++) {
        var b = hedgeBlocks[i];
        if (dateStr < b.periodStart || dateStr > b.periodEnd) { continue; }
        var blockKwh = b.powerKw * 0.25;
        if (b.shape === "base") {
          baseVolumeKwh += blockKwh;
          hedgeCost += blockKwh * (b.priceKwh || 0);
        } else if (b.shape === "peak" && peakActive) {
          peakVolumeKwh += blockKwh;
          hedgeCost += blockKwh * (b.priceKwh || 0);
        }
      }
    }
    return {
      baseVolumeKwh: baseVolumeKwh,
      peakVolumeKwh: peakVolumeKwh,
      hedgeVolumeKwh: baseVolumeKwh + peakVolumeKwh,
      hedgeCost: hedgeCost
    };
  }

  /**
   * Full per-interval row — every column of the reference calculation sample.
   *
   * `consumptionKw`/`productionKw`/`epex` may independently be `null`, and
   * every column that depends on a missing input comes back `null` rather
   * than a fabricated number — never an all-or-nothing gate. In particular:
   *   - consumption/production known, EPEX unknown (a projected forward
   *     interval, priced spot-forward is not knowable): actualUsage,
   *     uncovered, long, short still compute — they don't need EPEX — but
   *     usageCost, deltaCost, totalCost stay null.
   *   - hedge-position columns (base/peak/hedge volume, hedge cost) are
   *     always returned: they depend only on the hedge blocks' own contract
   *     price and the calendar, never on metered usage or spot price.
   * This is additive: every existing caller passes all three, so real-data
   * results are unchanged (verified by consumption-calc.test.js).
   */
  function computeIntervalRow(timeStr, consumptionKw, productionKw, epex, dateStr, hedgeBlocks) {
    var hedge = hedgeBlocks
      ? computeIntervalHedgeVolumes(dateStr, timeStr, hedgeBlocks)
      : { baseVolumeKwh: 0, peakVolumeKwh: 0, hedgeVolumeKwh: 0, hedgeCost: 0 };

    var consumptionKwh = consumptionKw != null ? consumptionKw * 0.25 : null;
    var productionKwh = productionKw != null ? productionKw * 0.25 : null;
    var actualUsage = (consumptionKwh != null && productionKwh != null) ? consumptionKwh - productionKwh : null;
    var usageCost = (actualUsage != null && epex != null) ? actualUsage * epex : null;

    var uncovered = actualUsage != null ? actualUsage - hedge.hedgeVolumeKwh : null;
    var long = uncovered != null ? Math.max(0, -uncovered) : null;
    var short = uncovered != null ? Math.max(0, uncovered) : null;
    var deltaCost = (uncovered != null && epex != null) ? uncovered * epex : null;
    var totalCost = deltaCost != null ? deltaCost + hedge.hedgeCost : null;

    return {
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
      deltaCost: deltaCost,
      hedgeCost: hedge.hedgeCost,
      totalCost: totalCost
    };
  }

  /** Per-interval arrays across a Day (single dateStr) or Month (dates[] per index). */
  function computeIntervalSeries(times, prices, consumption, production, dates, hedgeBlocks) {
    var n = times.length;
    var out = {
      consumptionKwh: [], productionKwh: [], usageCost: [], actualUsage: [],
      baseVolume: [], peakVolume: [], hedgeVolume: [],
      uncovered: [], long: [], short: [], deltaCost: [], hedgeCost: [], totalCost: []
    };
    for (var i = 0; i < n; i++) {
      var dateStr = dates ? resolveDate(dates, i) : null;
      var row = computeIntervalRow(times[i], consumption[i], production[i], prices[i], dateStr, hedgeBlocks);
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
      out.hedgeCost.push(row.hedgeCost);
      out.totalCost.push(row.totalCost);
    }
    return out;
  }

  /**
   * Day/Month aggregate totals, plus peak demand.
   *
   * Each total independently skips any interval whose contributing row field
   * is `null` (see computeIntervalRow), rather than one all-or-nothing gate —
   * a projected (forward, no EPEX) interval contributes to actualUsageKwh/
   * uncoveredKwh/longKwh/shortKwh but not to usageCostEur/deltaCostEur/
   * totalCostEur. `hedgeVolumeKwh`/`hedgeCostEur` total every interval
   * regardless, since the hedge position is known independent of usage or
   * spot price. `intervalsWithUsage`/`intervalsWithCost`/`intervalsTotal` let
   * a caller distinguish "empty range" from "range with no usage/cost data"
   * and show that honestly instead of a bare 0 — a caller wanting a
   * measured-only or projected-only breakdown should call this again over a
   * filtered subset of the same arrays rather than expect this function to
   * split them itself.
   */
  function computeDayStats(times, prices, consumption, production, dates, hedgeBlocks) {
    var n = times.length;
    var consumptionKwh = 0, productionKwh = 0, usageCostEur = 0;
    var baseVolumeKwh = 0, peakVolumeKwh = 0, hedgeVolumeKwh = 0;
    var uncoveredKwh = 0, longKwh = 0, shortKwh = 0, deltaCostEur = 0;
    var hedgeCostEur = 0, totalCostEur = 0;
    var peakKw = -Infinity, peakTime = null;
    var intervalsWithUsage = 0, intervalsWithCost = 0;

    for (var i = 0; i < n; i++) {
      var dateStr = dates ? resolveDate(dates, i) : null;
      var row = computeIntervalRow(times[i], consumption[i], production[i], prices[i], dateStr, hedgeBlocks);
      baseVolumeKwh += row.baseVolumeKwh;
      peakVolumeKwh += row.peakVolumeKwh;
      hedgeVolumeKwh += row.hedgeVolumeKwh;
      hedgeCostEur += row.hedgeCost;
      if (row.actualUsage != null) {
        intervalsWithUsage++;
        consumptionKwh += row.consumptionKwh;
        productionKwh += row.productionKwh;
        uncoveredKwh += row.uncovered;
        longKwh += row.long;
        shortKwh += row.short;
        if (consumption[i] > peakKw) {
          peakKw = consumption[i];
          peakTime = times[i];
        }
      }
      if (row.usageCost != null) { usageCostEur += row.usageCost; }
      if (row.deltaCost != null) {
        intervalsWithCost++;
        deltaCostEur += row.deltaCost;
        totalCostEur += row.totalCost;
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
      deltaCostEur: deltaCostEur,
      hedgeCostEur: hedgeCostEur,
      totalCostEur: totalCostEur,
      intervalsWithUsage: intervalsWithUsage,
      intervalsWithCost: intervalsWithCost,
      intervalsTotal: n
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

  // Presentation-only abbreviation for the Consumption stat cards' iPad
  // tier — never used by the table, CSV export, or tooltips, which stay
  // full precision so a number can always be audited exactly. Two
  // decimals for EUR, matching the existing "€ 1,84 M" / "€ 8,42 M"
  // convention already shipped on the Back Office Invoicing/Wallets
  // screens (back-office-screens-data.js) — this reuses that convention
  // rather than inventing a new one.
  //
  // Threshold is 100,000, not the round 1,000,000 the two worked examples
  // this was first speced against would suggest — rendering the real page
  // at iPad landscape (1024px) showed that a plain 1,000,000 cutoff still
  // let mid-size 6-digit figures ("€ 932.147,88", "418.890,3 kWh") overflow
  // their card, the same failure the large figures had, just one digit
  // shorter. 100,000 is where that stopped happening at every width this
  // was actually tested against. A single day's totals (thousands, not
  // hundreds of thousands) stay untouched either way — this is a
  // threshold, not a blanket transform.
  var ABBREVIATE_ABOVE = 100000;

  // "M" means millions. Six-figure sums take "k" instead, because dividing
  // them by a million reads worse than the number it replaced: € 932.147,88
  // became "0,93 M" and € 100.000 became "0,10 M" — a leading "0," costs
  // both precision and legibility, and the convention this borrows from
  // (Back Office's "€ 1,84 M", "€ 8,42 M") only ever abbreviates genuine
  // millions.
  function formatEurAbbr(value) {
    var abs = Math.abs(value);
    if (abs < ABBREVIATE_ABOVE) { return null; }
    // Decide the unit on the ROUNDED thousands, not the raw value: 999.999
    // rounds to 1.000 k, which reads as a million while claiming not to be
    // one. Anything that would print as 1.000 k belongs in millions.
    if (Math.round(abs / 1000) < 1000) { return formatNL(value / 1000, 0) + " k"; }
    return formatNL(value / 1000000, 2) + " M";
  }

  // kWh → MWh is a unit change, not just fewer digits — the caller must
  // append " MWh", not reuse whatever unit string it was already using,
  // or the number becomes a thousand-fold lie.
  function formatKwhAbbr(value) {
    if (Math.abs(value) < ABBREVIATE_ABOVE) { return null; }
    return formatNL(value / 1000, 1) + " MWh";
  }

  var api = {
    // Exported so a caller pricing a forward interval can pick peak vs base by
    // exactly this rule rather than re-deriving it — the 08:00/08:15 boundary
    // is subtle enough that a second implementation would drift.
    isPeakInterval: isPeakInterval,
    computeIntervalHedgeVolumes: computeIntervalHedgeVolumes,
    computeIntervalRow: computeIntervalRow,
    computeIntervalSeries: computeIntervalSeries,
    computeDayStats: computeDayStats,
    formatNL: formatNL,
    formatEurAbbr: formatEurAbbr,
    formatKwhAbbr: formatKwhAbbr
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ConsumptionCalc = api;
  }
})(typeof window !== "undefined" ? window : this);
