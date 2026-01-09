# WMS Med@x - Documentação do Sistema RBAC (Role-Based Access Control)

**Data:** Janeiro 2026  
**Versão:** 1.0  
**Módulo:** Sistema de Controle de Acesso Baseado em Papéis  
**Status:** ✅ Implementado e Funcional

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Papéis e Permissões](#papéis-e-permissões)
3. [Arquitetura Técnica](#arquitetura-técnica)
4. [Backend - Código Completo](#backend---código-completo)
5. [Frontend - Código Completo](#frontend---código-completo)
6. [Fluxos Operacionais](#fluxos-operacionais)

---

## Visão Geral

O **Sistema RBAC (Role-Based Access Control)** implementa controle granular de acesso baseado em papéis. O sistema possui 6 papéis predefinidos com 40 permissões específicas, permitindo que cada usuário tenha exatamente as permissões necessárias para sua função.

### Características Principais

- ✅ 6 papéis predefinidos
- ✅ 40 permissões granulares
- ✅ Atribuição flexível de papéis a usuários
- ✅ Validação de permissões em backend e frontend
- ✅ Auditoria de acesso
- ✅ Bloqueio automático de operações não autorizadas

---

## Papéis e Permissões

### 1. Administrador (ADMIN)

**Descrição:** Acesso total ao sistema. Gerencia usuários, configurações e dados.

**Permissões (10):**
- `admin:manage_users` - Criar, editar, deletar usuários
- `admin:manage_roles` - Atribuir/remover papéis
- `admin:manage_permissions` - Gerenciar permissões
- `admin:view_audit_logs` - Visualizar logs de auditoria
- `admin:cleanup_data` - Limpar dados do sistema
- `admin:manage_zones` - Criar/editar zonas
- `admin:manage_locations` - Criar/editar endereços
- `admin:manage_products` - Criar/editar produtos
- `admin:manage_tenants` - Criar/editar clientes
- `admin:system_settings` - Configurações do sistema

### 2. Gerente de Recebimento (RECEIVING_MANAGER)

**Descrição:** Gerencia operações de recebimento e conferência.

**Permissões (8):**
- `receiving:create_order` - Criar ordem de recebimento
- `receiving:edit_order` - Editar ordem de recebimento
- `receiving:view_orders` - Visualizar ordens
- `receiving:confirm_receipt` - Confirmar recebimento
- `receiving:generate_labels` - Gerar etiquetas
- `receiving:blind_check` - Realizar conferência cega
- `receiving:preallocate_locations` - Pré-alocar endereços
- `receiving:approve_adjustments` - Aprovar ajustes de quantidade

### 3. Operador de Recebimento (RECEIVING_OPERATOR)

**Descrição:** Executa operações de recebimento e conferência.

**Permissões (6):**
- `receiving:view_orders` - Visualizar ordens
- `receiving:confirm_receipt` - Confirmar recebimento
- `receiving:blind_check` - Realizar conferência cega
- `receiving:generate_labels` - Gerar etiquetas
- `receiving:view_audit` - Visualizar histórico próprio
- `receiving:undo_last_action` - Desfazer última ação

### 4. Gerente de Separação (PICKING_MANAGER)

**Descrição:** Gerencia operações de separação e picking.

**Permissões (7):**
- `picking:create_order` - Criar ordem de separação
- `picking:edit_order` - Editar ordem de separação
- `picking:view_orders` - Visualizar ordens
- `picking:start_picking` - Iniciar picking
- `picking:manage_returns` - Gerenciar devoluções
- `picking:confirm_shipment` - Confirmar expedição
- `picking:view_audit` - Visualizar histórico

### 5. Operador de Separação (PICKING_OPERATOR)

**Descrição:** Executa operações de separação e picking.

**Permissões (5):**
- `picking:view_orders` - Visualizar ordens
- `picking:start_picking` - Iniciar picking
- `picking:confirm_items` - Confirmar itens separados
- `picking:manage_returns` - Gerenciar devoluções
- `picking:view_audit` - Visualizar histórico próprio

### 6. Analista de Estoque (STOCK_ANALYST)

**Descrição:** Analisa e relata sobre estoque.

**Permissões (4):**
- `stock:view_positions` - Visualizar posições de estoque
- `stock:export_reports` - Exportar relatórios
- `stock:view_movements` - Visualizar movimentações
- `stock:view_occupancy` - Visualizar ocupação

---

## Arquitetura Técnica

### Tabelas de Banco de Dados

```sql
-- Papéis (Roles)
CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- Permissões
CREATE TABLE permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_category (category)
);

-- Associação Papel-Permissão
CREATE TABLE rolePermissions (
  roleId INT NOT NULL,
  permissionId INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (roleId, permissionId),
  FOREIGN KEY (roleId) REFERENCES roles(id),
  FOREIGN KEY (permissionId) REFERENCES permissions(id)
);

-- Papéis do Usuário
CREATE TABLE userRoles (
  userId INT NOT NULL,
  roleId INT NOT NULL,
  assignedBy INT,
  assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, roleId),
  FOREIGN KEY (userId) REFERENCES systemUsers(id),
  FOREIGN KEY (roleId) REFERENCES roles(id),
  FOREIGN KEY (assignedBy) REFERENCES systemUsers(id),
  INDEX idx_userId (userId)
);

-- Auditoria de Acesso
CREATE TABLE accessAudit (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  action VARCHAR(255) NOT NULL,
  permission VARCHAR(100),
  resource VARCHAR(255),
  allowed BOOLEAN,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES systemUsers(id),
  INDEX idx_userId (userId),
  INDEX idx_timestamp (timestamp),
  INDEX idx_permission (permission)
);
```

### Interfaces TypeScript

```typescript
export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  description?: string;
  category: string;
}

export interface UserRole {
  userId: number;
  roleId: number;
  roleName: string;
  assignedBy?: number;
  assignedAt: Date;
}

export interface AccessCheck {
  userId: number;
  permission: string;
  allowed: boolean;
}

export interface AccessAuditLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  permission?: string;
  resource?: string;
  allowed: boolean;
  timestamp: Date;
}
```

---

## Backend - Código Completo

### server/rbac.ts

```typescript
import { getDb } from "./db";
import {
  roles,
  permissions,
  rolePermissions,
  userRoles,
  accessAudit,
  systemUsers,
} from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Verifica se usuário tem permissão
 */
export async function hasPermission(
  userId: number,
  permission: string
): Promise<boolean> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  try {
    // Buscar papéis do usuário
    const userRolesList = await dbConn
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    if (userRolesList.length === 0) {
      logAccessAttempt(userId, "check_permission", permission, false);
      return false;
    }

    const roleIds = userRolesList.map((ur) => ur.roleId);

    // Buscar permissões dos papéis
    const userPermissions = await dbConn
      .select({ name: permissions.name })
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id)
      )
      .where(inArray(rolePermissions.roleId, roleIds));

    const hasPermissionFlag = userPermissions.some((p) => p.name === permission);

    logAccessAttempt(userId, "check_permission", permission, hasPermissionFlag);

    return hasPermissionFlag;
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }
}

/**
 * Obtém todas as permissões de um usuário
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Buscar papéis do usuário
  const userRolesList = await dbConn
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (userRolesList.length === 0) {
    return [];
  }

  const roleIds = userRolesList.map((ur) => ur.roleId);

  // Buscar permissões dos papéis
  const userPermissions = await dbConn
    .select({ name: permissions.name })
    .from(rolePermissions)
    .innerJoin(
      permissions,
      eq(rolePermissions.permissionId, permissions.id)
    )
    .where(inArray(rolePermissions.roleId, roleIds));

  return userPermissions.map((p) => p.name);
}

/**
 * Atribui papel a usuário
 */
export async function assignRoleToUser(
  userId: number,
  roleId: number,
  assignedBy: number
): Promise<void> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  // Verificar se já tem o papel
  const existing = await dbConn
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
    .limit(1);

  if (existing.length === 0) {
    await dbConn.insert(userRoles).values({
      userId,
      roleId,
      assignedBy,
    });

    logAccessAttempt(userId, "assign_role", `role_${roleId}`, true);
  }
}

/**
 * Remove papel de usuário
 */
export async function removeRoleFromUser(
  userId: number,
  roleId: number
): Promise<void> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  await dbConn
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));

  logAccessAttempt(userId, "remove_role", `role_${roleId}`, true);
}

/**
 * Obtém papéis de um usuário
 */
export async function getUserRoles(userId: number): Promise<Role[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const userRolesList = await dbConn
    .select({
      roleId: userRoles.roleId,
      roleName: roles.name,
      roleDescription: roles.description,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  // Para cada papel, buscar permissões
  const result: Role[] = [];

  for (const ur of userRolesList) {
    const rolePermissionsList = await dbConn
      .select({
        permissionId: permissions.id,
        permissionName: permissions.name,
        permissionDescription: permissions.description,
        permissionCategory: permissions.category,
      })
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id)
      )
      .where(eq(rolePermissions.roleId, ur.roleId));

    result.push({
      id: ur.roleId,
      name: ur.roleName,
      description: ur.roleDescription,
      permissions: rolePermissionsList.map((rp) => ({
        id: rp.permissionId,
        name: rp.permissionName,
        description: rp.permissionDescription,
        category: rp.permissionCategory,
      })),
    });
  }

  return result;
}

/**
 * Registra tentativa de acesso
 */
async function logAccessAttempt(
  userId: number,
  action: string,
  permission: string,
  allowed: boolean
): Promise<void> {
  const dbConn = await getDb();
  if (!dbConn) return;

  try {
    await dbConn.insert(accessAudit).values({
      userId,
      action,
      permission,
      allowed,
    });
  } catch (error) {
    console.error("Erro ao registrar auditoria:", error);
  }
}

/**
 * Obtém histórico de acesso
 */
export async function getAccessAuditLog(
  filters?: {
    userId?: number;
    permission?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<AccessAuditLog[]> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database connection failed");

  const conditions = [];

  if (filters?.userId) {
    conditions.push(eq(accessAudit.userId, filters.userId));
  }

  if (filters?.permission) {
    conditions.push(eq(accessAudit.permission, filters.permission));
  }

  if (filters?.startDate) {
    conditions.push(gte(accessAudit.timestamp, filters.startDate));
  }

  if (filters?.endDate) {
    conditions.push(lte(accessAudit.timestamp, filters.endDate));
  }

  const logs = await dbConn
    .select({
      id: accessAudit.id,
      userId: accessAudit.userId,
      userName: systemUsers.name,
      action: accessAudit.action,
      permission: accessAudit.permission,
      resource: accessAudit.resource,
      allowed: accessAudit.allowed,
      timestamp: accessAudit.timestamp,
    })
    .from(accessAudit)
    .innerJoin(systemUsers, eq(accessAudit.userId, systemUsers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(accessAudit.timestamp))
    .limit(filters?.limit || 1000);

  return logs;
}
```

### server/routers.ts - Endpoints RBAC

```typescript
export const appRouter = router({
  // ... outros routers

  rbac: router({
    hasPermission: protectedProcedure
      .input(z.object({ permission: z.string() }))
      .query(async ({ ctx, input }) => {
        return hasPermission(ctx.user.id, input.permission);
      }),

    getUserPermissions: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserPermissions(ctx.user.id);
      }),

    getUserRoles: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserRoles(ctx.user.id);
      }),

    assignRole: adminProcedure
      .input(z.object({ userId: z.number(), roleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assignRoleToUser(input.userId, input.roleId, ctx.user.id);
        return { success: true };
      }),

    removeRole: adminProcedure
      .input(z.object({ userId: z.number(), roleId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await removeRoleFromUser(input.userId, input.roleId);
        return { success: true };
      }),

    getAccessAuditLog: adminProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          permission: z.string().optional(),
          limit: z.number().default(100),
        })
      )
      .query(async ({ input }) => {
        return getAccessAuditLog({
          userId: input.userId,
          permission: input.permission,
          limit: input.limit,
        });
      }),
  }),
});
```

---

## Frontend - Código Completo

### client/src/hooks/usePermission.ts

```typescript
import { useAuth } from "./useAuth";
import { trpc } from "@/lib/trpc";

export function usePermission() {
  const { user } = useAuth();
  const { data: permissions = [] } = trpc.rbac.getUserPermissions.useQuery();

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const requirePermission = (permission: string): boolean => {
    if (!hasPermission(permission)) {
      console.warn(`Permissão necessária: ${permission}`);
      return false;
    }
    return true;
  };

  const canAccess = (permission: string): boolean => {
    return hasPermission(permission);
  };

  return {
    hasPermission,
    requirePermission,
    canAccess,
    permissions,
  };
}
```

### client/src/components/ProtectedButton.tsx

```typescript
import { Button, ButtonProps } from "@/components/ui/button";
import { usePermission } from "@/hooks/usePermission";
import { ReactNode } from "react";

interface ProtectedButtonProps extends ButtonProps {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ProtectedButton({
  permission,
  fallback,
  children,
  ...props
}: ProtectedButtonProps) {
  const { hasPermission } = usePermission();

  if (!hasPermission(permission)) {
    if (fallback) return <>{fallback}</>;
    return (
      <Button {...props} disabled title={`Permissão necessária: ${permission}`}>
        {children}
      </Button>
    );
  }

  return <Button {...props}>{children}</Button>;
}
```

### client/src/components/PermissionGate.tsx

```typescript
import { usePermission } from "@/hooks/usePermission";
import { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  permission,
  children,
  fallback,
}: PermissionGateProps) {
  const { hasPermission } = usePermission();

  if (!hasPermission(permission)) {
    if (fallback) return <>{fallback}</>;

    return (
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          Você não tem permissão para acessar este recurso.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
```

---

## Fluxos Operacionais

### Fluxo 1: Verificação de Permissão

```
1. Usuário tenta acessar recurso protegido
2. Frontend chama trpc.rbac.hasPermission
3. Backend busca papéis do usuário
4. Backend busca permissões dos papéis
5. Backend verifica se permissão está na lista
6. Backend registra tentativa em auditoria
7. Frontend recebe resultado (true/false)
8. Se false: exibe mensagem de acesso negado
9. Se true: permite acesso ao recurso
```

### Fluxo 2: Atribuição de Papel

```
1. Admin acessa página de gerenciamento de usuários
2. Seleciona usuário
3. Clica em "Atribuir Papel"
4. Seleciona papel desejado
5. Clica em "Confirmar"
6. Backend valida permissão do admin
7. Backend atribui papel ao usuário
8. Backend registra em auditoria
9. Frontend exibe confirmação
10. Usuário agora tem permissões do novo papel
```

### Fluxo 3: Auditoria de Acesso

```
1. Admin acessa página de auditoria
2. Aplica filtros (usuário, permissão, data)
3. Sistema exibe histórico de acessos
4. Admin pode visualizar:
   - Quem tentou acessar
   - Qual permissão
   - Se foi permitido ou negado
   - Data/hora da tentativa
```

---

**Fim da Documentação - Sistema RBAC**
