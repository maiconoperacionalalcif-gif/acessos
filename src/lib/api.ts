import { Covenant, System, Login, User, HistoryLog, SystemConfig, LoginReservationLog, AccessRequest } from '../types';
import { transformGoogleSheetsUrl, parseCSV, syncCsvRowsToDatabase } from './sheetsSync';
import { synchronizePasswordAcrossSameLoginAndBank } from './utils';
import { db as firestoreDb } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

const FIRESTORE_DOC_PATH = {
  collection: 'system_database',
  docId: 'main'
};

// Helper to save entire DB state to Firestore
async function persistToFirestore(data: FullDatabase): Promise<void> {
  try {
    const docRef = doc(firestoreDb, FIRESTORE_DOC_PATH.collection, FIRESTORE_DOC_PATH.docId);
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    console.warn('Falha ao persistir no Firestore:', err);
  }
}

// Fetch database with Firestore Cloud Priority
export async function fetchDatabase(): Promise<FullDatabase> {
  // 1. Try Firestore First (Cloud Persistent)
  try {
    const docRef = doc(firestoreDb, FIRESTORE_DOC_PATH.collection, FIRESTORE_DOC_PATH.docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const cloudData = snap.data() as FullDatabase;
      if (cloudData && Array.isArray(cloudData.users) && cloudData.users.length > 0) {
        localStorage.setItem('access_manager_db', JSON.stringify(cloudData));
        return cloudData;
      }
    }
  } catch (firestoreErr) {
    console.warn('Firestore indisponível, buscando do backend/local:', firestoreErr);
  }

  // 2. Try Server API
  try {
    const response = await fetch('/api/data');
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const result = await response.json();
      if (result.success && result.database) {
        localStorage.setItem('access_manager_db', JSON.stringify(result.database));
        // Seed Firestore if it was empty
        persistToFirestore(result.database).catch(() => {});
        return result.database;
      }
    }
  } catch (err) {
    console.warn('API de dados indisponível, buscando do cache local:', err);
  }

  // 3. Try LocalStorage Cache
  const cached = localStorage.getItem('access_manager_db');
  if (cached) {
    try {
      const localData = JSON.parse(cached);
      persistToFirestore(localData).catch(() => {});
      return localData;
    } catch (e) {
      // ignore
    }
  }

  throw new Error('Falha ao buscar dados do servidor e da nuvem.');
}

// Save Config
export async function saveSystemConfig(config: Partial<SystemConfig>): Promise<FullDatabase> {
  const currentDb = await fetchDatabase().catch(() => null);
  let updatedDb: FullDatabase;
  if (currentDb) {
    updatedDb = {
      ...currentDb,
      config: { ...currentDb.config, ...config }
    };
  } else {
    throw new Error('Banco de dados indisponível para atualizar configuração.');
  }

  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
  await persistToFirestore(updatedDb);

  // Sync with Express backend
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }).catch(() => {});

  return updatedDb;
}

// Save Covenant, System, Login, User, AccessRequest
export async function saveEntity(table: 'covenants' | 'systems' | 'logins' | 'users' | 'accessRequests', item: any): Promise<FullDatabase> {
  const currentDb = await fetchDatabase().catch(() => {
    const cached = localStorage.getItem('access_manager_db');
    return cached ? JSON.parse(cached) : null;
  });

  if (!currentDb || !currentDb[table]) {
    throw new Error(`Tabela ${table} não encontrada no banco de dados.`);
  }

  const arr = [...(currentDb[table] as any[])];
  const idx = arr.findIndex((x: any) => x.id === item.id);
  if (idx > -1) {
    arr[idx] = { ...arr[idx], ...item };
  } else {
    arr.push(item);
  }

  let updatedDb: FullDatabase = {
    ...currentDb,
    [table]: arr
  };

  // Synchronize passwords across all logins and covenants that share the same username and bank
  if (table === 'logins' && item.username && item.bank && item.password !== undefined) {
    const syncResult = synchronizePasswordAcrossSameLoginAndBank(item, updatedDb.logins || [], updatedDb.covenants || []);
    updatedDb.logins = syncResult.updatedLogins;
    updatedDb.covenants = syncResult.updatedCovenants;
  } else if (table === 'covenants' && item.login && item.bank && item.password !== undefined) {
    const syncResult = synchronizePasswordAcrossSameLoginAndBank({ username: item.login, bank: item.bank, password: item.password }, updatedDb.logins || [], updatedDb.covenants || []);
    updatedDb.logins = syncResult.updatedLogins;
    updatedDb.covenants = syncResult.updatedCovenants;
  }

  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
  await persistToFirestore(updatedDb);

  // Background sync with Express backend
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, item }),
  }).catch(() => {});

  return updatedDb;
}

// Delete Entity
export async function deleteEntity(table: 'covenants' | 'systems' | 'logins' | 'users' | 'accessRequests', id: string): Promise<FullDatabase> {
  const currentDb = await fetchDatabase().catch(() => {
    const cached = localStorage.getItem('access_manager_db');
    return cached ? JSON.parse(cached) : null;
  });

  if (!currentDb || !currentDb[table]) {
    throw new Error(`Tabela ${table} não encontrada.`);
  }

  const updatedDb: FullDatabase = {
    ...currentDb,
    [table]: (currentDb[table] as any[]).filter((x: any) => x.id !== id)
  };

  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
  await persistToFirestore(updatedDb);

  // Background sync with Express backend
  fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, id }),
  }).catch(() => {});

  return updatedDb;
}

// Toggle Favorite
export async function toggleFavorite(systemId: string, userId: string): Promise<FullDatabase> {
  const currentDb = await fetchDatabase();
  const favorites = [...(currentDb.favorites || [])];
  const existingIndex = favorites.findIndex(x => x.systemId === systemId && x.userId === userId);
  
  if (existingIndex > -1) {
    favorites.splice(existingIndex, 1);
  } else {
    favorites.push({ systemId, userId });
  }

  const updatedDb = { ...currentDb, favorites };
  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
  await persistToFirestore(updatedDb);

  fetch('/api/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemId, userId }),
  }).catch(() => {});

  return updatedDb;
}

// Add History Log
export async function addHistoryLog(log: Omit<HistoryLog, 'id'>): Promise<FullDatabase> {
  const logWithId: HistoryLog = {
    ...log,
    id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
  };

  const currentDb = await fetchDatabase().catch(() => {
    const cached = localStorage.getItem('access_manager_db');
    return cached ? JSON.parse(cached) : null;
  });

  if (currentDb) {
    const historyLogs = [logWithId, ...(currentDb.historyLogs || [])].slice(0, 500);
    const updatedDb = { ...currentDb, historyLogs };
    localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
    persistToFirestore(updatedDb).catch(() => {});
  }

  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logWithId),
  }).catch(() => {});

  return currentDb || ({} as any);
}

// Reserve Login
export async function reserveLogin(loginId: string, username: string, timestamp: string): Promise<FullDatabase> {
  const currentDb = await fetchDatabase();
  let targetLogin: Login | undefined;
  const logins = (currentDb.logins || []).map(l => {
    if (l.id === loginId) {
      targetLogin = l;
      return { ...l, reservedBy: username, reservedAt: timestamp };
    }
    return l;
  });

  const reservationLog: LoginReservationLog = {
    id: `res-${Date.now()}`,
    loginId,
    loginUser: targetLogin?.username || 'N/A',
    systemName: targetLogin?.bank || 'Sistema',
    reservedBy: username,
    reservedAt: timestamp
  };

  const reservationLogs: LoginReservationLog[] = [
    reservationLog,
    ...(currentDb.reservationLogs || [])
  ].slice(0, 500);

  const updatedDb: FullDatabase = { ...currentDb, logins, reservationLogs };
  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
  await persistToFirestore(updatedDb);

  fetch('/api/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, username, timestamp }),
  }).catch(() => {});

  return updatedDb;
}

// Release Login
export async function releaseLogin(loginId: string, timestamp: string): Promise<FullDatabase> {
  const currentDb = await fetchDatabase();
  let reservedBy = '';
  let targetLogin: Login | undefined;
  const logins = (currentDb.logins || []).map(l => {
    if (l.id === loginId) {
      targetLogin = l;
      reservedBy = l.reservedBy || '';
      return { ...l, reservedBy: undefined, reservedAt: undefined };
    }
    return l;
  });

  const reservationLog: LoginReservationLog = {
    id: `res-${Date.now()}`,
    loginId,
    loginUser: targetLogin?.username || 'N/A',
    systemName: targetLogin?.bank || 'Sistema',
    reservedBy: reservedBy || 'Sistema',
    reservedAt: targetLogin?.reservedAt || timestamp,
    releasedAt: timestamp
  };

  const reservationLogs: LoginReservationLog[] = [
    reservationLog,
    ...(currentDb.reservationLogs || [])
  ].slice(0, 500);

  const updatedDb: FullDatabase = { ...currentDb, logins, reservationLogs };
  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
  await persistToFirestore(updatedDb);

  fetch('/api/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, timestamp }),
  }).catch(() => {});

  return updatedDb;
}

// Import Logins
export async function importLogins(logins: Login[], logs: HistoryLog[]): Promise<FullDatabase> {
  const currentDb = await fetchDatabase();
  const currentLogins = [...(currentDb.logins || [])];

  for (const imported of logins) {
    const idx = currentLogins.findIndex(l => l.id === imported.id);
    if (idx > -1) {
      currentLogins[idx] = { ...currentLogins[idx], ...imported };
    } else {
      currentLogins.push(imported);
    }
  }

  const historyLogs = [...(logs || []), ...(currentDb.historyLogs || [])].slice(0, 500);
  const updatedDb = { ...currentDb, logins: currentLogins, historyLogs };
  
  localStorage.setItem('access_manager_db', JSON.stringify(updatedDb));
  await persistToFirestore(updatedDb);

  fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logins, logs }),
  }).catch(() => {});

  return updatedDb;
}

// Sync Google Sheets
export async function syncGoogleSheets(
  url?: string,
  currentDb?: FullDatabase
): Promise<{ success: boolean; database: FullDatabase; stats: { covenantsCreated: number; loginsCreated: number; loginsUpdated: number; totalProcessed: number } }> {
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
    baseDb = await fetchDatabase().catch(() => null);
  }
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
  await persistToFirestore(updatedDb);

  // Background notification to server
  fetch('/api/sync-google-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).catch(() => {});

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

