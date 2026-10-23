#!/usr/bin/env python3
"""Build the static JSON the Savor site loads.

Inputs (read-only): ../arkansas_restaurants.json, ../stats.json, ../raw/2020_Gaz_zcta_national.txt,
../runs/*.json (rating runs; *.plan.json and _progress.json are skipped as runs), ../runs/_progress.json.
Outputs: data/restaurants.json, data/ratings.json, data/zips.json, data/meta.json.
Ratings are merged by OSM id across all runs; the newest run (run date, then file mtime) wins.
"""
import json, glob, os, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "data")
os.makedirs(OUT, exist_ok=True)

ds = json.load(open(os.path.join(ROOT, "arkansas_restaurants.json")))
rest = ds["restaurants"]
VALID = {"green", "yellow", "red", "unknown", "closed"}

# restaurants (compact arrays)
FIELDS = ["id", "name", "lat", "lon", "cuisine", "city", "zip", "address", "website", "amenity", "cuisine_source", "brand"]
rows = []
for r in rest:
    rows.append([r["osm_id"], r["name"], round(r["lat"], 6), round(r["lon"], 6), r["cuisine_group"], r.get("city", ""),
                 r.get("zip", ""), r.get("address", ""), r.get("website", ""), r.get("amenity", ""),
                 r.get("cuisine_source", ""), r.get("brand", "")])
json.dump({"fields": FIELDS, "rows": rows}, open(os.path.join(OUT, "restaurants.json"), "w"), separators=(",", ":"))
ids = {r["osm_id"] for r in rest}

# ratings: merge all runs
ratings, runs_meta, gaps = {}, [], []
files = [f for f in glob.glob(os.path.join(ROOT, "runs", "*.json"))
         if not f.endswith(".plan.json") and not os.path.basename(f).startswith("_")]
def key(f):
    try:
        d = json.load(open(f)).get("date", "")
    except Exception:
        d = ""
    return (str(d), os.path.getmtime(f))
for f in sorted(files, key=key):
    try:
        run = json.load(open(f))
    except Exception as e:
        print("skip (bad json)", f, e); continue
    items = run.get("researched") or run.get("rated") or run.get("restaurants") or []
    n = 0
    for it in items:
        oid = it.get("osm_id") or (it.get("osm_url", "").split("openstreetmap.org/")[-1] if it.get("osm_url") else None)
        rating = str(it.get("rating", "")).lower()
        if not oid or rating not in VALID:
            continue
        ratings[oid] = {"rating": rating, "reason": it.get("reason", ""), "sources": it.get("sources", []),
                        "town": it.get("town", ""), "confidence": it.get("confidence") or ("none" if rating == "unknown" else ("high" if len(it.get("sources") or []) >= 2 else "low")), "run": run.get("run", os.path.basename(f)),
                        "date": run.get("date", ""), "in_dataset": oid in ids}
        n += 1
    for g in run.get("osm_gaps_found", []) or []:
        if g not in gaps:
            gaps.append(g)
    runs_meta.append({"file": os.path.basename(f), "run": run.get("run", ""), "date": run.get("date", ""), "rated": n})
json.dump(ratings, open(os.path.join(OUT, "ratings.json"), "w"), separators=(",", ":"))

# zips (ZCTA centroids for every ZIP in the dataset + all Arkansas ZCTAs 716xx-729xx)
need = {r.get("zip", "") for r in rest}
zips = {}
with open(os.path.join(ROOT, "raw", "2020_Gaz_zcta_national.txt")) as fh:
    next(fh)
    for line in fh:
        p = line.split("\t")
        z = p[0].strip()
        if z in need or "716" <= z[:3] <= "729":
            zips[z] = [round(float(p[5]), 5), round(float(p[6]), 5)]
json.dump(zips, open(os.path.join(OUT, "zips.json"), "w"), separators=(",", ":"))

# progress / meta
prog = {}
pp = os.path.join(ROOT, "runs", "_progress.json")
if os.path.exists(pp):
    try:
        prog = json.load(open(pp))
    except Exception as e:
        print("bad _progress.json", e)
rated_in_ds = sum(1 for k, v in ratings.items() if v["in_dataset"])
stats = json.load(open(os.path.join(ROOT, "stats.json")))
meta = {"total": len(rest), "rated": rated_in_ds, "progress": prog, "runs": runs_meta, "osm_gaps": gaps,
        "osm_timestamp": ds.get("osm_base_timestamp", ""), "dataset_built": ds.get("built", ""),
        "built": datetime.datetime.now().astimezone().isoformat(timespec="minutes"), "stats": stats}
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
print(f"restaurants={len(rows)} ratings={len(ratings)} (in dataset {rated_in_ds}) runs={len(runs_meta)} zips={len(zips)} progress={'yes' if prog else 'no'}")
