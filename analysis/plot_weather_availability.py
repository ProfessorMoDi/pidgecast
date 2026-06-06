"""
Weather-data availability / sanity-check overview.

Shows exactly what weather we pulled from Open-Meteo for each company location,
so the raw inputs can be eyeballed: coverage, variables, ranges, and the derived
'bad-weather' day flags used in the analysis.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
STRAT = ROOT / "analysis" / "output_strategies"

SRC = {
    "Peter Ummels — Brunssum (50.95, 5.97)": STRAT / "weather_ummels.csv",
    "Gilde GB — Valkenswaard (51.35, 5.46)": STRAT / "weather_gilde.csv",
}

plt.rcParams.update({"figure.facecolor": "#fafafa", "axes.facecolor": "#ffffff",
                     "font.size": 9, "axes.titlesize": 11, "axes.titleweight": "bold"})


def add_flags(w: pd.DataFrame) -> pd.DataFrame:
    w = w.copy()
    w["date"] = pd.to_datetime(w["date"])
    w["rain_day"] = w["rain_mm"] >= 1.0
    w["frost_day"] = w["temp_min_c"] <= 0.0
    w["heat_day"] = w["temp_max_c"] >= 28.0
    w["windy_day"] = w["wind_max_kmh"] >= 40.0
    return w


def main() -> None:
    data = {k: add_flags(pd.read_csv(p)) for k, p in SRC.items() if p.exists()}
    if not data:
        raise SystemExit("Run weather_strategies.py first to fetch weather.")

    fig = plt.figure(figsize=(15, 17))
    gs = fig.add_gridspec(6, 1, hspace=0.55)
    colors = {"rain": "#2563eb", "temp": "#dc2626", "wind": "#7c3aed", "snow": "#0891b2"}

    ref = list(data.values())[0]
    cov_start, cov_end = ref["date"].min(), ref["date"].max()

    # 1. Daily temperature band (min/mean/max) — Ummels
    ax = fig.add_subplot(gs[0])
    w = ref
    ax.fill_between(w["date"], w["temp_min_c"], w["temp_max_c"], alpha=0.25, color=colors["temp"], label="min–max range")
    ax.plot(w["date"], w["temp_mean_c"], color=colors["temp"], linewidth=0.7, label="daily mean")
    ax.axhline(0, color="#1e3a8a", linewidth=1, linestyle="--", label="frost line (0°C)")
    ax.axhline(28, color="#b45309", linewidth=1, linestyle=":", label="heat line (28°C)")
    ax.set_ylabel("°C")
    ax.set_title("1 · Daily temperature — Brunssum (min / mean / max)")
    ax.legend(ncol=4, fontsize=8, loc="upper right")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax.grid(True, alpha=0.3)

    # 2. Daily rainfall
    ax = fig.add_subplot(gs[1])
    ax.bar(w["date"], w["rain_mm"], width=1.5, color=colors["rain"], alpha=0.8)
    ax.axhline(5, color="#991b1b", linewidth=1, linestyle=":", label="heavy-rain line (5mm)")
    ax.set_ylabel("rain mm/day")
    ax.set_title("2 · Daily rainfall — Brunssum")
    ax.legend(fontsize=8)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax.grid(True, alpha=0.3)

    # 3. Daily max wind + gusts
    ax = fig.add_subplot(gs[2])
    ax.plot(w["date"], w["wind_max_kmh"], color=colors["wind"], linewidth=0.6, label="max wind")
    if "gust_max_kmh" in w:
        ax.plot(w["date"], w["gust_max_kmh"], color="#c084fc", linewidth=0.5, alpha=0.7, label="max gust")
    ax.axhline(40, color="#581c87", linewidth=1, linestyle=":", label="windy line (40 km/h)")
    ax.set_ylabel("km/h")
    ax.set_title("3 · Daily max wind & gusts — Brunssum")
    ax.legend(fontsize=8)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax.grid(True, alpha=0.3)

    # 4. Monthly count of each 'bad weather' day type (stacked)
    ax = fig.add_subplot(gs[3])
    w2 = w.copy()
    w2["ym"] = w2["date"].dt.to_period("M").dt.to_timestamp()
    mo = w2.groupby("ym")[["rain_day", "frost_day", "heat_day", "windy_day"]].sum()
    bottom = np.zeros(len(mo))
    for col, c, lbl in [("rain_day", colors["rain"], "rain ≥1mm"),
                        ("frost_day", "#1e3a8a", "frost ≤0°C"),
                        ("heat_day", "#b45309", "heat ≥28°C"),
                        ("windy_day", colors["wind"], "windy ≥40km/h")]:
        ax.bar(mo.index, mo[col], bottom=bottom, width=20, color=c, alpha=0.85, label=lbl)
        bottom += mo[col].values
    ax.set_ylabel("days / month")
    ax.set_title("4 · Monthly count of work-disrupting weather days — Brunssum")
    ax.legend(ncol=4, fontsize=8)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax.grid(True, axis="y", alpha=0.3)

    # 5. Cross-location check — daily mean temp, both companies (should overlap)
    ax = fig.add_subplot(gs[4])
    for (label, wdf), c in zip(data.items(), ["#dc2626", "#2563eb"]):
        ax.plot(wdf["date"], wdf["temp_mean_c"], linewidth=0.6, alpha=0.8, label=label.split(" — ")[0], color=c)
    ax.set_ylabel("daily mean °C")
    ax.set_title("5 · Cross-check: both locations track together (~35 km apart → shared weather)")
    ax.legend(fontsize=8)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b '%y"))
    ax.grid(True, alpha=0.3)

    # 6. Availability / completeness table
    ax = fig.add_subplot(gs[5]); ax.axis("off")
    rows = []
    for label, wdf in data.items():
        days = len(wdf)
        span_days = (wdf["date"].max() - wdf["date"].min()).days + 1
        rows.append([
            label,
            f"{wdf['date'].min().date()} → {wdf['date'].max().date()}",
            f"{days} / {span_days}",
            f"{100*days/span_days:.1f}%",
            f"{wdf['temp_min_c'].min():.0f}…{wdf['temp_max_c'].max():.0f}°C",
            f"{int(wdf['rain_day'].sum())}",
            f"{int(wdf['frost_day'].sum())}",
            f"{int(wdf['heat_day'].sum())}",
            f"{int(wdf['windy_day'].sum())}",
        ])
    col_labels = ["Location", "Coverage", "Days w/ data", "Complete",
                  "Temp range", "Rain days", "Frost days", "Heat days", "Windy days"]
    tbl = ax.table(cellText=rows, colLabels=col_labels, loc="center", cellLoc="center")
    tbl.auto_set_font_size(False); tbl.set_fontsize(8.5); tbl.scale(1, 2.0)
    for j in range(len(col_labels)):
        tbl[0, j].set_facecolor("#1e293b"); tbl[0, j].set_text_props(color="white", weight="bold")
    ax.set_title("6 · Weather data availability summary (source: Open-Meteo historical archive, daily, Europe/Amsterdam)", pad=20)

    fig.suptitle(
        f"Weather data availability & sanity check  ·  {cov_start.date()} → {cov_end.date()}  ·  "
        "8 daily variables: rain, precip, snow, temp(min/mean/max), wind, gusts",
        fontsize=13, fontweight="bold", y=0.995)

    out = STRAT / "weather_data_availability.png"
    fig.savefig(out, dpi=140, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"Saved: {out}")

    # also dump a small completeness CSV
    pd.DataFrame(rows, columns=col_labels).to_csv(STRAT / "weather_availability.csv", index=False)


if __name__ == "__main__":
    main()
