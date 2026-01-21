
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { 
  Map as MapIcon, 
  MapPin,
  List,
  Activity,
  Loader2,
  FolderSync,
  MapPinned,
  BookOpen
} from 'lucide-react';
import { SiteSurvey, PoleSurvey, LocationState } from './types.ts';
import { MapOverlay } from './components/MapOverlay.tsx';
import { PoleEditor } from './components/PoleEditor.tsx';
import { AboutPage } from './components/AboutPage.tsx';
import { CodeGeneratorPage } from './components/CodeGeneratorPage.tsx';
import { ActivationOverlay } from './components/ActivationOverlay.tsx';
import { exportProjectToDirectory } from './services/kmzService.ts';
import { getSubscriptionStatus } from './services/authService.ts';
import { saveState, getState, requestPersistentStorage, getStorageHealth, StorageEstimate } from './services/dbService.ts';

const STORAGE_KEY = 'osp_survey_pro_v4_state';

// High-Performance Memoized List Item
const InventoryItem = memo(({ pole, isSelected, onClick }: { pole: PoleSurvey, isSelected: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`w-full p-5 rounded-[32px] text-left flex items-center gap-5 border transition-all btn-active ${isSelected ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10' : 'bg-white border-slate-100 shadow-sm'}`}
  >
    <div className="w-16 h-16 rounded-[24px] bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border-2 border-slate-200">
      {pole.photos?.[0] ? <img src={pole.photos[0].thumbnail} className="w-full h-full object-cover" loading="lazy" /> : <MapPin className="w-7 h-7 text-slate-300" />}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-black text-base truncate uppercase tracking-tighter text-slate-800">{pole.name}</p>
      <p className="text-[10px] text-slate-400 monospaced font-bold mt-1.5">{pole.latitude.toFixed(6)}, {pole.longitude.toFixed(6)}</p>
    </div>
  </button>
));

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const initialLoadDone = useRef(false);
  const surveyRef = useRef<SiteSurvey | null>(null);

  const [survey, setSurvey] = useState<SiteSurvey>(() => ({
    id: crypto.randomUUID(),
    siteName: 'ACTIVE PROJECT',
    companyName: 'FIELD OPS',
    groupName: 'GROUP 1',
    poles: []
  }));

  const [selectedPoleId, setSelectedPoleId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LocationState | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [showAbout, setShowAbout] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageEstimate | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Sync ref for storage operations without triggering re-renders
  useEffect(() => { surveyRef.current = survey; }, [survey]);

  const refreshAppStatus = useCallback(async () => {
    const [status, health] = await Promise.all([
      getSubscriptionStatus(),
      getStorageHealth()
    ]);
    setIsSubscribed(status.active);
    setDaysRemaining(status.daysLeft);
    setStorageHealth(health);
    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    refreshAppStatus();
    requestPersistentStorage();
    const interval = setInterval(refreshAppStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshAppStatus]);

  useEffect(() => {
    const loadFromDB = async () => {
      const saved = await getState(STORAGE_KEY);
      if (saved?.id) setSurvey(saved);
      initialLoadDone.current = true;
    };
    loadFromDB();
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const timeout = setTimeout(() => saveState(STORAGE_KEY, survey), 1000);
    return () => clearTimeout(timeout);
  }, [survey]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationError(null);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => setLocationError(err.code === 1 ? 'GPS BLOCKED' : 'GPS LOST'),
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const addPole = useCallback((lat: number, lng: number) => {
    const newId = crypto.randomUUID();
    setSurvey(prev => ({
      ...prev,
      poles: [...prev.poles, {
        id: newId,
        name: `POLE-${(prev.poles.length + 1).toString().padStart(3, '0')}`,
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString(),
        photos: [],
        notes: ''
      }]
    }));
    setSelectedPoleId(newId);
  }, []);

  const updatePole = useCallback((id: string, updates: Partial<PoleSurvey>) => {
    setSurvey(prev => ({
      ...prev,
      poles: prev.poles.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  }, []);

  const deletePoles = useCallback((ids: string[]) => {
    setSurvey(prev => ({ ...prev, poles: prev.poles.filter(p => !ids.includes(p.id)) }));
    setSelectedPoleId(null);
  }, []);

  const handleExport = async () => {
    if (!isSubscribed) return setShowActivation(true);
    setIsCompiling(true);
    try {
      await exportProjectToDirectory(survey);
    } finally {
      setIsCompiling(false);
    }
  };

  const selectedPole = useMemo(() => 
    survey.poles.find(p => p.id === selectedPoleId), 
  [survey.poles, selectedPoleId]);

  if (checkingAuth) return (
    <div className="h-full bg-slate-900 flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden font-sans">
      {isCompiling && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 flex flex-col items-center justify-center text-center backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
          <h2 className="text-white font-black uppercase tracking-widest text-xs">Assembling KMZ Report</h2>
        </div>
      )}

      {showActivation && (
        <ActivationOverlay 
          onActivated={() => { refreshAppStatus(); setShowActivation(false); }} 
          onOpenGenerator={() => setShowGenerator(true)} 
          onClose={() => setShowActivation(false)}
        />
      )}

      {showGenerator && <CodeGeneratorPage onClose={() => setShowGenerator(false)} />}
      {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}

      <div className="bg-slate-900 text-white px-4 pt-[calc(env(safe-area-inset-top)+6px)] pb-1.5 flex items-center justify-between text-[8px] font-black uppercase tracking-widest z-[6000]">
        <div className="flex items-center gap-3">
          <Activity className="w-3 h-3 text-indigo-400" />
          <span className={isOnline ? 'text-emerald-400' : 'text-amber-500'}>{isOnline ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500">{storageHealth ? `${(storageHealth.usage / 1048576).toFixed(0)}MB` : '--'}</span>
          <span className={isSubscribed ? 'text-emerald-400' : 'text-amber-500'}>{isSubscribed ? `${daysRemaining}D` : 'FREE'}</span>
          <span className={locationError ? 'text-rose-500' : 'text-blue-400'}>{locationError || 'GPS OK'}</span>
        </div>
      </div>

      <header className="h-14 bg-white border-b px-4 flex items-center justify-between shrink-0 z-[5000]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><MapPin className="w-4 h-4" /></div>
          <input 
            defaultValue={survey.siteName} 
            onBlur={(e) => setSurvey(s => ({...s, siteName: e.target.value.toUpperCase()}))} 
            className="text-xs font-black text-slate-800 bg-transparent border-none focus:ring-0 p-0 truncate w-full" 
            placeholder="PROJECT NAME" 
          />
        </div>
        <button onClick={handleExport} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black tracking-widest flex items-center gap-2 btn-active">
          <FolderSync className="w-3 h-3 text-emerald-400" /> SYNC
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside className={`absolute inset-0 z-[4500] bg-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0 md:w-80 border-r ${viewMode === 'list' ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b bg-slate-50/50">
            <h2 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">{survey.poles.length} Assets Logged</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-container">
            {survey.poles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20"><MapPinned className="w-16 h-16" /></div>
            ) : survey.poles.map(p => (
              <InventoryItem 
                key={p.id} 
                pole={p} 
                isSelected={selectedPoleId === p.id} 
                onClick={() => { setSelectedPoleId(p.id); setViewMode('map'); }} 
              />
            ))}
          </div>
        </aside>

        <main className="flex-1 relative bg-slate-100 overflow-hidden">
          <MapOverlay 
            poles={survey.poles} 
            onMapClick={addPole} 
            onPoleUpdate={updatePole} 
            onMultiplePoleUpdate={(updates) => {
              setSurvey(prev => {
                const newPoles = [...prev.poles];
                updates.forEach(({ id, updates: u }) => {
                  const idx = newPoles.findIndex(p => p.id === id);
                  if (idx !== -1) newPoles[idx] = { ...newPoles[idx], ...u };
                });
                return { ...prev, poles: newPoles };
              });
            }}
            onPolesDelete={deletePoles} 
            selectedPoleId={selectedPoleId || undefined} 
            userLocation={userLocation} 
            isActive={viewMode === 'map'}
          />
        </main>

        {selectedPoleId && selectedPole && (
          <div className="fixed inset-0 z-[5500] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center md:items-center">
            <div className="w-full h-[92dvh] md:h-auto md:w-[480px] bg-white bottom-sheet overflow-hidden animate-slide-up">
              <PoleEditor 
                pole={selectedPole} 
                siteName={survey.siteName} 
                companyName={survey.companyName || 'FIELD OPS'} 
                onUpdate={(updates) => updatePole(selectedPoleId, updates)} 
                onDelete={() => deletePoles([selectedPoleId])} 
                onClose={() => setSelectedPoleId(null)} 
              />
            </div>
          </div>
        )}
      </div>

      <nav className="md:hidden bg-white border-t flex items-center justify-around z-[4900] h-16 pb-[env(safe-area-inset-bottom)] shrink-0 shadow-lg">
        <button onClick={() => setViewMode('map')} className={`flex flex-col items-center gap-1 p-2 ${viewMode === 'map' ? 'text-indigo-600' : 'text-slate-400'}`}>
          <MapIcon className="w-6 h-6" /><span className="text-[8px] font-black uppercase">Map</span>
        </button>
        <button onClick={() => setViewMode('list')} className={`flex flex-col items-center gap-1 p-2 ${viewMode === 'list' ? 'text-indigo-600' : 'text-slate-400'}`}>
          <List className="w-6 h-6" /><span className="text-[8px] font-black uppercase">List</span>
        </button>
        <button onClick={() => setShowAbout(true)} className="flex flex-col items-center gap-1 p-2 text-slate-400">
          <BookOpen className="w-6 h-6" /><span className="text-[8px] font-black uppercase">Info</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
