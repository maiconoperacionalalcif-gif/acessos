import React from 'react';
import { 
  KeyRound, 
  Monitor, 
  FileText, 
  Users, 
  Activity, 
  Unlock, 
  ShieldAlert, 
  Clock, 
  Star, 
  ArrowRight,
  ExternalLink,
  Lock,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { FullDatabase } from '../lib/api';
import { User, System, Login } from '../types';

interface DashboardProps {
  db: FullDatabase;
  currentUser: User | null;
  darkMode: boolean;
  onNavigateToTab: (tab: string, filter?: any) => void;
  onToggleFavorite: (systemId: string) => void;
  onReserve: (loginId: string) => void;
  onRelease: (loginId: string) => void;
}

export default function Dashboard({
  db,
  currentUser,
  darkMode,
  onNavigateToTab,
  onToggleFavorite,
  onReserve,
  onRelease
}: DashboardProps) {
  // Compute analytics
  const totalLogins = db.logins.length;
  const totalSystems = db.systems.length;
  const totalCovenants = db.covenants.length;
  const totalUsers = db.users.length;

  const loginsInUse = db.logins.filter(l => l.reservedBy).length;
  const loginsBlocked = db.logins.filter(l => l.status === 'Bloqueado').length;
  const loginsMaintenance = db.logins.filter(l => l.status === 'Em manutenção').length;
  const loginsFree = db.logins.filter(l => l.status === 'Ativo' && !l.reservedBy).length;

  // Logins expiring in less than 30 days (or already expired)
  const today = new Date();
  const loginsExpiring = db.logins.filter(l => {
    if (!l.expirationDate) return false;
    const expDate = new Date(l.expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  }).length;

  // Favorites for this user
  const userFavorites = db.favorites
    .filter(f => f.userId === currentUser?.id)
    .map(f => db.systems.find(s => s.id === f.systemId))
    .filter((s): s is System => !!s);

  // System usage stats (from Reservation Logs)
  const systemReservationCounts: { [systemName: string]: number } = {};
  db.reservationLogs.forEach(log => {
    systemReservationCounts[log.systemName] = (systemReservationCounts[log.systemName] || 0) + 1;
  });

  // Make sure all systems are listed in stats
  db.systems.forEach(sys => {
    if (!systemReservationCounts[sys.name]) {
      systemReservationCounts[sys.name] = 0;
    }
  });

  const sortedSystemStats = Object.entries(systemReservationCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxReservationCount = Math.max(...sortedSystemStats.map(s => s.count), 1);

  // Recent Access Logs (History logs related to Viewing, Copying, Opening)
  const recentAccesses = db.historyLogs
    .filter(log => ['Visualizar Senha', 'Copiar Senha', 'Copiar Usuário', 'Abrir Sistema'].includes(log.actionType))
    .slice(0, 5);

  // Recent updates (History logs related to Criar, Alterar, Excluir)
  const recentUpdates = db.historyLogs
    .filter(log => ['Criar', 'Alterar', 'Excluir'].includes(log.actionType))
    .slice(0, 5);

  // Active reservations right now
  const activeReservations = db.logins.filter(l => l.reservedBy);

  const cardStyle = `p-5 rounded-xl border transition-all duration-300 ${
    darkMode 
      ? 'bg-slate-900 border-slate-800/80 text-slate-100 shadow-lg shadow-black/30 hover:border-slate-700' 
      : 'bg-white border-slate-200 text-slate-800 shadow-xs hover:shadow-md hover:border-slate-300'
  }`;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/30 border-slate-800 text-slate-100 shadow-md' 
          : 'bg-gradient-to-r from-white via-slate-50/50 to-blue-50/30 border-slate-200 text-slate-800 shadow-xs'
      }`}>
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">
            Olá, {currentUser?.name}! 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Bem-vindo ao <span className="font-semibold text-blue-600 dark:text-blue-400">Access Manager</span>. Gerencie e monitore as credenciais de crédito consignado em tempo real.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
            darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white shadow-xs border border-slate-200'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Planilha Sincronizada
          </span>
          {db.config.googleAppsScriptUrl ? (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500 text-white flex items-center gap-1">
              <CheckCircle2 size={12} />
              Integração Ativa
            </span>
          ) : (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
              <Clock size={12} />
              Modo Simulado
            </span>
          )}
        </div>
      </div>

      {/* Bento Grid layout container */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
        
        {/* Metric Bento Box 1: Logins Cadastrados */}
        <div className={`${cardStyle} xl:col-span-3 flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Logins Cadastrados</p>
              <h3 className="text-3xl font-extrabold mt-2 tracking-tight">{totalLogins}</h3>
            </div>
            <div className="bg-blue-500/10 text-blue-500 p-2.5 rounded-xl">
              <KeyRound size={20} />
            </div>
          </div>
          <button 
            onClick={() => onNavigateToTab('logins')}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-500 dark:text-blue-400 mt-5 hover:underline cursor-pointer group"
          >
            Ver todos logins <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Metric Bento Box 2: Sistemas Ativos */}
        <div className={`${cardStyle} xl:col-span-3 flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Sistemas Ativos</p>
              <h3 className="text-3xl font-extrabold mt-2 tracking-tight">{totalSystems}</h3>
            </div>
            <div className="bg-indigo-500/10 text-indigo-500 p-2.5 rounded-xl">
              <Monitor size={20} />
            </div>
          </div>
          <button 
            onClick={() => onNavigateToTab('systems')}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-500 dark:text-indigo-400 mt-5 hover:underline cursor-pointer group"
          >
            Ver sistemas <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Metric Bento Box 3: Total Convênios */}
        <div className={`${cardStyle} xl:col-span-3 flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Convênios</p>
              <h3 className="text-3xl font-extrabold mt-2 tracking-tight">{totalCovenants}</h3>
            </div>
            <div className="bg-violet-500/10 text-violet-500 p-2.5 rounded-xl">
              <FileText size={20} />
            </div>
          </div>
          <button 
            onClick={() => onNavigateToTab('covenants')}
            className="flex items-center gap-1 text-[11px] font-bold text-violet-500 dark:text-violet-400 mt-5 hover:underline cursor-pointer group"
          >
            Ver convênios <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Metric Bento Box 4: Equipe / Usuários */}
        <div className={`${cardStyle} xl:col-span-3 flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Equipe / Usuários</p>
              <h3 className="text-3xl font-extrabold mt-2 tracking-tight">{totalUsers}</h3>
            </div>
            <div className="bg-emerald-500/10 text-emerald-500 p-2.5 rounded-xl">
              <Users size={20} />
            </div>
          </div>
          <button 
            onClick={() => onNavigateToTab('users')}
            className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 dark:text-emerald-400 mt-5 hover:underline cursor-pointer group"
          >
            Ver equipe <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Status Micro Bento Cards Row - Spans entire width but behaves as modular 4 cards */}
        <div className="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
            darkMode 
              ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}>
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Em Uso</p>
              <h4 className="text-lg font-bold tracking-tight">{loginsInUse}</h4>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
            darkMode 
              ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
              <Unlock size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Livres</p>
              <h4 className="text-lg font-bold tracking-tight">{loginsFree}</h4>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
            darkMode 
              ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Bloqueados</p>
              <h4 className="text-lg font-bold tracking-tight">{loginsBlocked + loginsMaintenance}</h4>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
            darkMode 
              ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Expirando</p>
              <h4 className="text-lg font-bold tracking-tight">{loginsExpiring}</h4>
            </div>
          </div>
        </div>

        {/* Large Bento Card (Row 3): Meus Sistemas Favoritos */}
        <div className={`${cardStyle} col-span-1 md:col-span-2 xl:col-span-8 flex flex-col`}>
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <Star className="text-amber-400 fill-amber-400" size={18} />
              <h3 className="font-display font-extrabold text-base tracking-tight">Meus Sistemas Favoritos</h3>
            </div>
            <button 
              onClick={() => onNavigateToTab('systems')}
              className="text-xs font-bold text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Configurar <ArrowRight size={10} />
            </button>
          </div>

          {userFavorites.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Star size={32} className="text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Nenhum sistema favoritado ainda.</p>
              <button 
                onClick={() => onNavigateToTab('systems')}
                className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ir para Sistemas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              {userFavorites.map(sys => {
                const loginsCount = db.logins.filter(l => l.systemId === sys.id).length;
                const covenant = db.covenants.find(c => c.id === sys.covenantId);
                return (
                  <div 
                    key={sys.id}
                    className={`p-4 rounded-xl border flex justify-between items-center hover:scale-[1.01] transition-all duration-200 ${
                      darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold shrink-0">
                        {sys.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold truncate text-slate-900 dark:text-white">{sys.name}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate mt-0.5">{covenant?.name || 'Convênio'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {loginsCount} {loginsCount === 1 ? 'login' : 'logins'}
                      </span>
                      <button
                        onClick={() => onNavigateToTab('logins', { systemId: sys.id })}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-500 cursor-pointer"
                        title="Acessar Logins"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Bento Card (Row 3): Logins em Uso Agora */}
        <div className={`${cardStyle} col-span-1 md:col-span-2 xl:col-span-4 flex flex-col`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Clock className="text-orange-500" size={18} />
              <h3 className="font-display font-extrabold text-base tracking-tight">Logins em Uso Agora</h3>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400 shrink-0">
              {activeReservations.length} Ativo
            </span>
          </div>

          {activeReservations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <UserCheck size={32} className="text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Nenhum login em uso no momento.</p>
              <p className="text-[10px] text-slate-400/80 mt-1">Todos os operadores estão livres ou desconectados.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 flex-1">
              {activeReservations.map(login => {
                const sys = db.systems.find(s => s.id === login.systemId);
                const cov = db.covenants.find(c => c.id === login.covenantId);
                
                // Compute elapsed minutes
                const elapsedMs = login.reservedAt ? (new Date().getTime() - new Date(login.reservedAt).getTime()) : 0;
                const elapsedMin = Math.floor(elapsedMs / (1000 * 60));

                return (
                  <div 
                    key={login.id}
                    className={`p-3.5 rounded-lg border ${
                      darkMode ? 'bg-slate-800/30 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                    } flex flex-col justify-between gap-2`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-blue-500 dark:text-blue-400">{login.username}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {sys?.name} ({cov?.name})
                        </p>
                      </div>
                      <span className="text-[9px] font-bold bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-md">
                        Em uso
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 border-t pt-2 mt-1 dark:border-slate-800">
                      <span className="truncate">Por: <strong>{login.reservedBy}</strong></span>
                      <span className="flex items-center gap-1 shrink-0 font-medium">
                        <Clock size={10} />
                        {elapsedMin}m atrás
                      </span>
                    </div>
                    
                    {/* Button to let supervisor/admin release */}
                    {['Administrador', 'Supervisor'].includes(currentUser?.role || '') && (
                      <button
                        onClick={() => onRelease(login.id)}
                        className="w-full text-center py-1.5 mt-1.5 text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded border border-red-200/50 cursor-pointer transition-colors"
                      >
                        Forçar Liberação
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Bento Card Left (Row 4): Sistemas mais Utilizados */}
        <div className={`${cardStyle} col-span-1 md:col-span-2 xl:col-span-6 flex flex-col`}>
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-500" />
              <h3 className="font-display font-extrabold text-base tracking-tight">Sistemas em Alta (Acessos)</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Histórico de reservas</span>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {sortedSystemStats.map((item, index) => {
              const percentage = (item.count / maxReservationCount) * 100;
              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-400 dark:text-slate-500">{item.count} {item.count === 1 ? 'reserva' : 'reservas'}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Bento Card Right (Row 4): Atividades Recentes */}
        <div className={`${cardStyle} col-span-1 md:col-span-2 xl:col-span-6 flex flex-col`}>
          <h3 className="font-display font-extrabold text-base mb-4 flex items-center gap-2">
            <Activity size={18} className="text-indigo-500" />
            Atividades Recentes
          </h3>

          {db.historyLogs.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4 flex-1 flex items-center justify-center">Nenhuma atividade registrada.</p>
          ) : (
            <div className="space-y-4 flex-1">
              {db.historyLogs.slice(0, 4).map(log => {
                return (
                  <div key={log.id} className="text-xs flex gap-3 items-start p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                      log.actionType.includes('Criar') ? 'bg-emerald-500' :
                      log.actionType.includes('Excluir') ? 'bg-red-500' :
                      log.actionType.includes('Alterar') ? 'bg-blue-500' :
                      'bg-slate-400'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {log.userName}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5 font-medium">
                        {log.actionType} {log.targetType.toLowerCase()} <span className="font-bold text-slate-600 dark:text-slate-300">"{log.targetName}"</span>
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1">
                        {new Date(log.timestamp).toLocaleString('pt-BR')} • IP: {log.ip}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => onNavigateToTab('history')}
            className="w-full text-center text-xs font-bold text-blue-500 dark:text-blue-400 mt-4 hover:underline cursor-pointer block border-t pt-3 dark:border-slate-800"
          >
            Ver histórico completo
          </button>
        </div>

      </div>
    </div>
  );
}
