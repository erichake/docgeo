#!/bin/bash

cd "$(dirname "$0")/.."

if lsof -nP -iTCP:5176 -sTCP:LISTEN | grep -q php; then
  echo "Serveur PHP déjà en cours sur le port 5176."
else
  echo "Lancement du serveur PHP sur le port 5176..."
  php -S 127.0.0.1:5176 -t public &
  PHP_PID=$!
fi

cleanup() {
  if [[ $PHP_PID ]]; then
    kill "$PHP_PID"
  fi
}

trap cleanup EXIT INT TERM

npm run dev:vite
