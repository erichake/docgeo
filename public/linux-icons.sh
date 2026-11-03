#!/bin/sh
# DocGeo file icons (.dgo, .dgp, .ggb) on Linux, for the editor installed as a Chrome app.
# Install:   curl -fsSL https://doctools.org/apps/docgeo/linux-icons.sh | sh
# Uninstall: curl -fsSL https://doctools.org/apps/docgeo/linux-icons.sh | sh -s uninstall
# Chrome registers the MIME types of the file handlers without icons: a file manager
# shows the hicolor icon named after the type, installed here for the user only.
# Chromium as a snap registers neither the types nor the file argument: declared here.
set -e
URL=https://doctools.org/apps/docgeo
DATA=${XDG_DATA_HOME:-$HOME/.local/share}
OWN=$DATA/mime/packages/docgeo.xml
SITE=$URL/editor.html
TYPES="dgo:application/x-docgeo dgp:application/x-dgpad ggb:application/vnd.geogebra.file"
# One icon per size: a file manager scaling the 512 px one down to 48 px draws jagged edges.
SIZES="16 24 32 48 64 128 256 512"

case ${LC_ALL:-${LC_MESSAGES:-$LANG}} in
  fr*) I="Icônes DocGeo installées."; R="Icônes DocGeo retirées."; N="DocGeo n’est pas installé depuis Chrome : installez-le depuis $SITE, puis relancez cette commande." ;;
  de*) I="DocGeo-Symbole installiert."; R="DocGeo-Symbole entfernt."; N="DocGeo ist nicht über Chrome installiert: Installieren Sie es über $SITE und führen Sie diesen Befehl dann erneut aus." ;;
  es*) I="Iconos de DocGeo instalados."; R="Iconos de DocGeo retirados."; N="DocGeo no está instalado desde Chrome: instálalo desde $SITE y vuelve a ejecutar este comando." ;;
  it*) I="Icone di DocGeo installate."; R="Icone di DocGeo rimosse."; N="DocGeo non è installato da Chrome: installalo da $SITE, poi esegui di nuovo questo comando." ;;
  nl*) I="DocGeo-pictogrammen geïnstalleerd."; R="DocGeo-pictogrammen verwijderd."; N="DocGeo is niet vanuit Chrome geïnstalleerd: installeer het via $SITE en voer deze opdracht daarna opnieuw uit." ;;
  pt*) I="Ícones do DocGeo instalados."; R="Ícones do DocGeo removidos."; N="O DocGeo não está instalado pelo Chrome: instale-o em $SITE e depois execute este comando de novo." ;;
  el*) I="Τα εικονίδια DocGeo εγκαταστάθηκαν."; R="Τα εικονίδια DocGeo αφαιρέθηκαν."; N="Το DocGeo δεν έχει εγκατασταθεί από το Chrome: εγκαταστήστε το από $SITE και μετά εκτελέστε ξανά αυτή την εντολή." ;;
  zh_TW*|zh_HK*|zh_MO*) I="已安裝 DocGeo 圖示。"; R="已移除 DocGeo 圖示。"; N="尚未透過 Chrome 安裝 DocGeo：請從 $SITE 安裝，然後再次執行此命令。" ;;
  zh*) I="已安装 DocGeo 图标。"; R="已移除 DocGeo 图标。"; N="尚未通过 Chrome 安装 DocGeo：请从 $SITE 安装，然后再次运行此命令。" ;;
  ar*) I="تم تثبيت أيقونات DocGeo."; R="تمت إزالة أيقونات DocGeo."; N="لم يُثبَّت DocGeo من Chrome: ثبّته من $SITE ثم شغّل هذا الأمر مرة أخرى." ;;
  hi*) I="DocGeo आइकन इंस्टॉल हो गए।"; R="DocGeo आइकन हटा दिए गए।"; N="DocGeo, Chrome से इंस्टॉल नहीं है: इसे $SITE से इंस्टॉल करें, फिर यह कमांड दोबारा चलाएँ।" ;;
  *) I="DocGeo icons installed."; R="DocGeo icons removed."; N="DocGeo is not installed from Chrome: install it from $SITE, then run this command again." ;;
esac

# GNOME's desktop icons extensions (Debian's, Ubuntu's) only notice a new icon theme when
# they redraw: restart them.
refresh() {
  xdg-icon-resource forceupdate
  for e in $(gnome-extensions list --enabled 2>/dev/null | grep -x -e ding@rastersoft.com -e desktop-icons@csoriano); do
    gnome-extensions disable "$e"
    gnome-extensions enable "$e"
  done
}

if [ "$1" = uninstall ]; then
  for t in $TYPES; do
    for s in $SIZES; do
      xdg-icon-resource uninstall --noupdate --context mimetypes --size $s "$(echo "${t#*:}" | tr / -)"
    done
  done
  if [ -f "$OWN" ]; then
    rm "$OWN"
    update-mime-database "$DATA/mime"
    for d in $(grep -l '^MimeType=application/x-docgeo;application/x-dgpad;application/vnd.geogebra.file;$' "$DATA"/applications/chrome-*.desktop 2>/dev/null); do
      sed -i -e '/^MimeType=/d' -e '/^Exec=/s/ %U$//' "$d"
    done
    update-desktop-database "$DATA/applications"
  fi
  refresh
  echo "$R"
  exit
fi

if ! grep -qs application/x-docgeo "$DATA"/mime/packages/chrome-*.xml; then
  D=$(grep -lx Name=DocGeo "$DATA"/applications/chrome-*.desktop 2>/dev/null | head -1)
  if [ -z "$D" ]; then
    echo "$N"
    exit 1
  fi
  cat > "$OWN" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-docgeo"><comment>DocGeo</comment><glob pattern="*.dgo"/></mime-type>
  <mime-type type="application/x-dgpad"><comment>DGPad</comment><glob pattern="*.dgp"/></mime-type>
  <mime-type type="application/vnd.geogebra.file"><comment>GeoGebra</comment><glob pattern="*.ggb"/></mime-type>
</mime-info>
EOF
  update-mime-database "$DATA/mime"
  grep -q ^MimeType= "$D" || sed -i -e '/^Exec=/s/$/ %U/' -e '$a MimeType=application/x-docgeo;application/x-dgpad;application/vnd.geogebra.file;' "$D"
  update-desktop-database "$DATA/applications"
  xdg-mime default "$(basename "$D")" application/x-docgeo application/x-dgpad
fi
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
for t in $TYPES; do
  for s in $SIZES; do
    f=file_${t%%:*}
    [ $s = 512 ] || f=${f}_$s
    curl -fsSL "$URL/$f.png" > "$T/i.png"
    xdg-icon-resource install --noupdate --context mimetypes --size $s "$T/i.png" "$(echo "${t#*:}" | tr / -)"
  done
done
refresh
echo "$I"
