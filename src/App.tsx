import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sun, 
  Moon, 
  Search as SearchIcon, 
  LogOut, 
  Building2, 
  Lock, 
  User as UserIcon,
  HelpCircle,
  Wifi,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { api, FullDatabase } from './lib/api';
import { User, Covenant, System, Login, HistoryLog, SystemConfig } from './types';
import { auth } from './lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Import all tabs
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Covenants from './components/Covenants';
import Systems from './components/Systems';
import Logins from './components/Logins';
import Users from './components/Users';
import Search from './components/Search';
import History from './components/History';
import Reports from './components/Reports';
import Import from './components/Import';
import Settings from './components/Settings';

const MOCK_DATABASE: FullDatabase = {
  config: {
    companyName: 'Access Manager (Segurança)',
    logoUrl: '',
    primaryColor: '#2563eb',
    sessionTimeoutMinutes: 30,
    rowsPerPage: 10,
    googleAppsScriptUrl: ''
  },
  users: [
    {
      id: 'usr-fallback',
      username: 'admin',
      name: 'Maicon Operacional (Modo de Segurança)',
      password: 'admin',
      role: 'Administrador',
      status: 'Ativo',
      allowedCovenants: [],
      allowedBanks: []
    }
  ],
  covenants: [],
  systems: [],
  logins: [],
  favorites: [],
  reservationLogs: [],
  historyLogs: []
};

export default function App() {
  const [db, setDb] = useState<FullDatabase | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [searchFilter, setSearchFilter] = useState<any>(null); // For navigation drilldowns
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Fetch full database from Express / Apps Script proxy
  const fetchDatabase = useCallback(async () => {
    try {
      setLoading(true);
      setDbError(null);
      const data = await api.getDatabase();
      setDb(data);
    } catch (err: any) {
      console.error("Erro ao carregar banco de dados:", err);
      setDbError(err.message || "Falha ao carregar banco de dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen to Firebase Auth state changes for persistent login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const username = firebaseUser.email.split('@')[0].toLowerCase();
        const databaseUsers = db?.users || MOCK_DATABASE.users;
        const matchedUser = databaseUsers.find(u => u.username.toLowerCase() === username);
        if (matchedUser) {
          if (matchedUser.status !== 'Bloqueado') {
            setCurrentUser(matchedUser);
          } else {
            signOut(auth);
            setCurrentUser(null);
          }
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, [db]);

  // Initialize and load database on boot
  useEffect(() => {
    fetchDatabase();
  }, [fetchDatabase]);

  // Apply dark mode theme class to HTML node
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Dynamic colors / settings mapping from configuration
  const config = db?.config || {
    companyName: 'Access Manager',
    logoUrl: '',
    primaryColor: '#2563eb',
    sessionTimeoutMinutes: 30,
    rowsPerPage: 10,
    googleAppsScriptUrl: ''
  };

  // Log audit activity helper
  const handleLogAction = async (actionType: any, targetType: any, targetId: string, targetName: string) => {
    if (!currentUser || !db) return;
    const log: HistoryLog = {
      id: `hist-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      actionType,
      targetType,
      targetId,
      targetName,
      timestamp: new Date().toISOString(),
      ip: '192.168.1.14' // Simulated client office IP
    };
    try {
      const updatedDb = await api.addLog(log);
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Execute authentication via Firebase Auth with auto-provisioning
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    const username = usernameInput.toLowerCase().trim();
    const password = passwordInput;

    if (!username || !password) {
      setLoginError('Por favor, preencha o usuário e a senha.');
      setLoading(false);
      return;
    }

    // Emergency Fallback if DB is not loaded and they type admin/admin
    if (!db && username === 'admin' && password === 'admin') {
      setDb(MOCK_DATABASE);
      setCurrentUser(MOCK_DATABASE.users[0]);
      setLoginError('');
      setUsernameInput('');
      setPasswordInput('');
      setLoading(false);
      return;
    }

    try {
      const databaseUsers = db?.users || MOCK_DATABASE.users;
      const dbUser = databaseUsers.find(u => u.username.toLowerCase() === username);

      if (!dbUser) {
        setLoginError('Usuário não cadastrado na gestora de margem (planilha/banco).');
        setLoading(false);
        return;
      }

      if (dbUser.status === 'Bloqueado') {
        setLoginError('Sua conta foi temporariamente bloqueada pelo Administrador.');
        setLoading(false);
        return;
      }

      // We use username@accessmanager.com as email in Firebase Auth
      const firebaseEmail = `${username}@accessmanager.com`;

      try {
        // Try standard login
        await signInWithEmailAndPassword(auth, firebaseEmail, password);
      } catch (authError: any) {
        const isUserNotFound = authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential';
        
        // If the user doesn't exist in Firebase yet but is in the spreadsheet/db users list with the matching password, we auto-create them!
        if (isUserNotFound && dbUser.password === password) {
          try {
            await createUserWithEmailAndPassword(auth, firebaseEmail, password);
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              // If the email is already in use, it means they already exist but with a different password.
              // We'll log them in anyway as a fallback since their password matches the sheet.
              setCurrentUser(dbUser);
              setLoginError('');
              setUsernameInput('');
              setPasswordInput('');
              setLoading(false);
              return;
            }
            console.error('Error auto-creating Firebase Auth user:', createErr);
            throw new Error('Falha ao registrar credenciais de segurança no primeiro acesso.');
          }
        } else if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
          // If the password matches spreadsheet but not Firebase Auth, maybe the password was updated in spreadsheet.
          if (dbUser.password === password) {
            setCurrentUser(dbUser);
            setLoginError('');
            setUsernameInput('');
            setPasswordInput('');
            setLoading(false);
            return;
          }
          throw new Error('Senha incorreta. Por favor, tente novamente.');
        } else {
          throw authError;
        }
      }

      setCurrentUser(dbUser);
      setLoginError('');
      setUsernameInput('');
      setPasswordInput('');
    } catch (err: any) {
      console.error('Erro de autenticação:', err);
      setLoginError(err.message || 'Falha ao autenticar com o servidor de segurança.');
    } finally {
      setLoading(false);
    }
  };

  // Demo user login shortcut helper using Firebase Auth
  const handleQuickLogin = async (role: 'Administrador' | 'Supervisor' | 'Operador') => {
    setLoading(true);
    setLoginError('');
    
    // Emergency Fallback if DB is not loaded and they select Admin
    if (!db) {
      if (role === 'Administrador') {
        setDb(MOCK_DATABASE);
        setCurrentUser(MOCK_DATABASE.users[0]);
        setLoginError('');
      } else {
        setLoginError('Modo de segurança ativo. Utilize o login de Administrador para acessar.');
      }
      setLoading(false);
      return;
    }

    const dbUser = db.users.find(u => u.role === role);
    if (!dbUser) {
      setLoginError(`Nenhum usuário com o cargo de ${role} encontrado.`);
      setLoading(false);
      return;
    }

    const username = dbUser.username.toLowerCase();
    const password = dbUser.password;
    const firebaseEmail = `${username}@accessmanager.com`;

    try {
      try {
        await signInWithEmailAndPassword(auth, firebaseEmail, password);
      } catch (authError: any) {
        const isUserNotFound = authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential';
        if (isUserNotFound) {
          try {
            await createUserWithEmailAndPassword(auth, firebaseEmail, password);
          } catch (createErr: any) {
            if (createErr.code !== 'auth/email-already-in-use') {
              throw createErr;
            }
          }
        } else {
          throw authError;
        }
      }
      setCurrentUser(dbUser);
    } catch (err: any) {
      console.error('Erro no Quick Login:', err);
      // Fallback to local login if Firebase fails for quick demo purposes
      setCurrentUser(dbUser);
      setLoginError('Aviso: Login efetuado em modo offline/local.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao realizar logout:', err);
    }
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  // Tab navigation & filtered drilldown routing
  const handleNavigateToTab = (tabName: string, filter?: any) => {
    setSearchFilter(filter || null);
    setCurrentTab(tabName);
  };

  // CRUD Save helper across modules
  const handleSaveItem = async (table: 'covenants' | 'systems' | 'logins' | 'users', item: any) => {
    try {
      const isNew = !db?.[table]?.some((x: any) => x.id === item.id);
      const actionType = isNew ? 'Criar' : 'Alterar';
      const targetType = table === 'covenants' ? 'Covenant' : 
                         table === 'systems' ? 'System' : 
                         table === 'logins' ? 'Login' : 'User';

      const updatedDb = await api.saveItem(table, item);
      setDb(updatedDb);

      // Create history log entry
      if (currentUser) {
        const targetName = item.name || item.username || item.id;
        const log: HistoryLog = {
          id: `hist-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          actionType,
          targetType,
          targetId: item.id,
          targetName,
          timestamp: new Date().toISOString(),
          ip: '192.168.1.14'
        };
        const finalDb = await api.addLog(log);
        setDb(finalDb);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CRUD Delete helper across modules
  const handleDeleteItem = async (table: 'covenants' | 'systems' | 'logins' | 'users', id: string) => {
    try {
      const currentItem = db?.[table]?.find((x: any) => x.id === id);
      const targetName = currentItem ? (currentItem.name || currentItem.username) : id;
      const targetType = table === 'covenants' ? 'Covenant' : 
                         table === 'systems' ? 'System' : 
                         table === 'logins' ? 'Login' : 'User';

      const updatedDb = await api.deleteItem(table, id);
      setDb(updatedDb);

      // Create history log entry
      if (currentUser) {
        const log: HistoryLog = {
          id: `hist-${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          actionType: 'Excluir',
          targetType,
          targetId: id,
          targetName,
          timestamp: new Date().toISOString(),
          ip: '192.168.1.14'
        };
        const finalDb = await api.addLog(log);
        setDb(finalDb);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Settings configuration
  const handleSaveConfig = async (newConfig: Partial<SystemConfig>) => {
    try {
      const updatedDb = await api.saveConfig({ ...config, ...newConfig });
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle favorite portal (System) for user
  const handleToggleFavorite = async (systemId: string) => {
    if (!currentUser) return;
    try {
      const updatedDb = await api.toggleFavorite(systemId, currentUser.id);
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Reserve login ticket
  const handleReserveLogin = async (loginId: string) => {
    if (!currentUser) return;
    try {
      const updatedDb = await api.reserveLogin(loginId, currentUser.name, new Date().toISOString());
      setDb(updatedDb);
      await handleLogAction('Alterar', 'Login', loginId, `Reservar Login`);
    } catch (err) {
      console.error(err);
    }
  };

  // Release login ticket
  const handleReleaseLogin = async (loginId: string) => {
    try {
      const updatedDb = await api.releaseLogin(loginId, new Date().toISOString());
      setDb(updatedDb);
      await handleLogAction('Alterar', 'Login', loginId, `Liberar Login`);
    } catch (err) {
      console.error(err);
    }
  };

  // Excel Spreadsheet Import logins trigger
  const handleImportLogins = async (newLogins: Login[]) => {
    if (!currentUser) return;
    try {
      const importLogs: HistoryLog[] = newLogins.map((login, idx) => ({
        id: `hist-import-${Date.now()}-${idx}`,
        userId: currentUser.id,
        userName: currentUser.name,
        actionType: 'Criar',
        targetType: 'Login',
        targetId: login.id,
        targetName: login.username,
        timestamp: new Date().toISOString(),
        ip: '192.168.1.14'
      }));

      const updatedDb = await api.importLogins(newLogins, importLogs);
      setDb(updatedDb);
    } catch (err) {
      console.error(err);
    }
  };

  // Restore Entire database Backup (JSON format)
  const handleRestoreBackup = async (restoredState: any) => {
    try {
      // Just post everything
      await api.saveConfig(restoredState.config);
      
      // Seed table arrays sequentially
      for (const cov of restoredState.covenants || []) {
        await api.saveItem('covenants', cov);
      }
      for (const sys of restoredState.systems || []) {
        await api.saveItem('systems', sys);
      }
      for (const log of restoredState.logins || []) {
        await api.saveItem('logins', log);
      }
      for (const usr of restoredState.users || []) {
        await api.saveItem('users', usr);
      }

      await fetchDatabase();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <div className="relative flex items-center justify-center w-16 h-16 mb-4">
          <div className="absolute w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
          <Building2 size={24} className="text-blue-600 animate-pulse" />
        </div>
        <p className="font-display font-bold text-sm tracking-wide">Sincronizando banco de dados...</p>
        <span className="text-xs text-slate-400 mt-1 font-mono">conectando com a planilha do Google Sheets</span>
      </div>
    );
  }

  // RENDER: LOGIN PORTAL
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-8 space-y-6">
          
          {/* Logo Brand */}
          <div className="text-center space-y-2">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-10 mx-auto object-contain mb-2" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto text-white shadow-lg shadow-blue-500/25">
                <Building2 size={24} />
              </div>
            )}
            <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              {config.companyName || 'Access Manager'}
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Controle de acessos, senhas e auditagem de correspondentes.</p>
          </div>

          {dbError && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <span>⚠️ Conexão com o Banco de Dados</span>
              </p>
              <p className="text-[11px] leading-relaxed">Não foi possível carregar as informações do servidor. Isso geralmente acontece se a URL do Google Sheets estiver incorreta ou inacessível no momento.</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={fetchDatabase}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Tentar Novamente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDb(MOCK_DATABASE);
                    setDbError(null);
                    setLoginError('Modo de Segurança ativado. Faça login com usuário "admin" e senha "admin" para acessar.');
                  }}
                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Usar Banco Local
                </button>
              </div>
            </div>
          )}

          {loginError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold leading-tight">
              {loginError}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Usuário / Login</label>
              <input
                type="text"
                required
                placeholder="Ex: maicon.admin"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Senha Corporativa</label>
              <input
                type="password"
                required
                placeholder="Insira sua senha de acesso"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer"
            >
              Acessar Painel Seguro
            </button>
          </form>

          {/* Quick Demo Accounts Selection */}
          <div className="border-t pt-5 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
              <Sparkles size={12} className="text-blue-500" />
              <span>Contas de demonstração para homologação:</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickLogin('Administrador')}
                className="py-2 px-1 border dark:border-slate-800 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200/40 cursor-pointer dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Admin
              </button>
              <button
                onClick={() => handleQuickLogin('Supervisor')}
                className="py-2 px-1 border dark:border-slate-800 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-800 hover:bg-green-50 hover:text-green-600 hover:border-green-200/40 cursor-pointer dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Supervisor
              </button>
              <button
                onClick={() => handleQuickLogin('Operador')}
                className="py-2 px-1 border dark:border-slate-800 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-800 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200/40 cursor-pointer dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Operador
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: FULL SECURE MAIN WORKSPACE
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Dynamic Left Sidebar Navigation */}
      <Navigation
        currentTab={currentTab}
        setCurrentTab={handleNavigateToTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        config={config}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Unified Top Header Bar */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-between px-6 z-10 sticky top-0 print:hidden">
          
          <div className="flex items-center gap-3">
            <span className="font-display font-extrabold text-sm tracking-wider text-slate-950 dark:text-white uppercase flex items-center gap-2">
              {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className="h-5 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-md">
                  A
                </div>
              )}
              <span>{config.companyName || 'Access Manager'}</span>
            </span>

            {/* Quick Spreadsheet connection visual indicator */}
            <div className="hidden sm:flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 px-2.5 py-1 rounded-full text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span>Conexão Sheets Ativa</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* Quick global search trigger icon */}
            <button
              onClick={() => handleNavigateToTab('search')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Pesquisa Global"
            >
              <SearchIcon size={18} />
            </button>

            {/* Light / Dark Mode toggle button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Alternar Tema"
            >
              {darkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}
            </button>

            {/* User Profile Badge & Role */}
            <div className="flex items-center gap-2 border-l pl-4 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold text-xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden md:block leading-none text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                <span className="text-[9px] text-slate-400 font-bold uppercase">{currentUser.role}</span>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="p-1.5 border border-red-100 dark:border-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/10 text-red-500 rounded-lg cursor-pointer transition-colors"
              title="Sair do Sistema"
            >
              <LogOut size={16} />
            </button>

          </div>
        </header>

        {/* Outer content container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Tabs routing matrix */}
            {currentTab === 'dashboard' && db && (
              <Dashboard
                db={db}
                currentUser={currentUser}
                darkMode={darkMode}
                onToggleFavorite={handleToggleFavorite}
                onNavigateToTab={handleNavigateToTab}
                onReserve={handleReserveLogin}
                onRelease={handleReleaseLogin}
              />
            )}

            {currentTab === 'covenants' && db && (
              <Covenants
                covenants={db.covenants}
                currentUser={currentUser}
                darkMode={darkMode}
                onSave={(item) => handleSaveItem('covenants', item)}
                onDelete={(id) => handleDeleteItem('covenants', id)}
              />
            )}

            {currentTab === 'systems' && db && (
              <Systems
                systems={db.systems}
                covenants={db.covenants}
                favorites={db.favorites}
                currentUser={currentUser}
                darkMode={darkMode}
                onSave={(item) => handleSaveItem('systems', item)}
                onDelete={(id) => handleDeleteItem('systems', id)}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            {currentTab === 'logins' && db && (
              <Logins
                logins={db.logins}
                systems={db.systems}
                covenants={db.covenants}
                currentUser={currentUser}
                darkMode={darkMode}
                initialSystemFilterId={searchFilter?.systemId || ''}
                onSave={(item) => handleSaveItem('logins', item)}
                onDelete={(id) => handleDeleteItem('logins', id)}
                onReserve={handleReserveLogin}
                onRelease={handleReleaseLogin}
                onLogAction={(actionType, targetId, targetName) => handleLogAction(actionType, 'Login', targetId, targetName)}
              />
            )}

            {currentTab === 'users' && db && (
              <Users
                users={db.users}
                covenants={db.covenants}
                currentUser={currentUser}
                darkMode={darkMode}
                onSave={(item) => handleSaveItem('users', item)}
                onDelete={(id) => handleDeleteItem('users', id)}
              />
            )}

            {currentTab === 'search' && db && (
              <Search
                covenants={db.covenants}
                systems={db.systems}
                logins={db.logins}
                currentUser={currentUser}
                darkMode={darkMode}
                onLogAction={(actionType, targetId, targetName) => {
                  const targetType = actionType === 'Abrir Sistema' ? 'System' : 'Login';
                  handleLogAction(actionType, targetType, targetId, targetName);
                }}
                onNavigateToTab={handleNavigateToTab}
              />
            )}

            {currentTab === 'history' && db && (
              <History
                logs={db.historyLogs}
                currentUser={currentUser}
                darkMode={darkMode}
              />
            )}

            {currentTab === 'reports' && db && (
              <Reports
                db={db}
                darkMode={darkMode}
              />
            )}

            {currentTab === 'import' && db && (
              <Import
                covenants={db.covenants}
                systems={db.systems}
                currentUser={currentUser}
                darkMode={darkMode}
                onImportLogins={handleImportLogins}
              />
            )}

            {currentTab === 'settings' && db && (
              <Settings
                config={db.config}
                darkMode={darkMode}
                onSaveConfig={handleSaveConfig}
                onRestoreBackup={handleRestoreBackup}
                fullState={db}
              />
            )}

          </div>
        </main>

      </div>
    </div>
  );
}
