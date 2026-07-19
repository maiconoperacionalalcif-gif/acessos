import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  Download, 
  Star,
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  Settings,
  FileSpreadsheet
} from 'lucide-react';
import { System, Covenant, User } from '../types';
import * as XLSX from 'xlsx';

interface SystemsProps {
  systems: System[];
  covenants: Covenant[];
  favorites: { systemId: string; userId: string }[];
  currentUser: User | null;
  darkMode: boolean;
  onSave: (system: System) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (systemId: string) => void;
}

export default function Systems({
  systems,
  covenants,
  favorites,
  currentUser,
  darkMode,
  onSave,
  onDelete,
  onToggleFavorite
}: SystemsProps) {
  const isOperator = currentUser?.role === 'Operador';
  const isSupervisor = currentUser?.role === 'Supervisor';
  const isAdmin = currentUser?.role === 'Administrador';

  const canEdit = isAdmin || isSupervisor;
  const canDelete = isAdmin;

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCovenant, setSelectedCovenant] = useState<string>('Todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState<keyof System>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    covenant: true,
    url: true,
    description: true,
    status: true
  });
  const [showColManager, setShowColManager] = useState(false);

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<Partial<System> | null>(null);

  // Set of favorite IDs for current user
  const favoriteIds = useMemo(() => {
    return new Set(
      favorites
        .filter(f => f.userId === currentUser?.id)
        .map(f => f.systemId)
    );
  }, [favorites, currentUser]);

  // Handle Sort
  const handleSort = (field: keyof System) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter & Search Logic
  const filteredSystems = useMemo(() => {
    return systems.filter(sys => {
      const matchSearch = 
        sys.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sys.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCovenant = selectedCovenant === 'Todos' || sys.covenantId === selectedCovenant;
      const matchStatus = selectedStatus === 'Todos' || sys.status === selectedStatus;
      const matchFav = !onlyFavorites || favoriteIds.has(sys.id);

      return matchSearch && matchCovenant && matchStatus && matchFav;
    });
  }, [systems, searchTerm, selectedCovenant, selectedStatus, onlyFavorites, favoriteIds]);

  // Sorted
  const sortedSystems = useMemo(() => {
    return [...filteredSystems].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredSystems, sortField, sortDirection]);

  // Paginated
  const paginatedSystems = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedSystems.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedSystems, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedSystems.length / rowsPerPage) || 1;

  // New/Edit Modal Handlers
  const openNewModal = () => {
    setEditingSystem({
      id: `sys-${Date.now()}`,
      covenantId: covenants[0]?.id || '',
      name: '',
      description: '',
      url: '',
      icon: 'Monitor',
      observations: '',
      status: 'Ativo'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (system: System) => {
    setEditingSystem({ ...system });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSystem && editingSystem.name && editingSystem.covenantId) {
      onSave(editingSystem as System);
      setIsModalOpen(false);
      setEditingSystem(null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = sortedSystems.map(s => {
      const cov = covenants.find(c => c.id === s.covenantId);
      return {
        Nome: s.name,
        Convênio: cov ? cov.name : 'Nenhum',
        Descrição: s.description,
        URL: s.url,
        Observações: s.observations,
        Status: s.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sistemas");
    XLSX.writeFile(wb, `sistemas_export_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Sistemas</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Configure e organize os portais de consulta e digitação vinculados aos convênios.</p>
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
              <span>Novo Sistema</span>
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
            placeholder="Pesquisar sistema por nome..."
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

        {/* Favorites Switch */}
        <div className="flex items-center">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(e) => {
                setOnlyFavorites(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded text-amber-500 focus:ring-amber-400 border-slate-300 w-4 h-4"
            />
            <Star size={14} className={`fill-amber-400 text-amber-400 ${onlyFavorites ? '' : 'opacity-40'}`} />
            <span>Apenas Favoritos</span>
          </label>
        </div>
      </div>

      {/* Adjust Columns and Results Summary */}
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <div>
          Mostrando <strong className="text-slate-700 dark:text-slate-300">{paginatedSystems.length}</strong> de <strong className="text-slate-700 dark:text-slate-300">{sortedSystems.length}</strong> sistemas filtrados
        </div>
        
        {/* Columns manager */}
        <div className="relative">
          <button
            onClick={() => setShowColManager(!showColManager)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md font-semibold cursor-pointer ${
              darkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            id="sys-col-manager-toggle"
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
                    col === 'name' ? 'Nome' :
                    col === 'covenant' ? 'Convênio' :
                    col === 'url' ? 'Link do Portal' :
                    col === 'description' ? 'Descrição' :
                    col === 'status' ? 'Status' : col
                  }</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Systems Grid / Table */}
      <div className={`overflow-x-auto rounded-xl border ${
        darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-white'
      }`}>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className={`border-b text-xs uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider ${
              darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/80 border-slate-100'
            }`}>
              <th className="py-3 px-4 w-10 text-center">Fav</th>
              {visibleColumns.name && (
                <th onClick={() => handleSort('name')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Nome</span>
                    {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              {visibleColumns.covenant && (
                <th className="py-3 px-4">Convênio Vinculado</th>
              )}
              {visibleColumns.description && (
                <th className="py-3 px-4">Descrição</th>
              )}
              {visibleColumns.url && (
                <th className="py-3 px-4">Link</th>
              )}
              {visibleColumns.status && (
                <th onClick={() => handleSort('status')} className="py-3 px-4 cursor-pointer hover:text-blue-500">
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
              )}
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedSystems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                  Nenhum sistema encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedSystems.map(sys => {
                const isFav = favoriteIds.has(sys.id);
                const cov = covenants.find(c => c.id === sys.covenantId);
                return (
                  <tr key={sys.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onToggleFavorite(sys.id)}
                        className="text-slate-300 hover:text-amber-400 focus:outline-none transition-colors cursor-pointer"
                        title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                      >
                        <Star size={16} className={isFav ? "fill-amber-400 text-amber-400" : ""} />
                      </button>
                    </td>
                    {visibleColumns.name && (
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                            {sys.name.charAt(0)}
                          </div>
                          <span>{sys.name}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.covenant && (
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {cov ? (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-[11px]">
                            {cov.name}
                          </span>
                        ) : (
                          <span className="text-red-500 text-[11px]">Desvinculado</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.description && (
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {sys.description || '-'}
                      </td>
                    )}
                    {visibleColumns.url && (
                      <td className="py-3.5 px-4 text-xs">
                        {sys.url ? (
                          <a 
                            href={sys.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 w-max"
                          >
                            <span>Acessar Portal</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : '-'}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          sys.status === 'Ativo' ? 'text-emerald-500' : 'text-slate-400'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${sys.status === 'Ativo' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {sys.status}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit ? (
                          <button
                            onClick={() => openEditModal(sys)}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-500 cursor-pointer"
                            title="Editar"
                          >
                            <Edit size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => openEditModal(sys)}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                            title="Visualizar"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        
                        {canDelete && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Excluir o sistema "${sys.name}" permanentemente?`)) {
                                onDelete(sys.id);
                              }
                            }}
                            className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
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
      {sortedSystems.length > 0 && (
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

      {/* Modal Form */}
      {isModalOpen && editingSystem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl p-6 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-800">
              <h3 className="font-display font-bold text-lg">
                {canEdit ? (editingSystem.name ? 'Editar Sistema' : 'Cadastrar Sistema') : 'Visualizar Sistema'}
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
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Sistema</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Ex: SouGov, Consiglog, Dataprev"
                    value={editingSystem.name || ''}
                    onChange={(e) => setEditingSystem({ ...editingSystem, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">Convênio Vinculado</label>
                  <select
                    disabled={!canEdit}
                    required
                    value={editingSystem.covenantId || ''}
                    onChange={(e) => setEditingSystem({ ...editingSystem, covenantId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="" disabled>Selecione um Convênio...</option>
                    {covenants.map(cov => <option key={cov.id} value={cov.id}>{cov.name}</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Link de Acesso (URL)</label>
                  <input
                    type="url"
                    disabled={!canEdit}
                    placeholder="https://exemplo.com.br"
                    value={editingSystem.url || ''}
                    onChange={(e) => setEditingSystem({ ...editingSystem, url: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição Curta</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Ex: Consulta de margem consignada e liberação de propostas"
                    value={editingSystem.description || ''}
                    onChange={(e) => setEditingSystem({ ...editingSystem, description: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select
                    disabled={!canEdit}
                    value={editingSystem.status || 'Ativo'}
                    onChange={(e) => setEditingSystem({ ...editingSystem, status: e.target.value as 'Ativo' | 'Inativo' })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans">Ícone Padrão</label>
                  <select
                    disabled={!canEdit}
                    value={editingSystem.icon || 'Monitor'}
                    onChange={(e) => setEditingSystem({ ...editingSystem, icon: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="Monitor">Computador</option>
                    <option value="Globe">Globo / Internet</option>
                    <option value="ShieldAlert">Escudo de Segurança</option>
                    <option value="KeyRound">Chave</option>
                    <option value="Database">Banco de Dados</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Observações Operacionais</label>
                <textarea
                  disabled={!canEdit}
                  rows={3}
                  placeholder="Instruções específicas para o operador ao acessar este sistema..."
                  value={editingSystem.observations || ''}
                  onChange={(e) => setEditingSystem({ ...editingSystem, observations: e.target.value })}
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
