"""
Brute-force factor & threshold search: weather -> revenue.

Sweeps a large grid to find WHICH SPECIFIC NUMBERS (thresholds) show an
influence on revenue:

  factors      : rain_mm, temp_min, temp_mean, temp_max, wind_max, gust_max, snow_mm
  thresholds   : a range per factor (e.g. rain >= 0.5,1,2,...,20 mm)
  aggregation  : count of days over/under threshold per period  (+ raw sum/mean/max)
  resolution   : weekly and monthly
  lag          : 0, 1, 2 periods
  companies    : Ummels, Gilde, and POOLED (both, for power)

To avoid the seasonality trap, every test is on SEASON-ADJUSTED data: revenue
and the feature each have their company-month mean removed before correlating
(Frisch–Waugh–Lovell style partialling-out of month + company fixed effects).

Because we run hundreds of tests, raw p-values WILL throw false positives, so
we add Benjamini-Hochberg FDR q-values and only trust q < 0.10.
"""

from __future__ import annotations

import itertools
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / "analysis" / "output_strategies"
OUT = ROOT / "analysis" / "output_bruteforce"
OUT.mkdir(parents=True, exist_ok=True)

WEATHER = {
    "ummels": S / "weather_ummels.csv",
    "gilde": S / "weather_gilde.csv",
}
PANELS = {
    "ummels": S / "panel_ummels.csv",
    "gilde": S / "panel_gilde.csv",
}

# factor -> (column, direction, [thresholds], unit)
#   direction '>=' counts days at/above threshold (bad: rain/heat/wind)
#   direction '<=' counts days at/below threshold (bad: frost/cold)
GRID = {
    "rain_over":   ("rain_mm",     ">=", [0.5, 1, 2, 3, 5, 8, 10, 15, 20], "mm"),
    "precip_over": ("precip_mm",   ">=", [1, 2, 5, 10, 15, 20], "mm"),
    "snow_over":   ("snow_mm",     ">=", [0.1, 0.5, 1, 2, 5], "cm"),
    "tmin_under":  ("temp_min_c",  "<=", [-3, -2, -1, 0, 1, 2, 3, 5], "°C"),
    "tmean_under": ("temp_mean_c", "<=", [0, 2, 4, 6, 8, 10], "°C"),
    "tmax_over":   ("temp_max_c",  ">=", [22, 24, 25, 26, 27, 28, 30, 32], "°C"),
    "tmax_under":  ("temp_max_c",  "<=", [3, 5, 7, 9], "°C"),
    "wind_over":   ("wind_max_kmh", ">=", [25, 30, 35, 40, 45, 50], "km/h"),
    "gust_over":   ("gust_max_kmh", ">=", [40, 50, 60, 70, 80], "km/h"),
}
# continuous aggregates to also try
CONT = [("rain_mm", "sum"), ("precip_mm", "sum"), ("temp_mean_c", "mean"),
        ("temp_max_c", "max"), ("wind_max_kmh", "mean"), ("wind_max_kmh", "max")]


def load_daily(key: str) -> pd.DataFrame:
    w = pd.read_csv(WEATHER[key], parse_dates=["date"])
    for c in ["snow_mm", "gust_max_kmh"]:
        if c not in w:
            w[c] = 0.0
    return w


def revenue_period(key: str, res: str) -> pd.DataFrame:
    p = pd.read_csv(PANELS[key], parse_dates=["week_start"])
    if res == "weekly":
        p["period"] = p["week_start"]
    else:
        p["period"] = p["week_start"].dt.to_period("M").apply(lambda x: x.start_time)
    g = p.groupby("period", as_index=False).agg(revenue=("revenue", "sum"))
    return g


def daily_to_period(w: pd.DataFrame, res: str) -> pd.DataFrame:
    w = w.copy()
    if res == "weekly":
        w["period"] = w["date"].dt.to_period("W-SUN").apply(lambda p: p.start_time)
    else:
        w["period"] = w["date"].dt.to_period("M").apply(lambda p: p.start_time)
    return w


def build_features(w_period: pd.DataFrame) -> pd.DataFrame:
    """All grid + continuous features per period for one company."""
    feats = {}
    grp = w_period.groupby("period")
    for name, (col, direction, thrs, unit) in GRID.items():
        for thr in thrs:
            flag = (w_period[col] >= thr) if direction == ">=" else (w_period[col] <= thr)
            s = flag.groupby(w_period["period"]).sum()
            feats[f"{name}_{thr}{unit}"] = s
    for col, agg in CONT:
        feats[f"{col}_{agg}"] = grp[col].agg(agg)
    df = pd.DataFrame(feats)
    df.index.name = "period"
    return df.reset_index()


def season_adjust(df: pd.DataFrame, cols: list[str], by="month") -> pd.DataFrame:
    df = df.copy()
    df[by] = df["period"].dt.month
    # also remove company-level mean if pooled (handled before call)
    for c in cols + ["revenue"]:
        df[c] = df[c] - df.groupby(by)[c].transform("mean")
    return df


def run(res: str) -> pd.DataFrame:
    rows = []
    # build per-company merged feature+revenue, then also a pooled frame
    per_company = {}
    for key in PANELS:
        w = daily_to_period(load_daily(key), res)
        feats = build_features(w)
        rev = revenue_period(key, res)
        m = rev.merge(feats, on="period", how="inner")
        m["company"] = key
        per_company[key] = m

    feat_cols = [c for c in per_company["ummels"].columns
                 if c not in ("period", "revenue", "company")]

    frames = {**per_company, "pooled": pd.concat(per_company.values(), ignore_index=True)}

    for scope, m in frames.items():
        m = m.copy()
        m["month"] = m["period"].dt.month
        # season-adjust: remove (company,month) mean when pooled, else month mean
        grpkeys = (["company", "month"] if scope == "pooled" else ["month"])
        adj = m.copy()
        for c in feat_cols + ["revenue"]:
            adj[c] = m[c] - m.groupby(grpkeys)[c].transform("mean")
        for col in feat_cols:
            for lag in (0, 1, 2):
                a = adj.copy()
                if lag and scope == "pooled":
                    a[col] = a.groupby("company")[col].shift(lag)
                elif lag:
                    a[col] = a[col].shift(lag)
                v = a[[col, "revenue"]].dropna()
                if v[col].nunique() < 4 or len(v) < 20:
                    continue
                r, p = stats.spearmanr(v[col], v["revenue"])
                if np.isnan(r):
                    continue
                rows.append({"resolution": res, "scope": scope, "feature": col,
                             "lag": lag, "n": len(v), "spearman_r": r, "p": p})
    return pd.DataFrame(rows)


def main() -> None:
    all_res = pd.concat([run("weekly"), run("monthly")], ignore_index=True)
    # FDR across the whole family of tests
    all_res["q_fdr"] = multipletests(all_res["p"], method="fdr_bh")[1]
    all_res = all_res.sort_values("p").reset_index(drop=True)
    all_res.to_csv(OUT / "bruteforce_all.csv", index=False)

    print(f"Total tests run: {len(all_res)}")
    print(f"Raw significant (p<0.05): {(all_res.p < 0.05).sum()}  "
          f"(≈{0.05*len(all_res):.0f} expected by chance)")
    print(f"Survive FDR (q<0.10):     {(all_res.q_fdr < 0.10).sum()}")

    print("\n=== TOP 25 by raw p (season-adjusted) ===")
    show = all_res.head(25)[["resolution", "scope", "feature", "lag", "n", "spearman_r", "p", "q_fdr"]]
    with pd.option_context("display.float_format", lambda v: f"{v:.4f}"):
        print(show.to_string(index=False))

    survivors = all_res[all_res.q_fdr < 0.10]
    print("\n=== SURVIVE FDR correction (these are the trustworthy 'real' numbers) ===")
    if len(survivors):
        with pd.option_context("display.float_format", lambda v: f"{v:.4f}"):
            print(survivors[["resolution", "scope", "feature", "lag", "spearman_r", "p", "q_fdr"]].to_string(index=False))
    else:
        print("  NONE — no specific threshold survives multiple-testing correction.")

    make_heatmap(all_res)


def make_heatmap(allres: pd.DataFrame) -> None:
    """Heatmap of threshold-count features: factor family (rows) x threshold (cols),
    color = pooled monthly season-adj Spearman r at lag 0."""
    sub = allres[(allres.scope == "pooled") & (allres.resolution == "monthly") & (allres.lag == 0)].copy()
    # parse family + threshold from feature name for the GRID count features
    fams, thrs, rmap, pmap = [], [], {}, {}
    for _, row in sub.iterrows():
        f = row["feature"]
        matched = None
        for name in GRID:
            if f.startswith(name + "_"):
                matched = name; break
        if matched is None:
            continue
        thr = f[len(matched) + 1:]
        rmap[(matched, thr)] = row["spearman_r"]
        pmap[(matched, thr)] = row["p"]
        fams.append(matched); thrs.append(thr)

    families = list(GRID.keys())
    fig, ax = plt.subplots(figsize=(13, 7))
    # build matrix with ragged thresholds: use max thresholds count
    grid_cols = {name: [f"{t}{GRID[name][3]}" for t in GRID[name][2]] for name in families}
    maxc = max(len(v) for v in grid_cols.values())
    M = np.full((len(families), maxc), np.nan)
    annot = np.empty((len(families), maxc), dtype=object)
    collabels = [""] * maxc
    for i, name in enumerate(families):
        for j, lbl in enumerate(grid_cols[name]):
            key = (name, lbl)
            if key in rmap:
                M[i, j] = rmap[key]
                star = "*" if pmap[key] < 0.05 else ""
                annot[i, j] = f"{rmap[key]:.2f}{star}"
            else:
                annot[i, j] = ""
    im = ax.imshow(M, cmap="RdBu_r", vmin=-0.5, vmax=0.5, aspect="auto")
    ax.set_yticks(range(len(families))); ax.set_yticklabels(families)
    ax.set_xticks(range(maxc)); ax.set_xticklabels([f"thr {i+1}" for i in range(maxc)])
    for i in range(len(families)):
        for j in range(maxc):
            if annot[i, j]:
                ax.text(j, i, annot[i, j], ha="center", va="center", fontsize=7.5,
                        color="black" if abs(M[i, j]) < 0.3 else "white")
    # put actual threshold value under each cell as small text via secondary labeling
    for i, name in enumerate(families):
        for j, lbl in enumerate(grid_cols[name]):
            ax.text(j, i + 0.34, lbl, ha="center", va="center", fontsize=6, color="#334155")
    plt.colorbar(im, label="Spearman r (pooled, monthly, season-adjusted, lag 0)")
    ax.set_title("Brute-force threshold scan · pooled monthly · * = raw p<0.05\n"
                 "blue = more of this weather → LOWER revenue · red = HIGHER", fontweight="bold")
    fig.tight_layout()
    out = OUT / "bruteforce_heatmap.png"
    fig.savefig(out, dpi=140, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"\nSaved heatmap: {out}")


if __name__ == "__main__":
    main()
