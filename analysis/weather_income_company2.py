"""
Weather vs revenue backtest — Portfolio Company 2.
Company: Dakdekkersbedrijf Peter Ummels (roofing), ledger export.
Location: 6442PB Brunssum (Limburg, NL).
Weather: Open-Meteo historical archive API.

Pipeline:
  1. Load ledger exports (preamble-stripped), tag by revenue account, dedup overlaps.
  2. Net revenue = Credit - Debet across all omzet accounts (8002/8004/8005).
  3. Aggregate revenue to ISO weeks and to calendar months.
  4. Fetch daily historical weather for Brunssum; engineer rain/frost/heat/wind features.
  5. Aggregate weather to the same week / month grids.
  6. Correlate weather vs revenue (Pearson + Spearman), contemporaneous and lagged 0-4 weeks.
  7. Month-adjusted correlations (strip seasonality) for a cleaner causal read.
  8. Rule-based scenario tests: split weeks into bad-weather vs normal and compare revenue.
"""

from __future__ import annotations

import glob
import json
from pathlib import Path

import pandas as pd
import requests
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
LEDGER_DIR = ROOT / "portfolio company 2 data"
OUTPUT_DIR = ROOT / "analysis" / "output_company2"

# Brunssum, 6442PB
LAT, LON = 50.947, 5.972

HEADER_ROW = 12  # transaction table header inside each export sheet


# ----------------------------------------------------------------------------
# Step 1 — Load ledger
# ----------------------------------------------------------------------------
def _account_of(path: str) -> str:
    """Read the Grootboekrekening (revenue account) from the file preamble."""
    raw = pd.read_excel(path, sheet_name=0, header=None, nrows=HEADER_ROW)
    for i in range(len(raw)):
        row = [str(c) for c in raw.iloc[i].tolist()]
        if "Grootboekrekening" in row:
            return row[row.index("Grootboekrekening") + 1].split(" - ")[0].strip()
    return "?"


def step1_load_ledger() -> pd.DataFrame:
    """Load every export, tag by account, dedup overlapping period exports."""
    frames = []
    for f in sorted(glob.glob(str(LEDGER_DIR / "*.xlsx"))):
        acct = _account_of(f)
        d = pd.read_excel(f, sheet_name=0, header=HEADER_ROW)
        # keep only real transaction rows (Nr. is a running integer)
        d = d[pd.to_numeric(d["Nr."], errors="coerce").notna()].copy()
        d["account"] = acct
        frames.append(d)
    df = pd.concat(frames, ignore_index=True)

    # The base (period 1-12) and partial (period 1-5) exports overlap.
    # Bkst.nr is the document number; dedup on the booking's true identity.
    df = df.drop_duplicates(subset=["account", "Bkst.nr.", "Datum", "Debet", "Credit"])

    df["Datum"] = pd.to_datetime(df["Datum"])
    df["net"] = df["Credit"].fillna(0) - df["Debet"].fillna(0)
    df = df[df["net"] != 0].copy()
    return df


# ----------------------------------------------------------------------------
# Step 2/3 — Aggregate revenue
# ----------------------------------------------------------------------------
def aggregate_weekly(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["week_start"] = df["Datum"].dt.to_period("W-SUN").apply(lambda p: p.start_time)
    return (
        df.groupby("week_start", as_index=False)
        .agg(
            revenue=("net", "sum"),
            invoice_lines=("net", "count"),
            active_days=("Datum", lambda s: s.dt.date.nunique()),
        )
        .sort_values("week_start")
    )


def aggregate_monthly(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["month_start"] = df["Datum"].dt.to_period("M").apply(lambda p: p.start_time)
    return (
        df.groupby("month_start", as_index=False)
        .agg(revenue=("net", "sum"), invoice_lines=("net", "count"))
        .sort_values("month_start")
    )


# ----------------------------------------------------------------------------
# Step 4 — Weather
# ----------------------------------------------------------------------------
def fetch_weather(start: str, end: str) -> pd.DataFrame:
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": LAT,
        "longitude": LON,
        "start_date": start,
        "end_date": end,
        "daily": [
            "precipitation_sum",
            "rain_sum",
            "snowfall_sum",
            "temperature_2m_mean",
            "temperature_2m_max",
            "temperature_2m_min",
            "windspeed_10m_max",
            "windgusts_10m_max",
        ],
        "timezone": "Europe/Amsterdam",
    }
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    d = resp.json()["daily"]
    w = pd.DataFrame(
        {
            "date": pd.to_datetime(d["time"]),
            "precip_mm": d["precipitation_sum"],
            "rain_mm": d["rain_sum"],
            "snow_mm": d["snowfall_sum"],
            "temp_mean_c": d["temperature_2m_mean"],
            "temp_max_c": d["temperature_2m_max"],
            "temp_min_c": d["temperature_2m_min"],
            "wind_max_kmh": d["windspeed_10m_max"],
            "gust_max_kmh": d["windgusts_10m_max"],
        }
    )
    # Daily weather flags — the "can't work today" conditions
    w["rain_day"] = w["rain_mm"] >= 1.0          # measurable rain
    w["heavy_rain_day"] = w["rain_mm"] >= 5.0     # disruptive rain
    w["frost_day"] = w["temp_min_c"] <= 0.0       # frost
    w["cold_day"] = w["temp_mean_c"] <= 5.0       # cold
    w["heat_day"] = w["temp_max_c"] >= 28.0       # too hot on a roof
    w["windy_day"] = w["wind_max_kmh"] >= 40.0    # unsafe at height
    w["storm_day"] = w["gust_max_kmh"] >= 60.0    # storm gusts
    w["workable_day"] = ~(
        w["rain_day"] | w["frost_day"] | w["heat_day"] | w["windy_day"]
    )
    return w


def _weather_period(weather: pd.DataFrame, key: str) -> pd.DataFrame:
    w = weather.copy()
    if key == "week_start":
        w[key] = w["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)
    else:
        w[key] = w["date"].dt.to_period("M").apply(lambda p: p.start_time)
    return (
        w.groupby(key, as_index=False)
        .agg(
            rain_mm=("rain_mm", "sum"),
            precip_mm=("precip_mm", "sum"),
            rain_days=("rain_day", "sum"),
            heavy_rain_days=("heavy_rain_day", "sum"),
            frost_days=("frost_day", "sum"),
            cold_days=("cold_day", "sum"),
            heat_days=("heat_day", "sum"),
            windy_days=("windy_day", "sum"),
            storm_days=("storm_day", "sum"),
            workable_days=("workable_day", "sum"),
            temp_mean_c=("temp_mean_c", "mean"),
            temp_max_c=("temp_max_c", "max"),
            wind_max_kmh=("wind_max_kmh", "max"),
        )
    )


# ----------------------------------------------------------------------------
# Step 6 — Correlations
# ----------------------------------------------------------------------------
WX_COLS = [
    "rain_mm",
    "rain_days",
    "heavy_rain_days",
    "frost_days",
    "cold_days",
    "heat_days",
    "windy_days",
    "storm_days",
    "workable_days",
    "temp_mean_c",
]


def correlations(merged: pd.DataFrame, lags=(0, 1, 2, 4)) -> pd.DataFrame:
    rows = []
    for lag in lags:
        frame = merged.copy()
        for col in WX_COLS:
            frame[f"{col}_lag"] = frame[col].shift(lag)
            valid = frame[[f"{col}_lag", "revenue"]].dropna()
            if len(valid) < 12:
                continue
            pr, pp = stats.pearsonr(valid[f"{col}_lag"], valid["revenue"])
            sr, sp = stats.spearmanr(valid[f"{col}_lag"], valid["revenue"])
            rows.append(
                {
                    "weather_metric": col,
                    "lag_weeks": lag,
                    "n": len(valid),
                    "pearson_r": pr,
                    "pearson_p": pp,
                    "spearman_r": sr,
                    "spearman_p": sp,
                }
            )
    return pd.DataFrame(rows).sort_values("pearson_p")


def month_adjusted(merged: pd.DataFrame) -> pd.DataFrame:
    """Strip seasonality: regress out monthly mean revenue, then correlate."""
    df = merged.copy()
    df["month"] = df["week_start"].dt.month
    df["rev_adj"] = df["revenue"] - df.groupby("month")["revenue"].transform("mean")
    rows = []
    for col in WX_COLS:
        df[f"{col}_adj"] = df[col] - df.groupby("month")[col].transform("mean")
        valid = df[[f"{col}_adj", "rev_adj"]].dropna()
        r, p = stats.pearsonr(valid[f"{col}_adj"], valid["rev_adj"])
        rows.append({"weather_metric": col, "r_month_adj": r, "p_month_adj": p, "n": len(valid)})
    return pd.DataFrame(rows).sort_values("p_month_adj")


# ----------------------------------------------------------------------------
# Step 8 — Rule-based scenario tests
# ----------------------------------------------------------------------------
SCENARIOS = {
    "heavy_rain_week (>=2 heavy-rain days)": ("heavy_rain_days", 2),
    "wet_week (>=4 rain days)": ("rain_days", 4),
    "frost_week (>=2 frost days)": ("frost_days", 2),
    "cold_week (>=3 cold days)": ("cold_days", 3),
    "heat_week (>=2 hot days >=28C)": ("heat_days", 2),
    "windy_week (>=2 windy days >=40kmh)": ("windy_days", 2),
    "storm_week (>=1 storm day)": ("storm_days", 1),
    "good_week (>=6 workable days)": ("workable_days", 6),
}


def scenario_tests(merged: pd.DataFrame) -> pd.DataFrame:
    """For each rule: compare revenue in matching vs non-matching weeks.

    Tested at the lag with the strongest contemporaneous effect (lag 0 and
    lag 1 both reported), using a Mann-Whitney U test on the revenue split.
    """
    base_med = merged["revenue"].median()
    rows = []
    for name, (col, thr) in SCENARIOS.items():
        for lag in (0, 1):
            df = merged.copy()
            df["flag"] = (df[col] >= thr).shift(lag)
            df = df.dropna(subset=["flag"])
            hit = df[df["flag"]]["revenue"]
            norm = df[~df["flag"].astype(bool)]["revenue"]
            if len(hit) < 6 or len(norm) < 6:
                continue
            u, p = stats.mannwhitneyu(hit, norm, alternative="two-sided")
            rows.append(
                {
                    "scenario": name,
                    "lag_weeks": lag,
                    "n_match": len(hit),
                    "n_other": len(norm),
                    "median_rev_match": round(hit.median()),
                    "median_rev_other": round(norm.median()),
                    "pct_vs_other": round(100 * (hit.median() / norm.median() - 1), 1),
                    "pct_vs_overall": round(100 * (hit.median() / base_med - 1), 1),
                    "mannwhitney_p": round(p, 4),
                }
            )
    return pd.DataFrame(rows)


# ----------------------------------------------------------------------------
def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 64)
    print("STEP 1 — Load ledger (Dakdekkersbedrijf Peter Ummels)")
    print("=" * 64)
    ledger = step1_load_ledger()
    print(f"  Transactions (deduped): {len(ledger):,}")
    print(f"  Date range: {ledger['Datum'].min().date()} -> {ledger['Datum'].max().date()}")
    print(f"  Accounts: {ledger['account'].value_counts().to_dict()}")
    print(f"  Total net revenue: EUR {ledger['net'].sum():,.0f}")

    print("\nSTEP 2 — Aggregate revenue (weekly + monthly)")
    weekly_rev = aggregate_weekly(ledger)
    monthly_rev = aggregate_monthly(ledger)
    print(f"  Weeks: {len(weekly_rev)}  |  Months: {len(monthly_rev)}")
    print(f"  Median weekly revenue: EUR {weekly_rev['revenue'].median():,.0f}")

    start = ledger["Datum"].min().strftime("%Y-%m-%d")
    end = ledger["Datum"].max().strftime("%Y-%m-%d")

    print("\nSTEP 3/4 — Fetch + engineer weather (Brunssum)")
    weather = fetch_weather(start, end)
    weather.to_csv(OUTPUT_DIR / "weather_daily.csv", index=False)
    print(f"  Daily weather rows: {len(weather)}")
    print(f"  Rain days: {int(weather['rain_day'].sum())} | "
          f"frost: {int(weather['frost_day'].sum())} | "
          f"heat: {int(weather['heat_day'].sum())} | "
          f"windy: {int(weather['windy_day'].sum())}")

    weekly_wx = _weather_period(weather, "week_start")
    monthly_wx = _weather_period(weather, "month_start")

    print("\nSTEP 5 — Merge")
    week_m = weekly_rev.merge(weekly_wx, on="week_start", how="inner")
    month_m = monthly_rev.merge(monthly_wx, on="month_start", how="inner")
    week_m.to_csv(OUTPUT_DIR / "weekly_merged.csv", index=False)
    month_m.to_csv(OUTPUT_DIR / "monthly_merged.csv", index=False)
    print(f"  Weekly overlap: {len(week_m)}  |  Monthly overlap: {len(month_m)}")

    print("\nSTEP 6 — Weekly correlations (lagged 0-4 weeks)")
    corr_w = correlations(week_m)
    corr_w.to_csv(OUTPUT_DIR / "correlations_weekly.csv", index=False)
    print(corr_w.head(12).to_string(index=False))

    print("\nSTEP 6b — Monthly correlations (lag 0)")
    corr_m = correlations(month_m, lags=(0,))
    corr_m.to_csv(OUTPUT_DIR / "correlations_monthly.csv", index=False)
    print(corr_m.head(12).to_string(index=False))

    print("\nSTEP 7 — Month-adjusted weekly correlations (seasonality removed)")
    adj = month_adjusted(week_m)
    adj.to_csv(OUTPUT_DIR / "correlations_month_adjusted.csv", index=False)
    print(adj.to_string(index=False))

    print("\nSTEP 8 — Rule-based scenario tests (weekly)")
    scen = scenario_tests(week_m)
    scen.to_csv(OUTPUT_DIR / "scenario_tests.csv", index=False)
    print(scen.to_string(index=False))

    summary = {
        "company": "Dakdekkersbedrijf Peter Ummels (portfolio company 2)",
        "location": f"Brunssum 6442PB ({LAT}, {LON})",
        "date_range": f"{start} .. {end}",
        "transactions": int(len(ledger)),
        "total_revenue_eur": float(ledger["net"].sum()),
        "weeks_analyzed": int(len(week_m)),
        "months_analyzed": int(len(month_m)),
        "strongest_weekly_lag0": corr_w[corr_w["lag_weeks"] == 0].iloc[0].to_dict()
        if len(corr_w) else None,
        "strongest_weekly_any_lag": corr_w.iloc[0].to_dict() if len(corr_w) else None,
        "strongest_month_adjusted": adj.iloc[0].to_dict() if len(adj) else None,
    }
    (OUTPUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, default=str))
    print("\n" + "=" * 64)
    print("SUMMARY")
    print("=" * 64)
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
