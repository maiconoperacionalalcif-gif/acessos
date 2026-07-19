import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  Shield, 
  UserCheck, 
  Lock, 
  Unlock, 
  Check,
  Building2,
  ListFilter
} from 'lucide-react';
import { User, UserRole, Covenant } from '../types';

interface UsersProps {
  users: User[];
  covenants: Covenant[];
  currentUser: User | null;
  darkMode: boolean;
  onSave: (user: User) => void;
  onDelete: (id: string) => void;
}

export default function Users({
  users,
  covenants,
  currentUser,
  darkMode,
  onSave,
  onDelete
}: UsersProps) {
  const isAdmin = currentUser?.role === 'Administrador';
  const canEdit = isAdmin || currentUser?.role === 'Supervisor';
  const canDelete = isAdmin;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('Todos');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  
  // Custom states for bank input inside modal
  const [bankInput, setBankInput] = useState('');

  const filteredUsers = useMemo(() => {
    return users.filter(usr => {
      const matchSearch = 
        usr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usr.username.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = selectedRole === 'Todos' || usr.role === selectedRole;

      return matchSearch && matchRole;
    });
  }, [users, searchTerm, selectedRole]);

  const openNewModal = () => {
    setEditingUser({
      id: `usr-${Date.now()}`,
      username: '',
      name: '',
      password: '',
      role: 'Operador',
      status: 'Ativo',
      allowedCovenants: [],
      allowedBanks: []
    });
    setBankInput('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser({ ...user });
    setBankInput(user.allowedBanks.join(', '));
    setIsModalOpen(true);
  };

  const handleToggleCovenantPermission = (covId: string) => {
    if (!editingUser) return;
    const currentList = editingUser.allowedCovenants || [];
    const newList = currentList.includes(covId)
      ? currentList.filter(id => id !== covId)
      : [...currentList, covId];
    
    setEditingUser({ ...editingUser, allowedCovenants: newList });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser && editingUser.username && editingUser.name) {
      // Parse banks
      const parsedBanks = bankInput
        .split(',')
        .map(b => b.trim())
        .filter(Boolean);

      const payload: User = {
        ...editingUser as User,
        allowedBanks: parsedBanks
      };
      onSave(payload);
      setIsModalOpen(false);
      setEditingUser(null);
    }
  };

  const cardStyle = `p-5 rounded-xl border ${
    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-md' : 'bg-white border-slate-100 text-slate-800 shadow-xs'
  }`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Gerenciamento de Usuários</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Cadastre colaboradores, defina níveis de acesso e controle permissões por convênio e banco.</p>
        </div>
        
        {canEdit && (
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>Cadastrar Usuário</span>
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className={`p-4 rounded-xl border ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'
      } grid grid-cols-1 md:grid-cols-3 gap-4 items-center`}>
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome ou login..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 border text-sm rounded-lg transition-colors focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
              darkMode 
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Role filter */}
        <div className="flex items-center gap-2">
          <ListFilter size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className={`w-full py-2 px-3 border text-sm rounded-lg ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="Todos">Todos os Níveis</option>
            <option value="Administrador">Administrador</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Operador">Operador</option>
          </select>
        </div>

        <div className="text-right text-xs text-slate-400">
          Total de <strong className="text-slate-700 dark:text-slate-300">{filteredUsers.length}</strong> usuários
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(user => {
          return (
            <div key={user.id} className={cardStyle}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shadow-inner">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">{user.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">@{user.username}</span>
                  </div>
                </div>
                
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  user.role === 'Administrador' ? 'bg-red-50 text-red-600 dark:bg-red-950/20' :
                  user.role === 'Supervisor' ? 'bg-green-50 text-green-600 dark:bg-green-950/20' :
                  'bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                }`}>
                  {user.role}
                </span>
              </div>

              {/* Status and limits overview */}
              <div className="space-y-3 pt-3 border-t dark:border-slate-800 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-semibold ${user.status === 'Ativo' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {user.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Convênios Liberados:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      {user.allowedCovenants.length === 0 ? 'Todos' : `${user.allowedCovenants.length} restritos`}
                    </span>
                  </div>
                  {user.allowedCovenants.length > 0 && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {user.allowedCovenants.map(cid => covenants.find(c => c.id === cid)?.name).filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Bancos Liberados:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      {user.allowedBanks.length === 0 ? 'Todos' : `${user.allowedBanks.length} restritos`}
                    </span>
                  </div>
                  {user.allowedBanks.length > 0 && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {user.allowedBanks.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t mt-4 pt-3 dark:border-slate-800">
                {canEdit && (
                  <button
                    onClick={() => openEditModal(user)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                  >
                    <Edit size={12} />
                    <span>Configurar Permissões</span>
                  </button>
                )}
                
                {canDelete && user.id !== currentUser?.id && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir o usuário "${user.name}"? Isso revogará o acesso dele imediatamente.`)) {
                        onDelete(user.id);
                      }
                    }}
                    className="p-1.5 border border-red-200/50 hover:bg-red-50 dark:border-red-950/20 dark:hover:bg-red-950/20 text-red-500 rounded-lg cursor-pointer"
                    title="Excluir Usuário"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Form & Permissions Modal */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-6 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          } my-8`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-800">
              <h3 className="font-display font-bold text-lg">
                Configuração de Usuário & Alocação de Acesso
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Nome Completo */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Ex: Maicon Santos"
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Login de Usuário */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Login de Acesso</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Ex: maicon.op"
                    value={editingUser.username || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Senha</label>
                  <input
                    type="text"
                    required
                    disabled={!canEdit}
                    placeholder="Defina uma senha"
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                {/* Role / Nível */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nível de Acesso (Cargo)</label>
                  <select
                    disabled={!canEdit}
                    value={editingUser.role || 'Operador'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Operador">Operador</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status da Conta</label>
                  <select
                    disabled={!canEdit}
                    value={editingUser.status || 'Ativo'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as 'Ativo' | 'Bloqueado' })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>

                {/* Allowed Banks (Allowed specific banks) */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bancos Autorizados (Separados por vírgula)</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    placeholder="Ex: Banco do Brasil, PAN, Itaú (Vazio = Todos)"
                    value={bankInput}
                    onChange={(e) => setBankInput(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Deixe em branco para liberar TODOS os bancos para este colaborador.</p>
                </div>
              </div>

              {/* Allowed Covenants Checkboxes */}
              <div className="border-t pt-4 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Convênios Autorizados</label>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setEditingUser({ ...editingUser, allowedCovenants: [] })}
                    className="text-[10px] font-bold text-blue-500 hover:underline cursor-pointer disabled:opacity-40"
                  >
                    Liberar Todos Convênios
                  </button>
                </div>
                
                <p className="text-xs text-slate-400 mb-3">Marque apenas os convênios que este operador tem permissão para visualizar. Se nenhum estiver marcado, ele verá todos.</p>
                
                <div className="grid grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                  {covenants.map(cov => {
                    const isChecked = (editingUser.allowedCovenants || []).includes(cov.id);
                    return (
                      <label 
                        key={cov.id} 
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer hover:border-blue-500/50 transition-colors ${
                          isChecked 
                            ? 'border-blue-500/40 bg-blue-50/10' 
                            : darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={isChecked}
                          onChange={() => handleToggleCovenantPermission(cov.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="font-semibold truncate">{cov.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 border rounded-lg text-sm font-semibold cursor-pointer ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cancelar
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
                  >
                    Salvar Usuário
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
