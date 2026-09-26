#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
DOCTOOLS_DIR="$SCRIPT_DIR/../doctools_MAIN"
TARGET_DIR="$DOCTOOLS_DIR/public/apps/docgeo"

pause_before_exit() {
  echo ""
  echo "Appuyez sur Entree pour fermer cette fenetre."
  read -r _
}

trap pause_before_exit EXIT

echo "Build de DocGeo pour DocTools"
echo "Projet DocGeo : $SCRIPT_DIR"
echo "Projet DocTools : $DOCTOOLS_DIR"
echo ""

cd "$SCRIPT_DIR"

if [ ! -d "$DOCTOOLS_DIR" ]; then
  echo "Erreur : le dossier doctools_MAIN est introuvable a cote de docgeo_MAIN."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Erreur : le dossier node_modules est introuvable."
  echo "Lancez d'abord : npm install"
  exit 1
fi

echo "Lancement de : npm run build"
echo ""
npm run build

echo ""
if [ -f "$TARGET_DIR/index.html" ]; then
  echo "Build termine."
  echo "DocGeo a ete genere ici :"
  echo "$TARGET_DIR"
else
  echo "Attention : le build est termine, mais index.html est introuvable dans :"
  echo "$TARGET_DIR"
  exit 1
fi
