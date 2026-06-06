"""
Weather-aware weekly revenue forecaster.

Model (per company), fit on 2023-2026 weekly data:
    log(revenue) ~ C(month) + linear_trend(t) + workable_days

  - C(month)        : seasonality (the dominant driver)
  - linear_trend    : company growth over time
  - workable_days   : the one robust weather effect (≈ +11-14% per extra day)

Use it two ways:
  1. forecast(company, date, daily_weather)  -> expected revenue + 80% band
  2. as a CLI demo that back-tests in-sample fit and shows a worked example.

`daily_weather` is a list of per-day dicts (rain_mm, temp_min_c, temp_max_c,
wind_max_kmh) for the target week; we derive workable_days from the same
thresholds used throughout the analysis. You can feed a real weather forecast.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / "analysis" / "output_strategies"
OUT = ROOT / "analysis" / "output_forecast"
OUT.mkdir(parents=True, exist_ok=True)

PANELS = {
    "ummels": ("Peter Ummels (Brunssum)", S / "panel_ummels.csv"),
    "gilde": ("Gilde GB (Valkenswaard)", S / "panel_gilde.csv"),
}


def workable_days_from_forecast(days: list[dict]) -> int:
    """Apply the project's 'can't work' thresholds to a list of daily weather."""
    n = 0
    for d in days:
        bad = (d.get("rain_mm", 0) >= 1.0 or d.get("temp_min_c", 99) <= 0.0
               or d.get("temp_max_c", -99) >= 28.0 or d.get("wind_max_kmh", 0) >= 40.0)
        if not bad:
            n += 1
    return n


def _monthly_panel(path: Path) -> pd.DataFrame:
    """Aggregate the weekly panel to calendar months (far less invoice noise)."""
    w = pd.read_csv(path, parse_dates=["week_start"])
    w["month_start"] = w["week_start"].dt.to_period("M").apply(lambda p: p.start_time)
    g = (w.groupby("month_start", as_index=False)
         .agg(revenue=("revenue", "sum"), workable_days=("workable_days", "sum"),
              frost_days=("frost_days", "sum"), rain_days=("rain_days", "sum")))
    g = g.sort_values("month_start").reset_index(drop=True)
    g["month"] = g["month_start"].dt.month
    g["t"] = np.arange(len(g))
    g["log_rev"] = np.log(g["revenue"].clip(lower=1))
    return g


@dataclass
class Forecaster:
    company: str
    label: str
    model: object
    t_max: int
    week0: pd.Timestamp
    resid_sd: float       # sd of log residuals -> prediction band
    freq: str = "weekly"  # 'weekly' or 'monthly'
    r2: float = 0.0

    @classmethod
    def fit(cls, key: str, freq: str = "weekly") -> "Forecaster":
        label, path = PANELS[key]
        if freq == "monthly":
            m = _monthly_panel(path)
            anchor = m["month_start"].min()
        else:
            m = pd.read_csv(path, parse_dates=["week_start"])
            anchor = m["week_start"].min()
        model = smf.ols("log_rev ~ C(month) + t + workable_days", data=m).fit()
        return cls(company=key, label=label, model=model, t_max=int(m["t"].max()),
                   week0=anchor, resid_sd=float(np.std(model.resid)),
                   freq=freq, r2=float(model.rsquared))

    def _t_for(self, date: pd.Timestamp) -> int:
        if self.freq == "monthly":
            return (date.year - self.week0.year) * 12 + (date.month - self.week0.month)
        return int(round((date - self.week0).days / 7))

    def forecast(self, date, workable_days: int) -> dict:
        date = pd.Timestamp(date)
        t = self._t_for(date)
        x = pd.DataFrame({"month": [date.month], "t": [t], "workable_days": [workable_days]})
        log_pred = float(self.model.predict(x).iloc[0])
        point = float(np.exp(log_pred))
        lo = float(np.exp(log_pred - 1.28 * self.resid_sd))   # ~80% band
        hi = float(np.exp(log_pred + 1.28 * self.resid_sd))
        # marginal weather effect: revenue if this had been a perfect (7) vs washed-out (0) week
        coef = self.model.params["workable_days"]
        per_day_pct = 100 * (np.exp(coef) - 1)
        return {"company": self.label, "week_of": date.date(), "workable_days": workable_days,
                "expected_revenue": round(point), "low80": round(lo), "high80": round(hi),
                "extrapolated": t > self.t_max, "pct_per_workable_day": round(per_day_pct, 1)}


def plot_fit(key: str, freq: str = "monthly") -> None:
    f = Forecaster.fit(key, freq)
    label, path = PANELS[key]
    m = _monthly_panel(path) if freq == "monthly" else pd.read_csv(path, parse_dates=["week_start"])
    xcol = "month_start" if freq == "monthly" else "week_start"
    m["pred"] = np.exp(f.model.predict(m))
    div = 1000

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 9), height_ratios=[2, 1])
    ax1.plot(m[xcol], m["revenue"] / div, color="#94a3b8", linewidth=1.3, marker=".", label="Actual")
    ax1.plot(m[xcol], m["pred"] / div, color="#2563eb", linewidth=1.8, label="Model (season+trend+weather)")
    bandlo = np.exp(np.log(m["pred"]) - 1.28 * f.resid_sd) / div
    bandhi = np.exp(np.log(m["pred"]) + 1.28 * f.resid_sd) / div
    ax1.fill_between(m[xcol], bandlo, bandhi, alpha=0.15, color="#2563eb", label="80% band")
    ax1.set_ylabel(f"{freq.title()} revenue (€k)")
    ax1.set_title(f"Weather-aware revenue model ({freq}) — {label}   (R²={f.r2:.2f}, "
                  f"+{round(100*(np.exp(f.model.params['workable_days'])-1),1)}% per workable day)")
    ax1.legend(ncol=3, fontsize=9); ax1.grid(True, alpha=0.3)
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))

    typ = m["workable_days"].median()
    base = m.copy(); base["workable_days"] = typ
    m["weather_delta"] = (np.exp(f.model.predict(m)) - np.exp(f.model.predict(base))) / div
    colors = np.where(m["weather_delta"] >= 0, "#059669", "#dc2626")
    ax2.bar(m[xcol], m["weather_delta"], width=20 if freq == "monthly" else 5, color=colors, alpha=0.8)
    ax2.axhline(0, color="#1e293b", linewidth=0.8)
    ax2.set_ylabel("Weather effect (€k)")
    ax2.set_title(f"Isolated weather contribution vs a typical {freq[:-2]} ({typ:.0f} workable days)")
    ax2.grid(True, axis="y", alpha=0.3)
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))

    fig.tight_layout()
    out = OUT / f"forecast_fit_{key}_{freq}.png"
    fig.savefig(out, dpi=140, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"Saved: {out}")


def _month_of_weather(workable_target: int, total_days: int = 30) -> list[dict]:
    """Synthesize a month with a given number of workable days."""
    good = {"rain_mm": 0, "temp_min_c": 8, "temp_max_c": 20, "wind_max_kmh": 15}
    bad = {"rain_mm": 6, "temp_min_c": 4, "temp_max_c": 14, "wind_max_kmh": 20}
    return [good] * workable_target + [bad] * (total_days - workable_target)


def main() -> None:
    # MONTHLY worked example: a good vs poor weather month, both companies
    target = "2026-07-01"
    print("=" * 70)
    print("WORKED EXAMPLE — MONTHLY forecast for", target, "(primary resolution)")
    print("=" * 70)
    rows = []
    for key in PANELS:
        f = Forecaster.fit(key, "monthly")
        for name, wdays in [("GOOD month (24 workable days)", 24),
                            ("POOR month (14 workable days)", 14)]:
            r = f.forecast(target, wdays)
            r["scenario"] = name
            rows.append(r)
    rep = pd.DataFrame(rows)[["company", "scenario", "workable_days",
                              "expected_revenue", "low80", "high80",
                              "pct_per_workable_day", "extrapolated"]]
    print(rep.to_string(index=False))
    rep.to_csv(OUT / "forecast_example_monthly.csv", index=False)

    # also keep a weekly example for completeness
    wk = []
    for key in PANELS:
        f = Forecaster.fit(key, "weekly")
        for name, wd in [("GOOD week (7)", 7), ("BAD week (2)", 2)]:
            r = f.forecast("2026-07-06", wd); r["scenario"] = name; wk.append(r)
    pd.DataFrame(wk).to_csv(OUT / "forecast_example_weekly.csv", index=False)

    for key in PANELS:
        plot_fit(key, "monthly")
        plot_fit(key, "weekly")


if __name__ == "__main__":
    main()
