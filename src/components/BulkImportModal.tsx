import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Layers, 
  HelpCircle, 
  KeyRound, 
  Landmark, 
  ExternalLink,
  Search,
  ArrowRight,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Covenant, CovenantCategory, Login, System, User } from '../types';
import { normalizeText } from '../lib/utils';
import { BRAZILIAN_STATES } from './OperationalView';

export interface ParsedImportRow {
  id: string;
  convenio: string;      // Coluna A
  estado: string;        // Coluna B
  tipo: string;          // Coluna C (Texto digitado)
  category: CovenantCategory; // Categoria normalizada
  login: string;         // Coluna D
  senha: string;         // Coluna E
  banco: string;         // Coluna F
  linkGestora: string;   // Coluna G
  isExistingCovenant: boolean;
  matchedCovenantId?: string;
  isValid: boolean;
  validationError?: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  covenants: Covenant[];
  logins: Login[];
  systems?: System[];
  currentUser: User | null;
  darkMode: boolean;
  onSaveCovenant: (covenant: Covenant) => Promise<void> | void;
  onSaveLogin: (login: Login) => Promise<void> | void;
  onLogAction?: (actionType: any, targetId: string, targetName: string) => void;
  onSuccess: (stats: { covenantsCreated: number; loginsCreated: number; totalProcessed: number }) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  covenants,
  logins,
  systems,
  currentUser,
  darkMode,
  onSaveCovenant,
  onSaveLogin,
  onLogAction,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [processStatusText, setProcessStatusText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Helper to infer sphere / category based on name and state
  const inferCategory = (convenio: string, uf: string): CovenantCategory => {
    const norm = normalizeText(convenio);
    const upperUf = (uf || '').toUpperCase().trim();

    if (
      norm.includes('siape') ||
      norm.includes('sougov') ||
      norm.includes('exercito') ||
      norm.includes('marinha') ||
      norm.includes('aeronautica') ||
      norm.includes('cpex') ||
      norm.includes('papem') ||
      norm.includes('dirap') ||
      norm.includes('forcas armadas') ||
      norm.includes('defesa') ||
      upperUf === 'DF' && (norm.includes('federal') || norm.includes('ministerio'))
    ) {
      if (norm.includes('exercito') || norm.includes('marinha') || norm.includes('aeronautica') || norm.includes('forcas')) {
        return 'Forças Armadas';
      }
      return 'Federal';
    }

    if (
      norm.includes('governo') ||
      norm.includes('estado de') ||
      norm.includes('gov.') ||
      norm.includes('seplag') ||
      norm.includes('proderj') ||
      norm.includes('prodesp') ||
      norm.includes('estadual')
    ) {
      return 'Governos';
    }

    if (
      norm.includes('prefeitura') ||
      norm.includes('pm') ||
      norm.includes('pref.') ||
      norm.includes('municipal') ||
      norm.includes('camara')
    ) {
      return 'Prefeituras';
    }

    return 'Prefeituras';
  };

  // Helper to parse Column C (TIPO) explicitly into CovenantCategory
  const parseCovenantType = (rawTipo: any, rawConvenio: string, rawUf: string): CovenantCategory => {
    const norm = normalizeText(String(rawTipo || ''));
    if (norm.includes('governo') || norm.includes('estadual') || norm.includes('estado') || norm === 'gov') {
      return 'Governos';
    }
    if (norm.includes('prefeitura') || norm.includes('municipal') || norm.includes('municipio') || norm === 'pref' || norm === 'pm') {
      return 'Prefeituras';
    }
    if (
      norm.includes('forca') || 
      norm.includes('exercito') || 
      norm.includes('marinha') || 
      norm.includes('aeronautica') || 
      norm.includes('militar') || 
      norm.includes('cpex') || 
      norm.includes('papem') || 
      norm.includes('dirap')
    ) {
      return 'Forças Armadas';
    }
    if (
      norm.includes('federal') || 
      norm.includes('siape') || 
      norm.includes('sougov') || 
      norm.includes('uniao') || 
      norm.includes('ministerio')
    ) {
      return 'Federal';
    }

    return inferCategory(rawConvenio, rawUf);
  };

  // Helper to normalize UF
  const normalizeUF = (rawUf: any): string => {
    if (!rawUf) return '';
    const clean = String(rawUf).trim().toUpperCase();
    if (clean.length === 2 && BRAZILIAN_STATES.some(s => s.uf === clean)) {
      return clean;
    }
    // Match by state name if written in full
    const foundState = BRAZILIAN_STATES.find(s => normalizeText(s.name) === normalizeText(clean) || s.uf === clean);
    return foundState ? foundState.uf : (clean.length <= 3 ? clean : '');
  };

  // Download Sample Excel Template (.xlsx) with exact 7 columns
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'CONVÊNIO': 'Prefeitura de São Paulo',
        'SIGLAS DO ESTADO': 'SP',
        'TIPO': 'PREFEITURAS',
        'LOGIN': 'pmsp.itau01',
        'SENHA': 'Senha#2026',
        'BANCO': 'Itaú',
        'LINK DA GESTORA': 'https://pmsp.consiglog.com.br'
      },
      {
        'CONVÊNIO': 'Governo do Estado da Bahia',
        'SIGLAS DO ESTADO': 'BA',
        'TIPO': 'GOVERNOS',
        'LOGIN': 'saeb.itau.op',
        'SENHA': 'BaGovPass@2026',
        'BANCO': 'Itaú',
        'LINK DA GESTORA': 'https://www.portaldoservidor.ba.gov.br'
      },
      {
        'CONVÊNIO': 'Governo do Estado do Rio de Janeiro',
        'SIGLAS DO ESTADO': 'RJ',
        'TIPO': 'GOVERNOS',
        'LOGIN': 'govrj.bb.operador',
        'SENHA': 'RjPass@2026',
        'BANCO': 'Banco do Brasil',
        'LINK DA GESTORA': 'https://proderj.rj.gov.br'
      },
      {
        'CONVÊNIO': 'SIAPE / SouGov (Servidores Federais)',
        'SIGLAS DO ESTADO': 'DF',
        'TIPO': 'FEDERAL',
        'LOGIN': 'siape.sant01',
        'SENHA': 'SantPass@2026',
        'BANCO': 'Santander',
        'LINK DA GESTORA': 'https://www.gov.br/sougov'
      },
      {
        'CONVÊNIO': 'Comando do Exército - CPEx',
        'SIGLAS DO ESTADO': 'DF',
        'TIPO': 'FORÇAS ARMADAS',
        'LOGIN': 'cpex.bb01',
        'SENHA': 'MilPass#2026',
        'BANCO': 'Banco do Brasil',
        'LINK DA GESTORA': 'https://www.cpex.eb.mil.br'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 38 }, // A: CONVÊNIO
      { wch: 18 }, // B: SIGLAS DO ESTADO
      { wch: 22 }, // C: TIPO
      { wch: 22 }, // D: LOGIN
      { wch: 20 }, // E: SENHA
      { wch: 22 }, // F: BANCO
      { wch: 40 }  // G: LINK DA GESTORA
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo Inclusão');
    XLSX.writeFile(workbook, 'Modelo_Inclusao_Em_Massa_Alcif.xlsx');
  };

  // Process File Data (.xlsx, .xls, .csv)
  const processFileData = (file: File) => {
    setParseError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('A planilha selecionada está vazia ou não contém abas.');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to 2D array of rows
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawRows || rawRows.length === 0) {
          throw new Error('Nenhum dado encontrado na planilha.');
        }

        // Determine if first row is a header
        let startIndex = 0;
        const firstRow = rawRows[0] || [];
        const firstRowStr = firstRow.map(c => String(c).toLowerCase().trim()).join(' ');

        if (
          firstRowStr.includes('convenio') ||
          firstRowStr.includes('convênio') ||
          firstRowStr.includes('estado') ||
          firstRowStr.includes('sigla') ||
          firstRowStr.includes('tipo') ||
          firstRowStr.includes('categoria') ||
          firstRowStr.includes('esfera') ||
          firstRowStr.includes('uf') ||
          firstRowStr.includes('login') ||
          firstRowStr.includes('usuario') ||
          firstRowStr.includes('senha') ||
          firstRowStr.includes('banco') ||
          firstRowStr.includes('gestora')
        ) {
          startIndex = 1;
        }

        const rowsToParse = rawRows.slice(startIndex);
        const resultList: ParsedImportRow[] = [];

        rowsToParse.forEach((r, idx) => {
          // Columns Mapping:
          // A (0) = CONVÊNIO
          // B (1) = SIGLAS DO ESTADO
          // C (2) = TIPO (GOVERNOS, PREFEITURAS, FEDERAL OU FORÇAS ARMADAS)
          // D (3) = LOGIN
          // E (4) = SENHA
          // F (5) = BANCO
          // G (6) = LINK DA GESTORA
          const colA = String(r[0] || '').trim();
          const colB = normalizeUF(r[1]);
          const colC = String(r[2] || '').trim();
          const colD = String(r[3] || '').trim();
          const colE = String(r[4] || '').trim();
          const colF = String(r[5] || '').trim();
          const colG = String(r[6] || '').trim();

          // Skip empty rows
          if (!colA && !colB && !colC && !colD && !colE && !colF && !colG) {
            return;
          }

          let isValid = true;
          let validationError = '';

          if (!colA) {
            isValid = false;
            validationError = 'Nome do convênio obrigatório (Coluna A).';
          } else if (!colD) {
            isValid = false;
            validationError = 'Login/Usuário obrigatório (Coluna D).';
          }

          // Check if covenant already exists
          const normName = normalizeText(colA);
          const matchedCovenant = covenants.find(c => {
            const matchName = normalizeText(c.name) === normName;
            const matchState = !colB || !c.state || c.state.toUpperCase() === colB.toUpperCase();
            return matchName && matchState;
          });

          const finalCategory = parseCovenantType(colC, colA, colB);

          resultList.push({
            id: `row-${idx + 1}-${Date.now()}`,
            convenio: colA || 'Convênio Não Informado',
            estado: colB || 'BR',
            tipo: colC || finalCategory,
            category: finalCategory,
            login: colD || '',
            senha: colE || '',
            banco: colF || 'Geral',
            linkGestora: colG || '',
            isExistingCovenant: !!matchedCovenant,
            matchedCovenantId: matchedCovenant?.id,
            isValid,
            validationError: isValid ? undefined : validationError
          });
        });

        if (resultList.length === 0) {
          throw new Error('Nenhuma linha válida foi identificada para importação.');
        }

        setParsedRows(resultList);
      } catch (err: any) {
        console.error('Erro ao ler arquivo Excel:', err);
        setParseError(err.message || 'Erro ao processar o arquivo Excel.');
        setParsedRows([]);
      }
    };

    reader.onerror = () => {
      setParseError('Falha na leitura do arquivo.');
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileData(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileData(e.dataTransfer.files[0]);
    }
  };

  // Remove single row from preview
  const handleRemoveRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  // Filtered rows in preview
  const filteredRows = parsedRows.filter(row => {
    if (!searchFilter) return true;
    const s = normalizeText(searchFilter);
    return (
      normalizeText(row.convenio).includes(s) ||
      normalizeText(row.estado).includes(s) ||
      normalizeText(row.tipo).includes(s) ||
      normalizeText(row.category).includes(s) ||
      normalizeText(row.login).includes(s) ||
      normalizeText(row.banco).includes(s) ||
      normalizeText(row.linkGestora).includes(s)
    );
  });

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;
  const newCovenantsCount = new Set(
    parsedRows.filter(r => r.isValid && !r.isExistingCovenant).map(r => normalizeText(r.convenio) + r.estado)
  ).size;

  // Execute Bulk Import
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('Nenhuma linha válida para importar.');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);
    setProcessStatusText('Iniciando importação...');

    try {
      let createdCovenantsCount = 0;
      let createdLoginsCount = 0;
      const total = validRows.length;

      // Local map of covenants by normalized name to prevent duplicates within the same import file
      const localCovenantMap = new Map<string, string>();
      covenants.forEach(c => {
        localCovenantMap.set(normalizeText(c.name) + (c.state || '').toUpperCase(), c.id);
      });

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const covenantKey = normalizeText(row.convenio) + (row.estado || '').toUpperCase();
        let targetCovenantId = localCovenantMap.get(covenantKey);

        setProcessStatusText(`Processando ${i + 1} de ${total}: ${row.convenio} (${row.banco})...`);

        // 1. If Covenant doesn't exist yet, create it
        if (!targetCovenantId) {
          targetCovenantId = `cov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const newCovenant: Covenant = {
            id: targetCovenantId,
            name: row.convenio,
            category: row.category,
            state: row.estado || 'BR',
            managerUrl: row.linkGestora || '',
            observations: 'Importado em massa via planilha Excel',
            status: 'Ativo',
            bank: row.banco,
            login: row.login,
            password: row.senha
          };

          await onSaveCovenant(newCovenant);
          localCovenantMap.set(covenantKey, targetCovenantId);
          createdCovenantsCount++;
        } else {
          // If existing covenant doesn't have managerUrl and this row has one, optionally update
          const existingCov = covenants.find(c => c.id === targetCovenantId);
          if (existingCov && !existingCov.managerUrl && row.linkGestora) {
            await onSaveCovenant({
              ...existingCov,
              managerUrl: row.linkGestora
            });
          }
        }

        // 2. Check if login already exists for this covenant and bank/user
        const existingLogin = logins.find(l => 
          l.covenantId === targetCovenantId && 
          normalizeText(l.bank) === normalizeText(row.banco) && 
          normalizeText(l.username) === normalizeText(row.login)
        );

        if (existingLogin && !replaceExisting) {
          // Skip login creation if user chose not to replace
        } else {
          const nowIso = new Date().toISOString();
          const existingIds = existingLogin ? (existingLogin.covenantIds || [existingLogin.covenantId]).filter(Boolean) : [];
          const mergedCovIds = Array.from(new Set([...existingIds, targetCovenantId]));

          const loginPayload: Login = {
            id: existingLogin ? existingLogin.id : `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            covenantId: targetCovenantId,
            covenantIds: mergedCovIds,
            systemId: systems?.[0]?.id || 'sys-1',
            url: row.linkGestora || '',
            bank: row.banco || 'Geral',
            shop: 'Importação em Massa',
            username: row.login,
            password: row.senha || '',
            cpf: existingLogin?.cpf || '',
            pin: existingLogin?.pin || '',
            token: existingLogin?.token || '',
            email: existingLogin?.email || '',
            phone: existingLogin?.phone || '',
            responsible: currentUser?.name || 'Importação Excel',
            observations: 'Importado em massa via planilha Excel',
            creationDate: existingLogin ? existingLogin.creationDate : nowIso,
            lastAlteration: nowIso,
            expirationDate: '',
            status: 'Ativo',
            reservedBy: existingLogin?.reservedBy || '',
            reservedAt: existingLogin?.reservedAt || ''
          };

          await onSaveLogin(loginPayload);
          createdLoginsCount++;
        }

        // Update progress
        setProgressPercent(Math.round(((i + 1) / total) * 100));
      }

      // Log to history
      if (onLogAction) {
        onLogAction('Criar', 'bulk-import', `Importação em massa de ${validRows.length} registros`);
      }

      onSuccess({
        covenantsCreated: createdCovenantsCount,
        loginsCreated: createdLoginsCount,
        totalProcessed: validRows.length
      });

      onClose();
    } catch (err: any) {
      console.error('Erro na importação em massa:', err);
      alert(err.message || 'Erro durante a importação em massa.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/65 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto transition-all ${
        darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Modal Header */}
        <div className={`p-5 border-b flex items-center justify-between gap-4 shrink-0 ${
          darkMode ? 'bg-slate-850/80 border-slate-800' : 'bg-slate-50/90 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg leading-tight">
                  Inclusão de Acessos em Massa (Excel)
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase border border-emerald-500/20">
                  Importador .xlsx
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Importe convênios, estados, logins, senhas, bancos e links gestores diretamente de uma planilha.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                darkMode 
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200' 
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
              title="Baixar planilha modelo com as 7 colunas formatadas (A até G)"
            >
              <Download size={14} className="text-emerald-500" />
              <span className="hidden sm:inline">Baixar Modelo (.xlsx)</span>
              <span className="sm:hidden">Modelo</span>
            </button>

            <button
              disabled={isProcessing}
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Column Structure Information Card */}
          <div className={`p-4 rounded-xl border space-y-2.5 ${
            darkMode ? 'bg-slate-850/50 border-slate-800 text-slate-300' : 'bg-blue-50/50 border-blue-100 text-slate-700'
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
              <Info size={16} />
              <span>Formatação Exata das Colunas da Planilha (A até G):</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
              <div className={`p-2 rounded-lg border text-center ${
                darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-blue-200/80 shadow-2xs'
              }`}>
                <span className="text-[10px] font-black text-blue-600 block uppercase">Coluna A</span>
                <strong className="text-slate-900 dark:text-white text-xs">CONVÊNIO</strong>
                <span className="text-[10px] text-slate-400 block truncate">Nome do órgão</span>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-blue-200/80 shadow-2xs'
              }`}>
                <span className="text-[10px] font-black text-blue-600 block uppercase">Coluna B</span>
                <strong className="text-slate-900 dark:text-white text-xs">SIGLAS ESTADO</strong>
                <span className="text-[10px] text-slate-400 block truncate">UF (SP, RJ, MG...)</span>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-blue-200/80 shadow-2xs'
              }`}>
                <span className="text-[10px] font-black text-blue-600 block uppercase">Coluna C</span>
                <strong className="text-slate-900 dark:text-white text-xs">TIPO</strong>
                <span className="text-[10px] text-slate-400 block truncate">Gov, Pref, Fed, FA</span>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-blue-200/80 shadow-2xs'
              }`}>
                <span className="text-[10px] font-black text-blue-600 block uppercase">Coluna D</span>
                <strong className="text-slate-900 dark:text-white text-xs">LOGIN</strong>
                <span className="text-[10px] text-slate-400 block truncate">Usuário do acesso</span>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-blue-200/80 shadow-2xs'
              }`}>
                <span className="text-[10px] font-black text-blue-600 block uppercase">Coluna E</span>
                <strong className="text-slate-900 dark:text-white text-xs">SENHA</strong>
                <span className="text-[10px] text-slate-400 block truncate">Senha de acesso</span>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-blue-200/80 shadow-2xs'
              }`}>
                <span className="text-[10px] font-black text-blue-600 block uppercase">Coluna F</span>
                <strong className="text-slate-900 dark:text-white text-xs">BANCO</strong>
                <span className="text-[10px] text-slate-400 block truncate">Itaú, BB, etc.</span>
              </div>

              <div className={`p-2 rounded-lg border text-center ${
                darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-blue-200/80 shadow-2xs'
              }`}>
                <span className="text-[10px] font-black text-blue-600 block uppercase">Coluna G</span>
                <strong className="text-slate-900 dark:text-white text-xs">LINK GESTORA</strong>
                <span className="text-[10px] text-slate-400 block truncate">URL do portal</span>
              </div>
            </div>
          </div>

          {/* Upload Drop Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                : darkMode
                  ? 'border-slate-750 bg-slate-850/40 hover:border-slate-600 hover:bg-slate-850/70'
                  : 'border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Upload size={28} />
            </div>

            <div className="space-y-1">
              <p className="font-bold text-sm text-slate-900 dark:text-white">
                {fileName ? `Arquivo selecionado: ${fileName}` : 'Clique para selecionar ou arraste sua planilha Excel aqui'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formatos aceitos: <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong>
              </p>
            </div>

            {fileName && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                <Check size={14} /> Planilha carregada com sucesso
              </span>
            )}
          </div>

          {/* Parse Error Alert */}
          {parseError && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
              <AlertTriangle size={20} className="shrink-0" />
              <div>
                <strong className="block font-bold">Erro ao processar planilha:</strong>
                <span>{parseError}</span>
              </div>
            </div>
          )}

          {/* Parsed Preview Table & Statistics */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              
              {/* Summary Stats & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-2.5 py-1 rounded-lg border font-bold ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    Total: <strong>{parsedRows.length}</strong> linhas
                  </span>

                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                    Válidos: <strong>{validCount}</strong>
                  </span>

                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
                    Novos Convênios: <strong>{newCovenantsCount}</strong>
                  </span>

                  {invalidCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold">
                      Inválidos: <strong>{invalidCount}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold cursor-pointer"
                  >
                    {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{showPasswords ? 'Ocultar Senhas' : 'Exibir Senhas'}</span>
                  </button>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Atualizar se já existir
                    </span>
                  </label>
                </div>
              </div>

              {/* Search Inside Preview */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar dados da pré-visualização por convênio, UF, login ou banco..."
                  className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-hidden transition-all ${
                    darkMode 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                      : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 shadow-2xs'
                  }`}
                />
              </div>

              {/* Data Table */}
              <div className={`rounded-xl border overflow-hidden max-h-72 overflow-y-auto ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider ${
                    darkMode ? 'bg-slate-850 text-slate-400 border-b border-slate-800' : 'bg-slate-50 text-slate-600 border-b border-slate-200'
                  }`}>
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Convênio (Col A)</th>
                      <th className="py-2.5 px-2">UF (Col B)</th>
                      <th className="py-2.5 px-3">Tipo (Col C)</th>
                      <th className="py-2.5 px-3">Login (Col D)</th>
                      <th className="py-2.5 px-3">Senha (Col E)</th>
                      <th className="py-2.5 px-3">Banco (Col F)</th>
                      <th className="py-2.5 px-3">Link Gestora (Col G)</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 px-2 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {filteredRows.map((row, idx) => (
                      <tr 
                        key={row.id}
                        className={`transition-colors ${
                          !row.isValid
                            ? 'bg-rose-500/5 hover:bg-rose-500/10'
                            : darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                          {idx + 1}
                        </td>
                        
                        {/* Convênio (Col A) */}
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white max-w-[180px] truncate">
                          <span>{row.convenio}</span>
                          {row.isExistingCovenant && (
                            <span className="block text-[10px] text-blue-500 font-medium">
                              (Convênio já cadastrado)
                            </span>
                          )}
                        </td>

                        {/* UF (Col B) */}
                        <td className="py-2 px-2">
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[11px]">
                            {row.estado || 'BR'}
                          </span>
                        </td>

                        {/* Tipo (Col C) */}
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-block ${
                            row.category === 'Governos'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : row.category === 'Prefeituras'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : row.category === 'Federal'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          }`}>
                            {row.tipo || row.category}
                          </span>
                        </td>

                        {/* Login (Col D) */}
                        <td className="py-2 px-3 font-mono text-slate-800 dark:text-slate-200 font-medium">
                          {row.login || <span className="text-rose-500 italic">Vazio</span>}
                        </td>

                        {/* Senha (Col E) */}
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {showPasswords ? (
                            row.senha || <span className="text-slate-400 italic">Sem senha</span>
                          ) : (
                            '••••••••'
                          )}
                        </td>

                        {/* Banco (Col F) */}
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {row.banco || 'Geral'}
                        </td>

                        {/* Link Gestora (Col G) */}
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-[150px] truncate font-mono text-[11px]">
                          {row.linkGestora ? (
                            <span className="truncate block" title={row.linkGestora}>{row.linkGestora}</span>
                          ) : (
                            <span className="text-slate-400 italic">Nenhum</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-2">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              Pronto
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold" title={row.validationError}>
                              Inválido
                            </span>
                          )}
                        </td>

                        {/* Delete single row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                            title="Remover linha da importação"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>{processStatusText}</span>
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-blue-200 dark:bg-blue-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsedRows.length > 0 ? (
              <span><strong>{validCount}</strong> registros prontos para gravar no sistema.</span>
            ) : (
              <span>Selecione uma planilha para visualizar a prévia antes de gravar.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isProcessing}
              onClick={onClose}
              className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50 ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-600'
              }`}
            >
              Cancelar
            </button>

            <button
              disabled={isProcessing || validCount === 0}
              onClick={handleExecuteImport}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Gravando Dados...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Confirmar e Importar ({validCount} Itens)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
