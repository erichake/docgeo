#!/bin/bash
# A CaRMetal figure as CaRMetal draws it, to compare with DocGeo's import:
#   tools/carmetal/render.sh figure.zir out.png [--page n] [--script name]
#     [point=x,y …]
# e.g. tools/carmetal/render.sh tests/zirz/eric/IllustreSymCollege.zirs \
#   losange.png --page 1 m=1,0.12
# Needs Java 8 and CaRMetal.jar (see zz_CaRMetal.command). CaRMetal's window
# shows while the figure is drawn.
set -e
JAVA_HOME=$(/usr/libexec/java_home -v 1.8)
DIR="$HOME/Documents/Anciens Documents/Ancienne dropbox/Documents/Programmation/netbeans/Installeurs_CaRMetal/MacOSX/CaRMetal.app/Contents/Java"
CLASSES=$(mktemp -d)
trap 'rm -rf "$CLASSES"' EXIT
"$JAVA_HOME/bin/javac" -nowarn -cp "$DIR/CaRMetal.jar" -d "$CLASSES" \
    "$(dirname "$0")/Render.java"
FIGURE=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
OUT=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
shift 2
# CaRMetal reads its resources from its own folder.
cd "$DIR"
"$JAVA_HOME/bin/java" -Dapple.awt.UIElement=true \
    -cp "$DIR/CaRMetal.jar:$CLASSES" Render "$FIGURE" "$OUT" "$@"
