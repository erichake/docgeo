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
# The command and function names ggb_translate.ts reads: its handlers, its
# formula commands and functions.
SRC=open(os.path.join(HERE,"..","..","src","import","ggb_translate.ts")).read()
def block(start,end):
    i=SRC.index(start); return SRC[i:SRC.index(end,i)]
KNOWN=set(re.findall(r"^ {8}(\w+):",block("const HANDLERS","\n    };"),re.M))
KNOWN|=set(re.findall(r"^ {4}(\w+):",block("const FUNCTIONS","\n};")+block("const ITEM_FUNCTIONS","\n};"),re.M))
KNOWN|=set(re.findall(r'"(\w+)"',block("const FORMULA_COMMANDS","]);")+block("const LIST_COMMANDS","]);")))
# Name[A], read as a text's term (see textParts).
KNOWN.add("Name")
# GeoGebra's commands, by their syntax in its English command names.
GGB=os.path.join(HERE,"..","..","..","doctools_MAIN","public","apps","geogebra","web3d","js","properties_keys_en.js")
COMMANDS=set(re.findall(r'\\"(\w+)\.Syntax(?:CAS|3D)?\\"',open(GGB).read()))
CALL=re.compile(r"([A-Za-z]\w*)\s*[\[(]")
hidden=C.Counter(); hiddensamples=C.defaultdict(list); macros=C.Counter()
rootentries={}; rootfiles=C.Counter(); rootonly=C.Counter(); samples=C.defaultdict(list); nroot={}
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
            # Its own name, which "Cone: z = …" writes, isn't a dependency.
            entries.append((t,set(WORD.findall(exprs.get(label) or ""))-{label},u))
    # Unknown names inside an unsupported element, which only its outermost
    # command names as a cause: UnitVector in Circle(A, r, UnitVector[v]).
    labels={e.get("label") for e in cons.findall("element")}|set(exprs)
    # A figure's own tools, which its commands may call.
    z=zipfile.ZipFile(os.path.join(HERE, "corpus", r["name"]))
    tools=set(re.findall(r'<macro cmdName="([^"]+)"',z.read("geogebra_macro.xml").decode())) if "geogebra_macro.xml" in z.namelist() else set()
    names=set()
    for u in r["unsupported"]:
        m=re.match(r"^([A-Za-z]+)\((.*)\)$",u)
        source=m.group(2) if m else u[10:] if u.startswith("condition ") else exprs.get(u.partition(" ")[2]) or ""
        for n in set(CALL.findall(re.sub(r'"[^"]*"','',source)))-KNOWN-labels:
            if n in tools: macros[n]+=1; continue
            # Lowercase, one of GeoGebra's functions.
            if n not in COMMANDS and not n[0].islower(): continue
            names.add(n)
            if len(hiddensamples[n])<3: hiddensamples[n].append(u[:90])
    for n in names: hidden[n]+=1
    rootentries[r["name"]]=[u for k,deps,u in entries if not (deps & bad)]
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
print("commandes inconnues à l'intérieur des éléments non importés   files")
for k,v in hidden.most_common(60): print(f"  {k:22} {v:4}   {hiddensamples[k][:2]}")
print("outils personnalisés (macros) appelés par des éléments non importés",len(macros))
json.dump({k:list(v) for k,v in nroot.items()},open(os.path.join(HERE, "roots.json"), "w"))

# python3 roots.py 'Angle(' 'numeric ': each figure's root causes starting
# so, with its number of root causes.
import sys
for f,us in rootentries.items():
    for u in us:
        if any(u.startswith(k) for k in sys.argv[1:]): print(f, len(nroot[f]), u[:110])
