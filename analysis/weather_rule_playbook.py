"""
Weather-rule playbook — backtests a set of 'if this weather, then revenue'
rules for each roofing company and renders a clean, actionable table.

For each rule we compare weeks that match the condition vs weeks that don't
(season-aware: the Mann-Whitney test is on raw revenue; we also report the
season-adjusted gap so seasonality isn't mistaken for a weather effect).
A verdict column turns statistics into a recommendation.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / "analysis" / "output_strategies"
OUT = ROOT / "analysis" / "output_playbook"
OUT.mkdir(parents=True, exist_ok=True)

PANELS = {
    "Ummels (Brunssum)": S / "panel_ummels.csv",
    "Gilde (Valkenswaard)": S / "panel_gilde.csv",
}

# rule name -> (column, threshold, human-readable condition)
RULES = {
    "Frost week": ("frost_days", 2, "≥2 frost days (min ≤0°C)"),
    "Hard cold week": ("cold_days", 3, "≥3 cold days (mean ≤5°C)"),
    "Wet week": ("rain_days", 4, "≥4 rain days (≥1mm)"),
    "Heavy-rain week": ("heavy_rain_days", 2, "≥2 heavy-rain days (≥5mm)"),
    "Heat week": ("heat_days", 2, "≥2 hot days (max ≥28°C)"),
    "Windy week": ("windy_days", 2, "≥2 windy days (≥40km/h)"),
    "Good week": ("workable_days", 6, "≥6 workable days"),
}


def backtest(m: pd.DataFrame, company: str) -> list[dict]:
    m = m.copy()
    m["rev_adj"] = m["revenue"] - m.groupby("month")["revenue"].transform("mean")
    overall = m["revenue"].median()
    rows = []
    for rule, (col, thr, cond) in RULES.items():
        if col not in m:
            continue
        hit = m[col] >= thr
        a, b = m[hit], m[~hit]
        if len(a) < 6 or len(b) < 6:
            continue
        # raw effect
        gap_raw = 100 * (a["revenue"].median() / b["revenue"].median() - 1)
        # season-adjusted effect (removes winter/summer confound)
        gap_adj = a["rev_adj"].median() - b["rev_adj"].median()
        gap_adj_pct = 100 * gap_adj / overall
        _, p = stats.mannwhitneyu(a["revenue"], b["revenue"], alternative="two-sided")
        _, p_adj = stats.mannwhitneyu(a["rev_adj"], b["rev_adj"], alternative="two-sided")

        # verdict: needs a season-adjusted gap that is sizeable AND significant
        if p_adj < 0.05 and abs(gap_adj_pct) >= 8:
            verdict = "USE"
        elif p_adj < 0.10 and abs(gap_adj_pct) >= 5:
            verdict = "WATCH"
        else:
            verdict = "no signal"
        rows.append({
            "company": company, "rule": rule, "condition": cond,
            "n_weeks": int(hit.sum()), "raw_gap_pct": round(gap_raw, 1),
            "seasonadj_gap_pct": round(gap_adj_pct, 1),
            "p_raw": round(p, 4), "p_seasonadj": round(p_adj, 4),
            "verdict": verdict,
        })
    return rows


def render_table(df: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(15, 0.55 * len(df) + 2.2))
    ax.axis("off")
    cols = ["company", "rule", "condition", "n_weeks", "raw_gap_pct",
            "seasonadj_gap_pct", "p_seasonadj", "verdict"]
    headers = ["Company", "Rule", "Condition", "Weeks", "Raw Δrev %",
               "Season-adj Δrev %", "p (adj)", "Verdict"]
    cell = df[cols].values.tolist()
    tbl = ax.table(cellText=cell, colLabels=headers, loc="center", cellLoc="center")
    tbl.auto_set_font_size(False); tbl.set_fontsize(9.5); tbl.scale(1, 1.9)

    vcol = {"USE": "#059669", "WATCH": "#d97706", "no signal": "#94a3b8"}
    for j in range(len(headers)):
        tbl[0, j].set_facecolor("#1e293b"); tbl[0, j].set_text_props(color="white", weight="bold")
    for i, row in enumerate(df.itertuples(), start=1):
        # color verdict cell
        tbl[i, 7].set_facecolor(vcol[row.verdict])
        tbl[i, 7].set_text_props(color="white", weight="bold")
        # tint the season-adj gap by sign
        g = row.seasonadj_gap_pct
        tbl[i, 5].set_facecolor("#fee2e2" if g < 0 else "#dcfce7")
        if i % 2 == 0:
            for j in [0, 1, 2, 3, 4, 6]:
                tbl[i, j].set_facecolor("#f8fafc")
    ax.set_title("Weather-rule playbook — backtested 2023–2026\n"
                 "Verdict uses the SEASON-ADJUSTED gap (raw gap is inflated by winter/summer seasonality)",
                 fontweight="bold", fontsize=12, pad=16)
    out = OUT / "weather_rule_playbook.png"
    fig.savefig(out, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"Saved: {out}")


def main() -> None:
    all_rows = []
    for company, path in PANELS.items():
        m = pd.read_csv(path, parse_dates=["week_start"])
        all_rows += backtest(m, company)
    df = pd.DataFrame(all_rows).sort_values(["company", "rule"]).reset_index(drop=True)
    df.to_csv(OUT / "weather_rule_playbook.csv", index=False)
    print(df.to_string(index=False))
    render_table(df)
    # quick rollup
    print("\nRules worth using (USE/WATCH):")
    print(df[df.verdict != "no signal"][["company", "rule", "seasonadj_gap_pct", "p_seasonadj", "verdict"]]
          .to_string(index=False))


if __name__ == "__main__":
    main()
