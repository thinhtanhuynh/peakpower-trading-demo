import json
import random
from datetime import datetime

SRC_DIR = "/sessions/sweet-brave-hypatia/mnt/trading-poc"
OUT_DIR = "/sessions/sweet-brave-hypatia/mnt/outputs"

# --- Mapping: old EAN (existing 5-profile dataset) -> new portal-matching EAN/name ---
EAN_MAP = {
    "871687526018159084": {"new_ean": "871687100000000078", "new_name": "Breda warehouse"},      # manufacturer -> breda
    "871687301661318602": {"new_ean": "871687100000000027", "new_name": "Venlo cold store"},      # cold_store  -> venlo
    "871687913909960308": {"new_ean": "871687100000000011", "new_name": "Rotterdam DC"},          # data_centre -> rot
    "871687824628194823": {"new_ean": "871687100000000061", "new_name": "— no name set —"},  # greenhouse -> unnamed
    "871687199351819092": {"new_ean": "871687100000000043", "new_name": "Tilburg plant"},         # logistics_hub -> tilburg
}

OFFICE_EAN = "871687100000000059"
OFFICE_NAME = "Almere office"
OFFICE_TYPE = "office"

# tilburg-gas (EAN 871687100000000092) is "Not tradeable" / no volume in the portal -> no usage row generated.

rng = random.Random(420608)  # deterministic noise stream for the new office profile


def frac_hour(ts: str) -> float:
    dt = datetime.strptime(ts[:19], "%Y-%m-%d %H:%M:%S")
    return dt.hour + dt.minute / 60.0


def office_consumption(day_of_week: int, month: int, fh: float) -> float:
    baseline = 78.0  # small server room + standby systems, 24/7
    weekday = day_of_week <= 5
    if not weekday:
        return round(max(50.0, baseline + rng.uniform(-6, 6)), 3)

    plateau = 235.0
    if fh < 6.5 or fh >= 19.5:
        base = baseline + rng.uniform(-6, 6)
    elif fh < 8.0:
        f = (fh - 6.5) / 1.5
        base = baseline + f * (plateau - baseline) + rng.uniform(-4, 4)
    elif fh < 18.0:
        base = plateau + rng.uniform(-15, 15)
        if month in (6, 7, 8):
            base += 12  # summer AC uptick
    else:
        f = (fh - 18.0) / 1.5
        base = plateau - f * (plateau - baseline) + rng.uniform(-4, 4)
    return round(max(50.0, base), 3)


def office_production(logistics_kw: float) -> float:
    ratio = logistics_kw / 700.0  # logistics_hub site has 700 kWp rooftop solar
    prod = ratio * 60.0  # office has a much smaller 60 kWp array
    if prod > 0:
        prod += rng.uniform(-1.5, 1.5)
    return round(max(0.0, prod), 3)


def process(filename):
    with open(f"{SRC_DIR}/{filename}") as f:
        data = json.load(f)

    n = len(data)
    assert n % 5 == 0
    out = []
    for i in range(0, n, 5):
        group = data[i:i + 5]
        logistics_row = None
        for row in group:
            m = EAN_MAP[row["EAN"]]
            row["EAN"] = m["new_ean"]
            row["organization_name"] = m["new_name"]
            out.append(row)
            if row["organization_type"] == "logistics_hub":
                logistics_row = row

        # build new office row from shared fields
        template = group[0]
        office_row = {k: template[k] for k in template if k not in (
            "EAN", "organization_type", "organization_name", "consumption", "production")}
        fh = frac_hour(template["timestamp"])
        office_row["EAN"] = OFFICE_EAN
        office_row["organization_type"] = OFFICE_TYPE
        office_row["organization_name"] = OFFICE_NAME
        office_row["consumption"] = office_consumption(template["day_of_week"], template["month"], fh)
        office_row["production"] = office_production(logistics_row["production"])
        out.append(office_row)

    with open(f"{OUT_DIR}/{filename}", "w") as f:
        json.dump(out, f)

    return n, len(out)


if __name__ == "__main__":
    for fname in ("epex_usage_15_min_interval.json", "epex_tariffs_usage_combined_15_min_interval.json"):
        before, after = process(fname)
        print(fname, "rows before:", before, "rows after:", after)
