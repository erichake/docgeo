import collections as C, json, os, sys
# Summarizes results.jsonl (see editability.test.ts), restricted to the
# figures whose path starts with one of the arguments (tests/dgp, …).
HERE = os.path.dirname(os.path.abspath(__file__))
rows = [json.loads(l) for l in open(os.path.join(HERE, "results.jsonl")) if l.strip()]
rows = [r for r in rows if not sys.argv[1:] or any(r["name"].startswith(p) for p in sys.argv[1:])]
rows = [r for r in rows if "Missing geogebra.xml" not in (r["error"] or "")]
origin = lambda r: "ggb_corpus" if r["name"].startswith("ggb_corpus") else "/".join(r["name"].split("/")[:2])
crashed = [r for r in rows if r["error"]]
rows = [r for r in rows if not r["error"] and r["objects"]]

print("origine            figures  éditables  objets  sans ligne  refusés")
for o in sorted({origin(r) for r in rows}):
    rs = [r for r in rows if origin(r) == o]
    print(f"  {o:16} {len(rs):7} {sum(not r['missing'] and not r['refused'] for r in rs):10}"
          f" {sum(r['objects'] for r in rs):7} {sum(len(r['missing']) for r in rs):11} {sum(len(r['refused']) for r in rs):8}")
n = sum(r["objects"] for r in rows); bad = sum(len(r["missing"]) + len(r["refused"]) for r in rows)
print(f"  {'total':16} {len(rows):7} {sum(not r['missing'] and not r['refused'] for r in rows):10} {n:7}   objets éditables {100 * (n - bad) / n:.1f} %")
for r in crashed: print("  PLANTAGE", r["name"], r["error"][:150])

def table(title, key, entries, sample):
    objects = C.Counter(); figures = C.Counter(); alone = C.Counter(); samples = C.defaultdict(list)
    for r in rows:
        keys = set()
        for e in entries(r):
            k = key(e); objects[k] += 1; keys.add(k)
            if len(samples[k]) < 3 and not any(s.startswith(r["name"]) for s in samples[k]):
                samples[k].append(f"{r['name']}: {sample(e)}")
        for k in keys: figures[k] += 1
        # The figures it alone keeps from being wholly editable.
        if len(keys) == 1 and not (r["missing"] and r["refused"]): alone[next(iter(keys))] += 1
    if not objects: return
    print(f"\n{title}\n  {'':30} objets figures seule")
    for k, n in figures.most_common():
        print(f"  {k:30} {objects[k]:6} {n:7} {alone[k]:5}")
        for s in samples[k]: print(f"      {s[:150]}")

table("Lecture seule, par type .dgo", lambda e: e["tag"], lambda r: r["missing"], lambda e: e["name"])
table("Lecture seule (GeoGebra), par commande ou type d'élément", lambda e: e.get("source") or "(auxiliaire)",
      lambda r: [e for r2 in [r] if r2["name"].endswith(".ggb") for e in r2["missing"]], lambda e: f"{e['name']} [{e['tag']}]")
table("Ligne refusée telle quelle, par type .dgo et erreur", lambda e: f"{e['tag']} {e['error']}"[:30],
      lambda r: r["refused"], lambda e: e["line"])
