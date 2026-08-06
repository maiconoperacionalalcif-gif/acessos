import { Covenant, Login, HistoryLog } from '../types';
import { FullDatabase } from './api';

/**
 * Transforms any Google Sheets sharing or pubhtml URL into a direct CSV export URL.
 */
export function transformGoogleSheetsUrl(rawUrl: string): string {
  let u = (rawUrl || '').trim();
  if (!u) {
    u = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcMpLh93RfKdkQ6mGju40CgMTaz7RhBP7S_5LiNWF1BY0ZigqO8dpZpSh1gtx_oAiDtIyXX8Jc-gbC/pubhtml";
  }

  // Case 1: Published HTML link (pubhtml)
  if (u.includes('/pubhtml')) {
    const gidMatch = u.match(/[?&]gid=(\d+)/);
    const baseUrl = u.split('/pubhtml')[0];
    return `${baseUrl}/pub?output=csv` + (gidMatch ? `&gid=${gidMatch[1]}` : '');
  }

  // Case 2: Standard spreadsheet link (/edit, /view, /htmlview)
  if (u.includes('/edit') || u.includes('/view') || u.includes('/htmlview')) {
    const spreadsheetIdMatch = u.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = u.match(/[?&]gid=(\d+)/);
    if (spreadsheetIdMatch) {
      const id = spreadsheetIdMatch[1];
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv` + (gidMatch ? `&gid=${gidMatch[1]}` : '');
    }
  }

  // Case 3: Published link without output format
  if (u.includes('/pub') && !u.includes('output=csv')) {
    u += (u.includes('?') ? '&' : '?') + 'output=csv';
  }

  return u;
}

/**
 * Robust CSV Parser supporting comma (,) and semicolon (;) delimiters,
 * quotes, and multi-line values.
 */
export function parseCSV(text: string): string[][] {
  if (!text) return [];

  // Detect delimiter (, or ;)
  let commaCount = 0;
  let semiCount = 0;
  let inQ = false;
  for (let i = 0; i < Math.min(text.length, 2000); i++) {
    if (text[i] === '"') inQ = !inQ;
    if (!inQ) {
      if (text[i] === ',') commaCount++;
      if (text[i] === ';') semiCount++;
    }
  }
  const delimiter = semiCount > commaCount ? ';' : ',';

  const lines: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      cur.push(cell.trim());
      cell = "";
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(cell.trim());
      lines.push(cur);
      cur = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || cur.length) {
    cur.push(cell.trim());
    lines.push(cur);
  }
  return lines;
}

/**
 * Syncs parsed CSV rows into the FullDatabase state.
 */
export function syncCsvRowsToDatabase(db: FullDatabase, rows: string[][]): {
  updatedDb: FullDatabase;
  stats: { covenantsCreated: number; loginsCreated: number; loginsUpdated: number; totalProcessed: number };
} {
  const covenants = [...(db.covenants || [])];
  const systems = [...(db.systems || [])];
  const logins = [...(db.logins || [])];
  const historyLogs = [...(db.historyLogs || [])];

  let currentConvenio = "Geral";
  let covenantsCreated = 0;
  let loginsCreated = 0;
  let loginsUpdated = 0;
  let totalProcessed = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!row || row.length === 0) continue;

    const colA = row[0] || "";
    const colB = row[1] || "";
    const colC = row[2] || "";
    const colD = row[3] || "";
    const colE = row[4] || "";

    const upperA = colA.toUpperCase();
    const upperB = colB.toUpperCase();

    // Skip header lines
    if (
      upperA.includes("CONVÊNIO") || 
      upperA.includes("CONVENIO") || 
      upperB.includes("USUARIO") || 
      upperB.includes("LOGIN") ||
      upperB.includes("SENHA")
    ) {
      continue;
    }

    if (colA && colA.trim().length > 0) {
      currentConvenio = colA.trim();
    }

    const username = colB.trim();
    const password = colC.trim();
    const bank = colD.trim();
    const managerUrl = colE.trim();

    // Valid row if username or password or bank exists
    if (username.length > 0 || password.length > 0 || bank.length > 0) {
      totalProcessed++;

      const convenioName = colA.trim() || currentConvenio || "Geral";

      // Find or create covenant
      let covenant = covenants.find(
        c => c.name.toLowerCase() === convenioName.toLowerCase()
      );

      if (!covenant) {
        // Infer state
        let inferredState = "Nacional";
        const stateMatches = convenioName.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
        if (stateMatches) {
          inferredState = stateMatches[1].toUpperCase();
        }

        // Infer category
        let category: any = "Estadual";
        const upperCov = convenioName.toUpperCase();
        if (upperCov.includes("INSS") || upperCov.includes("DATAPREV")) category = "INSS";
        else if (upperCov.includes("SIAPE") || upperCov.includes("SOUGOV") || upperCov.includes("FEDERAL")) category = "Federal";
        else if (upperCov.includes("PREF") || upperCov.includes("MUNICIPAL")) category = "Municipal";
        else if (upperCov.includes("MILITAR") || upperCov.includes("POLICIA") || upperCov.includes("PM")) category = "Militar";

        covenant = {
          id: `cov-gs-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: convenioName,
          category: category,
          state: inferredState,
          managerUrl: managerUrl || undefined,
          observations: "Sincronizado automaticamente da Planilha Google Sheets",
          status: "Ativo"
        };
        covenants.push(covenant);
        covenantsCreated++;
      } else if (managerUrl && !(covenant as any).managerUrl) {
        (covenant as any).managerUrl = managerUrl;
      }

      // System matching
      let system = systems.find(s => s.covenantId === covenant!.id);
      if (!system) {
        system = systems[0]; // fallback
      }

      // Find existing login
      const existingLoginIndex = logins.findIndex(l => 
        l.covenantId === covenant!.id && 
        l.username.toLowerCase() === username.toLowerCase()
      );

      const nowIso = new Date().toISOString();

      if (existingLoginIndex > -1) {
        const existing = logins[existingLoginIndex];
        logins[existingLoginIndex] = {
          ...existing,
          password: password || existing.password,
          bank: bank || existing.bank,
          url: managerUrl || existing.url,
          lastAlteration: nowIso,
          status: "Ativo"
        };
        loginsUpdated++;
      } else {
        const newLogin: Login = {
          id: `log-gs-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          covenantId: covenant.id,
          systemId: system ? system.id : (systems[0]?.id || "sys-1"),
          url: managerUrl || undefined,
          bank: bank || "Outros",
          shop: "Planilha Google",
          username: username || "usuario",
          password: password || "",
          cpf: "",
          pin: "",
          token: "",
          email: "",
          phone: "",
          responsible: "Sincronizado via Google Sheets",
          observations: "Importado da planilha sincronizada",
          creationDate: nowIso,
          lastAlteration: nowIso,
          expirationDate: "",
          status: "Ativo",
          reservedBy: "",
          reservedAt: ""
        };
        logins.push(newLogin);
        loginsCreated++;
      }
    }
  }

  // Add history log
  historyLogs.unshift({
    id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    userId: "usr-1",
    userName: "Sistema (Google Sheets)",
    actionType: "Criar",
    targetType: "Login",
    targetId: "sync-gs",
    targetName: `Sincronização: ${loginsCreated} novos, ${loginsUpdated} atualizados`,
    timestamp: new Date().toISOString(),
    ip: "127.0.0.1"
  });

  const updatedDb: FullDatabase = {
    ...db,
    covenants,
    systems,
    logins,
    historyLogs
  };

  return {
    updatedDb,
    stats: {
      covenantsCreated,
      loginsCreated,
      loginsUpdated,
      totalProcessed
    }
  };
}
