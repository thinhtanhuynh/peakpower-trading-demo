/*
 * The demo clock.
 *
 * Every date-dependent state in this POC — a balance falling due, an offer's
 * reaction window closing — is decided against "now". In a demo that is a
 * problem: the seeded and live trades all deliver months out, so a balance is
 * permanently "scheduled" and the whole run-up to paying it (due soon, then
 * overdue, then paid) can only be seen by waiting weeks for it.
 *
 * This module shifts "now" by a whole number of days so that story can be told
 * on demand. It shifts the *clock*, never the data: a Q4 block still starts on
 * 1 October and its balance is still due on 30 September. Only today moves.
 *
 *   Back Office  <--offset-->  Customer Portal      (peakpower.demoClock.v1)
 *
 * Same transport and the same failure discipline as portal-trade-link.js and
 * portal-terms-link.js: one versioned localStorage key, the browser's `storage`
 * event, and every read failure landing on 0 — the real clock — rather than
 * throwing. A broken link must never break either portal.
 *
 * Dual Node/browser module, same pattern as the other JS files here.
 */
(function (root) {
  "use strict";

  var STORAGE_KEY = "peakpower.demoClock.v1";

  /**
   * A demo runs days-to-months ahead, never decades. Anything past this is a
   * corrupted value rather than an intent, and is read as 0 — the real clock —
   * which is the only failure direction that leaves the portals honest.
   */
  var MAX_OFFSET_DAYS = 3650;

  /**
   * Whole days only, inside the plausible range. Returns null for anything else.
   *
   * A string is matched whole rather than handed to parseInt, which stops at
   * the first character it cannot use: parseInt("1.5") is 1 and
   * parseInt("43abc") is 43, so a stored "1.5" would have read as a day while
   * a stored 1.5 was refused. read() and write() have to agree on what counts.
   */
  function parseOffset(input) {
    var n;
    if (typeof input === "number") {
      n = input;
    } else {
      var s = String(input == null ? "" : input).trim();
      if (!/^-?\d+$/.test(s)) { return null; }
      n = parseInt(s, 10);
    }
    if (!isFinite(n) || Math.floor(n) !== n) { return null; }
    return Math.abs(n) <= MAX_OFFSET_DAYS ? n : null;
  }

  // --- storage --------------------------------------------------------------

  /** The stored offset in days, or 0 for anything unreadable. */
  function read(storage) {
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) { return 0; }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") { return 0; }
      var days = parseOffset(parsed.offsetDays);
      return days == null ? 0 : days;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Persists the offset. Refuses a value that is not a whole number of days in
   * range, so junk can never reach storage and be read back by the other
   * portal. Returns false rather than throwing on a storage failure.
   */
  function write(storage, offsetDays) {
    var days = parseOffset(offsetDays);
    if (days == null) { return false; }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ offsetDays: days }));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Fires `cb` when another tab moves the clock. Mirrors the other two links. */
  function subscribe(win, cb) {
    function onStorage(e) {
      if (!e || e.key === null || e.key === STORAGE_KEY) { cb(); }
    }
    win.addEventListener("storage", onStorage);
    return function () { win.removeEventListener("storage", onStorage); };
  }

  // --- the clock ------------------------------------------------------------

  /**
   * The faked present, in ms.
   *
   * Shifted by calendar days rather than by `offsetDays × 86_400_000`, so the
   * wall-clock time of day survives a DST boundary. Adding a flat 24h per day
   * across the March change lands an hour early, which is invisible most of the
   * time and silently moves the date when the real time is near midnight.
   *
   * It stays an *offset*, not a frozen timestamp: the faked clock still runs,
   * so an offer's countdown keeps ticking down in the demo's present.
   */
  function now(offsetDays, realNow) {
    var base = realNow == null ? Date.now() : realNow;
    var days = parseOffset(offsetDays);
    if (!days) { return base; }
    var d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  /** Local midnight of whatever day `ms` falls on. */
  function dayStart(ms) {
    var d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isoOf(d) {
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd;
  }

  /**
   * The whole-day offset that makes the clock read `isoDate`.
   *
   * Counted between local midnights and rounded, so the answer is exact
   * regardless of the time of day or of a DST change in between — the same way
   * PortalTermsLink.daysUntilDue counts, which is what makes jumping to a due
   * date land precisely on that date's state rather than a day either side.
   *
   * Returns null for an unparseable date or one outside the plausible range.
   *
   * A day that does not exist is refused rather than rolled over: `new Date`
   * turns 2026-02-30 into 2 March quite happily, which would move the clock to
   * a date nobody asked for and report success doing it. Round-tripping the
   * constructed date back through isoOf is what catches that.
   */
  function offsetForDate(isoDate, realNow) {
    var s = String(isoDate == null ? "" : isoDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) { return null; }
    var p = s.split("-").map(Number);
    var target = new Date(p[0], p[1] - 1, p[2]);
    if (isNaN(target.getTime()) || isoOf(target) !== s) { return null; }
    var today = dayStart(realNow == null ? Date.now() : realNow);
    return parseOffset(Math.round((target.getTime() - today.getTime()) / 86400000));
  }

  /** The ISO date the clock currently reads. */
  function dateForOffset(offsetDays, realNow) {
    return isoOf(new Date(now(offsetDays, realNow)));
  }

  /**
   * How far the clock is shifted, in words: "today", "+43 days", "−5 days".
   * Uses a real minus sign (U+2212), matching how negative money reads
   * everywhere else in these portals.
   */
  function label(offsetDays) {
    var days = parseOffset(offsetDays) || 0;
    if (days === 0) { return "today"; }
    var n = Math.abs(days);
    return (days > 0 ? "+" : "−") + n + (n === 1 ? " day" : " days");
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_OFFSET_DAYS: MAX_OFFSET_DAYS,
    parseOffset: parseOffset,
    read: read,
    write: write,
    subscribe: subscribe,
    now: now,
    offsetForDate: offsetForDate,
    dateForOffset: dateForOffset,
    label: label
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.PortalDemoClock = api;
  }
})(typeof window !== "undefined" ? window : this);
