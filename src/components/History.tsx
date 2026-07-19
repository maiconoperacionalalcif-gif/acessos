import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Activity, 
  User as UserIcon, 
  Cpu, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { HistoryLog, User } from '../types';
import * as XLSX from 'xlsx';

interface HistoryProps {
  logs: HistoryLog[];
  currentUser: User | null;
  darkMode: boolean;
}

export default function History({
  logs,
  currentUser,
  darkMode
}: HistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('Todos');
  const [selectedTarget, setSelectedTarget] = useState<string>('Todos');

  // Sorting
  const [sortField, setSortField] = useState<keyof HistoryLog>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    user: true,
    action: true,
    target: true,
    timestamp: true,
    ip: true
  });
  const [showColManager, setShowColManager] = useState(false);

  const handleSort = (field: keyof HistoryLog) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Unique actions list
  const actionsList = [
    'Criar', 
    'Alterar', 
    'Excluir', 
    'Visualizar Senha', 
    'Copiar Senha', 
    'Copiar Usuário', 
    'Abrir Sistema'
  ];

  // Unique targets list
  const targetsList = ['Covenant', 'System', 'Login', 'User'];

  // Filter & Search Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = 
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.targetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ip.toLowerCase().includes(searchTerm.toLowerCase());

      const matchAction = selectedAction === 'Todos' || log.actionType === selectedAction;
      const matchTarget = selectedTarget === 'Todos' || log.targetType === selectedTarget;

      return matchSearch && matchAction && matchTarget;
    });
  }, [logs, searchTerm, selectedAction, selectedTarget]);

  // Sorted Logs
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (sortField === 'timestamp') {
        const aTime = new Date(aVal as string).getTime();
        const bTime = new Date(bVal as string).getTime();
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredLogs, sortField, sortDirection]);

  // Paginated Logs
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedLogs.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedLogs, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedLogs.length / rowsPerPage) || 1;

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = sortedLogs.map(l => ({
      Colaborador: l.userName,
      Ação: l.actionType,
      TipoAlvo: l.targetType,
      NomeAlvo: l.targetName,
      DataHora: new Date(l.timestamp).toLocaleString('pt-BR'),
      IPAddress: l.ip
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `historico_auditoria_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Histórico de Auditoria</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Trilha completa de auditoria de acessos, visualizações, cópias de credenciais e alterações.</p>
        </div>
        
        <button
          onClick={handleExportExcel}
          className={`flex items-center gap-2 px-3.5 py-2 border rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
            darkMode 
              ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' 
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
          }`}
        >
          <FileSpreadsheet size={16} className="text-emerald-500" />
          <span>Exportar Histórico XLS</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-xl border ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
      } grid grid-cols-1 md:grid-cols-3 gap-4 items-center`}>
        
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por colaborador, registro, IP..."
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

        {/* Action filter */}
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full py-2 px-3 border text-sm rounded-lg ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Todas Ações</option>
            {actionsList.map(act => <option key={act} value={act}>{act}</option>)}
          </select>
        </div>

        {/* Target filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedTarget}
            onChange={(e) => {
              setSelectedTarget(e.target.value);
              setCurrentPage(1);
            }}
            className={`w-full py-2 px-3 border text-sm rounded-lg ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Todos Módulos</option>
            {targetsList.map(t => <option key={t} value={t}>{
              t === 'Covenant' ? 'Convênios' :
              t === 'System' ? 'Sistemas' :
              t === 'Login' ? 'Logins' :
              t === 'User' ? 'Usuários' : t
            }</option>)}
          </select>
        </div>
      </div>

      {/* Adjust Columns and Results Summary */}
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <div>
          Mostrando <strong className="text-slate-700 dark:text-slate-300">{paginatedLogs.length}</strong> de <strong className="text-slate-700 dark:text-slate-300">{sortedLogs.length}</strong> logs de auditoria
        </div>
        
        {/* Columns manager */}
        <div className="relative">
          <button
            onClick={() => setShowColManager(!showColManager)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md font-semibold cursor-pointer ${
              darkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            id="history-col-manager-toggle"
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
                    col === 'user' ? 'Colaborador' :
                    col === 'action' ? 'Operação / Ação' :
                    col === 'target' ? 'Alvo / Registro' :
                    col === 'timestamp' ? 'Data / Hora' :
                    col === 'ip' ? 'IP de Origem' : col
                  }</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <div className={`overflow-x-auto rounded-xl border ${
        darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-white'
      }`}>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className={`border-b text-xs uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider ${
              darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/80 border-slate-100'
            }`}>
              {visibleColumns.user && (
                <th onClick={() => handleSort('userName')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Colaborador</span>
                    {sortField === 'userName' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.action && (
                <th onClick={() => handleSort('actionType')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Operação</span>
                    {sortField === 'actionType' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.target && (
                <th onClick={() => handleSort('targetName')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Registro Alvo</span>
                    {sortField === 'targetName' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.timestamp && (
                <th onClick={() => handleSort('timestamp')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Data & Hora</span>
                    {sortField === 'timestamp' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.ip && (
                <th className="py-3 px-4">IP</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400 dark:text-slate-500">
                  Nenhum log de auditoria encontrado.
                </td>
              </tr>
            ) : (
              paginatedLogs.map(log => {
                return (
                  <tr key={log.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                    
                    {visibleColumns.user && (
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <UserIcon size={12} className="text-slate-400" />
                          <span>{log.userName}</span>
                        </div>
                      </td>
                    )}

                    {visibleColumns.action && (
                      <td className="py-3 px-4">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          log.actionType === 'Criar' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                          log.actionType === 'Excluir' ? 'bg-red-50 text-red-600 dark:bg-red-950/20' :
                          log.actionType === 'Alterar' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20' :
                          log.actionType === 'Visualizar Senha' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/20' :
                          'bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300'
                        }`}>
                          {log.actionType}
                        </span>
                      </td>
                    )}

                    {visibleColumns.target && (
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            "{log.targetName}"
                          </span>
                          <span className="text-[10px] text-slate-400 lowercase mt-0.5 font-semibold">
                            módulo: {
                              log.targetType === 'Covenant' ? 'convênios' :
                              log.targetType === 'System' ? 'sistemas' :
                              log.targetType === 'Login' ? 'logins' : 'usuários'
                            }
                          </span>
                        </div>
                      </td>
                    )}

                    {visibleColumns.timestamp && (
                      <td className="py-3 px-4 text-xs font-semibold font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                    )}

                    {visibleColumns.ip && (
                      <td className="py-3 px-4 text-xs font-mono text-slate-400">
                        {log.ip || '127.0.0.1'}
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
      {sortedLogs.length > 0 && (
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
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
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
    </div>
  );
}
