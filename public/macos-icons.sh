#!/bin/sh
# DocGeo file icons (.dgo, .dgp, .ggb) on macOS, for the editor installed as a browser app.
# Install:   curl -fsSL https://doctools.org/apps/docgeo/macos-icons.sh | sh
# Uninstall: curl -fsSL https://doctools.org/apps/docgeo/macos-icons.sh | sh -s uninstall
# The icons are declared by a small app built here (never downloaded, never launched),
# so Chrome updates leave them in place.
set -e
URL=https://doctools.org/apps/docgeo
APP="$HOME/Applications/DocGeo Types.app"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

remove() {
  if [ -d "$APP" ]; then "$LSREGISTER" -u "$APP" || true; rm -rf "$APP"; fi
}

# macOS keeps a type's icon in its icon cache, even across restarts.
restart() {
  echo "$1 macOS must now clear its icon cache and restart."
  echo "Save your work and quit your apps, then press Return (Ctrl-C to cancel)."
  read _ </dev/tty
  echo "Type your password (it is not shown):"
  sudo sh -c 'rm -rf /Library/Caches/com.apple.iconservices.store && reboot'
}

if [ "$1" = uninstall ]; then
  remove
  restart "DocGeo file icons removed."
  exit
fi

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
B="$T/DocGeo Types.app"
mkdir -p "$B/Contents/Resources" "$B/Contents/MacOS"
for e in dgo dgp ggb; do
  curl -fsSL "$URL/file_$e.png" -o "$T/$e.png"
  mkdir "$T/$e.iconset"
  for z in 16 32 128 256 512; do
    sips -z $z $z "$T/$e.png" --out "$T/$e.iconset/icon_${z}x$z.png" >/dev/null
    if [ $z -le 256 ]; then sips -z $((z*2)) $((z*2)) "$T/$e.png" --out "$T/$e.iconset/icon_${z}x$z@2x.png" >/dev/null; fi
  done
  iconutil -c icns "$T/$e.iconset" -o "$B/Contents/Resources/$e.icns"
done
printf '#!/bin/sh\n' > "$B/Contents/MacOS/types"
chmod +x "$B/Contents/MacOS/types"

decl() {
  echo "<dict><key>UTTypeIdentifier</key><string>org.doctools.docgeo.$1</string><key>UTTypeDescription</key><string>$2</string><key>UTTypeConformsTo</key><array><string>public.data</string></array><key>UTTypeIconFile</key><string>$1.icns</string><key>UTTypeTagSpecification</key><dict><key>public.filename-extension</key><array><string>$1</string></array><key>public.mime-type</key><array><string>$3</string></array></dict></dict>"
}
cat > "$B/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>org.doctools.docgeo.types</string>
<key>CFBundleName</key><string>DocGeo Types</string>
<key>CFBundleExecutable</key><string>types</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSUIElement</key><true/>
<key>UTExportedTypeDeclarations</key><array>
$(decl dgo "Figure DocGeo" application/x-docgeo)$(decl dgp "Figure DGPad" application/x-dgpad)$(decl ggb "Figure GeoGebra" application/vnd.geogebra.file)
</array></dict></plist>
EOF
codesign --force -s - "$B" 2>/dev/null
remove
mkdir -p "$HOME/Applications"
mv "$B" "$APP"
"$LSREGISTER" -f "$APP"
restart "DocGeo file icons installed."
