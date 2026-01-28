#!/bin/bash
# Script para iniciar servidor com variáveis de ambiente E2E
export E2E_TESTING=true
export VITE_E2E_TESTING=true
pnpm dev
