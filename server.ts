import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { FullDatabase } from "./src/lib/api";

// In-Memory Spreadsheet Simulation (Database)
let dataBase: FullDatabase = {
  config: {
    companyName: "Access Manager Ltda",
    logoUrl: "",
    primaryColor: "#2563eb", // Blue-600
    sessionTimeoutMinutes: 30,
    rowsPerPage: 10,
    googleAppsScriptUrl: "",
    googleSheetsSyncUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcMpLh93RfKdkQ6mGju40CgMTaz7RhBP7S_5LiNWF1BY0ZigqO8dpZpSh1gtx_oAiDtIyXX8Jc-gbC/pubhtml"
  },
  
  users: [
    {
      id: "usr-1",
      username: "admin",
      name: "Maicon Operacional (Admin)",
      password: "admin",
      role: "Administrador",
      status: "Ativo",
      allowedCovenants: [],
      allowedBanks: []
    },
    {
      id: "usr-2",
      username: "supervisor",
      name: "Amanda Lima (Supervisor)",
      password: "supervisor",
      role: "Supervisor",
      status: "Ativo",
      allowedCovenants: ["cov-1", "cov-2"],
      allowedBanks: ["Banco do Brasil", "Itaú"]
    },
    {
      id: "usr-3",
      username: "operador",
      name: "Bruno Silva (Operador)",
      password: "operador",
      role: "Operador",
      status: "Ativo",
      allowedCovenants: ["cov-1"],
      allowedBanks: ["Banco do Brasil"]
    }
  ],

  covenants: [
    {
      id: "cov-1",
      name: "SIAPE / SouGov",
      category: "Federal",
      state: "DF",
      city: "Brasília",
      organ: "Ministério da Economia",
      manager: "Governo Federal",
      observations: "Acesso unificado via SouGov. Gov.br bronze/prata/ouro.",
      status: "Ativo"
    },
    {
      id: "cov-2",
      name: "INSS - Dataprev",
      category: "INSS",
      state: "Nacional",
      city: "Rio de Janeiro",
      organ: "INSS",
      manager: "Dataprev",
      observations: "Consultas de extrato de empréstimo e margem.",
      status: "Ativo"
    },
    {
      id: "cov-3",
      name: "Governo de SP - Portal do Estado",
      category: "Estadual",
      state: "SP",
      city: "São Paulo",
      organ: "Secretaria de Gestão Pública",
      manager: "Prodesp",
      observations: "Consignado estadual SP - servidores ativos e aposentados.",
      status: "Ativo"
    },
    {
      id: "cov-4",
      name: "Prefeitura de SP - Consiglog",
      category: "Municipal",
      state: "SP",
      city: "São Paulo",
      organ: "Prefeitura de SP",
      manager: "Consiglog",
      observations: "Portal de consignação dos servidores municipais de SP.",
      status: "Ativo"
    }
  ],

  systems: [
    {
      id: "sys-1",
      covenantId: "cov-1",
      name: "SouGov",
      description: "Sistema de Gestão de Pessoas do Governo Federal",
      url: "https://www.gov.br/sougov",
      icon: "ShieldAlert",
      observations: "Exige verificação em duas etapas em alguns perfis.",
      status: "Ativo"
    },
    {
      id: "sys-2",
      covenantId: "cov-2",
      name: "Dataprev - Meu INSS",
      description: "Extrato e consulta de benefícios previdenciários",
      url: "https://meu.inss.gov.br",
      icon: "Database",
      observations: "Integração via certificado digital e login CPF.",
      status: "Ativo"
    },
    {
      id: "sys-3",
      covenantId: "cov-3",
      name: "Portal do Servidor SP",
      description: "Consulta de holerite e consignações SP",
      url: "https://www.portaldoservidor.sp.gov.br",
      icon: "Globe",
      observations: "Instabilidade frequente no fechamento de folha.",
      status: "Ativo"
    },
    {
      id: "sys-4",
      covenantId: "cov-4",
      name: "Consiglog Prefeitura SP",
      description: "Gerenciamento de margem consignável da PMSP",
      url: "https://pmsp.consiglog.com.br",
      icon: "KeyRound",
      observations: "Usa captcha na tela de autenticação inicial.",
      status: "Ativo"
    },
    {
      id: "sys-5",
      covenantId: "",
      name: "ConsigX",
      description: "Gestora de Margem Consignável ConsigX",
      url: "https://saec.consigx.com.br",
      icon: "Monitor",
      observations: "Gestora utilizada em diversos convênios estaduais e municipais.",
      status: "Ativo"
    }
  ],

  logins: [
    {
      id: "log-1",
      covenantId: "cov-1",
      systemId: "sys-1",
      bank: "Banco do Brasil",
      shop: "Filial SP Centro",
      username: "bb.consignado01",
      password: "BB@Consig#2026",
      cpf: "123.456.789-00",
      pin: "4321",
      token: "BB-9876",
      email: "consignado01@bbfinanceiro.com.br",
      phone: "(11) 98765-4321",
      responsible: "Carlos Alberto",
      observations: "Utilizar apenas para propostas acima de R$ 50k.",
      creationDate: "2026-01-10T10:00:00.000Z",
      lastAlteration: "2026-07-15T14:30:00.000Z",
      expirationDate: "2026-12-31T23:59:59.000Z",
      status: "Ativo",
      reservedBy: undefined,
      reservedAt: undefined
    },
    {
      id: "log-2",
      covenantId: "cov-2",
      systemId: "sys-2",
      bank: "Itaú Consignado",
      shop: "Matriz Campinas",
      username: "itau.prev02",
      password: "ItauPass!998",
      cpf: "987.654.321-11",
      pin: "9988",
      token: "",
      email: "itauprev@consignados.com.br",
      phone: "(19) 97123-4567",
      responsible: "Amanda Lima",
      observations: "Focar em portabilidade e refinanciamentos.",
      creationDate: "2026-02-15T09:00:00.000Z",
      lastAlteration: "2026-06-20T11:15:00.000Z",
      expirationDate: "2026-08-30T23:59:59.000Z",
      status: "Ativo",
      reservedBy: undefined,
      reservedAt: undefined
    },
    {
      id: "log-3",
      covenantId: "cov-3",
      systemId: "sys-3",
      bank: "Banco PAN",
      shop: "Loja Virtual",
      username: "pan.servidores.sp",
      password: "PanPassword#77",
      cpf: "456.789.012-33",
      pin: "",
      token: "PAN-8811",
      email: "pansp@correspondentes.com.br",
      phone: "(11) 96123-0099",
      responsible: "Maicon Santos",
      observations: "Acesso bloqueado temporariamente para manutenção no portal estadual.",
      creationDate: "2026-03-01T14:00:00.000Z",
      lastAlteration: "2026-07-10T16:45:00.000Z",
      expirationDate: "2026-10-15T23:59:59.000Z",
      status: "Bloqueado",
      reservedBy: undefined,
      reservedAt: undefined
    },
    {
      id: "log-4",
      covenantId: "cov-4",
      systemId: "sys-4",
      bank: "Santander",
      shop: "Filial RJ Copacabana",
      username: "sant.pmsp05",
      password: "SantConsig@2026",
      cpf: "321.654.987-44",
      pin: "1122",
      token: "ST-0909",
      email: "santpmsp@agencia.com.br",
      phone: "(21) 99111-2233",
      responsible: "Juliana Mendes",
      observations: "Apenas para liberação de margem livre.",
      creationDate: "2026-04-18T11:00:00.000Z",
      lastAlteration: "2026-07-01T10:00:00.000Z",
      expirationDate: "2026-07-20T23:59:59.000Z", // Expirando em breve
      status: "Ativo",
      reservedBy: "Bruno Silva",
      reservedAt: "2026-07-17T18:00:00.000Z" // Reservado há alguns minutos
    }
  ],

  favorites: [
    { systemId: "sys-1", userId: "usr-1" },
    { systemId: "sys-2", userId: "usr-1" },
    { systemId: "sys-1", userId: "usr-2" }
  ],

  reservationLogs: [
    {
      id: "res-1",
      loginId: "log-1",
      loginUser: "bb.consignado01",
      systemName: "SouGov",
      reservedBy: "Bruno Silva",
      reservedAt: "2026-07-17T16:00:00.000Z",
      releasedAt: "2026-07-17T16:45:00.000Z",
      durationSeconds: 2700
    },
    {
      id: "res-2",
      loginId: "log-2",
      loginUser: "itau.prev02",
      systemName: "Dataprev - Meu INSS",
      reservedBy: "Amanda Lima",
      reservedAt: "2026-07-17T14:30:00.000Z",
      releasedAt: "2026-07-17T15:10:00.000Z",
      durationSeconds: 2400
    }
  ],

  historyLogs: [
    {
      id: "hist-1",
      userId: "usr-1",
      userName: "Maicon Operacional (Admin)",
      actionType: "Criar",
      targetType: "Login",
      targetId: "log-1",
      targetName: "bb.consignado01",
      timestamp: "2026-07-15T14:30:00.000Z",
      ip: "192.168.1.50"
    },
    {
      id: "hist-2",
      userId: "usr-2",
      userName: "Amanda Lima (Supervisor)",
      actionType: "Copiar Senha",
      targetType: "Login",
      targetId: "log-1",
      targetName: "bb.consignado01",
      timestamp: "2026-07-17T15:30:00.000Z",
      ip: "192.168.1.51"
    },
    {
      id: "hist-3",
      userId: "usr-3",
      userName: "Bruno Silva (Operador)",
      actionType: "Abrir Sistema",
      targetType: "System",
      targetId: "sys-1",
      targetName: "SouGov",
      timestamp: "2026-07-17T16:00:00.000Z",
      ip: "192.168.1.52"
    }
  ]
};

// Proxies database operations to Google Apps Script Web App if URL is provided
async function callAppsScript(url: string, action: string, payload: any) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Apps Script responded with status: ${response.status}`);
    }
    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error("Error communicating with Google Apps Script:", error.message || error);
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper middleware to forward requests to Google Apps Script if URL exists
  const useSheet = async (action: string, localFallback: () => any, appsScriptPayload: any = {}) => {
    const scriptUrl = dataBase.config.googleAppsScriptUrl;
    if (scriptUrl) {
      try {
        console.log(`Routing ${action} to Google Sheets Apps Script...`);
        const result = await callAppsScript(scriptUrl, action, appsScriptPayload);
        if (result && result.success) {
          // Sync local DB cache if return format contains database
          if (result.database) {
            dataBase = { ...dataBase, ...result.database };
          }
          return result;
        } else {
          console.warn(`Apps Script returned success=false or invalid response for ${action}. Falling back to local database.`, result);
          return localFallback();
        }
      } catch (err: any) {
        console.error("Failed to call Apps Script, falling back to local database:", err.message);
        // If external call fails, we execute local fallback
        return localFallback();
      }
    } else {
      return localFallback();
    }
  };

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get all data
  app.get("/api/data", async (req, res) => {
    const result = await useSheet("getAll", () => ({ success: true, database: dataBase }));
    res.json(result);
  });

  // Save Config
  app.post("/api/config", async (req, res) => {
    const config = req.body;
    const result = await useSheet("saveConfig", () => {
      dataBase.config = { ...dataBase.config, ...config };
      return { success: true, database: dataBase };
    }, { config });
    res.json(result);
  });

  // Save / Update Entity
  app.post("/api/save", async (req, res) => {
    const { table, item } = req.body; // table: 'covenants' | 'systems' | 'logins' | 'users'
    const result = await useSheet("saveItem", () => {
      const dbTable = (dataBase as any)[table];
      if (dbTable) {
        const existingIndex = dbTable.findIndex((x: any) => x.id === item.id);
        if (existingIndex > -1) {
          dbTable[existingIndex] = { ...dbTable[existingIndex], ...item };
        } else {
          dbTable.push(item);
        }
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Tabela não encontrada" };
    }, { table, item });

    // Guarantee local memory sync
    const dbTable = (dataBase as any)[table];
    if (dbTable) {
      const existingIndex = dbTable.findIndex((x: any) => x.id === item.id);
      if (existingIndex > -1) {
        dbTable[existingIndex] = { ...dbTable[existingIndex], ...item };
      } else {
        dbTable.push(item);
      }
    }

    const finalResult = {
      success: result?.success ?? true,
      database: result?.database || dataBase
    };
    res.json(finalResult);
  });

  // Delete Entity
  app.post("/api/delete", async (req, res) => {
    const { table, id } = req.body;
    const result = await useSheet("deleteItem", () => {
      const dbTable = (dataBase as any)[table];
      if (dbTable) {
        (dataBase as any)[table] = dbTable.filter((x: any) => x.id !== id);
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Tabela não encontrada" };
    }, { table, id });

    // Guarantee local memory sync
    const dbTable = (dataBase as any)[table];
    if (dbTable) {
      (dataBase as any)[table] = dbTable.filter((x: any) => x.id !== id);
    }

    const finalResult = {
      success: result?.success ?? true,
      database: result?.database || dataBase
    };
    res.json(finalResult);
  });

  // Toggle Favorite
  app.post("/api/favorite", async (req, res) => {
    const { systemId, userId } = req.body;
    const result = await useSheet("toggleFavorite", () => {
      const existingIndex = dataBase.favorites.findIndex(
        x => x.systemId === systemId && x.userId === userId
      );
      if (existingIndex > -1) {
        dataBase.favorites.splice(existingIndex, 1);
      } else {
        dataBase.favorites.push({ systemId, userId });
      }
      return { success: true, database: dataBase };
    }, { systemId, userId });
    res.json(result);
  });

  // Log Action to History
  app.post("/api/log", async (req, res) => {
    const log = req.body; // HistoryLog details
    const result = await useSheet("addLog", () => {
      dataBase.historyLogs.unshift(log);
      // Cap size at 500 records
      if (dataBase.historyLogs.length > 500) {
        dataBase.historyLogs = dataBase.historyLogs.slice(0, 500);
      }
      return { success: true, database: dataBase };
    }, { log });
    res.json(result);
  });

  // Login Reservation
  app.post("/api/reserve", async (req, res) => {
    const { loginId, username, timestamp } = req.body;
    const result = await useSheet("reserveLogin", () => {
      const login = dataBase.logins.find(x => x.id === loginId);
      if (login) {
        if (login.reservedBy) {
          return { success: false, error: "Este login já está reservado por outro usuário." };
        }
        login.reservedBy = username;
        login.reservedAt = timestamp;
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Login não encontrado" };
    }, { loginId, username, timestamp });
    res.json(result);
  });

  // Release Login
  app.post("/api/release", async (req, res) => {
    const { loginId, timestamp } = req.body;
    const result = await useSheet("releaseLogin", () => {
      const login = dataBase.logins.find(x => x.id === loginId);
      if (login) {
        if (!login.reservedBy) {
          return { success: false, error: "Este login não está reservado." };
        }
        
        // Calculate duration
        const startTime = login.reservedAt ? new Date(login.reservedAt).getTime() : new Date().getTime();
        const endTime = new Date(timestamp).getTime();
        const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
        
        const system = dataBase.systems.find(s => s.id === login.systemId);

        const reservationLog = {
          id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          loginId: login.id,
          loginUser: login.username,
          systemName: system ? system.name : "Sistema Desconhecido",
          reservedBy: login.reservedBy,
          reservedAt: login.reservedAt || timestamp,
          releasedAt: timestamp,
          durationSeconds: durationSeconds
        };

        dataBase.reservationLogs.unshift(reservationLog);
        
        login.reservedBy = undefined;
        login.reservedAt = undefined;
        
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Login não encontrado" };
    }, { loginId, timestamp });
    res.json(result);
  });

  // Batch Import Logins
  app.post("/api/import", async (req, res) => {
    const { logins: importedLogins, logs: histLogs } = req.body;
    const result = await useSheet("importLogins", () => {
      if (Array.isArray(importedLogins)) {
        importedLogins.forEach(item => {
          dataBase.logins.push(item);
        });
        if (Array.isArray(histLogs)) {
          histLogs.forEach(log => dataBase.historyLogs.unshift(log));
        }
        return { success: true, database: dataBase };
      }
      return { success: false, error: "Lista de logins inválida" };
    }, { logins: importedLogins, logs: histLogs });
    res.json(result);
  });

  // Google Sheets Sync Route
  app.post("/api/sync-google-sheets", async (req, res) => {
    try {
      let { url } = req.body;
      if (!url) {
        url = dataBase.config.googleSheetsSyncUrl || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQcMpLh93RfKdkQ6mGju40CgMTaz7RhBP7S_5LiNWF1BY0ZigqO8dpZpSh1gtx_oAiDtIyXX8Jc-gbC/pubhtml";
      }

      // Save URL to config
      dataBase.config.googleSheetsSyncUrl = url;

      // Transform URL to CSV export format
      let csvUrl = url.trim();
      if (csvUrl.includes('/pubhtml')) {
        csvUrl = csvUrl.replace('/pubhtml', '/pub?output=csv');
      } else if (csvUrl.includes('/edit')) {
        csvUrl = csvUrl.replace(/\/edit.*$/, '/export?format=csv');
      } else if (!csvUrl.includes('output=csv') && !csvUrl.includes('format=csv')) {
        if (csvUrl.includes('?')) {
          csvUrl += '&output=csv';
        } else {
          csvUrl += '/pub?output=csv';
        }
      }

      console.log(`Fetching Google Sheets CSV from: ${csvUrl}`);
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Não foi possível acessar a planilha. Status: ${response.status}`);
      }

      const csvText = await response.text();

      // Helper CSV Parser
      function parseCSV(text: string): string[][] {
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
          } else if (c === ',' && !inQuotes) {
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

      const rows = parseCSV(csvText);

      let currentConvenio = "Geral";
      let covenantsCreated = 0;
      let loginsCreated = 0;
      let loginsUpdated = 0;
      let totalProcessed = 0;

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const colA = row[0] || "";
        const colB = row[1] || "";
        const colC = row[2] || "";
        const colD = row[3] || "";
        const colE = row[4] || "";

        const upperA = colA.toUpperCase();
        const upperB = colB.toUpperCase();

        // Skip header lines
        if (upperA.includes("CONVÊNIO") || upperB.includes("USUARIO") || upperB.includes("LOGIN")) continue;

        if (colA && colA.trim().length > 0) {
          currentConvenio = colA.trim();
        }

        const username = colB.trim();
        const password = colC.trim();
        const bank = colD.trim();
        const managerUrl = colE.trim();

        // Valid row if username or password exists
        if (username.length > 0 || password.length > 0) {
          totalProcessed++;

          const convenioName = colA.trim() || currentConvenio || "Geral";

          // Find or create covenant
          let covenant = dataBase.covenants.find(
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
            dataBase.covenants.push(covenant);
            covenantsCreated++;
          } else if (managerUrl && !covenant.managerUrl) {
            covenant.managerUrl = managerUrl;
          }

          // System matching
          let system = dataBase.systems.find(s => s.covenantId === covenant!.id);
          if (!system) {
            system = dataBase.systems[0]; // fallback
          }

          // Find existing login
          const existingLoginIndex = dataBase.logins.findIndex(l => 
            l.covenantId === covenant!.id && 
            l.username.toLowerCase() === username.toLowerCase()
          );

          const nowIso = new Date().toISOString();

          if (existingLoginIndex > -1) {
            const existing = dataBase.logins[existingLoginIndex];
            dataBase.logins[existingLoginIndex] = {
              ...existing,
              password: password || existing.password,
              bank: bank || existing.bank,
              url: managerUrl || existing.url,
              lastAlteration: nowIso,
              status: "Ativo"
            };
            loginsUpdated++;
          } else {
            const newLogin = {
              id: `log-gs-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              covenantId: covenant.id,
              systemId: system ? system.id : "sys-1",
              url: managerUrl || undefined,
              bank: bank || "Outros",
              shop: "Planilha Google",
              username: username,
              password: password,
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
              status: "Ativo" as const,
              reservedBy: "",
              reservedAt: ""
            };
            dataBase.logins.push(newLogin);
            loginsCreated++;
          }
        }
      }

      // Add log entry
      dataBase.historyLogs.unshift({
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

      res.json({
        success: true,
        database: dataBase,
        stats: {
          covenantsCreated,
          loginsCreated,
          loginsUpdated,
          totalProcessed
        }
      });
    } catch (error: any) {
      console.error("Error syncing Google Sheets:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Erro ao processar e sincronizar planilha do Google Sheets"
      });
    }
  });

  // Vite middleware for development (with fallback to production if dist directory exists)
  const hasDist = fs.existsSync(path.join(process.cwd(), "dist"));
  if (process.env.NODE_ENV !== "production" && !hasDist) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
