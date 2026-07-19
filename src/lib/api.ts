import { Covenant, System, Login, User, HistoryLog, SystemConfig, LoginReservationLog } from '../types';

export interface FullDatabase {
  config: SystemConfig;
  users: User[];
  covenants: Covenant[];
  systems: System[];
  logins: Login[];
  favorites: { systemId: string; userId: string }[];
  reservationLogs: LoginReservationLog[];
  historyLogs: HistoryLog[];
}

// Fetch database
export async function fetchDatabase(): Promise<FullDatabase> {
  const response = await fetch('/api/data');
  if (!response.ok) {
    throw new Error('Falha ao buscar dados do servidor');
  }
  const result = await response.json();
  if (result.success && result.database) {
    return result.database;
  }
  throw new Error(result.error || 'Erro desconhecido');
}

// Save Config
export async function saveSystemConfig(config: Partial<SystemConfig>): Promise<FullDatabase> {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao salvar configuração');
}

// Save Covenant, System, Login, User
export async function saveEntity(table: 'covenants' | 'systems' | 'logins' | 'users', item: any): Promise<FullDatabase> {
  const response = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, item }),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao salvar item');
}

// Delete Entity
export async function deleteEntity(table: 'covenants' | 'systems' | 'logins' | 'users', id: string): Promise<FullDatabase> {
  const response = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, id }),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao deletar item');
}

// Toggle Favorite
export async function toggleFavorite(systemId: string, userId: string): Promise<FullDatabase> {
  const response = await fetch('/api/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemId, userId }),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao favoritar');
}

// Add History Log
export async function addHistoryLog(log: Omit<HistoryLog, 'id'>): Promise<FullDatabase> {
  const logWithId: HistoryLog = {
    ...log,
    id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
  };
  const response = await fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logWithId),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao registrar histórico');
}

// Reserve Login
export async function reserveLogin(loginId: string, username: string, timestamp: string): Promise<FullDatabase> {
  const response = await fetch('/api/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, username, timestamp }),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao reservar login');
}

// Release Login
export async function releaseLogin(loginId: string, timestamp: string): Promise<FullDatabase> {
  const response = await fetch('/api/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, timestamp }),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao liberar login');
}

// Import Logins
export async function importLogins(logins: Login[], logs: HistoryLog[]): Promise<FullDatabase> {
  const response = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logins, logs }),
  });
  const result = await response.json();
  if (result.success && result.database) return result.database;
  throw new Error(result.error || 'Erro ao importar logins');
}

// Unified export for src/App.tsx matching
export const api = {
  getDatabase: fetchDatabase,
  saveConfig: saveSystemConfig,
  saveItem: saveEntity,
  deleteItem: deleteEntity,
  toggleFavorite,
  addLog: addHistoryLog,
  reserveLogin,
  releaseLogin,
  importLogins
};

