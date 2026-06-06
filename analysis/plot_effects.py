"""
Effects dashboard — visualizes the weather→revenue findings from the strategy
battery (weather_strategies.py) in one place so the effects can be eyeballed.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / "analysis" / "output_strategies"

res = pd.read_csv(S / "all_strategy_results.csv")
ummels = pd.read_csv(S / "panel_ummels.csv", parse_dates=["week_start"])
gilde = pd.read_csv(S / "panel_gilde.csv", parse_dates=["week_start"])

plt.rcParams.update({"figure.facecolor": "#fafafa", "axes.facecolor": "#ffffff",
                     "font.size": 9, "axes.titlesize": 11.5, "axes.titleweight": "bold"})

SIG = "#059669"      # significant p<0.05
NS = "#cbd5e1"       # not significant
NEG = "#dc2626"


def deseason(df, ycol, by="month"):
    return df[ycol] - df.groupby(by)[ycol].transform("mean")


def main() -> None:
    fig = plt.figure(figsize=(16, 19))
    gs = fig.add_gridspec(4, 2, hspace=0.42, wspace=0.24)

    # ── 1. Headline effect sizes: S1 per company + S7 pooled ──────────────
    ax = fig.add_subplot(gs[0, :])
    s1u = res[(res.strategy == "S1_fixed_effects") & (res.label.str.contains("Ummels"))]
    s1g = res[(res.strategy == "S1_fixed_effects") & (res.label.str.contains("Gilde"))]
    s7 = res[res.strategy == "S7_panel"]
    metrics = ["workable_days", "frost_days", "cold_days", "rain_days",
               "heavy_rain_days", "heat_days", "windy_days", "temp_mean_c"]

    def val(df, m):
        r = df[df.weather_metric == m]
        return (r["pct_per_unit"].iloc[0], r["p"].iloc[0]) if len(r) else (np.nan, 1)

    y = np.arange(len(metrics))
    h = 0.26
    for off, df, lbl, mk in [(-h, s1u, "Ummels (S1)", "o"), (0, s1g, "Gilde (S1)", "s"),
                             (h, s7, "Pooled (S7)", "D")]:
        vals = [val(df, m) for m in metrics]
        pcts = [v[0] for v in vals]
        cols = [SIG if v[1] < 0.05 else NS for v in vals]
        bars = ax.barh(y + off, pcts, height=h, color=cols, edgecolor="#475569", linewidth=0.6)
        for yi, (pct, p) in zip(y + off, vals):
            if p < 0.05 and not np.isnan(pct):
                ax.text(pct + (1.5 if pct >= 0 else -1.5), yi, "*", va="center",
                        ha="left" if pct >= 0 else "right", fontweight="bold", color="#065f46")
    ax.set_yticks(y); ax.set_yticklabels(metrics)
    ax.axvline(0, color="#1e293b", linewidth=1)
    ax.set_xlabel("% change in weekly revenue per +1 unit of weather metric (per week)")
    ax.set_title("1 · Effect sizes — fixed-effects regression (green = significant p<0.05, * marks it)\n"
                 "Three bars per metric: Ummels (top) · Gilde (mid) · Pooled (bottom)")
    ax.set_xlim(-40, 40)
    ax.grid(True, axis="x", alpha=0.3)

    # ── 2. Headline relationship: workable days vs season-adj revenue (pooled) ──
    ax = fig.add_subplot(gs[1, 0])
    for df, c, lbl in [(ummels, "#2563eb", "Ummels"), (gilde, "#f59e0b", "Gilde")]:
        ra = deseason(df, "revenue") / 1000
        ax.scatter(df["workable_days"], ra, alpha=0.45, s=28, color=c, label=lbl, edgecolors="white", linewidth=0.3)
    both = pd.concat([
        pd.DataFrame({"x": ummels["workable_days"], "y": deseason(ummels, "revenue") / 1000}),
        pd.DataFrame({"x": gilde["workable_days"], "y": deseason(gilde, "revenue") / 1000})])
    z = np.polyfit(both["x"], both["y"], 1)
    xs = np.linspace(both["x"].min(), both["x"].max(), 50)
    ax.plot(xs, np.poly1d(z)(xs), color="#065f46", linewidth=2.2, linestyle="--")
    r, p = stats.pearsonr(both["x"], both["y"])
    ax.axhline(0, color="#94a3b8", linewidth=1)
    ax.set_xlabel("Workable days / week"); ax.set_ylabel("Revenue − monthly avg (€k)")
    ax.set_title(f"2 · HEADLINE: more workable days → higher revenue\nseason-adjusted · r={r:.2f}, p={p:.3f}")
    ax.legend(fontsize=8); ax.grid(True, alpha=0.3)

    # ── 3. Frost vs season+trend-adjusted revenue (Gilde, the robust one) ──
    ax = fig.add_subplot(gs[1, 1])
    g = gilde.copy()
    g["rev_dt"] = g["revenue"] - np.poly1d(np.polyfit(g["t"], g["revenue"], 1))(g["t"])
    g["rev_res"] = (g["rev_dt"] - g.groupby("month")["rev_dt"].transform("mean")) / 1000
    ax.scatter(g["frost_days"], g["rev_res"], alpha=0.5, s=30, color=NEG, edgecolors="white", linewidth=0.3)
    z = np.polyfit(g["frost_days"], g["rev_res"], 1)
    xs = np.linspace(0, g["frost_days"].max(), 50)
    ax.plot(xs, np.poly1d(z)(xs), color="#7f1d1d", linewidth=2.2, linestyle="--")
    r, p = stats.pearsonr(g["frost_days"], g["rev_res"])
    ax.axhline(0, color="#94a3b8", linewidth=1)
    ax.set_xlabel("Frost days / week"); ax.set_ylabel("Revenue − trend − monthly avg (€k)")
    ax.set_title(f"3 · Frost depresses revenue (Gilde)\nseason+trend-adjusted · r={r:.2f}, p={p:.3f}")
    ax.grid(True, alpha=0.3)

    # ── 4. Forward-lag curve: weather(t) → revenue(t+lag) ──────────────────
    ax = fig.add_subplot(gs[2, 0])
    fl = res[res.strategy == "S3_forward_lag"]
    for m, c in [("workable_days", "#059669"), ("frost_days", NEG),
                 ("rain_days", "#2563eb"), ("heat_days", "#b45309")]:
        sub = fl[(fl.weather_metric == m) & (fl.label.str.contains("Ummels"))].sort_values("lag_weeks")
        ax.plot(sub["lag_weeks"], sub["r"], marker="o", linewidth=1.6, label=m, color=c)
    ax.axhline(0, color="#1e293b", linewidth=0.8)
    ax.set_xlabel("Weeks after weather (invoice delay)"); ax.set_ylabel("Spearman r (deseasonalized)")
    ax.set_title("4 · Forward-lag scan — Ummels (no strong sustained delay)")
    ax.legend(fontsize=8); ax.grid(True, alpha=0.3)

    # ── 5. Distributed-lag trailing windows ───────────────────────────────
    ax = fig.add_subplot(gs[2, 1])
    dl = res[(res.strategy == "S2_distributed_lag") & (res.label.str.contains("Ummels"))].copy()
    dl["base"] = dl["weather_metric"].str.replace(r"_roll\dw", "", regex=True)
    dl["win"] = dl["weather_metric"].str.extract(r"roll(\d)w").astype(int)
    piv = dl.pivot(index="base", columns="win", values="r_season_adj")
    piv = piv.reindex(["frost_days", "workable_days", "rain_days", "heavy_rain_days", "bad_days"])
    x = np.arange(len(piv)); w = 0.25
    for i, win in enumerate(piv.columns):
        ax.bar(x + (i - 1) * w, piv[win], w, label=f"{win}-wk window")
    ax.set_xticks(x); ax.set_xticklabels(piv.index, rotation=20, ha="right")
    ax.axhline(0, color="#1e293b", linewidth=0.8)
    ax.set_ylabel("r (season-adjusted)")
    ax.set_title("5 · Trailing cumulative-weather windows — Ummels")
    ax.legend(fontsize=8); ax.grid(True, axis="y", alpha=0.3)

    # ── 6. Activity proxies (counts) — Ummels ──────────────────────────────
    ax = fig.add_subplot(gs[3, 0])
    ac = res[res.strategy == "S5_activity"].copy()
    ac = ac[ac.target == "active_days"].sort_values("r_season_adj")
    cols = [SIG if p < 0.05 else NS for p in ac["p"]]
    cols = [NEG if (v < 0 and p < 0.05) else c for v, p, c in zip(ac["r_season_adj"], ac["p"], cols)]
    ax.barh(range(len(ac)), ac["r_season_adj"], color=cols, edgecolor="#475569", linewidth=0.6)
    ax.set_yticks(range(len(ac))); ax.set_yticklabels(ac["weather_metric"])
    ax.axvline(0, color="#1e293b", linewidth=0.8)
    ax.set_xlabel("r vs active days/week (season-adjusted)")
    ax.set_title("6 · Activity proxy: weather vs ACTIVE DAYS — Ummels\n(counts track weather better than € amounts)")
    ax.grid(True, axis="x", alpha=0.3)

    # ── 7. Seasonal climatology: workable days vs avg revenue by month ─────
    ax = fig.add_subplot(gs[3, 1])
    mo = ummels.groupby("month").agg(rev=("revenue", "mean"), work=("workable_days", "mean"))
    months = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"]
    x = mo.index.values
    ax.bar(x, mo["rev"] / 1000, color="#2563eb", alpha=0.8, label="Avg weekly revenue")
    ax.set_ylabel("Avg weekly revenue (€k)", color="#2563eb")
    ax.set_xticks(range(1, 13)); ax.set_xticklabels(months, rotation=45, ha="right")
    axr = ax.twinx()
    axr.plot(x, mo["work"], color="#059669", marker="o", linewidth=2, label="Workable days/wk")
    axr.set_ylabel("Workable days / week", color="#059669")
    ax.set_title("7 · Seasonality: revenue & workable days move together — Ummels")
    ax.grid(True, axis="y", alpha=0.3)

    fig.suptitle("Weather → revenue · EFFECTS OVERVIEW · Roofing portfolio (Ummels + Gilde)\n"
                 "Headline: each extra workable day/week ≈ +11–14% revenue · frost/cold drag (mostly seasonal) · rain/heat/wind alone = no clean signal",
                 fontsize=14, fontweight="bold", y=0.997)

    out = S / "weather_effects_dashboard.png"
    fig.savefig(out, dpi=140, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
