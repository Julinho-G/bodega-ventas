#!/bin/sh
# Restaura la base de datos desde una copia. Corre dentro del contenedor "respaldos".
# ANTES apaga la API para que nadie venda mientras tanto:
#
#   docker compose stop api
#   docker compose exec respaldos sh /restaurar.sh bodega-2026-10-23_2200.dump
#   docker compose start api
#
# Por seguridad, primero guarda una copia del estado actual ("antes-de-restaurar-...").

set -e
CARPETA=/respaldos
nombre="${1:-}"

if [ -z "$nombre" ]; then
  echo "Indica el archivo a restaurar. Copias disponibles (la más reciente al final):"
  ls -1 "$CARPETA" | grep '\.dump$' || echo "  (no hay copias)"
  exit 1
fi
archivo="$CARPETA/$(basename "$nombre")"
if [ ! -f "$archivo" ]; then
  echo "No existe $archivo"
  exit 1
fi

antes="$CARPETA/antes-de-restaurar-$(date +%Y-%m-%d_%H%M).dump"
pg_dump --format=custom --file="$antes"
echo "[restaurar] Estado actual guardado en $(basename "$antes")"

# Borra lo que hay y carga la copia, todo en una sola transacción: si falla, no cambia nada
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$PGDATABASE" "$archivo"
echo "[restaurar] Listo: la base quedó como en $(basename "$archivo"). Ahora: docker compose start api"
