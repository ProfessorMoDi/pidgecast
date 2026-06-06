"""Visualize weather vs Gilde income correlation analysis."""

from __future__ import annotations

from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "analysis" / "output"
OUTPUT.mkdir(parents=True, exist_ok=True)

MONTHS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"]

plt.rcParams.update(
    {
        "figure.facecolor": "#fafafa",
        "axes.facecolor": "#ffffff",
        "axes.edgecolor": "#cccccc",
        "axes.labelcolor": "#333333",
        "text.color": "#222222",
        "font.size": 10,
        "axes.titlesize": 12,
        "axes.titleweight": "bold",
    }
)


def load_data() -> pd.DataFrame:
    merged = pd.read_csv(OUTPUT / "weekly_merged.csv", parse_dates=["week_start"])
    monthly_mean = merged.groupby("month")["revenue"].transform("mean")
    merged["revenue_deseason"] = merged["revenue"] - monthly_mean
    return merged


def plot_dashboard(merged: pd.DataFrame) -> None:
    fig = plt.figure(figsize=(14, 16))
    gs = fig.add_gridspec(4, 2, hspace=0.38, wspace=0.28)

    # ── 1. Time series: revenue + rain ──────────────────────────────
    ax1 = fig.add_subplot(gs[0, :])
    ax1r = ax1.twinx()
    ax1.fill_between(merged["week_start"], merged["revenue"], alpha=0.25, color="#2563eb", label="Weekly revenue")
    ax1.plot(merged["week_start"], merged["revenue"], color="#2563eb", linewidth=1.2)
    ax1r.bar(merged["week_start"], merged["rain_days"], width=5, alpha=0.35, color="#64748b", label="Rain days")
    ax1.set_ylabel("Revenue (€)", color="#2563eb")
    ax1r.set_ylabel("Rain days / week", color="#64748b")
    ax1.set_title("1 · Weekly Gilde revenue vs rain days (2023–2026)")
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"€{x/1000:.0f}k"))
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax1.tick_params(axis="y", labelcolor="#2563eb")
    ax1r.tick_params(axis="y", labelcolor="#64748b")
    ax1.grid(True, alpha=0.3)

    # ── 2. Seasonality: avg revenue & frost by month ────────────────
    ax2 = fig.add_subplot(gs[1, 0])
    monthly = merged.groupby("month").agg(
        revenue=("revenue", "mean"),
        frost=("frost_days", "mean"),
        rain=("rain_days", "mean"),
    )
    x = np.arange(12)
    bars = ax2.bar(x, monthly["revenue"], color="#2563eb", alpha=0.85, label="Avg weekly revenue")
    ax2.set_xticks(x)
    ax2.set_xticklabels(MONTHS, rotation=45, ha="right")
    ax2.set_ylabel("Avg weekly revenue (€)")
    ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f"€{x/1000:.0f}k"))
    ax2b = ax2.twinx()
    ax2b.plot(x, monthly["frost"], color="#dc2626", marker="o", linewidth=2, label="Frost days/week")
    ax2b.set_ylabel("Frost days / week", color="#dc2626")
    ax2b.tick_params(axis="y", labelcolor="#dc2626")
    ax2.set_title("2 · Seasonality drives both metrics")
    ax2.grid(True, axis="y", alpha=0.3)

    # ── 3. Misleading scatter: frost vs revenue (raw) ───────────────
    ax3 = fig.add_subplot(gs[1, 1])
    ax3.scatter(merged["frost_days"], merged["revenue"] / 1000, alpha=0.55, c="#dc2626", s=40, edgecolors="white", linewidth=0.4)
    r, p = stats.pearsonr(merged["frost_days"], merged["revenue"])
    z = np.polyfit(merged["frost_days"], merged["revenue"] / 1000, 1)
    xs = np.linspace(0, merged["frost_days"].max(), 50)
    ax3.plot(xs, np.poly1d(z)(xs), color="#991b1b", linewidth=2, linestyle="--")
    ax3.set_xlabel("Frost days / week")
    ax3.set_ylabel("Revenue (€ thousands)")
    ax3.set_title(f"3 · Frost vs revenue (misleading)\nr = {r:.2f}, p = {p:.4f}")
    ax3.grid(True, alpha=0.3)

    # ── 4. Honest scatter: rain vs deseasonalized revenue ───────────
    ax4 = fig.add_subplot(gs[2, 0])
    ax4.scatter(
        merged["rain_days"],
        merged["revenue_deseason"] / 1000,
        alpha=0.55,
        c="#059669",
        s=40,
        edgecolors="white",
        linewidth=0.4,
    )
    r2, p2 = stats.pearsonr(merged["rain_days"], merged["revenue_deseason"])
    ax4.axhline(0, color="#94a3b8", linewidth=1, linestyle="-")
    ax4.set_xlabel("Rain days / week")
    ax4.set_ylabel("Revenue minus monthly avg (€ thousands)")
    ax4.set_title(f"4 · Rain vs season-adjusted revenue\nr = {r2:.2f}, p = {p2:.2f}  →  no signal")
    ax4.grid(True, alpha=0.3)

    # ── 5. Lag correlation bars ─────────────────────────────────────
    ax5 = fig.add_subplot(gs[2, 1])
    corr = pd.read_csv(OUTPUT / "correlations.csv")
    rain_lags = corr[corr["weather_metric"] == "rain_days"].sort_values("lag_weeks")
    frost_lags = corr[corr["weather_metric"] == "frost_days"].sort_values("lag_weeks")
    lag_labels = [f"{int(l)}w" for l in rain_lags["lag_weeks"]]
    x5 = np.arange(len(lag_labels))
    w = 0.35
    ax5.bar(x5 - w / 2, rain_lags["pearson_r"], w, label="Rain days", color="#64748b", alpha=0.9)
    ax5.bar(x5 + w / 2, frost_lags["pearson_r"], w, label="Frost days", color="#dc2626", alpha=0.9)
    ax5.axhline(0, color="#333", linewidth=0.8)
    ax5.set_xticks(x5)
    ax5.set_xticklabels([f"lag {l}" for l in lag_labels])
    ax5.set_ylabel("Pearson r")
    ax5.set_title("5 · Correlation by lag (weeks)")
    ax5.legend(loc="lower right", framealpha=0.9)
    ax5.grid(True, axis="y", alpha=0.3)

    # ── 6. Monthly revenue heatmap by year ──────────────────────────
    ax6 = fig.add_subplot(gs[3, 0])
    pivot = merged.groupby(["year", "month"])["revenue"].sum().unstack(fill_value=0) / 1000
    im = ax6.imshow(pivot.values, aspect="auto", cmap="Blues")
    ax6.set_yticks(range(len(pivot.index)))
    ax6.set_yticklabels(pivot.index.astype(int))
    ax6.set_xticks(range(12))
    ax6.set_xticklabels(MONTHS, rotation=45, ha="right")
    ax6.set_title("6 · Monthly revenue (€ thousands) — seasonal pattern")
    plt.colorbar(im, ax=ax6, label="€ thousands")

    # ── 7. Forward lag: rain → future revenue ───────────────────────
    ax7 = fig.add_subplot(gs[3, 1])
    forward_rows = []
    for lag in range(0, 13):
        s = merged.copy()
        s["rev_fwd"] = s["revenue"].shift(-lag)
        valid = s[["rain_days", "rev_fwd"]].dropna()
        if len(valid) < 10:
            continue
        r, p = stats.spearmanr(valid["rain_days"], valid["rev_fwd"])
        forward_rows.append({"lag": lag, "r": r, "p": p})
    fwd = pd.DataFrame(forward_rows)
    colors = ["#059669" if p >= 0.05 else "#2563eb" for p in fwd["p"]]
    ax7.bar(fwd["lag"], fwd["r"], color=colors, alpha=0.85)
    ax7.axhline(0, color="#333", linewidth=0.8)
    ax7.set_xlabel("Weeks forward (rain today → revenue later)")
    ax7.set_ylabel("Spearman r")
    ax7.set_title("7 · Forward lag — no sustained effect")
    ax7.grid(True, axis="y", alpha=0.3)

    fig.suptitle(
        "Gilde ledger · Weather vs income · Valkenswaard (Open-Meteo)\n"
        "172 weeks · €44.4M revenue · Frost correlation = seasonality, not causation",
        fontsize=14,
        fontweight="bold",
        y=0.995,
    )

    out = OUTPUT / "weather_income_dashboard.png"
    fig.savefig(out, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"Saved: {out}")


def plot_simple_scatter(merged: pd.DataFrame) -> None:
    """Single clean chart for presentations."""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # Raw
    ax = axes[0]
    ax.scatter(merged["rain_days"], merged["revenue"] / 1000, alpha=0.6, c="#2563eb", s=50)
    r, p = stats.pearsonr(merged["rain_days"], merged["revenue"])
    ax.set_xlabel("Rain days per week")
    ax.set_ylabel("Weekly revenue (€ thousands)")
    ax.set_title(f"Raw: rain vs revenue\nr = {r:.2f}, p = {p:.2f}")
    ax.grid(True, alpha=0.3)

    # Adjusted
    ax = axes[1]
    ax.scatter(merged["rain_days"], merged["revenue_deseason"] / 1000, alpha=0.6, c="#059669", s=50)
    r, p = stats.pearsonr(merged["rain_days"], merged["revenue_deseason"])
    ax.axhline(0, color="#94a3b8", linewidth=1)
    ax.set_xlabel("Rain days per week")
    ax.set_ylabel("Revenue − monthly average (€ thousands)")
    ax.set_title(f"Season-adjusted: rain vs revenue\nr = {r:.2f}, p = {p:.2f}")
    ax.grid(True, alpha=0.3)

    fig.suptitle("Does rain affect Gilde income?", fontsize=13, fontweight="bold")
    out = OUTPUT / "weather_income_scatter.png"
    fig.savefig(out, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out}")


if __name__ == "__main__":
    data = load_data()
    if not (OUTPUT / "weekly_merged.csv").exists():
        raise SystemExit("Run weather_income_correlation.py first.")
    plot_dashboard(data)
    plot_simple_scatter(data)
