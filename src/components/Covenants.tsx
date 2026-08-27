import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  FileSpreadsheet, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  EyeOff,
  Settings,
  ExternalLink,
  Copy,
  Check,
  Building,
  Key
} from 'lucide-react';
import { Covenant, CovenantCategory, User, Login } from '../types';
import { normalizeText, matchesSearch, isLoginAssociatedWithCovenant } from '../lib/utils';
import * as XLSX from 'xlsx';

interface CovenantsProps {
  covenants: Covenant[];
  logins?: Login[];
  currentUser: User | null;
  darkMode: boolean;
  onSave: (covenant: Covenant) => void;
  onSaveLogin?: (login: Login) => void;
  onDelete: (id: string) => void;
}

interface EditableBankLogin {
  id?: string;
  bank: string;
  username: string;
  password: string;
}

export default function Covenants({
  covenants,
  logins = [],
  currentUser,
  darkMode,
  onSave,
  onSaveLogin,
  onDelete
}: CovenantsProps) {
  const isAdmin = currentUser?.role === 'Administrador';

  const canEdit = isAdmin;
  const canDelete = isAdmin;

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedState, setSelectedState] = useState<string>('Todos');
  
  // Deleting Covenant Modal state
  const [covenantToDelete, setCovenantToDelete] = useState<Covenant | null>(null);

  // Bank Choice Copy Modal State
  const [bankCopyModalCovenant, setBankCopyModalCovenant] = useState<Covenant | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  // Sorting
  const [sortField, setSortField] = useState<keyof Covenant>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    category: true,
    state: true,
    login: true,
    password: true,
    managerUrl: true,
    status: true,
    observations: true
  });
  const [showColManager, setShowColManager] = useState(false);

  // Multiple logins choice state & password visibility map
  const [selectedLoginIndexMap, setSelectedLoginIndexMap] = useState<Record<string, number>>({});
  const [visiblePasswordsMap, setVisiblePasswordsMap] = useState<Record<string, boolean>>({});

  // Helper to compile logins for a covenant
  const getCovenantLogins = (cov: Covenant) => {
    const matching = logins.filter(l => isLoginAssociatedWithCovenant(l, cov.id));
    if (cov.login) {
      const exists = matching.some(m => m.username?.toLowerCase() === cov.login?.toLowerCase());
      if (!exists) {
        matching.unshift({
          id: `direct-${cov.id}`,
          covenantId: cov.id,
          systemId: '',
          shop: '',
          username: cov.login,
          password: cov.password || '',
          bank: cov.bank || 'Banco Principal',
          cpf: '', pin: '', token: '', email: '', phone: '', responsible: '', observations: '',
          creationDate: '', lastAlteration: '', expirationDate: '', status: 'Ativo', reservedBy: '', reservedAt: ''
        });
      }
    }
    return matching;
  };

  // Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCovenant, setEditingCovenant] = useState<Partial<Covenant> | null>(null);
  const [modalBankLogins, setModalBankLogins] = useState<EditableBankLogin[]>([]);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Categories list
  const categories: CovenantCategory[] = ['Federal', 'Estadual', 'Municipal', 'Militar', 'INSS', 'Benefício'];
  
  // States available for filter
  const states = useMemo(() => {
    const s = new Set(covenants.map(c => c.state).filter(Boolean));
    return ['Todos', ...Array.from(s)];
  }, [covenants]);

  // Handle Copy
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Trigger Modal for selecting bank to copy
  const handleTriggerCopyBankModal = (cov: Covenant) => {
    setBankCopyModalCovenant(cov);
    setCopyFeedback(null);
  };

  // Handle Sort
  const handleSort = (field: keyof Covenant) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter & Search Logic
  const filteredCovenants = useMemo(() => {
    const term = normalizeText(searchTerm);
    return covenants.filter(cov => {
      const covLogins = getCovenantLogins(cov);
      const loginsSearchMatch = covLogins.some(l => 
        matchesSearch(l.username, term) ||
        matchesSearch(l.bank, term)
      );

      const matchSearch = !term || (
        matchesSearch(cov.name, term) ||
        matchesSearch(cov.state, term) ||
        matchesSearch(cov.city, term) ||
        matchesSearch(cov.login, term) ||
        matchesSearch(cov.bank, term) ||
        matchesSearch(cov.managerUrl, term) ||
        matchesSearch(cov.manager, term) ||
        matchesSearch(cov.observations, term) ||
        matchesSearch(cov.category, term) ||
        loginsSearchMatch
      );

      const matchCategory = selectedCategory === 'Todos' || cov.category === selectedCategory;
      const matchStatus = selectedStatus === 'Todos' || cov.status === selectedStatus;
      const matchState = selectedState === 'Todos' || cov.state === selectedState;

      return matchSearch && matchCategory && matchStatus && matchState;
    });
  }, [covenants, logins, searchTerm, selectedCategory, selectedStatus, selectedState]);

  // Sorted Covenants
  const sortedCovenants = useMemo(() => {
    return [...filteredCovenants].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredCovenants, sortField, sortDirection]);

  // Paginated
  const paginatedCovenants = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedCovenants.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedCovenants, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedCovenants.length / rowsPerPage) || 1;

  // Modal Handlers
  const openNewModal = () => {
    const newCov: Partial<Covenant> = {
      id: `cov-${Date.now()}`,
      name: '',
      category: 'Federal',
      state: '',
      login: '',
      password: '',
      bank: '',
      managerUrl: '',
      observations: '',
      status: 'Ativo'
    };
    setEditingCovenant(newCov);
    setModalBankLogins([
      { bank: 'Banco do Brasil', username: '', password: '' }
    ]);
    setShowModalPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (covenant: Covenant) => {
    setEditingCovenant({ ...covenant });
    const existingLogins = getCovenantLogins(covenant);
    if (existingLogins.length > 0) {
      setModalBankLogins(existingLogins.map(l => ({
        id: l.id,
        bank: l.bank || covenant.bank || 'Outros',
        username: l.username || covenant.login || '',
        password: l.password || covenant.password || ''
      })));
    } else {
      setModalBankLogins([
        { bank: covenant.bank || 'Banco do Brasil', username: covenant.login || '', password: covenant.password || '' }
      ]);
    }
    setShowModalPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCovenant && editingCovenant.name && editingCovenant.category) {
      const primary = modalBankLogins[0] || { bank: '', username: '', password: '' };
      const covToSave: Covenant = {
        ...(editingCovenant as Covenant),
        login: primary.username || editingCovenant.login || '',
        password: primary.password || editingCovenant.password || '',
        bank: primary.bank || editingCovenant.bank || ''
      };

      onSave(covToSave);

      // Save each bank login entry if onSaveLogin handler exists
      if (onSaveLogin && modalBankLogins.length > 0) {
        modalBankLogins.forEach((bl, idx) => {
          if (bl.username || bl.password || bl.bank) {
            onSaveLogin({
              id: bl.id || `log-${Date.now()}-${idx}`,
              covenantId: covToSave.id,
              systemId: 'sys-1',
              bank: bl.bank || 'Outros',
              shop: 'Cadastrado no Convênio',
              username: bl.username || '',
              password: bl.password || '',
              cpf: '', pin: '', token: '', email: '', phone: '',
              responsible: currentUser?.name || 'Administrador',
              observations: `Acesso do ${bl.bank || 'Banco'} para o convênio ${covToSave.name}`,
              creationDate: new Date().toISOString(),
              lastAlteration: new Date().toISOString(),
              expirationDate: '',
              status: 'Ativo'
            });
          }
        });
      }

      setIsModalOpen(false);
      setEditingCovenant(null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = sortedCovenants.map(c => {
      const covLogins = getCovenantLogins(c);
      const loginsSummary = covLogins.map(l => `${l.bank}: ${l.username}`).join(' | ');
      return {
        'Nome do Convênio': c.name,
        'Categoria': c.category,
        'Estado': c.state,
        'Logins/Bancos': loginsSummary || c.login || '',
        'Link da Gestora': c.managerUrl || c.manager || '',
        'Status': c.status,
        'Observações': c.observations
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Convênios");
    XLSX.writeFile(wb, `convenios_export_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Convênios</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Cadastre e gerencie os convênios e usuários vinculados por banco.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className={`flex items-center gap-2 px-3.5 py-2 border rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
              darkMode 
                ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' 
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
            }`}
          >
            <FileSpreadsheet size={16} className="text-emerald-500" />
            <span>Exportar XLS</span>
          </button>
          
          {canEdit && (
            <button
              onClick={openNewModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Novo Convênio</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-xl border ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
      } grid grid-cols-1 md:grid-cols-4 gap-4 items-center`}>
        
        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar convênio, usuário, banco..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full pl-9 pr-4 py-2 border text-sm rounded-lg transition-colors focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
              darkMode 
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full py-2 px-3 border text-sm rounded-lg ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Todas Categorias</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* State Filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full py-2 px-3 border text-sm rounded-lg ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Todos Estados</option>
            {states.filter(s => s !== 'Todos').map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full py-2 px-3 border text-sm rounded-lg ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Todos Status</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>
      </div>

      {/* Adjust Columns and Results Summary */}
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <div>
          Mostrando <strong className="text-slate-700 dark:text-slate-300">{paginatedCovenants.length}</strong> de <strong className="text-slate-700 dark:text-slate-300">{sortedCovenants.length}</strong> convênios filtrados
        </div>
        
        {/* Columns adjust dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowColManager(!showColManager)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md font-semibold cursor-pointer ${
              darkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            id="col-manager-toggle"
          >
            <Settings size={12} />
            <span>Colunas</span>
          </button>
          
          {showColManager && (
            <div className={`absolute right-0 mt-1.5 w-48 p-3 rounded-lg border shadow-lg z-20 space-y-2 ${
              darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-100 text-slate-700'
            }`}>
              <p className="font-bold border-b pb-1 mb-1.5 text-[11px] uppercase tracking-wider text-slate-400">Exibir Colunas</p>
              {Object.keys(visibleColumns).map(col => (
                <label key={col} className="flex items-center gap-2 cursor-pointer hover:text-blue-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={(visibleColumns as any)[col]}
                    onChange={() => setVisibleColumns({
                      ...visibleColumns,
                      [col]: !(visibleColumns as any)[col]
                    })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="capitalize text-xs">{
                    col === 'name' ? 'Nome do Convênio' :
                    col === 'category' ? 'Categoria' :
                    col === 'state' ? 'Estado' :
                    col === 'login' ? 'Login / Banco' :
                    col === 'password' ? 'Senha' :
                    col === 'managerUrl' ? 'Link da Gestora' :
                    col === 'status' ? 'Status' :
                    col === 'observations' ? 'Observações' : col
                  }</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className={`overflow-x-auto rounded-xl border ${
        darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-white'
      }`}>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className={`border-b text-xs uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider ${
              darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/80 border-slate-100'
            }`}>
              {visibleColumns.name && (
                <th onClick={() => handleSort('name')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Nome do Convênio</span>
                    {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.category && (
                <th onClick={() => handleSort('category')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Categoria</span>
                    {sortField === 'category' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.state && (
                <th onClick={() => handleSort('state')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Estado</span>
                    {sortField === 'state' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.login && (
                <th className="py-3 px-4">Login / Banco</th>
              )}
              {visibleColumns.password && (
                <th className="py-3 px-4">Senha</th>
              )}
              {visibleColumns.managerUrl && (
                <th className="py-3 px-4">Link da Gestora</th>
              )}
              {visibleColumns.status && (
                <th onClick={() => handleSort('status')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.observations && (
                <th className="py-3 px-4">Observações</th>
              )}
              {isAdmin && (
                <th className="py-3 px-4 text-right">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedCovenants.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-400 dark:text-slate-500">
                  Nenhum convênio encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedCovenants.map(cov => {
                const covLogins = getCovenantLogins(cov);
                const selectedIdx = selectedLoginIndexMap[cov.id] || 0;
                const activeLogin = covLogins[selectedIdx] || covLogins[0] || { username: cov.login || '', password: cov.password || '', bank: cov.bank || '' };
                const showPassword = !!visiblePasswordsMap[cov.id];

                return (
                  <tr key={cov.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                    {/* 1. NOME DO CONVÊNIO */}
                    {visibleColumns.name && (
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {cov.name}
                      </td>
                    )}

                    {/* 2. CATEGORIA */}
                    {visibleColumns.category && (
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          cov.category === 'Federal' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' :
                          cov.category === 'Estadual' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' :
                          cov.category === 'Municipal' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400' :
                          cov.category === 'INSS' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400' :
                          'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {cov.category}
                        </span>
                      </td>
                    )}

                    {/* 3. ESTADO */}
                    {visibleColumns.state && (
                      <td className="py-3.5 px-4 text-xs font-mono font-medium">
                        {cov.state || '-'}
                      </td>
                    )}

                    {/* 4. LOGIN & BANCO (Com seletor de Banco e Botão de Cópia por Banco) */}
                    {visibleColumns.login && (
                      <td className="py-3.5 px-4 text-xs font-mono">
                        {covLogins.length === 0 ? (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        ) : covLogins.length === 1 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{activeLogin.username || '-'}</span>
                            {activeLogin.bank && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-sans font-medium">
                                {activeLogin.bank}
                              </span>
                            )}
                            {activeLogin.username && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(activeLogin.username, `login-${cov.id}`)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                                title="Copiar login"
                              >
                                {copiedId === `login-${cov.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Dropdown com seleção de Banco */}
                            <select
                              value={selectedIdx}
                              onChange={(e) => setSelectedLoginIndexMap(prev => ({ ...prev, [cov.id]: Number(e.target.value) }))}
                              className="text-xs py-1 px-1.5 border rounded-md font-mono bg-white dark:bg-slate-800 dark:border-slate-700 font-semibold text-blue-600 dark:text-blue-400 focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[150px] truncate"
                              title="Selecione o banco desejado"
                            >
                              {covLogins.map((l, idx) => (
                                <option key={l.id || idx} value={idx}>
                                  {l.bank || `Banco ${idx + 1}`}: {l.username || 'Sem usuário'}
                                </option>
                              ))}
                            </select>

                            {/* Botão para abrir o Modal de Cópia por Banco */}
                            <button
                              type="button"
                              onClick={() => handleTriggerCopyBankModal(cov)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-md text-[11px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors border border-blue-200/60 dark:border-blue-800/60 shrink-0"
                              title="Escolher banco e copiar dados"
                            >
                              <Copy size={11} />
                              <Building size={11} />
                              <span>Copiar</span>
                            </button>
                          </div>
                        )}
                      </td>
                    )}

                    {/* 5. SENHA */}
                    {visibleColumns.password && (
                      <td className="py-3.5 px-4 text-xs font-mono">
                        {activeLogin.password ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {showPassword ? activeLogin.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setVisiblePasswordsMap(prev => ({ ...prev, [cov.id]: !prev[cov.id] }))}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                              title={showPassword ? "Ocultar senha" : "Exibir senha"}
                            >
                              {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (covLogins.length > 1) {
                                  handleTriggerCopyBankModal(cov);
                                } else {
                                  handleCopyText(activeLogin.password, `pass-${cov.id}`);
                                }
                              }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                              title={covLogins.length > 1 ? "Escolher banco para copiar" : "Copiar senha"}
                            >
                              {copiedId === `pass-${cov.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </td>
                    )}

                    {/* 6. LINK DA GESTORA */}
                    {visibleColumns.managerUrl && (
                      <td className="py-3.5 px-4 text-xs">
                        {(cov.managerUrl || cov.manager) ? (
                          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                            <span className="truncate max-w-[180px]">
                              {cov.managerUrl ? cov.managerUrl.replace('https://', '').replace('http://', '') : cov.manager}
                            </span>
                            {cov.managerUrl && (
                              <a
                                href={cov.managerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-0.5 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                                title={`Abrir link da gestora: ${cov.managerUrl}`}
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </td>
                    )}

                    {/* 7. STATUS */}
                    {visibleColumns.status && (
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cov.status === 'Ativo' 
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30' 
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cov.status === 'Ativo' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {cov.status}
                        </span>
                      </td>
                    )}

                    {/* 8. OBSERVAÇÕES */}
                    {visibleColumns.observations && (
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]" title={cov.observations}>
                        {cov.observations || '-'}
                      </td>
                    )}

                    {/* 9. AÇÕES (SOMENTE PARA ADMIN) */}
                    {isAdmin && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(cov)}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-500 cursor-pointer"
                            title="Editar Convênio"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setCovenantToDelete(cov)}
                            className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer"
                            title="Excluir Convênio"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {sortedCovenants.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Registros por página:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={`py-1 px-2 border rounded-md ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="px-2.5 py-1 text-xs font-semibold border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Primeira
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-2.5 py-1 text-xs font-semibold border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-2.5 py-1 text-xs font-semibold border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Próxima
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2.5 py-1 text-xs font-semibold border rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Última
            </button>
          </div>
        </div>
      )}

      {/* Modal de Escolha de Banco para Cópia de Acesso */}
      {bankCopyModalCovenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                  <Building size={22} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base leading-tight">
                    Escolha o Banco para Copiar
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {bankCopyModalCovenant.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBankCopyModalCovenant(null)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Este convênio possui acessos liberados para diferentes bancos. Selecione qual banco deseja copiar:
            </p>

            {/* Banner de aviso de cópia bem sucedida */}
            {copyFeedback && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Check size={16} />
                <span>{copyFeedback}</span>
              </div>
            )}

            {/* Lista de Acessos por Banco */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {getCovenantLogins(bankCopyModalCovenant).map((l, idx) => {
                const passVisible = visiblePasswordsMap[`modal-${l.id || idx}`];
                return (
                  <div
                    key={l.id || idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      darkMode 
                        ? 'bg-slate-800/60 border-slate-700/60 hover:border-blue-500/50' 
                        : 'bg-slate-50 border-slate-200 hover:border-blue-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                        <Building size={13} />
                        {l.bank || `Banco ${idx + 1}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {l.status || 'Ativo'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="block text-[10px] font-sans font-bold text-slate-400 uppercase">Usuário</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                          {l.username || '-'}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] font-sans font-bold text-slate-400 uppercase">Senha</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                            {passVisible ? (l.password || '-') : '••••••••'}
                          </span>
                        </div>
                        {l.password && (
                          <button
                            type="button"
                            onClick={() => setVisiblePasswordsMap(prev => ({ ...prev, [`modal-${l.id || idx}`]: !prev[`modal-${l.id || idx}`] }))}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title={passVisible ? "Ocultar" : "Exibir"}
                          >
                            {passVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação para o Banco */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(l.username || '');
                          setCopyFeedback(`Usuário do ${l.bank || 'Banco'} copiado!`);
                          setTimeout(() => setCopyFeedback(null), 2500);
                        }}
                        className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Copy size={12} />
                        <span>Copiar Usuário</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(l.password || '');
                          setCopyFeedback(`Senha do ${l.bank || 'Banco'} copiada!`);
                          setTimeout(() => setCopyFeedback(null), 2500);
                        }}
                        className="flex-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Key size={12} />
                        <span>Copiar Senha</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const combined = `Banco: ${l.bank || '-'}\nUsuário: ${l.username || '-'}\nSenha: ${l.password || '-'}`;
                          navigator.clipboard.writeText(combined);
                          setCopyFeedback(`Dados do ${l.bank || 'Banco'} copiados!`);
                          setTimeout(() => setCopyFeedback(null), 2500);
                        }}
                        className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Copiar Usuário + Senha + Banco"
                      >
                        <Check size={12} />
                        <span>Ambos</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-4 mt-2 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBankCopyModalCovenant(null)}
                className={`px-4 py-2 border rounded-lg text-sm font-semibold cursor-pointer ${
                  darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal (Cadastrar / Editar Convênio + Vincular Bancos) */}
      {isModalOpen && editingCovenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className={`w-full max-w-2xl my-8 p-6 rounded-2xl shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-800">
              <h3 className="font-display font-bold text-lg">
                {canEdit ? (editingCovenant.name ? 'Editar Convênio' : 'Cadastrar Convênio') : 'Visualizar Convênio'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 1. NOME DO CONVÊNIO */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nome do Convênio
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Ex: SIAPE / SouGov, Governo de SP, Prefeitura de SP"
                    value={editingCovenant.name || ''}
                    onChange={(e) => setEditingCovenant({ ...editingCovenant, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* 2. CATEGORIA */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Categoria
                  </label>
                  <select
                    disabled={!canEdit}
                    value={editingCovenant.category || 'Federal'}
                    onChange={(e) => setEditingCovenant({ ...editingCovenant, category: e.target.value as CovenantCategory })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {/* 3. ESTADO */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Ex: SP, DF, RJ, Nacional"
                    value={editingCovenant.state || ''}
                    onChange={(e) => setEditingCovenant({ ...editingCovenant, state: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* 4. LINK DA GESTORA */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Link da Gestora
                  </label>
                  <input
                    type="url"
                    disabled={!canEdit}
                    placeholder="Ex: https://saec.consigx.com.br/Login.aspx"
                    value={editingCovenant.managerUrl || ''}
                    onChange={(e) => setEditingCovenant({ ...editingCovenant, managerUrl: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* 5. STATUS */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Status do Convênio
                  </label>
                  <select
                    disabled={!canEdit}
                    value={editingCovenant.status || 'Ativo'}
                    onChange={(e) => setEditingCovenant({ ...editingCovenant, status: e.target.value as 'Ativo' | 'Inativo' })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                {/* 6. USUÁRIOS VINCULADOS POR BANCO */}
                <div className="col-span-2 border-t pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Building size={14} className="text-blue-500" />
                        Usuários e Senhas Vinculados por Banco
                      </label>
                      <p className="text-[11px] text-slate-400 font-normal">
                        Cada banco libera um usuário e senha específico para este convênio.
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setModalBankLogins(prev => [
                          ...prev,
                          { bank: 'Banco do Brasil', username: '', password: '' }
                        ])}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors border border-blue-200/60 dark:border-blue-800/50"
                      >
                        <Plus size={13} />
                        Adicionar Acesso de Banco
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {modalBankLogins.map((bl, bIdx) => (
                      <div key={bIdx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                        <div className="col-span-4">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Banco</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            placeholder="Ex: Banco do Brasil, Itaú..."
                            value={bl.bank}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModalBankLogins(prev => prev.map((item, idx) => idx === bIdx ? { ...item, bank: val } : item));
                            }}
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs font-medium ${
                              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>

                        <div className="col-span-4">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Usuário / Login</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            placeholder="Ex: usuario.convenio"
                            value={bl.username}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModalBankLogins(prev => prev.map((item, idx) => idx === bIdx ? { ...item, username: val } : item));
                            }}
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs font-mono ${
                              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Senha</label>
                          <input
                            type="text"
                            disabled={!canEdit}
                            placeholder="Ex: Senha123"
                            value={bl.password}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModalBankLogins(prev => prev.map((item, idx) => idx === bIdx ? { ...item, password: val } : item));
                            }}
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs font-mono ${
                              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>

                        {canEdit && modalBankLogins.length > 1 && (
                          <div className="col-span-1 flex justify-end pt-3">
                            <button
                              type="button"
                              onClick={() => setModalBankLogins(prev => prev.filter((_, idx) => idx !== bIdx))}
                              className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg cursor-pointer transition-colors"
                              title="Remover este banco"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* OBSERVAÇÕES */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Observações
                </label>
                <textarea
                  disabled={!canEdit}
                  rows={2}
                  value={editingCovenant.observations || ''}
                  onChange={(e) => setEditingCovenant({ ...editingCovenant, observations: e.target.value })}
                  placeholder="Observações adicionais sobre o convênio..."
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 border rounded-lg text-sm font-semibold cursor-pointer ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {canEdit ? 'Cancelar' : 'Fechar'}
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
                  >
                    Salvar Alterações
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Convênio */}
      {covenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-full">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">Excluir Convênio</h3>
                <p className="text-xs text-slate-400">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <p className="text-sm mb-6 text-slate-600 dark:text-slate-300">
              Deseja realmente excluir o convênio <strong className="text-slate-900 dark:text-white">"{covenantToDelete.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCovenantToDelete(null)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                  darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(covenantToDelete.id);
                  setCovenantToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md transition-colors cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
