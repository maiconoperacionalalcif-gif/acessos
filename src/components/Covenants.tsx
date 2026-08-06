import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  Download, 
  FileSpreadsheet, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  Settings,
  ExternalLink
} from 'lucide-react';
import { Covenant, CovenantCategory, User } from '../types';
import * as XLSX from 'xlsx';

interface CovenantsProps {
  covenants: Covenant[];
  currentUser: User | null;
  darkMode: boolean;
  onSave: (covenant: Covenant) => void;
  onDelete: (id: string) => void;
}

export default function Covenants({
  covenants,
  currentUser,
  darkMode,
  onSave,
  onDelete
}: CovenantsProps) {
  const isOperator = currentUser?.role === 'Operador';
  const isSupervisor = currentUser?.role === 'Supervisor';
  const isAdmin = currentUser?.role === 'Administrador';

  const canEdit = isAdmin || isSupervisor;
  const canDelete = isAdmin || isSupervisor;

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedState, setSelectedState] = useState<string>('Todos');
  
  // Deleting Covenant Modal state
  const [covenantToDelete, setCovenantToDelete] = useState<Covenant | null>(null);
  
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
    managerUrl: true,
    status: true,
    observations: true
  });
  const [showColManager, setShowColManager] = useState(false);

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCovenant, setEditingCovenant] = useState<Partial<Covenant> | null>(null);

  // Categories list
  const categories: CovenantCategory[] = ['Federal', 'Estadual', 'Municipal', 'Militar', 'INSS', 'Benefício'];
  
  // States available for filter
  const states = useMemo(() => {
    const s = new Set(covenants.map(c => c.state).filter(Boolean));
    return ['Todos', ...Array.from(s)];
  }, [covenants]);

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
    return covenants.filter(cov => {
      const matchSearch = 
        cov.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cov.state && cov.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cov.managerUrl && cov.managerUrl.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cov.manager && cov.manager.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cov.observations && cov.observations.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === 'Todos' || cov.category === selectedCategory;
      const matchStatus = selectedStatus === 'Todos' || cov.status === selectedStatus;
      const matchState = selectedState === 'Todos' || cov.state === selectedState;

      return matchSearch && matchCategory && matchStatus && matchState;
    });
  }, [covenants, searchTerm, selectedCategory, selectedStatus, selectedState]);

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

  // Save Handlers
  const openNewModal = () => {
    setEditingCovenant({
      id: `cov-${Date.now()}`,
      name: '',
      category: 'Federal',
      state: '',
      managerUrl: '',
      observations: '',
      status: 'Ativo'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (covenant: Covenant) => {
    setEditingCovenant({ ...covenant });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCovenant && editingCovenant.name && editingCovenant.category) {
      onSave(editingCovenant as Covenant);
      setIsModalOpen(false);
      setEditingCovenant(null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = sortedCovenants.map(c => ({
      'Nome do Convênio': c.name,
      'Categoria': c.category,
      'Estado': c.state,
      'Link da Gestora': c.managerUrl || c.manager || '',
      'Status': c.status,
      'Observações': c.observations
    }));

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
          <p className="text-sm text-slate-400 dark:text-slate-500">Cadastre e gerencie os órgãos, institutos e convênios atendidos.</p>
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
            placeholder="Pesquisar convênio, cidade, órgão..."
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
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedCovenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                  Nenhum convênio encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginatedCovenants.map(cov => (
                <tr key={cov.id} className={`hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors`}>
                  {visibleColumns.name && (
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {cov.name}
                    </td>
                  )}
                  {visibleColumns.category && (
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
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
                  {visibleColumns.state && (
                    <td className="py-3.5 px-4 text-xs font-mono font-medium">
                      {cov.state || '-'}
                    </td>
                  )}
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
                  {visibleColumns.status && (
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        cov.status === 'Ativo' ? 'text-emerald-500' : 'text-slate-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${cov.status === 'Ativo' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {cov.status}
                      </span>
                    </td>
                  )}
                  {visibleColumns.observations && (
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]" title={cov.observations}>
                      {cov.observations || '-'}
                    </td>
                  )}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canEdit ? (
                        <button
                          onClick={() => openEditModal(cov)}
                          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-500 cursor-pointer"
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => openEditModal(cov)} // Read-only view
                          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                          title="Visualizar Detalhes"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      
                      {canDelete && (
                        <button
                          onClick={() => setCovenantToDelete(cov)}
                          className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 cursor-pointer"
                          title="Excluir Convênio"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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

      {/* Modal Form */}
      {isModalOpen && editingCovenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl p-6 ${
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
                    Status
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
              </div>

              {/* 6. OBSERVAÇÕES */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Observações
                </label>
                <textarea
                  disabled={!canEdit}
                  rows={3}
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
