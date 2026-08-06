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


if __name__ == "__main__":
    pass  # main() is added in Task 3
