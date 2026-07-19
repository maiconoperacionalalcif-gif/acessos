import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Copy, 
  Check, 
  HelpCircle, 
  Database, 
  Download, 
  Upload, 
  FileCode,
  Sparkles,
  RefreshCw,
  Building2,
  Lock,
  Wifi,
  Eye,
  EyeOff
} from 'lucide-react';
import { SystemConfig } from '../types';

interface SettingsProps {
  config: SystemConfig;
  darkMode: boolean;
  onSaveConfig: (config: Partial<SystemConfig>) => void;
  onRestoreBackup: (dbState: any) => void;
  fullState: any; // Entire database for backing up
}

export default function Settings({
  config,
  darkMode,
  onSaveConfig,
  onRestoreBackup,
  fullState
}: SettingsProps) {
  const [companyName, setCompanyName] = useState(config.companyName || '');
  const [logoUrl, setLogoUrl] = useState(config.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor || '#2563eb');
  const [sessionTimeout, setSessionTimeout] = useState(config.sessionTimeoutMinutes || 30);
  const [rowsPerPage, setRowsPerPage] = useState(config.rowsPerPage || 10);
  const [appsScriptUrl, setAppsScriptUrl] = useState(config.googleAppsScriptUrl || '');

  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      companyName,
      logoUrl,
      primaryColor,
      sessionTimeoutMinutes: Number(sessionTimeout),
      rowsPerPage: Number(rowsPerPage),
      googleAppsScriptUrl: appsScriptUrl
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Google Apps Script source code template for sheets integration
  const appsScriptCode = `/**
 * Google Apps Script API para ACCESS MANAGER
 * Cole este código em Extensões > Apps Script do seu Google Sheets e publique como Web App.
 */

const SHEET_NAME_MAP = {
  config: "Configuracoes",
  users: "Usuarios",
  covenants: "Convenios",
  systems: "Sistemas",
  logins: "Logins",
  favorites: "Favoritos",
  reservationLogs: "ReservasLogs",
  historyLogs: "HistoricoLogs"
};

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    
    // Inicializa as abas caso não existam
    setupSheets();

    let response = { success: false };

    if (action === "getAll") {
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "saveConfig") {
      saveConfig(requestData.config);
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "saveItem") {
      saveItem(requestData.table, requestData.item);
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "deleteItem") {
      deleteItem(requestData.table, requestData.id);
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "toggleFavorite") {
      toggleFavorite(requestData.systemId, requestData.userId);
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "addLog") {
      addLog(requestData.log);
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "reserveLogin") {
      reserveLogin(requestData.loginId, requestData.username, requestData.timestamp);
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "releaseLogin") {
      releaseLogin(requestData.loginId, requestData.timestamp);
      response = { success: true, database: loadFullDatabase() };
    } else if (action === "importLogins") {
      importLogins(requestData.logins, requestData.logs);
      response = { success: true, database: loadFullDatabase() };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function loadFullDatabase() {
  const db = {};
  for (const [key, sheetName] of Object.entries(SHEET_NAME_MAP)) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      db[key] = key === "config" ? {} : [];
      continue;
    }
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      db[key] = key === "config" ? {} : [];
      continue;
    }
    
    const headers = values[0];
    const rows = values.slice(1);
    
    if (key === "config") {
      const configObj = {};
      rows.forEach(r => {
        if (r[0]) configObj[r[0]] = parseValue(r[1]);
      });
      db[key] = configObj;
    } else {
      db[key] = rows.map(row => {
        const item = {};
        headers.forEach((h, index) => {
          item[h] = parseValue(row[index]);
        });
        return item;
      });
    }
  }
  return db;
}

function parseValue(val) {
  if (typeof val === "string") {
    if (val.startsWith("[") || val.startsWith("{")) {
      try { return JSON.parse(val); } catch(e) {}
    }
    if (val === "true") return true;
    if (val === "false") return false;
  }
  return val;
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const sheetName of Object.values(SHEET_NAME_MAP)) {
    if (!ss.getSheetByName(sheetName)) {
      ss.insertSheet(sheetName);
    }
  }
}

function saveConfig(config) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_MAP.config);
  sheet.clear();
  sheet.appendRow(["Chave", "Valor"]);
  for (const [k, v] of Object.entries(config)) {
    sheet.appendRow([k, typeof v === "object" ? JSON.stringify(v) : v]);
  }
}

function saveItem(tableName, item) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_MAP[tableName]);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Se estiver vazia, cria cabeçalhos
  if (data.length === 1 && data[0][0] === "") {
    const cols = Object.keys(item);
    sheet.appendRow(cols);
    sheet.appendRow(cols.map(c => typeof item[c] === "object" ? JSON.stringify(item[c]) : item[c]));
    return;
  }

  const idColIndex = headers.indexOf("id");
  let foundRowIdx = -1;
  
  if (idColIndex > -1) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === item.id) {
        foundRowIdx = i + 1;
        break;
      }
    }
  }

  const rowValues = headers.map(h => {
    const val = item[h];
    return typeof val === "object" ? JSON.stringify(val) : (val !== undefined ? val : "");
  });

  if (foundRowIdx > -1) {
    sheet.getRange(foundRowIdx, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteItem(tableName, id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_MAP[tableName]);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idColIndex = headers.indexOf("id");
  
  if (idColIndex > -1) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }
}
`;

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download entire full-state as JSON backup file
  const handleDownloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `access_manager_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Restore state from JSON file
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.logins && parsed.covenants && parsed.systems && parsed.users) {
          onRestoreBackup(parsed);
          alert('Backup restaurado com sucesso para a planilha do sistema!');
        } else {
          alert('Estrutura de arquivo de backup inválida.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  const cardStyle = `p-6 rounded-xl border ${
    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-lg' : 'bg-white border-slate-100 text-slate-800 shadow-sm'
  }`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Configurações Gerais</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Personalize a identidade da empresa, defina preferências de segurança e integre ao Google Sheets.</p>
      </div>

      {isSaved && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center gap-2">
          <Check size={18} />
          <span className="text-xs font-semibold">Configurações gravadas com sucesso direto na planilha do sistema!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className={cardStyle}>
            <h3 className="font-display font-bold text-base mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-blue-500" />
              <span>Identidade Visual & Preferências</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">URL da Logomarca (PNG/SVG)</label>
                <input
                  type="url"
                  placeholder="Deixe em branco para ícone padrão"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Expiração da Sessão (Minutos)</label>
                <input
                  type="number"
                  required
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">Registros Padrão por Página</label>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span>Google Apps Script Web App URL</span>
                  <span className="text-emerald-500 text-[10px] lowercase font-bold flex items-center gap-0.5">
                    <Wifi size={10} /> sheets-live
                  </span>
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
                <p className="text-[10px] text-slate-400 mt-1">Conecte o sistema diretamente à sua planilha do Google Sheets. Veja os passos ao lado.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-md cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </form>

          {/* Backup Panel */}
          <div className={cardStyle}>
            <h3 className="font-display font-bold text-base mb-2 flex items-center gap-2">
              <Database size={18} className="text-amber-500" />
              <span>Backups & Salvaguarda de Dados</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">Exportar arquivo offline de segurança completo com todos os logins, convênios, reservas e históricos ou restaure backups.</p>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadBackup}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
              >
                <Download size={14} className="text-blue-500" />
                <span>Exportar Backup (JSON)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
              >
                <Upload size={14} className="text-emerald-500" />
                <span>Restaurar Backup</span>
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleRestoreBackup}
              />
            </div>
          </div>
        </div>

        {/* Integration Instructions Sidebar Column */}
        <div className="space-y-6">
          <div className={`${cardStyle} border-blue-500/20`}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="text-blue-500" size={18} />
              <h3 className="font-display font-bold text-base">Integração Google Sheets</h3>
            </div>
            
            <div className="text-xs space-y-3 text-slate-500 leading-relaxed">
              <p>Siga os passos rápidos para sincronizar este sistema à sua planilha oficial em tempo real:</p>
              
              <ol className="list-decimal pl-4 space-y-2">
                <li>Abra uma nova planilha no <strong>Google Sheets</strong>.</li>
                <li>No menu superior, vá em <strong>Extensões &gt; Apps Script</strong>.</li>
                <li>Apague o código existente e cole o código fornecido abaixo.</li>
                <li>Clique em <strong>Implantar &gt; Nova Implantação</strong>.</li>
                <li>Selecione tipo <strong>Aplicativo da Web</strong>, configure acesso para <strong>"Qualquer pessoa" (Anyone)</strong> e implante.</li>
                <li>Copie a URL gerada e cole no campo ao lado.</li>
              </ol>

              <div className="pt-2 border-t dark:border-slate-800">
                <button
                  onClick={copyCodeToClipboard}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <FileCode size={14} />}
                  <span>{copied ? 'Código Copiado!' : 'Copiar Código .GS'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
