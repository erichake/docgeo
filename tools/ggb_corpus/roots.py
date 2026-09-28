import json, os, re, zipfile, collections as C
HERE = os.path.dirname(os.path.abspath(__file__))
import xml.etree.ElementTree as ET
rows=[json.loads(l) for l in open(os.path.join(HERE, "results.jsonl")) if l.strip()]
rows=[r for r in rows if "Missing geogebra.xml" not in (r["error"] or "")]
WORD=re.compile(r"[A-Za-z_À-ɏͰ-Ͽ][\wÀ-ɏͰ-Ͽ']*")
ok=[r for r in rows if not r["error"] and not r["unsupported"] and (r["commands"] or r["types"])]
print("figures",sum(1 for r in rows if r["commands"] or r["types"]),"sans perte",len(ok),"plantages",sum(1 for r in rows if r["error"]))
for r in rows:
    if r["error"]: print("  PLANTAGE",r["name"],r["error"][:150])
ms=sorted(r["ms"] for r in rows if not r["error"])
print("import ms: médiane %.1f, p95 %.1f, max %.1f"%(ms[len(ms)//2],ms[int(len(ms)*.95)],ms[-1]))
rootfiles=C.Counter(); rootonly=C.Counter(); samples=C.defaultdict(list); nroot={}
for r in rows:
    if not r["unsupported"]: continue
    root=ET.fromstring(zipfile.ZipFile(os.path.join(HERE, "corpus", r["name"])).read("geogebra.xml"))
    cons=root.find("construction")
    exprs={e.get("label"):e.get("exp") for e in cons.findall("expression")}
    cmds=[]
    for c in cons.findall("command"):
        ins=c.find("input"); outs=c.find("output")
        ins=[v for k,v in sorted((ins.attrib if ins is not None else {}).items())]
        outs=[v for k,v in sorted((outs.attrib if outs is not None else {}).items()) if v]
        cmds.append((c.get("name"),ins,outs))
    bad=set(); entries=[]
    for u in r["unsupported"]:
        m=re.match(r"^([A-Za-z]+)\((.*)\)$",u)
        if m:
            for name,ins,outs in cmds:
                if name==m.group(1) and ", ".join(ins)==m.group(2):
                    bad.update(outs); entries.append(("cmd "+name,set(WORD.findall(" ".join(ins))),u)); break
            else: entries.append(("cmd "+m.group(1),set(),u))
        elif u.startswith("condition "):
            entries.append(("condition",set(WORD.findall(u[10:])),u))
        else:
            t,_,label=u.partition(" "); bad.add(label)
            entries.append((t,set(WORD.findall(exprs.get(label) or "")),u))
    roots=set()
    for k,deps,u in entries:
        if not (deps & bad):
            roots.add(k); 
            if len(samples[k])<4: samples[k].append(u[:90])
    for k in roots: rootfiles[k]+=1
    if len(roots)==1: rootonly[next(iter(roots))]+=1
    nroot[r["name"]]=roots
print("files with issues",len(nroot))
print("cause                 files  seule-cause")
for k,v in rootfiles.most_common(60): print(f"  {k:22} {v:4} {rootonly[k]:4}   {samples[k][:3]}")
json.dump({k:list(v) for k,v in nroot.items()},open(os.path.join(HERE, "roots.json"), "w"))
