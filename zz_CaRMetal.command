#!/bin/bash
JAVA_HOME=$(/usr/libexec/java_home -v 1.8 2>/dev/null)
APP="$HOME/Documents/Anciens Documents/Ancienne dropbox/Documents/Programmation/netbeans/Installeurs_CaRMetal/MacOSX/CaRMetal.app/Contents/Java/CaRMetal.jar"

if [ -z "$JAVA_HOME" ] || [ ! -f "$APP" ]; then
    echo "Java 8 ou CaRMetal.jar est introuvable."
    read -r -p "Appuie sur Entrée pour fermer."
    exit 1
fi

cd "$(dirname "$APP")" || exit 1
exec "$JAVA_HOME/bin/java" -jar "$APP"
