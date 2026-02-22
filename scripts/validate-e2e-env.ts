import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

interface EnvValidation {
  key: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "url";
  default?: string;
  description: string;
}

const REQUIRED_ENV_VARS: EnvValidation[] = [
  {
    key: "E2E_BASE_URL",
    required: true,
    type: "url",
    default: "http://localhost:3000",
    description: "URL base da aplicação para testes",
  },
  {
    key: "E2E_DATABASE_URL",
    required: true,
    type: "string",
    description: "Connection string do banco de dados de testes",
  },
  {
    key: "E2E_TEST_USER_LOGIN",
    required: true,
    type: "string",
    default: "e2e.test",
    description: "Login do usuário de teste",
  },
  {
    key: "E2E_TEST_USER_PASSWORD",
    required: true,
    type: "string",
    default: "senha123",
    description: "Senha do usuário de teste",
  },
  {
    key: "E2E_TIMEOUT_NAVIGATION",
    required: false,
    type: "number",
    default: "30000",
    description: "Timeout para navegação (ms)",
  },
  {
    key: "E2E_WORKERS",
    required: false,
    type: "number",
    default: "2",
    description: "Número de workers paralelos",
  },
  {
    key: "E2E_ENVIRONMENT",
    required: true,
    type: "string",
    default: "local",
    description: "Ambiente de execução (local | ci | staging)",
  },
];

function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verificar se arquivo .env.e2e existe
  const envPath = path.join(process.cwd(), ".env.e2e");
  if (!fs.existsSync(envPath)) {
    errors.push("Arquivo .env.e2e não encontrado. Copie .env.e2e.example e configure.");
    return { valid: false, errors, warnings };
  }

  // Carregar variáveis
  dotenv.config({ path: envPath });

  // Validar cada variável
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.key];

    // Verificar obrigatoriedade
    if (envVar.required && !value) {
      if (envVar.default) {
        warnings.push(`${envVar.key} não definido. Usando valor padrão: ${envVar.default}`);
        process.env[envVar.key] = envVar.default;
      } else {
        errors.push(`${envVar.key} é obrigatório mas não está definido.`);
      }
      continue;
    }

    if (!value) continue;

    // Validar tipo
    switch (envVar.type) {
      case "url":
        try {
          new URL(value);
        } catch {
          errors.push(`${envVar.key} deve ser uma URL válida. Valor atual: ${value}`);
        }
        break;

      case "number":
        if (isNaN(Number(value))) {
          errors.push(`${envVar.key} deve ser um número. Valor atual: ${value}`);
        }
        break;

      case "boolean":
        if (!["true", "false"].includes(value.toLowerCase())) {
          errors.push(`${envVar.key} deve ser true ou false. Valor atual: ${value}`);
        }
        break;
    }
  }

  // Validação específica: banco de dados de testes não pode ser o mesmo de desenvolvimento
  const devDbUrl = process.env.DATABASE_URL;
  const e2eDbUrl = process.env.E2E_DATABASE_URL;
  if (devDbUrl && e2eDbUrl && devDbUrl === e2eDbUrl) {
    errors.push(
      "E2E_DATABASE_URL não pode ser igual a DATABASE_URL. Use um banco separado para testes."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Executar validação
const result = validateEnv();

console.log("\n🔍 Validação de Ambiente E2E\n");

if (result.warnings.length > 0) {
  console.log("⚠️  Avisos:");
  result.warnings.forEach((w) => console.log(`   - ${w}`));
  console.log();
}

if (result.errors.length > 0) {
  console.log("❌ Erros:");
  result.errors.forEach((e) => console.log(`   - ${e}`));
  console.log();
  console.log("💡 Dica: Copie .env.e2e.example para .env.e2e e preencha os valores necessários.\n");
  process.exit(1);
}

console.log("✅ Ambiente E2E configurado corretamente!\n");
process.exit(0);
