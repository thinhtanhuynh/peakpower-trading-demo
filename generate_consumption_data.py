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
    --pp-teal-700:#0f766e; --pp-teal-600:#0d9488; --pp-teal-500:#14b8a6;
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
        <input type="date" id="date-input" min="2026-01-01" max="2026-08-05">
      </div>
      <div class="stat-row" id="stat-row"></div>
      <div class="card">
        <div class="card-title">Consumption &amp; production — 15-minute intervals</div>
        <div class="card-subtitle" id="chart-subtitle"></div>
        <svg id="chart" viewBox="0 0 960 260" style="width:100%;height:260px;display:block"></svg>
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
              <tr><th>Time</th><th class="num">Consumption (kW)</th><th class="num">Production (kW)</th><th class="num">Net (kW)</th><th class="num">EPEX (€/kWh)</th></tr>
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

  var DEFAULT_SITE = "rot";
  var DEFAULT_DATE = "2026-08-05";
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
    return '<line x1="' + padLeft + '" y1="' + (padTop + plotH) + '" x2="' + (padLeft + plotW) +
      '" y2="' + (padTop + plotH) + '" stroke="#dbe3ec"></line>' +
      bars +
      '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#15803d" stroke-width="2"></polyline>' +
      axisLabels;
  }

  function render() {
    var siteId = siteSelect.value;
    var date = dateInput.value;
    var site = DATA.sites.filter(function (s) { return s.id === siteId; })[0];
    var dateSeries = DATA.byDate[date];
    var siteSeries = DATA.bySite[siteId] && DATA.bySite[siteId][date];

    if (!dateSeries || !siteSeries) {
      statRow.innerHTML = '<div class="stat-card"><div class="label">No data</div>' +
        '<div class="value">—</div><div class="sublabel">No data for this date.</div></div>';
      chart.innerHTML = "";
      tableBody.innerHTML = "";
      return;
    }

    crumb.textContent = site.name + " · " + formatDateLong(date);
    chartSubtitle.textContent = dateSeries.t.length + " intervals · Europe/Amsterdam";

    var stats = ConsumptionCalc.computeDayStats(dateSeries.t, dateSeries.p, siteSeries.c, siteSeries.g);
    var spotTone = stats.spotResultEur > 0 ? "critical" : (stats.spotResultEur < 0 ? "success" : "");
    var netTone = stats.netKwh < 0 ? "export" : "";

    statRow.innerHTML =
      statCardHtml("Consumption", ConsumptionCalc.formatNL(stats.consumptionKwh, 1) + " kWh", "", dateSeries.t.length + " intervals") +
      statCardHtml("Production", ConsumptionCalc.formatNL(stats.productionKwh, 1) + " kWh", "", "on-site generation") +
      statCardHtml("Net / import", ConsumptionCalc.formatNL(stats.netKwh, 1) + " kWh", netTone, stats.netKwh < 0 ? "net exporter" : "net importer") +
      statCardHtml("Peak demand", ConsumptionCalc.formatNL(stats.peakKw, 1) + " kW", "", "at " + stats.peakTime) +
      statCardHtml("Spot result", (stats.spotResultEur >= 0 ? "+ " : "− ") + "€ " + ConsumptionCalc.formatNL(Math.abs(stats.spotResultEur), 2), spotTone, "indicative, day-ahead price");

    chart.innerHTML = buildChartSvg(dateSeries.t, siteSeries.c, siteSeries.g);

    var rows = "";
    for (var i = 0; i < dateSeries.t.length; i++) {
      var net = siteSeries.c[i] - siteSeries.g[i];
      var netClass = net < 0 ? ' class="num net-export"' : ' class="num"';
      rows += "<tr><td>" + dateSeries.t[i] + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(siteSeries.c[i], 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(siteSeries.g[i], 1) + "</td>" +
        "<td" + netClass + ">" + ConsumptionCalc.formatNL(net, 1) + "</td>" +
        '<td class="num">' + ConsumptionCalc.formatNL(dateSeries.p[i], 4) + "</td></tr>";
    }
    tableBody.innerHTML = rows;
  }

  siteSelect.addEventListener("change", render);
  dateInput.addEventListener("change", render);
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
