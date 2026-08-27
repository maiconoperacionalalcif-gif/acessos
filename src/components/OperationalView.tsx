import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Building2, 
  Landmark, 
  Shield, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  SlidersHorizontal, 
  Building, 
  ChevronRight, 
  Info, 
  MapPin, 
  RefreshCw, 
  X,
  Compass,
  Send,
  PlusCircle,
  Clock,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Sparkles,
  FilePlus2,
  ListFilter
} from 'lucide-react';
import { Covenant, Login, User, AccessRequest, AccessRequestCategory } from '../types';
import { normalizeText, isLoginAssociatedWithCovenant, getLoginCovenantIds } from '../lib/utils';

export interface OperationalViewProps {
  covenants: Covenant[];
  logins: Login[];
  accessRequests?: AccessRequest[];
  currentUser: User | null;
  darkMode: boolean;
  onAdminSwitch?: () => void;
  onSyncGoogleSheets?: () => void;
  isSyncingSheets?: boolean;
  onSaveRequest?: (request: AccessRequest) => Promise<void> | void;
}

export type MainCategory = 'PREFEITURAS' | 'GOVERNOS' | 'FORCAS_ARMADAS' | 'TODOS';

export interface StateInfo {
  uf: string;
  name: string;
  region: string;
}

export const BRAZILIAN_STATES: StateInfo[] = [
  { uf: 'AC', name: 'Acre', region: 'Norte' },
  { uf: 'AL', name: 'Alagoas', region: 'Nordeste' },
  { uf: 'AP', name: 'Amapá', region: 'Norte' },
  { uf: 'AM', name: 'Amazonas', region: 'Norte' },
  { uf: 'BA', name: 'Bahia', region: 'Nordeste' },
  { uf: 'CE', name: 'Ceará', region: 'Nordeste' },
  { uf: 'DF', name: 'Distrito Federal', region: 'Centro-Oeste' },
  { uf: 'ES', name: 'Espírito Santo', region: 'Sudeste' },
  { uf: 'GO', name: 'Goiás', region: 'Centro-Oeste' },
  { uf: 'MA', name: 'Maranhão', region: 'Nordeste' },
  { uf: 'MT', name: 'Mato Grosso', region: 'Centro-Oeste' },
  { uf: 'MS', name: 'Mato Grosso do Sul', region: 'Centro-Oeste' },
  { uf: 'MG', name: 'Minas Gerais', region: 'Sudeste' },
  { uf: 'PA', name: 'Pará', region: 'Norte' },
  { uf: 'PB', name: 'Paraíba', region: 'Nordeste' },
  { uf: 'PR', name: 'Paraná', region: 'Sul' },
  { uf: 'PE', name: 'Pernambuco', region: 'Nordeste' },
  { uf: 'PI', name: 'Piauí', region: 'Nordeste' },
  { uf: 'RJ', name: 'Rio de Janeiro', region: 'Sudeste' },
  { uf: 'RN', name: 'Rio Grande do Norte', region: 'Nordeste' },
  { uf: 'RS', name: 'Rio Grande do Sul', region: 'Sul' },
  { uf: 'RO', name: 'Rondônia', region: 'Norte' },
  { uf: 'RR', name: 'Roraima', region: 'Norte' },
  { uf: 'SC', name: 'Santa Catarina', region: 'Sul' },
  { uf: 'SP', name: 'São Paulo', region: 'Sudeste' },
  { uf: 'SE', name: 'Sergipe', region: 'Nordeste' },
  { uf: 'TO', name: 'Tocantins', region: 'Norte' }
];

const STATE_NAMES_MAP: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá Amapa',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará Ceara',
  DF: 'Distrito Federal Brasília Brasilia',
  ES: 'Espírito Santo Espirito Santo',
  GO: 'Goiás Goias Goiânia Goiania',
  MA: 'Maranhão Maranhao São Luís Sao Luis',
  MT: 'Mato Grosso Cuiabá Cuiaba',
  MS: 'Mato Grosso do Sul Campo Grande',
  MG: 'Minas Gerais Belo Horizonte',
  PA: 'Pará Para Belém Belem',
  PB: 'Paraíba Paraiba João Pessoa Joao Pessoa',
  PR: 'Paraná Parana Curitiba',
  PE: 'Pernambuco Recife',
  PI: 'Piauí Piaui Teresina',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte Natal',
  RS: 'Rio Grande do Sul Porto Alegre',
  RO: 'Rondônia Rondonia Porto Velho',
  RR: 'Roraima Boa Vista',
  SC: 'Santa Catarina Florianópolis Florianopolis',
  SP: 'São Paulo Sao Paulo',
  SE: 'Sergipe Aracaju',
  TO: 'Tocantins Palmas'
};

export default function OperationalView({
  covenants,
  logins,
  accessRequests = [],
  currentUser,
  darkMode,
  onAdminSwitch,
  onSyncGoogleSheets,
  isSyncingSheets = false,
  onSaveRequest
}: OperationalViewProps) {
  // Navigation & Filter State
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('Todos');

  // Interactive State
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Solicitação de Acesso Modal & Drawer State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showMyRequestsModal, setShowMyRequestsModal] = useState(false);
  const [reqCovenantName, setReqCovenantName] = useState('');
  const [reqCategory, setReqCategory] = useState<AccessRequestCategory>('Prefeitura');
  const [reqState, setReqState] = useState('SP');
  const [reqBank, setReqBank] = useState('');
  const [reqObservations, setReqObservations] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Helper to trigger toast
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Submit Access Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqCovenantName.trim()) {
      alert('Por favor, informe o Nome do Convênio.');
      return;
    }
    if (!reqBank.trim()) {
      alert('Por favor, informe o Banco.');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const newRequest: AccessRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        covenantName: reqCovenantName.trim(),
        category: reqCategory,
        state: reqState,
        bank: reqBank.trim(),
        observations: reqObservations.trim() || undefined,
        requestedBy: currentUser?.name || 'Analista Operacional',
        requestedByUserId: currentUser?.id,
        requestedAt: new Date().toISOString(),
        status: 'Pendente'
      };

      if (onSaveRequest) {
        await onSaveRequest(newRequest);
      }
      
      setShowRequestModal(false);
      setReqCovenantName('');
      setReqBank('');
      setReqObservations('');
      setReqCategory('Prefeitura');
      setReqState('SP');
      showToast('Solicitação de acesso enviada com sucesso para a esteira do Administrador!');
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar solicitação.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Recent requests made by or relevant to analyst
  const analystRequests = useMemo(() => {
    return [...accessRequests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }, [accessRequests]);

  const pendingRequestsCount = useMemo(() => {
    return accessRequests.filter(r => r.status === 'Pendente' || r.status === 'Em Andamento').length;
  }, [accessRequests]);

  // Helper to copy text to clipboard
  const handleCopy = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`${label} copiado para a área de transferência!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to copy complete access info
  const handleCopyFullAccess = (covenantName: string, bank: string, username: string, password?: string, managerUrl?: string) => {
    const lines = [
      `Convênio: ${covenantName}`,
      `Banco: ${bank || 'Geral'}`,
      `Usuário: ${username}`,
      password ? `Senha: ${password}` : '',
      managerUrl ? `Gestora: ${managerUrl}` : ''
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    showToast(`Acesso completo de ${bank || covenantName} copiado!`);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Category matching helper (accent-insensitive)
  const matchCategory = (cov: Covenant, cat: MainCategory): boolean => {
    if (cat === 'TODOS') return true;

    const normCat = normalizeText(cov.category);
    const normName = normalizeText(cov.name);
    const normOrgan = normalizeText(cov.organ);
    const normObs = normalizeText(cov.observations);

    if (cat === 'PREFEITURAS') {
      return (
        normCat === 'prefeituras' ||
        normCat === 'municipal' ||
        normName.includes('prefeitura') ||
        normName.includes('pref.') ||
        normName.includes('pm') ||
        normOrgan.includes('prefeitura') ||
        normObs.includes('prefeitura')
      );
    }

    if (cat === 'GOVERNOS') {
      return (
        normCat === 'governos' ||
        normCat === 'estadual' ||
        normName.includes('governo') ||
        normName.includes('gov.') ||
        normName.includes('estado de') ||
        normName.includes('gdf') ||
        normOrgan.includes('governo') ||
        normOrgan.includes('secretaria') ||
        normObs.includes('governo estadual')
      );
    }

    if (cat === 'FORCAS_ARMADAS') {
      return (
        normCat === 'forcas armadas' ||
        normCat === 'forças armadas' ||
        normCat === 'militar' ||
        normCat === 'federal' ||
        normCat === 'inss' ||
        normName.includes('exercito') ||
        normName.includes('exército') ||
        normName.includes('marinha') ||
        normName.includes('aeronautica') ||
        normName.includes('aeronáutica') ||
        normName.includes('fab') ||
        normName.includes('forcas armadas') ||
        normName.includes('defesa') ||
        normName.includes('militar') ||
        normName.includes('cpex') ||
        normName.includes('papem') ||
        normName.includes('dirap') ||
        normName.includes('sougov') ||
        normName.includes('siape')
      );
    }

    return true;
  };

  // Normalize all logins for each covenant
  const getCovenantLoginsList = (cov: Covenant) => {
    const matching = logins.filter(l => isLoginAssociatedWithCovenant(l, cov.id));
    
    // If no logins linked via login table, check direct fields in Covenant
    if (matching.length === 0 && (cov.login || cov.password || cov.bank)) {
      matching.push({
        id: `direct-${cov.id}`,
        covenantId: cov.id,
        systemId: '',
        shop: '',
        username: cov.login || '',
        password: cov.password || '',
        bank: cov.bank || 'Banco Geral',
        cpf: '', pin: '', token: '', email: '', phone: '', responsible: '', observations: '',
        creationDate: '', lastAlteration: '', expirationDate: '', status: 'Ativo'
      });
    } else if (cov.login) {
      // Ensure primary login is also present if not in matching list
      const alreadyIn = matching.some(m => normalizeText(m.username) === normalizeText(cov.login));
      if (!alreadyIn) {
        matching.unshift({
          id: `direct-${cov.id}`,
          covenantId: cov.id,
          systemId: '',
          shop: '',
          username: cov.login,
          password: cov.password || '',
          bank: cov.bank || 'Banco Principal',
          cpf: '', pin: '', token: '', email: '', phone: '', responsible: '', observations: '',
          creationDate: '', lastAlteration: '', expirationDate: '', status: 'Ativo'
        });
      }
    }

    return matching;
  };

  // Count items per category
  const categoryCounts = useMemo(() => {
    return {
      PREFEITURAS: covenants.filter(c => matchCategory(c, 'PREFEITURAS')).length,
      GOVERNOS: covenants.filter(c => matchCategory(c, 'GOVERNOS')).length,
      FORCAS_ARMADAS: covenants.filter(c => matchCategory(c, 'FORCAS_ARMADAS')).length,
      TOTAL: covenants.length
    };
  }, [covenants]);

  // Count items per state for currently selected category
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    BRAZILIAN_STATES.forEach(st => {
      counts[st.uf] = 0;
    });

    const activeCategory = selectedCategory || 'TODOS';
    covenants.forEach(c => {
      if (activeCategory === 'TODOS' || matchCategory(c, activeCategory)) {
        const uf = (c.state || '').toUpperCase().trim();
        if (counts[uf] !== undefined) {
          counts[uf] += 1;
        } else if (uf) {
          counts[uf] = (counts[uf] || 0) + 1;
        }
      }
    });

    return counts;
  }, [covenants, selectedCategory]);

  // List of all distinct banks for filtering
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    logins.forEach(l => {
      if (l.bank && l.bank.trim()) set.add(l.bank.trim());
    });
    covenants.forEach(c => {
      if (c.bank && c.bank.trim()) set.add(c.bank.trim());
    });
    return ['Todos', ...Array.from(set).sort()];
  }, [logins, covenants]);

  // Filtered covenants list based on search (ACCENT-INSENSITIVE), category, state, and bank
  const filteredCovenants = useMemo(() => {
    const term = normalizeText(searchTerm);

    return covenants.filter(cov => {
      const covLogins = getCovenantLoginsList(cov);

      // Search match (Accent-insensitive)
      let matchSearch = true;
      if (term) {
        const normName = normalizeText(cov.name);
        const normState = normalizeText(cov.state);
        const stateUf = (cov.state || '').toUpperCase().trim();
        const normStateExtended = normalizeText(STATE_NAMES_MAP[stateUf] || '');
        const normCity = normalizeText(cov.city);
        const normOrgan = normalizeText(cov.organ);
        const normManager = normalizeText(cov.manager);
        const normManagerUrl = normalizeText(cov.managerUrl);
        const normObs = normalizeText(cov.observations);
        const normCategory = normalizeText(cov.category);

        const loginsMatch = covLogins.some(l => 
          normalizeText(l.username).includes(term) ||
          normalizeText(l.bank).includes(term) ||
          normalizeText(l.responsible).includes(term) ||
          normalizeText(l.observations).includes(term)
        );

        matchSearch = 
          normName.includes(term) ||
          normState.includes(term) ||
          normStateExtended.includes(term) ||
          normCity.includes(term) ||
          normOrgan.includes(term) ||
          normManager.includes(term) ||
          normManagerUrl.includes(term) ||
          normObs.includes(term) ||
          normCategory.includes(term) ||
          loginsMatch;
      }

      if (!matchSearch) return false;

      // If user is searching actively with a search query, search across all categories unless one is selected
      if (term && !selectedCategory) {
        return true;
      }

      // Category match
      if (selectedCategory && !matchCategory(cov, selectedCategory)) {
        return false;
      }

      // State match (if state is selected)
      if (selectedState && selectedState !== 'TODOS') {
        const covState = (cov.state || '').toUpperCase().trim();
        if (covState !== selectedState.toUpperCase()) {
          return false;
        }
      }

      // Bank match
      if (selectedBankFilter !== 'Todos') {
        const normSelectedBank = normalizeText(selectedBankFilter);
        const hasBank = covLogins.some(l => normalizeText(l.bank) === normSelectedBank) ||
          normalizeText(cov.bank) === normSelectedBank;
        if (!hasBank) return false;
      }

      return true;
    });
  }, [covenants, logins, searchTerm, selectedCategory, selectedState, selectedBankFilter]);

  // Bank badge color styling
  const getBankBadgeStyle = (bankName: string) => {
    const b = normalizeText(bankName);
    if (b.includes('brasil') || b.includes('bb')) {
      return darkMode 
        ? 'bg-amber-950/40 text-amber-300 border-amber-800/60' 
        : 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (b.includes('itau')) {
      return darkMode 
        ? 'bg-orange-950/40 text-orange-300 border-orange-800/60' 
        : 'bg-orange-50 text-orange-800 border-orange-200';
    }
    if (b.includes('bradesco')) {
      return darkMode 
        ? 'bg-red-950/40 text-red-300 border-red-800/60' 
        : 'bg-red-50 text-red-800 border-red-200';
    }
    if (b.includes('santander')) {
      return darkMode 
        ? 'bg-rose-950/40 text-rose-300 border-rose-800/60' 
        : 'bg-rose-50 text-rose-800 border-rose-200';
    }
    if (b.includes('caixa')) {
      return darkMode 
        ? 'bg-blue-950/40 text-blue-300 border-blue-800/60' 
        : 'bg-blue-50 text-blue-800 border-blue-200';
    }
    if (b.includes('daycoval') || b.includes('banrisul') || b.includes('safra') || b.includes('brb')) {
      return darkMode 
        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60' 
        : 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    return darkMode 
      ? 'bg-slate-800 text-slate-300 border-slate-700' 
      : 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const handleResetNavigation = () => {
    setSelectedCategory(null);
    setSelectedState(null);
    setSearchTerm('');
    setSelectedBankFilter('Todos');
  };

  const handleSelectCategory = (cat: MainCategory) => {
    setSelectedCategory(cat);
    setSelectedState(null);
    setSearchTerm('');
  };

  // Determine whether results should be displayed:
  // 1. User typed a search term
  // 2. User clicked FORCAS_ARMADAS (shows accesses right away)
  // 3. User clicked PREFEITURAS or GOVERNOS and chose a state (or "TODOS")
  const isSearchActive = searchTerm.trim().length > 0;
  const isCategoryWithStateActive = (selectedCategory === 'PREFEITURAS' || selectedCategory === 'GOVERNOS') && selectedState !== null;
  const isForcasArmadasActive = selectedCategory === 'FORCAS_ARMADAS';
  const shouldShowResults = isSearchActive || isCategoryWithStateActive || isForcasArmadasActive;

  // Compute dynamic contextual header title
  const getResultsTitle = () => {
    if (isSearchActive) {
      return `Resultados da busca por "${searchTerm}"`;
    }
    if (isForcasArmadasActive) {
      return 'Acessos - Forças Armadas';
    }
    if (isCategoryWithStateActive) {
      const catLabel = selectedCategory === 'PREFEITURAS' ? 'Prefeituras' : 'Governos';
      if (selectedState === 'TODOS') {
        return `Todas as ${catLabel}`;
      }
      return `${catLabel} - Estado: ${selectedState}`;
    }
    return 'Acessos';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-950 rounded-xl shadow-2xl border border-slate-700 dark:border-slate-200 animate-slide-up text-sm font-semibold">
          <div className="p-1 rounded-full bg-emerald-500 text-white">
            <Check size={14} />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Welcome / Header Banner for Operational */}
      <div className={`p-6 rounded-2xl border transition-all ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/80 border-slate-800' 
          : 'bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50 border-blue-100/80 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-600 text-white shadow-2xs">
                Painel Operacional
              </span>
              <span className="text-xs text-slate-400">
                Consulta Rápida de Acessos e Senhas
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white">
              Central de Acessos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Localize instantaneamente os usuários, senhas e bancos de cada convênio municipal, estadual e das forças armadas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Abrir solicitação de criação de novo acesso"
            >
              <PlusCircle size={15} />
              <span>Solicitação de Acesso</span>
            </button>

            {analystRequests.length > 0 && (
              <button
                onClick={() => setShowMyRequestsModal(true)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold cursor-pointer transition-colors relative ${
                  darkMode 
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' 
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
                }`}
                title="Ver status e chamados das minhas solicitações"
              >
                <Ticket size={14} className="text-blue-500" />
                <span>Minhas Solicitações</span>
                {pendingRequestsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5" />
                )}
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {analystRequests.length}
                </span>
              </button>
            )}

            {currentUser?.role === 'Administrador' && onAdminSwitch && (
              <button
                onClick={onAdminSwitch}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Alternar para o Painel Completo de Administrador"
              >
                <SlidersHorizontal size={14} />
                <span>Painel Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Big Search Bar (Accent-Insensitive Search) */}
        <div className="mt-6">
          <div className={`relative flex items-center rounded-xl border shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 ${
            darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white border-slate-200'
          }`}>
            <Search size={20} className="absolute left-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Digite para pesquisar (sem se preocupar com acentos): Ex. São Paulo, Goiás, Consiglog, SouGov, Bradesco, Itaú, usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-3.5 pl-12 pr-10 text-sm md:text-base outline-none bg-transparent rounded-xl ${
                darkMode ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'
              }`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Limpar pesquisa"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumbs Navigation (When in Category, State, or Active Search) */}
      {(selectedCategory || selectedState || searchTerm) && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <button
            onClick={handleResetNavigation}
            className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Building2 size={13} />
            <span>Início</span>
          </button>

          {selectedCategory && (
            <>
              <ChevronRight size={12} className="text-slate-400" />
              <button
                onClick={() => {
                  setSelectedState(null);
                }}
                className={`hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer transition-colors ${
                  !selectedState ? 'text-blue-600 dark:text-blue-400 font-bold' : ''
                }`}
              >
                <span>
                  {selectedCategory === 'PREFEITURAS' ? '🏛️ Prefeituras' :
                   selectedCategory === 'GOVERNOS' ? '🏢 Governos Estaduais' :
                   selectedCategory === 'FORCAS_ARMADAS' ? '⚔️ Forças Armadas' : 'Todos'}
                </span>
              </button>
            </>
          )}

          {selectedState && (
            <>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                <MapPin size={12} />
                <span>Estado: {selectedState === 'TODOS' ? 'Todos os Estados' : selectedState}</span>
              </span>
            </>
          )}

          {searchTerm && (
            <>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono">
                Busca: "{searchTerm}"
              </span>
            </>
          )}

          <button
            onClick={handleResetNavigation}
            className="ml-auto text-[11px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <X size={12} />
            <span>Voltar ao início</span>
          </button>
        </div>
      )}

      {/* 3 Main Category Squares (Shown on Home or when changing category) */}
      {!searchTerm && !selectedState && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Categorias Principais
            </h2>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Ver Todas as Categorias
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. PREFEITURAS */}
            <button
              onClick={() => handleSelectCategory('PREFEITURAS')}
              className={`p-6 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedCategory === 'PREFEITURAS'
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-md'
                  : darkMode
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                  darkMode ? 'bg-blue-950/80 text-blue-400 border border-blue-800/40' : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  <Landmark size={28} />
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                  {categoryCounts.PREFEITURAS} {categoryCounts.PREFEITURAS === 1 ? 'convênio' : 'convênios'}
                </span>
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                PREFEITURAS
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Acessos municipais, câmaras e prefeituras organizados por estado.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                <span>Selecionar Estado</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* 2. GOVERNOS */}
            <button
              onClick={() => handleSelectCategory('GOVERNOS')}
              className={`p-6 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedCategory === 'GOVERNOS'
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-md'
                  : darkMode
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                  darkMode ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/40' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                }`}>
                  <Building2 size={28} />
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  {categoryCounts.GOVERNOS} {categoryCounts.GOVERNOS === 1 ? 'convênio' : 'convênios'}
                </span>
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                GOVERNOS
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Governos estaduais, secretarias e portais de servidores estaduais.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <span>Selecionar Estado</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* 3. FORÇAS ARMADAS */}
            <button
              onClick={() => handleSelectCategory('FORCAS_ARMADAS')}
              className={`p-6 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                selectedCategory === 'FORCAS_ARMADAS'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20 shadow-md'
                  : darkMode
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                  darkMode ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                }`}>
                  <Shield size={28} />
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                  {categoryCounts.FORCAS_ARMADAS} {categoryCounts.FORCAS_ARMADAS === 1 ? 'convênio' : 'convênios'}
                </span>
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                FORÇAS ARMADAS
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Exército Brasileiro, Marinha do Brasil, Aeronáutica (FAB) e Defesa.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>Ver Acessos Militares</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

          </div>

          {/* Seção: Solicitação de Acesso */}
          <div className={`mt-4 p-5 rounded-2xl border transition-all ${
            darkMode 
              ? 'bg-gradient-to-r from-slate-900 via-blue-950/20 to-slate-900 border-blue-900/40' 
              : 'bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border-blue-200/80 shadow-xs'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FilePlus2 size={22} />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                      Solicitação de Acesso
                    </h4>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      Esteira Operacional
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Precisa de um convênio ou banco que ainda não foi cadastrado? Encaminhe o pedido para o responsável abrir o chamado.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {analystRequests.length > 0 && (
                  <button
                    onClick={() => setShowMyRequestsModal(true)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      darkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
                    }`}
                  >
                    <Ticket size={14} className="text-blue-500" />
                    <span>Minhas Solicitações ({analystRequests.length})</span>
                  </button>
                )}
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <PlusCircle size={15} />
                  <span>Nova Solicitação</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* State Selector Buttons (When GOVERNOS or PREFEITURAS is active) */}
      {(selectedCategory === 'PREFEITURAS' || selectedCategory === 'GOVERNOS') && (
        <div className={`p-5 rounded-2xl border transition-all ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin size={16} className="text-blue-500" />
                <span>
                  Selecione o Estado ({selectedCategory === 'PREFEITURAS' ? 'Prefeituras' : 'Governos'})
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Clique na sigla do estado para abrir os acessos correspondentes
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedState(selectedState === 'TODOS' ? null : 'TODOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  selectedState === 'TODOS'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Ver Todos os Estados
              </button>
            </div>
          </div>

          {/* Grid of all 27 Brazilian State abbreviations */}
          <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-14 gap-2">
            {BRAZILIAN_STATES.map((state) => {
              const count = stateCounts[state.uf] || 0;
              const isSelected = selectedState === state.uf;
              const hasItems = count > 0;

              return (
                <button
                  key={state.uf}
                  onClick={() => setSelectedState(isSelected ? null : state.uf)}
                  title={`${state.name} (${state.uf}) - ${count} convênio(s)`}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105 z-10'
                      : hasItems
                        ? darkMode
                          ? 'bg-slate-800 border-blue-900/50 text-white hover:border-blue-500 hover:bg-slate-750'
                          : 'bg-blue-50/50 border-blue-200 text-blue-900 hover:bg-blue-100 hover:border-blue-300'
                        : darkMode
                          ? 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                          : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                >
                  <span className="font-display font-extrabold text-sm tracking-wider">
                    {state.uf}
                  </span>
                  <span className={`text-[10px] font-mono font-bold mt-0.5 ${
                    isSelected 
                      ? 'text-blue-100' 
                      : hasItems 
                        ? 'text-blue-600 dark:text-blue-400 font-extrabold' 
                        : 'text-slate-400 dark:text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Helper Card when on Initial Home state (No Category selected & No Search active) */}
      {!shouldShowResults && !selectedCategory && (
        <div className={`p-8 text-center rounded-2xl border ${
          darkMode ? 'bg-slate-900/40 border-slate-800/80 text-slate-400' : 'bg-slate-50/70 border-slate-200/80 text-slate-500'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
            <Compass size={24} />
          </div>
          <h3 className="font-display font-bold text-base text-slate-800 dark:text-slate-200 mb-1">
            Como deseja consultar os acessos?
          </h3>
          <p className="text-xs max-w-md mx-auto text-slate-500 dark:text-slate-400 leading-relaxed">
            Selecione uma das 3 categorias acima (<strong>Prefeituras</strong>, <strong>Governos</strong> ou <strong>Forças Armadas</strong>) ou utilize o campo de busca no topo para pesquisar diretamente por nome, estado ou banco sem se preocupar com acentos.
          </p>
        </div>
      )}

      {/* Helper prompt when category is chosen but state is not yet chosen */}
      {!shouldShowResults && (selectedCategory === 'PREFEITURAS' || selectedCategory === 'GOVERNOS') && selectedState === null && (
        <div className={`p-6 text-center rounded-2xl border ${
          darkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            👆 Selecione um Estado na grade acima para carregar a lista de convênios e senhas correspondentes.
          </p>
        </div>
      )}

      {/* RESULTS LIST: ONLY SHOWN WHEN SEARCHING OR CATEGORY/STATE IS SELECTED */}
      {shouldShowResults && (
        <div className="space-y-4">
          
          {/* Results Header with Bank Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span>{getResultsTitle()}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {filteredCovenants.length} {filteredCovenants.length === 1 ? 'convênio' : 'convênios'}
                </span>
              </h2>
            </div>

            {/* Bank quick filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Filtrar por Banco:</span>
              <select
                value={selectedBankFilter}
                onChange={(e) => setSelectedBankFilter(e.target.value)}
                className={`text-xs py-1.5 px-3 border rounded-lg font-medium cursor-pointer ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {availableBanks.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Covenants & Logins List */}
          {filteredCovenants.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl border ${
              darkMode ? 'bg-slate-900/50 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Search size={22} />
              </div>
              <h4 className="font-display font-bold text-base text-slate-700 dark:text-slate-300 mb-1">
                Nenhum convênio encontrado
              </h4>
              <p className="text-xs max-w-md mx-auto mb-4">
                Não encontramos acessos para os filtros selecionados. Tente buscar por outros termos ou limpar a busca.
              </p>
              <button
                onClick={handleResetNavigation}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Limpar Filtros e Voltar ao Início
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCovenants.map((cov) => {
                const covLogins = getCovenantLoginsList(cov);
                const isGov = matchCategory(cov, 'GOVERNOS');
                const isPref = matchCategory(cov, 'PREFEITURAS');
                const isMil = matchCategory(cov, 'FORCAS_ARMADAS');

                return (
                  <div
                    key={cov.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      darkMode 
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
                        : 'bg-white border-slate-200 shadow-2xs hover:shadow-md'
                    }`}
                  >
                    {/* Covenant Header */}
                    <div className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:flex-wrap md:flex-row md:items-center justify-between gap-3 ${
                      darkMode ? 'bg-slate-850/60 border-slate-800' : 'bg-slate-50/70 border-slate-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl text-white shadow-2xs ${
                          isPref ? 'bg-blue-600' :
                          isGov ? 'bg-indigo-600' :
                          isMil ? 'bg-emerald-600' : 'bg-slate-700'
                        }`}>
                          {isPref ? <Landmark size={20} /> :
                           isGov ? <Building2 size={20} /> :
                           isMil ? <Shield size={20} /> : <Building2 size={20} />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display font-bold text-base md:text-lg text-slate-900 dark:text-white">
                              {cov.name}
                            </h3>
                            {cov.state && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                {cov.state}
                              </span>
                            )}
                            <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                              isPref ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
                              isGov ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' :
                              isMil ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {isPref ? 'Prefeitura' : isGov ? 'Governo Estadual' : isMil ? 'Forças Armadas' : cov.category}
                            </span>
                          </div>

                          {(cov.city || cov.organ) && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {[cov.city, cov.organ].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Manager / Gestora Portal Link */}
                      {(cov.managerUrl || cov.manager) && (
                        <div className="flex items-center gap-2">
                          {cov.managerUrl ? (
                            <a
                              href={cov.managerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 transition-colors"
                              title="Abrir sistema / gestora"
                            >
                              <ExternalLink size={13} />
                              <span>Acessar Gestora {cov.manager ? `(${cov.manager})` : ''}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">
                              Gestora: {cov.manager}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Covenant Observations (if any) */}
                    {cov.observations && (
                      <div className={`px-5 py-2 text-xs border-b flex items-center gap-2 ${
                        darkMode ? 'bg-slate-900/80 border-slate-800 text-slate-400' : 'bg-slate-50/40 border-slate-100 text-slate-500'
                      }`}>
                        <Info size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{cov.observations}</span>
                      </div>
                    )}

                    {/* Users List for this Covenant: Login > Senha > Banco */}
                    <div className="p-4 sm:p-5">
                      <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center justify-between">
                        <span>Usuários e Bancos Vinculados ({covLogins.length})</span>
                        <span className="font-mono text-[10px] lowercase text-slate-400 font-normal">
                          login &gt; senha &gt; banco
                        </span>
                      </div>

                      {covLogins.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                          Nenhum usuário cadastrado especificamente para este convênio.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {covLogins.map((loginItem, idx) => {
                            const loginKey = `login-${loginItem.id || `${cov.id}-${idx}`}`;
                            const isPasswordVisible = !!visiblePasswords[loginKey];

                            return (
                              <div
                                key={loginItem.id || idx}
                                className={`p-3.5 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                                  darkMode 
                                    ? 'bg-slate-800/40 border-slate-800 hover:border-slate-700' 
                                    : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 shadow-2xs'
                                }`}
                              >
                                {/* Columns: 1. Login | 2. Senha | 3. Banco */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 items-center">
                                  
                                  {/* 1. LOGIN / USUÁRIO */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Login / Usuário
                                      </span>
                                      {getLoginCovenantIds(loginItem).length > 1 && (
                                        <span 
                                          className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-100 dark:bg-purple-950/90 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50"
                                          title={`Credencial compartilhada em ${getLoginCovenantIds(loginItem).length} convênios`}
                                        >
                                          Multiconvênio ({getLoginCovenantIds(loginItem).length})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white select-all">
                                        {loginItem.username || 'Sem usuário'}
                                      </span>
                                      {loginItem.username && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(loginItem.username, `user-${loginKey}`, 'Usuário')}
                                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                                          title="Copiar usuário"
                                        >
                                          {copiedId === `user-${loginKey}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* 2. SENHA */}
                                  <div className="space-y-1">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Senha
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white select-all">
                                        {loginItem.password ? (
                                          isPasswordVisible ? loginItem.password : '••••••••'
                                        ) : (
                                          <span className="text-slate-400 font-normal">Sem senha</span>
                                        )}
                                      </span>
                                      {loginItem.password && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility(loginKey)}
                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                            title={isPasswordVisible ? "Ocultar senha" : "Ver senha"}
                                          >
                                            {isPasswordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleCopy(loginItem.password || '', `pass-${loginKey}`, 'Senha')}
                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                                            title="Copiar senha"
                                          >
                                            {copiedId === `pass-${loginKey}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* 3. BANCO A QUAL PERTENCE */}
                                  <div className="space-y-1">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Banco Pertencente
                                    </span>
                                    <div>
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${getBankBadgeStyle(loginItem.bank || 'Banco Geral')}`}>
                                        <Building size={12} />
                                        <span>{loginItem.bank || 'Banco Geral'}</span>
                                      </span>
                                    </div>
                                  </div>

                                </div>

                                {/* Action: Copy Full Access Button */}
                                <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyFullAccess(
                                      cov.name,
                                      loginItem.bank || 'Banco Geral',
                                      loginItem.username,
                                      loginItem.password,
                                      cov.managerUrl
                                    )}
                                    className="w-full lg:w-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                    title="Copiar Usuário + Senha + Banco"
                                  >
                                    <Copy size={12} />
                                    <span>Copiar Acesso</span>
                                  </button>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* MODAL: NOVA SOLICITAÇÃO DE ACESSO (PARA ANALISTAS) */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className="p-5 border-b flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                  <FilePlus2 size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">Solicitação de Acesso</h3>
                  <p className="text-xs text-slate-400">Encaminhar pedido de criação para a esteira administrativa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* 1. NOME DO CONVÊNIO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Nome do Convênio</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prefeitura de Curitiba, Governo de Goiás, Aeronáutica..."
                  value={reqCovenantName}
                  onChange={(e) => setReqCovenantName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* 2. FEDERAL, ESTADUAL OU PREFEITURA */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Esfera / Categoria</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Prefeitura', 'Estadual', 'Federal'] as AccessRequestCategory[]).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setReqCategory(cat)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        reqCategory === cat
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                          : darkMode 
                            ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750' 
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base">
                        {cat === 'Prefeitura' ? '🏛️' : cat === 'Estadual' ? '🏢' : '⚔️'}
                      </span>
                      <span>{cat === 'Prefeitura' ? 'Prefeitura' : cat === 'Estadual' ? 'Estadual' : 'Federal'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. ESTADO (SELECIONÁVEL) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Estado (UF)</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select
                    value={reqState}
                    onChange={(e) => setReqState(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                    }`}
                  >
                    {BRAZILIAN_STATES.map(s => (
                      <option key={s.uf} value={s.uf}>{s.uf} - {s.name} ({s.region})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. BANCO */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>Banco</span>
                    <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Selecione ou digite</span>
                </label>
                
                {/* Fast Bank Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {['Itaú Consignado', 'Banco do Brasil', 'Bradesco Promotora', 'Santander', 'Caixa Econômica', 'Banco Pan', 'Banco Daycoval', 'Banco BMG', 'Banco Safra', 'C6 Consig', 'Banrisul'].map(b => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setReqBank(b)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        reqBank === b
                          ? 'bg-blue-600 text-white border-blue-600'
                          : darkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Landmark size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Digite ou confirme o nome do banco..."
                    value={reqBank}
                    onChange={(e) => setReqBank(e.target.value)}
                    className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* OBSERVAÇÕES ADICIONAIS */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Observações / Motivo</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Novo convênio para atendimento de servidores municipais ativos..."
                  value={reqObservations}
                  onChange={(e) => setReqObservations(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-medium border outline-none resize-none focus:ring-2 focus:ring-blue-500/20 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Informative Notice */}
              <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                darkMode ? 'bg-blue-950/20 border-blue-900/40 text-blue-300' : 'bg-blue-50/70 border-blue-200 text-blue-700'
              }`}>
                <Info size={16} className="shrink-0" />
                <span>
                  O pedido será direcionado para a <strong>Esteira do Administrador</strong>, que fará a solicitação ao responsável e atualizará com o número do chamado.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t flex items-center justify-end gap-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{isSubmittingRequest ? 'Encaminhando...' : 'Encaminhar Pedido'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: MINHAS SOLICITAÇÕES / ACOMPANHAMENTO DE CHAMADOS */}
      {showMyRequestsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-5 border-b flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                  <Ticket size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">Minhas Solicitações de Acesso</h3>
                  <p className="text-xs text-slate-400">Acompanhe o andamento dos pedidos e os números de chamados</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMyRequestsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-3">
              {analystRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Inbox size={36} className="mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-sm">Nenhuma solicitação encontrada</p>
                  <p className="text-xs text-slate-500 mt-0.5">Suas solicitações de acesso aparecerão aqui.</p>
                </div>
              ) : (
                analystRequests.map((req) => {
                  const isPending = req.status === 'Pendente';
                  const isInProgress = req.status === 'Em Andamento';
                  const isCompleted = req.status === 'Concluído';
                  const isRejected = req.status === 'Rejeitado';

                  return (
                    <div 
                      key={req.id}
                      className={`p-4 rounded-xl border transition-all ${
                        darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              {req.category}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                              {req.state}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {new Date(req.requestedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            {req.covenantName}
                          </h4>

                          <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                            Banco: <strong className="text-slate-900 dark:text-white">{req.bank}</strong>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <Clock size={12} />
                              <span>Pendente</span>
                            </span>
                          )}
                          {isInProgress && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                              <Ticket size={12} />
                              <span>Em Andamento</span>
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 size={12} />
                              <span>Concluído</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              <X size={12} />
                              <span>Rejeitado</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ticket Box */}
                      <div className={`mt-3 p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        req.ticketNumber 
                          ? darkMode ? 'bg-blue-950/30 border-blue-800/60' : 'bg-blue-50/80 border-blue-200'
                          : darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Ticket size={14} className={req.ticketNumber ? "text-blue-500" : "text-slate-400"} />
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Número do Chamado</span>
                            <span className={`text-xs font-mono font-bold ${req.ticketNumber ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 italic font-sans text-[11px]'}`}>
                              {req.ticketNumber || 'Aguardando abertura de chamado pelo responsável'}
                            </span>
                          </div>
                        </div>

                        {req.ticketNumber && (
                          <button
                            type="button"
                            onClick={() => handleCopy(req.ticketNumber || '', req.id, 'Número do chamado')}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 cursor-pointer"
                            title="Copiar número do chamado"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>

                      {/* Observations & Admin notes */}
                      {(req.observations || req.adminNotes) && (
                        <div className="mt-2.5 space-y-1.5 text-xs">
                          {req.observations && (
                            <p className="text-[11px] text-slate-500 italic">
                              <strong>Sua observação:</strong> "{req.observations}"
                            </p>
                          )}
                          {req.adminNotes && (
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                              <strong>Retorno do Admin:</strong> {req.adminNotes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <button
                type="button"
                onClick={() => {
                  setShowMyRequestsModal(false);
                  setShowRequestModal(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>Abrir Nova Solicitação</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMyRequestsModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

