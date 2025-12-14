#!/bin/bash
set -e

# ========================================
#   Spotipyx Firmware Release Script
# ========================================

# Configuracion de rutas
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$BACKEND_ROOT/../Spotipyx"
MAIN_CPP="$PROJECT_ROOT/src/main.cpp"
BUILD_DIR="$PROJECT_ROOT/.pio/build/esp32dev"
FIRMWARE_BIN="$BUILD_DIR/firmware.bin"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funcion para limpiar en caso de error
cleanup() {
    if [ "$DEV_MODIFIED" = true ]; then
        echo -e "\n${YELLOW}Revirtiendo DEV a true...${NC}"
        sed -i '' 's/const bool DEV = false;/const bool DEV = true;/' "$MAIN_CPP"
        echo -e "${GREEN}DEV revertido${NC}"
    fi
}

# Trap para asegurar cleanup en caso de error
trap cleanup EXIT

DEV_MODIFIED=false

echo ""
echo -e "${BLUE}========================================"
echo "   Spotipyx Firmware Release Script"
echo -e "========================================${NC}"
echo ""

# Verificar que el proyecto Spotipyx existe
if [ ! -d "$PROJECT_ROOT" ]; then
    echo -e "${RED}ERROR: No se encontro el proyecto Spotipyx en: $PROJECT_ROOT${NC}"
    exit 1
fi

if [ ! -f "$MAIN_CPP" ]; then
    echo -e "${RED}ERROR: No se encontro main.cpp en: $MAIN_CPP${NC}"
    exit 1
fi

# --- PASO 1: Verificar pre-condiciones ---

echo -e "${BLUE}[1/8] Verificando pre-condiciones...${NC}"

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

# 1.3 Verificar que DEV esta en true (estado normal)
echo -n "  Verificando variable DEV... "
DEV_VALUE=$(grep -E "^const bool DEV = " "$MAIN_CPP" | grep -oE "(true|false)" || echo "not_found")
if [ "$DEV_VALUE" = "not_found" ]; then
    echo -e "${RED}FALLO${NC}"
    echo "  ERROR: No se encontro la variable DEV en main.cpp"
    exit 1
elif [ "$DEV_VALUE" = "false" ]; then
    echo -e "${YELLOW}ADVERTENCIA: DEV ya esta en false${NC}"
else
    echo -e "${GREEN}OK (DEV=$DEV_VALUE)${NC}"
fi

echo ""

# --- PASO 2: Obtener version actual ---

echo -e "${BLUE}[2/8] Obteniendo version actual...${NC}"
cd "$BACKEND_ROOT"
CURRENT_VERSION=$(npx ts-node scripts/release-helper.ts get-version 2>/dev/null | tail -1)
if [ -z "$CURRENT_VERSION" ] || ! [[ "$CURRENT_VERSION" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}ERROR: No se pudo obtener la version actual${NC}"
    echo "  Valor obtenido: '$CURRENT_VERSION'"
    exit 1
fi
NEXT_VERSION=$((CURRENT_VERSION + 1))
echo -e "  Version actual: ${YELLOW}v$CURRENT_VERSION${NC}"
echo -e "  Siguiente version: ${GREEN}v$NEXT_VERSION${NC}"
echo ""

# --- PASO 3: Solicitar comentarios ---

echo -e "${BLUE}[3/8] Comentarios para la version${NC}"
echo "  (opcional, presiona Enter para omitir)"
read -p "  > " COMMENTS
echo ""

# --- PASO 4: Confirmacion ---

echo -e "${BLUE}========================================"
echo "   RESUMEN DEL RELEASE"
echo -e "========================================${NC}"
echo -e "  Version:      ${GREEN}v$NEXT_VERSION${NC}"
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

# --- PASO 5: Cambiar DEV a false ---

echo -e "${BLUE}[4/8] Cambiando DEV a false...${NC}"
sed -i '' 's/const bool DEV = true;/const bool DEV = false;/' "$MAIN_CPP"
DEV_MODIFIED=true

# Verificar el cambio
NEW_DEV_VALUE=$(grep -E "^const bool DEV = " "$MAIN_CPP" | grep -oE "(true|false)")
if [ "$NEW_DEV_VALUE" != "false" ]; then
    echo -e "${RED}ERROR: No se pudo cambiar DEV a false${NC}"
    exit 1
fi
echo -e "  ${GREEN}DEV cambiado a false${NC}"
echo ""

# --- PASO 6: Compilar firmware ---

echo -e "${BLUE}[5/8] Compilando firmware...${NC}"
cd "$PROJECT_ROOT"
if ! pio run -e esp32dev; then
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

# --- PASO 7: Revertir DEV a true ---

echo -e "${BLUE}[6/8] Revirtiendo DEV a true...${NC}"
sed -i '' 's/const bool DEV = false;/const bool DEV = true;/' "$MAIN_CPP"
DEV_MODIFIED=false
echo -e "  ${GREEN}DEV revertido a true${NC}"
echo ""

# --- PASO 8: Subir a MinIO y registrar en BD ---
echo -e "${BLUE}[7/8] Subiendo firmware a MinIO...${NC}"
FIRMWARE_FILENAME="firmware_v${NEXT_VERSION}.bin"

cd "$BACKEND_ROOT"
if ! npx ts-node scripts/release-helper.ts upload \
    --version "$NEXT_VERSION" \
    --file "$FIRMWARE_BIN" \
    --filename "$FIRMWARE_FILENAME" \
    --comments "$COMMENTS"; then
    echo -e "${RED}ERROR: Fallo el upload${NC}"
    exit 1
fi
echo ""

# --- PASO 9: Crear tag git ---
echo -e "${BLUE}[8/8] Creando tag git...${NC}"
cd "$PROJECT_ROOT"
TAG_NAME="v$NEXT_VERSION"
TAG_MESSAGE="${COMMENTS:-Firmware release v$NEXT_VERSION}"

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
echo "   RELEASE v$NEXT_VERSION COMPLETADO"
echo -e "========================================${NC}"
echo -e "  Firmware:  $FIRMWARE_FILENAME"
echo -e "  Tag:       $TAG_NAME"
echo -e "  Bucket:    versions"
echo -e "${GREEN}========================================${NC}"
echo ""
