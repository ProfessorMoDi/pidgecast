"""
One-page summary report (PDF + PNG) of the weather -> revenue analysis.
Composes the headline finding, key effect chart, the forecast fit, and the
data/assets overview into a single shareable page.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.gridspec import GridSpec
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / "analysis" / "output_strategies"
OUT = ROOT / "analysis"

res = pd.read_csv(S / "all_strategy_results.csv")
ummels = pd.read_csv(S / "panel_ummels.csv", parse_dates=["week_start"])
gilde = pd.read_csv(S / "panel_gilde.csv", parse_dates=["week_start"])

SIG, NS, NEG = "#059669", "#cbd5e1", "#dc2626"
plt.rcParams.update({"font.size": 9})


def deseason(df, c):
    return df[c] - df.groupby("month")[c].transform("mean")


def monthly(df):
    df = df.copy()
    df["ms"] = df["week_start"].dt.to_period("M").apply(lambda p: p.start_time)
    return df.groupby("ms", as_index=False).agg(revenue=("revenue", "sum"),
                                                workable_days=("workable_days", "sum"))


def main() -> None:
    fig = plt.figure(figsize=(11.7, 16.5))  # A3-ish portrait, scales to A4
    fig.patch.set_facecolor("white")
    gs = GridSpec(5, 2, figure=fig, hspace=0.55, wspace=0.22,
                  height_ratios=[0.5, 1.0, 1.1, 1.1, 1.2], top=0.95, bottom=0.04,
                  left=0.07, right=0.95)

    # ── Header ──
    axh = fig.add_subplot(gs[0, :]); axh.axis("off")
    axh.text(0, 0.78, "Weather → Revenue · Roofing Portfolio", fontsize=21, fontweight="bold")
    axh.text(0, 0.42, "Altis Groep challenge · companies: Peter Ummels (Brunssum) + Gilde GB (Valkenswaard) · 2023–2026",
             fontsize=11, color="#475569")
    axh.text(0, 0.08, "Open-Meteo daily weather (100% coverage) vs invoice-dated ledger revenue (€80.2M combined)",
             fontsize=10, color="#475569", style="italic")

    # ── Key findings text ──
    axk = fig.add_subplot(gs[1, 0]); axk.axis("off")
    findings = [
        ("✓ HEADLINE", "Each extra WORKABLE day/week ≈ +11–14% revenue", "#065f46"),
        ("", "(workable = no rain, frost, heat ≥28°C or wind ≥40km/h).", "#334155"),
        ("", "Robust across regression + pooled 2-company panel (p≈0.03).", "#334155"),
        ("~ SECONDARY", "Frost/cold drag revenue — strong for Gilde, mostly", "#9a3412"),
        ("", "seasonal for Ummels. A real winter dip, hard to call causal.", "#334155"),
        ("✗ NO SIGNAL", "Rain, heat, wind ALONE: nothing once season removed.", "#7f1d1d"),
        ("! LIMIT", "All data is INVOICE-dated, not work-dated; no hours.", "#334155"),
        ("", "Invoice timing blurs day-level weather effects.", "#334155"),
    ]
    y = 0.97
    for tag, txt, col in findings:
        if tag:
            axk.text(0, y, tag, fontsize=9.5, fontweight="bold", color=col)
            axk.text(0.30, y, txt, fontsize=9.5, color="#1e293b")
        else:
            axk.text(0.30, y, txt, fontsize=8.8, color=col)
        y -= 0.125
    axk.set_title("Key findings", fontsize=12, fontweight="bold", loc="left")

    # ── Data assets table ──
    axt = fig.add_subplot(gs[1, 1]); axt.axis("off")
    rows = [
        ["Ummels (Brunssum)", "€35.8M · 9.8k txns", "invoice", "✓ weather"],
        ["Gilde (Valkenswaard)", "€44.4M", "invoice", "✓ weather"],
        ["Altis dataset 1", "monthly turnover", "month", "no location"],
        ["Altis dataset 2", "txns + Company E", "invoice", "no location"],
        ["Open-Meteo", "8 vars, daily", "daily", "✓ 100% cover"],
    ]
    t = axt.table(cellText=rows, colLabels=["Source", "Size", "Date type", "Weather-ready"],
                  loc="center", cellLoc="left")
    t.auto_set_font_size(False); t.set_fontsize(8.3); t.scale(1, 1.65)
    for j in range(4):
        t[0, j].set_facecolor("#1e293b"); t[0, j].set_text_props(color="white", weight="bold")
    axt.set_title("Data assets", fontsize=12, fontweight="bold", loc="left")

    # ── Effect sizes (pooled + per company) ──
    ax1 = fig.add_subplot(gs[2, :])
    s1u = res[(res.strategy == "S1_fixed_effects") & res.label.str.contains("Ummels")]
    s1g = res[(res.strategy == "S1_fixed_effects") & res.label.str.contains("Gilde")]
    s7 = res[res.strategy == "S7_panel"]
    metrics = ["workable_days", "frost_days", "cold_days", "rain_days", "heat_days", "heavy_rain_days"]

    def val(df, m):
        r = df[df.weather_metric == m]
        return (r["pct_per_unit"].iloc[0], r["p"].iloc[0]) if len(r) else (np.nan, 1)
    y = np.arange(len(metrics)); h = 0.26
    for off, df in [(-h, s1u), (0, s1g), (h, s7)]:
        vals = [val(df, m) for m in metrics]
        ax1.barh(y + off, [v[0] for v in vals], height=h,
                 color=[SIG if v[1] < 0.05 else NS for v in vals], edgecolor="#475569", linewidth=0.5)
    ax1.set_yticks(y); ax1.set_yticklabels(metrics)
    ax1.axvline(0, color="#1e293b", linewidth=1); ax1.set_xlim(-30, 30)
    ax1.set_xlabel("% revenue change per +1 unit/week  ·  green = significant (p<0.05)")
    ax1.set_title("Effect sizes — fixed-effects regression  (3 bars/metric: Ummels · Gilde · Pooled)",
                  fontsize=11, fontweight="bold")
    ax1.grid(True, axis="x", alpha=0.3)

    # ── Headline scatter ──
    ax2 = fig.add_subplot(gs[3, 0])
    for df, c, lbl in [(ummels, "#2563eb", "Ummels"), (gilde, "#f59e0b", "Gilde")]:
        ax2.scatter(df["workable_days"], deseason(df, "revenue") / 1000, alpha=0.4, s=18, color=c, label=lbl)
    both = pd.DataFrame({"x": pd.concat([ummels["workable_days"], gilde["workable_days"]]),
                         "y": pd.concat([deseason(ummels, "revenue"), deseason(gilde, "revenue")]) / 1000})
    z = np.polyfit(both.x, both.y, 1); xs = np.linspace(both.x.min(), both.x.max(), 40)
    ax2.plot(xs, np.poly1d(z)(xs), "--", color="#065f46", linewidth=2)
    r, p = stats.pearsonr(both.x, both.y)
    ax2.axhline(0, color="#94a3b8", linewidth=0.8)
    ax2.set_xlabel("Workable days / week"); ax2.set_ylabel("Revenue − monthly avg (€k)")
    ax2.set_title(f"Headline: workable days → revenue\nseason-adj · r={r:.2f}, p={p:.3f}", fontsize=10.5, fontweight="bold")
    ax2.legend(fontsize=8); ax2.grid(True, alpha=0.3)

    # ── Monthly forecast fit (Ummels) ──
    ax3 = fig.add_subplot(gs[3, 1])
    import statsmodels.formula.api as smf
    mdf = monthly(ummels); mdf["month"] = mdf["ms"].dt.month; mdf["t"] = np.arange(len(mdf))
    mdf["log_rev"] = np.log(mdf["revenue"])
    fmodel = smf.ols("log_rev ~ C(month) + t + workable_days", data=mdf).fit()
    mdf["pred"] = np.exp(fmodel.predict(mdf))
    sd = np.std(fmodel.resid)
    ax3.plot(mdf["ms"], mdf["revenue"] / 1000, color="#94a3b8", marker=".", linewidth=1, label="Actual")
    ax3.plot(mdf["ms"], mdf["pred"] / 1000, color="#2563eb", linewidth=1.6, label="Model")
    ax3.fill_between(mdf["ms"], np.exp(np.log(mdf["pred"]) - 1.28 * sd) / 1000,
                     np.exp(np.log(mdf["pred"]) + 1.28 * sd) / 1000, alpha=0.15, color="#2563eb")
    ax3.set_ylabel("Monthly revenue (€k)")
    ax3.set_title(f"Forecast model (monthly) — Ummels\nR²={fmodel.rsquared:.2f}", fontsize=10.5, fontweight="bold")
    ax3.legend(fontsize=8); ax3.grid(True, alpha=0.3)
    ax3.tick_params(axis="x", labelrotation=30)

    # ── Deliverables / what we can do ──
    axd = fig.add_subplot(gs[4, :]); axd.axis("off")
    axd.set_title("What we can do with this", fontsize=12, fontweight="bold", loc="left")
    items = [
        "• Quantify weather sensitivity per company (done) — workable-days elasticity is the headline KPI.",
        "• Weather-rule playbook (output_playbook/): backtested rules; only Gilde frost-week survives season-adjustment.",
        "• Revenue forecast tool (output_forecast/): feed a weather forecast → expected monthly revenue + 80% band (R²≈0.60).",
        "• Seasonal planning: model & anticipate the winter frost/cold revenue dip.",
        "• Benchmark companies: Gilde is more frost-sensitive than Ummels.",
        "",
        "Biggest unlock → obtain actual WORK/JOB dates or labour hours; then daily causation becomes provable.",
    ]
    yy = 0.92
    for it in items:
        axd.text(0, yy, it, fontsize=9.3, color="#1e293b" if not it.startswith("Biggest") else "#7f1d1d",
                 fontweight="bold" if it.startswith("Biggest") else "normal")
        yy -= 0.135

    pdf = OUT / "weather_revenue_summary.pdf"
    png = OUT / "weather_revenue_summary.png"
    fig.savefig(pdf, bbox_inches="tight", facecolor="white")
    fig.savefig(png, dpi=130, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"Saved: {pdf}\nSaved: {png}")


if __name__ == "__main__":
    main()
