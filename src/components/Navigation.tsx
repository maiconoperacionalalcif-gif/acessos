import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Monitor, 
  KeyRound, 
  Users, 
  Search, 
  History, 
  BarChart3, 
  Upload, 
  Settings, 
  LogOut, 
  Sun, 
  Moon, 
  Menu, 
  X,
  Building2,
  Lock
} from 'lucide-react';
import { User, SystemConfig } from '../types';

interface NavigationProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  config: SystemConfig;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export default function Navigation({
  currentTab,
  setCurrentTab,
  currentUser,
  onLogout,
  config,
  darkMode,
  setDarkMode
}: NavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Administrador', 'Supervisor', 'Operador'] },
    { id: 'covenants', label: 'Convênios', icon: FileText, roles: ['Administrador', 'Supervisor', 'Operador'] },
    { id: 'systems', label: 'Sistemas', icon: Monitor, roles: ['Administrador', 'Supervisor', 'Operador'] },
    { id: 'logins', label: 'Logins', icon: KeyRound, roles: ['Administrador', 'Supervisor', 'Operador'] },
    { id: 'users', label: 'Usuários', icon: Users, roles: ['Administrador', 'Supervisor'] }, // Operators cannot manage users
    { id: 'search', label: 'Pesquisa Global', icon: Search, roles: ['Administrador', 'Supervisor', 'Operador'] },
    { id: 'history', label: 'Histórico', icon: History, roles: ['Administrador', 'Supervisor'] }, // Operators cannot view history logs
    { id: 'reports', label: 'Relatórios', icon: BarChart3, roles: ['Administrador', 'Supervisor', 'Operador'] },
    { id: 'import', label: 'Importação', icon: Upload, roles: ['Administrador'] }, // Only admins can import
    { id: 'settings', label: 'Configurações', icon: Settings, roles: ['Administrador', 'Supervisor'] }
  ];

  const visibleItems = menuItems.filter(item => 
    currentUser && item.roles.includes(currentUser.role)
  );

  const sidebarBg = darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800';
  const itemHover = darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-600';
  const itemActive = 'bg-blue-500 text-white hover:bg-blue-600';

  return (
    <>
      {/* Mobile Top Header */}
      <header className={`lg:hidden flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} z-30 relative`}>
        <div className="flex items-center gap-2">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-8 w-8 object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <Lock size={18} />
            </div>
          )}
          <span className="font-display font-bold text-lg tracking-tight">
            {config.companyName || 'Access Manager'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-800 text-yellow-400' : 'hover:bg-slate-100 text-slate-500'}`}
            id="mobile-dark-toggle"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => setMobileOpen(!mobileOpen)} 
            className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
            id="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar for Desktop & Mobile Overlay */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 border-r transition-transform duration-300 transform
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarBg} flex flex-col justify-between h-full pt-16 lg:pt-0
      `}>
        {/* Top Section */}
        <div className="flex flex-col flex-1 overflow-y-auto px-4 py-4">
          {/* Logo Brand on Desktop */}
          <div className="hidden lg:flex items-center gap-2 px-2 py-3 mb-6">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-9 w-9 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md">
                <Lock size={20} />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-display font-bold text-base tracking-tight leading-none text-blue-600 dark:text-blue-400">
                {config.companyName || 'Access Manager'}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase mt-1 tracking-wider">
                Consignado Portal
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {visibleItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive ? itemActive : itemHover
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section - User Profile */}
        <div className={`p-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                {currentUser?.name.charAt(0) || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold truncate max-w-[120px]">
                  {currentUser?.name || 'Usuário'}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full w-max mt-0.5 ${
                  currentUser?.role === 'Administrador' 
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' 
                    : currentUser?.role === 'Supervisor'
                    ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                }`}>
                  {currentUser?.role || 'Operador'}
                </span>
              </div>
            </div>

            {/* Desktop Theme Switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`hidden lg:flex p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-800 text-yellow-400' : 'hover:bg-slate-100 text-slate-500'}`}
              title={darkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
              id="desktop-dark-toggle"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <button
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              darkMode 
                ? 'border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-900/50 hover:bg-red-950/20' 
                : 'border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-100 hover:bg-red-50'
            }`}
            id="nav-logout"
          >
            <LogOut size={14} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Overlay to close mobile sidebar */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-30" 
        />
      )}
    </>
  );
}
