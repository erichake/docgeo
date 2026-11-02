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
  fr*) I="Icônes DocGeo"; R="Retrait des icônes DocGeo"; P=" : tapez votre mot de passe (il ne s’affiche pas), puis l’ordinateur redémarrera : " ;;
  de*) I="DocGeo-Symbole"; R="Entfernen der DocGeo-Symbole"; P=": Passwort eingeben (wird nicht angezeigt), danach startet der Computer neu: " ;;
  es*) I="Iconos de DocGeo"; R="Retirada de los iconos de DocGeo"; P=": escribe tu contraseña (no se muestra); después el ordenador se reiniciará: " ;;
  it*) I="Icone di DocGeo"; R="Rimozione delle icone di DocGeo"; P=": digita la tua password (non viene mostrata); poi il computer si riavvierà: " ;;
  nl*) I="DocGeo-pictogrammen"; R="DocGeo-pictogrammen verwijderen"; P=": typ je wachtwoord (het wordt niet getoond); daarna start de computer opnieuw op: " ;;
  pt*) I="Ícones do DocGeo"; R="Remoção dos ícones do DocGeo"; P=": digite sua senha (ela não aparece); depois o computador vai reiniciar: " ;;
  el*) I="Εικονίδια DocGeo"; R="Αφαίρεση εικονιδίων DocGeo"; P=": πληκτρολογήστε τον κωδικό σας (δεν εμφανίζεται)· μετά ο υπολογιστής θα επανεκκινηθεί: " ;;
  zh-Hant*) I="DocGeo 圖示"; R="移除 DocGeo 圖示"; P="：請輸入密碼（輸入時不會顯示），隨後電腦將重新啟動：" ;;
  zh*) I="DocGeo 图标"; R="移除 DocGeo 图标"; P="：请输入密码（输入时不显示），随后电脑将重新启动：" ;;
  ar*) I="أيقونات DocGeo"; R="إزالة أيقونات DocGeo"; P=": اكتب كلمة السر (لا تظهر)، ثم سيُعاد تشغيل الحاسوب: " ;;
  hi*) I="DocGeo आइकन"; R="DocGeo आइकन हटाना"; P=": अपना पासवर्ड टाइप करें (वह दिखता नहीं), फिर कंप्यूटर फिर से चालू होगा: " ;;
  *) I="DocGeo icons"; R="Removing DocGeo icons"; P=": type your password (it is not shown), then the computer will restart: " ;;
esac

# The password is asked first, so that nothing else is asked afterwards. macOS keeps
# a type's icon in its icon cache, even across restarts: it must be cleared.
restart() {
  sudo sh -c 'rm -rf /Library/Caches/com.apple.iconservices.store && reboot'
}

if [ "$1" = uninstall ]; then
  sudo -v -p "$R$P"
  remove
  restart
  exit
fi

sudo -v -p "$I$P"
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
restart
