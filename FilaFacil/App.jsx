import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Settings, Users, UserPlus, LogOut, MonitorPlay,
  ClipboardList, Stethoscope, ArrowRight, CheckCircle2,
  AlertCircle, Volume2, Trash2, Lock, Mail, RotateCcw
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, onSnapshot,
  updateDoc, addDoc, deleteDoc, serverTimestamp,
  query, where
} from 'firebase/firestore';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'health-queue-demo';

// Sua configuração real do Firebase substituindo a configuração de demonstração
const firebaseConfig = {
  apiKey: "AIzaSyAG-Mjq63EPDtZ5YLgCxUqIK3A6Ku4Q4T4",
  authDomain: "filafacil-c341a.firebaseapp.com",
  projectId: "filafacil-c341a",
  storageBucket: "filafacil-c341a.firebasestorage.app",
  messagingSenderId: "1062732962693",
  appId: "1:1062732962693:web:622538c10a3106aa0c02ec"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências de Coleção
const BASE_PATH = `artifacts/${appId}/public/data`;
const COLL_USERS = collection(db, `${BASE_PATH}/users`); // Tabela de Funcionários (Permanente)
const COLL_PATIENTS = collection(db, `${BASE_PATH}/patients`); // Fila temporária
const DOC_CONFIG = doc(db, `${BASE_PATH}/config`, 'main');

const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 1);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

const globalStyles = `
  @keyframes scaleUp {
    0% { transform: scale(0.5); opacity: 0; }
    80% { transform: scale(1.05); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .scale-up-text {
    animation: scaleUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes superZoom {
    0% { transform: scale(0.2); opacity: 0; }
    60% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-super-zoom {
    animation: superZoom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

export default function App() {
  const [isFirebaseAuth, setIsFirebaseAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [usersList, setUsersList] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [config, setConfig] = useState({
    unitName: 'Unidade de Saúde FilaFácil',
    tickerMsg: 'Bem-vindo à nossa unidade. Tenha em mãos seu documento de identidade.'
  });

  // Autenticação Base (Anônima ou Customizada)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        setIsFirebaseAuth(true);
      } catch (err) {
        console.error('Erro de autenticação:', err);
      }
    };
    initAuth();
  }, []);

  // Inscrição nos Dados em Tempo Real
  useEffect(() => {
    if (!isFirebaseAuth) return;

    const unsubConfig = onSnapshot(DOC_CONFIG, (docSnap) => {
      if (docSnap.exists()) setConfig(docSnap.data());
      else setDoc(DOC_CONFIG, config);
    });

    const unsubUsers = onSnapshot(COLL_USERS, async (snapshot) => {
      const users = [];
      snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
      
      // Cria usuário Admin padrão se a tabela estiver vazia
      if (users.length === 0) {
        const defaultAdmin = {
          name: 'Administrador Principal',
          email: 'admin@admin.com',
          password: 'admin',
          accessType: 'admin',
          createdAt: serverTimestamp()
        };
        await addDoc(COLL_USERS, defaultAdmin);
      } else {
        setUsersList(users);
      }
    });

    const unsubPatients = onSnapshot(COLL_PATIENTS, (snapshot) => {
      const pats = [];
      snapshot.forEach(doc => pats.push({ id: doc.id, ...doc.data() }));
      setPatientsList(pats);
    });

    return () => { unsubConfig(); unsubUsers(); unsubPatients(); };
  }, [isFirebaseAuth]);

  const staffList = useMemo(() => {
    return usersList.filter(u => u.accessType === 'professional');
  }, [usersList]);

  const handleLogin = (user) => setCurrentUser(user);
  const handleLogout = () => setCurrentUser(null);

  if (!isFirebaseAuth || usersList.length === 0) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-xl font-medium text-slate-500">Inicializando sistema de banco de dados...</div>;
  }

  if (!currentUser) {
    return <LoginScreen usersList={usersList} onLogin={handleLogin} />;
  }

  if (currentUser.accessType === 'panel_view') {
    return (
      <>
        <style>{globalStyles}</style>
        <PublicPanel config={config} staffList={staffList} patientsList={patientsList} onExit={handleLogout} />
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div className="flex flex-col h-screen bg-slate-100 font-sans">
        <header className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg"><Stethoscope className="w-5 h-5 text-white" /></div>
            <h1 className="text-xl font-bold tracking-wide">{config.unitName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="font-bold text-sm">{currentUser.name}</span>
              <span className="text-xs text-blue-200">
                {currentUser.accessType === 'admin' ? 'Administração' : 
                 currentUser.accessType === 'reception' ? 'Recepção' : 
                 `${currentUser.role} ${currentUser.room ? `• ${currentUser.room}` : ''}`}
              </span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 px-4 py-2 rounded-lg transition font-medium border border-blue-600 shadow-inner">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {currentUser.accessType === 'admin' && (
            <AdminDashboard config={config} usersList={usersList} patientsList={patientsList} />
          )}
          {currentUser.accessType === 'reception' && (
            <ReceptionDashboard staffList={staffList} patientsList={patientsList} />
          )}
          {currentUser.accessType === 'professional' && (
            <ProfessionalDashboard currentUser={currentUser} staffList={staffList} patientsList={patientsList} />
          )}
        </main>
      </div>
    </>
  );
}

function LoginScreen({ usersList, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    const user = usersList.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    
    if (user) onLogin(user);
    else setError('E-mail ou senha incorretos.');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-blue-700 p-8 text-center">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">FilaFácil</h1>
          <p className="text-blue-200 mt-2 font-medium">Acesso Restrito ao Sistema</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-sm font-bold rounded-r">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">E-mail de Acesso</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" 
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white font-bold text-lg py-3 rounded-lg hover:bg-blue-700 transition shadow-md mt-2">
              Entrar
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button onClick={() => onLogin({ accessType: 'panel_view' })} className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition flex justify-center items-center gap-2">
              <MonitorPlay className="w-5 h-5"/> Abrir TV (Painel Público)
            </button>
            <p className="text-xs text-center text-slate-400 mt-3">Utilize este botão no computador conectado à TV da sala de espera.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ config, usersList, patientsList }) {
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', accessType: 'professional', role: 'Médico Clínico', room: '' });
  const [editingConfig, setEditingConfig] = useState({ ...config });
  const [successMsg, setSuccessMsg] = useState('');

  const saveConfig = async () => {
    try {
      await updateDoc(DOC_CONFIG, editingConfig);
      showSuccess("Configurações salvas!");
    } catch (e) { alert("Erro ao salvar."); }
  };

  const addUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return;
    
    if (usersList.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
      alert("Este e-mail já está em uso por outro usuário!");
      return;
    }

    try {
      const userData = { ...newUser, createdAt: serverTimestamp() };
      if (userData.accessType !== 'professional') {
        delete userData.role;
        delete userData.room;
      }
      await addDoc(COLL_USERS, userData);
      setNewUser({ name: '', email: '', password: '', accessType: 'professional', role: 'Médico Clínico', room: '' });
      showSuccess("Usuário cadastrado com sucesso!");
    } catch (e) { console.error(e); }
  };

  const removeUser = async (id, email) => {
    if(email === 'admin@admin.com') {
      alert("Não é possível excluir o administrador padrão.");
      return;
    }
    if(confirm("Deseja realmente excluir este usuário e revogar seu acesso?")) {
      await deleteDoc(doc(db, `${BASE_PATH}/users`, id));
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {successMsg && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg font-bold shadow-sm">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600"/> Configurações da Unidade
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Unidade de Saúde</label>
              <input type="text" value={editingConfig.unitName} onChange={e => setEditingConfig({...editingConfig, unitName: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Avisos do Painel (Revezamento automático)</label>
              <textarea 
                rows="4" value={editingConfig.tickerMsg} onChange={e => setEditingConfig({...editingConfig, tickerMsg: e.target.value})} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Pressione ENTER para separar cada aviso em uma linha."
              />
            </div>
            <button onClick={saveConfig} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-bold shadow-sm">
              Salvar Configurações
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600"/> Situação Atual
          </h2>
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <div className="text-5xl font-black text-blue-700">{patientsList.filter(p => p.status === 'waiting' || p.status === 'called' || p.status === 'in_progress').length}</div>
              <div className="text-sm font-bold text-blue-600 mt-1">Pacientes no fluxo atual</div>
            </div>
            <div className="text-right max-w-[200px] text-xs text-blue-500 font-medium">
              * Para não armazenar histórico e garantir a privacidade, os dados dos pacientes são automaticamente deletados do banco de dados ao finalizar o atendimento.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600"/> Cadastrar Novo Funcionário / Acesso
        </h2>
        
        <form onSubmit={addUser} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
              <input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">E-mail (Login)</label>
              <input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Senha</label>
              <input required type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Acesso</label>
              <select value={newUser.accessType} onChange={e => setNewUser({...newUser, accessType: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="professional">Profissional de Saúde (Médico/Enf)</option>
                <option value="reception">Recepção / Triagem</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            
            {newUser.accessType === 'professional' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Especialidade / Perfil</label>
                  <input type="text" required value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} placeholder="Ex: Pediatra" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Local (Opcional)</label>
                  <input type="text" value={newUser.room} onChange={e => setNewUser({...newUser, room: e.target.value})} placeholder="Ex: Consultório 3" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <button type="submit" className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition font-bold flex items-center gap-2 shadow-sm">
              <UserPlus className="w-5 h-5"/> Criar Usuário
            </button>
          </div>
        </form>

        <h3 className="font-bold text-slate-700 mb-3 border-b pb-2">Tabela de Funcionários Registrados</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left bg-white">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-sm text-slate-600 font-bold">
                <th className="p-3">Nome / Perfil</th>
                <th className="p-3">Login (E-mail)</th>
                <th className="p-3">Senha</th>
                <th className="p-3">Localização</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersList.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{user.name}</div>
                    <div className="text-xs text-blue-600 font-bold uppercase">
                      {user.accessType === 'admin' ? 'Administrador' : user.accessType === 'reception' ? 'Recepção' : user.role}
                    </div>
                  </td>
                  <td className="p-3 font-medium text-slate-600">{user.email}</td>
                  <td className="p-3 font-mono text-sm text-slate-400">{user.password}</td>
                  <td className="p-3">
                    {user.room ? <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold border">{user.room}</span> : '-'}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => removeUser(user.id, user.email)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition" title="Remover">
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReceptionDashboard({ staffList, patientsList }) {
  const [newPatientName, setNewPatientName] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isPriority, setIsPriority] = useState(false);

  const sortedStaff = [...staffList].sort((a, b) => a.name.localeCompare(b.name));

  const addPatient = async (e) => {
    e.preventDefault();
    if (!newPatientName.trim() || !selectedStaffId) return;
    try {
      await addDoc(COLL_PATIENTS, {
        name: newPatientName.trim().toUpperCase(),
        staffId: selectedStaffId,
        priority: isPriority,
        status: 'waiting',
        createdAt: serverTimestamp(),
      });
      setNewPatientName('');
      setIsPriority(false);
    } catch (err) { console.error("Erro", err); }
  };

  const getQueueCount = (staffId) => {
    return patientsList.filter(p => p.staffId === staffId && (p.status === 'waiting' || p.status === 'called')).length;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 border-t-4 border-t-green-500">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-green-600"/> Inserir Paciente na Fila
        </h2>

        <form onSubmit={addPatient} className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo do Paciente</label>
            <input 
              required type="text" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} 
              placeholder="Digite o nome do paciente" className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-lg font-medium uppercase" 
            />
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-bold text-slate-700 mb-1">Encaminhar para</label>
            <select 
              required value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)} 
              className="w-full p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none bg-white font-medium"
            >
              <option value="" disabled>Selecione o destino...</option>
              {sortedStaff.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-4">
            <input 
              type="checkbox" id="priority" checked={isPriority} onChange={e => setIsPriority(e.target.checked)} 
              className="w-6 h-6 text-green-600 rounded cursor-pointer accent-green-600"
            />
            <label htmlFor="priority" className="text-sm font-bold text-red-600 cursor-pointer select-none">Prioridade</label>
          </div>
          <button type="submit" className="w-full md:w-auto bg-green-600 text-white px-8 py-3.5 rounded-xl hover:bg-green-700 transition font-bold text-lg shadow-md">
            Inserir na Fila
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600"/> Monitoramento de Filas Atuais
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedStaff.map(staff => {
            const count = getQueueCount(staff.id);
            return (
              <div key={staff.id} className={`p-5 rounded-xl border transition ${count > 5 ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="font-bold text-slate-800 truncate text-lg">{staff.name}</div>
                {staff.room && <div className="text-sm font-medium text-slate-500 mb-3">{staff.room}</div>}
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-200">
                  <span className="text-sm font-bold text-slate-600">Aguardando:</span>
                  <span className={`text-2xl font-black ${count > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{count}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}

function ProfessionalDashboard({ currentUser, staffList, patientsList }) {
  const [forwardModalData, setForwardModalData] = useState(null);
  const [quickName, setQuickName] = useState('');
  const [quickPriority, setQuickPriority] = useState(false);

  const myQueue = useMemo(() => {
    return patientsList
      .filter(p => p.staffId === currentUser.id && (p.status === 'waiting' || p.status === 'called'))
      .sort((a, b) => {
        if (a.status === 'called' && b.status !== 'called') return -1;
        if (a.status !== 'called' && b.status === 'called') return 1;
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
  }, [patientsList, currentUser.id]);

  const activePatient = patientsList.find(p => p.staffId === currentUser.id && p.status === 'in_progress');

  const addQuickPatient = async (e) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    try {
      await addDoc(COLL_PATIENTS, {
        name: quickName.trim().toUpperCase(),
        staffId: currentUser.id,
        priority: quickPriority,
        status: 'waiting',
        createdAt: serverTimestamp(),
      });
      setQuickName('');
      setQuickPriority(false);
    } catch (err) { console.error("Erro", err); }
  };

  const callPatient = async (patient) => {
    const currentlyCalling = myQueue.find(p => p.status === 'called');
    if (currentlyCalling && currentlyCalling.id !== patient.id) {
       await updateDoc(doc(db, `${BASE_PATH}/patients`, currentlyCalling.id), { status: 'waiting' });
    }
    await updateDoc(doc(db, `${BASE_PATH}/patients`, patient.id), { 
      status: 'called', calledAt: serverTimestamp() 
    });
  };

  const confirmEntry = async (patientId) => {
    await updateDoc(doc(db, `${BASE_PATH}/patients`, patientId), { status: 'in_progress' });
  };
  
  const returnToQueue = async (patientId) => {
     // Devolve o paciente para a fila de espera (sai da tela da TV)
     await updateDoc(doc(db, `${BASE_PATH}/patients`, patientId), { status: 'waiting' });
  };

  const finishConsultation = async (patientId) => {
    // ATENÇÃO: Aqui o paciente é COMPLETAMENTE APAGADO do banco de dados, garantindo que não haja histórico.
    await deleteDoc(doc(db, `${BASE_PATH}/patients`, patientId));
  };

  const forwardPatient = async (patientId, newStaffId) => {
    await updateDoc(doc(db, `${BASE_PATH}/patients`, patientId), { status: 'waiting', staffId: newStaffId });
    setForwardModalData(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 border-t-4 border-t-slate-800">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Inserir Paciente na Minha Fila</h3>
        <form onSubmit={addQuickPatient} className="flex flex-col sm:flex-row gap-3 items-center">
          <input 
            type="text" value={quickName} onChange={e => setQuickName(e.target.value)} 
            placeholder="Nome completo do paciente..." required
            className="flex-1 w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-800 outline-none font-bold uppercase"
          />
          <label className="flex items-center gap-2 cursor-pointer font-bold text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100 whitespace-nowrap">
            <input type="checkbox" checked={quickPriority} onChange={e => setQuickPriority(e.target.checked)} className="w-5 h-5 accent-red-600" />
            Prioridade
          </label>
          <button type="submit" className="w-full sm:w-auto bg-slate-800 text-white font-bold px-8 py-3 rounded-lg hover:bg-slate-700 transition shadow-sm whitespace-nowrap">
            Adicionar à Fila
          </button>
        </form>
      </div>

      {activePatient && (
        <div className="bg-blue-600 rounded-xl shadow-lg border border-blue-700 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Stethoscope size={120} /></div>
          <div className="relative z-10">
            <div className="text-blue-200 font-bold mb-1 uppercase tracking-widest text-sm">Em Consulta Agora</div>
            <div className="text-4xl lg:text-5xl font-black mb-6 drop-shadow-md">{activePatient.name}</div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => finishConsultation(activePatient.id)} className="bg-white text-blue-700 px-6 py-3 rounded-xl font-black hover:bg-blue-50 transition shadow-md">
                Finalizar Atendimento
              </button>
              <button onClick={() => setForwardModalData({ patientId: activePatient.id })} className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold border border-blue-400 hover:bg-blue-400 transition shadow-sm">
                Encaminhar para Colega...
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600"/> Sua Fila de Espera
          </h2>
          <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-sm font-bold border border-blue-200">
            Total: {myQueue.length}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {myQueue.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center">
              <ClipboardList className="w-16 h-16 mb-3 opacity-50" />
              <span className="text-lg font-medium">Sua fila está vazia no momento.</span>
            </div>
          ) : (
            myQueue.map((patient, index) => (
              <div key={patient.id} className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${patient.status === 'called' ? 'bg-amber-50/50 border-l-4 border-amber-500' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm shrink-0 border border-slate-200">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-black text-lg text-slate-800 flex items-center gap-2">
                      {patient.name}
                      {patient.priority && <span className="bg-red-100 text-red-700 text-[10px] uppercase font-black px-2 py-0.5 rounded border border-red-200">Prioridade</span>}
                      {patient.status === 'called' && <span className="bg-amber-200 text-amber-800 text-[10px] uppercase font-black px-2 py-0.5 rounded animate-pulse border border-amber-300">Chamando...</span>}
                    </div>
                    <div className="text-xs text-slate-400 font-bold">
                      Aguardando desde: {patient.createdAt ? new Date(patient.createdAt.toMillis()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '...'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {patient.status === 'waiting' && (
                    <button onClick={() => callPatient(patient)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-sm">
                      <Volume2 className="w-4 h-4"/> Chamar na TV
                    </button>
                  )}
                  {patient.status === 'called' && (
                    <>
                      <button onClick={() => returnToQueue(patient.id)} className="text-slate-500 hover:text-amber-600 p-2.5 rounded-lg hover:bg-amber-50 transition border border-transparent hover:border-amber-200" title="Voltar para a Fila (Não respondeu)">
                        <RotateCcw className="w-5 h-5"/>
                      </button>
                      <button onClick={() => callPatient(patient)} className="bg-amber-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-amber-600 transition flex items-center gap-2 shadow-sm">
                        <Volume2 className="w-4 h-4"/> Forçar Chamada Agora
                      </button>
                      <button onClick={() => confirmEntry(patient.id)} className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition flex items-center gap-2 shadow-sm">
                        <CheckCircle2 className="w-4 h-4"/> Entrou na Sala
                      </button>
                    </>
                  )}
                  <button onClick={() => setForwardModalData({ patientId: patient.id })} className="text-slate-400 hover:text-blue-600 p-2.5 rounded-lg hover:bg-blue-50 transition border border-transparent hover:border-blue-100" title="Encaminhar">
                    <ArrowRight className="w-5 h-5"/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {forwardModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-pop-in">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Encaminhar Paciente</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Selecione para qual colega deseja enviar o paciente <b className="text-slate-800">{patientsList.find(p=>p.id === forwardModalData.patientId)?.name}</b>.</p>
            
            <div className="space-y-2 max-h-72 overflow-y-auto mb-6 pr-2">
              {staffList.filter(s => s.id !== currentUser.id).sort((a,b)=>a.name.localeCompare(b.name)).map(staff => (
                <button 
                  key={staff.id} 
                  onClick={() => forwardPatient(forwardModalData.patientId, staff.id)}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-400 transition group"
                >
                  <div className="font-bold text-slate-800 group-hover:text-blue-700">{staff.name}</div>
                  <div className="text-xs text-slate-500 font-bold mt-1">{staff.role}{staff.room ? ` • ${staff.room}` : ''}</div>
                </button>
              ))}
            </div>
            
            <button onClick={() => setForwardModalData(null)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PublicPanel({ config, staffList, patientsList, onExit }) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const prevCalledIds = useRef(new Set());
  const [currentCall, setCurrentCall] = useState(null);
  const audioIntervalRef = useRef(null);

  const staffMap = useMemo(() => {
    return staffList.reduce((acc, staff) => { acc[staff.id] = staff; return acc; }, {});
  }, [staffList]);

  const waitingList = useMemo(() => {
    return patientsList
      .filter(p => p.status === 'waiting')
      .sort((a, b) => {
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
  }, [patientsList]);

  useEffect(() => {
    const currentlyCalled = patientsList.filter(p => p.status === 'called').sort((a, b) => (a.calledAt?.toMillis() || 0) - (b.calledAt?.toMillis() || 0));
    const newCalls = currentlyCalled.filter(p => !prevCalledIds.current.has(p.id));
    prevCalledIds.current = new Set(currentlyCalled.map(p => p.id));

    if (newCalls.length > 0) {
      const latestCall = newCalls[newCalls.length - 1]; 
      const staffInfo = staffMap[latestCall.staffId];

      if (staffInfo) {
        
        // Função para executar a fala e o som
        const playCallAudio = () => {
           if (audioEnabled) {
              playChime();
              setTimeout(() => {
                 const msgFala = `Paciente, ${latestCall.name}. Por favor, dirigir-se ao atendimento com, ${staffInfo.name}${staffInfo.room ? `, ${staffInfo.room}` : ''}.`;
                 const utterance = new SpeechSynthesisUtterance(msgFala);
                 utterance.lang = 'pt-BR';
                 utterance.rate = 0.85;
                 utterance.pitch = 1;
                 window.speechSynthesis.speak(utterance);
              }, 1000);
           }
        };

        // Toca a primeira vez
        playCallAudio();
        
        // Define o intervalo para repetir a cada 15 segundos
        if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = setInterval(() => {
           playCallAudio();
           // Força uma re-renderização sutil para recomeçar a animação na tela
           setCurrentCall(prev => prev ? { ...prev, renderKey: latestCall.id + Date.now() } : null);
        }, 15000);
        
        setCurrentCall({ 
           patient: latestCall, 
           staff: staffInfo,
           renderKey: latestCall.id + Date.now() 
        });
      }
    } else if (currentlyCalled.length > 0) {
       const last = currentlyCalled[currentlyCalled.length - 1];
       if(!currentCall || currentCall.patient.id !== last.id){
           setCurrentCall({ patient: last, staff: staffMap[last.staffId], renderKey: last.id });
       }
    } else {
       // Se não tem ninguém sendo chamado, limpa o intervalo de áudio e a tela
       if (audioIntervalRef.current) {
          clearInterval(audioIntervalRef.current);
          audioIntervalRef.current = null;
       }
       setCurrentCall(null);
    }
    
    // Limpeza ao desmontar o componente para evitar vazamento de memória
    return () => {
       if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [patientsList, staffMap, audioEnabled]);

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!audioEnabled) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center">
        <MonitorPlay className="w-24 h-24 text-blue-500 mb-6" />
        <h1 className="text-4xl font-black mb-4">Painel da Sala de Espera</h1>
        <p className="text-xl text-slate-300 mb-8 max-w-2xl font-medium">Clique no botão abaixo para permitir alertas sonoros e voz do navegador nesta TV.</p>
        <button onClick={() => setAudioEnabled(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-full text-2xl font-black shadow-[0_0_30px_rgba(37,99,235,0.5)] transition flex items-center gap-3">
          <Volume2 className="w-8 h-8"/> Iniciar Painel com Áudio
        </button>
        <button onClick={onExit} className="mt-8 text-slate-500 hover:text-white underline font-bold">Voltar ao Login</button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden font-sans relative">
      <button onClick={onExit} className="absolute top-4 right-4 w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center z-50 text-white/30 hover:text-white transition">
        <LogOut className="w-5 h-5"/>
      </button>

      {/* HEADER */}
      <header className="h-[12%] min-h-[90px] bg-slate-900 flex items-center justify-between px-10 border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-5">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-900/50">
            <Stethoscope className="w-10 h-10 text-white" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-black tracking-tight text-white">{config.unitName}</h1>
            <p className="text-blue-400 text-sm font-bold tracking-[0.2em] uppercase mt-0.5">Atendimento à Saúde</p>
          </div>
        </div>
        <div className="text-right flex flex-col justify-center pr-16">
          <div className="text-5xl font-black tabular-nums tracking-tighter text-white">{time.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
          <div className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">{time.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
        </div>
      </header>

      {/* MAIN AREA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        <section className="flex-1 relative flex flex-col items-center justify-center overflow-hidden p-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          
          {currentCall ? (
            <div key={currentCall.renderKey} className="w-full max-w-7xl animate-super-zoom">
               <div className="bg-slate-900 border border-slate-700 p-12 rounded-[3rem] shadow-2xl text-center relative overflow-hidden ring-4 ring-blue-500/50">
                  
                  <div className="flex justify-center mb-8">
                     <div className="bg-blue-600 text-white px-10 py-3 rounded-full text-2xl font-black uppercase tracking-[0.3em] flex items-center gap-4 animate-pulse">
                        <Volume2 className="w-8 h-8" /> Atenção
                     </div>
                  </div>
                  
                  <h2 className="text-4xl text-slate-400 font-bold uppercase tracking-widest mb-4">Paciente</h2>
                  <div className="text-8xl lg:text-[8rem] xl:text-[9rem] font-black text-yellow-400 mb-12 leading-none tracking-tight drop-shadow-md">
                    {currentCall.patient.name}
                  </div>
                  
                  <div className="bg-slate-800 rounded-[2rem] p-10 border border-slate-700 inline-block min-w-[70%] shadow-inner">
                    <div className="text-3xl text-slate-400 mb-4 font-bold uppercase tracking-widest">Dirija-se a:</div>
                    
                    {currentCall.staff.room ? (
                      <>
                        <div className="text-7xl lg:text-8xl font-black text-emerald-400 drop-shadow-md mb-4">
                          {currentCall.staff.room}
                        </div>
                        <div className="text-4xl text-white font-bold opacity-90">
                          {currentCall.staff.name}
                        </div>
                      </>
                    ) : (
                      <div className="text-6xl lg:text-7xl font-black text-emerald-400 drop-shadow-md">
                        {currentCall.staff.name}
                      </div>
                    )}
                  </div>
               </div>
            </div>
          ) : (
            <div className="text-slate-700 flex flex-row items-center justify-center gap-8 opacity-40">
               <div className="bg-slate-900 p-8 rounded-full shadow-inner">
                 <MonitorPlay size={80} />
               </div>
               <h2 className="text-5xl font-black tracking-[0.2em] uppercase">Aguardando Chamadas</h2>
            </div>
          )}

        </section>

        {/* FILA DE ESPERA - HORIZONTAL */}
        <aside className="h-[25vh] min-h-[220px] bg-slate-900/80 border-t border-slate-800 flex flex-col z-10 shrink-0">
          <div className="bg-slate-800/50 text-blue-400 uppercase tracking-widest text-sm font-black p-3 flex justify-between shadow-sm border-b border-slate-800/50">
            <span className="ml-4">Próximos da Fila</span>
            <span className="bg-slate-900 px-3 py-1 rounded text-white mr-4">Total: {waitingList.length}</span>
          </div>
          
          <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide p-6 flex gap-6 items-center">
            {waitingList.map((patient, i) => {
              const staff = staffMap[patient.staffId];
              return (
                <div key={patient.id} className="w-[350px] shrink-0 bg-slate-800 p-5 rounded-2xl flex flex-col justify-center border-b-4 border-transparent hover:border-blue-500 transition-colors h-full shadow-lg relative">
                  
                  {patient.priority && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs uppercase font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1 z-10">
                      <AlertCircle className="w-3 h-3"/> Prioridade
                    </div>
                  )}

                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-3xl font-black text-slate-600 w-10 shrink-0 opacity-50">
                      {i + 1}º
                    </div>
                    <div className="text-2xl font-bold text-white truncate max-w-[250px]">
                      {patient.name}
                    </div>
                  </div>
                  
                  <div className="ml-14 text-slate-400 font-bold text-lg truncate bg-slate-900/50 px-3 py-1.5 rounded-lg inline-block w-fit max-w-[240px]">
                    {staff?.name}
                  </div>
                </div>
              )
            })}
            {waitingList.length === 0 && (
              <div className="w-full h-full flex flex-row items-center justify-center text-slate-600 gap-4">
                <ClipboardList className="w-12 h-12 opacity-50" />
                <p className="text-2xl font-bold uppercase tracking-widest opacity-50">Nenhum paciente na fila de espera</p>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* FOOTER: Aviso Rotativo */}
      <footer className="h-20 bg-blue-600 flex items-center overflow-hidden shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        <div className="bg-blue-700 text-white h-full px-8 flex items-center font-black text-2xl tracking-widest uppercase shrink-0 z-10 shadow-xl border-r border-blue-500">
          Informativo
        </div>
        <div className="flex-1 whitespace-nowrap overflow-hidden relative h-full bg-blue-600 flex items-center">
          <style>{`
            @keyframes ticker {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
            .animate-ticker {
              animation: ticker 60s linear infinite;
              display: inline-block;
              padding-right: 50vw;
            }
          `}</style>
          <div className="animate-ticker text-white text-3xl font-bold pt-1 drop-shadow-md">
             {(config.tickerMsg || '').split('\n').filter(m => m.trim() !== '').join(' ✦ ')} ✦ {(config.tickerMsg || '').split('\n').filter(m => m.trim() !== '').join(' ✦ ')}
          </div>
        </div>
      </footer>
    </div>
  );
}