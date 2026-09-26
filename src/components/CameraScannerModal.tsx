/**
 * Continuous Camera Barcode Scanner Modal
 * Upgraded with non-closing continuous batch scanning, audio/haptic feedback,
 * scrollable scanned product list, and an always-visible sticky "Done Scanning" footer.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Camera,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Zap,
  ZapOff,
  SwitchCamera,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Check,
  Barcode as BarcodeIcon,
  ChevronDown,
  ChevronUp,
  PackageCheck
} from 'lucide-react';
import { CartItem, Settings, Product } from '../db/indexedDB';

export interface ScanResult {
  success: boolean;
  message?: string;
  product?: Product;
  quantity?: number;
}

interface CameraScannerModalProps {
  onScan: (barcode: string) => ScanResult | boolean | void | Promise<ScanResult | boolean | void>;
  onClose: () => void;
  settings?: Settings;
  cartItems?: CartItem[];
  onUpdateQuantity?: (productId: string, delta: number) => void;
  onRemoveItem?: (productId: string) => void;
  title?: string;
}

interface ScanNotification {
  id: string;
  type: 'success' | 'warning' | 'error';
  title: string;
  subtitle?: string;
  timestamp: number;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  onScan,
  onClose,
  settings,
  cartItems = [],
  onUpdateQuantity,
  onRemoveItem,
  title = 'Barcode Scanner',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [activeNotification, setActiveNotification] = useState<ScanNotification | null>(null);
  const [sessionScanCount, setSessionScanCount] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [isTargetHighlighted, setIsTargetHighlighted] = useState(false);

  // Timestamps for throttling duplicate scans
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);

  // Synthesize pleasant scanner beep sounds using Web Audio API
  const playBeep = useCallback((isSuccess: boolean) => {
    if (!soundEnabled) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        // High-pitched cheerful POS double-pip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(1850, now + 0.08);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.start(now);
        osc.stop(now + 0.12);
      } else {
        // Low double-buzz for unrecognized code
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(260, now + 0.1);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch (e) {
      console.debug('Audio feedback error:', e);
    }
  }, [soundEnabled]);

  // Trigger haptic vibration on mobile
  const triggerHaptic = useCallback((isSuccess: boolean) => {
    try {
      if (navigator.vibrate) {
        if (isSuccess) {
          navigator.vibrate(80);
        } else {
          navigator.vibrate([100, 60, 100]);
        }
      }
    } catch {
      // Ignore vibration errors
    }
  }, []);

  // Handle scanned barcode logic
  const handleProcessBarcode = useCallback(async (barcodeRaw: string) => {
    const code = barcodeRaw.trim();
    if (!code) return;

    const now = Date.now();
    const sameCode = lastScannedRef.current.code === code;
    const timeSinceLast = now - lastScannedRef.current.time;

    // Cooldown: 1.8 seconds for same barcode, 400ms for different barcode
    if (sameCode && timeSinceLast < 1800) {
      return;
    }
    if (!sameCode && timeSinceLast < 400) {
      return;
    }

    lastScannedRef.current = { code, time: now };
    setLastScannedCode(code);

    // Visual highlight pulse
    setIsTargetHighlighted(true);
    setTimeout(() => setIsTargetHighlighted(false), 600);

    try {
      const result = await onScan(code);

      if (typeof result === 'object' && result !== null && 'success' in result) {
        if (result.success) {
          playBeep(true);
          triggerHaptic(true);
          setSessionScanCount((prev) => prev + 1);

          setActiveNotification({
            id: `notif-${now}`,
            type: 'success',
            title: result.product ? result.product.name : 'Item Added to Cart',
            subtitle: result.message || `Code: ${code}`,
            timestamp: now,
          });

          // Scroll scanned list to bottom if open
          if (listContainerRef.current) {
            setTimeout(() => {
              listContainerRef.current?.scrollTo({
                top: listContainerRef.current.scrollHeight,
                behavior: 'smooth',
              });
            }, 100);
          }
        } else {
          playBeep(false);
          triggerHaptic(false);
          setActiveNotification({
            id: `notif-${now}`,
            type: 'warning',
            title: 'Not Added',
            subtitle: result.message || `Code: ${code}`,
            timestamp: now,
          });
        }
      } else {
        // Default success
        playBeep(true);
        triggerHaptic(true);
        setSessionScanCount((prev) => prev + 1);
        setActiveNotification({
          id: `notif-${now}`,
          type: 'success',
          title: 'Scanned Successfully',
          subtitle: `Barcode: ${code}`,
          timestamp: now,
        });
      }
    } catch (err: unknown) {
      console.error('Scan processing error:', err);
      playBeep(false);
      triggerHaptic(false);
      setActiveNotification({
        id: `notif-${now}`,
        type: 'error',
        title: 'Scan Error',
        subtitle: `Could not process barcode ${code}`,
        timestamp: now,
      });
    }
  }, [onScan, playBeep, triggerHaptic]);

  // Check available cameras
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        if (videoDevices.length > 1) {
          setHasMultipleCameras(true);
        }
      }).catch((e) => console.debug('Device enum error:', e));
    }
  }, []);

  // Camera initialization and detection loop
  useEffect(() => {
    let animationFrameId: number;
    let isMounted = true;

    const startCamera = async () => {
      try {
        setError(null);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API is not supported in this browser.');
        }

        // Stop existing stream if switching
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Check if torch/flashlight capability is available
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof (videoTrack as any).getCapabilities === 'function') {
          const capabilities = (videoTrack as any).getCapabilities();
          setHasTorch(Boolean(capabilities?.torch));
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.debug('Video play interrupted:', err);
          });
          setIsScanning(true);
        }

        // Native BarcodeDetector API detection loop
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: [
              'code_128',
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_39',
              'code_93',
              'itf',
              'qr_code',
              'data_matrix',
            ],
          });

          const detectLoop = async () => {
            if (!isMounted) return;

            if (
              videoRef.current &&
              videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
            ) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const scannedValue = barcodes[0].rawValue;
                  if (scannedValue) {
                    handleProcessBarcode(scannedValue);
                  }
                }
              } catch (err) {
                console.debug('Frame detect error:', err);
              }
            }

            animationFrameId = requestAnimationFrame(detectLoop);
          };

          detectLoop();
        } else {
          setError(
            'BarcodeDetector API is not natively supported in this browser. You can still enter or copy barcodes manually below.'
          );
        }
      } catch (err: unknown) {
        console.error('Camera access error:', err);
        setError(
          'Unable to access camera. Please check camera permissions or use manual barcode entry below.'
        );
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, handleProcessBarcode]);

  // Flashlight toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && typeof (track as any).applyConstraints === 'function') {
      try {
        const nextState = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.warn('Torch apply error:', e);
      }
    }
  };

  // Flip camera between front & back
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Manual submission - keeps scanner open for next barcode
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      handleProcessBarcode(code);
      setManualCode('');
    }
  };

  // Auto-dismiss notification toast after 3.2 seconds
  useEffect(() => {
    if (!activeNotification) return;
    const timer = setTimeout(() => {
      setActiveNotification(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [activeNotification]);

  // Cart totals
  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const currencySymbol = settings?.currency || '₱';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/85 p-2 sm:p-4 md:p-6 pb-20 sm:pb-6 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Container: Elevated with bottom clearance so mobile nav bar never overlaps */}
      <div className="relative w-full max-w-xl flex flex-col h-full max-h-[calc(100dvh-5.5rem)] sm:max-h-[85vh] rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-all mb-4 sm:mb-0">
        
        {/* 1. Header Bar (Always Fixed / Sticky at Top) */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
              <Camera className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {title}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Continuous
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Hold barcodes to scan continuously
              </p>
            </div>
          </div>

          {/* Controls: Audio, Torch, Camera Switch, Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Beep Sound' : 'Unmute Beep Sound'}
              className={`p-2 rounded-xl border transition ${
                soundEnabled
                  ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-400'
                  : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Flashlight/Torch (if supported) */}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={torchEnabled ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
                className={`p-2 rounded-xl border transition ${
                  torchEnabled
                    ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-800'
                }`}
              >
                {torchEnabled ? <Zap className="w-4 h-4 fill-amber-400 text-amber-500" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {/* Camera Switcher (if multiple cameras) */}
            {hasMultipleCameras && (
              <button
                type="button"
                onClick={toggleFacingMode}
                title="Switch Camera Lens"
                className="p-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {/* Close X */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Scanner"
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Middle Body: Scrollable Content with Camera & Scanned Items List */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 overscroll-contain">
          
          {/* Viewfinder Section */}
          <div className="relative bg-black shrink-0 overflow-hidden select-none">
            {error ? (
              <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px] bg-slate-900 text-slate-300">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 mb-2">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">Camera Notice</h4>
                <p className="text-xs text-slate-400 max-w-sm">{error}</p>
              </div>
            ) : (
              <div className="relative aspect-[16/10] sm:aspect-video max-h-[280px] sm:max-h-[320px] w-full overflow-hidden bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />

                {/* Viewfinder Targeting Reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                  <div
                    className={`relative w-4/5 max-w-xs h-32 sm:h-40 rounded-2xl transition-all duration-300 ${
                      isTargetHighlighted
                        ? 'border-4 border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.5)]'
                        : 'border-2 border-white/60 bg-black/15 shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                    }`}
                  >
                    {/* Laser Scan Sweep Animation */}
                    <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-laser-sweep" />

                    {/* Corner Accent Brackets */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

                    {/* Center Crosshair Hint */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <BarcodeIcon className={`w-7 h-7 opacity-40 transition-colors duration-200 ${isTargetHighlighted ? 'text-emerald-300 opacity-80' : 'text-white'}`} />
                      <span className="text-[10px] font-medium text-white/70 tracking-wide mt-1 drop-shadow">
                        Align Barcode Here
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Toast Notification Banner */}
                {activeNotification && (
                  <div className="absolute top-2 inset-x-2 sm:inset-x-6 z-20 pointer-events-none animate-in fade-in slide-in-from-top duration-200">
                    <div
                      className={`flex items-center gap-2.5 p-2.5 rounded-2xl shadow-xl backdrop-blur-md border ${
                        activeNotification.type === 'success'
                          ? 'bg-emerald-950/90 border-emerald-500/40 text-white'
                          : activeNotification.type === 'warning'
                          ? 'bg-amber-950/90 border-amber-500/40 text-white'
                          : 'bg-rose-950/90 border-rose-500/40 text-white'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-xl shrink-0 ${
                          activeNotification.type === 'success'
                            ? 'bg-emerald-500 text-white'
                            : activeNotification.type === 'warning'
                            ? 'bg-amber-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {activeNotification.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">
                          {activeNotification.title}
                        </div>
                        {activeNotification.subtitle && (
                          <div className="text-[11px] opacity-85 truncate">
                            {activeNotification.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom HUD: Live Session Counter & Last Scanned */}
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-3 py-1 rounded-xl bg-slate-950/70 backdrop-blur-sm text-white/90 text-xs border border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold text-[11px]">
                      Scanned: {sessionScanCount}
                    </span>
                  </div>
                  {lastScannedCode && (
                    <div className="text-[11px] text-slate-300 font-mono truncate max-w-[150px]">
                      Last: {lastScannedCode}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scanned Cart Products Section (Expandable and Scrollable Upwards/Downwards) */}
          <div className="flex-1 flex flex-col bg-slate-50/70 dark:bg-slate-900/60 min-h-0">
            {/* Toggle Bar */}
            <button
              type="button"
              onClick={() => setShowCartDrawer(!showCartDrawer)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition border-b border-slate-100 dark:border-slate-800 shrink-0 select-none"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Scanned Items in Cart ({totalCartCount})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-blue-600 dark:text-blue-400 text-xs sm:text-sm">
                  {currencySymbol}{cartSubtotal.toFixed(2)}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span>{showCartDrawer ? 'Hide List' : 'View List'}</span>
                  {showCartDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </div>
            </button>

            {/* Scrollable Scanned List Container with Enriched Roomy Height */}
            {showCartDrawer ? (
              <div
                ref={listContainerRef}
                className="flex-1 min-h-[220px] max-h-[48vh] sm:max-h-[380px] overflow-y-auto p-3.5 space-y-3 bg-slate-50 dark:bg-slate-950/50 overscroll-contain"
              >
                {cartItems.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-center">
                    <PackageCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-1.5" />
                    <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">No scanned items in cart yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Point camera at a barcode or type code below</p>
                  </div>
                ) : (
                  <>
                    {cartItems.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-xs"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200/80 dark:border-slate-700">
                          {item.product.image ? (
                            <img
                              src={typeof item.product.image === 'string' ? item.product.image : URL.createObjectURL(item.product.image)}
                              alt={item.product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <BarcodeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                            {item.product.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-semibold">{currencySymbol}{item.product.price.toFixed(2)} ea</span>
                            <span>•</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {currencySymbol}{(item.product.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                          <div className="font-mono text-[9px] text-slate-400 truncate mt-0.5">
                            {item.product.barcode || item.product.sku}
                          </div>
                        </div>

                        {/* Quantity Modifier Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {onUpdateQuantity && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.product.id, -1)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                                title="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.product.id, 1)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                                title="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {onRemoveItem && (
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.product.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Generous bottom spacer so the very last item is 100% visible and accessible */}
                    <div className="h-8 w-full shrink-0" aria-hidden="true" />
                  </>
                )}
              </div>
            ) : (
              /* Collapsed Quick Summary Pill */
              <div className="px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Hold barcodes to add more items</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {totalCartCount > 0 ? `${totalCartCount} item${totalCartCount === 1 ? '' : 's'} ready for checkout` : 'Ready to scan'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Bottom Footer (ALWAYS STICKY & VISIBLE AT THE BOTTOM) */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-30 shadow-[0_-8px_16px_rgba(0,0,0,0.04)] space-y-2.5">
          {/* Manual Barcode Input (Does not close modal, allows rapid sequential typing) */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or enter barcode (e.g. 200001000001)..."
                className="w-full rounded-xl border border-slate-200 pl-3 pr-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 text-xs sm:text-sm font-bold text-white transition flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Prominent Always-Visible "Done Scanning" Exit Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-sm shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Done Scanning ({totalCartCount} item{totalCartCount === 1 ? '' : 's'}) • Return to POS</span>
          </button>
        </div>

      </div>
    </div>
  );
};
