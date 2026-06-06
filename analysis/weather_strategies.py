"""
Weather vs revenue — strategy battery for the roofing portfolio companies.

We have NO work-execution date or labour-hours field anywhere; every source is
invoice/booking-date financial data. Invoice dates lag (and cluster away from)
the weather-dependent work, which is why naive same-week correlations mostly
reflect seasonality. This script tries many strategies designed to work around
that limitation and to squeeze out a *meaningful* weather signal:

  S1. Fixed-effects OLS         revenue ~ weather + month FE + year FE + trend
                                 (HAC/Newey-West robust SE)  -> isolates weather
  S2. Distributed-lag windows   trailing 2/3/4-week cumulative weather -> revenue
  S3. Wide forward-lag scan     weather(t) -> revenue(t+0..+8) to locate the lag
  S4. Deseasonalized+detrended  remove month means & growth trend, then correlate
  S5. Activity proxies          invoice counts / active days (not € amount)
  S6. Extreme-event study       worst-decile weather weeks vs the rest
  S7. Pooled 2-company panel     company FE + month FE within estimator (more power)

Companies (shared southern-NL weather, ~35 km apart):
  - Gilde GB           Valkenswaard  (51.350, 5.460)
  - Peter Ummels       Brunssum      (50.947, 5.972)
"""

from __future__ import annotations

import glob
import json
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "analysis" / "output_strategies"
OUT.mkdir(parents=True, exist_ok=True)

HEADER_ROW = 12

COMPANIES = {
    "ummels": {
        "name": "Peter Ummels (Brunssum)",
        "dir": ROOT / "portfolio company 2 data",
        "lat": 50.947, "lon": 5.972,
        "loader": "ummels",
    },
    "gilde": {
        "name": "Gilde GB (Valkenswaard)",
        "dir": ROOT / "portfolio company data",
        "lat": 51.350, "lon": 5.460,
        "loader": "gilde",
    },
}


# ---------------------------------------------------------------- loaders
def _account_of(path: str) -> str:
    raw = pd.read_excel(path, sheet_name=0, header=None, nrows=HEADER_ROW)
    for i in range(len(raw)):
        row = [str(c) for c in raw.iloc[i].tolist()]
        if "Grootboekrekening" in row:
            return row[row.index("Grootboekrekening") + 1].split(" - ")[0].strip()
    return "?"


def load_ummels(d: Path) -> pd.DataFrame:
    frames = []
    for f in sorted(glob.glob(str(d / "*.xlsx"))):
        acct = _account_of(f)
        df = pd.read_excel(f, sheet_name=0, header=HEADER_ROW)
        df = df[pd.to_numeric(df["Nr."], errors="coerce").notna()].copy()
        df["account"] = acct
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    df = df.drop_duplicates(subset=["account", "Bkst.nr.", "Datum", "Debet", "Credit"])
    df["Datum"] = pd.to_datetime(df["Datum"])
    df["net"] = df["Credit"].fillna(0) - df["Debet"].fillna(0)
    return df[df["net"] != 0][["Datum", "net"]].copy()


def load_gilde(d: Path) -> pd.DataFrame:
    frames = [pd.read_excel(f) for f in sorted(glob.glob(str(d / "*.xlsx")))]
    df = pd.concat(frames, ignore_index=True)
    df["Datum"] = pd.to_datetime(df["Datum"])
    df["net"] = df["Credit"].fillna(0) - df["Debet"].fillna(0)
    return df[df["net"] != 0][["Datum", "net"]].copy()


def weekly_revenue(tx: pd.DataFrame) -> pd.DataFrame:
    tx = tx.copy()
    tx["week_start"] = tx["Datum"].dt.to_period("W-SUN").apply(lambda p: p.start_time)
    return (
        tx.groupby("week_start", as_index=False)
        .agg(revenue=("net", "sum"), invoice_lines=("net", "count"),
             active_days=("Datum", lambda s: s.dt.date.nunique()))
        .sort_values("week_start")
        .reset_index(drop=True)
    )


# ---------------------------------------------------------------- weather
def fetch_weather(lat: float, lon: float, start: str, end: str, tag: str) -> pd.DataFrame:
    cache = OUT / f"weather_{tag}.csv"
    if cache.exists():
        return pd.read_csv(cache, parse_dates=["date"])
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat, "longitude": lon, "start_date": start, "end_date": end,
        "daily": ["precipitation_sum", "rain_sum", "snowfall_sum",
                  "temperature_2m_mean", "temperature_2m_max", "temperature_2m_min",
                  "windspeed_10m_max", "windgusts_10m_max"],
        "timezone": "Europe/Amsterdam",
    }
    d = requests.get(url, params=params, timeout=60).json()["daily"]
    w = pd.DataFrame({
        "date": pd.to_datetime(d["time"]),
        "rain_mm": d["rain_sum"], "precip_mm": d["precipitation_sum"],
        "snow_mm": d["snowfall_sum"], "temp_mean_c": d["temperature_2m_mean"],
        "temp_max_c": d["temperature_2m_max"], "temp_min_c": d["temperature_2m_min"],
        "wind_max_kmh": d["windspeed_10m_max"], "gust_max_kmh": d["windgusts_10m_max"],
    })
    w.to_csv(cache, index=False)
    return w


def weekly_weather(w: pd.DataFrame) -> pd.DataFrame:
    w = w.copy()
    w["rain_day"] = w["rain_mm"] >= 1.0
    w["heavy_rain_day"] = w["rain_mm"] >= 5.0
    w["frost_day"] = w["temp_min_c"] <= 0.0
    w["cold_day"] = w["temp_mean_c"] <= 5.0
    w["heat_day"] = w["temp_max_c"] >= 28.0
    w["windy_day"] = w["wind_max_kmh"] >= 40.0
    w["bad_day"] = w["rain_day"] | w["frost_day"] | w["heat_day"] | w["windy_day"]
    w["workable_day"] = ~w["bad_day"]
    w["week_start"] = w["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)
    return (
        w.groupby("week_start", as_index=False)
        .agg(rain_mm=("rain_mm", "sum"), rain_days=("rain_day", "sum"),
             heavy_rain_days=("heavy_rain_day", "sum"), frost_days=("frost_day", "sum"),
             cold_days=("cold_day", "sum"), heat_days=("heat_day", "sum"),
             windy_days=("windy_day", "sum"), bad_days=("bad_day", "sum"),
             workable_days=("workable_day", "sum"), temp_mean_c=("temp_mean_c", "mean"))
    )


WX = ["rain_mm", "rain_days", "heavy_rain_days", "frost_days", "cold_days",
      "heat_days", "windy_days", "workable_days", "temp_mean_c"]


def build_panel(key: str) -> pd.DataFrame:
    cfg = COMPANIES[key]
    tx = (load_ummels if cfg["loader"] == "ummels" else load_gilde)(cfg["dir"])
    rev = weekly_revenue(tx)
    start = tx["Datum"].min().strftime("%Y-%m-%d")
    end = tx["Datum"].max().strftime("%Y-%m-%d")
    wx = weekly_weather(fetch_weather(cfg["lat"], cfg["lon"], start, end, key))
    m = rev.merge(wx, on="week_start", how="inner")
    m["company"] = key
    m["month"] = m["week_start"].dt.month
    m["year"] = m["week_start"].dt.year
    m["t"] = np.arange(len(m))
    m["log_rev"] = np.log(m["revenue"].clip(lower=1))
    return m


# ---------------------------------------------------------------- strategies
def s1_fixed_effects(m: pd.DataFrame, label: str) -> list[dict]:
    """OLS: log revenue ~ weather + month FE + year FE + linear trend, HAC SE."""
    rows = []
    base = "log_rev ~ C(month) + C(year) + t"
    for col in WX:
        model = smf.ols(f"{base} + {col}", data=m).fit(
            cov_type="HAC", cov_kwds={"maxlags": 4})
        rows.append({
            "strategy": "S1_fixed_effects", "label": label, "weather_metric": col,
            "coef": model.params[col], "p": model.pvalues[col],
            "pct_per_unit": 100 * (np.exp(model.params[col]) - 1),
            "r2": model.rsquared,
        })
    return sorted(rows, key=lambda r: r["p"])


def s2_distributed_lag(m: pd.DataFrame, label: str) -> list[dict]:
    """Trailing cumulative weather windows (work accumulates, invoices follow)."""
    rows = []
    m = m.copy()
    for col in ["frost_days", "rain_days", "heavy_rain_days", "workable_days", "bad_days"]:
        if col not in m:
            continue
        for win in (2, 3, 4):
            m[f"{col}_roll{win}"] = m[col].rolling(win).sum()
            # control for season: correlate residual after month mean
            sub = m.dropna(subset=[f"{col}_roll{win}"]).copy()
            sub["rev_adj"] = sub["revenue"] - sub.groupby("month")["revenue"].transform("mean")
            sub["wx_adj"] = sub[f"{col}_roll{win}"] - sub.groupby("month")[f"{col}_roll{win}"].transform("mean")
            r, p = stats.pearsonr(sub["wx_adj"], sub["rev_adj"])
            rows.append({"strategy": "S2_distributed_lag", "label": label,
                         "weather_metric": f"{col}_roll{win}w", "r_season_adj": r, "p": p, "n": len(sub)})
    return sorted(rows, key=lambda r: r["p"])


def s3_forward_lag(m: pd.DataFrame, label: str) -> list[dict]:
    """weather(t) -> revenue(t+lag); deseasonalized to avoid winter artefact."""
    rows = []
    m = m.copy()
    m["rev_adj"] = m["revenue"] - m.groupby("month")["revenue"].transform("mean")
    for col in ["frost_days", "rain_days", "workable_days", "heat_days"]:
        for lag in range(0, 9):
            s = m.copy()
            s["rev_fwd"] = s["rev_adj"].shift(-lag)
            v = s[[col, "rev_fwd"]].dropna()
            if len(v) < 20:
                continue
            r, p = stats.spearmanr(v[col], v["rev_fwd"])
            rows.append({"strategy": "S3_forward_lag", "label": label,
                         "weather_metric": col, "lag_weeks": lag, "r": r, "p": p})
    return sorted(rows, key=lambda r: r["p"])


def s4_deseason_detrend(m: pd.DataFrame, label: str) -> list[dict]:
    """Remove month means AND linear growth trend from both sides, then correlate."""
    rows = []
    m = m.copy()
    # detrend revenue on t, then strip month mean of residual
    trend = sm.OLS(m["revenue"], sm.add_constant(m["t"])).fit()
    m["rev_dt"] = trend.resid
    m["rev_res"] = m["rev_dt"] - m.groupby("month")["rev_dt"].transform("mean")
    for col in WX:
        m["wx_res"] = m[col] - m.groupby("month")[col].transform("mean")
        r, p = stats.pearsonr(m["wx_res"], m["rev_res"])
        rows.append({"strategy": "S4_deseason_detrend", "label": label,
                     "weather_metric": col, "r": r, "p": p})
    return sorted(rows, key=lambda r: r["p"])


def s5_activity_proxies(m: pd.DataFrame, label: str) -> list[dict]:
    """Use invoice counts & active days (less skewed by big projects than €)."""
    rows = []
    m = m.copy()
    for target in ["invoice_lines", "active_days"]:
        m[f"{target}_adj"] = m[target] - m.groupby("month")[target].transform("mean")
        for col in ["frost_days", "rain_days", "workable_days", "heat_days", "windy_days"]:
            m["wx_adj"] = m[col] - m.groupby("month")[col].transform("mean")
            r, p = stats.pearsonr(m["wx_adj"], m[f"{target}_adj"])
            rows.append({"strategy": "S5_activity", "label": label, "target": target,
                         "weather_metric": col, "r_season_adj": r, "p": p})
    return sorted(rows, key=lambda r: r["p"])


def s6_extreme_events(m: pd.DataFrame, label: str) -> list[dict]:
    """Worst-decile weather weeks vs the rest (deseasonalized revenue)."""
    rows = []
    m = m.copy()
    m["rev_adj"] = m["revenue"] - m.groupby("month")["revenue"].transform("mean")
    for col, hi in [("frost_days", True), ("rain_mm", True), ("heat_days", True),
                    ("windy_days", True), ("workable_days", False)]:
        thr = m[col].quantile(0.9 if hi else 0.1)
        # for sparse counts (mostly zeros) a quantile can be degenerate; use >0
        if hi and thr <= 0:
            mask = m[col] > 0
        else:
            mask = (m[col] >= thr) if hi else (m[col] <= thr)
        a, b = m[mask]["rev_adj"], m[~mask]["rev_adj"]
        if len(a) < 8 or len(b) < 8:
            continue
        u, p = stats.mannwhitneyu(a, b, alternative="two-sided")
        rows.append({"strategy": "S6_extreme", "label": label, "weather_metric": col,
                     "n_extreme": int(len(a)),
                     "rev_gap_eur": round(a.median() - b.median()),
                     "p": round(p, 4)})
    return sorted(rows, key=lambda r: r["p"])


def s7_panel(panels: dict) -> list[dict]:
    """Pooled 2-company within estimator: company FE + month FE + year FE."""
    pooled = pd.concat(panels.values(), ignore_index=True)
    rows = []
    base = "log_rev ~ C(company) + C(month) + C(year)"
    for col in WX:
        # HAC (Newey-West) — 2 companies is too few clusters for clustered SE
        model = smf.ols(f"{base} + {col}", data=pooled).fit(
            cov_type="HAC", cov_kwds={"maxlags": 4})
        rows.append({"strategy": "S7_panel", "label": "POOLED(2)", "weather_metric": col,
                     "coef": model.params[col], "p": model.pvalues[col],
                     "pct_per_unit": 100 * (np.exp(model.params[col]) - 1),
                     "n": int(model.nobs)})
    return sorted(rows, key=lambda r: r["p"])


def show(title: str, rows: list[dict], n: int = 8) -> None:
    print(f"\n{'='*70}\n{title}\n{'='*70}")
    df = pd.DataFrame(rows)
    with pd.option_context("display.float_format", lambda v: f"{v:.4f}"):
        print(df.head(n).to_string(index=False))


def main() -> None:
    panels = {k: build_panel(k) for k in COMPANIES}
    for k, m in panels.items():
        m.to_csv(OUT / f"panel_{k}.csv", index=False)
        print(f"{COMPANIES[k]['name']:32s} weeks={len(m):3d}  "
              f"revenue=€{m['revenue'].sum()/1e6:5.1f}M")

    all_results = {}
    for k, m in panels.items():
        lbl = COMPANIES[k]["name"]
        all_results[f"S1_{k}"] = s1_fixed_effects(m, lbl)
        all_results[f"S2_{k}"] = s2_distributed_lag(m, lbl)
        all_results[f"S3_{k}"] = s3_forward_lag(m, lbl)
        all_results[f"S4_{k}"] = s4_deseason_detrend(m, lbl)
        all_results[f"S5_{k}"] = s5_activity_proxies(m, lbl)
        all_results[f"S6_{k}"] = s6_extreme_events(m, lbl)
    all_results["S7_panel"] = s7_panel(panels)

    # Print the most informative views
    for k in COMPANIES:
        show(f"S1 · Fixed-effects OLS (log revenue, HAC SE) — {COMPANIES[k]['name']}",
             all_results[f"S1_{k}"])
    show("S2 · Distributed-lag trailing windows — Ummels", all_results["S2_ummels"])
    show("S3 · Forward-lag scan (deseasonalized) — Ummels", all_results["S3_ummels"], 6)
    for k in COMPANIES:
        show(f"S4 · Deseasonalized + detrended — {COMPANIES[k]['name']}", all_results[f"S4_{k}"])
    show("S5 · Activity proxies (counts) — Ummels", all_results["S5_ummels"])
    for k in COMPANIES:
        show(f"S6 · Extreme-weather event study — {COMPANIES[k]['name']}", all_results[f"S6_{k}"])
    show("S7 · POOLED 2-company panel (company+month+year FE, HAC robust SE)",
         all_results["S7_panel"])

    # persist everything
    flat = [r for rows in all_results.values() for r in rows]
    pd.DataFrame(flat).to_csv(OUT / "all_strategy_results.csv", index=False)
    (OUT / "all_strategy_results.json").write_text(json.dumps(all_results, indent=2, default=str))
    print(f"\nSaved full results -> {OUT/'all_strategy_results.csv'}")


if __name__ == "__main__":
    main()
