#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"

pause_before_exit() {
  echo ""
  echo "Appuyez sur Entree pour fermer cette fenetre."
  read -r _
}

trap pause_before_exit EXIT

echo "Envoi des fichiers modifies de tests/ sur le serveur FTP"
echo ""
python3 "$SCRIPT_DIR/tools/upload_tests.py"
echo ""
echo "Termine."
