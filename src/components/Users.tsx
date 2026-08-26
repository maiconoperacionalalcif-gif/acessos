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
  ListFilter,
  AlertCircle,
  CheckCircle2,
  UserX
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
  const isSupervisor = currentUser?.role === 'Supervisor';
  const canEdit = isAdmin || isSupervisor;
  const canDelete = isAdmin || isSupervisor;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('Todos');

  // Feedback notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' } | null>(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [selfDeleteAlert, setSelfDeleteAlert] = useState(false);
  
  // Custom states for bank input inside modal
  const [bankInput, setBankInput] = useState('');

  const showToast = (text: string, type: 'success' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

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
    setBankInput(user.allowedBanks?.join(', ') || '');
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
      showToast(`Usuário "${payload.name}" salvo com sucesso!`, 'success');
    }
  };

  const handleDeleteConfirmed = () => {
    if (!userToDelete) return;
    const deletedName = userToDelete.name;
    onDelete(userToDelete.id);
    setUserToDelete(null);
    if (editingUser?.id === userToDelete.id) {
      setIsModalOpen(false);
      setEditingUser(null);
    }
    showToast(`Usuário "${deletedName}" excluído com sucesso!`, 'success');
  };

  const cardStyle = `p-5 rounded-xl border ${
    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-md' : 'bg-white border-slate-100 text-slate-800 shadow-xs'
  }`;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
          toastMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300'
            : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-1 hover:opacity-75 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Gerenciamento de Usuários</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Cadastre colaboradores, defina níveis de acesso, configure restrições e gerencie contas.</p>
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
            <option value="Operacional">Operacional</option>
          </select>
        </div>

        <div className="text-right text-xs text-slate-400">
          Total de <strong className="text-slate-700 dark:text-slate-300">{filteredUsers.length}</strong> usuários cadastrados
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(user => {
          const isCurrentSessionUser = user.id === currentUser?.id || user.username.toLowerCase() === currentUser?.username.toLowerCase();

          return (
            <div key={user.id} className={cardStyle}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shadow-inner">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">{user.name}</h3>
                      {isCurrentSessionUser && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.2 rounded-md font-semibold">
                          Você
                        </span>
                      )}
                    </div>
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
                      {(!user.allowedCovenants || user.allowedCovenants.length === 0) ? 'Todos' : `${user.allowedCovenants.length} restritos`}
                    </span>
                  </div>
                  {user.allowedCovenants && user.allowedCovenants.length > 0 && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {user.allowedCovenants.map(cid => covenants.find(c => c.id === cid)?.name).filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Bancos Liberados:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      {(!user.allowedBanks || user.allowedBanks.length === 0) ? 'Todos' : `${user.allowedBanks.length} restritos`}
                    </span>
                  </div>
                  {user.allowedBanks && user.allowedBanks.length > 0 && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {user.allowedBanks.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-2 border-t mt-4 pt-3 dark:border-slate-800">
                {canEdit && (
                  <button
                    onClick={() => openEditModal(user)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-colors"
                  >
                    <Edit size={12} />
                    <span>Editar / Permissões</span>
                  </button>
                )}
                
                {canDelete && (
                  isCurrentSessionUser ? (
                    <button
                      onClick={() => setSelfDeleteAlert(true)}
                      className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg cursor-pointer transition-colors"
                      title="Sua conta atual em uso"
                    >
                      <Trash2 size={14} className="opacity-40" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setUserToDelete(user)}
                      className="p-1.5 border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/40 dark:hover:bg-red-950/40 dark:text-red-400 rounded-lg cursor-pointer transition-colors shadow-2xs"
                      title="Excluir Usuário"
                    >
                      <Trash2 size={14} />
                    </button>
                  )
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
                {editingUser.id && users.some(u => u.id === editingUser.id) ? 'Configuração de Usuário & Permissões' : 'Cadastrar Novo Usuário'}
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
                    <option value="Operacional">Operacional</option>
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

              <div className="flex justify-between items-center gap-2 border-t pt-4 dark:border-slate-800">
                {/* Delete button inside modal if editing existing user */}
                <div>
                  {editingUser.id && users.some(u => u.id === editingUser.id) && canDelete && (
                    editingUser.id === currentUser?.id ? (
                      <span className="text-xs text-slate-400 italic">Sua conta atual logada</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const target = users.find(u => u.id === editingUser.id);
                          if (target) {
                            setUserToDelete(target);
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/40 dark:hover:bg-red-950/40 dark:text-red-400 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Trash2 size={14} />
                        <span>Excluir Este Usuário</span>
                      </button>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2">
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
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer shadow-md transition-colors"
                    >
                      Salvar Usuário
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <h3 className="font-display font-bold text-lg mb-2 text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 size={20} />
              <span>Confirmar Exclusão de Usuário</span>
            </h3>
            
            <div className={`p-3.5 my-4 rounded-xl border ${
              darkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="font-bold text-slate-900 dark:text-white text-base">{userToDelete.name}</div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">@{userToDelete.username}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  userToDelete.role === 'Administrador' ? 'bg-red-50 text-red-600 dark:bg-red-950/20' :
                  userToDelete.role === 'Supervisor' ? 'bg-green-50 text-green-600 dark:bg-green-950/20' :
                  'bg-blue-50 text-blue-600 dark:bg-blue-950/20'
                }`}>
                  Cargo: {userToDelete.role}
                </span>
                <span className="text-[10px] text-slate-400">
                  Status: {userToDelete.status}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Tem certeza que deseja remover este usuário permanentemente do sistema? O acesso dele será revogado de imediato.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className={`px-4 py-2 border rounded-lg text-sm font-semibold cursor-pointer ${
                  darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold cursor-pointer shadow-md transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Sim, Excluir Usuário</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self Delete Warning Modal */}
      {selfDeleteAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <h3 className="font-display font-bold text-lg mb-2 text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertCircle size={20} />
              <span>Conta Atualmente em Uso</span>
            </h3>
            
            <p className="text-sm text-slate-600 dark:text-slate-300 my-4 leading-relaxed">
              Você está autenticado no momento com a conta <strong>@{currentUser?.username}</strong>. Por motivos de integridade da sessão, não é possível excluir o próprio usuário ativo.
            </p>
            <p className="text-xs text-slate-400 mb-6">
              Para excluir este usuário, faça login com outra conta de Administrador e realize a exclusão.
            </p>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelfDeleteAlert(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
