#!/bin/sh
# Copias de seguridad de la base de datos. Corre dentro del contenedor "respaldos".
#
#   sh /respaldar.sh          modo automático: hace una copia si la última tiene más de 20 horas,
#                             y vuelve a revisar cada hora (así no importa a qué hora prendas la laptop)
#   sh /respaldar.sh ahora    hace una copia en este momento y termina
#
# Cada copia es un archivo "bodega-AAAA-MM-DD_HHMM.dump" (formato de pg_dump).
# Se guardan DIAS_A_GUARDAR días; las más antiguas se borran solas.

CARPETA=/respaldos
mkdir -p "$CARPETA"

hacer_copia() {
  archivo="$CARPETA/bodega-$(date +%Y-%m-%d_%H%M).dump"
  # Primero a un archivo temporal: si algo falla, nunca queda una copia a medias
  if pg_dump --format=custom --file="$archivo.tmp"; then
    mv "$archivo.tmp" "$archivo"
    echo "[respaldos] Copia lista: $(basename "$archivo") ($(du -h "$archivo" | cut -f1))"
  else
    rm -f "$archivo.tmp"
    echo "[respaldos] ERROR: no se pudo hacer la copia" >&2
    return 1
  fi
  find "$CARPETA" -name 'bodega-*.dump' -mtime +"${DIAS_A_GUARDAR:-30}" -delete
}

if [ "${1:-}" = "ahora" ]; then
  hacer_copia
  exit $?
fi

echo "[respaldos] Copias automáticas en $CARPETA (se guardan ${DIAS_A_GUARDAR:-30} días)"
while true; do
  # ¿Hay alguna copia de las últimas 20 horas (1200 minutos)?
  reciente=$(find "$CARPETA" -name 'bodega-*.dump' -mmin -1200 | head -n 1)
  if [ -z "$reciente" ]; then
    hacer_copia
  fi
  sleep 3600
done
