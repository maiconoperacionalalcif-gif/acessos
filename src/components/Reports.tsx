import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Printer, 
  TrendingUp, 
  Users, 
  KeyRound, 
  ShieldAlert, 
  Clock,
  FileText,
  Monitor
} from 'lucide-react';
import { FullDatabase } from '../lib/api';
import * as XLSX from 'xlsx';

interface ReportsProps {
  db: FullDatabase;
  darkMode: boolean;
}

export default function Reports({
  db,
  darkMode
}: ReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<'logins' | 'users' | 'systems' | 'covenants'>('logins');

  // Analytical stats
  const today = new Date();

  // 1. Logins analytical counts
  const loginsExpiringSoon = useMemo(() => {
    return db.logins.filter(l => {
      if (!l.expirationDate) return false;
      const exp = new Date(l.expirationDate);
      const diffTime = exp.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    });
  }, [db.logins]);

  const loginsBlocked = useMemo(() => {
    return db.logins.filter(l => l.status === 'Bloqueado');
  }, [db.logins]);

  // 2. Systems usage ranking (calculated from Reservation Logs)
  const systemsStats = useMemo(() => {
    const stats: { [sysId: string]: { name: string; count: number; activeTime: number } } = {};
    
    // Initialize
    db.systems.forEach(s => {
      stats[s.id] = { name: s.name, count: 0, activeTime: 0 };
    });

    db.reservationLogs.forEach(log => {
      const sys = db.systems.find(s => s.name === log.systemName);
      const sysId = sys ? sys.id : 'unknown';
      if (!stats[sysId]) {
        stats[sysId] = { name: log.systemName, count: 0, activeTime: 0 };
      }
      stats[sysId].count += 1;
      stats[sysId].activeTime += log.durationSeconds || 0;
    });

    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [db.reservationLogs, db.systems]);

  // 3. Covenants usage ranking (calculated from Logins under each Covenant and their Reservation count)
  const covenantsStats = useMemo(() => {
    const stats: { [covId: string]: { name: string; category: string; loginsCount: number; reservationCount: number } } = {};
    
    // Initialize
    db.covenants.forEach(c => {
      stats[c.id] = { name: c.name, category: c.category, loginsCount: 0, reservationCount: 0 };
    });

    // Count logins
    db.logins.forEach(login => {
      if (stats[login.covenantId]) {
        stats[login.covenantId].loginsCount += 1;
      }
    });

    // Count reservations
    db.reservationLogs.forEach(log => {
      const login = db.logins.find(l => l.id === log.loginId);
      if (login && stats[login.covenantId]) {
        stats[login.covenantId].reservationCount += 1;
      }
    });

    return Object.values(stats).sort((a, b) => b.reservationCount - a.reservationCount);
  }, [db.reservationLogs, db.covenants, db.logins]);

  // 4. Users activity ranking (calculated from History Logs and Reservations)
  const usersStats = useMemo(() => {
    const stats: { [userId: string]: { name: string; role: string; actionCount: number; reservationCount: number } } = {};
    
    db.users.forEach(u => {
      stats[u.id] = { name: u.name, role: u.role, actionCount: 0, reservationCount: 0 };
    });

    db.historyLogs.forEach(log => {
      if (stats[log.userId]) {
        stats[log.userId].actionCount += 1;
      }
    });

    db.reservationLogs.forEach(log => {
      const user = db.users.find(u => u.name === log.reservedBy);
      if (user && stats[user.id]) {
        stats[user.id].reservationCount += 1;
      }
    });

    return Object.values(stats).sort((a, b) => b.actionCount - a.actionCount);
  }, [db.historyLogs, db.reservationLogs, db.users]);

  // 5. Logins reservation counts
  const loginsUsageStats = useMemo(() => {
    const stats: { [loginId: string]: { username: string; bank: string; system: string; count: number } } = {};

    db.logins.forEach(l => {
      const sys = db.systems.find(s => s.id === l.systemId);
      stats[l.id] = { 
        username: l.username, 
        bank: l.bank, 
        system: sys ? sys.name : 'Outro', 
        count: 0 
      };
    });

    db.reservationLogs.forEach(log => {
      if (stats[log.loginId]) {
        stats[log.loginId].count += 1;
      }
    });

    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [db.reservationLogs, db.logins, db.systems]);

  // Universal exports based on active tab
  const handleExportXls = () => {
    let dataToExport: any[] = [];
    let name = '';

    if (activeReportTab === 'logins') {
      name = 'Logins_Mais_Utilizados';
      dataToExport = loginsUsageStats.map(l => ({
        'Usuário Login': l.username,
        'Banco': l.bank,
        'Sistema Vinculado': l.system,
        'Quantidade de Reservas': l.count
      }));
    } else if (activeReportTab === 'users') {
      name = 'Usuarios_Ativos';
      dataToExport = usersStats.map(u => ({
        'Colaborador': u.name,
        'Cargo/Nível': u.role,
        'Total de Ações no Sistema': u.actionCount,
        'Logins Reservados': u.reservationCount
      }));
    } else if (activeReportTab === 'systems') {
      name = 'Sistemas_Mais_Acessados';
      dataToExport = systemsStats.map(s => ({
        'Sistema': s.name,
        'Quantidade de Acessos': s.count,
        'Tempo Ativo Total (Segundos)': s.activeTime
      }));
    } else if (activeReportTab === 'covenants') {
      name = 'Convenios_Mais_Utilizados';
      dataToExport = covenantsStats.map(c => ({
        'Convênio': c.name,
        'Categoria': c.category,
        'Total de Credenciais': c.loginsCount,
        'Total de Reservas': c.reservationCount
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${name}_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const cardStyle = `p-5 rounded-xl border ${
    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-md' : 'bg-white border-slate-100 text-slate-800 shadow-xs'
  }`;

  return (
    <div className="space-y-6 print:p-0 print:bg-white print:text-black">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Relatórios Analíticos</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Extraia relatórios visuais e estatísticas completas de acessos, segurança, bloqueios e ranking de utilização.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className={`flex items-center gap-2 px-3.5 py-2 border rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
            }`}
          >
            <Printer size={16} />
            <span>Imprimir / PDF</span>
          </button>
          
          <button
            onClick={handleExportXls}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>Exportar XLS</span>
          </button>
        </div>
      </div>

      {/* Grid de Estatísticas Rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <div className={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-orange-500/10 text-orange-500 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Sistema Campeão</p>
              <h4 className="text-sm font-bold truncate max-w-[140px] mt-0.5">{systemsStats[0]?.name || 'Nenhum'}</h4>
            </div>
          </div>
        </div>

        <div className={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-red-500/10 text-red-500 shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Logins Bloqueados</p>
              <h4 className="text-base font-bold mt-0.5">{loginsBlocked.length} contas</h4>
            </div>
          </div>
        </div>

        <div className={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-amber-500/10 text-amber-500 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Contas Expirando</p>
              <h4 className="text-base font-bold mt-0.5">{loginsExpiringSoon.length} senhas</h4>
            </div>
          </div>
        </div>

        <div className={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-blue-500/10 text-blue-500 shrink-0">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Operadores Ativos</p>
              <h4 className="text-base font-bold mt-0.5">{db.users.filter(u => u.status === 'Ativo').length} colaboradores</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Report Switch Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4 text-sm font-semibold print:hidden overflow-x-auto">
        <button
          onClick={() => setActiveReportTab('logins')}
          className={`pb-2 px-1 border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeReportTab === 'logins' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Logins mais Utilizados
        </button>
        <button
          onClick={() => setActiveReportTab('users')}
          className={`pb-2 px-1 border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeReportTab === 'users' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Usuários mais Ativos
        </button>
        <button
          onClick={() => setActiveReportTab('systems')}
          className={`pb-2 px-1 border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeReportTab === 'systems' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Sistemas mais Acessados
        </button>
        <button
          onClick={() => setActiveReportTab('covenants')}
          className={`pb-2 px-1 border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeReportTab === 'covenants' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Convênios mais Requeridos
        </button>
      </div>

      {/* Print-Only Title */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold font-display">{db.config.companyName || 'Access Manager'}</h1>
        <p className="text-sm text-slate-500">Relatório Consolidado de Auditoria e Desempenho Operacional - {new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      {/* Tab Data Render */}
      <div className="space-y-4">
        {activeReportTab === 'logins' && (
          <div className={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={18} className="text-blue-500" />
              <h3 className="font-display font-bold text-base">Ranking de Utilização de Logins</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b uppercase font-bold text-slate-400/80 bg-slate-50/50 dark:bg-slate-800/40 py-2.5">
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Usuário / Credencial</th>
                    <th className="py-2.5 px-4">Banco</th>
                    <th className="py-2.5 px-4">Sistema</th>
                    <th className="py-2.5 px-4 text-right">Reservas Totais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loginsUsageStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">Nenhum log de uso registrado.</td>
                    </tr>
                  ) : (
                    loginsUsageStats.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20">
                        <td className="py-2.5 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{item.username}</td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 font-medium">{item.bank}</td>
                        <td className="py-2.5 px-4 font-semibold text-blue-500">{item.system}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-800 dark:text-slate-100">{item.count} vezes</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReportTab === 'users' && (
          <div className={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-green-500" />
              <h3 className="font-display font-bold text-base">Atividade e Engajamento de Operadores</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b uppercase font-bold text-slate-400/80 bg-slate-50/50 dark:bg-slate-800/40 py-2.5">
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Colaborador</th>
                    <th className="py-2.5 px-4">Cargo / Nível</th>
                    <th className="py-2.5 px-4 text-right">Ações de Auditoria</th>
                    <th className="py-2.5 px-4 text-right">Logins Reservados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usersStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">Nenhum usuário ativo.</td>
                    </tr>
                  ) : (
                    usersStats.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20">
                        <td className="py-2.5 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                        <td className="py-2.5 px-4">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {item.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-600 dark:text-slate-300">{item.actionCount} ações</td>
                        <td className="py-2.5 px-4 text-right font-bold text-blue-500">{item.reservationCount} logins</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReportTab === 'systems' && (
          <div className={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Monitor size={18} className="text-indigo-500" />
              <h3 className="font-display font-bold text-base">Utilização e Produtividade por Sistema</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b uppercase font-bold text-slate-400/80 bg-slate-50/50 dark:bg-slate-800/40 py-2.5">
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Nome do Sistema</th>
                    <th className="py-2.5 px-4 text-right">Quantidade de Reservas</th>
                    <th className="py-2.5 px-4 text-right">Tempo Acumulado de Uso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {systemsStats.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">Nenhum sistema acessado.</td>
                    </tr>
                  ) : (
                    systemsStats.map((item, index) => {
                      const totalMinutes = Math.floor(item.activeTime / 60);
                      const displayTime = totalMinutes > 60 
                        ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                        : `${totalMinutes}m`;

                      return (
                        <tr key={index} className="hover:bg-slate-50/20">
                          <td className="py-2.5 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-700 dark:text-slate-300">{item.count} vezes</td>
                          <td className="py-2.5 px-4 text-right font-bold text-indigo-500">{displayTime}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReportTab === 'covenants' && (
          <div className={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <FileText size={18} className="text-violet-500" />
              <h3 className="font-display font-bold text-base">Análise e Relevância de Convênios</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b uppercase font-bold text-slate-400/80 bg-slate-50/50 dark:bg-slate-800/40 py-2.5">
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Nome do Convênio</th>
                    <th className="py-2.5 px-4">Categoria</th>
                    <th className="py-2.5 px-4 text-right">Contas Cadastradas</th>
                    <th className="py-2.5 px-4 text-right">Acessos Totais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {covenantsStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">Nenhum convênio registrado.</td>
                    </tr>
                  ) : (
                    covenantsStats.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/20">
                        <td className="py-2.5 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-500">{item.category}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-600 dark:text-slate-400">{item.loginsCount} credenciais</td>
                        <td className="py-2.5 px-4 text-right font-bold text-violet-500">{item.reservationCount} reservas</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
