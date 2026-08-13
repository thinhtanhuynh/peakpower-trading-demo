var assert = require("assert");
var UsageProjection = require("./usage-projection.js");

// dayType: weekday vs weekend
(function () {
  assert.strictEqual(UsageProjection.dayType("2026-08-03"), "weekday"); // Monday
  assert.strictEqual(UsageProjection.dayType("2026-08-07"), "weekday"); // Friday
  assert.strictEqual(UsageProjection.dayType("2026-08-08"), "weekend"); // Saturday
  assert.strictEqual(UsageProjection.dayType("2026-08-09"), "weekend"); // Sunday
  console.log("dayType: ok");
})();

// buildUsageProfile: averages consumption/production per time-of-day, split
// by day type, across every real date present in both byDate and siteData.
(function () {
  var byDateData = {
    "2026-08-03": { t: ["00:00", "00:15"] }, // Monday (weekday)
    "2026-08-10": { t: ["00:00", "00:15"] }, // Monday (weekday)
    "2026-08-08": { t: ["00:00", "00:15"] }  // Saturday (weekend)
  };
  var siteData = {
    "2026-08-03": { c: [100, 200], g: [0, 0] },
    "2026-08-10": { c: [200, 300], g: [10, 0] },
    "2026-08-08": { c: [50, 60], g: [0, 0] }
  };
  var profile = UsageProjection.buildUsageProfile(byDateData, siteData);
  assert.deepStrictEqual(profile.weekday["00:00"], { c: 150, g: 5 });
  assert.deepStrictEqual(profile.weekday["00:15"], { c: 250, g: 0 });
  assert.deepStrictEqual(profile.weekend["00:00"], { c: 50, g: 0 });
  console.log("buildUsageProfile: ok");
})();

// buildUsageProfile: a date present in byDate but missing from siteData
// (e.g. a site with a gap) is skipped, matching concatRangeData's own
// "both byDate and bySite must have this date" definition of "real".
(function () {
  var byDateData = {
    "2026-08-03": { t: ["00:00"] },
    "2026-08-04": { t: ["00:00"] }
  };
  var siteData = { "2026-08-03": { c: [100], g: [0] } }; // 08-04 missing
  var profile = UsageProjection.buildUsageProfile(byDateData, siteData);
  assert.deepStrictEqual(profile.weekday["00:00"], { c: 100, g: 0 });
  console.log("buildUsageProfile skips dates missing from siteData: ok");
})();

// projectInterval: looks up the right day-type/time-of-day slot.
(function () {
  var profile = {
    weekday: { "09:00": { c: 500, g: 20 } },
    weekend: { "09:00": { c: 100, g: 5 } }
  };
  assert.deepStrictEqual(UsageProjection.projectInterval(profile, "2026-11-04", "09:00"), // Wednesday
    { consumption: 500, production: 20 });
  assert.deepStrictEqual(UsageProjection.projectInterval(profile, "2026-11-07", "09:00"), // Saturday
    { consumption: 100, production: 5 });
  console.log("projectInterval: ok");
})();

// projectInterval: falls back to the other day type at the same
// time-of-day if this exact combination was never observed.
(function () {
  var profile = { weekday: {}, weekend: { "09:00": { c: 100, g: 5 } } };
  assert.deepStrictEqual(UsageProjection.projectInterval(profile, "2026-11-04", "09:00"), // weekday, but only weekend data exists
    { consumption: 100, production: 5 });
  console.log("projectInterval falls back across day types: ok");
})();

// projectInterval: returns nulls (not a guess) if nothing matches at all.
(function () {
  var profile = { weekday: {}, weekend: {} };
  assert.deepStrictEqual(UsageProjection.projectInterval(profile, "2026-11-04", "09:00"),
    { consumption: null, production: null });
  console.log("projectInterval returns null when nothing matches: ok");
})();

console.log("usage-projection.test.js: all assertions passed");
