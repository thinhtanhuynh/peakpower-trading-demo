import unittest
from generate_consumption_data import build_compact_dataset, SITE_META

ROT_EAN = SITE_META[0]["ean"]        # rot
VENLO_EAN = SITE_META[1]["ean"]      # venlo
UNKNOWN_EAN = "999999999999999999"   # not in SITE_META (e.g. tilburg-gas)


def make_row(ean, date, isp, hhmm, epex, consumption, production):
    return {
        "EAN": ean,
        "delivery_day": date,
        "isp": isp,
        "timestamp": "%s %s:00.000000" % (date, hhmm),
        "epex": epex,
        "consumption": consumption,
        "production": production,
    }


class BuildCompactDatasetTests(unittest.TestCase):
    def test_groups_by_site_and_date(self):
        rows = [
            make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.1000, 100.0, 0.0),
            make_row(ROT_EAN, "2026-01-01", 2, "00:15", 0.2000, 200.0, 10.0),
        ]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"]["2026-01-01"]["t"], ["00:00", "00:15"])
        self.assertEqual(result["byDate"]["2026-01-01"]["p"], [0.1, 0.2])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [100.0, 200.0])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["g"], [0.0, 10.0])

    def test_sorts_by_isp_even_if_input_unordered(self):
        rows = [
            make_row(ROT_EAN, "2026-01-01", 2, "00:15", 0.2000, 200.0, 0.0),
            make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.1000, 100.0, 0.0),
        ]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"]["2026-01-01"]["t"], ["00:00", "00:15"])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [100.0, 200.0])

    def test_rounds_consumption_production_and_price(self):
        rows = [make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.089621, 612.449, 0.049)]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"]["2026-01-01"]["p"], [0.0896])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [612.4])
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["g"], [0.0])

    def test_unknown_ean_is_ignored(self):
        rows = [make_row(UNKNOWN_EAN, "2026-01-01", 1, "00:00", 0.1, 1.0, 0.0)]
        result = build_compact_dataset(rows)
        self.assertEqual(result["byDate"], {})
        for site_dates in result["bySite"].values():
            self.assertEqual(site_dates, {})

    def test_multiple_sites_share_date_but_have_own_series(self):
        rows = [
            make_row(ROT_EAN, "2026-01-01", 1, "00:00", 0.10, 100.0, 0.0),
            make_row(VENLO_EAN, "2026-01-01", 1, "00:00", 0.10, 500.0, 0.0),
        ]
        result = build_compact_dataset(rows)
        self.assertEqual(len(result["byDate"]), 1)
        self.assertEqual(result["bySite"]["rot"]["2026-01-01"]["c"], [100.0])
        self.assertEqual(result["bySite"]["venlo"]["2026-01-01"]["c"], [500.0])

    def test_sites_list_matches_meta(self):
        result = build_compact_dataset([])
        self.assertEqual(result["sites"], SITE_META)


from generate_consumption_data import build_hedge_section

def make_hedge_row(ean, shape, period_start, period_end, power_kw, price_kwh):
    return {
        "EAN": ean,
        "shape": shape,
        "periodStart": period_start,
        "periodEnd": period_end,
        "powerKw": power_kw,
        "priceKwh": price_kwh,
        "organization_name": "irrelevant for this function",
        "periodType": "YEAR",
    }


class BuildHedgeSectionTests(unittest.TestCase):
    def test_groups_by_site_with_only_needed_fields(self):
        rows = [
            make_hedge_row(ROT_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07),
            make_hedge_row(ROT_EAN, "peak", "2026-01-01", "2026-12-31", 1000.0, 0.095),
        ]
        result = build_hedge_section(rows)
        self.assertEqual(result["rot"], [
            {"shape": "base", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.07},
            {"shape": "peak", "periodStart": "2026-01-01", "periodEnd": "2026-12-31", "powerKw": 1000.0, "priceKwh": 0.095},
        ])

    def test_unknown_ean_is_ignored(self):
        rows = [make_hedge_row(UNKNOWN_EAN, "base", "2026-01-01", "2026-12-31", 1000.0, 0.07)]
        result = build_hedge_section(rows)
        for site_blocks in result.values():
            self.assertEqual(site_blocks, [])

    def test_all_sites_present_even_when_empty(self):
        result = build_hedge_section([])
        self.assertEqual(sorted(result.keys()), sorted(m["id"] for m in SITE_META))


if __name__ == "__main__":
    unittest.main()
