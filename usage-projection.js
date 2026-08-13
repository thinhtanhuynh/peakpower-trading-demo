/*
 * Historical-profile usage projection for dates past the live dataset's real
 * coverage (see the Customer Portal's date-range filter, which now allows
 * selecting forward dates out to the furthest hedge block's periodEnd).
 *
 * The product decision: forward usage is PROJECTED from the site's own
 * historical shape rather than left blank, so Long/Short/coverage stay
 * meaningful forward — but every projected number must be labelled as such
 * everywhere it feeds a figure (chart, stat card, table, CSV). This module
 * only builds the projection; it never decides how it's displayed or
 * whether it's priced (see consumption-calc.js's per-field null handling —
 * a projected interval still has no EPEX, so cost stays withheld there).
 *
 * Method: for each site, average real consumption/production at each
 * time-of-day, split weekday vs weekend, across every real historical date.
 * Deliberately NOT seasonally adjusted — the dataset only spans 2026-01-01
 * through 2026-08-05, so a projected November date has no same-month
 * history to draw on. A flat time-of-day-by-day-type average is an honest,
 * simple baseline given that constraint, consistent with this repo's other
 * documented simplifications (e.g. hedge volume math not adjusting for
 * DST). If a future revision adds seasonal weighting, this is the function
 * to extend — the projection contract (see projectInterval) stays the same.
 *
 * Dual Node/browser module, same pattern as consumption-calc.js and
 * consumption-data-loader.js. Pure functions, unit tested from Node against
 * small fixtures (see usage-projection.test.js).
 */
(function (root) {
  "use strict";

  /** "weekday" or "weekend" for a YYYY-MM-DD date string. */
  function dayType(dateStr) {
    var p = dateStr.split("-").map(Number);
    var weekday = new Date(p[0], p[1] - 1, p[2]).getDay(); // 0=Sun..6=Sat
    return (weekday === 0 || weekday === 6) ? "weekend" : "weekday";
  }

  /**
   * Builds one site's profile: average consumption/production (kW) at each
   * time-of-day, split by day type, from every real date in `byDateData`
   * that also has a `siteData` entry (mirrors how concatRangeData already
   * treats a date as "real" — both byDate and bySite must have it).
   *
   * `byDateData` is DATA.byDate (time-of-day grid per date, shared across
   * sites); `siteData` is DATA.bySite[siteId] (this site's c[]/g[] per date).
   */
  function buildUsageProfile(byDateData, siteData) {
    var sums = { weekday: {}, weekend: {} };
    var counts = { weekday: {}, weekend: {} };

    Object.keys(byDateData).forEach(function (date) {
      var site = siteData[date];
      if (!site) { return; }
      var type = dayType(date);
      var times = byDateData[date].t;
      for (var i = 0; i < times.length; i++) {
        var t = times[i];
        if (!sums[type][t]) { sums[type][t] = { c: 0, g: 0 }; counts[type][t] = 0; }
        sums[type][t].c += site.c[i];
        sums[type][t].g += site.g[i];
        counts[type][t]++;
      }
    });

    var profile = { weekday: {}, weekend: {} };
    ["weekday", "weekend"].forEach(function (type) {
      Object.keys(sums[type]).forEach(function (t) {
        var n = counts[type][t];
        profile[type][t] = { c: sums[type][t].c / n, g: sums[type][t].g / n };
      });
    });
    return profile;
  }

  /**
   * Projected { consumption, production } (kW) for one date+time, from a
   * profile built by buildUsageProfile. Falls back to the other day type's
   * average at the same time-of-day if this exact type/time combination was
   * never observed (shouldn't happen with the standard 96-slot grid this
   * dataset uses throughout, but stays honest — null, not a guess, if truly
   * nothing matches).
   */
  function projectInterval(profile, dateStr, timeStr) {
    var type = dayType(dateStr);
    var slot = profile[type] && profile[type][timeStr];
    if (!slot) {
      var other = type === "weekday" ? "weekend" : "weekday";
      slot = profile[other] && profile[other][timeStr];
    }
    return slot ? { consumption: slot.c, production: slot.g } : { consumption: null, production: null };
  }

  var api = {
    dayType: dayType,
    buildUsageProfile: buildUsageProfile,
    projectInterval: projectInterval
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.UsageProjection = api;
  }
})(typeof window !== "undefined" ? window : this);
