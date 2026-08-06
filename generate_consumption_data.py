"""
Builds the compact live-data JSON for the Consumption (Live Data) page, and
assembles the final self-contained HTML page from it.

Input:  epex_tariffs_usage_combined_15_min_interval.json
Output: consumption_live_data.json
        Customer Portal - Consumption (Live Data).html

Re-runnable: pure transform of the combined dataset, no randomness.
"""
import json
import os
from collections import defaultdict

SITE_META = [
    {"id": "rot",     "ean": "871687100000000011", "name": "Rotterdam DC"},
    {"id": "venlo",   "ean": "871687100000000027", "name": "Venlo cold store"},
    {"id": "tilburg", "ean": "871687100000000043", "name": "Tilburg plant"},
    {"id": "almere",  "ean": "871687100000000059", "name": "Almere office"},
    {"id": "unnamed", "ean": "871687100000000061", "name": "— no name set —"},
    {"id": "breda",   "ean": "871687100000000078", "name": "Breda warehouse"},
]

HERE = os.path.dirname(os.path.abspath(__file__))
COMBINED_PATH = os.path.join(HERE, "epex_tariffs_usage_combined_15_min_interval.json")
HEDGE_PATH = os.path.join(HERE, "hedge_blocks_2026.json")
DATA_OUT_PATH = os.path.join(HERE, "consumption_live_data.json")
CALC_JS_PATH = os.path.join(HERE, "consumption-calc.js")
HTML_OUT_PATH = os.path.join(HERE, "Customer Portal - Consumption (Live Data).html")


def build_compact_dataset(rows):
    """Group raw combined-file rows into the compact {sites, byDate, bySite} shape.

    Rows for EANs not in SITE_META are ignored (e.g. the non-electricity
    tilburg-gas connection, which has no rows anyway).
    """
    ean_to_meta = {m["ean"]: m for m in SITE_META}
    grouped = defaultdict(list)
    for r in rows:
        meta = ean_to_meta.get(r["EAN"])
        if meta is None:
            continue
        grouped[(meta["id"], r["delivery_day"])].append(r)

    by_date = {}
    by_site = {m["id"]: {} for m in SITE_META}

    for (site_id, date), day_rows in grouped.items():
        day_rows.sort(key=lambda r: r["isp"])
        if date not in by_date:
            by_date[date] = {
                "t": [r["timestamp"][11:16] for r in day_rows],
                "p": [round(r["epex"], 4) for r in day_rows],
            }
        by_site[site_id][date] = {
            "c": [round(r["consumption"], 1) for r in day_rows],
            "g": [round(r["production"], 1) for r in day_rows],
        }

    return {"sites": SITE_META, "byDate": by_date, "bySite": by_site}


def build_hedge_section(hedge_rows):
    """Group hedge_blocks_2026.json rows into {site_id: [block, ...]}.

    Rows for EANs not in SITE_META are ignored (matches build_compact_dataset's
    handling of the non-electricity tilburg-gas connection). Each block keeps
    only the fields the page's per-interval hedge calculation needs — kept
    generic (not "one yearly block per shape") so future MONTH/QUARTER hedge
    rows from gen_hedge.py would be picked up with no code change here.
    """
    ean_to_meta = {m["ean"]: m for m in SITE_META}
    hedge = {m["id"]: [] for m in SITE_META}
    for r in hedge_rows:
        meta = ean_to_meta.get(r["EAN"])
        if meta is None:
            continue
        hedge[meta["id"]].append({
            "shape": r["shape"],
            "periodStart": r["periodStart"],
            "periodEnd": r["periodEnd"],
            "powerKw": r["powerKw"],
            "priceKwh": r["priceKwh"],
        })
    return hedge


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Consumption — Live Data · PeakPower Customer Portal</title>
<style>
  :root {
    --pp-bg:#eef2f6; --pp-surface:#ffffff; --pp-surface-alt:#f8fafc; --pp-surface-zebra:#fbfdff;
    --pp-border:#dbe3ec; --pp-border-strong:#c3cede;
    --pp-text-heading:#0f172a; --pp-text-body:#64748b; --pp-text-faint:#94a3b8;
    --pp-sidebar-bg:#0f2b33; --pp-sidebar-text:#cbd5e1; --pp-sidebar-text-active:#ffffff;
    --pp-sidebar-subtitle:#5eead4; --pp-sidebar-active-bg:rgba(20,184,166,0.16);
    --pp-teal-700:#0f766e; --pp-teal-600:#0d9488; --pp-teal-500:#14b8a6; --pp-teal-100:#ccfbf1;
    --pp-green:#15803d; --pp-red:#dc2626; --pp-cyan:#0891b2;
    --pp-indigo:#4f46e5; --pp-indigo-bg:#e0e7ff;
    --font-sans:'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
    --font-mono:'SF Mono','Cascadia Mono',Menlo,Consolas,monospace;
  }
  * { box-sizing: border-box; }
  body { margin:0; font-family: var(--font-sans); background: var(--pp-bg); color: var(--pp-text-heading); }
  .app { display:flex; height:100vh; width:100%; overflow:hidden; }
  .sidebar { width:218px; min-width:218px; background:var(--pp-sidebar-bg); color:var(--pp-sidebar-text); display:flex; flex-direction:column; padding:20px 0; }
  .sidebar .brand { padding:0 20px 20px; font-size:11px; letter-spacing:.05em; color:var(--pp-sidebar-subtitle); font-weight:700; text-transform:uppercase; }
  .sidebar nav { display:flex; flex-direction:column; gap:2px; padding:0 10px; }
  .sidebar nav a { display:block; padding:9px 12px; border-radius:7px; font-size:13px; color:var(--pp-sidebar-text); text-decoration:none; }
  .sidebar nav a.active { background:var(--pp-sidebar-active-bg); color:var(--pp-sidebar-text-active); font-weight:600; }
  .main { flex:1; display:flex; flex-direction:column; overflow:auto; }
  .topbar { height:56px; min-height:56px; background:#fff; border-bottom:1px solid var(--pp-border); display:flex; align-items:center; justify-content:space-between; padding:0 28px; position:sticky; top:0; z-index:5; }
  .topbar .crumb { font-size:11px; color:var(--pp-text-body); }
  .topbar .title { font-size:17px; font-weight:700; color:var(--pp-text-heading); margin-top:2px; }
  .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; }
  .badge.info { background:var(--pp-indigo-bg); color:var(--pp-indigo); }
  .content { padding:28px; display:flex; flex-direction:column; gap:16px; }
  .controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  select, input[type=date] { border:1px solid var(--pp-border-strong); border-radius:7px; padding:7px 10px; font-size:12.5px; color:var(--pp-text-heading); background:#fff; font-family:var(--font-sans); }
  .stat-row { display:flex; gap:14px; flex-wrap:wrap; }
  .stat-card { background:#fff; border:1px solid var(--pp-border); border-radius:8px; padding:12px 14px; min-width:160px; flex:1; }
  .stat-card .label { font-size:10.5px; font-weight:700; letter-spacing:.04em; color:var(--pp-text-body); text-transform:uppercase; }
  .stat-card .value { font-size:20px; font-weight:700; margin-top:6px; color:var(--pp-text-heading); }
  .stat-card .value.critical { color:var(--pp-red); }
  .stat-card .value.success { color:var(--pp-green); }
  .stat-card .value.export { color:var(--pp-cyan); }
  .stat-card .sublabel { font-size:11px; color:var(--pp-text-faint); margin-top:4px; }
  .card { background:#fff; border:1px solid var(--pp-border); border-radius:10px; padding:16px 18px; }
  .card .card-title { font-size:14px; font-weight:700; color:var(--pp-text-heading); }
  .card .card-subtitle { font-size:11.5px; color:var(--pp-text-body); margin-top:2px; margin-bottom:10px; }
  .legend { display:flex; gap:22px; margin-top:10px; font-size:11px; color:var(--pp-text-body); flex-wrap:wrap; }
  .legend .swatch { width:12px; height:10px; display:inline-block; border-radius:2px; margin-right:6px; vertical-align:middle; }
  .table-wrap { max-height:420px; overflow:auto; border:1px solid var(--pp-border); border-radius:8px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead th { position:sticky; top:0; background:var(--pp-surface-alt); text-align:left; padding:9px 14px; font-size:10.5px; font-weight:700; color:var(--pp-text-body); letter-spacing:.03em; border-bottom:1px solid var(--pp-border); text-transform:uppercase; }
  thead th.num, td.num { text-align:right; }
  tbody td { padding:6px 14px; border-bottom:1px solid var(--pp-border); }
  tbody tr:nth-child(even) { background:var(--pp-surface-zebra); }
  td.net-export { color:var(--pp-cyan); font-weight:600; }
  tbody tr.hovered { background:var(--pp-teal-100) !important; }
  .chart-tabs { display:flex; gap:4px; background:var(--pp-surface-alt); border-radius:8px; padding:3px; }
  .chart-tab { border:none; background:transparent; padding:6px 14px; border-radius:6px; font-size:12.5px; font-weight:600; color:var(--pp-text-body); cursor:pointer; font-family:var(--font-sans); }
  .chart-tab.active { background:#fff; color:var(--pp-teal-700); box-shadow:0 1px 2px rgba(0,0,0,0.08); }
  .chart-scroll { overflow-x:auto; }
</style>
</head>
<body>
<div class="app">
  <div class="sidebar">
    <div class="brand">Customer portal</div>
    <nav>
      <a>Dashboard</a>
      <a>Connections</a>
      <a class="active">Consumption</a>
      <a>Prices</a>
      <a>Trading</a>
      <a>Wallet</a>
      <a>Invoices</a>
    </nav>
  </div>
  <div class="main">
    <div class="topbar">
      <div>
        <div class="crumb" id="crumb"></div>
        <div class="title">Consumption</div>
      </div>
      <span class="badge info">Generated test data</span>
    </div>
    <div class="content">
      <div class="controls">
        <select id="site-select"></select>
        <input type="date" id="date-input">
      </div>
      <div class="stat-row" id="stat-row"></div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div class="card-title">Consumption &amp; production — 15-minute intervals</div>
            <div class="card-subtitle" id="chart-subtitle"></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <div class="chart-tabs">
              <button type="button" class="chart-tab active" data-mode="day">Day</button>
              <button type="button" class="chart-tab" data-mode="month">Month</button>
            </div>
            <select id="month-select" style="display:none"></select>
          </div>
        </div>
        <div id="day-chart-wrap">
          <svg id="chart" viewBox="0 0 960 260" style="width:100%;height:260px;display:block"></svg>
        </div>
        <div id="month-chart-wrap" class="chart-scroll" style="display:none">
          <svg id="month-chart" viewBox="0 0 960 260" height="260" style="display:block"></svg>
        </div>
        <div class="legend">
          <div><span class="swatch" style="background:var(--pp-teal-700)"></span>Consumption</div>
          <div><span class="swatch" style="background:var(--pp-green);height:2px"></span>Production (on-site generation)</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">15-minute interval detail</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th class="num">Consumption (kW)</th><th class="num">Production (kW)</th><th class="num">Net (kW)</th><th class="num">EPEX (€/kWh)</th><th class="num">Net Cost (€)</th><th class="num">Hedge Volume (kWh)</th><th class="num">Hedge Price (€/kWh)</th><th class="num">Hedge Cost (€)</th><th class="num">Uncovered (kWh)</th></tr>
            </thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<script>__CALC_JS__</script>
<script type="application/json" id="consumption-data">__DATA_JSON__</script>
<script>
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("consumption-data").textContent);
  var siteSelect = document.getElementById("site-select");
  var dateInput = document.getElementById("date-input");
  var crumb = document.getElementById("crumb");
  var chartSubtitle = document.getElementById("chart-subtitle");
  var statRow = document.getElementById("stat-row");
  var chart = document.getElementById("chart");
  var tableBody = document.getElementById("table-body");

  DATA.sites.forEach(function (site) {
    var opt = document.createElement("option");
    opt.value = site.id;
    opt.textContent = site.name;
    siteSelect.appendChild(opt);
  });

  var allDates = Object.keys(DATA.byDate).sort();
  var MIN_DATE = allDates[0];
  var MAX_DATE = allDates[allDates.length - 1];
  dateInput.min = MIN_DATE;
  dateInput.max = MAX_DATE;

  var DEFAULT_SITE = "rot";
  var DEFAULT_DATE = MAX_DATE;
  siteSelect.value = DEFAULT_SITE;
  dateInput.value = DEFAULT_DATE;

  function formatDateLong(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return days[d.getDay()] + " " + parts[2] + " " + months[parts[1] - 1] + " " + parts[0];
  }

  function statCardHtml(label, value, tone, sublabel) {
    var toneClass = tone ? " " + tone : "";
    return '<div class="stat-card"><div class="label">' + label + '</div>' +
      '<div class="value' + toneClass + '">' + value + '</div>' +
      '<div class="sublabel">' + sublabel + '</div></div>';
  }

  function renderStatCards(stats) {
    var spotTone = stats.spotResultEur > 0 ? "critical" : (stats.spotResultEur < 0 ? "success" : "");
    var netTone = stats.netKwh < 0 ? "export" : "";
    var uncoveredTone = stats.uncoveredKwh < 0 ? "export" : "";
    statRow.innerHTML =
      statCardHtml("Consumption", ConsumptionCalc.formatNL(stats.consumptionKwh, 1) + " kWh", "", "total") +
      statCardHtml("Production", ConsumptionCalc.formatNL(stats.productionKwh, 1) + " kWh", "", "on-site generation") +
      statCardHtml("Net / import", ConsumptionCalc.formatNL(stats.netKwh, 1) + " kWh", netTone, stats.netKwh < 0 ? "net exporter" : "net importer") +
      statCardHtml("Peak demand", ConsumptionCalc.formatNL(stats.peakKw, 1) + " kW", "", "at " + stats.peakTime) +
      statCardHtml("Net cost", (stats.spotResultEur >= 0 ? "+ " : "− ") + "€ " + ConsumptionCalc.formatNL(Math.abs(stats.spotResultEur), 2), spotTone, "indicative, day-ahead price") +
      statCardHtml("Hedge cost", "€ " + ConsumptionCalc.formatNL(stats.hedgeCostEur, 2), "", "locked in via hedge") +
      statCardHtml("Uncovered", ConsumptionCalc.formatNL(stats.uncoveredKwh, 1) + " kWh", uncoveredTone, stats.uncoveredKwh < 0 ? "over-hedged" : "exposed to spot price");
  }

  function tdClass(value) {
    return value < 0 ? ' class="num net-export"' : ' class="num"';
  }

  function renderTable(times, consumption, production, prices, series) {
    var rows = "";
    for (var i = 0; i < times.length; i++) {
      var net = consumption[i] - production[i];
      rows += '<tr data-idx="' + i + '"><td>' + times[i] + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(consumption[i], 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(production[i], 1) + "</td>" +
        "<td" + tdClass(net) + ">" + ConsumptionCalc.formatNL(net, 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(prices[i], 4) + "</td>" +
        "<td" + tdClass(series.netCost[i]) + ">" + ConsumptionCalc.formatNL(series.netCost[i], 2) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(series.hedgeVolume[i], 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(series.hedgePrice[i], 4) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(series.hedgeCost[i], 2) + "</td>" +
        "<td" + tdClass(series.uncovered[i]) + ">" + ConsumptionCalc.formatNL(series.uncovered[i], 1) + "</td>" +
        "</tr>";
    }
    tableBody.innerHTML = rows;
  }

  var lastChartGeom = null;

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

  function attachHoverHandler(svgEl, crosshairId, getGeom, onHoverIndex, onLeave) {
    svgEl.addEventListener("mousemove", function (evt) {
      var geom = getGeom();
      if (!geom) { return; }
      var rect = svgEl.getBoundingClientRect();
      var viewBox = svgEl.viewBox.baseVal;
      var scaleX = viewBox.width / rect.width;
      var mouseX = (evt.clientX - rect.left) * scaleX;
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

  var previousHoveredRow = null;
  function highlightTableRow(i) {
    if (previousHoveredRow) { previousHoveredRow.classList.remove("hovered"); }
    var row = tableBody.querySelector('tr[data-idx="' + i + '"]');
    if (row) {
      row.classList.add("hovered");
      row.scrollIntoView({ block: "nearest" });
    }
    previousHoveredRow = row;
  }
  function clearHighlightedRow() {
    if (previousHoveredRow) { previousHoveredRow.classList.remove("hovered"); }
    previousHoveredRow = null;
  }

  attachHoverHandler(chart, "chart-crosshair", function () { return lastChartGeom; }, highlightTableRow, clearHighlightedRow);

  function monthLabel(year, month, daysPresent, lastDateStr) {
    var monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var daysInMonth = new Date(year, month, 0).getDate();
    var label = monthNames[month - 1] + " " + year;
    if (daysPresent < daysInMonth) {
      var lastDay = parseInt(lastDateStr.slice(8, 10), 10);
      label += " (partial — through " + lastDay + " " + monthNames[month - 1].slice(0, 3) + ")";
    }
    return label;
  }

  function buildMonthOptions() {
    var byMonth = {};
    allDates.forEach(function (d) {
      var key = d.slice(0, 7);
      if (!byMonth[key]) { byMonth[key] = []; }
      byMonth[key].push(d);
    });
    var keys = Object.keys(byMonth).sort();
    return keys.map(function (key) {
      var dates = byMonth[key];
      var year = parseInt(key.slice(0, 4), 10);
      var month = parseInt(key.slice(5, 7), 10);
      var lastDate = dates[dates.length - 1];
      return { value: key, label: monthLabel(year, month, dates.length, lastDate), dates: dates };
    });
  }

  var MONTH_OPTIONS = buildMonthOptions();
  var monthSelect = document.getElementById("month-select");
  MONTH_OPTIONS.forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    monthSelect.appendChild(opt);
  });
  monthSelect.value = MONTH_OPTIONS[MONTH_OPTIONS.length - 1].value;

  function concatMonthData(monthKey) {
    var opt = MONTH_OPTIONS.filter(function (o) { return o.value === monthKey; })[0];
    var dates = opt ? opt.dates : [];
    var allTimes = [], allDatesPerIndex = [], allPrices = [], allC = [], allG = [];
    var siteId = siteSelect.value;
    dates.forEach(function (d) {
      var ds = DATA.byDate[d];
      var ss = DATA.bySite[siteId] && DATA.bySite[siteId][d];
      if (!ds || !ss) { return; }
      for (var i = 0; i < ds.t.length; i++) {
        allTimes.push(ds.t[i]);
        allDatesPerIndex.push(d);
        allPrices.push(ds.p[i]);
        allC.push(ss.c[i]);
        allG.push(ss.g[i]);
      }
    });
    return { dates: allDatesPerIndex, times: allTimes, prices: allPrices, consumption: allC, production: allG };
  }

  var lastMonthChartGeom = null;
  var monthChart = document.getElementById("month-chart");

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

  attachHoverHandler(monthChart, "month-chart-crosshair", function () { return lastMonthChartGeom; }, highlightTableRow, clearHighlightedRow);

  var chartMode = "day";

  function switchMode(mode) {
    chartMode = mode;
    dateInput.style.display = mode === "day" ? "" : "none";
    monthSelect.style.display = mode === "month" ? "" : "none";
    document.getElementById("day-chart-wrap").style.display = mode === "day" ? "" : "none";
    document.getElementById("month-chart-wrap").style.display = mode === "month" ? "" : "none";
    var tabs = document.querySelectorAll(".chart-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-mode") === mode);
    }
    render();
  }

  var tabButtons = document.querySelectorAll(".chart-tab");
  for (var t = 0; t < tabButtons.length; t++) {
    tabButtons[t].addEventListener("click", function (evt) {
      switchMode(evt.target.getAttribute("data-mode"));
    });
  }

  function render() {
    var siteId = siteSelect.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var hedgeBlocks = DATA.hedge && DATA.hedge[siteId];

    if (chartMode === "month") {
      var monthKey = monthSelect.value;
      var month = concatMonthData(monthKey);
      if (month.times.length === 0) {
        crumb.textContent = "";
        chartSubtitle.textContent = "";
        statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
          '<div class="value">—</div><div class="sublabel">No data for this month.</div></div>';
        monthChart.innerHTML = "";
        tableBody.innerHTML = "";
        return;
      }
      var monthOpt = MONTH_OPTIONS.filter(function (o) { return o.value === monthKey; })[0];
      crumb.textContent = site.name + " · " + monthOpt.label;
      chartSubtitle.textContent = month.times.length + " intervals · Europe/Amsterdam";

      var monthStats = ConsumptionCalc.computeDayStats(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      var monthSeries = ConsumptionCalc.computeIntervalSeries(month.times, month.prices, month.consumption, month.production, month.dates, hedgeBlocks);
      renderStatCards(monthStats);

      var markup = buildMonthChartSvg(month.dates, month.times, month.consumption, month.production);
      monthChart.setAttribute("viewBox", "0 0 " + lastMonthChartGeom.width + " 260");
      monthChart.style.width = lastMonthChartGeom.width + "px";
      monthChart.innerHTML = markup;

      renderTable(month.times, month.consumption, month.production, month.prices, monthSeries);
      return;
    }

    var date = dateInput.value;
    var dateSeries = DATA.byDate[date];
    var siteSeries = DATA.bySite[siteId] && DATA.bySite[siteId][date];

    if (!dateSeries || !siteSeries) {
      crumb.textContent = "";
      chartSubtitle.textContent = "";
      statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
        '<div class="value">—</div><div class="sublabel">No data for this date.</div></div>';
      chart.innerHTML = "";
      tableBody.innerHTML = "";
      return;
    }

    crumb.textContent = site.name + " · " + formatDateLong(date);
    chartSubtitle.textContent = dateSeries.t.length + " intervals · Europe/Amsterdam";

    var dayStats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    var daySeries = ConsumptionCalc.computeIntervalSeries(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g, date, hedgeBlocks);
    renderStatCards(dayStats);

    chart.innerHTML = buildChartSvg(dateSeries.t, siteSeries.c, siteSeries.g);
    renderTable(dateSeries.t, siteSeries.c, siteSeries.g, dateSeries.p, daySeries);
  }

  siteSelect.addEventListener("change", render);
  dateInput.addEventListener("change", render);
  monthSelect.addEventListener("change", render);
  render();
})();
</script>
</body>
</html>
"""


def render_html(data_json_text, calc_js_text):
    # Guard against the (currently impossible, but cheap to guard) case of a
    # "</script" sequence inside the embedded JSON breaking out of its tag.
    safe_data_json_text = data_json_text.replace("</", "<\\/")
    html = PAGE_TEMPLATE.replace("__CALC_JS__", calc_js_text)
    html = html.replace("__DATA_JSON__", safe_data_json_text)
    return html


def main():
    with open(COMBINED_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)

    dataset = build_compact_dataset(rows)

    with open(HEDGE_PATH, "r", encoding="utf-8") as f:
        hedge_rows = json.load(f)
    dataset["hedge"] = build_hedge_section(hedge_rows)

    data_json_text = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
    with open(DATA_OUT_PATH, "w", encoding="utf-8") as f:
        f.write(data_json_text)
    print("Wrote %s (%d bytes)" % (DATA_OUT_PATH, len(data_json_text)))

    with open(CALC_JS_PATH, "r", encoding="utf-8") as f:
        calc_js_text = f.read()

    html = render_html(data_json_text, calc_js_text)
    with open(HTML_OUT_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print("Wrote %s (%d bytes)" % (HTML_OUT_PATH, len(html)))


if __name__ == "__main__":
    main()
