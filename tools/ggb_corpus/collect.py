import json, os, re, sys, time, urllib.request, urllib.parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus")
os.makedirs(OUT, exist_ok=True)
QUERIES = [
    "triangle", "cercle", "fonction", "tangente", "symétrie", "thalès",
    "pythagore", "parabole", "vecteur", "homothétie", "rotation", "médiatrice",
    "bissectrice", "cercle circonscrit", "droite d'euler", "polygone régulier",
    "dérivée", "intégrale", "suite", "trigonométrie", "cercle trigonométrique",
    "ellipse", "lieu", "parallélogramme", "quadrilatère", "aire", "angle inscrit",
    "cube", "pyramide", "section", "patron", "translation", "fractale",
    "courbe paramétrée", "exponentielle", "logarithme", "second degré",
    "géométrie dynamique", "probabilité", "statistique",
    "circumcircle", "incircle", "tangent line", "derivative", "riemann sum",
    "conic", "locus", "reflection", "dilation", "transformations",
    "unit circle", "slope", "linear function", "quadratic", "sine graph",
    "inscribed angle", "nine point circle", "euler line", "similar triangles",
    "congruent triangles", "area of triangle", "perpendicular bisector",
    "3d solid", "cone", "sphere", "polyhedron", "vector", "parametric curve",
]
PER_QUERY = int(sys.argv[1]) if len(sys.argv) > 1 else 20


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


seen, files = set(), set(os.listdir(OUT))
for query in QUERIES:
    try:
        hits = json.loads(get(
            "https://api.geogebra.org/v1.0/search/materials?"
            + urllib.parse.urlencode({"query": query, "size": PER_QUERY})
        )).get("hits", [])
    except Exception as e:
        print("search failed", query, e)
        continue
    got = 0
    for hit in hits:
        if hit["type"] != "ws" or hit["id"] in seen:
            continue
        seen.add(hit["id"])
        try:
            material = json.loads(get(
                f"https://api.geogebra.org/v1.0/materials/{hit['id']}?scope=extended"
            ))
        except Exception:
            continue
        for element in material.get("elements", []):
            url = element.get("url") or ""
            m = re.search(r"/material-(\w+)\.ggb$", url)
            if element.get("type") != "G" or not m:
                continue
            name = f"{m.group(1)}.ggb"
            if name in files:
                continue
            try:
                data = get(url)
            except Exception:
                continue
            if data[:2] != b"PK":
                continue
            with open(os.path.join(OUT, name), "wb") as f:
                f.write(data)
            files.add(name)
            got += 1
        time.sleep(0.15)
    print(f"{query}: +{got} (total {len(files)})", flush=True)
