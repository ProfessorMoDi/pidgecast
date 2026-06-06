"""
Step-by-step weather vs income correlation analysis.
Ledger: Gilde GB exports (portfolio company data) — single opco, Valkenswaard region.
Weather: Open-Meteo historical archive API.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import requests
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
LEDGER_DIR = ROOT / "portfolio company data"
OUTPUT_DIR = ROOT / "analysis" / "output"

# Valkenswaard — matches dominant city in Gilde G-rekening addresses
LAT, LON = 51.350, 5.460


def step1_load_ledger() -> pd.DataFrame:
    """Load Gilde ledger, compute net revenue per transaction."""
    frames = [pd.read_excel(f) for f in sorted(LEDGER_DIR.glob("*.xlsx"))]
    df = pd.concat(frames, ignore_index=True)
    df["Datum"] = pd.to_datetime(df["Datum"])
    df["net"] = df["Credit"].fillna(0) - df["Debet"].fillna(0)
    # Revenue only: drop zero-net lines and obvious G-rekening paired reversals
    df = df[df["net"] != 0].copy()
    return df


def step2_aggregate_weekly(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate to ISO weeks (billing/income recognition proxy)."""
    df = df.copy()
    df["week_start"] = df["Datum"].dt.to_period("W-SUN").apply(lambda p: p.start_time)
    weekly = (
        df.groupby("week_start", as_index=False)
        .agg(
            revenue=("net", "sum"),
            invoice_lines=("net", "count"),
            active_days=("Datum", lambda s: s.dt.date.nunique()),
        )
        .sort_values("week_start")
    )
    return weekly


def step3_fetch_weather(start: str, end: str) -> pd.DataFrame:
    """Fetch daily weather from Open-Meteo archive."""
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
            "temperature_2m_min",
            "windspeed_10m_max",
        ],
        "timezone": "Europe/Amsterdam",
    }
    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    daily = resp.json()["daily"]
    weather = pd.DataFrame(
        {
            "date": pd.to_datetime(daily["time"]),
            "precip_mm": daily["precipitation_sum"],
            "rain_mm": daily["rain_sum"],
            "snow_mm": daily["snowfall_sum"],
            "temp_mean_c": daily["temperature_2m_mean"],
            "temp_min_c": daily["temperature_2m_min"],
            "wind_max_kmh": daily["windspeed_10m_max"],
        }
    )
    weather["rain_day"] = weather["rain_mm"] >= 1.0
    weather["heavy_rain_day"] = weather["rain_mm"] >= 5.0
    weather["frost_day"] = weather["temp_min_c"] <= 0.0
    weather["cold_day"] = weather["temp_mean_c"] <= 5.0
    return weather


def step4_aggregate_weather_weekly(weather: pd.DataFrame) -> pd.DataFrame:
    """Weekly weather features aligned to same week_start as revenue."""
    w = weather.copy()
    w["week_start"] = w["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)
    weekly = (
        w.groupby("week_start", as_index=False)
        .agg(
            rain_mm=("rain_mm", "sum"),
            precip_mm=("precip_mm", "sum"),
            rain_days=("rain_day", "sum"),
            heavy_rain_days=("heavy_rain_day", "sum"),
            frost_days=("frost_day", "sum"),
            cold_days=("cold_day", "sum"),
            temp_mean_c=("temp_mean_c", "mean"),
            wind_max_kmh=("wind_max_kmh", "max"),
        )
    )
    return weekly


def step5_merge(weekly_rev: pd.DataFrame, weekly_wx: pd.DataFrame) -> pd.DataFrame:
    merged = weekly_rev.merge(weekly_wx, on="week_start", how="inner")
    merged["month"] = merged["week_start"].dt.month
    merged["year"] = merged["week_start"].dt.year
    return merged


def step6_correlations(merged: pd.DataFrame) -> pd.DataFrame:
    """Pearson + Spearman for contemporaneous and lagged weather."""
    wx_cols = [
        "rain_mm",
        "rain_days",
        "heavy_rain_days",
        "frost_days",
        "cold_days",
        "temp_mean_c",
    ]
    rows = []
    for lag in [0, 1, 2, 4]:  # weeks: same week, +1, +2, +4
        frame = merged.copy()
        for col in wx_cols:
            frame[f"{col}_lag{lag}"] = frame[col].shift(lag)
            valid = frame[[f"{col}_lag{lag}", "revenue"]].dropna()
            if len(valid) < 12:
                continue
            pearson_r, pearson_p = stats.pearsonr(valid[f"{col}_lag{lag}"], valid["revenue"])
            spearman_r, spearman_p = stats.spearmanr(valid[f"{col}_lag{lag}"], valid["revenue"])
            rows.append(
                {
                    "weather_metric": col,
                    "lag_weeks": lag,
                    "n_weeks": len(valid),
                    "pearson_r": pearson_r,
                    "pearson_p": pearson_p,
                    "spearman_r": spearman_r,
                    "spearman_p": spearman_p,
                }
            )
    return pd.DataFrame(rows).sort_values("pearson_p")


def step7_seasonality_control(merged: pd.DataFrame) -> dict:
    """Partial picture: correlate weather residuals after removing month fixed effects."""
    df = merged.copy()
    month_dummies = pd.get_dummies(df["month"], prefix="m", drop_first=True)
    y = df["revenue"]
    # Simple: revenue detrended by monthly mean
    monthly_mean = df.groupby("month")["revenue"].transform("mean")
    y_adj = y - monthly_mean

    results = {}
    for col in ["rain_days", "heavy_rain_days", "temp_mean_c"]:
        valid = pd.concat([y_adj, df[col]], axis=1).dropna()
        r, p = stats.pearsonr(valid.iloc[:, 0], valid.iloc[:, 1])
        results[col] = {"r_after_month_adj": r, "p": p}
    return results


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("STEP 1 — Load single ledger (Gilde GB)")
    print("=" * 60)
    ledger = step1_load_ledger()
    print(f"  Transactions: {len(ledger):,}")
    print(f"  Date range: {ledger['Datum'].min().date()} → {ledger['Datum'].max().date()}")
    print(f"  Total net revenue: €{ledger['net'].sum():,.0f}")

    print("\n" + "=" * 60)
    print("STEP 2 — Aggregate income to weekly totals")
    print("=" * 60)
    weekly_rev = step2_aggregate_weekly(ledger)
    print(f"  Weeks: {len(weekly_rev)}")
    print(f"  Median weekly revenue: €{weekly_rev['revenue'].median():,.0f}")

    start = ledger["Datum"].min().strftime("%Y-%m-%d")
    end = ledger["Datum"].max().strftime("%Y-%m-%d")

    print("\n" + "=" * 60)
    print("STEP 3 — Fetch historical weather (Open-Meteo, Valkenswaard)")
    print("=" * 60)
    weather = step3_fetch_weather(start, end)
    print(f"  Daily weather rows: {len(weather)}")
    print(f"  Avg rain days/week will be computed in step 4")

    print("\n" + "=" * 60)
    print("STEP 4 — Aggregate weather to weekly features")
    print("=" * 60)
    weekly_wx = step4_aggregate_weather_weekly(weather)
    print(f"  Weather weeks: {len(weekly_wx)}")

    print("\n" + "=" * 60)
    print("STEP 5 — Merge revenue + weather on week_start")
    print("=" * 60)
    merged = step5_merge(weekly_rev, weekly_wx)
    print(f"  Overlapping weeks: {len(merged)}")
    merged.to_csv(OUTPUT_DIR / "weekly_merged.csv", index=False)

    print("\n" + "=" * 60)
    print("STEP 6 — Correlation (Pearson + Spearman, with lags)")
    print("=" * 60)
    corr = step6_correlations(merged)
    corr.to_csv(OUTPUT_DIR / "correlations.csv", index=False)
    print(corr.head(12).to_string(index=False))

    print("\n" + "=" * 60)
    print("STEP 7 — Seasonality check (month-adjusted revenue vs weather)")
    print("=" * 60)
    adj = step7_seasonality_control(merged)
    print(json.dumps(adj, indent=2))

    # Monthly view — often clearer for roofing seasonality
    monthly = (
        merged.groupby(["year", "month"], as_index=False)
        .agg(revenue=("revenue", "sum"), rain_days=("rain_days", "sum"), temp_mean_c=("temp_mean_c", "mean"))
    )
    monthly.to_csv(OUTPUT_DIR / "monthly_merged.csv", index=False)
    m_corr = monthly[["revenue", "rain_days", "temp_mean_c"]].corr(method="spearman")
    print("\nMonthly Spearman correlation matrix:")
    print(m_corr.to_string())

    # Summary stats
    summary = {
        "ledger": "Gilde GB (portfolio company data)",
        "location": f"Valkenswaard ({LAT}, {LON})",
        "weeks_analyzed": len(merged),
        "strongest_contemporaneous": corr[corr["lag_weeks"] == 0].iloc[0].to_dict() if len(corr) else None,
        "strongest_any_lag": corr.iloc[0].to_dict() if len(corr) else None,
        "monthly_spearman_revenue_vs_rain_days": float(m_corr.loc["revenue", "rain_days"]),
        "monthly_spearman_revenue_vs_temp": float(m_corr.loc["revenue", "temp_mean_c"]),
    }
    (OUTPUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
