"""
Integration check for the generated Consumption (Live Data) artifacts.
Run after `python3 generate_consumption_data.py`.

Verifies:
  - consumption_live_data.json has all 6 sites and all 217 dates
  - the DST day (2026-03-29) has 92 intervals, a regular day has 96
  - the JSON embedded in the final HTML matches consumption_live_data.json exactly
  - one site/date's compact arrays match the raw combined source file exactly (rounded)
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(HERE, "consumption_live_data.json")
HTML_PATH = os.path.join(HERE, "Customer Portal - Consumption (Live Data).html")
COMBINED_PATH = os.path.join(HERE, "epex_tariffs_usage_combined_15_min_interval.json")

EXPECTED_DATES = 217
EXPECTED_SITES = ["rot", "venlo", "tilburg", "almere", "unnamed", "breda"]
DST_SHORT_DAY = "2026-03-29"
REGULAR_DAY = "2026-08-05"

EXPECTED_HEDGE_ROT = [
    {"shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07},
    {"shape": "peak", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.095},
]


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_embedded_json(html_text):
    match = re.search(
        r'<script type="application/json" id="consumption-data">(.*?)</script>',
        html_text, re.S)
    assert match, "consumption-data script tag not found in HTML"
    return json.loads(match.group(1))


def main():
    dataset = load_json(DATA_PATH)

    assert sorted(s["id"] for s in dataset["sites"]) == sorted(EXPECTED_SITES), \
        "site id set mismatch: %s" % (dataset["sites"],)
    assert len(dataset["byDate"]) == EXPECTED_DATES, \
        "expected %d dates, got %d" % (EXPECTED_DATES, len(dataset["byDate"]))

    for site_id in EXPECTED_SITES:
        assert site_id in dataset["bySite"], "missing site %s in bySite" % site_id
        assert len(dataset["bySite"][site_id]) == EXPECTED_DATES, \
            "site %s has %d dates, expected %d" % (
                site_id, len(dataset["bySite"][site_id]), EXPECTED_DATES)

    for site_id, dates in dataset["bySite"].items():
        for date, s in dates.items():
            n = len(dataset["byDate"][date]["t"])
            assert len(s["c"]) == len(s["g"]) == n, \
                "%s/%s array length %d/%d != byDate %d" % (site_id, date, len(s["c"]), len(s["g"]), n)

    assert len(dataset["byDate"][DST_SHORT_DAY]["t"]) == 92, \
        "DST day should have 92 intervals, got %d" % len(dataset["byDate"][DST_SHORT_DAY]["t"])
    assert len(dataset["byDate"][REGULAR_DAY]["t"]) == 96, \
        "%s should have 96 intervals, got %d" % (REGULAR_DAY, len(dataset["byDate"][REGULAR_DAY]["t"]))

    with open(HTML_PATH, "r", encoding="utf-8") as f:
        html_text = f.read()
    embedded = extract_embedded_json(html_text)
    assert embedded == dataset, "embedded HTML data does not match consumption_live_data.json"

    raw_rows = load_json(COMBINED_PATH)
    rot_rows = sorted(
        (r for r in raw_rows if r["EAN"] == "871687100000000011" and r["delivery_day"] == REGULAR_DAY),
        key=lambda r: r["isp"],
    )
    expected_c = [round(r["consumption"], 1) for r in rot_rows]
    expected_g = [round(r["production"], 1) for r in rot_rows]
    expected_p = [round(r["epex"], 4) for r in rot_rows]
    expected_t = [r["timestamp"][11:16] for r in rot_rows]

    actual = dataset["bySite"]["rot"][REGULAR_DAY]
    assert actual["c"] == expected_c, "rot/%s consumption mismatch" % REGULAR_DAY
    assert actual["g"] == expected_g, "rot/%s production mismatch" % REGULAR_DAY
    assert dataset["byDate"][REGULAR_DAY]["p"] == expected_p, "%s price mismatch" % REGULAR_DAY
    assert dataset["byDate"][REGULAR_DAY]["t"] == expected_t, "%s time labels mismatch" % REGULAR_DAY

    assert dataset["hedge"]["rot"] == EXPECTED_HEDGE_ROT, \
        "rot hedge blocks mismatch: %s" % (dataset["hedge"]["rot"],)
    for site_id in EXPECTED_SITES:
        assert site_id in dataset["hedge"], "missing site %s in hedge" % site_id
        assert len(dataset["hedge"][site_id]) == 2, \
            "site %s should have 2 hedge blocks (base+peak), got %d" % (site_id, len(dataset["hedge"][site_id]))

    # 2026-08-03 is a Monday: weekday-peak interval (10:00) has both base+peak
    # active; an off-peak interval the same day (21:00) has base only.
    weekday_peak_hedge_kwh = 1000.0 * 0.25 + 1000.0 * 0.25
    weekday_peak_hedge_cost = 1000.0 * 0.25 * 0.07 + 1000.0 * 0.25 * 0.095
    assert abs(weekday_peak_hedge_kwh - 500.0) < 1e-9, "weekday-peak hedge volume formula check failed"
    assert abs(weekday_peak_hedge_cost - 41.25) < 1e-9, "weekday-peak hedge cost formula check failed"

    off_peak_hedge_kwh = 1000.0 * 0.25
    off_peak_hedge_cost = 1000.0 * 0.25 * 0.07
    assert abs(off_peak_hedge_kwh - 250.0) < 1e-9, "off-peak hedge volume formula check failed"
    assert abs(off_peak_hedge_cost - 17.5) < 1e-9, "off-peak hedge cost formula check failed"

    print("verify_consumption_page.py: all checks passed (%d dates, %d sites, hedge data verified)" %
          (len(dataset["byDate"]), len(dataset["sites"])))


if __name__ == "__main__":
    main()
