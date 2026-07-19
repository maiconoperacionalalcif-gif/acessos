import React, { useState, useMemo } from 'react';
import { 
  Search as SearchIcon, 
  FileText, 
  Monitor, 
  KeyRound, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ExternalLink,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { Covenant, System, Login, User } from '../types';

interface SearchProps {
  covenants: Covenant[];
  systems: System[];
  logins: Login[];
  currentUser: User | null;
  darkMode: boolean;
  onLogAction: (actionType: 'Visualizar Senha' | 'Copiar Senha' | 'Copiar Usuário' | 'Abrir Sistema', targetId: string, targetName: string) => void;
  onNavigateToTab: (tab: string, filter?: any) => void;
}

export default function Search({
  covenants,
  systems,
  logins,
  currentUser,
  darkMode,
  onLogAction,
  onNavigateToTab
}: SearchProps) {
  const [query, setQuery] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<{ [id: string]: boolean }>({});
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  const copyToClipboard = async (text: string, key: string, action: 'Copiar Senha' | 'Copiar Usuário', targetId: string, targetName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [key]: true });
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 2000);
      onLogAction(action, targetId, targetName);
    } catch (err) {
      console.error(err);
    }
  };

  // Restrict logins based on Operator rights
  const authorizedLogins = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Administrador') return logins;
    return logins.filter(l => {
      const hasCov = currentUser.allowedCovenants.length === 0 || currentUser.allowedCovenants.includes(l.covenantId);
      const hasBank = currentUser.allowedBanks.length === 0 || currentUser.allowedBanks.some(b => l.bank.toLowerCase().includes(b.toLowerCase()));
      return hasCov && hasBank;
    });
  }, [logins, currentUser]);

  // Omni Search Logic across tables
  const results = useMemo(() => {
    if (!query.trim()) return { covenants: [], systems: [], logins: [] };

    const q = query.toLowerCase().trim();

    // Search covenants
    const matchingCovenants = covenants.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      c.organ.toLowerCase().includes(q) ||
      c.manager.toLowerCase().includes(q)
    );

    // Search systems
    const matchingSystems = systems.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );

    // Search logins
    const matchingLogins = authorizedLogins.filter(l => {
      const covName = covenants.find(c => c.id === l.covenantId)?.name.toLowerCase() || '';
      const sysName = systems.find(s => s.id === l.systemId)?.name.toLowerCase() || '';
      return (
        l.username.toLowerCase().includes(q) ||
        l.bank.toLowerCase().includes(q) ||
        l.cpf.toLowerCase().includes(q) ||
        l.shop.toLowerCase().includes(q) ||
        l.responsible.toLowerCase().includes(q) ||
        covName.includes(q) ||
        sysName.includes(q)
      );
    });

    return {
      covenants: matchingCovenants.slice(0, 10),
      systems: matchingSystems.slice(0, 10),
      logins: matchingLogins.slice(0, 15)
    };
  }, [query, covenants, systems, authorizedLogins]);

  const hasResults = results.covenants.length > 0 || results.systems.length > 0 || results.logins.length > 0;

  const blockStyle = `p-4 rounded-xl border ${
    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-md' : 'bg-white border-slate-100 text-slate-800 shadow-xs'
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Pesquisa Inteligente Global</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Faça buscas unificadas e em tempo real em todas as credenciais, convênios, bancos e portais do correspondente.</p>
      </div>

      {/* Massive Search Input */}
      <div className={`relative max-w-3xl mx-auto p-2 rounded-2xl border flex items-center gap-3 ${
        darkMode ? 'bg-slate-900/60 border-slate-800 focus-within:border-blue-500' : 'bg-white border-slate-200/80 focus-within:border-blue-500 shadow-md'
      } transition-all duration-200`}>
        <SearchIcon size={24} className="text-blue-500 ml-2" />
        <input
          type="text"
          autoFocus
          placeholder="Comece a digitar para buscar por Banco, CPF, Usuário, Cidade, Orgão, Responsável..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent border-0 ring-0 focus:ring-0 outline-none text-base font-medium py-2 text-slate-800 dark:text-white placeholder-slate-400"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg mr-1 cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Results Workspace */}
      {!query.trim() ? (
        <div className="text-center py-16">
          <SearchIcon size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-3 animate-pulse" />
          <h4 className="text-sm font-bold text-slate-400 dark:text-slate-500">Aguardando busca...</h4>
          <p className="text-xs text-slate-400/80 max-w-sm mx-auto mt-1">Insira qualquer termo de credencial para realizar varredura completa instantânea.</p>
        </div>
      ) : !hasResults ? (
        <div className="text-center py-16">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Nenhum registro encontrado para "{query}"</p>
          <p className="text-xs text-slate-400 mt-1">Verifique a grafia ou utilize termos menos específicos (ex: digite o banco, categoria ou cidade).</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-5xl mx-auto">
          
          {/* CATEGORY: LOGINS */}
          {results.logins.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <KeyRound size={14} className="text-blue-500" />
                <span>Logins Encontrados ({results.logins.length})</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.logins.map(login => {
                  const sys = systems.find(s => s.id === login.systemId);
                  const cov = covenants.find(c => c.id === login.covenantId);
                  const isRevealed = !!revealedPasswords[login.id];

                  return (
                    <div key={login.id} className={blockStyle}>
                      <div className="flex justify-between items-start mb-2.5">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Banco {login.bank}</span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{login.username}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {sys?.name} • {cov?.name}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          login.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-red-50 text-red-600 dark:bg-red-950/20'
                        }`}>
                          {login.status}
                        </span>
                      </div>

                      <div className="space-y-2 border-t pt-2 mt-2 border-slate-100 dark:border-slate-800 text-xs">
                        {login.cpf && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">CPF:</span>
                            <span className="font-mono">{login.cpf}</span>
                          </div>
                        )}
                        {login.shop && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Loja / Filial:</span>
                            <span className="font-medium text-slate-600 dark:text-slate-300">{login.shop}</span>
                          </div>
                        )}
                        {login.responsible && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Responsável:</span>
                            <span className="text-slate-600 dark:text-slate-300">{login.responsible}</span>
                          </div>
                        )}

                        {/* Copy / Action rail */}
                        <div className="flex items-center justify-between border-t pt-2 mt-2 border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] select-all truncate max-w-[140px]">
                              {isRevealed ? login.password : '••••••••••••'}
                            </span>
                            <button
                              onClick={() => setRevealedPasswords({ ...revealedPasswords, [login.id]: !isRevealed })}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                              title={isRevealed ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(login.username, `${login.id}-user`, 'Copiar Usuário', login.id, login.username)}
                              className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              {copiedStates[`${login.id}-user`] ? 'Copiado!' : 'Copiar Usuário'}
                            </button>
                            <button
                              onClick={() => copyToClipboard(login.password || '', `${login.id}-pass`, 'Copiar Senha', login.id, login.username)}
                              className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              {copiedStates[`${login.id}-pass`] ? 'Copiado!' : 'Copiar Senha'}
                            </button>
                            <button
                              onClick={() => onNavigateToTab('logins', { username: login.username })}
                              className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                            >
                              Gerenciar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CATEGORY: SYSTEMS */}
          {results.systems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <Monitor size={14} className="text-indigo-500" />
                <span>Sistemas Encontrados ({results.systems.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.systems.map(sys => {
                  const cov = covenants.find(c => c.id === sys.covenantId);
                  return (
                    <div key={sys.id} className={blockStyle}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {sys.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-none">{sys.name}</h4>
                            <span className="text-[10px] text-slate-400 mt-0.5 block truncate max-w-[150px]">{cov?.name}</span>
                          </div>
                        </div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${sys.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {sys.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-tight">
                        {sys.description || 'Sem descrição.'}
                      </p>

                      <div className="flex justify-between items-center border-t pt-2 mt-2 border-slate-100 dark:border-slate-800 text-[11px] text-blue-500 font-semibold">
                        {sys.url ? (
                          <a 
                            href={sys.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={() => onLogAction('Abrir Sistema', sys.id, sys.name)}
                            className="hover:underline flex items-center gap-0.5"
                          >
                            <span>Abrir Sistema</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : <span />}
                        <button
                          onClick={() => onNavigateToTab('logins', { systemId: sys.id })}
                          className="hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          Ver logins <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CATEGORY: COVENANTS */}
          {results.covenants.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <FileText size={14} className="text-violet-500" />
                <span>Convênios Encontrados ({results.covenants.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.covenants.map(cov => {
                  return (
                    <div key={cov.id} className={blockStyle}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            cov.category === 'Federal' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20' :
                            cov.category === 'INSS' ? 'bg-orange-50 text-orange-600' :
                            'bg-slate-50 text-slate-600'
                          }`}>{cov.category}</span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 leading-tight">{cov.name}</h4>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{cov.state}</span>
                      </div>

                      <div className="mt-2.5 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {cov.city && (
                          <div className="flex items-center gap-1">
                            <MapPin size={10} className="text-slate-400 shrink-0" />
                            <span>{cov.city}</span>
                          </div>
                        )}
                        {cov.organ && <p className="truncate">Órgão: <strong>{cov.organ}</strong></p>}
                        {cov.manager && <p className="truncate">Gestora: <strong>{cov.manager}</strong></p>}
                      </div>

                      <div className="flex justify-end border-t pt-2 mt-2.5 border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => onNavigateToTab('logins', { covenantId: cov.id })}
                          className="text-[11px] font-semibold text-blue-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          Ver credenciais <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
