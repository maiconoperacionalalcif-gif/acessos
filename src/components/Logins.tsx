import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  Download, 
  Eye, 
  EyeOff, 
  Copy, 
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Filter,
  Check,
  Calendar,
  Lock,
  Unlock,
  Wrench,
  Ban,
  Clock,
  UserCheck,
  FileSpreadsheet,
  Settings
} from 'lucide-react';
import { Login, Covenant, System, User, LoginStatus } from '../types';
import * as XLSX from 'xlsx';

interface LoginsProps {
  logins: Login[];
  covenants: Covenant[];
  systems: System[];
  currentUser: User | null;
  darkMode: boolean;
  onSave: (login: Login) => void;
  onDelete: (id: string) => void;
  onReserve: (loginId: string) => void;
  onRelease: (loginId: string) => void;
  onLogAction: (actionType: 'Visualizar Senha' | 'Copiar Senha' | 'Copiar Usuário' | 'Abrir Sistema', targetId: string, targetName: string) => void;
  initialSystemFilterId?: string; // from dashboard favorite link
}

export default function Logins({
  logins,
  covenants,
  systems,
  currentUser,
  darkMode,
  onSave,
  onDelete,
  onReserve,
  onRelease,
  onLogAction,
  initialSystemFilterId
}: LoginsProps) {
  const isOperator = currentUser?.role === 'Operador';
  const isSupervisor = currentUser?.role === 'Supervisor';
  const isAdmin = currentUser?.role === 'Administrador';

  const canEdit = isAdmin || isSupervisor;
  const canDelete = isAdmin;

  // Filter out logins if user is Operator based on permissions
  const authorizedLogins = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Administrador') return logins;
    
    return logins.filter(login => {
      // Check covenant permission
      const hasCovenantPermission = 
        currentUser.allowedCovenants.length === 0 || 
        currentUser.allowedCovenants.includes(login.covenantId);

      // Check bank permission
      const hasBankPermission = 
        currentUser.allowedBanks.length === 0 || 
        currentUser.allowedBanks.some(b => login.bank.toLowerCase().includes(b.toLowerCase()));

      return hasCovenantPermission && hasBankPermission;
    });
  }, [logins, currentUser]);

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCovenant, setSelectedCovenant] = useState<string>('Todos');
  const [selectedSystem, setSelectedSystem] = useState<string>(initialSystemFilterId || 'Todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('Todos'); // Reservado / Livre
  
  // Sorting
  const [sortField, setSortField] = useState<keyof Login>('username');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    username: true,
    system: true,
    covenant: true,
    bank: true,
    shop: true,
    cpf: true,
    status: true,
    responsible: true,
    reservation: true
  });
  const [showColManager, setShowColManager] = useState(false);

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLogin, setEditingLogin] = useState<Partial<Login> | null>(null);

  // Security Toggles
  const [revealedPasswords, setRevealedPasswords] = useState<{ [id: string]: boolean }>({});
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  const handleSort = (field: keyof Login) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Clipboard copies
  const copyToClipboard = async (text: string, key: string, action: 'Copiar Senha' | 'Copiar Usuário', targetId: string, targetName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [key]: true });
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
      
      onLogAction(action, targetId, targetName);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  // Filter & Search Logic
  const filteredLogins = useMemo(() => {
    return authorizedLogins.filter(login => {
      const cov = covenants.find(c => c.id === login.covenantId);
      const sys = systems.find(s => s.id === login.systemId);

      const matchSearch = 
        login.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        login.bank.toLowerCase().includes(searchTerm.toLowerCase()) ||
        login.cpf.toLowerCase().includes(searchTerm.toLowerCase()) ||
        login.shop.toLowerCase().includes(searchTerm.toLowerCase()) ||
        login.responsible.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCovenant = selectedCovenant === 'Todos' || login.covenantId === selectedCovenant;
      const matchSystem = selectedSystem === 'Todos' || login.systemId === selectedSystem;
      const matchStatus = selectedStatus === 'Todos' || login.status === selectedStatus;
      
      let matchAvailability = true;
      if (selectedAvailability === 'Reservado') {
        matchAvailability = !!login.reservedBy;
      } else if (selectedAvailability === 'Livre') {
        matchAvailability = !login.reservedBy && login.status === 'Ativo';
      }

      return matchSearch && matchCovenant && matchSystem && matchStatus && matchAvailability;
    });
  }, [authorizedLogins, covenants, systems, searchTerm, selectedCovenant, selectedSystem, selectedStatus, selectedAvailability]);

  // Sorted
  const sortedLogins = useMemo(() => {
    return [...filteredLogins].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredLogins, sortField, sortDirection]);

  // Paginated
  const paginatedLogins = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedLogins.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedLogins, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedLogins.length / rowsPerPage) || 1;

  // New/Edit Modal Handlers
  const openNewModal = () => {
    setEditingLogin({
      id: `log-${Date.now()}`,
      covenantId: covenants[0]?.id || '',
      systemId: systems[0]?.id || '',
      bank: '',
      shop: '',
      username: '',
      password: '',
      cpf: '',
      pin: '',
      token: '',
      email: '',
      phone: '',
      responsible: currentUser?.name || '',
      observations: '',
      creationDate: new Date().toISOString(),
      lastAlteration: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days
      status: 'Ativo'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (login: Login) => {
    setEditingLogin({ ...login });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLogin && editingLogin.username && editingLogin.covenantId && editingLogin.systemId) {
      const payload: Login = {
        ...editingLogin as Login,
        lastAlteration: new Date().toISOString()
      };
      onSave(payload);
      setIsModalOpen(false);
      setEditingLogin(null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = sortedLogins.map(l => {
      const cov = covenants.find(c => c.id === l.covenantId);
      const sys = systems.find(s => s.id === l.systemId);
      return {
        Usuário: l.username,
        Senha: l.password,
        Sistema: sys ? sys.name : 'Outro',
        Convênio: cov ? cov.name : 'Nenhum',
        Banco: l.bank,
        Loja: l.shop,
        CPF: l.cpf,
        PIN: l.pin,
        Token: l.token,
        Responsável: l.responsible,
        Vencimento: l.expirationDate ? new Date(l.expirationDate).toLocaleDateString('pt-BR') : '-',
        Status: l.status,
        ReservadoPor: l.reservedBy || 'Ninguém'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logins");
    XLSX.writeFile(wb, `logins_export_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Logins & Credenciais</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
            {isOperator 
              ? 'Visualize, reserve e utilize os logins liberados para a sua conta.' 
              : 'Gerencie logins de consignados, faça reservas de acesso e controle expirações de senhas.'
            }
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
              <span>Novo Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-xl border space-y-4 ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por usuário, banco, CPF, loja..."
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

          {/* Covenant Filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <select
              value={selectedCovenant}
              onChange={(e) => {
                setSelectedCovenant(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full py-2 px-3 border text-sm rounded-lg ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="Todos">Todos Convênios</option>
              {covenants.map(cov => <option key={cov.id} value={cov.id}>{cov.name}</option>)}
            </select>
          </div>

          {/* System Filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <select
              value={selectedSystem}
              onChange={(e) => {
                setSelectedSystem(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full py-2 px-3 border text-sm rounded-lg ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="Todos">Todos Sistemas</option>
              {systems.map(sys => <option key={sys.id} value={sys.id}>{sys.name}</option>)}
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
              <option value="Bloqueado">Bloqueado</option>
              <option value="Em manutenção">Em Manutenção</option>
            </select>
          </div>
        </div>

        {/* Extended Filters */}
        <div className="flex flex-wrap gap-4 items-center border-t pt-3 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Disponibilidade:</span>
          {['Todos', 'Livre', 'Reservado'].map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setSelectedAvailability(opt);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-full border cursor-pointer font-semibold transition-colors ${
                selectedAvailability === opt 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : darkMode 
                    ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200' 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs'
              }`}
            >
              {opt === 'Todos' ? 'Todos Logins' : opt === 'Livre' ? 'Disponíveis para Uso' : 'Reservados (Em Uso)'}
            </button>
          ))}
        </div>
      </div>

      {/* Adjust Columns and Results Summary */}
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <div>
          Mostrando <strong className="text-slate-700 dark:text-slate-300">{paginatedLogins.length}</strong> de <strong className="text-slate-700 dark:text-slate-300">{sortedLogins.length}</strong> logins autorizados
        </div>
        
        {/* Columns manager */}
        <div className="relative">
          <button
            onClick={() => setShowColManager(!showColManager)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md font-semibold cursor-pointer ${
              darkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            id="logins-col-manager-toggle"
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
                    col === 'username' ? 'Usuário' :
                    col === 'system' ? 'Sistema' :
                    col === 'covenant' ? 'Convênio' :
                    col === 'bank' ? 'Banco' :
                    col === 'shop' ? 'Loja/Filial' :
                    col === 'cpf' ? 'CPF' :
                    col === 'status' ? 'Status' :
                    col === 'responsible' ? 'Responsável' :
                    col === 'reservation' ? 'Reserva' : col
                  }</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Logins Table View */}
      <div className={`overflow-x-auto rounded-xl border ${
        darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-white'
      }`}>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className={`border-b text-xs uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider ${
              darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/80 border-slate-100'
            }`}>
              {visibleColumns.username && (
                <th onClick={() => handleSort('username')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Usuário / Senha</span>
                    {sortField === 'username' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.system && <th className="py-3 px-4">Sistema</th>}
              {visibleColumns.covenant && <th className="py-3 px-4">Convênio</th>}
              {visibleColumns.bank && (
                <th onClick={() => handleSort('bank')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Banco</span>
                    {sortField === 'bank' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.shop && <th className="py-3 px-4">Loja/Filial</th>}
              {visibleColumns.cpf && <th className="py-3 px-4">CPF / PIN</th>}
              {visibleColumns.status && <th className="py-3 px-4">Status</th>}
              {visibleColumns.responsible && <th className="py-3 px-4">Responsável</th>}
              {visibleColumns.reservation && <th className="py-3 px-4">Reserva (Em Uso)</th>}
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedLogins.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400 dark:text-slate-500">
                  Nenhum login disponível ou autorizado para sua pesquisa.
                </td>
              </tr>
            ) : (
              paginatedLogins.map(login => {
                const sys = systems.find(s => s.id === login.systemId);
                const cov = covenants.find(c => c.id === login.covenantId);
                const passwordRevealed = !!revealedPasswords[login.id];

                // Check password expiry
                const isExpiringSoon = (() => {
                  if (!login.expirationDate) return false;
                  const exp = new Date(login.expirationDate);
                  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysLeft <= 10;
                })();

                return (
                  <tr key={login.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                    
                    {/* Username & Password Block */}
                    {visibleColumns.username && (
                      <td className="py-3.5 px-4 font-mono font-medium">
                        <div className="space-y-1.5 min-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold font-sans text-slate-900 dark:text-white truncate">
                              {login.username}
                            </span>
                            <button
                              onClick={() => copyToClipboard(login.username, `${login.id}-user`, 'Copiar Usuário', login.id, login.username)}
                              className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                              title="Copiar Usuário"
                            >
                              {copiedStates[`${login.id}-user`] ? <Check size={12} className="text-emerald-500" /> : <Copy size={11} />}
                            </button>
                          </div>
                          
                          {/* Secure Password field */}
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all truncate max-w-[140px]">
                              {passwordRevealed ? login.password : '••••••••••••'}
                            </span>
                            
                            <button
                              onClick={() => setRevealedPasswords({ ...revealedPasswords, [login.id]: !passwordRevealed })}
                              className="p-0.5 rounded text-slate-400 hover:text-blue-500 cursor-pointer shrink-0"
                              title={passwordRevealed ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {passwordRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                            
                            <button
                              onClick={() => copyToClipboard(login.password || '', `${login.id}-pass`, 'Copiar Senha', login.id, login.username)}
                              className="p-0.5 rounded text-slate-400 hover:text-blue-500 cursor-pointer shrink-0"
                              title="Copiar senha"
                            >
                              {copiedStates[`${login.id}-pass`] ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* System Name */}
                    {visibleColumns.system && (
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        {sys ? (
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <span>{sys.name}</span>
                            {sys.url && (
                              <a 
                                href={sys.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => onLogAction('Abrir Sistema', sys.id, sys.name)}
                                className="hover:text-blue-800 cursor-pointer"
                                title="Abrir Link do Sistema"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        ) : <span className="text-red-500">-</span>}
                      </td>
                    )}

                    {/* Covenant */}
                    {visibleColumns.covenant && (
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                        {cov ? cov.name : '-'}
                      </td>
                    )}

                    {/* Bank */}
                    {visibleColumns.bank && (
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {login.bank}
                      </td>
                    )}

                    {/* Shop */}
                    {visibleColumns.shop && (
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 truncate">
                        {login.shop || '-'}
                      </td>
                    )}

                    {/* CPF & PIN */}
                    {visibleColumns.cpf && (
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <div className="space-y-1">
                          <p>{login.cpf || '-'}</p>
                          {(login.pin || login.token) && (
                            <p className="text-[10px] text-slate-400">
                              {login.pin && `PIN: ${login.pin}`} {login.token && `| TOK: ${login.token}`}
                            </p>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Status with Expiring alert */}
                    {visibleColumns.status && (
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            login.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                            login.status === 'Bloqueado' ? 'bg-red-50 text-red-600 dark:bg-red-950/20' :
                            'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                          }`}>
                            {login.status === 'Ativo' ? <Unlock size={8} /> : login.status === 'Bloqueado' ? <Ban size={8} /> : <Wrench size={8} />}
                            {login.status}
                          </span>
                          
                          {isExpiringSoon && (
                            <p className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5 animate-pulse">
                              Senha Vencendo!
                            </p>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Responsible */}
                    {visibleColumns.responsible && (
                      <td className="py-3.5 px-4 text-xs text-slate-500 truncate max-w-[100px]">
                        {login.responsible}
                      </td>
                    )}

                    {/* Reservation state */}
                    {visibleColumns.reservation && (
                      <td className="py-3.5 px-4 text-xs">
                        {login.reservedBy ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-orange-500 font-semibold text-[11px]">
                              <Clock size={10} className="animate-spin" />
                              Reservado por:
                            </span>
                            <p className="font-bold text-slate-700 dark:text-slate-300">{login.reservedBy}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-semibold text-[11px]">Livre</span>
                        )}
                      </td>
                    )}

                    {/* Reservation Action Button & Edit Options */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Reservation Flow */}
                        {login.status === 'Ativo' ? (
                          login.reservedBy ? (
                            // Only supervisor/admin OR the exact owner can release
                            (currentUser?.name === login.reservedBy || !isOperator) && (
                              <button
                                onClick={() => onRelease(login.id)}
                                className="px-2 py-1 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded cursor-pointer transition-colors"
                              >
                                Liberar
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => onReserve(login.id)}
                              className="px-2 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors"
                            >
                              Reservar
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 italic font-medium">Bloqueado</span>
                        )}

                        {/* Edit Buttons */}
                        <div className="flex items-center border-l pl-2 dark:border-slate-800 gap-1">
                          {canEdit ? (
                            <button
                              onClick={() => openEditModal(login)}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-500 cursor-pointer"
                              title="Editar"
                            >
                              <Edit size={13} />
                            </button>
                          ) : (
                            <button
                              onClick={() => openEditModal(login)} // view mode
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                              title="Visualizar"
                            >
                              <Eye size={13} />
                            </button>
                          )}
                          
                          {canDelete && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Tem certeza que deseja excluir as credenciais do usuário "${login.username}"?`)) {
                                  onDelete(login.id);
                                }
                              }}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {sortedLogins.length > 0 && (
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

      {/* New/Edit Modal Form */}
      {isModalOpen && editingLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-6 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          } my-8`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-800">
              <h3 className="font-display font-bold text-lg">
                {canEdit ? (editingLogin.username ? 'Editar Credenciais' : 'Cadastrar Login') : 'Visualizar Detalhes do Login'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Covenant Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">Convênio</label>
                  <select
                    disabled={!canEdit}
                    required
                    value={editingLogin.covenantId || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, covenantId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="" disabled>Selecione...</option>
                    {covenants.map(cov => <option key={cov.id} value={cov.id}>{cov.name}</option>)}
                  </select>
                </div>

                {/* System Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">Sistema</label>
                  <select
                    disabled={!canEdit}
                    required
                    value={editingLogin.systemId || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, systemId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="" disabled>Selecione...</option>
                    {systems.map(sys => <option key={sys.id} value={sys.id}>{sys.name}</option>)}
                  </select>
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Banco</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Ex: Banco do Brasil, PAN"
                    value={editingLogin.bank || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, bank: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Shop / Filial */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Loja / Filial</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Ex: Campinas Centro"
                    value={editingLogin.shop || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, shop: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Usuário / ID</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Ex: bruno.op1"
                    value={editingLogin.username || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, username: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Senha de Acesso</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Senha secreta"
                    value={editingLogin.password || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, password: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* CPF */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">CPF Associado</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="000.000.000-00"
                    value={editingLogin.cpf || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, cpf: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* PIN */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">PIN / Assinatura</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="PIN adicional"
                    value={editingLogin.pin || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, pin: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Token Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Token Auxiliar</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Ex: Google Auth, Chave"
                    value={editingLogin.token || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, token: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">E-mail Cadastrado</label>
                  <input
                    type="email"
                    disabled={!canEdit}
                    placeholder="Ex: login@empresa.com"
                    value={editingLogin.email || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Telefone / Recuperação</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="(00) 00000-0000"
                    value={editingLogin.phone || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Responsible */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Responsável / Proprietário</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={editingLogin.responsible || ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, responsible: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Status Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select
                    disabled={!canEdit}
                    value={editingLogin.status || 'Ativo'}
                    onChange={(e) => setEditingLogin({ ...editingLogin, status: e.target.value as LoginStatus })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Bloqueado">Bloqueado</option>
                    <option value="Em manutenção">Em manutenção</option>
                  </select>
                </div>

                {/* Expiration Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Vencimento da Senha</label>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={editingLogin.expirationDate ? editingLogin.expirationDate.split('T')[0] : ''}
                    onChange={(e) => setEditingLogin({ ...editingLogin, expirationDate: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Observations */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Observações da Credencial</label>
                <textarea
                  disabled={!canEdit}
                  rows={3}
                  placeholder="Observações úteis para esta credencial, regras de comissão, etc..."
                  value={editingLogin.observations || ''}
                  onChange={(e) => setEditingLogin({ ...editingLogin, observations: e.target.value })}
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
    </div>
  );
}
