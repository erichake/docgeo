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

case $(defaults read -g AppleLanguages 2>/dev/null | sed -n 2p | tr -d ' ",') in
  fr*) I="Icônes DocGeo installées."; R="Icônes DocGeo retirées." ;;
  de*) I="DocGeo-Symbole installiert."; R="DocGeo-Symbole entfernt." ;;
  es*) I="Iconos de DocGeo instalados."; R="Iconos de DocGeo retirados." ;;
  it*) I="Icone di DocGeo installate."; R="Icone di DocGeo rimosse." ;;
  nl*) I="DocGeo-pictogrammen geïnstalleerd."; R="DocGeo-pictogrammen verwijderd." ;;
  pt*) I="Ícones do DocGeo instalados."; R="Ícones do DocGeo removidos." ;;
  el*) I="Τα εικονίδια DocGeo εγκαταστάθηκαν."; R="Τα εικονίδια DocGeo αφαιρέθηκαν." ;;
  zh-Hant*) I="已安裝 DocGeo 圖示。"; R="已移除 DocGeo 圖示。" ;;
  zh*) I="已安装 DocGeo 图标。"; R="已移除 DocGeo 图标。" ;;
  ar*) I="تم تثبيت أيقونات DocGeo."; R="تمت إزالة أيقونات DocGeo." ;;
  hi*) I="DocGeo आइकन इंस्टॉल हो गए।"; R="DocGeo आइकन हटा दिए गए।" ;;
  *) I="DocGeo icons installed."; R="DocGeo icons removed." ;;
esac

# The Finder keeps the icons it has drawn until it restarts.
if [ "$1" = uninstall ]; then
  remove
  killall Finder
  echo "$R"
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
killall Finder
echo "$I"
