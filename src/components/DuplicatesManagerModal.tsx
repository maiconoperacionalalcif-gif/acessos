import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  Trash2, 
  CheckCircle2, 
  Layers, 
  Building2, 
  KeyRound, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldAlert, 
  Sparkles,
  ExternalLink,
  Info,
  Clock,
  UserCheck,
  Lock,
  GitMerge,
  Filter
} from 'lucide-react';
import { Covenant, Login, User } from '../types';
import { DuplicatesReport, DuplicateCovenantGroup, DuplicateLoginGroup } from '../lib/duplicateDetector';

interface DuplicatesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DuplicatesReport;
  covenants: Covenant[];
  logins: Login[];
  currentUser: User | null;
  darkMode: boolean;
  onDeleteCovenant: (id: string) => Promise<void> | void;
  onDeleteLogin: (id: string) => Promise<void> | void;
  onSaveCovenant: (covenant: Covenant) => Promise<void> | void;
  onSaveLogin: (login: Login) => Promise<void> | void;
  onLogAction?: (actionType: any, targetId: string, targetName: string) => void;
  onRefreshDatabase?: () => void;
}

export const DuplicatesManagerModal: React.FC<DuplicatesManagerModalProps> = ({
  isOpen,
  onClose,
  report,
  covenants,
  logins,
  currentUser,
  darkMode,
  onDeleteCovenant,
  onDeleteLogin,
  onSaveCovenant,
  onSaveLogin,
  onLogAction,
  onRefreshDatabase
}) => {
  const [activeTab, setActiveTab] = useState<'logins' | 'covenants'>(
    report.duplicateLogins.length > 0 ? 'logins' : 'covenants'
  );
  const [showPasswordsMap, setShowPasswordsMap] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmAutoResolve, setConfirmAutoResolve] = useState(false);

  if (!isOpen) return null;

  const togglePassword = (id: string) => {
    setShowPasswordsMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. Delete single login
  const handleDeleteSingleLogin = async (loginId: string, loginUser: string) => {
    if (!confirm(`Deseja realmente remover esta credencial duplicada (${loginUser})?`)) return;
    setIsProcessing(true);
    setProcessingId(loginId);
    try {
      await onDeleteLogin(loginId);
      if (onLogAction) {
        onLogAction('Excluir', loginId, `Credencial duplicada ${loginUser}`);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir credencial.');
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  };

  // 2. Delete single covenant
  const handleDeleteSingleCovenant = async (covId: string, covName: string) => {
    if (!confirm(`Deseja excluir este registro de convênio duplicado (${covName})? Logins associados a ele também poderão ser removidos.`)) return;
    setIsProcessing(true);
    setProcessingId(covId);
    try {
      await onDeleteCovenant(covId);
      // Delete child logins of this covenant
      const childLogins = logins.filter(l => l.covenantId === covId);
      for (const cl of childLogins) {
        await onDeleteLogin(cl.id);
      }
      if (onLogAction) {
        onLogAction('Excluir', covId, `Convênio duplicado ${covName}`);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir convênio.');
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  };

  // 3. Keep latest login in group and delete older ones
  const handleKeepLatestLoginInGroup = async (group: DuplicateLoginGroup) => {
    if (group.logins.length <= 1) return;
    setIsProcessing(true);
    setProcessingId(group.id);

    try {
      // Sort by creationDate or lastAlteration descending (newest first)
      const sorted = [...group.logins].sort((a, b) => {
        const timeA = new Date(a.lastAlteration || a.creationDate || 0).getTime();
        const timeB = new Date(b.lastAlteration || b.creationDate || 0).getTime();
        return timeB - timeA;
      });

      const keepItem = sorted[0];
      const itemsToDelete = sorted.slice(1);

      for (const item of itemsToDelete) {
        await onDeleteLogin(item.id);
      }

      if (onLogAction) {
        onLogAction(
          'Excluir', 
          keepItem.id, 
          `Resolução de duplicidade: mantido ${keepItem.username} (${keepItem.id}) e removidos ${itemsToDelete.length} duplicados.`
        );
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao resolver duplicidade de login.');
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  };

  // 4. Merge duplicate covenants into the primary one
  const handleMergeCovenantsGroup = async (group: DuplicateCovenantGroup) => {
    if (group.covenants.length <= 1) return;
    setIsProcessing(true);
    setProcessingId(group.id);

    try {
      // Choose primary covenant (one with most logins or managerUrl, or first)
      const sorted = [...group.covenants].sort((a, b) => {
        const aLogins = logins.filter(l => l.covenantId === a.id).length;
        const bLogins = logins.filter(l => l.covenantId === b.id).length;
        if (bLogins !== aLogins) return bLogins - aLogins;
        if (b.managerUrl && !a.managerUrl) return 1;
        if (a.managerUrl && !b.managerUrl) return -1;
        return 0;
      });

      const primary = sorted[0];
      const duplicatesToDelete = sorted.slice(1);

      // Reassign logins from duplicates to the primary covenant
      for (const dup of duplicatesToDelete) {
        const dupLogins = logins.filter(l => l.covenantId === dup.id);
        for (const dl of dupLogins) {
          // Check if login already exists in primary
          const existsInPrimary = logins.some(l => 
            l.covenantId === primary.id && 
            l.bank?.toLowerCase() === dl.bank?.toLowerCase() && 
            l.username?.toLowerCase() === dl.username?.toLowerCase()
          );

          if (!existsInPrimary) {
            await onSaveLogin({
              ...dl,
              covenantId: primary.id
            });
          } else {
            await onDeleteLogin(dl.id);
          }
        }

        // Delete redundant covenant record
        await onDeleteCovenant(dup.id);
      }

      if (onLogAction) {
        onLogAction('Editar', primary.id, `Unificação de ${group.covenants.length} convênios repetidos no convênio ${primary.name}`);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao unificar convênios.');
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  };

  // 5. Auto resolve ALL duplicates
  const handleAutoResolveAll = async () => {
    setIsProcessing(true);
    try {
      // 1. Resolve duplicate logins
      for (const group of report.duplicateLogins) {
        const sorted = [...group.logins].sort((a, b) => {
          const timeA = new Date(a.lastAlteration || a.creationDate || 0).getTime();
          const timeB = new Date(b.lastAlteration || b.creationDate || 0).getTime();
          return timeB - timeA;
        });
        const itemsToDelete = sorted.slice(1);
        for (const item of itemsToDelete) {
          await onDeleteLogin(item.id);
        }
      }

      // 2. Resolve duplicate covenants
      for (const group of report.duplicateCovenants) {
        const sorted = [...group.covenants].sort((a, b) => {
          const aLogins = logins.filter(l => l.covenantId === a.id).length;
          const bLogins = logins.filter(l => l.covenantId === b.id).length;
          return bLogins - aLogins;
        });
        const primary = sorted[0];
        const duplicatesToDelete = sorted.slice(1);

        for (const dup of duplicatesToDelete) {
          const dupLogins = logins.filter(l => l.covenantId === dup.id);
          for (const dl of dupLogins) {
            const existsInPrimary = logins.some(l => 
              l.covenantId === primary.id && 
              l.bank?.toLowerCase() === dl.bank?.toLowerCase() && 
              l.username?.toLowerCase() === dl.username?.toLowerCase()
            );
            if (!existsInPrimary) {
              await onSaveLogin({ ...dl, covenantId: primary.id });
            } else {
              await onDeleteLogin(dl.id);
            }
          }
          await onDeleteCovenant(dup.id);
        }
      }

      if (onLogAction) {
        onLogAction('Excluir', 'bulk-cleanup', 'Resolução automática de todos os acessos e convênios duplicados');
      }

      setConfirmAutoResolve(false);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro durante a limpeza automática.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Search filtered items
  const filteredLoginGroups = report.duplicateLogins.filter(g => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      g.covenantName.toLowerCase().includes(s) ||
      g.username.toLowerCase().includes(s) ||
      g.bank.toLowerCase().includes(s) ||
      (g.covenantState && g.covenantState.toLowerCase().includes(s))
    );
  });

  const filteredCovenantGroups = report.duplicateCovenants.filter(g => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      g.name.toLowerCase().includes(s) ||
      g.state.toLowerCase().includes(s) ||
      g.category.toLowerCase().includes(s)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto transition-all ${
        darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Modal Header */}
        <div className={`p-5 border-b flex items-center justify-between gap-4 shrink-0 ${
          darkMode ? 'bg-slate-850/90 border-slate-800' : 'bg-amber-50/70 border-amber-200/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg leading-tight">
                  Auditoria de Acessos Duplicados
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase border border-amber-500/30">
                  Alerta Admin
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Identifique, compare e unifique registros repetidos para manter os acessos limpos e sem conflitos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report.hasDuplicates && (
              <button
                onClick={() => setConfirmAutoResolve(true)}
                disabled={isProcessing}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Sparkles size={14} />
                <span>Resolver Todos ({report.totalRedundantItems})</span>
              </button>
            )}

            <button
              disabled={isProcessing}
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Top Summary Banner */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${
          darkMode ? 'bg-slate-850/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold ${
              report.duplicateLogins.length > 0
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              <KeyRound size={14} />
              <span>
                {report.duplicateLogins.length} grupo(s) de credenciais repetidas ({report.redundantLoginsCount} excedentes)
              </span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold ${
              report.duplicateCovenants.length > 0
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              <Building2 size={14} />
              <span>
                {report.duplicateCovenants.length} convênio(s) com mesmo nome ({report.redundantCovenantsCount} excedentes)
              </span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar nos duplicados..."
              className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                darkMode ? 'bg-slate-900 border-slate-750 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="px-5 pt-3 border-b flex items-center gap-2 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('logins')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'logins'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound size={15} />
            <span>Credenciais Repetidas ({report.duplicateLogins.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('covenants')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'covenants'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Building2 size={15} />
            <span>Convênios Repetidos ({report.duplicateCovenants.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: DUPLICATE LOGINS */}
          {activeTab === 'logins' && (
            <div className="space-y-4">
              {filteredLoginGroups.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    Nenhuma credencial duplicada identificada!
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Todos os logins bancários estão devidamente organizados e associados a convênios únicos.
                  </p>
                </div>
              ) : (
                filteredLoginGroups.map((group, gIdx) => (
                  <div 
                    key={group.id}
                    className={`rounded-2xl border p-4 transition-all space-y-3 ${
                      darkMode ? 'bg-slate-850/70 border-slate-800' : 'bg-slate-50/80 border-slate-200 shadow-2xs'
                    }`}
                  >
                    {/* Group Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-500 font-bold text-xs flex items-center justify-center">
                          {gIdx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                              {group.covenantName} {group.covenantState ? `(${group.covenantState})` : ''}
                            </h3>
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                              Banco: {group.bank}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-750 font-mono text-[10px] font-bold">
                              Login: {group.username}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Existem <strong>{group.logins.length} credenciais</strong> cadastradas com este mesmo usuário e banco neste convênio.
                          </p>
                        </div>
                      </div>

                      {/* Action to keep newest */}
                      <button
                        onClick={() => handleKeepLatestLoginInGroup(group)}
                        disabled={isProcessing && processingId === group.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ml-auto"
                        title="Mantém a credencial mais recente e exclui as outras repetições"
                      >
                        {isProcessing && processingId === group.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        <span>Manter Mais Recente ({group.logins.length - 1} excluídos)</span>
                      </button>
                    </div>

                    {/* Comparison Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {group.logins.map((login, idx) => {
                        const isPassVisible = !!showPasswordsMap[login.id];
                        const isFirst = idx === 0;

                        return (
                          <div
                            key={login.id}
                            className={`p-3 rounded-xl border relative space-y-2 transition-all ${
                              darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-slate-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-slate-400 font-bold truncate">
                                ID: {login.id.slice(0, 14)}...
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                login.status === 'Ativo' 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}>
                                {login.status || 'Ativo'}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Senha:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                                    {isPassVisible ? (login.password || '(vazia)') : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePassword(login.id)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                                  >
                                    {isPassVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Criado em:</span>
                                <span className="font-mono">
                                  {login.creationDate ? new Date(login.creationDate).toLocaleDateString('pt-BR') : 'Não informado'}
                                </span>
                              </div>

                              {login.reservedBy && (
                                <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                                  <Lock size={12} />
                                  <span>Reservado por: {login.reservedBy}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t dark:border-slate-800 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-400">
                                Item {idx + 1} de {group.logins.length}
                              </span>
                              <button
                                onClick={() => handleDeleteSingleLogin(login.id, login.username)}
                                disabled={isProcessing && processingId === login.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                              >
                                <Trash2 size={12} />
                                <span>Excluir Este</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: DUPLICATE COVENANTS */}
          {activeTab === 'covenants' && (
            <div className="space-y-4">
              {filteredCovenantGroups.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    Nenhum convênio duplicado identificado!
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Não existem convênios com o mesmo nome e estado cadastrados simultaneamente.
                  </p>
                </div>
              ) : (
                filteredCovenantGroups.map((group, gIdx) => (
                  <div 
                    key={group.id}
                    className={`rounded-2xl border p-4 transition-all space-y-3 ${
                      darkMode ? 'bg-slate-850/70 border-slate-800' : 'bg-slate-50/80 border-slate-200 shadow-2xs'
                    }`}
                  >
                    {/* Covenant Group Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs flex items-center justify-center">
                          {gIdx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                              {group.name} ({group.state})
                            </h3>
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                              {group.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Existem <strong>{group.covenants.length} cadastros</strong> com o mesmo nome e estado ({group.totalLogins} credenciais no total).
                          </p>
                        </div>
                      </div>

                      {/* Unify / Merge Button */}
                      <button
                        onClick={() => handleMergeCovenantsGroup(group)}
                        disabled={isProcessing && processingId === group.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ml-auto"
                        title="Unifica todos os cadastros em um único convênio e preserva todas as credenciais bancárias"
                      >
                        {isProcessing && processingId === group.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <GitMerge size={13} />
                        )}
                        <span>Unificar em 1 Convênio ({group.covenants.length - 1} unificados)</span>
                      </button>
                    </div>

                    {/* Covenants comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {group.covenants.map((cov, idx) => {
                        const covLogins = logins.filter(l => l.covenantId === cov.id);

                        return (
                          <div
                            key={cov.id}
                            className={`p-3 rounded-xl border relative space-y-2 transition-all ${
                              darkMode ? 'bg-slate-900 border-slate-750' : 'bg-white border-slate-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-slate-400 font-bold truncate">
                                ID: {cov.id.slice(0, 14)}...
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                {covLogins.length} login(s)
                              </span>
                            </div>

                            <div className="space-y-1 text-xs">
                              <p className="font-bold text-slate-900 dark:text-white truncate">
                                {cov.name}
                              </p>
                              {cov.managerUrl && (
                                <p className="text-[10px] text-blue-500 font-mono truncate" title={cov.managerUrl}>
                                  {cov.managerUrl}
                                </p>
                              )}
                              {cov.login && (
                                <p className="text-[11px] text-slate-500">
                                  Login Principal: <strong className="text-slate-700 dark:text-slate-300">{cov.login}</strong>
                                </p>
                              )}
                            </div>

                            <div className="pt-2 border-t dark:border-slate-800 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-400">
                                Cadastro #{idx + 1}
                              </span>
                              <button
                                onClick={() => handleDeleteSingleCovenant(cov.id, cov.name)}
                                disabled={isProcessing && processingId === cov.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                              >
                                <Trash2 size={12} />
                                <span>Excluir Convênio</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          darkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Info size={14} className="text-blue-500" />
            <span>Unificar convênios preserva todas as credenciais bancárias associadas.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isProcessing}
              onClick={onClose}
              className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50 ${
                darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-600'
              }`}
            >
              Fechar
            </button>

            {report.hasDuplicates && (
              <button
                disabled={isProcessing}
                onClick={() => setConfirmAutoResolve(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={14} />
                <span>Limpar e Resolver Todos ({report.totalRedundantItems})</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Confirmation Modal for Auto Resolve */}
      {confirmAutoResolve && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <Sparkles size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-base">
                Resolver {report.totalRedundantItems} Itens Duplicados Automaticamente?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O sistema irá manter o registro mais recente de cada credencial e unificar os convênios repetidos sem perda de dados bancários.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={isProcessing}
                onClick={() => setConfirmAutoResolve(false)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                  darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                disabled={isProcessing}
                onClick={handleAutoResolveAll}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <span>Sim, Resolver Automaticamente</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
