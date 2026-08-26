import React, { useState, useMemo } from 'react';
import { 
  Inbox, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Ticket, 
  User as UserIcon, 
  Calendar, 
  Building2, 
  MapPin, 
  Landmark, 
  FileSpreadsheet, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowRight, 
  SlidersHorizontal,
  LayoutGrid,
  List,
  Sparkles,
  MessageSquareText,
  UserCheck,
  Send
} from 'lucide-react';
import { AccessRequest, AccessRequestCategory, AccessRequestStatus, Covenant, User } from '../types';
import { normalizeText, matchesSearch } from '../lib/utils';
import { BRAZILIAN_STATES } from './OperationalView';
import * as XLSX from 'xlsx';

interface AccessRequestsQueueProps {
  accessRequests: AccessRequest[];
  covenants: Covenant[];
  currentUser: User | null;
  darkMode: boolean;
  onSaveRequest: (request: AccessRequest) => Promise<void> | void;
  onDeleteRequest: (id: string) => Promise<void> | void;
  onCreateLoginFromRequest?: (request: AccessRequest) => void;
}

export default function AccessRequestsQueue({
  accessRequests = [],
  covenants = [],
  currentUser,
  darkMode,
  onSaveRequest,
  onDeleteRequest,
  onCreateLoginFromRequest
}: AccessRequestsQueueProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [stateFilter, setStateFilter] = useState<string>('Todos');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Modal State for Updating Ticket / Status
  const [editingRequest, setEditingRequest] = useState<AccessRequest | null>(null);
  const [ticketInput, setTicketInput] = useState('');
  const [statusInput, setStatusInput] = useState<AccessRequestStatus>('Em Andamento');
  const [assignedToInput, setAssignedToInput] = useState('');
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Request Modal (Admin can also open one directly if needed)
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCovenantName, setNewCovenantName] = useState('');
  const [newCategory, setNewCategory] = useState<AccessRequestCategory>('Prefeitura');
  const [newState, setNewState] = useState('SP');
  const [newBank, setNewBank] = useState('');
  const [newObservations, setNewObservations] = useState('');

  // Toast
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = accessRequests.length;
    const pending = accessRequests.filter(r => r.status === 'Pendente').length;
    const inProgress = accessRequests.filter(r => r.status === 'Em Andamento').length;
    const completed = accessRequests.filter(r => r.status === 'Concluído').length;
    const rejected = accessRequests.filter(r => r.status === 'Rejeitado').length;
    return { total, pending, inProgress, completed, rejected };
  }, [accessRequests]);

  // Filtered list
  const filteredRequests = useMemo(() => {
    const term = normalizeText(searchTerm);
    return accessRequests.filter(req => {
      const matchSearch = !term || (
        matchesSearch(req.covenantName, term) ||
        matchesSearch(req.bank, term) ||
        matchesSearch(req.requestedBy, term) ||
        matchesSearch(req.ticketNumber, term) ||
        matchesSearch(req.state, term) ||
        matchesSearch(req.adminNotes, term) ||
        matchesSearch(req.observations, term) ||
        matchesSearch(req.assignedTo, term)
      );

      const matchStatus = statusFilter === 'Todos' || req.status === statusFilter;
      const matchCategory = categoryFilter === 'Todos' || req.category === categoryFilter;
      const matchState = stateFilter === 'Todos' || req.state === stateFilter;

      return matchSearch && matchStatus && matchCategory && matchState;
    });
  }, [accessRequests, searchTerm, statusFilter, categoryFilter, stateFilter]);

  // Open Edit Ticket Modal
  const handleOpenEdit = (request: AccessRequest) => {
    setEditingRequest(request);
    setTicketInput(request.ticketNumber || '');
    setStatusInput(request.status || 'Em Andamento');
    setAssignedToInput(request.assignedTo || currentUser?.name || 'Administrador');
    setAdminNotesInput(request.adminNotes || '');
  };

  // Save Ticket / Status changes
  const handleSaveEdit = async () => {
    if (!editingRequest) return;
    setIsSubmitting(true);
    try {
      const updated: AccessRequest = {
        ...editingRequest,
        ticketNumber: ticketInput.trim() || undefined,
        status: statusInput,
        assignedTo: assignedToInput.trim() || undefined,
        assignedAt: editingRequest.assignedAt || (ticketInput.trim() || assignedToInput.trim() ? new Date().toISOString() : undefined),
        completedAt: statusInput === 'Concluído' ? (editingRequest.completedAt || new Date().toISOString()) : undefined,
        adminNotes: adminNotesInput.trim() || undefined
      };
      await onSaveRequest(updated);
      setEditingRequest(null);
      showToast('Solicitação atualizada com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar solicitação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Action: Copy formatted ticket text
  const handleCopyRequestData = (req: AccessRequest) => {
    const text = `📋 SOLICITAÇÃO DE ACESSO:
• Convênio: ${req.covenantName}
• Esfera: ${req.category}
• Estado: ${req.state}
• Banco: ${req.bank}
• Solicitante: ${req.requestedBy}
• Data da Solicitação: ${new Date(req.requestedAt).toLocaleString('pt-BR')}
${req.ticketNumber ? `• Número do Chamado: ${req.ticketNumber}` : ''}
${req.observations ? `• Observações do Analista: ${req.observations}` : ''}
${req.adminNotes ? `• Notas do Admin: ${req.adminNotes}` : ''}`;

    navigator.clipboard.writeText(text);
    setCopiedId(req.id);
    showToast('Dados copiados para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Quick Status Change
  const handleQuickStatusChange = async (req: AccessRequest, newStatus: AccessRequestStatus) => {
    const updated: AccessRequest = {
      ...req,
      status: newStatus,
      assignedTo: req.assignedTo || currentUser?.name || 'Administrador',
      assignedAt: req.assignedAt || new Date().toISOString(),
      completedAt: newStatus === 'Concluído' ? new Date().toISOString() : req.completedAt
    };
    await onSaveRequest(updated);
    showToast(`Status alterado para "${newStatus}"!`);
  };

  // Admin New Request Submit
  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCovenantName.trim() || !newBank.trim()) {
      alert('Preencha o nome do convênio e o banco.');
      return;
    }

    const newReq: AccessRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      covenantName: newCovenantName.trim(),
      category: newCategory,
      state: newState,
      bank: newBank.trim(),
      observations: newObservations.trim() || undefined,
      requestedBy: currentUser?.name || 'Administrador',
      requestedByUserId: currentUser?.id,
      requestedAt: new Date().toISOString(),
      status: 'Pendente'
    };

    await onSaveRequest(newReq);
    setShowNewModal(false);
    setNewCovenantName('');
    setNewBank('');
    setNewObservations('');
    showToast('Nova solicitação registrada na esteira!');
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredRequests.map(req => ({
      'ID': req.id,
      'Data da Solicitação': new Date(req.requestedAt).toLocaleString('pt-BR'),
      'Convênio': req.covenantName,
      'Esfera / Categoria': req.category,
      'Estado (UF)': req.state,
      'Banco': req.bank,
      'Solicitante (Analista)': req.requestedBy,
      'Status': req.status,
      'Número do Chamado': req.ticketNumber || 'Sem chamado',
      'Responsável Atendimento': req.assignedTo || 'Não atribuído',
      'Observações do Solicitante': req.observations || '',
      'Notas do Administrador': req.adminNotes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Esteira de Solicitacoes');
    XLSX.writeFile(wb, `esteira_solicitacoes_acessos_${Date.now()}.xlsx`);
    showToast('Planilha exportada com sucesso!');
  };

  // Helper Badge Colors
  const getStatusBadge = (status: AccessRequestStatus) => {
    switch (status) {
      case 'Pendente':
        return {
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          icon: Clock,
          label: 'Pendente'
        };
      case 'Em Andamento':
        return {
          bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          icon: Ticket,
          label: 'Em Andamento'
        };
      case 'Concluído':
        return {
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: CheckCircle2,
          label: 'Concluído'
        };
      case 'Rejeitado':
        return {
          bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
          icon: XCircle,
          label: 'Rejeitado'
        };
    }
  };

  const getCategoryBadge = (cat: AccessRequestCategory) => {
    switch (cat) {
      case 'Prefeitura':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Estadual':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Federal':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  // Render a Single Card for Kanban or List
  const renderRequestCard = (req: AccessRequest) => {
    const statusCfg = getStatusBadge(req.status);
    const StatusIcon = statusCfg.icon;
    const isCopied = copiedId === req.id;

    return (
      <div 
        key={req.id}
        className={`p-4 rounded-xl border transition-all duration-200 shadow-xs flex flex-col justify-between gap-3 group hover:shadow-md ${
          darkMode 
            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' 
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Header: Category, State & Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border tracking-wider ${getCategoryBadge(req.category)}`}>
              {req.category}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {req.state}
            </span>
          </div>

          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg}`}>
            <StatusIcon size={12} />
            {statusCfg.label}
          </span>
        </div>

        {/* Covenant Name & Bank */}
        <div className="space-y-1">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
            {req.covenantName}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
            <Landmark size={13} className="text-blue-500 shrink-0" />
            <span>Banco: <strong className="text-slate-900 dark:text-white">{req.bank}</strong></span>
          </div>
        </div>

        {/* Ticket Box (Chamado da Solicitação) */}
        <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
          req.ticketNumber 
            ? darkMode ? 'bg-blue-950/30 border-blue-800/60' : 'bg-blue-50/80 border-blue-200'
            : darkMode ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50/60 border-amber-200/80'
        }`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <Ticket size={14} className={req.ticketNumber ? "text-blue-600 dark:text-blue-400 shrink-0" : "text-amber-500 shrink-0"} />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block leading-tight">
                Chamado / Ticket
              </span>
              <span className={`text-xs font-mono font-bold truncate block ${
                req.ticketNumber 
                  ? 'text-blue-700 dark:text-blue-300' 
                  : 'text-amber-600 dark:text-amber-400 italic font-sans font-medium text-[11px]'
              }`}>
                {req.ticketNumber || 'Aguardando abertura de chamado'}
              </span>
            </div>
          </div>

          <button
            onClick={() => handleOpenEdit(req)}
            className="px-2 py-1 rounded-md text-[11px] font-bold bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shrink-0 cursor-pointer"
            title="Atualizar chamado e status"
          >
            {req.ticketNumber ? 'Editar' : '+ Inserir'}
          </button>
        </div>

        {/* Notes & Analyst Info */}
        <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
              <UserIcon size={12} className="text-slate-400" />
              Solicitante: <strong className="text-slate-800 dark:text-slate-200">{req.requestedBy}</strong>
            </span>
            <span className="text-slate-400 text-[10px]">
              {new Date(req.requestedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>

          {req.observations && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-md border border-slate-100 dark:border-slate-800 italic">
              "{req.observations}"
            </p>
          )}

          {req.adminNotes && (
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-md border border-emerald-200 dark:border-emerald-900/50 font-medium">
              <strong>Admin:</strong> {req.adminNotes}
            </div>
          )}
        </div>

        {/* Bottom Actions Toolbar */}
        <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleCopyRequestData(req)}
              className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                isCopied 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400' 
                  : darkMode 
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Copiar texto formatado para abrir chamado"
            >
              {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span className="text-[10px]">Copiar</span>
            </button>

            {req.status === 'Pendente' && (
              <button
                onClick={() => handleQuickStatusChange(req, 'Em Andamento')}
                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10px] font-bold transition-colors cursor-pointer"
                title="Mover para Em Andamento"
              >
                Assumir
              </button>
            )}

            {req.status === 'Em Andamento' && (
              <button
                onClick={() => handleQuickStatusChange(req, 'Concluído')}
                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold transition-colors cursor-pointer"
                title="Marcar como Concluído"
              >
                Concluir
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOpenEdit(req)}
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Atualizar detalhes do chamado"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Deseja realmente excluir a solicitação para "${req.covenantName}"?`)) {
                  onDeleteRequest(req.id);
                  showToast('Solicitação excluída.');
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Excluir solicitação"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl shadow-2xl border border-slate-700 dark:border-slate-200 animate-slide-up text-sm font-semibold">
          <div className="p-1 rounded-full bg-emerald-500 text-white">
            <Check size={14} />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/80 border-slate-800' 
          : 'bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50 border-blue-100/80 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-600 text-white shadow-2xs">
                Esteira Admin
              </span>
              <span className="text-xs text-slate-400">
                Gestão de Pedidos e Abertura de Chamados
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white">
              Esteira de Solicitações de Acesso
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Acompanhe os pedidos de criação de acessos enviados pelos analistas operacionais, assuma as demandas e atualize o número do chamado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                darkMode 
                  ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' 
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
              }`}
              title="Exportar dados para Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} className="text-emerald-500" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus size={15} />
              <span>Nova Solicitação</span>
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className={`p-3.5 rounded-xl border transition-all ${
            darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200/80 shadow-2xs'
          }`}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Pedidos</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-display font-extrabold text-slate-900 dark:text-white">{metrics.total}</span>
              <Inbox size={18} className="text-slate-400" />
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${
            darkMode ? 'bg-amber-950/20 border-amber-800/40' : 'bg-amber-50/70 border-amber-200 shadow-2xs'
          }`}>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Pendentes (Sem Chamado)</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-display font-extrabold text-amber-600 dark:text-amber-400">{metrics.pending}</span>
              <Clock size={18} className="text-amber-500" />
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${
            darkMode ? 'bg-blue-950/20 border-blue-800/40' : 'bg-blue-50/70 border-blue-200 shadow-2xs'
          }`}>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Em Andamento (Com Chamado)</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-display font-extrabold text-blue-600 dark:text-blue-400">{metrics.inProgress}</span>
              <Ticket size={18} className="text-blue-500" />
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${
            darkMode ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50/70 border-emerald-200 shadow-2xs'
          }`}>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Concluídas / Liberadas</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-display font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.completed}</span>
              <CheckCircle2 size={18} className="text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por convênio, banco, analista ou nº do chamado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium border transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 ${
                darkMode 
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
              }`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer transition-colors ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Status: Todos ({accessRequests.length})</option>
            <option value="Pendente">Pendentes ({metrics.pending})</option>
            <option value="Em Andamento">Em Andamento ({metrics.inProgress})</option>
            <option value="Concluído">Concluídos ({metrics.completed})</option>
            <option value="Rejeitado">Rejeitados ({metrics.rejected})</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer transition-colors ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Esfera: Todas</option>
            <option value="Prefeitura">Prefeituras</option>
            <option value="Estadual">Estadual</option>
            <option value="Federal">Federal</option>
          </select>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer transition-colors ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Estado: Todos</option>
            {BRAZILIAN_STATES.map(s => (
              <option key={s.uf} value={s.uf}>{s.uf} - {s.name}</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 border rounded-xl p-1 shrink-0 dark:border-slate-800">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'kanban'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Visualização em Esteira / Kanban"
          >
            <LayoutGrid size={13} />
            <span>Esteira</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Visualização em Lista / Tabela"
          >
            <List size={13} />
            <span>Tabela</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredRequests.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <Inbox size={40} className="mx-auto text-slate-400 mb-3 opacity-60" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Nenhuma solicitação encontrada</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Não há pedidos de acesso correspondentes aos filtros selecionados. As solicitações feitas na Central Operacional aparecerão automaticamente aqui.
          </p>
          {(searchTerm || statusFilter !== 'Todos' || categoryFilter !== 'Todos' || stateFilter !== 'Todos') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('Todos');
                setCategoryFilter('Todos');
                setStateFilter('Todos');
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-blue-700"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN / ESTEIRA VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* Column 1: Pendentes */}
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 min-h-[450px] ${
            darkMode ? 'bg-slate-900/50 border-amber-900/30' : 'bg-amber-50/30 border-amber-200/60'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">1. Pendentes</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {filteredRequests.filter(r => r.status === 'Pendente').length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredRequests.filter(r => r.status === 'Pendente').map(renderRequestCard)}
              {filteredRequests.filter(r => r.status === 'Pendente').length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400">
                  Nenhuma solicitação pendente no momento.
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Em Andamento */}
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 min-h-[450px] ${
            darkMode ? 'bg-slate-900/50 border-blue-900/30' : 'bg-blue-50/30 border-blue-200/60'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">2. Em Andamento</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {filteredRequests.filter(r => r.status === 'Em Andamento').length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredRequests.filter(r => r.status === 'Em Andamento').map(renderRequestCard)}
              {filteredRequests.filter(r => r.status === 'Em Andamento').length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400">
                  Nenhuma solicitação em andamento.
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Concluídas */}
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 min-h-[450px] ${
            darkMode ? 'bg-slate-900/50 border-emerald-900/30' : 'bg-emerald-50/30 border-emerald-200/60'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">3. Concluídas</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {filteredRequests.filter(r => r.status === 'Concluído').length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredRequests.filter(r => r.status === 'Concluído').map(renderRequestCard)}
              {filteredRequests.filter(r => r.status === 'Concluído').length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400">
                  Nenhuma solicitação concluída.
                </div>
              )}
            </div>
          </div>

          {/* Column 4: Rejeitadas */}
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 min-h-[450px] ${
            darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">4. Rejeitadas</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {filteredRequests.filter(r => r.status === 'Rejeitado').length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredRequests.filter(r => r.status === 'Rejeitado').map(renderRequestCard)}
              {filteredRequests.filter(r => r.status === 'Rejeitado').length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400">
                  Nenhuma solicitação rejeitada.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TABLE VIEW */
        <div className={`rounded-2xl border overflow-hidden ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b font-bold uppercase tracking-wider text-[11px] ${
                darkMode ? 'bg-slate-800/80 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3.5">Convênio & Esfera</th>
                  <th className="p-3.5">Banco</th>
                  <th className="p-3.5">UF</th>
                  <th className="p-3.5">Solicitante</th>
                  <th className="p-3.5">Chamado / Ticket</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Data</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests.map(req => {
                  const statusCfg = getStatusBadge(req.status);
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white text-xs">{req.covenantName}</p>
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border ${getCategoryBadge(req.category)}`}>
                            {req.category}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                        {req.bank}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {req.state}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{req.requestedBy}</span>
                        {req.observations && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[160px]" title={req.observations}>
                            "{req.observations}"
                          </p>
                        )}
                      </td>

                      <td className="p-3.5">
                        {req.ticketNumber ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {req.ticketNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-500 italic">Sem chamado</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg}`}>
                          <StatusIcon size={12} />
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(req.requestedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyRequestData(req)}
                            className="p-1.5 rounded-lg border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Copiar dados formatados"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(req)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors"
                            title="Atualizar chamado"
                          >
                            Atualizar Chamado
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja excluir a solicitação "${req.covenantName}"?`)) {
                                onDeleteRequest(req.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / UPDATE TICKET MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-5 border-b flex items-center justify-between dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                  <Ticket size={18} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">Atualizar Chamado da Solicitação</h3>
                  <p className="text-xs text-slate-400">{editingRequest.covenantName} • {editingRequest.bank}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Summary Card */}
              <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex justify-between">
                  <span className="text-slate-400">Esfera & Estado:</span>
                  <span className="font-bold">{editingRequest.category} ({editingRequest.state})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Analista Solicitante:</span>
                  <span className="font-bold">{editingRequest.requestedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Data do Pedido:</span>
                  <span>{new Date(editingRequest.requestedAt).toLocaleString('pt-BR')}</span>
                </div>
                {editingRequest.observations && (
                  <div className="pt-1 border-t dark:border-slate-700">
                    <span className="text-slate-400 block text-[11px]">Observações do Analista:</span>
                    <p className="italic text-slate-600 dark:text-slate-300">{editingRequest.observations}</p>
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Status da Solicitação na Esteira
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Pendente', 'Em Andamento', 'Concluído', 'Rejeitado'] as AccessRequestStatus[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setStatusInput(st)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        statusInput === st
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : darkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticket Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Número / Código do Chamado</span>
                  <span className="text-[10px] text-blue-500 font-normal">Ex: CH-2026-9901, Ticket #4412</span>
                </label>
                <div className="relative">
                  <Ticket size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Digite o código ou protocolo do chamado..."
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Assigned To Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Responsável pelo Atendimento (Admin / Supervisor)
                </label>
                <div className="relative">
                  <UserCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nome do responsável que assumiu o chamado..."
                    value={assignedToInput}
                    onChange={(e) => setAssignedToInput(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Admin Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Notas do Administrador / Retorno para o Analista</span>
                  <span className="text-[10px] text-slate-400 font-normal">Ficará visível para o solicitante</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Chamado aberto junto à gestora Consiglog. Previsão de liberação até amanhã às 14h."
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-medium border outline-none resize-none focus:ring-2 focus:ring-blue-500/20 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <button
                type="button"
                onClick={() => handleCopyRequestData(editingRequest)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold cursor-pointer ${
                  darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <Copy size={13} />
                <span>Copiar Dados</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                    darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN DIRECT NEW REQUEST */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-5 border-b flex items-center justify-between dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">Nova Solicitação de Acesso</h3>
                  <p className="text-xs text-slate-400">Cadastrar diretamente na esteira de solicitações</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNew} className="p-6 space-y-4">
              {/* Covenant Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome do Convênio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prefeitura de Curitiba, Governo de Goiás, Aeronáutica..."
                  value={newCovenantName}
                  onChange={(e) => setNewCovenantName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Category & State */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Esfera / Categoria *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as AccessRequestCategory)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="Prefeitura">Prefeitura</option>
                    <option value="Estadual">Estadual</option>
                    <option value="Federal">Federal</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Estado (UF) *
                  </label>
                  <select
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    {BRAZILIAN_STATES.map(s => (
                      <option key={s.uf} value={s.uf}>{s.uf} - {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bank */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Banco *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Itaú, Banco do Brasil, Bradesco, Santander, Pan..."
                  value={newBank}
                  onChange={(e) => setNewBank(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Observations */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Observações / Justificativa
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais para abertura do chamado..."
                  value={newObservations}
                  onChange={(e) => setNewObservations(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-medium border outline-none resize-none ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                >
                  Cadastrar Solicitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
