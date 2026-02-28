#!/bin/bash
# ============================================================================
# Script de Inicialização do Ambiente de Homologação WMS Med@x
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  WMS Med@x - Ambiente de Homologação"
echo "============================================================"

# Verificar MySQL
echo "1. Verificando MySQL..."
if ! sudo service mysql status > /dev/null 2>&1; then
    echo "   Iniciando MySQL..."
    sudo service mysql start
    sleep 2
fi
echo "   MySQL: OK"

# Verificar banco de dados
echo "2. Verificando banco de dados..."
DB_CHECK=$(mysql -u wms_user -pwms_homolog_2024 wms_medax_homolog -e "SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema='wms_medax_homolog';" 2>/dev/null | tail -1)
echo "   Tabelas no banco: $DB_CHECK"

if [ "$DB_CHECK" -lt "50" ]; then
    echo "   Aplicando migrations..."
    python3 "$SCRIPT_DIR/apply-migrations.py"
fi

# Carregar variáveis de ambiente
source "$SCRIPT_DIR/.env"

echo "3. Iniciando servidor WMS Med@x..."
echo "   Banco: $DATABASE_URL"
echo "   Modo: E2E_TESTING=$E2E_TESTING"
echo ""
echo "   Servidor disponível em: http://localhost:3000"
echo "============================================================"

exec pnpm run dev
