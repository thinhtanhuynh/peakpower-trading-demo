import json
import calendar
from datetime import date, timedelta

EANS = [
    ("871687100000000011", "Rotterdam DC"),
    ("871687100000000027", "Venlo cold store"),
    ("871687100000000043", "Tilburg plant"),
    ("871687100000000059", "Almere office"),
    ("871687100000000061", "— no name set —"),
    ("871687100000000078", "Breda warehouse"),
]

POWER_MW = 1.0          # easy round number, same for every EAN/shape
BASE_PRICE = 70.00      # EUR/MWh
PEAK_PRICE = 95.00      # EUR/MWh


def month_period(year, month):
    start = date(year, month, 1)
    end_excl = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    end_incl = end_excl - timedelta(days=1)
    label = f"{calendar.month_abbr[month]} {year}"
    return dict(periodType="MONTH", year=year, quarter=None, month=month,
                periodStart=start.isoformat(), periodEnd=end_incl.isoformat(),
                periodLabel=label), start, end_excl


def quarter_period(year, quarter):
    start_month = (quarter - 1) * 3 + 1
    end_month = start_month + 3
    start = date(year, start_month, 1)
    end_excl = date(year + 1, end_month - 12, 1) if end_month > 12 else date(year, end_month, 1)
    end_incl = end_excl - timedelta(days=1)
    label = f"Q{quarter} {year}"
    return dict(periodType="QUARTER", year=year, quarter=quarter, month=None,
                periodStart=start.isoformat(), periodEnd=end_incl.isoformat(),
                periodLabel=label), start, end_excl


def year_period(year):
    start = date(year, 1, 1)
    end_excl = date(year + 1, 1, 1)
    end_incl = end_excl - timedelta(days=1)
    label = f"{year}"
    return dict(periodType="YEAR", year=year, quarter=None, month=None,
                periodStart=start.isoformat(), periodEnd=end_incl.isoformat(),
                periodLabel=label), start, end_excl


def compute_hours(start, end_excl):
    base_hours = (end_excl - start).days * 24
    peak_hours = 0
    d = start
    while d < end_excl:
        if d.weekday() < 5:  # Mon-Fri
            peak_hours += 12  # 08:00-20:00
        d += timedelta(days=1)
    return base_hours, peak_hours


def build_rows(period_fields, start, end_excl):
    base_hours, peak_hours = compute_hours(start, end_excl)
    rows = []
    for ean, name in EANS:
        for shape, hours, price in (("base", base_hours, BASE_PRICE), ("peak", peak_hours, PEAK_PRICE)):
            power_mw = POWER_MW
            volume_mwh = round(power_mw * hours, 3)
            row = {
                "EAN": ean,
                "organization_name": name,
                **period_fields,
                "shape": shape,
                "power (MW)": power_mw,
                "volume (MWh)": volume_mwh,
                "offered price (€/MWh)": price,
                "powerKw": power_mw * 1000,
                "volumeKwh": round(volume_mwh * 1000, 3),
                "priceKwh": round(price / 1000, 6),
            }
            rows.append(row)
    return rows


if __name__ == "__main__":
    period_fields, start, end_excl = year_period(2026)
    rows = build_rows(period_fields, start, end_excl)

    with open("/sessions/sweet-brave-hypatia/mnt/outputs/hedge_blocks_2026.json", "w") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)

    print(len(rows), "rows written")
    for r in rows[:2]:
        print(json.dumps(r, indent=2, ensure_ascii=False))
