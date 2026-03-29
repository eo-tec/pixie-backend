#!/bin/bash
set -e

# ========================================
#   Spotipyx Firmware Release Script
# ========================================

# Configuracion de rutas
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$BACKEND_ROOT/../Spotipyx"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}========================================"
echo "   Spotipyx Firmware Release Script"
echo -e "========================================${NC}"
echo ""

# --- PASO 0: Seleccionar hardware version ---

echo -e "${BLUE}[0/7] Seleccionar hardware version${NC}"
echo "  Versiones disponibles:"
echo "    1) v1 (ESP32 original)"
echo "    2) v2 (ESP32-S3)"
read -p "  Selecciona (1/2) [1]: " -n 1 -r HW_CHOICE
echo
case "$HW_CHOICE" in
    2) HW_VERSION="v2"; PIO_ENV="release-v2" ;;
    *) HW_VERSION="v1"; PIO_ENV="release" ;;
esac
echo -e "  Hardware: ${GREEN}$HW_VERSION${NC} (PlatformIO env: $PIO_ENV)"
echo ""

BUILD_DIR="$PROJECT_ROOT/.pio/build/$PIO_ENV"
FIRMWARE_BIN="$BUILD_DIR/firmware.bin"

# Verificar que el proyecto Spotipyx existe
if [ ! -d "$PROJECT_ROOT" ]; then
    echo -e "${RED}ERROR: No se encontro el proyecto Spotipyx en: $PROJECT_ROOT${NC}"
    exit 1
fi

# --- PASO 1: Verificar pre-condiciones ---

echo -e "${BLUE}[1/7] Verificando pre-condiciones...${NC}"

# 1.1 Verificar rama actual
echo -n "  Verificando rama git... "
CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" = "unknown" ]; then
    echo -e "${YELLOW}ADVERTENCIA: No se pudo determinar la rama${NC}"
elif [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo -e "${YELLOW}ADVERTENCIA${NC}"
    echo "  Rama actual: $CURRENT_BRANCH (esperada: main/master)"
    read -p "  Continuar de todas formas? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}OK ($CURRENT_BRANCH)${NC}"
fi

# 1.2 Verificar cambios sin commitear
echo -n "  Verificando estado del repositorio... "
if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)" ]; then
    echo -e "${RED}FALLO${NC}"
    echo -e "  ${RED}ERROR: Hay cambios sin commitear en Spotipyx:${NC}"
    git -C "$PROJECT_ROOT" status --short
    echo ""
    echo "  Por favor, commitea o descarta los cambios antes de hacer release."
    exit 1
fi
echo -e "${GREEN}OK (limpio)${NC}"

echo ""

# --- PASO 2: Obtener version actual ---

echo -e "${BLUE}[2/7] Obteniendo version actual para $HW_VERSION...${NC}"
cd "$BACKEND_ROOT"
CURRENT_VERSION=$(npx ts-node scripts/release-helper.ts get-version --hw "$HW_VERSION" 2>/dev/null | tail -1)
if [ -z "$CURRENT_VERSION" ] || ! [[ "$CURRENT_VERSION" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}ERROR: No se pudo obtener la version actual${NC}"
    echo "  Valor obtenido: '$CURRENT_VERSION'"
    exit 1
fi
NEXT_VERSION=$((CURRENT_VERSION + 1))
echo -e "  Version actual ($HW_VERSION): ${YELLOW}v$CURRENT_VERSION${NC}"
echo -e "  Siguiente version: ${GREEN}v$NEXT_VERSION${NC}"
echo ""

# --- PASO 3: Solicitar comentarios ---

echo -e "${BLUE}[3/7] Comentarios para la version${NC}"
echo "  (opcional, presiona Enter para omitir)"
read -p "  > " COMMENTS
echo ""

# --- PASO 4: Confirmacion ---

echo -e "${BLUE}========================================"
echo "   RESUMEN DEL RELEASE"
echo -e "========================================${NC}"
echo -e "  Hardware:     ${GREEN}$HW_VERSION${NC}"
echo -e "  Version:      ${GREEN}v$NEXT_VERSION${NC}"
echo -e "  PIO env:      $PIO_ENV"
echo -e "  Rama:         $CURRENT_BRANCH"
echo -e "  Comentarios:  ${COMMENTS:-'(sin comentarios)'}"
echo -e "${BLUE}========================================${NC}"
echo ""
read -p "Proceder con el release? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelado."
    exit 0
fi
echo ""

# --- PASO 5: Compilar firmware ---

echo -e "${BLUE}[4/7] Compilando firmware ($PIO_ENV)...${NC}"
cd "$PROJECT_ROOT"
if ! pio run -e "$PIO_ENV"; then
    echo -e "${RED}ERROR: Fallo la compilacion${NC}"
    exit 1
fi

if [ ! -f "$FIRMWARE_BIN" ]; then
    echo -e "${RED}ERROR: No se encontro firmware.bin${NC}"
    exit 1
fi

FIRMWARE_SIZE=$(ls -lh "$FIRMWARE_BIN" | awk '{print $5}')
echo -e "  ${GREEN}Compilacion exitosa${NC} (tamano: $FIRMWARE_SIZE)"
echo ""

# --- PASO 5: Subir a MinIO y registrar en BD ---
echo -e "${BLUE}[5/7] Subiendo firmware a MinIO...${NC}"
FIRMWARE_FILENAME="firmware_v${NEXT_VERSION}.bin"

cd "$BACKEND_ROOT"
if ! npx ts-node scripts/release-helper.ts upload \
    --hw "$HW_VERSION" \
    --version "$NEXT_VERSION" \
    --file "$FIRMWARE_BIN" \
    --filename "$FIRMWARE_FILENAME" \
    --comments "$COMMENTS"; then
    echo -e "${RED}ERROR: Fallo el upload${NC}"
    exit 1
fi
echo ""

# --- PASO 5b: Subir bootloader, partitions y boot_app0 ---
echo -e "${BLUE}[5b/7] Subiendo ficheros auxiliares de flash...${NC}"

BOOTLOADER_BIN="$BUILD_DIR/bootloader.bin"
PARTITIONS_BIN="$BUILD_DIR/partitions.bin"
BOOT_APP0_BIN="$HOME/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin"

for PART_FILE in "$BOOTLOADER_BIN:bootloader.bin" "$PARTITIONS_BIN:partitions.bin" "$BOOT_APP0_BIN:boot_app0.bin"; do
    SRC="${PART_FILE%%:*}"
    DST="${PART_FILE##*:}"
    if [ -f "$SRC" ]; then
        if npx ts-node scripts/release-helper.ts upload-part --hw "$HW_VERSION" --file "$SRC" --filename "$DST"; then
            echo -e "  ${GREEN}$DST subido${NC}"
        else
            echo -e "  ${YELLOW}ADVERTENCIA: No se pudo subir $DST${NC}"
        fi
    else
        echo -e "  ${YELLOW}ADVERTENCIA: No se encontro $SRC${NC}"
    fi
done
echo ""

# --- PASO 6: Crear tag git ---
echo -e "${BLUE}[6/7] Creando tag git...${NC}"
cd "$PROJECT_ROOT"
TAG_NAME="${HW_VERSION}-v${NEXT_VERSION}"
TAG_MESSAGE="${COMMENTS:-Firmware release $HW_VERSION v$NEXT_VERSION}"

git tag -a "$TAG_NAME" -m "$TAG_MESSAGE"
echo -e "  ${GREEN}Tag $TAG_NAME creado${NC}"

read -p "  Push tag al remoto? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if git push origin "$TAG_NAME"; then
        echo -e "  ${GREEN}Tag pushed a origin${NC}"
    else
        echo -e "  ${YELLOW}ADVERTENCIA: No se pudo hacer push del tag${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================"
echo "   RELEASE $HW_VERSION v$NEXT_VERSION COMPLETADO"
echo -e "========================================${NC}"
echo -e "  Hardware:  $HW_VERSION"
echo -e "  Firmware:  $HW_VERSION/$FIRMWARE_FILENAME"
echo -e "  Tag:       $TAG_NAME"
echo -e "  Bucket:    versions/$HW_VERSION/"
echo -e "${GREEN}========================================${NC}"
echo ""
