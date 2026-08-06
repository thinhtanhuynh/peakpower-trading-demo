# Consumption Net/Hedge Chart, Tooltips, Click-to-Scroll, Date Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Customer Portal - Consumption (Live Data).html`'s chart (currently consumption bars + production line) with a net-usage/hedge-volume chart — two lines with the gap between them filled by color-coded uncovered/surplus bars — add real hover tooltips, change hover-to-scroll into click-to-scroll, add a Date column to the table, and add a tooltip-only `delta` value.

**Architecture:** `consumption-calc.js` gains two new fields on `computeIntervalSeries`'s existing return value (`netKwh`, `delta`) — no signature change, additive only. The page's chart-building functions (`buildChartSvg`/`buildMonthChartSvg`) are rewritten to plot those two series with a bipolar Y-scale (net usage can go negative — 16,529 real intervals in the shipped dataset already do, mostly at `tilburg`'s solar-heavy midday hours) instead of the old 0-based, non-negative-only scale. The shared hover-wiring function (`attachHoverHandler`) is renamed and extended into `attachChartInteraction`, splitting "hover" (tooltip + crosshair, no table scroll) from "click" (table highlight + scroll) — previously hover did both.

**Tech Stack:** Same as the existing page — Python 3 stdlib, vanilla ES5 JS, Node.js for JS tests only (not a page runtime dependency).

## Global Constraints

- `computeIntervalSeries`'s existing 6-argument signature (`times, prices, consumption, production, dates, hedgeBlocks`) and its 5 existing return fields (`netCost, hedgeVolume, hedgePrice, hedgeCost, uncovered`) are unchanged — `netKwh` and `delta` are added as two new fields on the same return object, so nothing already consuming it breaks. `delta[i] = netCost[i] - hedgeCost[i]`.
- `computeDayStats` is untouched — no delta/netKwh day-or-month total is needed anywhere.
- The chart's Y-scale must be bipolar: `minVal = min(0, min(netKwh), min(hedgeVolume))`, `maxVal = max(0, max(netKwh), max(hedgeVolume))`, guarded against `minVal === maxVal` (widen `maxVal` by 1). A zero baseline is drawn at `y(0)`, which is **not** always the plot's bottom edge anymore.
- Bar color: `uncovered[i] >= 0` → orange (`#ea580c`, opacity `0.55`, "uncovered — bought at day-ahead"); `uncovered[i] < 0` → cyan (`#0891b2`, opacity `0.3`, "surplus — sold at day-ahead"). These are the exact color/opacity pairing from the original Customer Portal mockup's Day-tab legend.
- Hover shows a tooltip (full row + delta) and a crosshair; it no longer scrolls/highlights the table. Click on the chart highlights + scrolls to the table row. The click-selected highlight persists until the next click or the next `render()` call (switching site/date/month always clears it).
- Display precision unchanged throughout: kWh/kW — 1 decimal; €/kWh — 4 decimals; € cost — 2 decimals; NL-style formatting via the existing `ConsumptionCalc.formatNL`.
- No new files are created by this plan — only `consumption-calc.js`, `consumption-calc.test.js`, `generate_consumption_data.py`, `CLAUDE.md`, and the two generated artifacts are modified.
- No new Python-side verification check is needed — `netKwh`/`delta` are derived entirely from series `verify_consumption_page.py` already validates; this plan is page-rendering + pure-calc glue with no new data-shape dependency.

---

### Task 1: Calc additions (`consumption-calc.js`)

**Files:**
- Modify: `consumption-calc.js`
- Modify: `consumption-calc.test.js`

**Interfaces:**
- Modifies: `ConsumptionCalc.computeIntervalSeries(times, prices, consumption, production, dates, hedgeBlocks)` — same signature, return value gains `netKwh: number[]` (can be negative) and `delta: number[]` (`= netCost[i] - hedgeCost[i]`) alongside the existing `netCost, hedgeVolume, hedgePrice, hedgeCost, uncovered`.

- [ ] **Step 1: Write the failing tests**

Add to `consumption-calc.test.js`, immediately before the final
`console.log("consumption-calc.test.js: all assertions passed");` line:

```js
// computeIntervalSeries: now also returns netKwh and delta
(function () {
  var hedgeBlocks = [
    { shape: "base", periodStart: "2026-01-01", periodEnd: "2026-12-31", powerKw: 1000, priceKwh: 0.07 }
  ];
  var series = ConsumptionCalc.computeIntervalSeries(
    ["10:00", "10:15"], [0.10, 0.20], [600, 600], [0, 0], "2026-01-03", hedgeBlocks
  );
  assertClose(series.netKwh[0], 150, "netKwh[0] = (600kW-0kW)*0.25h");
  assertClose(series.netKwh[1], 150, "netKwh[1] = (600kW-0kW)*0.25h");
  assertClose(series.delta[0], series.netCost[0] - series.hedgeCost[0], "delta[0] = netCost - hedgeCost");
  assertClose(series.delta[0], 15 - 17.5, "delta[0] matches expected numeric value");
})();

// computeIntervalSeries: netKwh can go negative when production exceeds consumption
// (this is a real, common case in the shipped dataset — e.g. tilburg's solar
// midday output — not just a theoretical edge case)
(function () {
  var series = ConsumptionCalc.computeIntervalSeries(
    ["12:00"], [0.10], [50], [200], "2026-01-03", null
  );
  assertClose(series.netKwh[0], -37.5, "netKwh negative when production > consumption");
  assertClose(series.delta[0], series.netCost[0], "delta = netCost when hedgeCost is 0 (no hedgeBlocks)");
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node consumption-calc.test.js`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading '0')` (or similar) on `series.netKwh[0]`, since `netKwh` doesn't exist yet on the returned object.

- [ ] **Step 3: Add `netKwh` and `delta` to `computeIntervalSeries`**

Find:

```
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
```

Replace with:

```
  function computeIntervalSeries(times, prices, consumption, production, dates, hedgeBlocks) {
    var n = times.length;
    var netKwhArr = [];
    var netCost = [];
    var hedgeVolume = [];
    var hedgePrice = [];
    var hedgeCost = [];
    var uncovered = [];
    var delta = [];

    for (var i = 0; i < n; i++) {
      var netKwh = (consumption[i] - production[i]) * 0.25;
      var h = hedgeBlocks ? computeIntervalHedge(resolveDate(dates, i), times[i], hedgeBlocks)
                          : { hedgeVolumeKwh: 0, hedgePriceKwh: 0, hedgeCostEur: 0 };
      var intervalNetCost = netKwh * prices[i];
      netKwhArr.push(netKwh);
      netCost.push(intervalNetCost);
      hedgeVolume.push(h.hedgeVolumeKwh);
      hedgePrice.push(h.hedgePriceKwh);
      hedgeCost.push(h.hedgeCostEur);
      uncovered.push(netKwh - h.hedgeVolumeKwh);
      delta.push(intervalNetCost - h.hedgeCostEur);
    }

    return {
      netKwh: netKwhArr,
      netCost: netCost,
      hedgeVolume: hedgeVolume,
      hedgePrice: hedgePrice,
      hedgeCost: hedgeCost,
      uncovered: uncovered,
      delta: delta
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node consumption-calc.test.js`
Expected: prints `consumption-calc.test.js: all assertions passed` with no errors.

- [ ] **Step 5: Commit**

```bash
git add consumption-calc.js consumption-calc.test.js
git commit -m "Add netKwh and delta fields to computeIntervalSeries"
```

(This task only changes the pure calc module — `generate_consumption_data.py`'s embedded copy of it is refreshed automatically the next time a later task regenerates the page.)

---

### Task 2: CSS/markup scaffolding (tooltip, orange token, legend, Date column header)

**Files:**
- Modify: `generate_consumption_data.py` (CSS + markup in `PAGE_TEMPLATE` only — no JS logic in this task)

**Interfaces:** none new (pure CSS/markup, no functions). Sets up the `#chart-tooltip` element and `.chart-tooltip` styling that Task 4 will populate, and the `--pp-orange` token (the legend uses it now; the chart's own SVG bars use literal hex, matching the existing precedent of `buildChartSvg` using hardcoded hex like `fill="#0f766e"` rather than CSS variables).

- [ ] **Step 1: Add the `--pp-orange` token**

Find:

```
    --pp-teal-700:#0f766e; --pp-teal-600:#0d9488; --pp-teal-500:#14b8a6; --pp-teal-100:#ccfbf1;
    --pp-green:#15803d; --pp-red:#dc2626; --pp-cyan:#0891b2;
```

Replace with:

```
    --pp-teal-700:#0f766e; --pp-teal-600:#0d9488; --pp-teal-500:#14b8a6; --pp-teal-100:#ccfbf1;
    --pp-green:#15803d; --pp-red:#dc2626; --pp-cyan:#0891b2; --pp-orange:#ea580c;
```

- [ ] **Step 2: Add `.chart-tooltip` CSS**

Find:

```
  .chart-scroll { overflow-x:auto; }
</style>
```

Replace with:

```
  .chart-scroll { overflow-x:auto; }
  .chart-tooltip { position:fixed; z-index:20; background:#0f172a; color:#fff; font-size:11px; line-height:1.6; padding:8px 10px; border-radius:6px; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.25); white-space:nowrap; display:none; }
  .chart-tooltip .tt-head { font-weight:700; margin-bottom:4px; color:#5eead4; }
  .chart-tooltip .tt-row { display:flex; justify-content:space-between; gap:14px; }
  .chart-tooltip .tt-row span:last-child { font-weight:600; }
</style>
```

- [ ] **Step 3: Add the tooltip element to the page markup**

Find:

```
  </div>
</div>

<script>__CALC_JS__</script>
```

Replace with:

```
  </div>
</div>
<div id="chart-tooltip" class="chart-tooltip"></div>

<script>__CALC_JS__</script>
```

- [ ] **Step 4: Replace the legend**

Find:

```
        <div class="legend">
          <div><span class="swatch" style="background:var(--pp-teal-700)"></span>Consumption</div>
          <div><span class="swatch" style="background:var(--pp-green);height:2px"></span>Production (on-site generation)</div>
        </div>
```

Replace with:

```
        <div class="legend">
          <div><span class="swatch" style="background:var(--pp-teal-700);height:2px"></span>Net usage</div>
          <div><span class="swatch" style="background:transparent;height:0;width:16px;border-top:2px dashed var(--pp-indigo)"></span>Hedge volume</div>
          <div><span class="swatch" style="background:var(--pp-orange);opacity:.55"></span>Uncovered — bought at day-ahead</div>
          <div><span class="swatch" style="background:var(--pp-cyan);opacity:.3"></span>Surplus — sold at day-ahead</div>
        </div>
```

- [ ] **Step 5: Add the Date column header**

Find:

```
              <tr><th>Time</th><th class="num">Consumption (kW)</th><th class="num">Production (kW)</th><th class="num">Net (kW)</th><th class="num">EPEX (€/kWh)</th><th class="num">Net Cost (€)</th><th class="num">Hedge Volume (kWh)</th><th class="num">Hedge Price (€/kWh)</th><th class="num">Hedge Cost (€)</th><th class="num">Uncovered (kWh)</th></tr>
```

Replace with:

```
              <tr><th>Date</th><th>Time</th><th class="num">Consumption (kW)</th><th class="num">Production (kW)</th><th class="num">Net (kW)</th><th class="num">EPEX (€/kWh)</th><th class="num">Net Cost (€)</th><th class="num">Hedge Volume (kWh)</th><th class="num">Hedge Price (€/kWh)</th><th class="num">Hedge Cost (€)</th><th class="num">Uncovered (kWh)</th></tr>
```

- [ ] **Step 6: Regenerate and smoke-check**

Run: `python3 generate_consumption_data.py`

Then:

```bash
grep -c 'chart-tooltip\|pp-orange\|Hedge volume<\|>Date<' "Customer Portal - Consumption (Live Data).html"
```

Expected: non-zero (the new CSS class, the new token, the new legend label, and the new column header should all appear at least once — note the table itself is rendered client-side, so this only confirms the header cell and the CSS/markup scaffolding, not rendered rows).

- [ ] **Step 7: Run the existing test suites (regression check)**

Run: `python3 -m unittest test_generate_consumption_data -v` — expect `OK`, 9/9.
Run: `node consumption-calc.test.js` — expect all assertions passed.
Run: `python3 verify_consumption_page.py` — expect all checks passed (this task doesn't touch the data shape).

- [ ] **Step 8: Commit**

```bash
git add generate_consumption_data.py "consumption_live_data.json" "Customer Portal - Consumption (Live Data).html"
git commit -m "Add tooltip scaffolding, orange token, new legend, and Date column header"
```

---

### Task 3: Net/hedge chart rendering (Day and Month, bipolar Y-scale)

**Files:**
- Modify: `generate_consumption_data.py` (the page's inline `<script>` in `PAGE_TEMPLATE`)

**Interfaces:**
- Modifies: `buildChartSvg(times, netKwh, hedgeVolume, uncovered)` — signature changed from `(times, consumption, production)`. Still sets module-level `lastChartGeom` as before (same shape: `{padLeft, spacing, offset, n}`).
- Modifies: `buildMonthChartSvg(dates, times, netKwh, hedgeVolume, uncovered)` — signature changed from `(dates, times, consumption, production)`. Still sets module-level `lastMonthChartGeom` as before (same shape: `{padLeft, spacing, offset, n, width}`).
- Both functions' geometry contract for hover indexing is unchanged (`lastChartGeom`/`lastMonthChartGeom`'s shape is identical to before) — Task 4's interaction code depends on this not changing.
- This task updates only the two `chart.innerHTML = buildChartSvg(...)` / `var markup = buildMonthChartSvg(...)` call sites in `render()` — it does **not** touch `renderTable`'s call sites (still passing `siteSeries.c`/`siteSeries.g` positionally, unchanged) — that's Task 4's concern.

This task has no isolated unit test (page-rendering glue over `consumption-calc.js` functions already tested in Task 1) — correctness is checked via the regeneration + a numeric geometry check in Step 5, plus the existing regression suites.

- [ ] **Step 1: Rewrite `buildChartSvg`**

Find:

```
  function buildChartSvg(times, consumption, production) {
    var n = times.length;
    var width = 960, height = 260, padLeft = 40, padBottom = 24, padTop = 10;
    var plotW = width - padLeft - 10;
    var plotH = height - padTop - padBottom;
    var maxVal = 0;
    for (var i = 0; i < n; i++) {
      maxVal = Math.max(maxVal, consumption[i], production[i]);
    }
    if (maxVal <= 0) { maxVal = 1; }
    var barW = plotW / n;
    var bars = "";
    for (i = 0; i < n; i++) {
      var barH = (consumption[i] / maxVal) * plotH;
      var x = padLeft + i * barW;
      var y = padTop + (plotH - barH);
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(barW - 1, 1).toFixed(1) +
        '" height="' + barH.toFixed(1) + '" fill="#0f766e"></rect>';
    }
    var linePoints = "";
    for (i = 0; i < n; i++) {
      var px = padLeft + i * barW + barW / 2;
      var py = padTop + (plotH - (production[i] / maxVal) * plotH);
      linePoints += px.toFixed(1) + "," + py.toFixed(1) + " ";
    }
    var axisLabels = "";
    for (i = 0; i < n; i++) {
      if (times[i].slice(3) === "00" && parseInt(times[i].slice(0, 2), 10) % 4 === 0) {
        var lx = padLeft + i * barW;
        axisLabels += '<text x="' + lx.toFixed(1) + '" y="' + (height - 6) +
          '" font-size="10" fill="#64748b">' + times[i] + '</text>';
      }
    }
    lastChartGeom = { padLeft: padLeft, spacing: barW, offset: barW / 2, n: n };
    return '<line x1="' + padLeft + '" y1="' + (padTop + plotH) + '" x2="' + (padLeft + plotW) +
      '" y2="' + (padTop + plotH) + '" stroke="#dbe3ec"></line>' +
      bars +
      '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#15803d" stroke-width="2"></polyline>' +
      axisLabels +
      '<line id="chart-crosshair" x1="0" y1="' + padTop + '" x2="0" y2="' + (padTop + plotH) +
      '" stroke="#0f172a" stroke-width="1" stroke-dasharray="3,3" visibility="hidden"></line>';
  }
```

Replace with:

```
  function buildChartSvg(times, netKwh, hedgeVolume, uncovered) {
    var n = times.length;
    var width = 960, height = 260, padLeft = 40, padBottom = 24, padTop = 10;
    var plotW = width - padLeft - 10;
    var plotH = height - padTop - padBottom;
    var minVal = 0, maxVal = 0;
    for (var i = 0; i < n; i++) {
      minVal = Math.min(minVal, netKwh[i], hedgeVolume[i]);
      maxVal = Math.max(maxVal, netKwh[i], hedgeVolume[i]);
    }
    if (minVal === maxVal) { maxVal = minVal + 1; }
    var range = maxVal - minVal;
    function yFor(val) { return padTop + (maxVal - val) / range * plotH; }
    var barW = plotW / n;
    var bars = "";
    for (i = 0; i < n; i++) {
      var yNet = yFor(netKwh[i]);
      var yHedge = yFor(hedgeVolume[i]);
      var barTop = Math.min(yNet, yHedge);
      var barH = Math.abs(yNet - yHedge);
      var barX = padLeft + i * barW;
      var barFill = uncovered[i] >= 0 ? "#ea580c" : "#0891b2";
      var barOpacity = uncovered[i] >= 0 ? "0.55" : "0.3";
      bars += '<rect x="' + barX.toFixed(1) + '" y="' + barTop.toFixed(1) + '" width="' + Math.max(barW - 1, 1).toFixed(1) +
        '" height="' + barH.toFixed(1) + '" fill="' + barFill + '" opacity="' + barOpacity + '"></rect>';
    }
    var netPoints = "", hedgePoints = "";
    for (i = 0; i < n; i++) {
      var px = padLeft + i * barW + barW / 2;
      netPoints += px.toFixed(1) + "," + yFor(netKwh[i]).toFixed(1) + " ";
      hedgePoints += px.toFixed(1) + "," + yFor(hedgeVolume[i]).toFixed(1) + " ";
    }
    var axisLabels = "";
    for (i = 0; i < n; i++) {
      if (times[i].slice(3) === "00" && parseInt(times[i].slice(0, 2), 10) % 4 === 0) {
        var lx = padLeft + i * barW;
        axisLabels += '<text x="' + lx.toFixed(1) + '" y="' + (height - 6) +
          '" font-size="10" fill="#64748b">' + times[i] + '</text>';
      }
    }
    var zeroY = yFor(0);
    lastChartGeom = { padLeft: padLeft, spacing: barW, offset: barW / 2, n: n };
    return '<line x1="' + padLeft + '" y1="' + zeroY.toFixed(1) + '" x2="' + (padLeft + plotW) +
      '" y2="' + zeroY.toFixed(1) + '" stroke="#dbe3ec"></line>' +
      bars +
      '<polyline points="' + netPoints.trim() + '" fill="none" stroke="#0f766e" stroke-width="2"></polyline>' +
      '<polyline points="' + hedgePoints.trim() + '" fill="none" stroke="#4f46e5" stroke-width="2" stroke-dasharray="5,3"></polyline>' +
      axisLabels +
      '<line id="chart-crosshair" x1="0" y1="' + padTop + '" x2="0" y2="' + (padTop + plotH) +
      '" stroke="#0f172a" stroke-width="1" stroke-dasharray="3,3" visibility="hidden"></line>';
  }
```

- [ ] **Step 2: Rewrite `buildMonthChartSvg`**

Find:

```
  function buildMonthChartSvg(dates, times, consumption, production) {
    var n = times.length;
    var pxPerInterval = 4;
    var width = Math.max(960, n * pxPerInterval);
    var height = 260, padLeft = 40, padBottom = 24, padTop = 10;
    var plotW = width - padLeft - 10;
    var plotH = height - padTop - padBottom;
    var maxVal = 0;
    var i;
    for (i = 0; i < n; i++) {
      maxVal = Math.max(maxVal, consumption[i], production[i]);
    }
    if (maxVal <= 0) { maxVal = 1; }
    var stepX = n > 1 ? plotW / (n - 1) : 0;

    var areaPoints = "";
    var linePoints = "";
    for (i = 0; i < n; i++) {
      var px = padLeft + i * stepX;
      var cy = padTop + (plotH - (consumption[i] / maxVal) * plotH);
      var gy = padTop + (plotH - (production[i] / maxVal) * plotH);
      areaPoints += px.toFixed(1) + "," + cy.toFixed(1) + " ";
      linePoints += px.toFixed(1) + "," + gy.toFixed(1) + " ";
    }
    var areaPath = "M" + padLeft.toFixed(1) + "," + (padTop + plotH).toFixed(1) + " L" +
      areaPoints.trim().replace(/ /g, " L") + " L" + (padLeft + plotW).toFixed(1) + "," + (padTop + plotH).toFixed(1) + " Z";

    var dayGridlines = "";
    var dayLabels = "";
    var prevDate = null;
    for (i = 0; i < n; i++) {
      if (dates[i] !== prevDate) {
        var lx = (padLeft + i * stepX).toFixed(1);
        dayGridlines += '<line x1="' + lx + '" y1="' + padTop + '" x2="' + lx + '" y2="' + (padTop + plotH) + '" stroke="#eef2f6"></line>';
        dayLabels += '<text x="' + lx + '" y="' + (height - 6) + '" font-size="9" fill="#64748b">' + dates[i].slice(8, 10) + "</text>";
        prevDate = dates[i];
      }
    }

    lastMonthChartGeom = { padLeft: padLeft, spacing: stepX, offset: 0, n: n, width: width };

    return dayGridlines +
      '<line x1="' + padLeft + '" y1="' + (padTop + plotH) + '" x2="' + (padLeft + plotW) + '" y2="' + (padTop + plotH) + '" stroke="#dbe3ec"></line>' +
      '<path d="' + areaPath + '" fill="#0f766e" fill-opacity="0.25" stroke="none"></path>' +
      '<polyline points="' + areaPoints.trim() + '" fill="none" stroke="#0f766e" stroke-width="1.5"></polyline>' +
      '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#15803d" stroke-width="1.5"></polyline>' +
      dayLabels +
      '<line id="month-chart-crosshair" x1="0" y1="' + padTop + '" x2="0" y2="' + (padTop + plotH) +
      '" stroke="#0f172a" stroke-width="1" stroke-dasharray="3,3" visibility="hidden"></line>';
  }
```

Replace with:

```
  function buildMonthChartSvg(dates, times, netKwh, hedgeVolume, uncovered) {
    var n = times.length;
    var pxPerInterval = 4;
    var width = Math.max(960, n * pxPerInterval);
    var height = 260, padLeft = 40, padBottom = 24, padTop = 10;
    var plotW = width - padLeft - 10;
    var plotH = height - padTop - padBottom;
    var minVal = 0, maxVal = 0;
    var i;
    for (i = 0; i < n; i++) {
      minVal = Math.min(minVal, netKwh[i], hedgeVolume[i]);
      maxVal = Math.max(maxVal, netKwh[i], hedgeVolume[i]);
    }
    if (minVal === maxVal) { maxVal = minVal + 1; }
    var range = maxVal - minVal;
    function yFor(val) { return padTop + (maxVal - val) / range * plotH; }
    var stepX = n > 1 ? plotW / (n - 1) : 0;
    var barW = n > 1 ? stepX : plotW;

    var bars = "";
    for (i = 0; i < n; i++) {
      var yNet = yFor(netKwh[i]);
      var yHedge = yFor(hedgeVolume[i]);
      var barTop = Math.min(yNet, yHedge);
      var barH = Math.abs(yNet - yHedge);
      var barX = padLeft + i * stepX - barW / 2;
      var barFill = uncovered[i] >= 0 ? "#ea580c" : "#0891b2";
      var barOpacity = uncovered[i] >= 0 ? "0.55" : "0.3";
      bars += '<rect x="' + barX.toFixed(1) + '" y="' + barTop.toFixed(1) + '" width="' + Math.max(barW - 0.5, 0.5).toFixed(1) +
        '" height="' + barH.toFixed(1) + '" fill="' + barFill + '" opacity="' + barOpacity + '"></rect>';
    }

    var netPoints = "", hedgePoints = "";
    for (i = 0; i < n; i++) {
      var px = padLeft + i * stepX;
      netPoints += px.toFixed(1) + "," + yFor(netKwh[i]).toFixed(1) + " ";
      hedgePoints += px.toFixed(1) + "," + yFor(hedgeVolume[i]).toFixed(1) + " ";
    }

    var dayGridlines = "";
    var dayLabels = "";
    var prevDate = null;
    for (i = 0; i < n; i++) {
      if (dates[i] !== prevDate) {
        var lx = (padLeft + i * stepX).toFixed(1);
        dayGridlines += '<line x1="' + lx + '" y1="' + padTop + '" x2="' + lx + '" y2="' + (padTop + plotH) + '" stroke="#eef2f6"></line>';
        dayLabels += '<text x="' + lx + '" y="' + (height - 6) + '" font-size="9" fill="#64748b">' + dates[i].slice(8, 10) + "</text>";
        prevDate = dates[i];
      }
    }

    var zeroY = yFor(0);
    lastMonthChartGeom = { padLeft: padLeft, spacing: stepX, offset: 0, n: n, width: width };

    return dayGridlines +
      '<line x1="' + padLeft + '" y1="' + zeroY.toFixed(1) + '" x2="' + (padLeft + plotW) + '" y2="' + zeroY.toFixed(1) + '" stroke="#dbe3ec"></line>' +
      bars +
      '<polyline points="' + netPoints.trim() + '" fill="none" stroke="#0f766e" stroke-width="1.5"></polyline>' +
      '<polyline points="' + hedgePoints.trim() + '" fill="none" stroke="#4f46e5" stroke-width="1.5" stroke-dasharray="5,3"></polyline>' +
      dayLabels +
      '<line id="month-chart-crosshair" x1="0" y1="' + padTop + '" x2="0" y2="' + (padTop + plotH) +
      '" stroke="#0f172a" stroke-width="1" stroke-dasharray="3,3" visibility="hidden"></line>';
  }
```

- [ ] **Step 3: Update the two chart call sites in `render()`**

Find:

```
      var markup = buildMonthChartSvg(month.dates, month.times, month.consumption, month.production);
```

Replace with:

```
      var markup = buildMonthChartSvg(month.dates, month.times, monthSeries.netKwh, monthSeries.hedgeVolume, monthSeries.uncovered);
```

Find:

```
    chart.innerHTML = buildChartSvg(dateSeries.t, siteSeries.c, siteSeries.g);
```

Replace with:

```
    chart.innerHTML = buildChartSvg(dateSeries.t, daySeries.netKwh, daySeries.hedgeVolume, daySeries.uncovered);
```

- [ ] **Step 4: Regenerate**

Run: `python3 generate_consumption_data.py`

- [ ] **Step 5: Numeric geometry check (real data, real negative-net case)**

This substitutes for a browser check by verifying the actual chart math
against real data reproduced in a throwaway Node snippet — `tilburg` on
`2026-05-05` has a real negative-`netKwh` interval (production exceeding
consumption at midday solar peak):

```bash
node -e '
var fs = require("fs");
var calc = require("./consumption-calc.js");
var data = JSON.parse(fs.readFileSync("consumption_live_data.json", "utf-8"));
var date = "2026-05-05", siteId = "tilburg";
var ds = data.byDate[date], ss = data.bySite[siteId][date];
var hedgeBlocks = data.hedge[siteId];
var series = calc.computeIntervalSeries(ds.t, ds.p, ss.c, ss.g, date, hedgeBlocks);
var hasNegative = series.netKwh.some(function (v) { return v < 0; });
console.log("has negative netKwh interval:", hasNegative);
var minVal = 0, maxVal = 0;
for (var i = 0; i < series.netKwh.length; i++) {
  minVal = Math.min(minVal, series.netKwh[i], series.hedgeVolume[i]);
  maxVal = Math.max(maxVal, series.netKwh[i], series.hedgeVolume[i]);
}
console.log("minVal (should be < 0):", minVal, "maxVal:", maxVal);
'
```

Expected: `has negative netKwh interval: true` and `minVal` strictly less
than 0 — confirms the bipolar scale is exercised by real shipped data, not
just a hypothetical.

- [ ] **Step 6: Run the existing test suites (regression check)**

Run: `python3 -m unittest test_generate_consumption_data -v` — expect `OK`, 9/9.
Run: `node consumption-calc.test.js` — expect all assertions passed.
Run: `python3 verify_consumption_page.py` — expect all checks passed.

- [ ] **Step 7: Commit**

```bash
git add generate_consumption_data.py "consumption_live_data.json" "Customer Portal - Consumption (Live Data).html"
git commit -m "Replace consumption/production chart with net-usage/hedge-volume chart"
```

---

### Task 4: Tooltips, click-to-scroll, Date column

**Files:**
- Modify: `generate_consumption_data.py` (the page's inline `<script>` in `PAGE_TEMPLATE`)

**Interfaces:**
- Produces: `formatDateShort(dateStr) -> string` (e.g. `"2026-08-05"` → `"5 Aug 2026"`).
- Produces: `resolveDate(dates, i) -> string` (page-local copy of the same tiny helper `consumption-calc.js` already has internally — duplicated deliberately rather than exporting a new public API from the calc module for one call site).
- Produces: `buildTooltipHtml(context, i) -> string` where `context = {dates, times, consumption, production, prices, series}` (`dates` may be a single string or a per-index array, same convention as `computeIntervalSeries`).
- Modifies: `renderTable(dates, times, consumption, production, prices, series)` — signature gains a leading `dates` parameter (string or array); output gains a leading Date `<td>` per row.
- Renames/modifies: `attachHoverHandler(svgEl, crosshairId, getGeom, onHoverIndex, onLeave)` → `attachChartInteraction(svgEl, crosshairId, getGeom, getContext, onClickIndex)`. Hover now shows the tooltip (via `getContext()` + `buildTooltipHtml`) instead of calling a row-highlight callback; a new `click` listener calls `onClickIndex(i)` (wired to the existing `highlightTableRow`). `clearHighlightedRow` is no longer wired to `mouseleave` — it's called once at the top of `render()` instead, so a stale highlight from a previous view never lingers, but hovering away from the chart no longer clears a click-selected row.

This task has no isolated unit test (page-rendering glue) — correctness is checked via the regeneration + structural smoke-checks in Step 4, plus the existing regression suites.

- [ ] **Step 1: Replace `attachHoverHandler` with `attachChartInteraction`, and add `formatDateShort`/`resolveDate`/`buildTooltipHtml`**

Find:

```
  function attachHoverHandler(svgEl, crosshairId, getGeom, onHoverIndex, onLeave) {
    svgEl.addEventListener("mousemove", function (evt) {
      var geom = getGeom();
      if (!geom) { return; }
      var pt = svgEl.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var userPt = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      var mouseX = userPt.x;
      var i = Math.round((mouseX - geom.padLeft - geom.offset) / geom.spacing);
      if (i < 0) { i = 0; }
      if (i > geom.n - 1) { i = geom.n - 1; }
      var crosshair = svgEl.querySelector("#" + crosshairId);
      if (crosshair) {
        var cx = geom.padLeft + i * geom.spacing + geom.offset;
        crosshair.setAttribute("x1", cx.toFixed(1));
        crosshair.setAttribute("x2", cx.toFixed(1));
        crosshair.setAttribute("visibility", "visible");
      }
      onHoverIndex(i);
    });
    svgEl.addEventListener("mouseleave", function () {
      var crosshair = svgEl.querySelector("#" + crosshairId);
      if (crosshair) { crosshair.setAttribute("visibility", "hidden"); }
      onLeave();
    });
  }
```

Replace with:

```
  function resolveDate(dates, i) {
    return typeof dates === "string" ? dates : dates[i];
  }

  function formatDateShort(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return parts[2] + " " + months[parts[1] - 1] + " " + parts[0];
  }

  var tooltip = document.getElementById("chart-tooltip");

  function buildTooltipHtml(context, i) {
    var dateStr = resolveDate(context.dates, i);
    var net = context.consumption[i] - context.production[i];
    var s = context.series;
    var rows = [
      ["Consumption", ConsumptionCalc.formatNL(context.consumption[i], 1) + " kW"],
      ["Production", ConsumptionCalc.formatNL(context.production[i], 1) + " kW"],
      ["Net", ConsumptionCalc.formatNL(net, 1) + " kW"],
      ["EPEX", ConsumptionCalc.formatNL(context.prices[i], 4) + " €/kWh"],
      ["Net Cost", ConsumptionCalc.formatNL(s.netCost[i], 2) + " €"],
      ["Hedge Volume", ConsumptionCalc.formatNL(s.hedgeVolume[i], 1) + " kWh"],
      ["Hedge Price", ConsumptionCalc.formatNL(s.hedgePrice[i], 4) + " €/kWh"],
      ["Hedge Cost", ConsumptionCalc.formatNL(s.hedgeCost[i], 2) + " €"],
      ["Uncovered", ConsumptionCalc.formatNL(s.uncovered[i], 1) + " kWh"],
      ["Delta", ConsumptionCalc.formatNL(s.delta[i], 2) + " €"]
    ];
    var html = '<div class="tt-head">' + formatDateShort(dateStr) + " · " + context.times[i] + "</div>";
    for (var r = 0; r < rows.length; r++) {
      html += '<div class="tt-row"><span>' + rows[r][0] + '</span><span>' + rows[r][1] + '</span></div>';
    }
    return html;
  }

  function attachChartInteraction(svgEl, crosshairId, getGeom, getContext, onClickIndex) {
    svgEl.addEventListener("mousemove", function (evt) {
      var geom = getGeom();
      var context = getContext();
      if (!geom || !context) { return; }
      var pt = svgEl.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      var userPt = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      var mouseX = userPt.x;
      var i = Math.round((mouseX - geom.padLeft - geom.offset) / geom.spacing);
      if (i < 0) { i = 0; }
      if (i > geom.n - 1) { i = geom.n - 1; }
      var crosshair = svgEl.querySelector("#" + crosshairId);
      if (crosshair) {
        var cx = geom.padLeft + i * geom.spacing + geom.offset;
        crosshair.setAttribute("x1", cx.toFixed(1));
        crosshair.setAttribute("x2", cx.toFixed(1));
        crosshair.setAttribute("visibility", "visible");
      }
      tooltip.innerHTML = buildTooltipHtml(context, i);
      tooltip.style.left = (evt.clientX + 14) + "px";
      tooltip.style.top = (evt.clientY - 14) + "px";
      tooltip.style.display = "block";
      svgEl.setAttribute("data-hover-idx", String(i));
    });
    svgEl.addEventListener("mouseleave", function () {
      var crosshair = svgEl.querySelector("#" + crosshairId);
      if (crosshair) { crosshair.setAttribute("visibility", "hidden"); }
      tooltip.style.display = "none";
    });
    svgEl.addEventListener("click", function () {
      var i = parseInt(svgEl.getAttribute("data-hover-idx"), 10);
      if (!isNaN(i)) { onClickIndex(i); }
    });
  }
```

- [ ] **Step 2: Update the two interaction call sites, and add context tracking**

Find:

```
  attachHoverHandler(chart, "chart-crosshair", function () { return lastChartGeom; }, highlightTableRow, clearHighlightedRow);
```

Replace with:

```
  var lastDayContext = null;
  attachChartInteraction(chart, "chart-crosshair", function () { return lastChartGeom; }, function () { return lastDayContext; }, highlightTableRow);
```

Find:

```
  attachHoverHandler(monthChart, "month-chart-crosshair", function () { return lastMonthChartGeom; }, highlightTableRow, clearHighlightedRow);
```

Replace with:

```
  var lastMonthContext = null;
  attachChartInteraction(monthChart, "month-chart-crosshair", function () { return lastMonthChartGeom; }, function () { return lastMonthContext; }, highlightTableRow);
```

- [ ] **Step 3: Update `renderTable`, `render()`'s context-tracking, and clear the highlight at the top of `render()`**

Find:

```
  function renderTable(times, consumption, production, prices, series) {
    var rows = "";
    for (var i = 0; i < times.length; i++) {
      var net = consumption[i] - production[i];
      rows += '<tr data-idx="' + i + '"><td>' + times[i] + "</td>" +
```

Replace with:

```
  function renderTable(dates, times, consumption, production, prices, series) {
    var rows = "";
    for (var i = 0; i < times.length; i++) {
      var net = consumption[i] - production[i];
      var dateStr = resolveDate(dates, i);
      rows += '<tr data-idx="' + i + '"><td>' + formatDateShort(dateStr) + "</td><td>" + times[i] + "</td>" +
```

Find:

```
  function render() {
    var siteId = siteSelect.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var hedgeBlocks = DATA.hedge && DATA.hedge[siteId];
```

Replace with:

```
  function render() {
    clearHighlightedRow();
    var siteId = siteSelect.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var hedgeBlocks = DATA.hedge && DATA.hedge[siteId];
```

Find:

```
      var monthStats = ConsumptionCalc.computeDayStats(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      var monthSeries = ConsumptionCalc.computeIntervalSeries(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      renderStatCards(monthStats);
```

Replace with:

```
      var monthStats = ConsumptionCalc.computeDayStats(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      var monthSeries = ConsumptionCalc.computeIntervalSeries(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      lastMonthContext = { dates: month.dates, times: month.times, consumption: month.consumption, production: month.production, prices: month.prices, series: monthSeries };
      renderStatCards(monthStats);
```

Find:

```
      renderTable(month.times, month.consumption, month.production, month.prices, monthSeries);
```

Replace with:

```
      renderTable(month.dates, month.times, month.consumption, month.production, month.prices, monthSeries);
```

Find:

```
    var dayStats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    var daySeries = ConsumptionCalc.computeIntervalSeries(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    renderStatCards(dayStats);
```

Replace with:

```
    var dayStats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    var daySeries = ConsumptionCalc.computeIntervalSeries(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    lastDayContext = { dates: date, times: dateSeries.t, consumption: siteSeries.c, production: siteSeries.g, prices: dateSeries.p, series: daySeries };
    renderStatCards(dayStats);
```

Find:

```
    renderTable(dateSeries.t, siteSeries.c, siteSeries.g, dateSeries.p, daySeries);
```

Replace with:

```
    renderTable(date, dateSeries.t, siteSeries.c, siteSeries.g, dateSeries.p, daySeries);
```

- [ ] **Step 4: Regenerate and smoke-check**

Run: `python3 generate_consumption_data.py`

Then structurally verify (no browser available):

```bash
grep -c 'attachChartInteraction\|buildTooltipHtml\|formatDateShort\|data-hover-idx' "Customer Portal - Consumption (Live Data).html"
grep -c 'attachHoverHandler' "Customer Portal - Consumption (Live Data).html"
python3 -c "
with open('Customer Portal - Consumption (Live Data).html', encoding='utf-8') as f:
    html = f.read()
assert '__DATA_JSON__' not in html and '__CALC_JS__' not in html
print('no leftover placeholders: OK')
"
```

Expected: the first command's count is non-zero (each new identifier appears at least once); the second command's count is **0** — `attachHoverHandler` must no longer exist anywhere, since Step 1 fully replaced it (a leftover reference would mean the old function or a stale call site survived); the Python check prints its OK line.

- [ ] **Step 5: Run the existing test suites (regression check)**

Run: `python3 -m unittest test_generate_consumption_data -v` — expect `OK`, 9/9.
Run: `node consumption-calc.test.js` — expect all assertions passed.
Run: `python3 verify_consumption_page.py` — expect all checks passed.

- [ ] **Step 6: Commit**

```bash
git add generate_consumption_data.py "consumption_live_data.json" "Customer Portal - Consumption (Live Data).html"
git commit -m "Add chart tooltips, click-to-scroll, and a Date column to the table"
```

---

### Task 5: Documentation (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none (documentation only). No new files, no table-row changes needed.

- [ ] **Step 1: Rewrite the "Consumption (Live Data) page" section**

This also fixes a stale sentence left over from the *previous* plan's
final-review fix wave: `verify_consumption_page.py`'s hedge check was
rewritten to cross-check against a fresh `build_hedge_section` call on the
real source file, but this section's closing paragraph still describes
the old, since-replaced "numeric spot-check of the weekday-peak vs.
off-peak formulas" behavior — corrected below.

Find the entire section (from `## Consumption (Live Data) page` through
the paragraph ending `...weekday-peak vs. off-peak formulas).` right
before `## Conventions`):

```markdown
## Consumption (Live Data) page

`Customer Portal - Consumption (Live Data).html` (generated by
`generate_consumption_data.py`) is a standalone companion to the Customer
Portal mockup's *Consumption* screen — instead of the mockup's seeded
placeholder data, it reads real 15-minute consumption/production/EPEX data
straight from `epex_tariffs_usage_combined_15_min_interval.json` for a
connection and date picked from dropdowns (all 6 electricity sites; any
date 2026-01-01 through 2026-08-05), plus a **Day / Month** chart toggle
(below). It doesn't modify or depend on `Customer Portal - Preview.html` —
that file stays a pure design mockup.

**Scope:** Day and Month views (no Quarter view). No hedge-cover line is
drawn on the chart itself — hedge figures are shown in the stat cards and
table only. `tilburg-gas` is excluded — it has no usage rows and no hedge
rows.

**Data shape** (`consumption_live_data.json`, embedded inline in the HTML —
no `fetch`, no network requests, opens directly via `file://`):

```jsonc
{
  "sites": [{ "id": "rot", "ean": "871687100000000011", "name": "Rotterdam DC" }, "... 6 total"],
  "byDate": { "2026-01-01": { "t": ["00:00", "..."], "p": [0.0896, "..."] }, "... 217 dates" },
  "bySite": { "rot": { "2026-01-01": { "c": [612.4, "..."], "g": [0.0, "..."] } }, "... 6 sites" },
  "hedge": { "rot": [{ "shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07 }, "... base + peak"], "... 6 sites" }
}
```

`byDate[date].t`/`.p` (local time-of-day, EPEX €/kWh) are stored once per
date and shared across sites; `bySite[id][date].c`/`.g` are per-site
consumption/production (kW), index-aligned with `byDate[date].t`. Array
length is 96 every day except 2026-03-29 (the spring-forward DST day),
which has 92. `hedge[id]` is a list of hedge blocks straight from
`hedge_blocks_2026.json` (currently 2 per site: `base` and `peak`, both
covering all of 2026) — kept generic (period start/end per block) so
future MONTH/QUARTER hedge rows would be picked up without a code change.

**Calculations** (`consumption-calc.js`, unit tested via
`consumption-calc.test.js`), per 15-minute interval:
- `energy_kWh = power_kW × 0.25`.
- **Net cost** = net (consumption − production, kWh) × that interval's
  EPEX price — the daily/monthly total of this is the "Net cost" stat card
  (formerly labeled "Spot result").
- **Hedge volume/price/cost** — a hedge block is active for an interval if
  the date falls in its period, and — for `peak` blocks only — the
  weekday is Mon–Fri and the time is 08:00–20:00; volume is
  `powerKw × 0.25` per active block, summed; price is the blended
  cost/volume across simultaneously-active blocks (e.g. base+peak both
  active on a weekday during peak hours).
- **Uncovered** = net (kWh) − hedge volume — can go negative
  (over-hedged that interval/day/month).

Net cost is intentionally independent of the hedge (it answers "what would
this cost at spot price alone"); hedge cost and uncovered are the separate
"what's locked in" / "what's still exposed" figures. Numbers display
NL-style (comma decimal, period thousands separator).

**Hover:** hovering the chart (Day or Month) highlights and scrolls to the
matching row in the table below, via a shared cursor-position →
nearest-interval-index calculation (one listener per chart, not per mark,
so it scales to the Month view's ~2,976 points).

**Month view:** a second chart type (line/area, not bars — a bar per
15-minute interval isn't legible at a whole month's density) plotting
every interval of a selected month in one horizontally-scrollable chart;
the month dropdown is derived from the data's actual coverage, so the
trailing partial month (August 2026, only 5 days) renders correctly with
no special-casing. The table below follows whichever mode (Day/Month) is
active.

**Regenerating:** `python3 generate_consumption_data.py` rebuilds
`consumption_live_data.json` and the HTML page from the current combined
dataset *and* `hedge_blocks_2026.json`; `python3 verify_consumption_page.py`
cross-checks the result (site/date coverage, DST-day interval count,
HTML-embedded data matching the standalone JSON, one site/date's usage
values matching the raw source rows exactly, and the embedded hedge blocks
matching `hedge_blocks_2026.json` with a numeric spot-check of the
weekday-peak vs. off-peak formulas).
```

Replace with:

```markdown
## Consumption (Live Data) page

`Customer Portal - Consumption (Live Data).html` (generated by
`generate_consumption_data.py`) is a standalone companion to the Customer
Portal mockup's *Consumption* screen — instead of the mockup's seeded
placeholder data, it reads real 15-minute consumption/production/EPEX data
straight from `epex_tariffs_usage_combined_15_min_interval.json` for a
connection and date picked from dropdowns (all 6 electricity sites; any
date 2026-01-01 through 2026-08-05), plus a **Day / Month** chart toggle
(below). It doesn't modify or depend on `Customer Portal - Preview.html` —
that file stays a pure design mockup.

**Scope:** Day and Month views (no Quarter view). `tilburg-gas` is
excluded — it has no usage rows and no hedge rows.

**Data shape** (`consumption_live_data.json`, embedded inline in the HTML —
no `fetch`, no network requests, opens directly via `file://`):

```jsonc
{
  "sites": [{ "id": "rot", "ean": "871687100000000011", "name": "Rotterdam DC" }, "... 6 total"],
  "byDate": { "2026-01-01": { "t": ["00:00", "..."], "p": [0.0896, "..."] }, "... 217 dates" },
  "bySite": { "rot": { "2026-01-01": { "c": [612.4, "..."], "g": [0.0, "..."] } }, "... 6 sites" },
  "hedge": { "rot": [{ "shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07 }, "... base + peak"], "... 6 sites" }
}
```

`byDate[date].t`/`.p` (local time-of-day, EPEX €/kWh) are stored once per
date and shared across sites; `bySite[id][date].c`/`.g` are per-site
consumption/production (kW), index-aligned with `byDate[date].t`. Array
length is 96 every day except 2026-03-29 (the spring-forward DST day),
which has 92. `hedge[id]` is a list of hedge blocks straight from
`hedge_blocks_2026.json` (currently 2 per site: `base` and `peak`, both
covering all of 2026) — kept generic (period start/end per block) so
future MONTH/QUARTER hedge rows would be picked up without a code change.

**Calculations** (`consumption-calc.js`, unit tested via
`consumption-calc.test.js`), per 15-minute interval:
- `energy_kWh = power_kW × 0.25`; `netKwh = (consumption − production) ×
  0.25` — can go negative on a solar/CHP-heavy interval where production
  exceeds consumption (a real, common case — e.g. `tilburg`'s midday solar
  output, not just a theoretical edge case).
- **Net cost** = `netKwh` × that interval's EPEX price — the daily/monthly
  total of this is the "Net cost" stat card (formerly labeled "Spot result").
- **Hedge volume/price/cost** — a hedge block is active for an interval if
  the date falls in its period, and — for `peak` blocks only — the
  weekday is Mon–Fri and the time is 08:00–20:00; volume is
  `powerKw × 0.25` per active block, summed; price is the blended
  cost/volume across simultaneously-active blocks (e.g. base+peak both
  active on a weekday during peak hours).
- **Uncovered** = `netKwh` − hedge volume — can go negative (over-hedged
  that interval/day/month).
- **Delta** = Net Cost − Hedge Cost — shown only in the hover tooltip
  (below), not a stat card or table column.

Net cost is intentionally independent of the hedge (it answers "what would
this cost at spot price alone"); hedge cost and uncovered are the separate
"what's locked in" / "what's still exposed" figures. Numbers display
NL-style (comma decimal, period thousands separator).

**Chart (Day and Month):** two lines — net usage (solid teal) and hedge
volume (dashed indigo) — with the gap between them filled by one bar per
interval: orange (55% opacity) when net exceeds hedge ("uncovered — bought
at day-ahead"), cyan (30% opacity) when hedge exceeds net ("surplus — sold
at day-ahead") — the same color convention as the original Customer
Portal mockup's Day-tab legend. Consumption and production are no longer
plotted (both remain in the table and their own stat cards); the y-axis is
bipolar (a proper zero baseline, not always at the bottom) to correctly
show intervals where `netKwh` goes negative.

**Hover vs. click:** hovering the chart shows a tooltip with every value
for that interval (date, time, consumption, production, net, EPEX, net
cost, hedge volume/price/cost, uncovered, delta) plus a crosshair — it no
longer scrolls the table. Clicking the chart highlights and scrolls to
that interval's row instead; the selection persists until the next click
or until the view changes (switching site/date/month clears it). One
shared interaction function drives both Day and Month charts, using a
cursor-position → nearest-interval-index calculation (not per-mark
listeners), so it scales to the Month view's ~2,976 points.

**Table:** a Date column (short format, e.g. "5 Aug 2026") is the first
column in both Day and Month modes — in Day mode every row repeats the
same date; in Month mode it's what actually disambiguates the repeating
`HH:MM` values across days.

**Month view:** a second chart type (line + bars, not bars alone) plotting
every interval of a selected month in one horizontally-scrollable chart;
the month dropdown is derived from the data's actual coverage, so the
trailing partial month (August 2026, only 5 days) renders correctly with
no special-casing. The table below follows whichever mode (Day/Month) is
active.

**Regenerating:** `python3 generate_consumption_data.py` rebuilds
`consumption_live_data.json` and the HTML page from the current combined
dataset *and* `hedge_blocks_2026.json`; `python3 verify_consumption_page.py`
cross-checks the result (site/date coverage, DST-day interval count,
HTML-embedded data matching the standalone JSON, one site/date's usage
values matching the raw source rows exactly, and the embedded hedge blocks
matching a fresh `build_hedge_section(hedge_blocks_2026.json)` — not a
hardcoded snapshot, so it stays correct if the source file gains new
MONTH/QUARTER rows).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the net/hedge chart, tooltips, click-to-scroll, and Date column"
```

---

## Manual QA (not automated by this plan)

Same rationale as the prior plans — no headless-browser tooling in this
project. Automated checks (Tasks 1 and 3's Step 5) cover the calc
formulas and the bipolar-scale math directly against real data; the
following needs a human (or a browser-driving tool) to confirm:

- [ ] Open the regenerated HTML (default: Rotterdam DC, latest date);
      confirm the chart shows two lines (solid teal, dashed indigo) with
      colored bars between them, and a visible zero baseline.
- [ ] Hover the chart; confirm a tooltip appears near the cursor with all
      10 values plus Delta, and the table does **not** scroll.
- [ ] Click the chart; confirm the table scrolls to and highlights the
      matching row (with the new Date column visible), and that the
      highlight stays put after moving the mouse away.
- [ ] Switch to `tilburg`, month `2026-05`; confirm the net-usage line
      dips below the zero baseline around midday on sunny days (matches
      the automated check in Task 3 Step 5) without visually clipping or
      distorting the rest of the chart.
- [ ] Switch to Month view; confirm the Date column now varies per row
      and hover/click still work against the longer table.
- [ ] Switch site/date/month a few times; confirm a previous click's row
      highlight clears rather than lingering on stale data.
