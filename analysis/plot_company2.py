"""Visualize weather vs revenue for portfolio company 2 (Peter Ummels, Brunssum)."""

from __future__ import annotations

from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "analysis" / "output_company2"

MONTHS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"]

plt.rcParams.update(
    {
        "figure.facecolor": "#fafafa",
        "axes.facecolor": "#ffffff",
        "axes.edgecolor": "#cccccc",
        "font.size": 10,
        "axes.titlesize": 12,
        "axes.titleweight": "bold",
    }
)


def load_data() -> pd.DataFrame:
    m = pd.read_csv(OUTPUT / "weekly_merged.csv", parse_dates=["week_start"])
    m["month"] = m["week_start"].dt.month
    m["year"] = m["week_start"].dt.year
    m["revenue_deseason"] = m["revenue"] - m.groupby("month")["revenue"].transform("mean")
    return m


def plot_dashboard(m: pd.DataFrame) -> None:
    fig = plt.figure(figsize=(14, 16))
    gs = fig.add_gridspec(4, 2, hspace=0.4, wspace=0.28)

    # 1. Time series: revenue + frost
    ax1 = fig.add_subplot(gs[0, :])
    ax1r = ax1.twinx()
    ax1.fill_between(m["week_start"], m["revenue"], alpha=0.25, color="#2563eb")
    ax1.plot(m["week_start"], m["revenue"], color="#2563eb", linewidth=1.2)
    ax1r.bar(m["week_start"], m["frost_days"], width=5, alpha=0.4, color="#dc2626")
    ax1.set_ylabel("Revenue (€)", color="#2563eb")
    ax1r.set_ylabel("Frost days / week", color="#dc2626")
    ax1.set_title("1 · Weekly revenue vs frost days (2023–2026)")
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"€{x/1000:.0f}k"))
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax1.grid(True, alpha=0.3)

    # 2. Seasonality
    ax2 = fig.add_subplot(gs[1, 0])
    mo = m.groupby("month").agg(revenue=("revenue", "mean"), frost=("frost_days", "mean"))
    x = np.arange(1, 13)
    present = mo.reindex(x)
    ax2.bar(x, present["revenue"], color="#2563eb", alpha=0.85)
    ax2.set_xticks(x)
    ax2.set_xticklabels(MONTHS, rotation=45, ha="right")
    ax2.set_ylabel("Avg weekly revenue (€)")
    ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"€{v/1000:.0f}k"))
    ax2b = ax2.twinx()
    ax2b.plot(x, present["frost"], color="#dc2626", marker="o", linewidth=2)
    ax2b.set_ylabel("Frost days / week", color="#dc2626")
    ax2.set_title("2 · Seasonality: revenue dips in frosty winter")
    ax2.grid(True, axis="y", alpha=0.3)

    # 3. Raw frost scatter
    ax3 = fig.add_subplot(gs[1, 1])
    ax3.scatter(m["frost_days"], m["revenue"] / 1000, alpha=0.55, c="#dc2626", s=40, edgecolors="white", linewidth=0.4)
    r, p = stats.pearsonr(m["frost_days"], m["revenue"])
    z = np.polyfit(m["frost_days"], m["revenue"] / 1000, 1)
    xs = np.linspace(0, m["frost_days"].max(), 50)
    ax3.plot(xs, np.poly1d(z)(xs), color="#991b1b", linewidth=2, linestyle="--")
    ax3.set_xlabel("Frost days / week")
    ax3.set_ylabel("Revenue (€ thousands)")
    ax3.set_title(f"3 · Frost vs revenue (raw)\nr = {r:.2f}, p = {p:.4f}")
    ax3.grid(True, alpha=0.3)

    # 4. Season-adjusted frost scatter
    ax4 = fig.add_subplot(gs[2, 0])
    ax4.scatter(m["frost_days"], m["revenue_deseason"] / 1000, alpha=0.55, c="#059669", s=40, edgecolors="white", linewidth=0.4)
    r2, p2 = stats.pearsonr(m["frost_days"], m["revenue_deseason"])
    ax4.axhline(0, color="#94a3b8", linewidth=1)
    ax4.set_xlabel("Frost days / week")
    ax4.set_ylabel("Revenue − monthly avg (€ thousands)")
    ax4.set_title(f"4 · Frost vs season-adjusted revenue\nr = {r2:.2f}, p = {p2:.2f}")
    ax4.grid(True, alpha=0.3)

    # 5. Correlation by metric (lag 0)
    ax5 = fig.add_subplot(gs[2, 1])
    corr = pd.read_csv(OUTPUT / "correlations_weekly.csv")
    c0 = corr[corr["lag_weeks"] == 0].set_index("weather_metric")["pearson_r"].sort_values()
    colors = ["#dc2626" if v < 0 else "#059669" for v in c0]
    ax5.barh(range(len(c0)), c0.values, color=colors, alpha=0.85)
    ax5.set_yticks(range(len(c0)))
    ax5.set_yticklabels(c0.index)
    ax5.axvline(0, color="#333", linewidth=0.8)
    ax5.set_xlabel("Pearson r (same-week)")
    ax5.set_title("5 · Which weather correlates with revenue")
    ax5.grid(True, axis="x", alpha=0.3)

    # 6. Monthly revenue heatmap
    ax6 = fig.add_subplot(gs[3, 0])
    pivot = m.groupby(["year", "month"])["revenue"].sum().unstack(fill_value=0) / 1000
    im = ax6.imshow(pivot.values, aspect="auto", cmap="Blues")
    ax6.set_yticks(range(len(pivot.index)))
    ax6.set_yticklabels(pivot.index.astype(int))
    ax6.set_xticks(range(len(pivot.columns)))
    ax6.set_xticklabels([MONTHS[c - 1] for c in pivot.columns], rotation=45, ha="right")
    ax6.set_title("6 · Monthly revenue (€ thousands)")
    plt.colorbar(im, ax=ax6, label="€ thousands")

    # 7. Scenario impact bars
    ax7 = fig.add_subplot(gs[3, 1])
    scen = pd.read_csv(OUTPUT / "scenario_tests.csv")
    s0 = scen[scen["lag_weeks"] == 0].copy()
    s0["short"] = s0["scenario"].str.split(" (", regex=False).str[0]
    s0 = s0.sort_values("pct_vs_other")
    colors = ["#dc2626" if sig < 0.05 else "#94a3b8" for sig in s0["mannwhitney_p"]]
    ax7.barh(range(len(s0)), s0["pct_vs_other"], color=colors, alpha=0.9)
    ax7.set_yticks(range(len(s0)))
    ax7.set_yticklabels(s0["short"])
    ax7.axvline(0, color="#333", linewidth=0.8)
    ax7.set_xlabel("Median revenue vs other weeks (%)")
    ax7.set_title("7 · Rule impact (red = significant p<0.05)")
    ax7.grid(True, axis="x", alpha=0.3)

    fig.suptitle(
        "Dakdekkersbedrijf Peter Ummels · Weather vs revenue · Brunssum (Open-Meteo)\n"
        f"{len(m)} weeks · €{m['revenue'].sum()/1e6:.1f}M revenue · Frost/cold = strongest signal (largely seasonal)",
        fontsize=14,
        fontweight="bold",
        y=0.995,
    )
    out = OUTPUT / "weather_income_dashboard.png"
    fig.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"Saved: {out}")


if __name__ == "__main__":
    if not (OUTPUT / "weekly_merged.csv").exists():
        raise SystemExit("Run weather_income_company2.py first.")
    plot_dashboard(load_data())
