import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  FileSpreadsheet, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  EyeOff,
  Settings,
  ExternalLink,
  Copy,
  Check,
  Building,
  Key,
  KeyRound,
  Building2,
  Lock,
  Unlock,
  Wrench,
  Ban,
  Clock,
  UserCheck,
  RefreshCw,
  Landmark,
  Shield,
  Layers,
  ListFilter,
  Sparkles,
  MapPin,
  FilePlus2,
  ArrowRight,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  Upload,
  ShieldAlert,
  GitMerge,
  CheckCircle2
} from 'lucide-react';
import { Covenant, CovenantCategory, Login, System, User, LoginStatus } from '../types';
import { normalizeText, matchesSearch, isLoginAssociatedWithCovenant, getLoginCovenantIds } from '../lib/utils';
import { detectDuplicates, DuplicatesReport } from '../lib/duplicateDetector';
import * as XLSX from 'xlsx';
import { BRAZILIAN_STATES } from './OperationalView';
import { BulkImportModal } from './BulkImportModal';
import { DuplicatesManagerModal } from './DuplicatesManagerModal';

export interface AccessesProps {
  covenants: Covenant[];
  logins: Login[];
  systems?: System[];
  currentUser: User | null;
  darkMode: boolean;
  onSaveCovenant: (covenant: Covenant) => Promise<void> | void;
  onSaveLogin: (login: Login) => Promise<void> | void;
  onDeleteCovenant: (id: string) => Promise<void> | void;
  onDeleteLogin: (id: string) => Promise<void> | void;
  onReserveLogin?: (loginId: string) => void;
  onReleaseLogin?: (loginId: string) => void;
  onLogAction?: (actionType: 'Visualizar Senha' | 'Copiar Senha' | 'Copiar Usuário' | 'Abrir Sistema', targetId: string, targetName: string) => void;
  onSyncGoogleSheets?: () => void;
  isSyncingSheets?: boolean;
}

export interface EditableBankLogin {
  id?: string;
  bank: string;
  username: string;
  password: string;
  systemUrl?: string;
  status?: LoginStatus;
  notes?: string;
}

export default function Accesses({
  covenants,
  logins = [],
  systems = [],
  currentUser,
  darkMode,
  onSaveCovenant,
  onSaveLogin,
  onDeleteCovenant,
  onDeleteLogin,
  onReserveLogin,
  onReleaseLogin,
  onLogAction,
  onSyncGoogleSheets,
  isSyncingSheets = false
}: AccessesProps) {
  const isAdmin = currentUser?.role === 'Administrador';
  const isSupervisor = currentUser?.role === 'Supervisor';
  const canEdit = isAdmin || isSupervisor;
  const canDelete = isAdmin;

  // View Mode: 'covenants' (Visão por Órgão/Convênio) or 'logins' (Visão Detalhada por Credencial)
  const [viewMode, setViewMode] = useState<'covenants' | 'logins'>('covenants');

  // Search & Global Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedState, setSelectedState] = useState<string>('Todos');
  const [selectedBank, setSelectedBank] = useState<string>('Todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('Todos');

  // Copy Feedback & Password Visibility
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [visiblePasswordsMap, setVisiblePasswordsMap] = useState<Record<string, boolean>>({});

  // Sorting
  const [covSortField, setCovSortField] = useState<keyof Covenant>('name');
  const [covSortDir, setCovSortDir] = useState<'asc' | 'desc'>('asc');
  const [loginSortField, setLoginSortField] = useState<keyof Login>('username');
  const [loginSortDir, setLoginSortDir] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  // Modals
  const [isCovenantModalOpen, setIsCovenantModalOpen] = useState(false);
  const [editingCovenant, setEditingCovenant] = useState<Partial<Covenant> | null>(null);
  const [modalBankLogins, setModalBankLogins] = useState<EditableBankLogin[]>([]);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  // Single Login Modal
  const [isSingleLoginModalOpen, setIsSingleLoginModalOpen] = useState(false);
  const [editingSingleLogin, setEditingSingleLogin] = useState<Partial<Login> | null>(null);
  const [singleLoginCovenantId, setSingleLoginCovenantId] = useState<string>('');
  const [singleLoginAdditionalCovenantIds, setSingleLoginAdditionalCovenantIds] = useState<string[]>([]);
  const [covenantPickerSearch, setCovenantPickerSearch] = useState<string>('');

  // Bulk Excel Import Modal (Inclusão em Massa)
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);

  // Duplicates Auditor Modal & Filters
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);

  // Delete Confirmations
  const [covenantToDelete, setCovenantToDelete] = useState<Covenant | null>(null);
  const [loginToDelete, setLoginToDelete] = useState<Login | null>(null);

  // Multi-Selection State (for Admin bulk operations)
  const [selectedCovenantIds, setSelectedCovenantIds] = useState<Set<string>>(new Set());
  const [selectedLoginIds, setSelectedLoginIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteCovenantsModalOpen, setIsBulkDeleteCovenantsModalOpen] = useState(false);
  const [isBulkDeleteLoginsModalOpen, setIsBulkDeleteLoginsModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Selection toggle helpers
  const toggleSelectCovenant = (id: string) => {
    setSelectedCovenantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisibleCovenants = () => {
    const visibleIds = paginatedCovenants.map(c => c.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedCovenantIds.has(id));
    setSelectedCovenantIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const selectAllFilteredCovenants = () => {
    setSelectedCovenantIds(new Set(sortedCovenants.map(c => c.id)));
  };

  const clearCovenantSelection = () => {
    setSelectedCovenantIds(new Set());
  };

  const toggleSelectLogin = (id: string) => {
    setSelectedLoginIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisibleLogins = () => {
    const visibleIds = paginatedLogins.map(l => l.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedLoginIds.has(id));
    setSelectedLoginIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const selectAllFilteredLogins = () => {
    setSelectedLoginIds(new Set(sortedLogins.map(l => l.id)));
  };

  const clearLoginSelection = () => {
    setSelectedLoginIds(new Set());
  };

  // Quick Bank Copy Modal
  const [bankCopyModalCovenant, setBankCopyModalCovenant] = useState<Covenant | null>(null);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Helper to compile logins for a covenant
  const getCovenantLogins = (cov: Covenant): Login[] => {
    const matching = logins.filter(l => isLoginAssociatedWithCovenant(l, cov.id));
    if (cov.login) {
      const exists = matching.some(m => m.username?.toLowerCase() === cov.login?.toLowerCase());
      if (!exists) {
        matching.unshift({
          id: `direct-${cov.id}`,
          covenantId: cov.id,
          covenantIds: [cov.id],
          systemId: '',
          shop: '',
          username: cov.login,
          password: cov.password || '',
          bank: cov.bank || 'Banco Principal',
          cpf: '', pin: '', token: '', email: '', phone: '', responsible: '', observations: cov.observations || '',
          creationDate: '', lastAlteration: '', expirationDate: '', status: (cov.status as LoginStatus) || 'Ativo', reservedBy: '', reservedAt: ''
        });
      }
    }
    return matching;
  };

  // Extract distinct banks list for filters
  const availableBanks = useMemo(() => {
    const set = new Set<string>();
    logins.forEach(l => {
      if (l.bank?.trim()) set.add(l.bank.trim());
    });
    covenants.forEach(c => {
      if (c.bank?.trim()) set.add(c.bank.trim());
    });
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [logins, covenants]);

  // Extract states list for filters
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    covenants.forEach(c => {
      if (c.state?.trim()) set.add(c.state.trim());
    });
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [covenants]);

  // Categories requested: FEDERAL, FORÇAS ARMADAS, ESTADUAL, PREFEITURAS
  const categories: CovenantCategory[] = ['Federal', 'Forças Armadas', 'Estadual', 'Prefeituras'];

  // Handle Copy
  const handleCopyText = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`${label} copiado!`);
    setTimeout(() => setCopiedId(null), 2000);
    if (onLogAction) {
      onLogAction(label.toLowerCase().includes('senha') ? 'Copiar Senha' : 'Copiar Usuário', id, label);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = (id: string, name: string) => {
    const isNowVisible = !visiblePasswordsMap[id];
    setVisiblePasswordsMap(prev => ({ ...prev, [id]: isNowVisible }));
    if (isNowVisible && onLogAction) {
      onLogAction('Visualizar Senha', id, name);
    }
  };

  // Metrics
  const totalCovenants = covenants.length;
  const totalLogins = logins.length;
  const activeLogins = logins.filter(l => l.status === 'Ativo').length;
  const reservedLogins = logins.filter(l => !!l.reservedBy).length;

  // Duplicates Detection Memo
  const duplicatesReport: DuplicatesReport = useMemo(() => {
    return detectDuplicates(covenants, logins);
  }, [covenants, logins]);

  // Filtered Covenants
  const filteredCovenants = useMemo(() => {
    const term = normalizeText(searchTerm);
    return covenants.filter(cov => {
      // If filtering only duplicates
      if (showOnlyDuplicates && !duplicatesReport.duplicateCovenantIdSet.has(cov.id)) {
        return false;
      }

      const covLogins = getCovenantLogins(cov);
      const loginsSearchMatch = covLogins.some(l => 
        matchesSearch(l.username, term) ||
        matchesSearch(l.bank, term) ||
        matchesSearch(l.observations, term)
      );

      const matchSearch = !term || (
        matchesSearch(cov.name, term) ||
        matchesSearch(cov.state, term) ||
        matchesSearch(cov.city, term) ||
        matchesSearch(cov.login, term) ||
        matchesSearch(cov.bank, term) ||
        matchesSearch(cov.managerUrl, term) ||
        matchesSearch(cov.observations, term) ||
        matchesSearch(cov.category, term) ||
        loginsSearchMatch
      );

      const matchCategory = selectedCategory === 'Todos' || cov.category === selectedCategory;
      const matchStatus = selectedStatus === 'Todos' || cov.status === selectedStatus;
      const matchState = selectedState === 'Todos' || cov.state === selectedState;
      const matchBank = selectedBank === 'Todos' || covLogins.some(l => l.bank?.toLowerCase() === selectedBank.toLowerCase()) || (cov.bank && cov.bank.toLowerCase() === selectedBank.toLowerCase());

      return matchSearch && matchCategory && matchStatus && matchState && matchBank;
    });
  }, [covenants, logins, searchTerm, selectedCategory, selectedStatus, selectedState, selectedBank, showOnlyDuplicates, duplicatesReport]);

  // Sorted Covenants
  const sortedCovenants = useMemo(() => {
    return [...filteredCovenants].sort((a, b) => {
      const aVal = a[covSortField] || '';
      const bVal = b[covSortField] || '';
      if (typeof aVal === 'string') {
        return covSortDir === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredCovenants, covSortField, covSortDir]);

  // Paginated Covenants
  const paginatedCovenants = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedCovenants.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedCovenants, currentPage, rowsPerPage]);

  const totalCovPages = Math.ceil(sortedCovenants.length / rowsPerPage) || 1;

  // Filtered Logins (Flat List)
  const filteredLogins = useMemo(() => {
    const term = normalizeText(searchTerm);
    return logins.filter(login => {
      // If filtering only duplicates
      if (showOnlyDuplicates && !duplicatesReport.duplicateLoginIdSet.has(login.id)) {
        return false;
      }

      const linkedCovIds = getLoginCovenantIds(login);
      const linkedCovenants = covenants.filter(c => linkedCovIds.includes(c.id));
      const covNames = linkedCovenants.map(c => c.name).join(' ');
      const covStates = linkedCovenants.map(c => c.state).join(' ');
      const covCategories = linkedCovenants.map(c => c.category).join(' ');

      const matchSearch = !term || (
        matchesSearch(login.username, term) ||
        matchesSearch(login.bank, term) ||
        matchesSearch(login.observations, term) ||
        matchesSearch(covNames, term) ||
        matchesSearch(covStates, term) ||
        matchesSearch(covCategories, term)
      );

      const matchCategory = selectedCategory === 'Todos' || linkedCovenants.some(c => c.category === selectedCategory);
      const matchState = selectedState === 'Todos' || linkedCovenants.some(c => c.state === selectedState);
      const matchBank = selectedBank === 'Todos' || login.bank.toLowerCase() === selectedBank.toLowerCase();
      const matchStatus = selectedStatus === 'Todos' || login.status === selectedStatus;
      const matchAvailability = 
        selectedAvailability === 'Todos' ||
        (selectedAvailability === 'Livre' && !login.reservedBy) ||
        (selectedAvailability === 'Reservado' && !!login.reservedBy);

      return matchSearch && matchCategory && matchState && matchBank && matchStatus && matchAvailability;
    });
  }, [logins, covenants, searchTerm, selectedCategory, selectedState, selectedBank, selectedStatus, selectedAvailability, showOnlyDuplicates, duplicatesReport]);

  // Sorted Logins
  const sortedLogins = useMemo(() => {
    return [...filteredLogins].sort((a, b) => {
      const aVal = a[loginSortField] || '';
      const bVal = b[loginSortField] || '';
      if (typeof aVal === 'string') {
        return loginSortDir === 'asc' 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredLogins, loginSortField, loginSortDir]);

  // Paginated Logins
  const paginatedLogins = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedLogins.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedLogins, currentPage, rowsPerPage]);

  const totalLoginPages = Math.ceil(sortedLogins.length / rowsPerPage) || 1;

  // Open Unified New Covenant & Logins Modal
  const openNewCovenantModal = () => {
    const newCov: Partial<Covenant> = {
      id: `cov-${Date.now()}`,
      name: '',
      category: 'Federal',
      state: 'SP',
      login: '',
      password: '',
      bank: '',
      managerUrl: '',
      observations: '',
      status: 'Ativo'
    };
    setEditingCovenant(newCov);
    setModalBankLogins([
      { bank: 'Itaú Consignado', username: '', password: '', status: 'Ativo' }
    ]);
    setShowModalPassword(false);
    setIsCovenantModalOpen(true);
  };

  // Open Edit Covenant & Logins Modal
  const openEditCovenantModal = (cov: Covenant) => {
    // Map category if needed
    let matchedCategory: CovenantCategory = cov.category || 'Federal';
    if (matchedCategory === 'Municipal') matchedCategory = 'Prefeituras';
    if (matchedCategory === 'Governos') matchedCategory = 'Estadual';
    if (matchedCategory === 'Militar') matchedCategory = 'Forças Armadas';

    setEditingCovenant({ ...cov, category: matchedCategory });
    const existingLogins = getCovenantLogins(cov);
    if (existingLogins.length > 0) {
      setModalBankLogins(existingLogins.map(l => ({
        id: l.id,
        bank: l.bank || cov.bank || 'Banco do Brasil',
        username: l.username || cov.login || '',
        password: l.password || cov.password || '',
        status: l.status || 'Ativo',
        notes: l.observations || ''
      })));
    } else {
      setModalBankLogins([
        { bank: cov.bank || 'Itaú Consignado', username: cov.login || '', password: cov.password || '', status: 'Ativo' }
      ]);
    }
    setShowModalPassword(false);
    setIsCovenantModalOpen(true);
  };

  // Save Unified Covenant + Multi Logins
  const handleSaveUnifiedAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCovenant?.name?.trim()) {
      alert('Por favor, informe o Nome do Convênio.');
      return;
    }

    setIsSavingAccess(true);
    try {
      const primaryLogin = modalBankLogins[0];
      const isFederalOrForces = editingCovenant.category === 'Federal' || editingCovenant.category === 'Forças Armadas';
      const covenantData: Covenant = {
        id: editingCovenant.id || `cov-${Date.now()}`,
        name: editingCovenant.name.trim(),
        category: editingCovenant.category || 'Federal',
        state: isFederalOrForces ? '' : (editingCovenant.state || 'SP'),
        city: editingCovenant.city || '',
        managerUrl: editingCovenant.managerUrl?.trim() || '',
        observations: editingCovenant.observations?.trim() || '',
        status: editingCovenant.status || 'Ativo',
        login: primaryLogin?.username?.trim() || editingCovenant.login || '',
        password: primaryLogin?.password?.trim() || editingCovenant.password || '',
        bank: primaryLogin?.bank?.trim() || editingCovenant.bank || ''
      };

      await onSaveCovenant(covenantData);

      // Save each bank login associated with this covenant
      for (const item of modalBankLogins) {
        if (item.username?.trim() || item.password?.trim() || item.bank?.trim()) {
          const isDirect = item.id?.startsWith('direct-');
          const existingLogin = item.id ? logins.find(l => l.id === item.id) : null;
          const existingIds = existingLogin ? getLoginCovenantIds(existingLogin) : [];
          const mergedCovIds = Array.from(new Set([...existingIds, covenantData.id]));

          const loginData: Login = {
            id: (item.id && !isDirect) ? item.id : `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            covenantId: existingLogin?.covenantId || covenantData.id,
            covenantIds: mergedCovIds,
            systemId: existingLogin?.systemId || '',
            shop: existingLogin?.shop || '',
            username: item.username?.trim() || '',
            password: item.password?.trim() || '',
            bank: item.bank?.trim() || 'Banco Geral',
            cpf: existingLogin?.cpf || '',
            pin: existingLogin?.pin || '',
            token: existingLogin?.token || '',
            email: existingLogin?.email || '',
            phone: existingLogin?.phone || '',
            responsible: currentUser?.name || 'Administrador',
            observations: item.notes?.trim() || existingLogin?.observations || '',
            creationDate: existingLogin?.creationDate || new Date().toISOString().split('T')[0],
            lastAlteration: new Date().toISOString().split('T')[0],
            expirationDate: existingLogin?.expirationDate || '',
            status: item.status || existingLogin?.status || 'Ativo',
            reservedBy: existingLogin?.reservedBy || '',
            reservedAt: existingLogin?.reservedAt || ''
          };
          await onSaveLogin(loginData);
        }
      }

      setIsCovenantModalOpen(false);
      showToast('Acesso salvo com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar acesso.');
    } finally {
      setIsSavingAccess(false);
    }
  };

  // Open Single Login Modal
  const openNewSingleLoginModal = (covenantId?: string) => {
    const defaultCovId = covenantId || covenants[0]?.id || '';
    setSingleLoginCovenantId(defaultCovId);
    setSingleLoginAdditionalCovenantIds([]);
    setCovenantPickerSearch('');
    setEditingSingleLogin({
      id: `log-${Date.now()}`,
      covenantId: defaultCovId,
      covenantIds: [defaultCovId],
      systemId: '',
      bank: 'Itaú Consignado',
      username: '',
      password: '',
      status: 'Ativo',
      observations: ''
    });
    setIsSingleLoginModalOpen(true);
  };

  const openEditSingleLoginModal = (login: Login) => {
    const allIds = getLoginCovenantIds(login);
    const primaryId = login.covenantId || allIds[0] || covenants[0]?.id || '';
    const additionals = allIds.filter(id => id !== primaryId);
    setSingleLoginCovenantId(primaryId);
    setSingleLoginAdditionalCovenantIds(additionals);
    setCovenantPickerSearch('');
    setEditingSingleLogin({ ...login, covenantIds: allIds });
    setIsSingleLoginModalOpen(true);
  };

  // Save Single Login
  const handleSaveSingleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSingleLogin?.username?.trim()) {
      alert('Por favor, informe o Usuário do login.');
      return;
    }
    if (!editingSingleLogin?.bank?.trim()) {
      alert('Por favor, selecione ou digite o Banco.');
      return;
    }

    try {
      const allAssociatedCovIds = Array.from(new Set([singleLoginCovenantId, ...singleLoginAdditionalCovenantIds])).filter(Boolean);
      const fullLogin: Login = {
        id: editingSingleLogin.id || `log-${Date.now()}`,
        covenantId: singleLoginCovenantId || allAssociatedCovIds[0] || '',
        covenantIds: allAssociatedCovIds,
        systemId: editingSingleLogin.systemId || '',
        shop: editingSingleLogin.shop || '',
        username: editingSingleLogin.username.trim(),
        password: editingSingleLogin.password?.trim() || '',
        bank: editingSingleLogin.bank.trim(),
        cpf: editingSingleLogin.cpf || '',
        pin: editingSingleLogin.pin || '',
        token: editingSingleLogin.token || '',
        email: editingSingleLogin.email || '',
        phone: editingSingleLogin.phone || '',
        responsible: currentUser?.name || 'Administrador',
        observations: editingSingleLogin.observations || '',
        creationDate: editingSingleLogin.creationDate || new Date().toISOString().split('T')[0],
        lastAlteration: new Date().toISOString().split('T')[0],
        expirationDate: editingSingleLogin.expirationDate || '',
        status: editingSingleLogin.status || 'Ativo',
        reservedBy: editingSingleLogin.reservedBy || '',
        reservedAt: editingSingleLogin.reservedAt || ''
      };

      await onSaveLogin(fullLogin);
      setIsSingleLoginModalOpen(false);
      showToast('Credencial salva com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar credencial.');
    }
  };

  // Delete Covenant Handler
  const confirmDeleteCovenant = async () => {
    if (!covenantToDelete) return;
    try {
      await onDeleteCovenant(covenantToDelete.id);
      // Also delete connected logins
      const attachedLogins = logins.filter(l => l.covenantId === covenantToDelete.id);
      for (const l of attachedLogins) {
        await onDeleteLogin(l.id);
      }
      setCovenantToDelete(null);
      showToast('Acesso excluído com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir acesso.');
    }
  };

  // Delete Login Handler
  const confirmDeleteLogin = async () => {
    if (!loginToDelete) return;
    try {
      await onDeleteLogin(loginToDelete.id);
      setLoginToDelete(null);
      showToast('Credencial excluída com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir credencial.');
    }
  };

  // Bulk Delete Covenants Handler
  const confirmBulkDeleteCovenants = async () => {
    if (selectedCovenantIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      const ids = Array.from(selectedCovenantIds);
      for (const id of ids) {
        await onDeleteCovenant(id);
        // Also delete connected logins
        const attachedLogins = logins.filter(l => l.covenantId === id);
        for (const l of attachedLogins) {
          await onDeleteLogin(l.id);
        }
      }
      setSelectedCovenantIds(new Set());
      setIsBulkDeleteCovenantsModalOpen(false);
      showToast(`${ids.length} convênio(s) excluído(s) com sucesso!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir convênios selecionados.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Bulk Delete Logins Handler
  const confirmBulkDeleteLogins = async () => {
    if (selectedLoginIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      const ids = Array.from(selectedLoginIds);
      for (const id of ids) {
        await onDeleteLogin(id);
      }
      setSelectedLoginIds(new Set());
      setIsBulkDeleteLoginsModalOpen(false);
      showToast(`${ids.length} credencial(is) excluída(s) com sucesso!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir credenciais selecionadas.');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const exportRows: any[] = [];
    
    covenants.forEach(cov => {
      const covLogins = getCovenantLogins(cov);
      if (covLogins.length > 0) {
        covLogins.forEach(l => {
          exportRows.push({
            'Convênio / Órgão': cov.name,
            'Categoria / Esfera': cov.category,
            'UF': cov.state,
            'Cidade': cov.city || '',
            'Banco': l.bank,
            'Usuário / Login': l.username,
            'Senha': l.password,
            'Status': l.status,
            'Reservado Por': l.reservedBy || 'Livre',
            'Portal / Link Gestor': cov.managerUrl || '',
            'Observações': l.observations || cov.observations || ''
          });
        });
      } else {
        exportRows.push({
          'Convênio / Órgão': cov.name,
          'Categoria / Esfera': cov.category,
          'UF': cov.state,
          'Cidade': cov.city || '',
          'Banco': cov.bank || 'Não especificado',
          'Usuário / Login': cov.login || '',
          'Senha': cov.password || '',
          'Status': cov.status,
          'Reservado Por': 'Livre',
          'Portal / Link Gestor': cov.managerUrl || '',
          'Observações': cov.observations || ''
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Acessos e Logins');
    XLSX.writeFile(workbook, `Acessos_Alcif_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Planilha de Acessos exportada com sucesso!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 dark:border-slate-300 animate-bounce">
          <Check size={16} className="text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Fast Metric Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
        darkMode 
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border-slate-800 text-slate-100 shadow-md' 
          : 'bg-gradient-to-r from-white via-blue-50/20 to-indigo-50/30 border-slate-200 text-slate-900 shadow-xs'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <KeyRound size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">
                Gestão de Acessos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerencie convênios, prefeituras, órgãos e suas respectivas credenciais e logins bancários em um único painel.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canEdit && duplicatesReport.hasDuplicates && (
            <button
              onClick={() => setIsDuplicatesModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer animate-pulse"
              title="Central de auditoria e resolução de duplicidades"
            >
              <ShieldAlert size={15} />
              <span>Auditar Duplicados ({duplicatesReport.totalRedundantItems})</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              darkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
            }`}
            title="Exportar base completa para Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Exportar Excel</span>
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => setIsBulkImportModalOpen(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs ${
                  darkMode 
                    ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50' 
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
                title="Inclusão e importação de acessos em massa via planilha Excel"
              >
                <Upload size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>+ Inclusão em Massa (Excel)</span>
              </button>

              <button
                onClick={() => openNewSingleLoginModal()}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  darkMode ? 'border-blue-800 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
                title="Adicionar apenas uma credencial a um convênio existente"
              >
                <Key size={14} />
                <span>+ Novo Login</span>
              </button>

              <button
                onClick={openNewCovenantModal}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Cadastrar novo convênio e suas credenciais bancárias"
              >
                <Plus size={16} />
                <span>+ Novo Acesso / Convênio</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Admin Duplicates Alert Banner */}
      {canEdit && duplicatesReport.hasDuplicates && (
        <div className={`p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
          darkMode 
            ? 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-rose-950/40 border-amber-800/60 text-slate-100 shadow-md' 
            : 'bg-gradient-to-r from-amber-50 via-white to-rose-50/50 border-amber-200 text-slate-900 shadow-xs'
        }`}>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0 mt-0.5">
              <ShieldAlert size={22} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-display font-bold text-amber-950 dark:text-amber-200">
                  Alerta Admin: {duplicatesReport.totalRedundantItems} item(s) duplicados detectados
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase border border-amber-500/30">
                  Auditoria de Base
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Foram identificados <strong>{duplicatesReport.duplicateLogins.length} grupo(s) de credenciais repetidas</strong> ({duplicatesReport.redundantLoginsCount} excedentes) e <strong>{duplicatesReport.duplicateCovenants.length} convênio(s) com mesmo nome e UF</strong> ({duplicatesReport.redundantCovenantsCount} excedentes).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setShowOnlyDuplicates(prev => !prev);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                showOnlyDuplicates
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : darkMode 
                    ? 'border-amber-800/80 bg-slate-850 hover:bg-slate-800 text-amber-300' 
                    : 'border-amber-300 bg-white hover:bg-amber-100 text-amber-900 shadow-2xs'
              }`}
            >
              {showOnlyDuplicates ? '✓ Mostrando Apenas Duplicados' : 'Filtrar Duplicados na Tela'}
            </button>

            <button
              onClick={() => setIsDuplicatesModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Sparkles size={14} />
              <span>Auditar e Limpar ({duplicatesReport.totalRedundantItems})</span>
            </button>
          </div>
        </div>
      )}

      {/* Metrics Bar & View Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Metric Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            darkMode ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
          }`}>
            <Building size={14} className="text-blue-500" />
            <span>Convênios: <strong className="text-slate-900 dark:text-white">{totalCovenants}</strong></span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            darkMode ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
          }`}>
            <KeyRound size={14} className="text-indigo-500" />
            <span>Credenciais / Logins: <strong className="text-slate-900 dark:text-white">{totalLogins}</strong></span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            darkMode ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
          }`}>
            <Unlock size={14} className="text-emerald-500" />
            <span>Livres: <strong className="text-slate-900 dark:text-white">{activeLogins - reservedLogins}</strong></span>
          </div>

          {reservedLogins > 0 && (
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              darkMode ? 'bg-amber-950/30 border-amber-900/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <Lock size={14} className="text-amber-500" />
              <span>Em Uso / Reservados: <strong>{reservedLogins}</strong></span>
            </div>
          )}

          {duplicatesReport.totalRedundantItems > 0 && (
            <button
              onClick={() => {
                setShowOnlyDuplicates(prev => !prev);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                showOnlyDuplicates
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs font-bold'
                  : darkMode ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/40' : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 shadow-2xs'
              }`}
              title="Filtrar para ver apenas convênios e credenciais repetidas"
            >
              <ShieldAlert size={14} className="text-amber-500" />
              <span>Duplicados: <strong>{duplicatesReport.totalRedundantItems}</strong></span>
              {showOnlyDuplicates && <span className="text-[10px] underline">ativo</span>}
            </button>
          )}
        </div>

        {/* View Mode Switch Tabs */}
        <div className={`p-1 rounded-xl border flex items-center self-start lg:self-auto ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <button
            onClick={() => { setViewMode('covenants'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'covenants'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 size={14} />
            <span>Por Convênio / Órgão</span>
          </button>

          <button
            onClick={() => { setViewMode('logins'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'logins'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <KeyRound size={14} />
            <span>Todas as Credenciais</span>
          </button>
        </div>
      </div>

      {/* Smart Multi-Filter Toolbar */}
      <div className={`p-4 rounded-2xl border space-y-3 transition-all ${
        darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por convênio, prefeitura, banco, usuário, observação ou UF..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className={`w-full pl-10 pr-9 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                darkMode ? 'bg-slate-800/80 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
              }`}
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Clean Filters Button if applied */}
          {(selectedCategory !== 'Todos' || selectedState !== 'Todos' || selectedBank !== 'Todos' || selectedStatus !== 'Todos' || selectedAvailability !== 'Todos' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCategory('Todos');
                setSelectedState('Todos');
                setSelectedBank('Todos');
                setSelectedStatus('Todos');
                setSelectedAvailability('Todos');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t dark:border-slate-800">
          {/* Categoria / Esfera */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Esfera / Categoria</label>
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="Todos">Todas as Esferas</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Estado (UF) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estado (UF)</label>
            <select
              value={selectedState}
              onChange={(e) => { setSelectedState(e.target.value); setCurrentPage(1); }}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="Todos">Todos os Estados</option>
              {availableStates.filter(s => s !== 'Todos').map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Banco */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Banco</label>
            <select
              value={selectedBank}
              onChange={(e) => { setSelectedBank(e.target.value); setCurrentPage(1); }}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="Todos">Todos os Bancos</option>
              {availableBanks.filter(b => b !== 'Todos').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Bloqueado">Bloqueado</option>
              <option value="Em manutenção">Em manutenção</option>
            </select>
          </div>

          {/* Disponibilidade (Livre / Reservado) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Disponibilidade</label>
            <select
              value={selectedAvailability}
              onChange={(e) => { setSelectedAvailability(e.target.value); setCurrentPage(1); }}
              className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="Todos">Todas</option>
              <option value="Livre">Livres para Uso</option>
              <option value="Reservado">Em Uso / Reservados</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: VISÃO POR CONVÊNIO / ÓRGÃO (AGRUPADA COM CREDENCIAIS BANCÁRIAS)  */}
      {/* ========================================================================= */}
      {viewMode === 'covenants' && (
        <div className="space-y-4">
          {/* Selection & Bulk Actions Control Bar (when canDelete) */}
          {canDelete && sortedCovenants.length > 0 && (
            <div className={`p-3 px-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-semibold ${
              darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={paginatedCovenants.length > 0 && paginatedCovenants.every(c => selectedCovenantIds.has(c.id))}
                    onChange={toggleSelectAllVisibleCovenants}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    Selecionar página atual ({paginatedCovenants.length})
                  </span>
                </label>

                {selectedCovenantIds.size > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      {selectedCovenantIds.size} selecionado(s)
                    </span>
                    {selectedCovenantIds.size < sortedCovenants.length && (
                      <button
                        onClick={selectAllFilteredCovenants}
                        className="text-blue-600 dark:text-blue-400 underline font-bold cursor-pointer hover:opacity-80"
                      >
                        Selecionar todos os {sortedCovenants.length} convênios filtrados
                      </button>
                    )}
                    <button
                      onClick={clearCovenantSelection}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                    >
                      Desmarcar todos
                    </button>
                  </>
                )}
              </div>

              {selectedCovenantIds.size > 0 && (
                <button
                  onClick={() => setIsBulkDeleteCovenantsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
                >
                  <Trash2 size={14} />
                  <span>Excluir Selecionados ({selectedCovenantIds.size})</span>
                </button>
              )}
            </div>
          )}

          {sortedCovenants.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl border ${
              darkMode ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <Building2 size={40} className="mx-auto mb-3 opacity-40 text-blue-500" />
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">Nenhum acesso / convênio encontrado</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Tente ajustar os termos de pesquisa ou filtros de esfera, estado e banco.
              </p>
              {canEdit && (
                <button
                  onClick={openNewCovenantModal}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  + Cadastrar Novo Acesso
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedCovenants.map((cov) => {
                const covLogins = getCovenantLogins(cov);
                const isSphereFederal = cov.category === 'Federal' || cov.category === 'Militar';
                const isSphereState = cov.category === 'Estadual';
                const isSelected = selectedCovenantIds.has(cov.id);

                return (
                  <div
                    key={cov.id}
                    className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:shadow-md ${
                      isSelected
                        ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/10 dark:bg-blue-950/20 shadow-md'
                        : darkMode ? 'bg-slate-900 border-slate-800/90 text-white hover:border-slate-700' : 'bg-white border-slate-200/90 text-slate-900 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    {/* Card Header */}
                    <div className={`p-4 border-b transition-colors ${
                      isSelected 
                        ? 'bg-blue-50/40 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900' 
                        : 'dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        {canDelete && (
                          <div className="pt-0.5 shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCovenant(cov.id)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                              title="Selecionar para exclusão"
                            />
                          </div>
                        )}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              isSphereFederal 
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : isSphereState
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {cov.category}
                            </span>
                            {cov.state && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {cov.state}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              cov.status === 'Ativo' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {cov.status}
                            </span>
                            {duplicatesReport.duplicateCovenantIdSet.has(cov.id) && (
                              <button
                                onClick={() => setIsDuplicatesModalOpen(true)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Convênio com mesmo nome e UF duplicado no sistema. Clique para auditar."
                              >
                                <AlertTriangle size={10} />
                                <span>Nome Repetido</span>
                              </button>
                            )}
                          </div>

                          <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white truncate" title={cov.name}>
                            {cov.name}
                          </h3>
                        </div>

                        {/* Actions Menu */}
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <button
                              onClick={() => openEditCovenantModal(cov)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title="Editar Acesso e Logins"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setCovenantToDelete(cov)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              title="Excluir Acesso"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {cov.managerUrl && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <a
                            href={cov.managerUrl.startsWith('http') ? cov.managerUrl : `https://${cov.managerUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <ExternalLink size={12} />
                            <span>Acessar Portal Gestor</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Attached Bank Credentials List */}
                    <div className="p-4 space-y-2.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Credenciais por Banco ({covLogins.length})
                        </span>
                        {canEdit && (
                          <button
                            onClick={() => openNewSingleLoginModal(cov.id)}
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <Plus size={12} />
                            <span>Adicionar Banco</span>
                          </button>
                        )}
                      </div>

                      {covLogins.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 italic">
                          Nenhum login cadastrado para este convênio.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {covLogins.map((l, idx) => {
                            const isPassVisible = !!visiblePasswordsMap[l.id];
                            return (
                              <div
                                key={l.id || idx}
                                className={`p-2.5 rounded-xl border text-xs transition-all ${
                                  darkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200/80'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 truncate">
                                      <Landmark size={12} className="text-blue-500 shrink-0" />
                                      <span className="truncate">{l.bank || 'Banco Geral'}</span>
                                    </span>
                                    {duplicatesReport.duplicateLoginIdSet.has(l.id) && (
                                      <button
                                        onClick={() => setIsDuplicatesModalOpen(true)}
                                        className="px-1.5 py-0.2 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] flex items-center gap-0.5 cursor-pointer shrink-0 transition-colors"
                                        title="Credencial repetida no mesmo convênio e banco. Clique para auditar."
                                      >
                                        <AlertTriangle size={9} />
                                        <span>Repetida</span>
                                      </button>
                                    )}
                                  </div>
                                  
                                  {l.reservedBy ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                      Em uso: {l.reservedBy}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      Livre
                                    </span>
                                  )}
                                </div>

                                {/* User & Pass Row */}
                                <div className="grid grid-cols-2 gap-2 mt-1.5">
                                  {/* User */}
                                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750">
                                    <div className="min-w-0 pr-1">
                                      <span className="text-[9px] font-bold uppercase text-slate-400 block">Usuário</span>
                                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate block">
                                        {l.username || '-'}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleCopyText(l.username, `u-${l.id}`, 'Usuário')}
                                      className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer"
                                      title="Copiar Usuário"
                                    >
                                      {copiedId === `u-${l.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                    </button>
                                  </div>

                                  {/* Password */}
                                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750">
                                    <div className="min-w-0 pr-1">
                                      <span className="text-[9px] font-bold uppercase text-slate-400 block">Senha</span>
                                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate block">
                                        {isPassVisible ? (l.password || '-') : (l.password ? '••••••••' : '-')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={() => togglePasswordVisibility(l.id, `${cov.name} - ${l.bank}`)}
                                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        title={isPassVisible ? "Ocultar senha" : "Ver senha"}
                                      >
                                        {isPassVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                      </button>
                                      <button
                                        onClick={() => handleCopyText(l.password, `p-${l.id}`, 'Senha')}
                                        className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer"
                                        title="Copiar Senha"
                                      >
                                        {copiedId === `p-${l.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {l.observations && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 italic line-clamp-1">
                                    {l.observations}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    {cov.observations && (
                      <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-850/80 border-t dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="font-semibold">Obs:</span>
                        <span className="truncate">{cov.observations}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls for Covenants */}
          {totalCovPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t dark:border-slate-800 text-xs">
              <span className="text-slate-500">
                Mostrando {(currentPage - 1) * rowsPerPage + 1} a {Math.min(currentPage * rowsPerPage, sortedCovenants.length)} de {sortedCovenants.length} convênios
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 border rounded-lg font-semibold cursor-pointer disabled:opacity-40 ${
                    darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold">
                  {currentPage} / {totalCovPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalCovPages))}
                  disabled={currentPage === totalCovPages}
                  className={`px-3 py-1.5 border rounded-lg font-semibold cursor-pointer disabled:opacity-40 ${
                    darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: VISÃO TODAS AS CREDENCIAIS / LOGINS (TABELA COMPLETA E DETALHADA) */}
      {/* ========================================================================= */}
      {viewMode === 'logins' && (
        <div className="space-y-4">
          {/* Selection & Bulk Actions Control Bar for Logins (when canDelete) */}
          {canDelete && sortedLogins.length > 0 && (
            <div className={`p-3 px-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-semibold ${
              darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={paginatedLogins.length > 0 && paginatedLogins.every(l => selectedLoginIds.has(l.id))}
                    onChange={toggleSelectAllVisibleLogins}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    Selecionar página atual ({paginatedLogins.length})
                  </span>
                </label>

                {selectedLoginIds.size > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      {selectedLoginIds.size} selecionada(s)
                    </span>
                    {selectedLoginIds.size < sortedLogins.length && (
                      <button
                        onClick={selectAllFilteredLogins}
                        className="text-blue-600 dark:text-blue-400 underline font-bold cursor-pointer hover:opacity-80"
                      >
                        Selecionar todas as {sortedLogins.length} credenciais filtradas
                      </button>
                    )}
                    <button
                      onClick={clearLoginSelection}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                    >
                      Desmarcar todas
                    </button>
                  </>
                )}
              </div>

              {selectedLoginIds.size > 0 && (
                <button
                  onClick={() => setIsBulkDeleteLoginsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
                >
                  <Trash2 size={14} />
                  <span>Excluir Selecionadas ({selectedLoginIds.size})</span>
                </button>
              )}
            </div>
          )}

          <div className={`rounded-2xl border overflow-hidden transition-all ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b font-bold uppercase tracking-wider text-[10px] ${
                  darkMode ? 'bg-slate-850 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <tr>
                    {canDelete && (
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={paginatedLogins.length > 0 && paginatedLogins.every(l => selectedLoginIds.has(l.id))}
                          onChange={toggleSelectAllVisibleLogins}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                          title="Selecionar todos da página"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4">Convênio / Órgão</th>
                    <th className="py-3 px-3">Esfera</th>
                    <th className="py-3 px-3">UF</th>
                    <th className="py-3 px-4">Banco</th>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Senha</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Reserva</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {paginatedLogins.length === 0 ? (
                    <tr>
                      <td colSpan={canDelete ? 10 : 9} className="py-12 text-center text-slate-400">
                        <KeyRound size={32} className="mx-auto mb-2 opacity-40 text-blue-500" />
                        <p className="font-bold text-sm">Nenhuma credencial encontrada</p>
                        <p className="text-xs text-slate-500 mt-0.5">Tente remover filtros para visualizar mais resultados.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogins.map((login) => {
                      const linkedCovIds = getLoginCovenantIds(login);
                      const linkedCovenants = covenants.filter(c => linkedCovIds.includes(c.id));
                      const primaryCov = covenants.find(c => c.id === login.covenantId) || linkedCovenants[0];
                      const otherCovenants = linkedCovenants.filter(c => c.id !== primaryCov?.id);
                      const isPassVisible = !!visiblePasswordsMap[login.id];
                      const isReserved = !!login.reservedBy;
                      const isSelected = selectedLoginIds.has(login.id);

                      return (
                        <tr 
                          key={login.id} 
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/40'
                              : darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {canDelete && (
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectLogin(login.id)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                                title="Selecionar para exclusão"
                              />
                            </td>
                          )}
                          {/* Covenant Name */}
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white max-w-[240px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Building2 size={14} className="text-blue-500 shrink-0" />
                              <span className="truncate">{primaryCov?.name || 'Convênio Avulso'}</span>
                              {otherCovenants.length > 0 && (
                                <span 
                                  className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/90 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 shrink-0 cursor-help"
                                  title={`Também atende: ${otherCovenants.map(c => `${c.name} (${c.state})`).join(', ')}`}
                                >
                                  +{otherCovenants.length} convênio(s)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                              {primaryCov?.category || 'Municipal'}
                            </span>
                          </td>

                          {/* State */}
                          <td className="py-3 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {primaryCov?.state || '-'}
                            </span>
                          </td>

                          {/* Bank */}
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <Landmark size={14} className="text-slate-400 shrink-0" />
                              <span>{login.bank}</span>
                            </div>
                          </td>

                          {/* Username */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{login.username}</span>
                              {duplicatesReport.duplicateLoginIdSet.has(login.id) && (
                                <button
                                  onClick={() => setIsDuplicatesModalOpen(true)}
                                  className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] flex items-center gap-0.5 cursor-pointer shrink-0 transition-colors shadow-2xs"
                                  title="Credencial duplicada (mesmo convênio, banco e usuário). Clique para auditar."
                                >
                                  <AlertTriangle size={10} />
                                  <span>Duplicada</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleCopyText(login.username, `u-${login.id}`, 'Usuário')}
                                className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer"
                                title="Copiar Usuário"
                              >
                                {copiedId === `u-${login.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </td>

                          {/* Password */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{isPassVisible ? login.password : '••••••••'}</span>
                              <button
                                onClick={() => togglePasswordVisibility(login.id, `${primaryCov?.name || ''} - ${login.bank}`)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                title={isPassVisible ? "Ocultar senha" : "Ver senha"}
                              >
                                {isPassVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button
                                onClick={() => handleCopyText(login.password, `p-${login.id}`, 'Senha')}
                                className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer"
                                title="Copiar Senha"
                              >
                                {copiedId === `p-${login.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              login.status === 'Ativo'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : login.status === 'Bloqueado'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {login.status}
                            </span>
                          </td>

                          {/* Reservation Status & Action */}
                          <td className="py-3 px-3">
                            {isReserved ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  {login.reservedBy}
                                </span>
                                {onReleaseLogin && (
                                  <button
                                    onClick={() => onReleaseLogin(login.id)}
                                    className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                                    title="Liberar Login"
                                  >
                                    <Unlock size={12} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  Livre
                                </span>
                                {onReserveLogin && (
                                  <button
                                    onClick={() => onReserveLogin(login.id)}
                                    className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded cursor-pointer"
                                    title="Reservar para meu uso"
                                  >
                                    <Lock size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {primaryCov?.managerUrl && (
                                <a
                                  href={primaryCov.managerUrl.startsWith('http') ? primaryCov.managerUrl : `https://${primaryCov.managerUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
                                  title="Abrir Portal"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => openEditSingleLoginModal(login)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg cursor-pointer"
                                  title="Editar Credencial"
                                >
                                  <Edit size={14} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setLoginToDelete(login)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg cursor-pointer"
                                  title="Excluir Credencial"
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
          </div>

          {/* Pagination Controls for Logins */}
          {totalLoginPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t dark:border-slate-800 text-xs">
              <span className="text-slate-500">
                Mostrando {(currentPage - 1) * rowsPerPage + 1} a {Math.min(currentPage * rowsPerPage, sortedLogins.length)} de {sortedLogins.length} credenciais
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 border rounded-lg font-semibold cursor-pointer disabled:opacity-40 ${
                    darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold">
                  {currentPage} / {totalLoginPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalLoginPages))}
                  disabled={currentPage === totalLoginPages}
                  className={`px-3 py-1.5 border rounded-lg font-semibold cursor-pointer disabled:opacity-40 ${
                    darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CADASTRO / EDIÇÃO UNIFICADA DE ACESSO (CONVÊNIO + MÚLTIPLOS BANCOS) */}
      {/* ========================================================================= */}
      {isCovenantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-5 border-b flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">
                    {editingCovenant?.id?.startsWith('cov-') ? 'Novo Acesso / Convênio' : 'Editar Acesso / Convênio'}
                  </h3>
                  <p className="text-xs text-slate-400">Configure os dados do convênio e suas credenciais bancárias</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCovenantModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUnifiedAccess} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* NOME DO CONVÊNIO */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  NOME DO CONVÊNIO <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prefeitura de São Paulo, Governo de Minas Gerais, Exército Brasileiro..."
                  value={editingCovenant?.name || ''}
                  onChange={(e) => setEditingCovenant({ ...editingCovenant, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* TIPO & ESTADO */}
              {(() => {
                const isFederalOrForces = editingCovenant?.category === 'Federal' || editingCovenant?.category === 'Forças Armadas';
                return (
                  <div className={`grid ${isFederalOrForces ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
                    {/* TIPO: FEDERAL, FORÇAS ARMADAS, ESTADUAL, PREFEITURAS */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        TIPO <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={editingCovenant?.category || 'Federal'}
                        onChange={(e) => {
                          const newCat = e.target.value as CovenantCategory;
                          setEditingCovenant({
                            ...editingCovenant,
                            category: newCat,
                            state: (newCat === 'Federal' || newCat === 'Forças Armadas') ? '' : (editingCovenant?.state || 'SP')
                          });
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                          darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="Federal">FEDERAL</option>
                        <option value="Forças Armadas">FORÇAS ARMADAS</option>
                        <option value="Estadual">ESTADUAL</option>
                        <option value="Prefeituras">PREFEITURAS</option>
                      </select>
                    </div>

                    {/* ESTADO(SELECIONAVEL COM TODOS OS ESTADOS - SOME SE FEDERAL OU FORÇAS ARMADAS) */}
                    {!isFederalOrForces && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          ESTADO <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editingCovenant?.state || 'SP'}
                          onChange={(e) => setEditingCovenant({ ...editingCovenant, state: e.target.value })}
                          className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                            darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                        >
                          {BRAZILIAN_STATES.map(s => (
                            <option key={s.uf} value={s.uf}>{s.uf} - {s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* BANCO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  BANCO <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {['Itaú Consignado', 'Banco do Brasil', 'Bradesco Promotora', 'Santander', 'Caixa Econômica', 'Banco Pan', 'Banco Daycoval', 'Banco BMG', 'Banco Safra', 'C6 Consig', 'Banrisul'].map(b => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => {
                        const updated = [...modalBankLogins];
                        if (updated.length === 0) updated.push({ bank: b, username: '', password: '', status: 'Ativo' });
                        else updated[0].bank = b;
                        setModalBankLogins(updated);
                        setEditingCovenant({ ...editingCovenant, bank: b });
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border cursor-pointer ${
                        (modalBankLogins[0]?.bank === b || editingCovenant?.bank === b)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Nome do Banco (Ex: Itaú, Banco do Brasil, Bradesco...)"
                  value={modalBankLogins[0]?.bank || editingCovenant?.bank || ''}
                  onChange={(e) => {
                    const updated = [...modalBankLogins];
                    if (updated.length === 0) {
                      updated.push({ bank: e.target.value, username: '', password: '', status: 'Ativo' });
                    } else {
                      updated[0].bank = e.target.value;
                    }
                    setModalBankLogins(updated);
                    setEditingCovenant({ ...editingCovenant, bank: e.target.value });
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* LOGIN & SENHA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    LOGIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Usuário / Login..."
                    value={modalBankLogins[0]?.username ?? editingCovenant?.login ?? ''}
                    onChange={(e) => {
                      const updated = [...modalBankLogins];
                      if (updated.length === 0) {
                        updated.push({ bank: editingCovenant?.bank || 'Itaú Consignado', username: e.target.value, password: '', status: 'Ativo' });
                      } else {
                        updated[0].username = e.target.value;
                      }
                      setModalBankLogins(updated);
                      setEditingCovenant({ ...editingCovenant, login: e.target.value });
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    SENHA <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? "text" : "password"}
                      required
                      placeholder="Senha de acesso..."
                      value={modalBankLogins[0]?.password ?? editingCovenant?.password ?? ''}
                      onChange={(e) => {
                        const updated = [...modalBankLogins];
                        if (updated.length === 0) {
                          updated.push({ bank: editingCovenant?.bank || 'Itaú Consignado', username: '', password: e.target.value, status: 'Ativo' });
                        } else {
                          updated[0].password = e.target.value;
                        }
                        setModalBankLogins(updated);
                        setEditingCovenant({ ...editingCovenant, password: e.target.value });
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none pr-9 ${
                        darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showModalPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* STATUS */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  STATUS <span className="text-red-500">*</span>
                </label>
                <select
                  value={modalBankLogins[0]?.status || editingCovenant?.status || 'Ativo'}
                  onChange={(e) => {
                    const updated = [...modalBankLogins];
                    if (updated.length === 0) {
                      updated.push({ bank: editingCovenant?.bank || 'Itaú Consignado', username: '', password: '', status: e.target.value as LoginStatus });
                    } else {
                      updated[0].status = e.target.value as LoginStatus;
                    }
                    setModalBankLogins(updated);
                    setEditingCovenant({ ...editingCovenant, status: e.target.value as any });
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Bloqueado">Bloqueado</option>
                  <option value="Em manutenção">Em manutenção</option>
                </select>
              </div>

              {/* OUTROS BANCOS / CREDENCIAIS ADICIONAIS (SE HOUVER) */}
              {modalBankLogins.length > 1 && (
                <div className="space-y-3 pt-3 border-t dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Bancos Adicionais Vinculados ({modalBankLogins.length - 1})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setModalBankLogins([...modalBankLogins, { bank: '', username: '', password: '', status: 'Ativo' }]);
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Adicionar Mais um Banco</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {modalBankLogins.slice(1).map((item, relIndex) => {
                      const index = relIndex + 1;
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-xl border space-y-2 ${
                            darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <Landmark size={13} className="text-blue-500" />
                              <span>Banco Adicional #{index}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setModalBankLogins(modalBankLogins.filter((_, i) => i !== index));
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Banco</label>
                              <input
                                type="text"
                                required
                                placeholder="Nome do Banco..."
                                value={item.bank}
                                onChange={(e) => {
                                  const updated = [...modalBankLogins];
                                  updated[index].bank = e.target.value;
                                  setModalBankLogins(updated);
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border outline-none ${
                                  darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Usuário / Login</label>
                              <input
                                type="text"
                                placeholder="Login..."
                                value={item.username}
                                onChange={(e) => {
                                  const updated = [...modalBankLogins];
                                  updated[index].username = e.target.value;
                                  setModalBankLogins(updated);
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border outline-none ${
                                  darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Senha</label>
                              <input
                                type="text"
                                placeholder="Senha..."
                                value={item.password}
                                onChange={(e) => {
                                  const updated = [...modalBankLogins];
                                  updated[index].password = e.target.value;
                                  setModalBankLogins(updated);
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold border outline-none ${
                                  darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {modalBankLogins.length <= 1 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModalBankLogins([...modalBankLogins, { bank: '', username: '', password: '', status: 'Ativo' }]);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>+ Adicionar outro banco a este convênio</span>
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t flex items-center justify-end gap-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCovenantModalOpen(false)}
                  className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccess}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingAccess ? 'Salvando...' : 'Salvar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CADASTRO / EDIÇÃO DE LOGIN AVULSO */}
      {/* ========================================================================= */}
      {isSingleLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="p-5 border-b flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-2xs">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">
                    {editingSingleLogin?.id?.startsWith('log-') ? 'Nova Credencial / Login' : 'Editar Credencial'}
                  </h3>
                  <p className="text-xs text-slate-400">Vincule um login bancário ao convênio correspondente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSingleLoginModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleLogin} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Select Primary Covenant */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Convênio Principal <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">Órgão base desta credencial</span>
                </label>
                <select
                  required
                  value={singleLoginCovenantId}
                  onChange={(e) => {
                    const newPrimary = e.target.value;
                    setSingleLoginCovenantId(newPrimary);
                    setSingleLoginAdditionalCovenantIds(prev => prev.filter(id => id !== newPrimary));
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  {covenants.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.state})</option>
                  ))}
                </select>
              </div>

              {/* Multi-Covenant Association Box (Solução 1: Credencial Multiconvênio) */}
              <div className={`p-3.5 rounded-2xl border space-y-2.5 transition-all ${
                darkMode ? 'bg-slate-850/70 border-slate-800' : 'bg-blue-50/40 border-blue-100'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-purple-500" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Vincular a Múltiplos Convênios (Multiconvênio)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Permite que este mesmo login de banco consulte outros convênios sem precisar cadastrar duplicatas.
                      </p>
                    </div>
                  </div>
                  {singleLoginAdditionalCovenantIds.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                      +{singleLoginAdditionalCovenantIds.length} vinculado(s)
                    </span>
                  )}
                </div>

                {/* Quick Search for Covenants to Link */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar convênio ou estado (ex: Bahia, Salvador, RJ)..."
                      value={covenantPickerSearch}
                      onChange={(e) => setCovenantPickerSearch(e.target.value)}
                      className={`w-full pl-7 pr-3 py-1.5 rounded-lg text-xs border outline-none ${
                        darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                  {singleLoginAdditionalCovenantIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSingleLoginAdditionalCovenantIds([])}
                      className="text-[10px] text-slate-400 hover:text-rose-500 underline cursor-pointer whitespace-nowrap"
                    >
                      Limpar extras
                    </button>
                  )}
                </div>

                {/* Selected Covenants Tag Chips */}
                {singleLoginAdditionalCovenantIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {singleLoginAdditionalCovenantIds.map(covId => {
                      const cov = covenants.find(c => c.id === covId);
                      if (!cov) return null;
                      return (
                        <span
                          key={cov.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800"
                        >
                          <span className="truncate max-w-[160px]">{cov.name} ({cov.state})</span>
                          <button
                            type="button"
                            onClick={() => setSingleLoginAdditionalCovenantIds(prev => prev.filter(id => id !== cov.id))}
                            className="hover:text-rose-600 font-bold ml-0.5 cursor-pointer text-xs"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Covenant Checkbox Scroll List */}
                <div className={`max-h-32 overflow-y-auto rounded-xl border p-2 space-y-1 ${
                  darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  {covenants
                    .filter(c => c.id !== singleLoginCovenantId)
                    .filter(c => {
                      if (!covenantPickerSearch) return true;
                      const s = normalizeText(covenantPickerSearch);
                      return normalizeText(c.name).includes(s) || normalizeText(c.state).includes(s) || normalizeText(c.city).includes(s);
                    })
                    .map(c => {
                      const isChecked = singleLoginAdditionalCovenantIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                            isChecked
                              ? darkMode ? 'bg-purple-950/40 text-purple-200' : 'bg-purple-50 text-purple-900'
                              : darkMode ? 'hover:bg-slate-800/60 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSingleLoginAdditionalCovenantIds(prev =>
                                  isChecked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                );
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
                            />
                            <span className="truncate font-medium">{c.name}</span>
                          </div>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 font-mono">
                            {c.state}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Bank Chips & Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Banco <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {['Itaú Consignado', 'Banco do Brasil', 'Bradesco Promotora', 'Santander', 'Caixa Econômica', 'Banco Pan', 'Banco Daycoval', 'Banco BMG', 'Banco Safra', 'C6 Consig', 'Banrisul'].map(b => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setEditingSingleLogin(prev => ({ ...prev, bank: b }))}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border cursor-pointer ${
                        editingSingleLogin?.bank === b
                          ? 'bg-blue-600 text-white border-blue-600'
                          : darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Nome do Banco..."
                  value={editingSingleLogin?.bank || ''}
                  onChange={(e) => setEditingSingleLogin(prev => ({ ...prev, bank: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* User & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Usuário / Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: operador.01..."
                    value={editingSingleLogin?.username || ''}
                    onChange={(e) => setEditingSingleLogin(prev => ({ ...prev, username: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Senha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Senha do banco..."
                    value={editingSingleLogin?.password || ''}
                    onChange={(e) => setEditingSingleLogin(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Status da Credencial
                </label>
                <select
                  value={editingSingleLogin?.status || 'Ativo'}
                  onChange={(e) => setEditingSingleLogin(prev => ({ ...prev, status: e.target.value as LoginStatus }))}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Bloqueado">Bloqueado</option>
                  <option value="Em manutenção">Em manutenção</option>
                </select>
              </div>

              {/* Observações */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Observações da Credencial
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações específicas deste login bancário..."
                  value={editingSingleLogin?.observations || ''}
                  onChange={(e) => setEditingSingleLogin(prev => ({ ...prev, observations: e.target.value }))}
                  className={`w-full p-2.5 rounded-xl text-xs font-medium border outline-none resize-none ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t flex items-center justify-end gap-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSingleLoginModalOpen(false)}
                  className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Salvar Credencial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMAR EXCLUSÃO DE CONVÊNIO / ACESSO */}
      {/* ========================================================================= */}
      {covenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-base">Excluir Acesso?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Você está prestes a excluir o convênio <strong>{covenantToDelete.name}</strong> e todos os logins bancários vinculados a ele.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCovenantToDelete(null)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                  darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCovenant}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Sim, Excluir Acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRMAR EXCLUSÃO DE LOGIN */}
      {/* ========================================================================= */}
      {loginToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-base">Excluir Credencial?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deseja realmente remover o login <strong>{loginToDelete.username}</strong> do banco <strong>{loginToDelete.bank}</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setLoginToDelete(null)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer ${
                  darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteLogin}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Sim, Excluir Credencial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CONFIRMAR EXCLUSÃO EM MASSA DE CONVÊNIOS */}
      {/* ========================================================================= */}
      {isBulkDeleteCovenantsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-base">Excluir {selectedCovenantIds.size} Acessos / Convênios?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esta ação irá remover permanentemente os <strong>{selectedCovenantIds.size}</strong> convênios selecionados e todas as credenciais bancárias associadas a eles.
              </p>
            </div>

            <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl border text-xs space-y-1 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              {Array.from(selectedCovenantIds).slice(0, 10).map(id => {
                const c = covenants.find(cov => cov.id === id);
                return (
                  <div key={id} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold truncate">
                    <span className="text-rose-500">•</span>
                    <span className="truncate">{c?.name || id} ({c?.category || 'Convênio'})</span>
                  </div>
                );
              })}
              {selectedCovenantIds.size > 10 && (
                <p className="text-[10px] text-slate-400 font-bold pt-1 italic">
                  ... e mais {selectedCovenantIds.size - 10} outros convênios selecionados.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={isBatchDeleting}
                onClick={() => setIsBulkDeleteCovenantsModalOpen(false)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${
                  darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                disabled={isBatchDeleting}
                onClick={confirmBulkDeleteCovenants}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBatchDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Excluindo ({selectedCovenantIds.size})...</span>
                  </>
                ) : (
                  <span>Sim, Excluir Todos Selecionados</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CONFIRMAR EXCLUSÃO EM MASSA DE CREDENCIAIS */}
      {/* ========================================================================= */}
      {isBulkDeleteLoginsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-base">Excluir {selectedLoginIds.size} Credenciais?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deseja realmente remover as <strong>{selectedLoginIds.size}</strong> credenciais bancárias selecionadas?
              </p>
            </div>

            <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl border text-xs space-y-1 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              {Array.from(selectedLoginIds).slice(0, 10).map(id => {
                const l = logins.find(log => log.id === id);
                const c = covenants.find(cov => cov.id === l?.covenantId);
                return (
                  <div key={id} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold truncate">
                    <span className="text-rose-500">•</span>
                    <span className="truncate">{c?.name || 'Convênio'} - {l?.bank || 'Banco'}: <strong>{l?.username}</strong></span>
                  </div>
                );
              })}
              {selectedLoginIds.size > 10 && (
                <p className="text-[10px] text-slate-400 font-bold pt-1 italic">
                  ... e mais {selectedLoginIds.size - 10} outras credenciais selecionadas.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={isBatchDeleting}
                onClick={() => setIsBulkDeleteLoginsModalOpen(false)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${
                  darkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                disabled={isBatchDeleting}
                onClick={confirmBulkDeleteLogins}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBatchDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Excluindo ({selectedLoginIds.size})...</span>
                  </>
                ) : (
                  <span>Sim, Excluir Credenciais Selecionadas</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING BULK ACTIONS BAR (BARRA DE AÇÕES EM MASSA FLUTUANTE)              */}
      {/* ========================================================================= */}
      {canDelete && (
        (viewMode === 'covenants' && selectedCovenantIds.size > 0) ||
        (viewMode === 'logins' && selectedLoginIds.size > 0)
      ) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-2xl bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-2xl border border-slate-700 dark:border-slate-600 flex items-center gap-4 animate-bounce-subtle">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold whitespace-nowrap">
              {viewMode === 'covenants' 
                ? `${selectedCovenantIds.size} convênio(s) selecionado(s)` 
                : `${selectedLoginIds.size} credencial(is) selecionada(s)`}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 dark:bg-slate-600" />

          <div className="flex items-center gap-2">
            <button
              onClick={viewMode === 'covenants' ? clearCovenantSelection : clearLoginSelection}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Desmarcar
            </button>

            <button
              onClick={() => {
                if (viewMode === 'covenants') setIsBulkDeleteCovenantsModalOpen(true);
                else setIsBulkDeleteLoginsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              <Trash2 size={14} />
              <span>Excluir Selecionados</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: INCLUSÃO EM MASSA VIA EXCEL (.XLSX)                             */}
      {/* ========================================================================= */}
      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        covenants={covenants}
        logins={logins}
        systems={systems}
        currentUser={currentUser}
        darkMode={darkMode}
        onSaveCovenant={onSaveCovenant}
        onSaveLogin={onSaveLogin}
        onLogAction={onLogAction}
        onSuccess={(stats) => {
          showToast(`Importação concluída: ${stats.covenantsCreated} convênio(s) e ${stats.loginsCreated} credencial(is) adicionados!`);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 8: AUDITOR E RESOLUÇÃO DE ACESSOS DUPLICADOS                       */}
      {/* ========================================================================= */}
      <DuplicatesManagerModal
        isOpen={isDuplicatesModalOpen}
        onClose={() => setIsDuplicatesModalOpen(false)}
        report={duplicatesReport}
        covenants={covenants}
        logins={logins}
        darkMode={darkMode}
        currentUser={currentUser}
        onSaveCovenant={onSaveCovenant}
        onSaveLogin={onSaveLogin}
        onDeleteCovenant={onDeleteCovenant}
        onDeleteLogin={onDeleteLogin}
        onLogAction={onLogAction}
      />

    </div>
  );
}
