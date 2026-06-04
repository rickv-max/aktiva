import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Activity, 
  Map as MapIcon, 
  User, 
  Play, 
  Square, 
  MapPin,
  Clock, 
  Zap, 
  Target,
  Flame,
  ChevronRight,
  AlertCircle,
  Menu
} from 'lucide-react';

// --- UTILS & MATH ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radius of Earth in meters
  const toRad = (val) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in meters
};

const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatPace = (distanceMeters, timeMs) => {
  const distanceKm = distanceMeters / 1000;
  if (distanceKm < 0.01) return "--:--"; 
  const minutes = timeMs / 60000;
  const paceMinutes = minutes / distanceKm;
  const pMin = Math.floor(paceMinutes);
  const pSec = Math.floor((paceMinutes - pMin) * 60);
  
  if (pMin > 60) return ">60:00"; 
  return `${pMin}:${pSec.toString().padStart(2, '0')}`;
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// --- SKELETON COMPONENTS ---
const SkeletonMap = () => (
  <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center flex-col gap-3 overflow-hidden">
    <MapPin className="w-10 h-10 text-slate-400 animate-bounce" />
    <div className="h-4 bg-slate-300 rounded w-48"></div>
    <div className="h-3 bg-slate-300 rounded w-32"></div>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-slate-200"></div>
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
    <div className="w-full h-48 bg-slate-200 rounded-xl mb-4"></div>
    <div className="grid grid-cols-3 gap-4 px-2">
      <div className="h-8 bg-slate-200 rounded w-full"></div>
      <div className="h-8 bg-slate-200 rounded w-full"></div>
      <div className="h-8 bg-slate-200 rounded w-full"></div>
    </div>
  </div>
);

// --- MAP COMPONENT ---
const MapView = ({ coordinates, isLive, className }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polylineInstance = useRef(null);
  const markerInstance = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) {
      setIsLoaded(true);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    
    if (!mapInstance.current) {
      const initialPos = coordinates.length > 0 ? coordinates[0] : [-6.2088, 106.8456]; 
      
      mapInstance.current = window.L.map(mapRef.current, {
        zoomControl: false,
        dragging: isLive, 
        scrollWheelZoom: isLive,
        doubleClickZoom: isLive,
      }).setView(initialPos, 16);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapInstance.current);

      polylineInstance.current = window.L.polyline([], {
        color: '#fc4c02', 
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(mapInstance.current);

      if (isLive) {
        markerInstance.current = window.L.circleMarker(initialPos, {
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: '#3b82f6', 
          fillOpacity: 1
        }).addTo(mapInstance.current);
      }

      // Responsive Map Resize Observer
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [isLoaded, isLive]);

  // Update Map Coordinates
  useEffect(() => {
    if (!mapInstance.current || coordinates.length === 0) return;
    
    polylineInstance.current.setLatLngs(coordinates);
    
    if (isLive) {
      const latestPos = coordinates[coordinates.length - 1];
      markerInstance.current.setLatLng(latestPos);
      mapInstance.current.panTo(latestPos);
    } else {
      mapInstance.current.fitBounds(polylineInstance.current.getBounds(), { padding: [30, 30] });
    }
  }, [coordinates, isLive]);

  if (!isLoaded) return <SkeletonMap />;

  return (
    <div className={`relative z-0 ${className}`}>
      <div ref={mapRef} className="w-full h-full" />
      {!isLive && <div className="absolute inset-0 border border-black/5 rounded-xl pointer-events-none" />}
    </div>
  );
};

// --- SCREENS ---
const FeedScreen = ({ activities }) => {
  if (activities.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6">
          <Activity className="w-12 h-12 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Belum Ada Aktivitas</h2>
        <p className="text-slate-500 mb-8 max-w-sm">
          Tekan tombol rekam untuk memulai pelacakan rute pertamamu. Daftar aktivitasmu akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-8 pb-28 md:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.slice().reverse().map((activity) => (
            <div key={activity.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col">
              {/* Header */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">{activity.title || "Aktivitas"}</h3>
                  <p className="text-xs text-slate-500">{formatDate(new Date(activity.date))}</p>
                </div>
              </div>

              {/* Map Preview */}
              <div className="h-56 w-full bg-slate-100 relative shrink-0">
                 {activity.coordinates.length > 0 ? (
                   <MapView coordinates={activity.coordinates} isLive={false} className="w-full h-full" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-slate-400">
                     <AlertCircle className="w-6 h-6 mr-2" /> Tidak ada data rute
                   </div>
                 )}
              </div>

              {/* Stats Footer */}
              <div className="p-4 grid grid-cols-3 gap-4 border-t border-slate-50 bg-slate-50/50 flex-1">
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-medium">Jarak</p>
                  <p className="font-bold text-slate-900 text-lg md:text-xl">{(activity.distance / 1000).toFixed(2)} <span className="text-sm font-normal text-slate-500">km</span></p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-medium">Waktu</p>
                  <p className="font-bold text-slate-900 text-lg md:text-xl">{formatTime(activity.duration)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1 font-medium">Pace</p>
                  <p className="font-bold text-slate-900 text-lg md:text-xl">{formatPace(activity.distance, activity.duration)} <span className="text-sm font-normal text-slate-500">/km</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RecordScreen = ({ onSaveActivity }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [coordinates, setCoordinates] = useState([]);
  const [distance, setDistance] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [gpsStatus, setGpsStatus] = useState('initializing'); 
  const [errorMsg, setErrorMsg] = useState('');

  const watchId = useRef(null);
  const timerRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setErrorMsg('Geolokasi tidak didukung oleh browser Anda.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates([[pos.coords.latitude, pos.coords.longitude]]);
        setGpsStatus('ready');
      },
      (err) => {
        setGpsStatus('error');
        setErrorMsg('Izinkan akses lokasi untuk melacak rute Anda.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      lastUpdateRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        setDuration(prev => prev + (now - lastUpdateRef.current));
        lastUpdateRef.current = now;
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newCoord = [pos.coords.latitude, pos.coords.longitude];
          setCoordinates(prev => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const dist = calculateDistance(last[0], last[1], newCoord[0], newCoord[1]);
              if (dist > 2) { 
                setDistance(d => d + dist);
                return [...prev, newCoord];
              }
              return prev;
            }
            return [newCoord];
          });
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
      );
    } else {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    }
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [isRecording, isPaused]);

  const handleStart = () => {
    if (gpsStatus === 'error') {
      alert("Lokasi tidak tersedia. " + errorMsg);
      return;
    }
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePause = () => setIsPaused(true);
  const handleResume = () => setIsPaused(false);
  
  const handleStop = () => {
    if (distance > 0 || duration > 0) {
      onSaveActivity({
        id: Date.now(),
        date: new Date().toISOString(),
        duration,
        distance,
        coordinates,
        title: getGreetingTitle()
      });
    }
    setIsRecording(false);
    setIsPaused(false);
    setDistance(0);
    setDuration(0);
    setCoordinates([]);
  };

  const getGreetingTitle = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "Lari Pagi";
    if (hour < 15) return "Lari Siang";
    if (hour < 18) return "Lari Sore";
    return "Lari Malam";
  };

  return (
    <div className="w-full h-full relative bg-slate-900 overflow-hidden flex flex-col md:block">
      {/* Map Area (Full background on Desktop, Top part on Mobile) */}
      <div className="flex-1 md:absolute md:inset-0 relative z-0">
        {gpsStatus === 'initializing' ? (
          <SkeletonMap />
        ) : gpsStatus === 'error' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-50">
            <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
            <p className="font-medium text-slate-700">{errorMsg}</p>
            <p className="text-sm mt-2">Mohon periksa izin perangkat Anda.</p>
          </div>
        ) : (
          <MapView coordinates={coordinates} isLive={true} className="w-full h-full" />
        )}

        {/* GPS Badge */}
        <div className="absolute top-6 left-6 z-[400] flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md shadow-md rounded-full border border-slate-200">
          <div className={`w-3 h-3 rounded-full ${isRecording && !isPaused ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`}></div>
          <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">
            {isRecording ? (isPaused ? 'Dijeda' : 'Merekam') : 'GPS Siap'}
          </span>
        </div>
      </div>

      {/* Floating Dashboard / Bottom Sheet */}
      <div className="z-10 bg-white md:bg-white/80 md:backdrop-blur-xl md:absolute md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:w-[90%] md:max-w-4xl md:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] md:shadow-2xl rounded-t-3xl -mt-6 p-6 pb-28 md:pb-6 transition-all duration-300 border border-white/20">
        
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 md:mb-0">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:flex md:flex-1 md:justify-around gap-y-6 gap-x-4">
            <div className="text-center md:text-left">
              <p className="text-xs md:text-sm font-bold text-slate-500 flex items-center justify-center md:justify-start gap-1.5 mb-1 tracking-wider"><Clock className="w-4 h-4" /> WAKTU</p>
              <p className="text-4xl md:text-5xl font-black text-slate-800 font-mono tracking-tighter">{formatTime(duration)}</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs md:text-sm font-bold text-slate-500 flex items-center justify-center md:justify-start gap-1.5 mb-1 tracking-wider"><Target className="w-4 h-4" /> JARAK</p>
              <p className="text-4xl md:text-5xl font-black text-slate-800">
                {(distance / 1000).toFixed(2)}
                <span className="text-lg md:text-2xl font-medium text-slate-500 ml-1">km</span>
              </p>
            </div>
            <div className="text-center md:text-left">
               <p className="text-xs md:text-sm font-bold text-slate-500 flex items-center justify-center md:justify-start gap-1.5 mb-1 tracking-wider"><Zap className="w-4 h-4" /> PACE</p>
               <p className="text-3xl md:text-4xl font-black text-slate-800">{formatPace(distance, duration)} <span className="text-sm md:text-lg text-slate-500 font-normal">/km</span></p>
            </div>
            <div className="text-center md:text-left">
               <p className="text-xs md:text-sm font-bold text-slate-500 flex items-center justify-center md:justify-start gap-1.5 mb-1 tracking-wider"><Flame className="w-4 h-4" /> KALORI</p>
               <p className="text-3xl md:text-4xl font-black text-slate-800">{Math.floor((distance/1000) * 60)} <span className="text-sm md:text-lg text-slate-500 font-normal">kcal</span></p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center md:justify-end gap-4 shrink-0 md:pl-8 md:border-l border-slate-200">
            {!isRecording ? (
              <button 
                onClick={handleStart}
                disabled={gpsStatus !== 'ready'}
                className="w-20 h-20 md:w-24 md:h-24 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(252,76,2,0.4)] hover:bg-orange-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Play className="w-8 h-8 md:w-10 md:h-10 ml-2" fill="currentColor" />
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button 
                    onClick={handleResume}
                    className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all hover:scale-105 active:scale-95"
                  >
                    <Play className="w-6 h-6 md:w-8 md:h-8 ml-1" fill="currentColor" />
                  </button>
                ) : (
                  <button 
                    onClick={handlePause}
                    className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-900 transition-all hover:scale-105 active:scale-95"
                  >
                    <div className="flex gap-2">
                      <div className="w-2 h-6 md:h-8 bg-white rounded-sm"></div>
                      <div className="w-2 h-6 md:h-8 bg-white rounded-sm"></div>
                    </div>
                  </button>
                )}
                <button 
                  onClick={handleStop}
                  className="w-16 h-16 md:w-20 md:h-20 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-orange-600 transition-all hover:scale-105 active:scale-95"
                >
                  <Square className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileScreen = ({ activities }) => {
  const totalDistance = activities.reduce((acc, curr) => acc + curr.distance, 0);
  const totalDuration = activities.reduce((acc, curr) => acc + curr.duration, 0);
  
  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50 p-4 md:p-8 pb-28 md:pb-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Profile - Desktop Horizontal, Mobile Vertical */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-8 mt-4 flex flex-col md:flex-row items-center gap-6 md:gap-8 transition-all">
          <div className="w-28 h-28 md:w-36 md:h-36 bg-gradient-to-tr from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white shrink-0">
            <User className="w-14 h-14 md:w-16 md:h-16 text-white" />
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-1">Pelari Profesional</h2>
            <p className="text-slate-500 mb-4 font-medium">Anggota sejak Hari Ini</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-semibold">🏆 Pelari Pemula</span>
              <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-semibold">🔥 Streak: 1 Hari</span>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-4 px-2">Statistik Keseluruhan</h3>
        
        {/* Responsive Grid Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 mb-2 font-bold tracking-wide uppercase">Total Jarak</p>
            <p className="text-3xl font-black text-orange-500">{(totalDistance / 1000).toFixed(2)} <span className="text-base font-medium text-slate-600">km</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 mb-2 font-bold tracking-wide uppercase">Total Waktu</p>
            <p className="text-3xl font-black text-slate-800">{formatTime(totalDuration)}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 mb-2 font-bold tracking-wide uppercase">Aktivitas</p>
            <p className="text-3xl font-black text-slate-800">{activities.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 mb-2 font-bold tracking-wide uppercase">Rata-rata Pace</p>
            <p className="text-3xl font-black text-slate-800">{activities.length > 0 ? formatPace(totalDistance, totalDuration) : '--:--'}</p>
          </div>
        </div>
        
        {/* Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <button className="w-full flex items-center justify-between p-5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><User className="w-5 h-5 text-slate-600" /></div>
              <span className="font-semibold text-slate-700">Pengaturan Akun</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center"><Zap className="w-5 h-5 text-orange-500" /></div>
              <span className="font-semibold text-slate-700">Sinkronisasi Cloud</span>
            </div>
            <span className="text-xs bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">Premium</span>
          </button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN LAYOUT SHELL ---
export default function App() {
  const [currentTab, setCurrentTab] = useState('feed'); 
  const [activities, setActivities] = useState([]);
  
  const handleSaveActivity = (newActivity) => {
    setActivities(prev => [...prev, newActivity]);
    setCurrentTab('feed'); 
  };

  const NavItem = ({ id, icon: Icon, label }) => {
    const isActive = currentTab === id;
    // Mobile Style
    const mobileStyle = `flex flex-col items-center gap-1 p-2 ${isActive ? 'text-orange-500' : 'text-slate-400 hover:text-slate-600'}`;
    // Desktop Style
    const desktopStyle = `w-full flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 ${isActive ? 'bg-orange-500/10 text-orange-500 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'}`;

    return (
      <>
        {/* Mobile View */}
        <button onClick={() => setCurrentTab(id)} className={`md:hidden ${id === 'record' ? 'flex flex-col items-center justify-center -mt-8 w-16 h-16 rounded-full shadow-[0_4px_20px_rgba(252,76,2,0.3)] transition-transform active:scale-95 bg-orange-500 text-white' : mobileStyle}`}>
          <Icon className={id === 'record' ? 'w-7 h-7' : 'w-6 h-6'} />
          {id !== 'record' && <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>}
        </button>

        {/* Desktop View */}
        <button onClick={() => setCurrentTab(id)} className={`hidden md:flex ${desktopStyle}`}>
          <Icon className="w-6 h-6 shrink-0" />
          <span className="text-base tracking-wide hidden lg:block">{label}</span>
        </button>
      </>
    );
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans antialiased text-slate-900 overflow-hidden">
      
      {/* SIDEBAR (Desktop Only) */}
      <aside className="hidden md:flex flex-col w-20 lg:w-72 bg-slate-900 border-r border-slate-800 shrink-0 shadow-2xl z-50">
        <div className="h-20 flex items-center px-6 lg:px-8 shrink-0">
          <Activity className="w-8 h-8 text-orange-500" />
          <span className="hidden lg:block ml-3 text-2xl font-black text-white tracking-tight">RunTracker</span>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2 px-4 py-8">
          <NavItem id="feed" icon={Menu} label="Beranda" />
          <NavItem id="record" icon={MapIcon} label="Rekam Aktivitas" />
          <NavItem id="profile" icon={User} label="Profil Anda" />
        </nav>

        <div className="p-4 lg:p-6 pb-8">
          <div className="hidden lg:flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Pelari Pro</p>
              <p className="text-xs text-slate-400">Mode Gratis</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative w-full h-full min-w-0">
        
        {/* Header - Mobile Only (Hidden on Record) or Desktop Feed/Profile */}
        {(currentTab !== 'record') && (
          <header className="bg-white/80 backdrop-blur-md px-6 py-5 flex items-center justify-between shadow-sm z-40 border-b border-slate-200 shrink-0 md:bg-white">
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              {currentTab === 'feed' && "Aktivitas Terakhir"}
              {currentTab === 'profile' && "Statistik & Profil"}
            </h1>
            {currentTab === 'feed' && (
               <div className="w-10 h-10 rounded-full bg-slate-100 flex md:hidden items-center justify-center border border-slate-200">
                 <User className="w-5 h-5 text-slate-600" />
               </div>
            )}
          </header>
        )}

        {/* View Router */}
        <div className="flex-1 relative overflow-hidden w-full h-full">
          {currentTab === 'feed' && <FeedScreen activities={activities} />}
          {currentTab === 'record' && <RecordScreen onSaveActivity={handleSaveActivity} />}
          {currentTab === 'profile' && <ProfileScreen activities={activities} />}
        </div>

        {/* BOTTOM NAV (Mobile Only) */}
        <nav className="md:hidden absolute bottom-0 w-full bg-white/90 backdrop-blur-lg border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
          <NavItem id="feed" icon={Menu} label="Beranda" />
          <NavItem id="record" icon={MapIcon} label="Rekam" />
          <NavItem id="profile" icon={User} label="Profil" />
        </nav>
      </main>

    </div>
  );
}


