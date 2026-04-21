import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { 
  Users, 
  Baby, 
  Calendar, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Download, 
  AlertTriangle,
  Search,
  Info,
  AlertCircle,
  Cloud,
  CloudOff,
  Loader2,
  X,
  Edit2,
  Check,
  RotateCcw
} from 'lucide-react';
const auth = getAuth();
const uid = auth.currentUser.uid;
// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyAPfRV9LiR_5tMf_MGVtwmk_OckT_7aXDo",
  authDomain: "maternity-hr-9812e.firebaseapp.com",
  projectId: "maternity-hr-9812e",
  storageBucket: "maternity-hr-9812e.firebasestorage.app",
  messagingSenderId: "660413226632",
  appId: "1:660413226632:web:c819f62459a7f585b7493d"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'maternity-hr-prod';

// --- Utility Functions ---

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('it-IT');
};

const calculateDays = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = e - s;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
};

// Calcola quanti giorni di un periodo cadono in un determinato mese filtrato
const calculateDaysInMonth = (start, end, filterMonth) => {
  if (!start || !end || !filterMonth) return calculateDays(start, end);
  
  const [year, month] = filterMonth.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // Ultimo giorno del mese
  
  const periodStart = new Date(start);
  const periodEnd = new Date(end);
  
  // Impostiamo le ore a mezzanotte per evitare errori di calcolo dovuti all'ora legale o fusi orari
  monthStart.setHours(0, 0, 0, 0);
  monthEnd.setHours(0, 0, 0, 0);
  periodStart.setHours(0, 0, 0, 0);
  periodEnd.setHours(0, 0, 0, 0);

  // Trova l'intersezione tra il periodo e il mese filtrato
  const intersectionStart = periodStart < monthStart ? monthStart : periodStart;
  const intersectionEnd = periodEnd > monthEnd ? monthEnd : periodEnd;
  
  if (intersectionStart > intersectionEnd) return 0;
  
  // Calcolo preciso della differenza in giorni
  const diffTime = intersectionEnd.getTime() - intersectionStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  return Math.max(0, diffDays);
};

const getBreastfeedingEnd = (birthDate) => {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
};

const isCurrentMonth = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const checkOverlap = (periods, newPeriod, excludeId = null) => {
  const start = new Date(newPeriod.start);
  const end = new Date(newPeriod.end);
  
  return periods.some(p => {
    if (excludeId && p.id === excludeId) return false;
    const pStart = new Date(p.start);
    const pEnd = new Date(p.end);
    return (start <= pEnd && end >= pStart);
  });
};

// --- Main Component ---

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('anagrafica');
  const [moms, setMoms] = useState([]);
  const [maternityPeriods, setMaternityPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [isAddingMom, setIsAddingMom] = useState(false);

  // Filters
  const [momSearch, setMomSearch] = useState('');
  const [showOnlyWarnings, setShowOnlyWarnings] = useState(false);
  const [dashSearch, setDashSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterType, setFilterType] = useState('All');

  // --- Auth & Sync Logic ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth failed:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const momsCol = collection( db,'artifacts',appId, 'users',uid,'moms');

    const periodsCol = collection(db, 'artifacts', appId, 'users',uid, 'periods');

    const unsubMoms = onSnapshot(momsCol, (snapshot) => {
      setMoms(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    }, (err) => console.error("Snapshot error:", err));

    const unsubPeriods = onSnapshot(periodsCol, (snapshot) => {
      setMaternityPeriods(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (err) => console.error("Snapshot error:", err));

    return () => {
      unsubMoms();
      unsubPeriods();
    };
  }, [user]);

  // --- Actions ---

  const handleAddMom = async (momData) => {
    if (!user) return;
    try {
      const momsCol = collection(db,'artifacts',appId,'users',uid,'moms');

      await addDoc(momsCol, { ...momData, children: [] });
      setIsAddingMom(false);
    } catch (e) {
      console.error(e);
    }
  };

  const updateMom = async (momId, updatedData) => {
    if (!user) return;
    try {
      const momRef = doc(db, 'artifacts', appId, 'public', 'data', 'moms', momId);
      await setDoc(momRef, updatedData, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMom = async (id) => {
    if (!user) return;
    const momPeriods = maternityPeriods.filter(p => p.momId === id);
    
    const confirmed = confirm("Eliminare questa mamma? Tutti i figli e i periodi associati verranno rimossi.");
    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'moms', id));
        for (const p of momPeriods) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'periods', p.id));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const addChild = async (momId, child) => {
    if (!user) return;
    const mom = moms.find(m => m.id === momId);
    if (!mom) return;
    const newChildren = [...(mom.children || []), { ...child, id: crypto.randomUUID() }];
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'moms', momId), {
        ...mom,
        children: newChildren
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateChild = async (momId, updatedChild) => {
    if (!user) return;
    const mom = moms.find(m => m.id === momId);
    if (!mom) return;
    const newChildren = mom.children.map(c => c.id === updatedChild.id ? updatedChild : c);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'moms', momId), {
        ...mom,
        children: newChildren
      });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteChild = async (momId, childId) => {
    if (!user) return;
    const confirmed = confirm("Eliminare questo figlio?");
    if (!confirmed) return;

    const mom = moms.find(m => m.id === momId);
    if (!mom) return;
    const newChildren = mom.children.filter(c => c.id !== childId);
    const relatedPeriods = maternityPeriods.filter(p => p.childId === childId);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'moms', momId), {
        ...mom,
        children: newChildren
      });
      for (const p of relatedPeriods) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'periods', p.id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addMaternity = async (period) => {
    if (!user) return;
    const hasOverlap = checkOverlap(maternityPeriods.filter(p => p.momId === period.momId), period);
    if (hasOverlap) {
      alert("Attenzione: Rilevata sovrapposizione con un periodo esistente.");
    }

    try {
       const periodsCol = collection(db, 'artifacts', appId, 'users',uid, 'periods');
      await addDoc(periodsCol, period);
    } catch (e) {
      console.error(e);
    }
  };

  const updateMaternity = async (id, updatedPeriod) => {
    if (!user) return;
    const hasOverlap = checkOverlap(maternityPeriods.filter(p => p.momId === updatedPeriod.momId), updatedPeriod, id);
    if (hasOverlap) {
      alert("Attenzione: Rilevata sovrapposizione con un periodo esistente.");
    }

    try {
      const periodRef = doc(db, 'artifacts', appId, 'public', 'data', 'periods', id);
      await setDoc(periodRef, updatedPeriod, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMaternity = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'periods', id));
    } catch (e) {
      console.error(e);
    }
  };

  // --- Logic for Warnings & Stats ---

  const getMomWarnings = (mom) => {
    const warnings = [];
    if (!mom.children) return warnings;
    
    if (mom.children.length > 0) {
      const hasObbligatoria = maternityPeriods.some(p => p.momId === mom.id && p.type === 'Obbligatoria');
      if (!hasObbligatoria) warnings.push("Mancanza maternità obbligatoria");
      
      mom.children.forEach(child => {
        if (isCurrentMonth(child.dataPresunta) && !child.dataEffettiva) {
          warnings.push(`Manca data nascita figlio (${child.nome || 'N/A'})`);
        }
      });
    }
    return warnings;
  };

  const getChildStats = (childId) => {
    const childPeriods = maternityPeriods.filter(p => p.childId === childId);
    const used80 = childPeriods
      .filter(p => p.type === 'Facoltativa 80%')
      .reduce((acc, p) => acc + calculateDays(p.start, p.end), 0);
    const used30 = childPeriods
      .filter(p => p.type === 'Facoltativa 30%')
      .reduce((acc, p) => acc + calculateDays(p.start, p.end), 0);
    return {
      used80,
      used30,
      totalUsed: used80 + used30,
      residue80: Math.max(0, 90 - used80),
      residueTotal: Math.max(0, 180 - (used80 + used30))
    };
  };

  // --- Filtered Views ---

  const filteredMoms = useMemo(() => {
    return moms.filter(m => {
      const fullName = `${m.nome} ${m.cognome}`.toLowerCase();
      const matchesSearch = fullName.includes(momSearch.toLowerCase());
      const warnings = getMomWarnings(m);
      const matchesWarning = !showOnlyWarnings || warnings.length > 0;
      return matchesSearch && matchesWarning;
    });
  }, [moms, momSearch, showOnlyWarnings, maternityPeriods]);

  const filteredDashboardData = useMemo(() => {
    return maternityPeriods.map(p => {
      const mom = moms.find(m => m.id === p.momId);
      const child = mom?.children?.find(c => c.id === p.childId);
      
      // Calcolo dinamico dei giorni basato sul filtro mese
      const displayedDays = filterMonth 
        ? calculateDaysInMonth(p.start, p.end, filterMonth)
        : calculateDays(p.start, p.end);

      return { 
        ...p, 
        momName: mom ? `${mom.nome} ${mom.cognome}` : 'N/A',
        childName: child ? child.nome : (p.childId === 'gravidanza' ? 'Gravidanza' : 'N/A'),
        displayedDays
      };
    }).filter(p => {
      const matchesSearch = p.momName.toLowerCase().includes(dashSearch.toLowerCase());
      const matchesType = filterType === 'All' || p.type === filterType;
      // Filtra i periodi che hanno effettivamente giorni nel mese selezionato
      const matchesMonth = !filterMonth || p.displayedDays > 0;
      return matchesSearch && matchesType && matchesMonth;
    });
  }, [maternityPeriods, moms, dashSearch, filterType, filterMonth]);

  const exportToCSV = () => {
    const headers = ["Mamma", "Figlio", "Tipo", "Inizio", "Fine", "Giorni", "Note"];
    const rows = filteredDashboardData.map(p => [
      p.momName,
      p.childName,
      p.type,
      p.start,
      p.end,
      p.displayedDays, // Usa i giorni filtrati
      (p.type === 'Anticipata' || p.type === '7 mesi Post Parto') ? 'No Integrazione' : ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "report_maternita.csv";
    link.click();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-pink-600" size={48} />
          <p className="text-slate-500 font-medium">Caricamento dati cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col shadow-xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-pink-500 rounded-lg"><Baby size={24} /></div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">MaternityHR</h1>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              {user ? <Cloud size={10} className="text-green-400" /> : <CloudOff size={10} />}
              <span>{user ? 'Sincronizzato' : 'Offline'}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2 flex-grow">
          <button onClick={() => setActiveTab('anagrafica')} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'anagrafica' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Users size={20} /> <span className="font-medium">Anagrafica</span>
          </button>
          <button onClick={() => setActiveTab('maternita')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'maternita' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Calendar size={20} /> <span className="font-medium">Periodi</span>
          </button>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> <span className="font-medium">Dashboard</span>
          </button>
        </div>
        <div className="pt-4 border-t border-slate-800 text-[9px] text-slate-500 truncate">
          ID Sessione: {user?.uid || 'Anonimo'}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto h-screen">
        <header className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h2>
        </header>

        {activeTab === 'anagrafica' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" placeholder="Cerca mamma..." 
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-pink-500/20"
                  value={momSearch} onChange={e => setMomSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setShowOnlyWarnings(!showOnlyWarnings)}
                className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${showOnlyWarnings ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600'}`}
              >
                <AlertCircle size={18} /> Solo con Warning
              </button>
              {!isAddingMom && (
                <button 
                  onClick={() => setIsAddingMom(true)} 
                  className="bg-pink-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-700 transition-colors"
                >
                  <Plus size={18} /> Aggiungi Mamma
                </button>
              )}
            </div>

            {isAddingMom && (
              <MomForm 
                onSave={handleAddMom} 
                onCancel={() => setIsAddingMom(false)} 
              />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-12">
              {filteredMoms.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-400">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nessuna lavoratrice trovata.</p>
                </div>
              ) : (
                filteredMoms.map(mom => (
                  <MomDetailCard 
                    key={mom.id} 
                    mom={mom} 
                    updateMom={updateMom}
                    deleteMom={deleteMom} 
                    addChild={addChild} 
                    updateChild={updateChild}
                    deleteChild={deleteChild}
                    warnings={getMomWarnings(mom)}
                    getChildStats={getChildStats}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'maternita' && (
          <SectionMaternita 
            moms={moms} 
            periods={maternityPeriods} 
            addMaternity={addMaternity} 
            updateMaternity={updateMaternity}
            deleteMaternity={deleteMaternity} 
          />
        )}

        {activeTab === 'dashboard' && (
          <SectionDashboard 
            data={filteredDashboardData} 
            moms={moms}
            search={dashSearch} setSearch={setDashSearch}
            month={filterMonth} setMonth={setFilterMonth}
            type={filterType} setType={setFilterType}
            exportCSV={exportToCSV}
          />
        )}
      </main>
    </div>
  );
};

// --- Sub-Components ---

const MomForm = ({ onSave, onCancel }) => {
  const [data, setData] = useState({ nome: '', cognome: '' });
  const handleSubmit = (e) => {
    e.preventDefault();
    if (data.nome && data.cognome) {
      onSave(data);
    }
  };
  return (
    <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Users className="text-pink-600" size={20} /> Nuova Lavoratrice
        </h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome</label>
            <input 
              type="text" 
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500/20 transition-all"
              placeholder="Inserisci nome..."
              value={data.nome}
              onChange={e => setData({...data, nome: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cognome</label>
            <input 
              type="text" 
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500/20 transition-all"
              placeholder="Inserisci cognome..."
              value={data.cognome}
              onChange={e => setData({...data, cognome: e.target.value})}
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button 
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Annulla
          </button>
          <button 
            type="submit"
            disabled={!data.nome || !data.cognome}
            className="px-8 py-2.5 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-500/20"
          >
            Salva Lavoratrice
          </button>
        </div>
      </form>
    </div>
  );
};

const MomDetailCard = ({ mom, updateMom, deleteMom, addChild, updateChild, deleteChild, warnings, getChildStats }) => {
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ nome: mom.nome, cognome: mom.cognome });
  const [editingChildId, setEditingChildId] = useState(null);

  const handleUpdateMom = () => {
    updateMom(mom.id, editData);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4 flex-grow">
          <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0">{mom.nome[0]}{mom.cognome[0]}</div>
          <div className="flex-grow">
            {isEditing ? (
              <div className="flex gap-2">
                <input 
                  className="w-full p-1 border rounded text-sm focus:ring-1 focus:ring-pink-500" 
                  value={editData.nome} 
                  onChange={e => setEditData({...editData, nome: e.target.value})}
                />
                <input 
                  className="w-full p-1 border rounded text-sm focus:ring-1 focus:ring-pink-500" 
                  value={editData.cognome} 
                  onChange={e => setEditData({...editData, cognome: e.target.value})}
                />
              </div>
            ) : (
              <h4 className="font-bold text-lg">{mom.nome} {mom.cognome}</h4>
            )}
            
            {warnings.length > 0 && !isEditing && (
              <div className="flex flex-wrap gap-2 mt-1">
                {warnings.map((w, i) => (
                  <span key={i} className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <AlertTriangle size={10} /> {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {isEditing ? (
            <>
              <button onClick={handleUpdateMom} className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors"><Check size={18} /></button>
              <button onClick={() => { setIsEditing(false); setEditData({ nome: mom.nome, cognome: mom.cognome }); }} className="text-slate-400 hover:bg-slate-50 p-2 rounded-lg transition-colors"><RotateCcw size={18} /></button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="text-slate-300 hover:text-indigo-500 transition-colors p-2"><Edit2 size={18} /></button>
              <button onClick={() => deleteMom(mom.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4 flex-grow">
        <div className="flex items-center justify-between border-b pb-2">
          <h5 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Anagrafica Figli</h5>
          <button onClick={() => setIsAddingChild(!isAddingChild)} className="text-pink-600 text-xs font-bold hover:underline">
            {isAddingChild ? 'Chiudi' : '+ Aggiungi Figlio'}
          </button>
        </div>

        {isAddingChild && <ChildForm onSave={(data) => { addChild(mom.id, data); setIsAddingChild(false); }} />}

        <div className="grid gap-3">
          {mom.children?.map(child => {
            const stats = getChildStats(child.id);
            const isEditingChild = editingChildId === child.id;

            return (
              <div key={child.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                {isEditingChild ? (
                  <ChildForm 
                    initialData={child} 
                    onSave={(data) => { updateChild(mom.id, data); setEditingChildId(null); }} 
                    onCancel={() => setEditingChildId(null)}
                  />
                ) : (
                  <>
                    <div className="flex justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm">{child.nome} {child.cognome}</p>
                        <p className="text-[10px] text-slate-500 font-mono tracking-wider">{child.cf || 'CF MANCANTE'}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingChildId(child.id)} className="text-slate-300 hover:text-indigo-500 p-1"><Edit2 size={14} /></button>
                        <button onClick={() => deleteChild(mom.id, child.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-[10px] mb-3">
                      <div><span className="text-slate-400 uppercase">Presunta:</span> <span className="font-bold">{formatDate(child.dataPresunta)}</span></div>
                      <div><span className="text-slate-400 uppercase">Effettiva:</span> <span className="font-bold">{formatDate(child.dataEffettiva) || 'In attesa'}</span></div>
                    </div>

                    {child.dataEffettiva && (
                      <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2 shadow-sm">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-indigo-600 font-bold uppercase">Allattamento fino a:</span>
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{formatDate(getBreastfeedingEnd(child.dataEffettiva))}</span>
                        </div>
                        <div className="pt-2 border-t grid grid-cols-2 gap-2 text-[9px]">
                          <div className="text-slate-600">Utilizzati 80%: <span className="font-bold text-slate-800">{stats.used80} gg</span></div>
                          <div className="text-slate-600">Utilizzati 30%: <span className="font-bold text-slate-800">{stats.used30} gg</span></div>
                          <div className="text-pink-600 font-bold">Residuo 80%: {stats.residue80} gg</div>
                          <div className="text-indigo-600 font-bold">Residuo Tot: {stats.residueTotal} gg</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {(!mom.children || mom.children.length === 0) && !isAddingChild && (
            <p className="text-center py-4 text-xs text-slate-400 italic">Nessun figlio registrato</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ChildForm = ({ onSave, onCancel, initialData }) => {
  const [data, setData] = useState(initialData || { nome: '', cognome: '', cf: '', dataPresunta: '', dataEffettiva: '' });
  const isBorn = data.dataEffettiva !== '';

  return (
    <div className="bg-pink-50/50 p-4 rounded-xl border border-pink-100 space-y-3 shadow-inner">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase">Data Presunta *</label>
          <input type="date" className="w-full p-2 text-xs rounded border border-slate-200 outline-none" value={data.dataPresunta} onChange={e => setData({...data, dataPresunta: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase">Data Nascita</label>
          <input type="date" className="w-full p-2 text-xs rounded border border-slate-200 outline-none" value={data.dataEffettiva} onChange={e => setData({...data, dataEffettiva: e.target.value})} />
        </div>
      </div>
      <div className={`space-y-2 ${!isBorn ? 'opacity-40 pointer-events-none' : ''}`}>
        {!isBorn && <p className="text-[9px] text-orange-600 font-bold italic flex items-center gap-1"><AlertCircle size={10} /> Inserisci data nascita per sbloccare anagrafica</p>}
        <div className="grid grid-cols-2 gap-3">
          <input type="text" placeholder="Nome" className="p-2 text-xs rounded border border-slate-200 outline-none" value={data.nome} onChange={e => setData({...data, nome: e.target.value})} />
          <input type="text" placeholder="Cognome" className="p-2 text-xs rounded border border-slate-200 outline-none" value={data.cognome} onChange={e => setData({...data, cognome: e.target.value})} />
        </div>
        <input type="text" placeholder="Codice Fiscale" className="w-full p-2 text-xs rounded border border-slate-200 uppercase outline-none font-mono" value={data.cf} onChange={e => setData({...data, cf: e.target.value})} maxLength={16} />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button 
            onClick={onCancel} 
            className="flex-1 bg-white text-slate-500 py-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Annulla
          </button>
        )}
        <button 
          onClick={() => onSave(data)} 
          className="flex-1 bg-slate-800 text-white py-2 rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors disabled:bg-slate-300" 
          disabled={!data.dataPresunta}
        >
          {initialData ? 'Aggiorna' : 'Salva'} Figlio
        </button>
      </div>
    </div>
  );
};

const SectionMaternita = ({ moms, periods, addMaternity, updateMaternity, deleteMaternity }) => {
  const [newP, setNewP] = useState({ momId: '', childId: '', type: 'Obbligatoria', start: '', end: '' });
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [editP, setEditP] = useState(null);

  const currentMom = moms.find(m => m.id === newP.momId);
  const selectedChild = currentMom?.children?.find(c => c.id === newP.childId);

  const handleSave = () => {
    if (!newP.momId || !newP.childId || !newP.start || !newP.end) return;
    if (new Date(newP.end) < new Date(newP.start)) return alert("Data fine non valida");
    addMaternity(newP);
    setNewP({ momId: '', childId: '', type: 'Obbligatoria', start: '', end: '' });
  };
  const startEdit = (p) => {
    setEditingPeriodId(p.id);
    setEditP({ ...p });
  };
  const handleUpdate = () => {
    if (!editP.momId || !editP.childId || !editP.start || !editP.end) return;
    if (new Date(editP.end) < new Date(editP.start)) return alert("Data fine non valida");
    updateMaternity(editingPeriodId, editP);
    setEditingPeriodId(null);
    setEditP(null);
  };
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Plus className="text-pink-600" size={18} /> Registra Nuovo Periodo</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Lavoratrice</label>
            <select className="w-full p-2 text-sm border rounded-lg bg-slate-50 outline-none" value={newP.momId} onChange={e => setNewP({...newP, momId: e.target.value, childId: ''})}>
              <option value="">Seleziona...</option>
              {moms.map(m => <option key={m.id} value={m.id}>{m.nome} {m.cognome}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Figlio / Stato</label>
            <select className="w-full p-2 text-sm border rounded-lg bg-slate-50 outline-none" value={newP.childId} onChange={e => setNewP({...newP, childId: e.target.value})}>
              <option value="">Seleziona...</option>
              {currentMom?.children?.map(c => <option key={c.id} value={c.id}>{c.nome} {!c.dataEffettiva ? '(Gravidanza)' : ''}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Tipologia</label>
            <select className="w-full p-2 text-sm border rounded-lg bg-slate-50 outline-none" value={newP.type} onChange={e => setNewP({...newP, type: e.target.value})}>
              <option value="Anticipata">Anticipata</option>
              <option value="Obbligatoria">Obbligatoria</option>
              <option value="Facoltativa 80%">Facoltativa 80%</option>
              <option value="Facoltativa 30%">Facoltativa 30%</option>
              <option value="7 mesi Post Parto">7 mesi Post Parto</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Inizio</label>
            <input type="date" className="w-full p-2 text-sm border rounded-lg bg-slate-50 outline-none" value={newP.start} onChange={e => setNewP({...newP, start: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Fine</label>
            <input type="date" className="w-full p-2 text-sm border rounded-lg bg-slate-50 outline-none" value={newP.end} onChange={e => setNewP({...newP, end: e.target.value})} />
          </div>
        </div>
        <div className="mt-4 flex justify-between items-center pt-4 border-t border-slate-50">
          {newP.childId && !selectedChild?.dataEffettiva ? (
            <span className="text-orange-600 font-bold text-xs flex items-center gap-1"><Info size={14}/> Stato: GRAVIDANZA (Data Presunta: {formatDate(selectedChild?.dataPresunta)})</span>
          ) : <div></div>}
          <button onClick={handleSave} className="bg-pink-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-pink-700 transition-colors shadow-lg shadow-pink-500/20">Registra Periodo</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 font-bold text-slate-400 uppercase text-[10px]">Lavoratrice / Figlio</th>
                <th className="p-4 font-bold text-slate-400 uppercase text-[10px]">Tipologia</th>
                <th className="p-4 font-bold text-slate-400 uppercase text-[10px]">Inizio</th>
                <th className="p-4 font-bold text-slate-400 uppercase text-[10px]">Fine</th>
                <th className="p-4 font-bold text-slate-400 uppercase text-[10px]">Giorni</th>
                <th className="p-4 font-bold text-slate-400 uppercase text-[10px] text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 italic">Nessun periodo registrato nel sistema.</td>
                </tr>
              ) : (
                periods.sort((a,b) => new Date(b.start) - new Date(a.start)).map(p => {
                  const isEditing = editingPeriodId === p.id;
                  const mom = moms.find(m => m.id === (isEditing ? editP.momId : p.momId));
                  const child = mom?.children?.find(c => c.id === (isEditing ? editP.childId : p.childId));
                  
                  if (isEditing) {
                    return (
                      <tr key={p.id} className="bg-indigo-50/30">
                        <td className="p-2">
                          <div className="space-y-1">
                            <select 
                              className="w-full p-1 text-xs border rounded" 
                              value={editP.momId} 
                              onChange={e => setEditP({...editP, momId: e.target.value, childId: ''})}
                            >
                              {moms.map(m => <option key={m.id} value={m.id}>{m.nome} {m.cognome}</option>)}
                            </select>
                            <select 
                              className="w-full p-1 text-xs border rounded" 
                              value={editP.childId} 
                              onChange={e => setEditP({...editP, childId: e.target.value})}
                            >
                              <option value="">Seleziona Figlio...</option>
                              {moms.find(m => m.id === editP.momId)?.children?.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="p-2">
                          <select 
                            className="w-full p-1 text-xs border rounded" 
                            value={editP.type} 
                            onChange={e => setEditP({...editP, type: e.target.value})}
                          >
                            <option value="Anticipata">Anticipata</option>
                            <option value="Obbligatoria">Obbligatoria</option>
                            <option value="Facoltativa 80%">Facoltativa 80%</option>
                            <option value="Facoltativa 30%">Facoltativa 30%</option>
                            <option value="7 mesi Post Parto">7 mesi Post Parto</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="date" className="w-full p-1 text-xs border rounded" value={editP.start} onChange={e => setEditP({...editP, start: e.target.value})} />
                        </td>
                        <td className="p-2">
                          <input type="date" className="w-full p-1 text-xs border rounded" value={editP.end} onChange={e => setEditP({...editP, end: e.target.value})} />
                        </td>
                        <td className="p-2 font-bold text-center">
                          {calculateDays(editP.start, editP.end)}
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={handleUpdate} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"><Check size={16}/></button>
                            <button onClick={() => {setEditingPeriodId(null); setEditP(null);}} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"><RotateCcw size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold">{mom ? `${mom.nome} ${mom.cognome}` : 'Lavoratrice eliminata'}</p>
                        <p className="text-[10px] text-slate-500 italic">{child?.nome || 'Gravidanza'}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          p.type === 'Obbligatoria' ? 'bg-indigo-50 text-indigo-700' : 
                          p.type.includes('80') ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-xs">{formatDate(p.start)}</td>
                      <td className="p-4 text-slate-500 font-mono text-xs">{formatDate(p.end)}</td>
                      <td className="p-4 font-bold">{calculateDays(p.start, p.end)} gg</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(p)} className="text-slate-300 hover:text-indigo-500 p-2 transition-colors"><Edit2 size={16}/></button>
                          <button onClick={() => deleteMaternity(p.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={16}/></button>
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
    </div>
  );
};

const SectionDashboard = ({ data, moms, search, setSearch, month, setMonth, type, setType, exportCSV }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Cerca</label>
          <input type="text" placeholder="Nome lavoratrice..." className="w-full p-2 border rounded-lg text-sm bg-slate-50 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Tipologia</label>
          <select className="w-full p-2 border rounded-lg text-sm bg-slate-50 outline-none" value={type} onChange={e => setType(e.target.value)}>
            <option value="All">Tutte le tipologie</option>
            <option value="Anticipata">Anticipata</option>
            <option value="Obbligatoria">Obbligatoria</option>
            <option value="Facoltativa 80%">Facoltativa 80%</option>
            <option value="Facoltativa 30%">Facoltativa 30%</option>
            <option value="7 mesi Post Parto">7 mesi Post Parto</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Mese Riferimento</label>
          <input type="month" className="w-full p-2 border rounded-lg text-sm bg-slate-50 outline-none" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button onClick={exportCSV} className="w-full h-[38px] bg-slate-800 text-white rounded-lg flex items-center justify-center gap-2 font-bold text-sm hover:bg-slate-900 transition-colors shadow-md shadow-slate-200">
            <Download size={16}/> Esporta CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b font-bold text-[10px] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Lavoratrice</th>
                <th className="p-4">Figlio</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Inizio/Fine</th>
                <th className="p-4">Giorni</th>
                <th className="p-4">Nota Integrazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400 italic">Nessun dato corrispondente ai filtri selezionati.</td>
                </tr>
              ) : (
                data.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold">{p.momName}</td>
                    <td className="p-4 text-slate-600">{p.childName}</td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100">{p.type}</span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">{formatDate(p.start)} - {formatDate(p.end)}</td>
                    <td className="p-4 font-black text-pink-600">{p.displayedDays} gg</td>
                    <td className="p-4">
                      {(p.type === 'Anticipata' || p.type === '7 mesi Post Parto') && (
                        <span className="bg-red-50 text-red-600 text-[10px] px-2 py-1 rounded font-bold border border-red-100 inline-flex items-center gap-1">
                          <AlertCircle size={10} /> No Integrazione
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
