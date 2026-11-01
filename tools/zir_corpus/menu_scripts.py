# Inventories CaRMetal's menu scripts (<Script> without mousedrag nor
# onload="true") of tests/zirz: the functions they call, and whether each builds
# objects or only handles existing ones. See CARMETAL.md.
#   python3 tools/zir_corpus/menu_scripts.py [text to show the scripts of]
import collections, glob, gzip, html, re, sys, zipfile

BUILD = set(
    "Point Segment Polygon Symmetry MidPoint Quadric Triangle Line Circle "
    "Perpendicular Angle Intersection Intersection2 Rotation ExecuteMacro "
    "TracePt3D TracePoint Delete Array".split()
)


def figures(path):
    data = open(path, "rb").read()
    if data[:2] == b"\x1f\x8b":
        yield path, gzip.decompress(data).decode("utf8", "replace")
    elif data[:2] == b"PK":
        archive = zipfile.ZipFile(path)
        for name in archive.namelist():
            if name.endswith(".zir"):
                yield f"{path}:{name}", archive.read(name).decode("utf8", "replace")
    else:
        yield path, data.decode("utf8", "replace")


scripts = []
for path in sorted(glob.glob("tests/zirz/**/*.zir*", recursive=True)):
    for name, xml in figures(path):
        for match in re.finditer(r"<Script([^>]*)>(.*?)</Script>", xml, re.S):
            if re.search(r'mousedrag="[^"]|onload="true"', match.group(1)):
                continue
            title = re.search(r'Name="([^"]*)"', match.group(1))
            scripts.append(
                (name, html.unescape(title.group(1) if title else ""), html.unescape(match.group(2)))
            )

calls = collections.Counter()
kinds = collections.defaultdict(list)
for name, title, code in scripts:
    used = set(re.findall(r"\b([A-Z]\w*)\s*\(", code))
    calls.update(used)
    kinds["builds" if used & BUILD else "handles"].append(f"{name} | {title}")
print(len(scripts), "menu scripts in", len({s[0].split(":")[0] for s in scripts}), "files")
print(" ".join(f"{f}:{n}" for f, n in calls.most_common(60)))
for kind, items in kinds.items():
    print(f"\n{kind}: {len(items)}")
    print("\n".join(items))
if len(sys.argv) > 1:
    for name, title, code in scripts:
        if sys.argv[1] in f"{name} {title}":
            print(f"\n===== {name} | {title}\n{code.strip()}")
