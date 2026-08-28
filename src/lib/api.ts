import { Covenant, System, Login, User, HistoryLog, SystemConfig, LoginReservationLog, AccessRequest } from '../types';
import { transformGoogleSheetsUrl, parseCSV, syncCsvRowsToDatabase } from './sheetsSync';
import { synchronizePasswordAcrossSameLoginAndBank } from './utils';

export interface FullDatabase {
  config: SystemConfig;
  users: User[];
  covenants: Covenant[];
  systems: System[];
  logins: Login[];
  accessRequests: AccessRequest[];
  favorites: { systemId: string; userId: string }[];
  reservationLogs: LoginReservationLog[];
  historyLogs: HistoryLog[];
}

// Fetch database
export async function fetchDatabase(): Promise<FullDatabase> {
  try {
    const response = await fetch('/api/data');
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const result = await response.json();
      if (result.success && result.database) {
        localStorage.setItem('access_manager_db', JSON.stringify(result.database));
        return result.database;
      }
    }
  } catch (err) {
    console.warn('API de dados indisponível, buscando do cache local:', err);
  }

  const cached = localStorage.getItem('access_manager_db');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // ignore
    }
  }

  throw new Error('Falha ao buscar dados do servidor');
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

// Save Covenant, System, Login, User, AccessRequest
export async function saveEntity(table: 'covenants' | 'systems' | 'logins' | 'users' | 'accessRequests', item: any): Promise<FullDatabase> {
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, item }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const result = await response.json();
      if (result.success && result.database) {
        localStorage.setItem('access_manager_db', JSON.stringify(result.database));
        return result.database;
      }
    }
  } catch (err) {
    console.warn(`Erro ao salvar ${table} no backend, salvando no cache local:`, err);
  }

  // LocalStorage fallback
  const cached = localStorage.getItem('access_manager_db');
  let currentDb: FullDatabase | null = null;
  if (cached) {
    try { currentDb = JSON.parse(cached); } catch (e) {}
  }
  if (currentDb && currentDb[table]) {
    const arr = currentDb[table] as any[];
    const idx = arr.findIndex((x: any) => x.id === item.id);
    if (idx > -1) {
      arr[idx] = { ...arr[idx], ...item };
    } else {
      arr.push(item);
    }

    // Synchronize passwords across all logins and covenants that share the same username and bank
    if (table === 'logins' && item.username && item.bank && item.password !== undefined) {
      const syncResult = synchronizePasswordAcrossSameLoginAndBank(item, currentDb.logins || [], currentDb.covenants || []);
      currentDb.logins = syncResult.updatedLogins;
      currentDb.covenants = syncResult.updatedCovenants;
    } else if (table === 'covenants' && item.login && item.bank && item.password !== undefined) {
      const syncResult = synchronizePasswordAcrossSameLoginAndBank({ username: item.login, bank: item.bank, password: item.password }, currentDb.logins || [], currentDb.covenants || []);
      currentDb.logins = syncResult.updatedLogins;
      currentDb.covenants = syncResult.updatedCovenants;
    }

    localStorage.setItem('access_manager_db', JSON.stringify(currentDb));
    return currentDb;
  }

  throw new Error(`Erro ao salvar item na tabela ${table}`);
}

// Delete Entity
export async function deleteEntity(table: 'covenants' | 'systems' | 'logins' | 'users' | 'accessRequests', id: string): Promise<FullDatabase> {
  try {
    const response = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const result = await response.json();
      if (result.success && result.database) {
        localStorage.setItem('access_manager_db', JSON.stringify(result.database));
        return result.database;
      }
    }
  } catch (err) {
    console.warn(`Erro ao deletar ${table} no backend, excluindo do cache local:`, err);
  }

  // LocalStorage fallback
  const cached = localStorage.getItem('access_manager_db');
  let currentDb: FullDatabase | null = null;
  if (cached) {
    try { currentDb = JSON.parse(cached); } catch (e) {}
  }
  if (currentDb && currentDb[table]) {
    currentDb[table] = (currentDb[table] as any[]).filter((x: any) => x.id !== id) as any;
    localStorage.setItem('access_manager_db', JSON.stringify(currentDb));
    return currentDb;
  }

  throw new Error(`Erro ao deletar item da tabela ${table}`);
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

// Sync Google Sheets
export async function syncGoogleSheets(
  url?: string,
  currentDb?: FullDatabase
): Promise<{ success: boolean; database: FullDatabase; stats: { covenantsCreated: number; loginsCreated: number; loginsUpdated: number; totalProcessed: number } }> {
  // Try server API first
  try {
    const response = await fetch('/api/sync-google-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const result = await response.json();
      if (result.success && result.database) {
        localStorage.setItem('access_manager_db', JSON.stringify(result.database));
        return result;
      }
      if (result.error) {
        throw new Error(result.error);
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('JSON') && !err.message.includes('fetch') && !err.message.includes('HTML') && !err.message.includes('Unexpected token')) {
      throw err;
    }
    console.warn('API backend indisponível ou retornou HTML, executando sincronização direta pelo cliente:', err);
  }

  // Client-side Direct Google Sheets Sync
  const csvUrl = transformGoogleSheetsUrl(url || '');
  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error(`Não foi possível acessar a planilha pública do Google. Código HTTP: ${res.status}`);
  }

  const csvText = await res.text();
  const lowerText = csvText.trim().toLowerCase();

  if (lowerText.startsWith('<!doctype') || lowerText.startsWith('<html') || csvText.includes('The page created')) {
    throw new Error('A planilha do Google Sheets não está publicada como CSV pública. No Google Sheets acesse: Arquivo > Compartilhar > Publicar na Web > Escolha "Valores separados por vírgula (.csv)" e clique em Publicar.');
  }

  const rows = parseCSV(csvText);
  if (!rows || rows.length === 0) {
    throw new Error('A planilha está vazia ou em formato incompatível.');
  }

  // Base DB fallback
  let baseDb = currentDb;
  if (!baseDb) {
    const cached = localStorage.getItem('access_manager_db');
    if (cached) {
      try { baseDb = JSON.parse(cached); } catch (e) {}
    }
  }

  if (!baseDb) {
    throw new Error('Estado do banco de dados indisponível no momento para sincronização.');
  }

  baseDb.config.googleSheetsSyncUrl = url || baseDb.config.googleSheetsSyncUrl;

  const { updatedDb, stats } = syncCsvRowsToDatabase(baseDb, rows);
  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));

  return {
    success: true,
    database: updatedDb,
    stats
  };
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
  importLogins,
  syncGoogleSheets
};

