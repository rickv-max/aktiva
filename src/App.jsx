import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Menu,
  Navigation,
  Radio
} from 'lucide-react';

// --- UTILS & MATH ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const toRad = (val) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
};

const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
};

// --- SKELETON COMPONENTS ---
const SkeletonMap = ({ isSearching }) => (
  <div className="w-full h-full bg-slate-200 flex items-center justify-center flex-col gap-4 overflow-hidden relative z-0">
    <div className="relative">
      <MapPin className="w-12 h-12 text-slate-400 relative z-10" />
      {isSearching && (
        <>
          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
          <div className="absolute -inset-4 bg-blue-300 rounded-full animate-pulse opacity-50"></div>
        </>
      )}
    </div>
    <div className="flex flex-col items-center mt-2">
      <div className={`h-5 rounded w-48 mb-2 ${isSearching ? 'bg-transparent text-slate-600 font-bold text-center' : 'bg-slate-300 animate-pulse'}`}>
        {isSearching ? 'Mencari Sinyal Satelit...' : ''}
      </div>
      <div className={`h-3 rounded w-32 ${isSearching ? 'bg-transparent text-slate-500 text-sm text-center' : 'bg-slate-300 animate-pulse'}`}>
        {isSearching ? 'Pastikan Anda di luar ruangan' : ''}
      </div>
    </div>
  </div>
);

// --- MAP COMPONENT ---
const MapView = ({ coordinates, currentPos, isLive, className }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polylineInstance = useRef(null);
  const markerInstance = useRef(null);
  const accuracyCircle = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.L) {
      setIsLoaded(true); return;
    }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.async = true; script.onload = () => setIsLoaded(true); document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (!mapInstance.current) {
      const initialPos = currentPos || (coordinates.length > 0 ? coordinates[0] : [-6.2088, 106.8456]); 
      
      mapInstance.current = window.L.map(mapRef.current, {
        zoomControl: false, dragging: isLive, scrollWheelZoom: isLive, doubleClickZoom: isLive,
      }).setView(initialPos, 17);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 20
      }).addTo(mapInstance.current);

      polylineInstance.current = window.L.polyline([], {
        color: '#fc4c02', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round'
      }).addTo(mapInstance.current);

      if (isLive) {
        markerInstance.current = window.L.circleMarker(initialPos, {
          radius: 7, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
        }).addTo(mapInstance.current);
      }

      const resizeObserver = new ResizeObserver(() => mapInstance.current && mapInstance.current.invalidateSize());
      resizeObserver.observe(mapRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [isLoaded, isLive]);

  useEffect(() => {
    if (!mapInstance.current) return;
    polylineInstance.current.setLatLngs(coordinates);
    
    if (isLive && currentPos) {
      markerInstance.current.setLatLng(currentPos);
      mapInstance.current.setView(currentPos, mapInstance.current.getZoom());
    } else if (!isLive && coordinates.length > 0) {
      mapInstance.current.fitBounds(polylineInstance.current.getBounds(), { padding: [30, 30] });
    }
  }, [coordinates, currentPos, isLive]);

  if (!isLoaded) return <SkeletonMap isSearching={false} />;

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
        <p className="text-slate-500 mb-8 max-w-sm">Daftar aktivitas lari Anda akan muncul di sini. Buka tab rekam untuk memulai.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-8 pb-28 md:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.slice().reverse().map((activity) => (
            <div key={activity.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col">
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">{activity.title}</h3>
                  <p className="text-xs text-slate-500">{formatDate(new Date(activity.date))}</p>
                </div>
              </div>
              <div className="h-56 w-full bg-slate-100 relative shrink-0">
                 {activity.coordinates.length > 0 ? (
                   <MapView coordinates={activity.coordinates} currentPos={null} isLive={false} className="w-full h-full" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-slate-400">
                     <AlertCircle className="w-6 h-6 mr-2" /> Rute tidak terekam
                   </div>
                 )}
              </div>
              <div className="p-4 grid grid-cols-3 gap-4 border-t border-slate-50 bg-slate-50/50 flex-1">
                <div>
                  <p className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-wide">Jarak</p>
                  <p className="font-black text-slate-900 text-lg md:text-xl">{(activity.distance / 1000).toFixed(2)} <span className="text-sm font-medium text-slate-500">km</span></p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-wide">Waktu</p>
                  <p className="font-black text-slate-900 text-lg md:text-xl">{formatTime(activity.duration)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-wide">Pace</p>
                  <p className="font-black text-slate-900 text-lg md:text-xl">{formatPace(activity.distance, activity.duration)} <span className="text-sm font-medium text-slate-500">/km</span></p>
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
  
  // Data GPS State
  const [currentPos, setCurrentPos] = useState(null); // [lat, lng] real-time
  const [coordinates, setCoordinates] = useState([]); // Jalur yang dilalui
  const [distance, setDistance] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [gpsAccuracy, setGpsAccuracy] = useState(999); 
  
  // Status State
  const [gpsStatus, setGpsStatus] = useState('searching'); // searching, ready, error, permission_denied
  const [errorMsg, setErrorMsg] = useState('');

  // Refs untuk bypass stale-state di dalam watchPosition callback
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);
  const coordinatesRef = useRef(coordinates);
  
  const watchId = useRef(null);
  const timerRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());

  // Sinkronisasi state ke refs
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { coordinatesRef.current = coordinates; }, [coordinates]);

  // ENGINE GPS UTAMA (Berjalan terus menerus)
  const startGpsEngine = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setErrorMsg('Geolokasi tidak didukung oleh browser Anda.');
      return;
    }

    setGpsStatus('searching');

    // Hapus sesi lama jika ada
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newCoord = [latitude, longitude];
        
        setCurrentPos(newCoord);
        setGpsAccuracy(Math.round(accuracy));
        
        if (gpsStatus !== 'ready') setGpsStatus('ready'); // Terkunci!

        // Logika Perekaman Jalur
        if (isRecordingRef.current && !isPausedRef.current) {
          const prevPath = coordinatesRef.current;
          
          // Filter 1: Buang data jika akurasi sangat buruk (> 60 meter) kecuali ini titik pertama
          if (accuracy > 60 && prevPath.length > 0) return;

          if (prevPath.length > 0) {
            const lastCoord = prevPath[prevPath.length - 1];
            const dist = calculateDistance(lastCoord[0], lastCoord[1], newCoord[0], newCoord[1]);
            
            // Filter 2: Threshold micro-movement. Jika jarak > 0.5 meter, rekam. 
            // (Memungkinkan jalan kaki terekam)
            if (dist > 0.5) {
              setDistance(d => d + dist);
              setCoordinates(prev => [...prev, newCoord]);
            }
          } else {
            // Titik awal
            setCoordinates([newCoord]);
          }
        }
      },
      (err) => {
        console.warn("GPS Engine Error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('permission_denied');
          setErrorMsg('Izin lokasi ditolak. Buka pengaturan browser, izinkan akses lokasi untuk web ini, lalu muat ulang halaman.');
        } else if (err.code === err.TIMEOUT) {
          // Timeout wajar saat pertama kali cold-start, biarkan status tetap searching
          console.log("GPS Timeout, retrying automatically...");
        } else {
          setGpsStatus('error');
          setErrorMsg(`Gagal melacak: ${err.message}`);
        }
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 1000,   // Jangan terlalu lama menyimpan cache data
        timeout: 10000      // Timeout per 10 detik agar trigger error dan memaksa ulang pencarian
      }
    );
  }, [gpsStatus]);

  useEffect(() => {
    startGpsEngine();
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []); // Hanya dipanggil sekali saat komponen mount

  // ENGINE TIMER
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

  // CONTROLS
  const handleStart = () => {
    if (gpsStatus !== 'ready' && gpsStatus !== 'searching') return;
    setIsRecording(true);
    setIsPaused(false);
  };
  const handlePause = () => setIsPaused(true);
  const handleResume = () => setIsPaused(false);
  const handleStop = () => {
    if (distance > 0 || duration > 0) {
      const hour = new Date().getHours();
      let title = "Lari Malam";
      if (hour >= 5 && hour < 11) title = "Lari Pagi";
      else if (hour >= 11 && hour < 15) title = "Lari Siang";
      else if (hour >= 15 && hour < 18) title = "Lari Sore";

      onSaveActivity({
        id: Date.now(), date: new Date().toISOString(), duration, distance, coordinates, title
      });
    }
    setIsRecording(false); setIsPaused(false); setDistance(0); setDuration(0); setCoordinates([]);
  };

  return (
    <div className="w-full h-full relative bg-slate-900 overflow-hidden flex flex-col md:block">
      
      {/* AREA PETA & UI ERROR */}
      <div className="flex-1 md:absolute md:inset-0 relative z-0 bg-slate-100">
        
        {gpsStatus === 'permission_denied' || gpsStatus === 'error' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-600 bg-slate-50 z-10 relative">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
               <Navigation className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">GPS Bermasalah</h2>
            <p className="text-sm md:text-base font-medium mb-8 max-w-sm text-slate-500">{errorMsg}</p>
            <button 
              onClick={startGpsEngine}
              className="px-8 py-4 bg-slate-900 text-white rounded-full font-bold shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-3"
            >
              <MapPin className="w-5 h-5" /> Coba Lagi
            </button>
          </div>
        ) : gpsStatus === 'searching' && !currentPos ? (
          <SkeletonMap isSearching={true} />
        ) : (
          <MapView coordinates={coordinates} currentPos={currentPos} isLive={true} className="w-full h-full" />
        )}

        {/* HUD GPS INDICATOR (Sangat Profesional & Membantu Debugging) */}
        {(gpsStatus === 'ready' || (gpsStatus === 'searching' && currentPos)) && (
          <div className="absolute top-6 left-6 z-[400] flex flex-col gap-2">
            
            {/* Status Rekam */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-md shadow-md rounded-full border border-slate-200">
              <div className={`w-3 h-3 rounded-full ${isRecording && !isPaused ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`}></div>
              <span className="text-sm font-bold text-slate-800 uppercase tracking-widest">
                {isRecording ? (isPaused ? 'DIJEDA' : 'MEREKAM') : 'SIAP REKAM'}
              </span>
            </div>

            {/* Akurasi GPS */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-md shadow-sm rounded-full border border-slate-200 w-max">
              <Radio className={`w-4 h-4 ${gpsAccuracy < 15 ? 'text-emerald-500' : gpsAccuracy < 50 ? 'text-amber-500' : 'text-red-500'}`} />
              <span className="text-xs font-bold text-slate-600">
                Akurasi: {gpsAccuracy}m {gpsAccuracy > 50 && '(Sinyal Lemah)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING DASHBOARD KONTROL */}
      <div className={`z-10 bg-white md:bg-white/85 md:backdrop-blur-2xl md:absolute md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:w-[90%] md:max-w-4xl md:rounded-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] md:shadow-2xl rounded-t-[2rem] -mt-6 p-6 pb-28 md:pb-6 transition-transform duration-500 border border-white/50 ${(gpsStatus === 'permission_denied' || gpsStatus === 'error') ? 'translate-y-full md:translate-y-0 opacity-0 md:opacity-50 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 md:mb-0">
          <div className="grid grid-cols-2 md:flex md:flex-1 md:justify-around gap-y-8 gap-x-4">
            <div className="text-center md:text-left">
              <p className="text-xs md:text-sm font-bold text-slate-400 flex items-center justify-center md:justify-start gap-1.5 mb-1.5 tracking-widest uppercase"><Clock className="w-4 h-4 text-orange-500" /> Waktu</p>
              <p className="text-4xl md:text-5xl font-black text-slate-800 font-mono tracking-tighter">{formatTime(duration)}</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs md:text-sm font-bold text-slate-400 flex items-center justify-center md:justify-start gap-1.5 mb-1.5 tracking-widest uppercase"><Target className="w-4 h-4 text-orange-500" /> Jarak</p>
              <p className="text-4xl md:text-5xl font-black text-slate-800">
                {(distance / 1000).toFixed(2)}
                <span className="text-lg md:text-2xl font-semibold text-slate-500 ml-1">km</span>
              </p>
            </div>
            <div className="text-center md:text-left">
               <p className="text-xs md:text-sm font-bold text-slate-400 flex items-center justify-center md:justify-start gap-1.5 mb-1.5 tracking-widest uppercase"><Zap className="w-4 h-4 text-orange-500" /> Pace</p>
               <p className="text-3xl md:text-4xl font-black text-slate-800">{formatPace(distance, duration)} <span className="text-sm md:text-lg text-slate-500 font-medium">/km</span></p>
            </div>
            <div className="text-center md:text-left">
               <p className="text-xs md:text-sm font-bold text-slate-400 flex items-center justify-center md:justify-start gap-1.5 mb-1.5 tracking-widest uppercase"><Flame className="w-4 h-4 text-orange-500" /> Kalori</p>
               <p className="text-3xl md:text-4xl font-black text-slate-800">{Math.floor((distance/1000) * 60)} <span className="text-sm md:text-lg text-slate-500 font-medium">kcal</span></p>
            </div>
          </div>

          <div className="flex justify-center md:justify-end gap-5 shrink-0 md:pl-10 md:border-l-2 border-slate-100">
            {!isRecording ? (
              <button 
                onClick={handleStart}
                disabled={gpsStatus !== 'ready' && !currentPos}
                className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-tr from-orange-600 to-orange-400 text-white rounded-full flex items-center justify-center shadow-[0_10px_40px_rgba(252,76,2,0.4)] hover:shadow-[0_15px_50px_rgba(252,76,2,0.6)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 disabled:cursor-not-allowed group"
              >
                <Play className="w-10 h-10 md:w-12 md:h-12 ml-2 text-white drop-shadow-md group-hover:scale-110 transition-transform" fill="currentColor" />
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button 
                    onClick={handleResume}
                    className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-tr from-emerald-500 to-emerald-400 text-white rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.4)] transition-all hover:scale-105 active:scale-95"
                  >
                    <Play className="w-8 h-8 md:w-10 md:h-10 ml-1 drop-shadow-md" fill="currentColor" />
                  </button>
                ) : (
                  <button 
                    onClick={handlePause}
                    className="w-20 h-20 md:w-24 md:h-24 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 border-4 border-slate-700 hover:bg-slate-900"
                  >
                    <div className="flex gap-2">
                      <div className="w-2.5 h-8 md:h-10 bg-white rounded-sm drop-shadow-md"></div>
                      <div className="w-2.5 h-8 md:h-10 bg-white rounded-sm drop-shadow-md"></div>
                    </div>
                  </button>
                )}
                <button 
                  onClick={handleStop}
                  className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-tr from-orange-600 to-orange-400 text-white rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(252,76,2,0.4)] transition-all hover:scale-105 active:scale-95 group"
                >
                  <Square className="w-8 h-8 md:w-9 md:h-9 drop-shadow-md group-hover:scale-90 transition-transform" fill="currentColor" />
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
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 mb-8 mt-4 flex flex-col md:flex-row items-center gap-6 md:gap-8 transition-all">
          <div className="w-28 h-28 md:w-36 md:h-36 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-full flex items-center justify-center shadow-xl border-4 border-white shrink-0 relative">
            <User className="w-14 h-14 md:w-16 md:h-16 text-white" />
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm">
               <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-2xl md:text-4xl font-black text-slate-900 mb-1 tracking-tight">Pelari Profesional</h2>
            <p className="text-slate-500 mb-4 font-medium">Anggota sejak Hari Ini</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <span className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-bold shadow-sm">🏆 Elite Runner</span>
              <span className="px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold shadow-sm">🔥 Streak: 1 Hari</span>
            </div>
          </div>
        </div>

        <h3 className="text-xl md:text-2xl font-black text-slate-800 mb-6 px-2 tracking-tight">Statistik Keseluruhan</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-lg transition-all hover:-translate-y-1">
            <p className="text-xs md:text-sm text-slate-400 mb-2 font-bold tracking-widest uppercase">Total Jarak</p>
            <p className="text-3xl md:text-4xl font-black text-orange-500">{(totalDistance / 1000).toFixed(2)} <span className="text-base md:text-lg font-medium text-slate-500">km</span></p>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-lg transition-all hover:-translate-y-1">
            <p className="text-xs md:text-sm text-slate-400 mb-2 font-bold tracking-widest uppercase">Total Waktu</p>
            <p className="text-3xl md:text-4xl font-black text-slate-800">{formatTime(totalDuration)}</p>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-lg transition-all hover:-translate-y-1">
            <p className="text-xs md:text-sm text-slate-400 mb-2 font-bold tracking-widest uppercase">Aktivitas</p>
            <p className="text-3xl md:text-4xl font-black text-slate-800">{activities.length}</p>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-center hover:shadow-lg transition-all hover:-translate-y-1">
            <p className="text-xs md:text-sm text-slate-400 mb-2 font-bold tracking-widest uppercase">Avg Pace</p>
            <p className="text-3xl md:text-4xl font-black text-slate-800">{activities.length > 0 ? formatPace(totalDistance, totalDuration) : '--:--'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('feed'); 
  const [activities, setActivities] = useState([]);
  
  const handleSaveActivity = (newActivity) => {
    setActivities(prev => [...prev, newActivity]);
    setCurrentTab('feed'); 
  };

  const NavItem = ({ id, icon: Icon, label }) => {
    const isActive = currentTab === id;
    const mobileStyle = `flex flex-col items-center gap-1.5 p-2 ${isActive ? 'text-orange-500' : 'text-slate-400 hover:text-slate-600'}`;
    const desktopStyle = `w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${isActive ? 'bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'}`;

    return (
      <>
        <button onClick={() => setCurrentTab(id)} className={`md:hidden ${id === 'record' ? 'flex flex-col items-center justify-center -mt-10 w-[72px] h-[72px] rounded-full shadow-[0_8px_30px_rgba(252,76,2,0.4)] transition-transform active:scale-95 bg-gradient-to-tr from-orange-600 to-orange-400 text-white border-4 border-white' : mobileStyle}`}>
          <Icon className={id === 'record' ? 'w-8 h-8 drop-shadow-md' : 'w-6 h-6'} />
          {id !== 'record' && <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>}
        </button>
        <button onClick={() => setCurrentTab(id)} className={`hidden md:flex ${desktopStyle}`}>
          <Icon className="w-6 h-6 shrink-0" />
          <span className="text-base tracking-wide hidden lg:block">{label}</span>
        </button>
      </>
    );
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans antialiased text-slate-900 overflow-hidden">
      <aside className="hidden md:flex flex-col w-20 lg:w-72 bg-slate-900 border-r border-slate-800 shrink-0 shadow-2xl z-50">
        <div className="h-24 flex items-center px-6 lg:px-8 shrink-0 border-b border-white/5">
          <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-orange-400 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <span className="hidden lg:block ml-4 text-2xl font-black text-white tracking-tight">RunTracker</span>
        </div>
        
        <nav className="flex-1 flex flex-col gap-3 px-4 py-8">
          <NavItem id="feed" icon={Menu} label="Beranda" />
          <NavItem id="record" icon={MapIcon} label="Rekam Aktivitas" />
          <NavItem id="profile" icon={User} label="Profil Anda" />
        </nav>

        <div className="p-4 lg:p-6 pb-8">
          <div className="hidden lg:flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center border-2 border-slate-600">
              <User className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Pelari Pro</p>
              <p className="text-xs font-medium text-emerald-400 flex items-center gap-1"><Zap className="w-3 h-3" fill="currentColor"/> GPS Aktif</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full h-full min-w-0">
        {(currentTab !== 'record') && (
          <header className="bg-white/90 backdrop-blur-xl px-6 md:px-10 py-5 md:py-6 flex items-center justify-between shadow-sm z-40 border-b border-slate-200 shrink-0">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              {currentTab === 'feed' && "Aktivitas Terakhir"}
              {currentTab === 'profile' && "Statistik & Profil"}
            </h1>
            {currentTab === 'feed' && (
               <div className="w-10 h-10 rounded-full bg-slate-100 flex md:hidden items-center justify-center border border-slate-200 shadow-sm">
                 <User className="w-5 h-5 text-slate-600" />
               </div>
            )}
          </header>
        )}

        <div className="flex-1 relative overflow-hidden w-full h-full">
          {currentTab === 'feed' && <FeedScreen activities={activities} />}
          {currentTab === 'record' && <RecordScreen onSaveActivity={handleSaveActivity} />}
          {currentTab === 'profile' && <ProfileScreen activities={activities} />}
        </div>

        <nav className="md:hidden absolute bottom-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 px-6 py-2 flex justify-between items-center z-50 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <NavItem id="feed" icon={Menu} label="Beranda" />
          <NavItem id="record" icon={MapIcon} label="Rekam" />
          <NavItem id="profile" icon={User} label="Profil" />
        </nav>
      </main>
    </div>
  );
}

