import { z } from "zod";

/**
 * MEL-03: Validação de variáveis de ambiente com Zod
 * 
 * Garante que variáveis críticas estejam presentes e válidas na inicialização.
 * Falha imediata com mensagens claras ao invés de erros genéricos durante execução.
 */

const envSchema = z.object({
  // Variáveis obrigatórias
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatória"),
  
  // Variáveis do Manus (obrigatórias em produção)
  VITE_APP_ID: z.string().min(1, "VITE_APP_ID é obrigatória"),
  OAUTH_SERVER_URL: z.string().url("OAUTH_SERVER_URL deve ser uma URL válida"),
  OWNER_OPEN_ID: z.string().optional(), // Opcional: apenas disponível no ambiente Manus
  BUILT_IN_FORGE_API_URL: z.string().url("BUILT_IN_FORGE_API_URL deve ser uma URL válida"),
  BUILT_IN_FORGE_API_KEY: z.string().min(1, "BUILT_IN_FORGE_API_KEY é obrigatória"),
  
  // Variáveis opcionais
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// Validar e exportar
// Se falhar, o servidor não inicia e exibe mensagem clara do erro
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Erro de configuração: Variáveis de ambiente inválidas ou ausentes");
  console.error(parsed.error.format());
  throw new Error("Falha na validação de variáveis de ambiente. Verifique o console acima.");
}

export const ENV = {
  appId: parsed.data.VITE_APP_ID,
  cookieSecret: parsed.data.JWT_SECRET,
  databaseUrl: parsed.data.DATABASE_URL,
  oAuthServerUrl: parsed.data.OAUTH_SERVER_URL,
  ownerOpenId: parsed.data.OWNER_OPEN_ID || "system", // Fallback para "system" se não estiver disponível
  isProduction: parsed.data.NODE_ENV === "production",
  forgeApiUrl: parsed.data.BUILT_IN_FORGE_API_URL,
  forgeApiKey: parsed.data.BUILT_IN_FORGE_API_KEY,
};
