#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
DOCTOOLS_DIR="${SCRIPT_DIR:h}/doctools_MAIN"
TARGET="public/apps/docgeo"

pause_before_exit() {
  echo ""
  echo "Appuyez sur Entree pour fermer cette fenetre."
  read -r _
}

trap pause_before_exit EXIT

echo "Deploiement de DocGeo en prod : commit, build, commit DocTools, envoi FTP et push"
echo ""

cd "$DOCTOOLS_DIR"
# Le script FTP de DocTools refuse un depot sale : seul le build de DocGeo peut y etre commite ici
OTHER_CHANGES=$(git status --porcelain -- . ":!$TARGET")
if [ -n "$OTHER_CHANGES" ]; then
  echo "Erreur : DocTools a des modifications non commitees hors de $TARGET :"
  echo "$OTHER_CHANGES"
  exit 1
fi

cd "$SCRIPT_DIR"
if [ -n "$(git status --porcelain)" ]; then
  git status --short
  echo ""
  echo "Message du commit DocGeo (en anglais, vide pour annuler) :"
  read -r MESSAGE
  if [ -z "$MESSAGE" ]; then
    echo "Annule."
    exit 1
  fi
  git add -A
  git commit -q -m "$MESSAGE"
fi
DOCGEO_REV=$(git rev-parse --short HEAD)

echo ""
echo "Build de DocGeo ($DOCGEO_REV)..."
npm run build

cd "$DOCTOOLS_DIR"
git add -A -- "$TARGET"
if git diff --cached --quiet; then
  echo ""
  echo "Le build de DocGeo n'a pas change dans DocTools."
else
  git commit -q -m "Update DocGeo build (docgeo $DOCGEO_REV)"
  echo ""
  echo "Commit DocTools : Update DocGeo build (docgeo $DOCGEO_REV)"
fi

echo ""
trap - EXIT
exec zsh "$DOCTOOLS_DIR/zz_BUILD_FTP_PUSH.command"
