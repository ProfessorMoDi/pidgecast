"""
Build a self-contained interactive HTML dashboard.

Embeds daily revenue + daily weather for both companies as JSON, then ships a
single .html file where sliders set weather thresholds and the page recomputes
(live, in-browser) the correlation, p-value, statistical significance and the
revenue impact. No server / internet needed — just open the file.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from weather_strategies import COMPANIES, fetch_weather, load_gilde, load_ummels  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "analysis" / "weather_dashboard.html"


def build_records() -> dict:
    out = {}
    for key, cfg in COMPANIES.items():
        tx = (load_ummels if cfg["loader"] == "ummels" else load_gilde)(cfg["dir"])
        daily_rev = (tx.assign(d=tx["Datum"].dt.strftime("%Y-%m-%d"))
                     .groupby("d")["net"].sum())
        start, end = tx["Datum"].min().strftime("%Y-%m-%d"), tx["Datum"].max().strftime("%Y-%m-%d")
        w = fetch_weather(cfg["lat"], cfg["lon"], start, end, key)
        recs = []
        for _, r in w.iterrows():
            d = r["date"].strftime("%Y-%m-%d")
            recs.append({
                "d": d,
                "rev": round(float(daily_rev.get(d, 0.0)), 2),
                "rain": round(float(r["rain_mm"]), 2),
                "snow": round(float(r.get("snow_mm", 0) or 0), 2),
                "tmin": round(float(r["temp_min_c"]), 1),
                "tmean": round(float(r["temp_mean_c"]), 1),
                "tmax": round(float(r["temp_max_c"]), 1),
                "wind": round(float(r["wind_max_kmh"]), 1),
                "gust": round(float(r.get("gust_max_kmh", 0) or 0), 1),
            })
        out[key] = {"name": cfg["name"], "records": recs}
    return out


HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Weather → Revenue · Interactive Explorer</title>
<style>
  :root{ --bg:#0f172a; --panel:#1e293b; --card:#27364b; --txt:#e2e8f0; --mut:#94a3b8;
         --accent:#38bdf8; --good:#34d399; --bad:#f87171; --warn:#fbbf24; --line:#334155; }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       background:var(--bg);color:var(--txt);font-size:14px}
  header{padding:18px 26px;border-bottom:1px solid var(--line);background:var(--panel)}
  header h1{margin:0;font-size:19px}
  header p{margin:4px 0 0;color:var(--mut);font-size:12.5px}
  .wrap{display:grid;grid-template-columns:330px 1fr;gap:18px;padding:18px 22px}
  .controls{background:var(--panel);border-radius:12px;padding:16px 18px;height:fit-content}
  .grp{margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--line)}
  .grp:last-child{border-bottom:none}
  .grp h3{margin:0 0 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
  .seg{display:flex;gap:6px;flex-wrap:wrap}
  .seg button{flex:1;background:var(--card);color:var(--txt);border:1px solid var(--line);
       padding:7px 8px;border-radius:8px;cursor:pointer;font-size:12.5px}
  .seg button.on{background:var(--accent);color:#04263a;border-color:var(--accent);font-weight:700}
  .factor{margin-bottom:13px}
  .factor .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
  .factor label{font-size:13px;cursor:pointer;display:flex;gap:7px;align-items:center}
  .factor .val{font-variant-numeric:tabular-nums;color:var(--accent);font-weight:700}
  .factor.off{opacity:.4}
  input[type=range]{width:100%;accent-color:var(--accent)}
  input[type=checkbox]{accent-color:var(--accent);width:15px;height:15px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
  .card{background:var(--panel);border-radius:12px;padding:15px 16px}
  .card .lbl{color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em}
  .card .big{font-size:27px;font-weight:800;margin-top:6px;font-variant-numeric:tabular-nums}
  .card .sub{color:var(--mut);font-size:12px;margin-top:3px}
  .badge{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11.5px;font-weight:700;margin-top:8px}
  .b-strong{background:rgba(52,211,153,.18);color:var(--good)}
  .b-weak{background:rgba(251,191,36,.18);color:var(--warn)}
  .b-no{background:rgba(148,163,184,.18);color:var(--mut)}
  .charts{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .chart{background:var(--panel);border-radius:12px;padding:14px}
  .chart h3{margin:0 0 8px;font-size:13px}
  canvas{width:100%;height:300px;display:block}
  .note{color:var(--mut);font-size:11.5px;margin-top:10px;line-height:1.5}
  .pos{color:var(--good)} .neg{color:var(--bad)}
  .pretitle{color:var(--mut);font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
  .presets{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:18px}
  .preset{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 12px;
          cursor:pointer;text-align:left;color:var(--txt);min-width:150px;transition:border-color .12s}
  .preset:hover{border-color:var(--accent)}
  .preset b{display:block;font-size:12.5px;margin-bottom:2px} .preset span{font-size:11px;color:var(--mut)}
</style>
</head>
<body>
<header>
  <h1>Weather → Revenue · Interactive Explorer</h1>
  <p>Move the sliders to define "bad-weather" days. Significance &amp; revenue impact recompute live, in your browser. Data: Open-Meteo daily weather + invoice-dated ledger revenue, 2023–2026.</p>
</header>
<div class="wrap">
  <div class="controls">
    <div class="grp">
      <h3>Company</h3>
      <div class="seg" id="company"></div>
    </div>
    <div class="grp">
      <h3>Resolution</h3>
      <div class="seg" id="res">
        <button data-v="weekly" class="on">Weekly</button>
        <button data-v="monthly">Monthly</button>
      </div>
    </div>
    <div class="grp">
      <h3>Bad-weather factors (enable + set threshold)</h3>
      <div id="factors"></div>
    </div>
    <div class="grp">
      <h3>Options</h3>
      <div class="factor">
        <div class="top"><label><input type="checkbox" id="season" checked> Remove seasonality (month means)</label></div>
      </div>
      <div class="factor">
        <div class="top"><label>Lag (periods)</label><span class="val" id="lagval">0</span></div>
        <input type="range" id="lag" min="0" max="4" step="1" value="0">
      </div>
      <div class="factor">
        <div class="top"><label>Impact split (top/bottom group)</label><span class="val" id="splitval">33%</span></div>
        <input type="range" id="split" min="20" max="50" step="5" value="33">
      </div>
    </div>
  </div>

  <div class="main">
    <div class="pretitle">⚡ Presets — click to jump to a noteworthy finding</div>
    <div class="presets" id="presets"></div>
    <div class="cards">
      <div class="card"><div class="lbl">Correlation (Spearman r)</div><div class="big" id="rval">–</div>
        <div class="sub" id="rdir"></div></div>
      <div class="card"><div class="lbl">Significance (p-value)</div><div class="big" id="pval">–</div>
        <div class="badge b-no" id="pbadge">–</div></div>
      <div class="card"><div class="lbl">Revenue impact</div><div class="big" id="impact">–</div>
        <div class="sub" id="impactsub">bad vs good periods</div></div>
      <div class="card"><div class="lbl">Sample</div><div class="big" id="nval">–</div>
        <div class="sub" id="nsub"></div></div>
    </div>
    <div class="charts">
      <div class="chart"><h3>Bad-weather days vs revenue (per period)</h3>
        <canvas id="scatter"></canvas>
        <div class="note" id="scatnote"></div></div>
      <div class="chart"><h3>Revenue over time · bad-weather periods shaded</h3>
        <canvas id="ts"></canvas>
        <div class="note">Blue line = revenue. Red bars = bad-weather day count per period.</div></div>
    </div>
    <div class="note" id="footnote"></div>
  </div>
</div>

<script>
const DATA = __DATA__;

// ---- factor definitions: id, label, column, dir, min,max,step,default, unit ----
const FACTORS = [
  {id:'rain',  lbl:'Rain ≥',      col:'rain', dir:'>=', min:0.5,max:20,step:0.5,def:1,  unit:'mm',  on:true},
  {id:'frost', lbl:'Frost: min temp ≤', col:'tmin', dir:'<=', min:-5,max:5,step:0.5,def:0, unit:'°C', on:true},
  {id:'cold',  lbl:'Cold: mean temp ≤', col:'tmean',dir:'<=', min:0,max:12,step:0.5,def:5, unit:'°C', on:false},
  {id:'heat',  lbl:'Heat: max temp ≥',  col:'tmax', dir:'>=', min:20,max:36,step:0.5,def:28,unit:'°C', on:true},
  {id:'wind',  lbl:'Wind ≥',      col:'wind', dir:'>=', min:20,max:60,step:1, def:40, unit:'km/h',on:true},
];

const state = {company:Object.keys(DATA)[0], res:'weekly', season:true, lag:0, split:33,
               factors:Object.fromEntries(FACTORS.map(f=>[f.id,{on:f.on,val:f.def}]))};

// Curated presets (verified against this exact engine). Text uses double quotes
// and NO straight apostrophes (a lone ' inside a '...' string would break the page).
const PRESETS = [
  {t:"🥇 Strongest signal", d:"Frost ≤2°C · pooled weekly → r=−0.19, p<0.001 ✓",
   company:"pooled", res:"weekly", season:true, lag:0, split:33, factors:{frost:2}},
  {t:"💥 Biggest real swing", d:"Ummels frost weeks ≈ −31% revenue, p=0.005 ✓",
   company:"ummels", res:"weekly", season:true, lag:0, split:33, factors:{frost:2}},
  {t:"🧰 All factors combined", d:"All 5 factors · pooled weekly → −14%, p=0.08 (weak)",
   company:"pooled", res:"weekly", season:true, lag:0, split:33,
   factors:{rain:3, frost:2, cold:6, heat:30, wind:40}},
  {t:"🪤 Seasonality trap", d:"Cold months −17% raw but r≈0, p=0.88 (just winter)",
   company:"pooled", res:"monthly", season:true, lag:0, split:33, factors:{cold:6}},
  {t:"🌧️ Rain red herring", d:"No effect at any rain threshold (r≈0, p=0.9)",
   company:"pooled", res:"weekly", season:true, lag:0, split:33, factors:{rain:3}},
  {t:"🏔️ Gilde vs frost", d:"Gilde frost weeks −22%, r=−0.21, p=0.005 ✓",
   company:"gilde", res:"weekly", season:true, lag:0, split:33, factors:{frost:0}},
  {t:"☀️ Heat = busy season", d:"Hot weeks +38% revenue (summer peak), p=0.06",
   company:"ummels", res:"weekly", season:true, lag:0, split:33, factors:{heat:30}},
  {t:"🌬️ Wind: nothing", d:"−4% raw, r≈0 once season removed (p=0.47)",
   company:"pooled", res:"weekly", season:true, lag:0, split:33, factors:{wind:35}},
];

function syncUI(){
  document.querySelectorAll('#company button').forEach(b=>b.classList.toggle('on',b.dataset.v===state.company));
  document.querySelectorAll('#res button').forEach(b=>b.classList.toggle('on',b.dataset.v===state.res));
  document.getElementById('season').checked=state.season;
  document.getElementById('lag').value=state.lag; document.getElementById('lagval').textContent=state.lag;
  document.getElementById('split').value=state.split; document.getElementById('splitval').textContent=state.split+'%';
  FACTORS.forEach(f=>{const st=state.factors[f.id];const div=document.getElementById('f_'+f.id);
    div.querySelector('input[type=checkbox]').checked=st.on;
    div.querySelector('input[type=range]').value=st.val;
    div.querySelector('.val').textContent=st.val+f.unit;
    div.classList.toggle('off',!st.on);});
}
function applyPreset(p){
  state.company=p.company; state.res=p.res; state.season=p.season; state.lag=p.lag; state.split=p.split;
  FACTORS.forEach(f=>{const on=(f.id in p.factors);
    state.factors[f.id]={on, val:on?p.factors[f.id]:state.factors[f.id].val};});
  syncUI(); render();
}

// ---------- statistics ----------
function rank(arr){
  const idx=arr.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]);
  const r=new Array(arr.length); let i=0;
  while(i<idx.length){let j=i; while(j+1<idx.length&&idx[j+1][0]===idx[i][0])j++;
    const avg=(i+j)/2+1; for(let k=i;k<=j;k++)r[idx[k][1]]=avg; i=j+1;}
  return r;
}
function pearson(x,y){const n=x.length;let mx=0,my=0;for(let i=0;i<n;i++){mx+=x[i];my+=y[i];}
  mx/=n;my/=n;let sxy=0,sx=0,sy=0;for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;sxy+=dx*dy;sx+=dx*dx;sy+=dy*dy;}
  if(sx===0||sy===0)return 0;return sxy/Math.sqrt(sx*sy);}
function spearman(x,y){return pearson(rank(x),rank(y));}
// incomplete beta -> Student-t two-sided p
function gammln(x){const c=[76.18009172947146,-86.50532032941677,24.01409824083091,
  -1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];let y=x,t=x+5.5;
  t-=(x+0.5)*Math.log(t);let s=1.000000000190015;for(let j=0;j<6;j++){y++;s+=c[j]/y;}
  return -t+Math.log(2.5066282746310005*s/x);}
function betacf(a,b,x){const FPMIN=1e-300;let qab=a+b,qap=a+1,qam=a-1;let c=1,d=1-qab*x/qap;
  if(Math.abs(d)<FPMIN)d=FPMIN;d=1/d;let h=d;
  for(let m=1;m<200;m++){let m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;
    c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;let del=d*c;h*=del;if(Math.abs(del-1)<3e-7)break;}
  return h;}
function betai(a,b,x){if(x<=0)return 0;if(x>=1)return 1;
  const bt=Math.exp(gammln(a+b)-gammln(a)-gammln(b)+a*Math.log(x)+b*Math.log(1-x));
  if(x<(a+1)/(a+b+2))return bt*betacf(a,b,x)/a;return 1-bt*betacf(b,a,1-x)/b;}
function tPvalue(r,n){if(n<3)return 1;const df=n-2;const t=r*Math.sqrt(df/(1-r*r+1e-12));
  return betai(df/2,0.5,df/(df+t*t));}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;}

// ---------- aggregation ----------
function periodKey(dateStr,res){const dt=new Date(dateStr+'T00:00:00');
  if(res==='monthly')return dateStr.slice(0,7);
  // ISO-ish week: Monday start
  const day=(dt.getDay()+6)%7; const mon=new Date(dt); mon.setDate(dt.getDate()-day);
  return mon.toISOString().slice(0,10);}
function isBad(rec){for(const f of FACTORS){const st=state.factors[f.id];if(!st.on)continue;
  const v=rec[f.col];if(f.dir==='>='?v>=st.val:v<=st.val)return true;}return false;}

function buildPeriods(){
  const recs = state.company==='pooled'
     ? Object.keys(DATA).flatMap(k=>DATA[k].records.map(r=>({...r,_c:k})))
     : DATA[state.company].records.map(r=>({...r,_c:state.company}));
  const map={}; // key = company|period
  for(const r of recs){const pk=periodKey(r.d,state.res);const key=r._c+'|'+pk;
    if(!map[key])map[key]={c:r._c,pk,rev:0,bad:0,month:+(state.res==='monthly'?pk.slice(5,7):r.d.slice(5,7))};
    map[key].rev+=r.rev; if(isBad(r))map[key].bad+=1;}
  let arr=Object.values(map).sort((a,b)=>a.pk<b.pk?-1:1);
  // lag: shift bad-days relative to revenue, within company
  if(state.lag>0){const byC={};arr.forEach(p=>{(byC[p.c]=byC[p.c]||[]).push(p)});
    Object.values(byC).forEach(list=>{const bads=list.map(p=>p.bad);
      list.forEach((p,i)=>{p.badLag = i-state.lag>=0?bads[i-state.lag]:null;});});
    arr=arr.filter(p=>p.badLag!==null);}
  else arr.forEach(p=>p.badLag=p.bad);
  // season adjust: subtract company-month mean from rev and feature
  if(state.season){const g={};arr.forEach(p=>{const k=p.c+'|'+p.month;(g[k]=g[k]||[]).push(p)});
    Object.entries(g).forEach(([k,list])=>{const mr=list.reduce((s,p)=>s+p.rev,0)/list.length;
      const mb=list.reduce((s,p)=>s+p.badLag,0)/list.length;
      list.forEach(p=>{p.revAdj=p.rev-mr;p.badAdj=p.badLag-mb;});});}
  else arr.forEach(p=>{p.revAdj=p.rev;p.badAdj=p.badLag;});
  return arr;
}

// ---------- rendering ----------
function fmtMoney(v){const a=Math.abs(v);if(a>=1e6)return (v/1e6).toFixed(2)+'M';
  if(a>=1e3)return (v/1e3).toFixed(0)+'k';return v.toFixed(0);}

function render(){
  const periods=buildPeriods();
  const x=periods.map(p=>p.badAdj), y=periods.map(p=>p.revAdj), n=periods.length;
  const r = n>4?spearman(x,y):0;
  const p = n>4?tPvalue(r,n):1;

  document.getElementById('rval').textContent=(r>=0?'+':'')+r.toFixed(3);
  document.getElementById('rdir').innerHTML = r<0
     ? '<span class="neg">more bad weather → lower revenue</span>'
     : '<span class="pos">more bad weather → higher revenue</span>';
  document.getElementById('pval').textContent = p<0.001?'<0.001':p.toFixed(3);
  const pb=document.getElementById('pbadge');
  if(p<0.05){pb.className='badge b-strong';pb.textContent='SIGNIFICANT (p<0.05)';}
  else if(p<0.10){pb.className='badge b-weak';pb.textContent='WEAK (p<0.10)';}
  else{pb.className='badge b-no';pb.textContent='not significant';}

  // revenue impact: top vs bottom group by raw bad-days, using RAW revenue
  const sorted=[...periods].sort((a,b)=>a.badLag-b.badLag);
  const q=Math.round(periods.length*state.split/100);
  const low=sorted.slice(0,q).map(p=>p.rev);   // fewest bad days = "good" periods
  const high=sorted.slice(-q).map(p=>p.rev);    // most bad days = "bad" periods
  const mlow=median(low), mhigh=median(high);
  const pct = mlow>0?100*(mhigh/mlow-1):0;
  const imp=document.getElementById('impact');
  imp.textContent=(pct>=0?'+':'')+pct.toFixed(1)+'%';
  imp.className='big '+(pct<0?'neg':'pos');
  document.getElementById('impactsub').textContent=
     `bad periods €${fmtMoney(mhigh)} vs good €${fmtMoney(mlow)} (median)`;
  document.getElementById('nval').textContent=n;
  document.getElementById('nsub').textContent=(state.res)+' periods'+(state.lag?` · lag ${state.lag}`:'');

  const enabled=FACTORS.filter(f=>state.factors[f.id].on)
     .map(f=>`${f.lbl} ${state.factors[f.id].val}${f.unit}`).join('  ·  ');
  document.getElementById('scatnote').textContent=
    `A "bad day" = any enabled condition met. Each point is one ${state.res.slice(0,-2)} period`+
    (state.season?', season-adjusted.':'.');
  document.getElementById('footnote').innerHTML=
    `<b>Definition:</b> ${enabled||'(no factors enabled)'} &nbsp;|&nbsp; `+
    `${n} periods, Spearman r=${r.toFixed(3)}, p=${p<0.001?'<0.001':p.toFixed(3)}. `+
    `Note: revenue is invoice-dated, so day-level effects (esp. rain) are blurred; treat single results cautiously.`;

  drawScatter(x,y,r);
  drawTS(periods);
}

function setupCanvas(cv){const dpr=window.devicePixelRatio||1;const w=cv.clientWidth,h=cv.clientHeight;
  cv.width=w*dpr;cv.height=h*dpr;const ctx=cv.getContext('2d');ctx.scale(dpr,dpr);return {ctx,w,h};}

function drawScatter(x,y,r){
  const cv=document.getElementById('scatter');const {ctx,w,h}=setupCanvas(cv);
  ctx.clearRect(0,0,w,h);const pad=44;
  if(!x.length)return;
  const xmin=Math.min(...x),xmax=Math.max(...x),ymin=Math.min(...y),ymax=Math.max(...y);
  const sx=v=>pad+(v-xmin)/((xmax-xmin)||1)*(w-pad-12);
  const sy=v=>h-pad-(v-ymin)/((ymax-ymin)||1)*(h-pad-12);
  // axes
  ctx.strokeStyle='#334155';ctx.lineWidth=1;ctx.beginPath();
  ctx.moveTo(pad,12);ctx.lineTo(pad,h-pad);ctx.lineTo(w-12,h-pad);ctx.stroke();
  ctx.fillStyle='#94a3b8';ctx.font='11px sans-serif';
  ctx.fillText('bad-weather days →',w/2-40,h-14);
  ctx.save();ctx.translate(14,h/2+40);ctx.rotate(-Math.PI/2);ctx.fillText('revenue'+(state.season?' (adj)':''),0,0);ctx.restore();
  // points
  ctx.fillStyle='rgba(56,189,248,.55)';
  for(let i=0;i<x.length;i++){ctx.beginPath();ctx.arc(sx(x[i]),sy(y[i]),3.3,0,7);ctx.fill();}
  // regression line
  const b=pearsonSlope(x,y);ctx.strokeStyle=r<0?'#f87171':'#34d399';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(sx(xmin),sy(b.a+b.m*xmin));ctx.lineTo(sx(xmax),sy(b.a+b.m*xmax));ctx.stroke();
}
function pearsonSlope(x,y){const n=x.length;let mx=0,my=0;for(let i=0;i<n;i++){mx+=x[i];my+=y[i];}
  mx/=n;my/=n;let sxy=0,sx=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;}
  const m=sx?sxy/sx:0;return {m,a:my-m*mx};}

function drawTS(periods){
  const cv=document.getElementById('ts');const {ctx,w,h}=setupCanvas(cv);
  ctx.clearRect(0,0,w,h);const pad=40;
  // show one company (or pooled sum per period)
  const map={};periods.forEach(p=>{map[p.pk]=map[p.pk]||{rev:0,bad:0,k:0};
    map[p.pk].rev+=p.rev;map[p.pk].bad+=p.badLag;map[p.pk].k++;});
  const keys=Object.keys(map).sort();const rev=keys.map(k=>map[k].rev);const bad=keys.map(k=>map[k].bad/map[k].k);
  if(!keys.length)return;
  const rmax=Math.max(...rev),bmax=Math.max(...bad,1);
  const sx=i=>pad+i/((keys.length-1)||1)*(w-pad-12);
  const syR=v=>h-pad-v/(rmax||1)*(h-pad-12);
  const syB=v=>h-pad-v/(bmax)*(h-pad-12);
  // bad bars
  ctx.fillStyle='rgba(248,113,113,.35)';const bw=Math.max(1,(w-pad-12)/keys.length-1);
  keys.forEach((k,i)=>{const bh=(h-pad-12)*bad[i]/bmax;ctx.fillRect(sx(i)-bw/2,h-pad-bh,bw,bh);});
  // revenue line
  ctx.strokeStyle='#38bdf8';ctx.lineWidth=1.8;ctx.beginPath();
  keys.forEach((k,i)=>{i?ctx.lineTo(sx(i),syR(rev[i])):ctx.moveTo(sx(i),syR(rev[i]));});ctx.stroke();
  ctx.strokeStyle='#334155';ctx.beginPath();ctx.moveTo(pad,h-pad);ctx.lineTo(w-12,h-pad);ctx.stroke();
  ctx.fillStyle='#94a3b8';ctx.font='10px sans-serif';
  ctx.fillText(keys[0],pad,h-pad+14);ctx.fillText(keys[keys.length-1],w-70,h-pad+14);
}

// ---------- UI wiring ----------
function buildUI(){
  const comp=document.getElementById('company');
  Object.keys(DATA).forEach((k,i)=>{const b=document.createElement('button');
    b.textContent=DATA[k].name.split(' (')[0];b.dataset.v=k;if(i===0)b.className='on';
    b.onclick=()=>{state.company=k;[...comp.children].forEach(c=>c.classList.toggle('on',c===b));render();};
    comp.appendChild(b);});
  const pooled=document.createElement('button');pooled.textContent='Pooled';pooled.dataset.v='pooled';
  pooled.onclick=()=>{state.company='pooled';[...comp.children].forEach(c=>c.classList.toggle('on',c===pooled));render();};
  comp.appendChild(pooled);

  document.querySelectorAll('#res button').forEach(b=>b.onclick=()=>{
    state.res=b.dataset.v;document.querySelectorAll('#res button').forEach(c=>c.classList.toggle('on',c===b));render();});

  const fc=document.getElementById('factors');
  FACTORS.forEach(f=>{const st=state.factors[f.id];
    const div=document.createElement('div');div.className='factor'+(st.on?'':' off');div.id='f_'+f.id;
    div.innerHTML=`<div class="top"><label><input type="checkbox" ${st.on?'checked':''}> ${f.lbl}</label>
      <span class="val">${st.val}${f.unit}</span></div>
      <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${st.val}">`;
    const cb=div.querySelector('input[type=checkbox]'),rg=div.querySelector('input[type=range]'),
          vs=div.querySelector('.val');
    cb.onchange=()=>{st.on=cb.checked;div.classList.toggle('off',!st.on);render();};
    rg.oninput=()=>{st.val=+rg.value;vs.textContent=st.val+f.unit;render();};
    fc.appendChild(div);});

  document.getElementById('season').onchange=e=>{state.season=e.target.checked;render();};
  document.getElementById('lag').oninput=e=>{state.lag=+e.target.value;document.getElementById('lagval').textContent=e.target.value;render();};
  document.getElementById('split').oninput=e=>{state.split=+e.target.value;document.getElementById('splitval').textContent=e.target.value+'%';render();};

  const pc=document.getElementById('presets');
  PRESETS.forEach(p=>{const b=document.createElement('button');b.className='preset';
    const tb=document.createElement('b');tb.textContent=p.t;
    const sp=document.createElement('span');sp.textContent=p.d;
    b.appendChild(tb);b.appendChild(sp);b.onclick=()=>applyPreset(p);pc.appendChild(b);});
}
buildUI();render();
window.addEventListener('resize',render);
</script>
</body>
</html>"""


def main() -> None:
    data = build_records()
    html = HTML.replace("__DATA__", json.dumps(data, separators=(",", ":")))
    OUT.write_text(html)
    size_kb = len(html) / 1024
    print(f"Saved: {OUT}  ({size_kb:.0f} KB)")
    for k, v in data.items():
        print(f"  {k}: {len(v['records'])} daily records")


if __name__ == "__main__":
    main()
