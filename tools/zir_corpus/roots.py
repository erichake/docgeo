# Summarizes results.jsonl: unsupported items by kind, and the figures
# they block. python3 tools/zir_corpus/roots.py [kind]
import json, re, sys, collections
rows = [json.loads(l) for l in open("tools/zir_corpus/results.jsonl")]
kinds = collections.defaultdict(set)
for r in rows:
    for u in r["unsupported"]:
        # A workbook's items are prefixed by their page's name.
        if r["pages"] > 1: u = u.split(": ", 1)[1]
        m = re.match(r"CaRMetal: (\w+) ", u) or re.match(r"(\w+)\(", u)
        kinds[m.group(1) if m else u[:70]].add(r["name"])
clean = [r for r in rows if not r["unsupported"] and not r["error"]]
print(f"{len(clean)}/{len(rows)} files with nothing unsupported")
for r in rows:
    if r["error"]: print("ERROR", r["name"], r["error"])
if len(sys.argv) > 1:
    print("\n".join(sorted(kinds[sys.argv[1]])))
else:
    print("Failed formulas' first unknown name:")
fails = collections.defaultdict(set)
for r in rows:
    for x in r.get("fails", []): fails[re.sub(r" at line \d+", "", x)].add(r["name"])
print(" ".join(f"{k}:{len(f)}" for k, f in sorted(fails.items(), key=lambda kv: -len(kv[1]))[:40]))
for k, f in sorted(kinds.items(), key=lambda kv: -len(kv[1])):
        print(len(f), k)
