import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  X, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Covenant, System, Login, User } from '../types';

interface ImportProps {
  covenants: Covenant[];
  systems: System[];
  currentUser: User | null;
  darkMode: boolean;
  onImportLogins: (newLogins: Login[]) => void;
}

export default function Import({
  covenants,
  systems,
  currentUser,
  darkMode,
  onImportLogins
}: ImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // Mappings state
  const [mappings, setMappings] = useState<{ [field: string]: string }>({
    covenant: '',
    system: '',
    bank: '',
    username: '',
    password: '',
    cpf: '',
    shop: '',
    observations: ''
  });

  // Mappable system fields
  const fields = [
    { key: 'covenant', label: 'Convênio' },
    { key: 'system', label: 'Sistema' },
    { key: 'bank', label: 'Banco' },
    { key: 'username', label: 'Usuário / ID' },
    { key: 'password', label: 'Senha' },
    { key: 'cpf', label: 'CPF' },
    { key: 'shop', label: 'Loja / Filial' },
    { key: 'observations', label: 'Observações' }
  ];

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to array of objects
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });
        
        if (rawJson.length > 0) {
          // Extract headers
          const firstRow = rawJson[0];
          const sheetHeaders = Object.keys(firstRow);
          setHeaders(sheetHeaders);
          setFileData(rawJson);

          // Try to auto-map headers based on simple similarity
          const initialMappings: { [field: string]: string } = {};
          fields.forEach(f => {
            const labelLower = f.label.toLowerCase();
            const keyLower = f.key.toLowerCase();
            const matchedHeader = sheetHeaders.find(h => {
              const hLower = h.toLowerCase();
              return hLower.includes(labelLower) || 
                     hLower.includes(keyLower) || 
                     (f.key === 'username' && (hLower.includes('usuario') || hLower.includes('user') || hLower.includes('login'))) ||
                     (f.key === 'covenant' && hLower.includes('convenio')) ||
                     (f.key === 'password' && (hLower.includes('senha') || hLower.includes('pass') || hLower.includes('credencial')));
            });
            initialMappings[f.key] = matchedHeader || '';
          });
          setMappings(initialMappings);
        } else {
          alert('A planilha está vazia!');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao ler o arquivo Excel. Certifique-se de que é um formato válido (.xlsx, .xls ou .csv)');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Preview data based on current column mappings
  const previewData = useMemo(() => {
    if (!fileData) return [];
    return fileData.slice(0, 5).map(row => {
      const previewRow: any = {};
      fields.forEach(f => {
        const mappedHeader = mappings[f.key];
        previewRow[f.key] = mappedHeader ? row[mappedHeader] : '';
      });
      return previewRow;
    });
  }, [fileData, mappings]);

  const handleExecuteImport = () => {
    if (!fileData) return;

    // Check mandatory fields: username must be mapped
    if (!mappings.username) {
      alert('Por favor, mapeie pelo menos a coluna do "Usuário / ID" para realizar a importação!');
      return;
    }

    const defaultCovenantId = covenants[0]?.id || '';
    const defaultSystemId = systems[0]?.id || '';

    const finalLogins: Login[] = fileData.map((row, idx) => {
      // Find or create covenant linkage
      const rawCovValue = mappings.covenant ? String(row[mappings.covenant]).trim() : '';
      const matchedCov = covenants.find(c => c.name.toLowerCase() === rawCovValue.toLowerCase());
      const covenantId = matchedCov ? matchedCov.id : defaultCovenantId;

      // Find or create system linkage
      const rawSysValue = mappings.system ? String(row[mappings.system]).trim() : '';
      const matchedSys = systems.find(s => s.name.toLowerCase() === rawSysValue.toLowerCase());
      const systemId = matchedSys ? matchedSys.id : defaultSystemId;

      // Find bank
      const bank = mappings.bank ? String(row[mappings.bank]).trim() : 'Geral';
      const shop = mappings.shop ? String(row[mappings.shop]).trim() : 'Sede Importados';

      return {
        id: `log-import-${Date.now()}-${idx}`,
        covenantId,
        systemId,
        bank: bank || 'Geral',
        shop,
        username: String(row[mappings.username]).trim() || `user_${idx}`,
        password: mappings.password ? String(row[mappings.password]).trim() : '123456',
        cpf: mappings.cpf ? String(row[mappings.cpf]).trim() : '',
        pin: '',
        token: '',
        email: '',
        phone: '',
        responsible: currentUser?.name || 'Importador',
        observations: mappings.observations ? String(row[mappings.observations]).trim() : 'Importado via planilha Excel.',
        creationDate: new Date().toISOString(),
        lastAlteration: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Ativo'
      };
    });

    onImportLogins(finalLogins);
    setFileData(null);
    setFileName('');
    setImportSuccess(true);
  };

  const containerStyle = `p-8 border-2 border-dashed rounded-2xl text-center transition-colors cursor-pointer ${
    isDragOver 
      ? 'border-blue-500 bg-blue-50/10' 
      : darkMode 
        ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/60' 
        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
  }`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Importação de Planilhas Excel</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Suba planilhas xls, xlsx ou csv de logins. Faça o de-para de colunas automaticamente e revise tudo na tela.</p>
      </div>

      {importSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-3">
          <CheckCircle2 size={20} className="shrink-0" />
          <div className="text-xs font-semibold">
            <p>Logins importados com sucesso direto para a planilha do Google Sheets!</p>
            <p className="text-emerald-500/80 mt-0.5 font-medium">Todas as credenciais já estão disponíveis em tempo real na aba de Logins.</p>
          </div>
        </div>
      )}

      {!fileData ? (
        /* Upload Area */
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={containerStyle}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          <div className="bg-blue-500/10 text-blue-500 p-4 rounded-full w-max mx-auto mb-4">
            <Upload size={32} />
          </div>
          <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">Arraste seu arquivo Excel aqui</h3>
          <p className="text-xs text-slate-400 mt-1">Suporta planilhas Excel nos formatos .xlsx, .xls ou arquivos .csv</p>
          <button 
            type="button"
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer inline-block"
          >
            Selecionar Arquivo
          </button>
        </div>
      ) : (
        /* Mapping Workspace */
        <div className="space-y-6">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={24} className="text-emerald-500" />
              <div>
                <h4 className="font-bold text-sm truncate max-w-[250px]">{fileName}</h4>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">{fileData.length} registros identificados</p>
              </div>
            </div>
            
            <button 
              onClick={() => { setFileData(null); setFileName(''); }}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer"
              title="Cancelar Importação"
            >
              <X size={16} />
            </button>
          </div>

          {/* MAPPING BOX */}
          <div className={`p-5 rounded-xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-100 text-slate-700 shadow-sm'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-amber-500 shrink-0" size={16} />
              <h3 className="font-display font-bold text-sm">Mapeamento Inteligente de Colunas (De-Para)</h3>
            </div>
            
            <p className="text-xs text-slate-400 mb-5">
              Nossa IA mapeou as colunas da sua planilha para os campos do sistema. Revise abaixo se os campos estão corretos:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(f => {
                return (
                  <div key={f.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{f.label} {f.key === 'username' && <span className="text-red-500">*</span>}</span>
                    
                    <select
                      value={mappings[f.key]}
                      onChange={(e) => setMappings({ ...mappings, [f.key]: e.target.value })}
                      className={`py-1 px-2 border text-xs rounded-md sm:max-w-[200px] ${
                        darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <option value="">-- Não importar / Padrão --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PREVIEW BOX */}
          <div className={`p-5 rounded-xl border space-y-3 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-100 text-slate-700 shadow-sm'
          }`}>
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <Info size={16} className="text-blue-500" />
              <span>Prévia dos dados (Primeiros 5 registros)</span>
            </h3>

            <div className="overflow-x-auto rounded-lg border dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 uppercase text-[9px] font-bold text-slate-400">
                    {fields.map(f => <th key={f.key} className="py-2 px-3">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {fields.map(f => (
                        <td key={f.key} className="py-2 px-3 font-medium text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
                          {row[f.key] ? String(row[f.key]) : <span className="text-slate-400 italic">padrão</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                <span>Nomes de Convênios/Sistemas que não existirem serão associados aos registros padrão.</span>
              </span>

              <button
                onClick={handleExecuteImport}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-md flex items-center gap-2 cursor-pointer self-end"
              >
                <span>Confirmar e Importar {fileData.length} registros</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
