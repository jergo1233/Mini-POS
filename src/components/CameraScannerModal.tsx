/**
 * Camera Barcode Scanner Modal for mobile and desktop devices
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';

interface CameraScannerModalProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API is not supported in this browser.');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.debug('Video play interrupted:', err);
          });
          setIsScanning(true);
        }

        // Check if BarcodeDetector is supported
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as unknown as { BarcodeDetector: new (options?: { formats?: string[] }) => { detect: (el: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] });

          
          const detect = async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const scannedValue = barcodes[0].rawValue;
                  if (scannedValue) {
                    onScan(scannedValue);
                    stopStream();
                    onClose();
                    return;
                  }
                }
              } catch (err) {
                console.debug('Detection frame error:', err);
              }
            }
            if (isScanning) {
              animationFrameId = requestAnimationFrame(detect);
            }
          };
          detect();
        } else {
          setError('BarcodeDetector API not natively supported in this browser. Please use manual barcode entry or physical scanner.');
        }
      } catch (err: unknown) {
        console.error('Camera access error:', err);
        setError('Unable to access camera. Please check camera permissions or use manual entry.');
      }
    };

    const stopStream = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setIsScanning(false);
      cancelAnimationFrame(animationFrameId);
    };

    startCamera();

    return () => {
      stopStream();
    };
  }, [onScan, onClose, isScanning]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scan Barcode</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          {error ? (
            <div className="rounded-xl bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Camera Notice</span>
              </div>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <div className="absolute inset-0 border-2 border-blue-500/50 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-1/2 border-2 border-dashed border-white/70 rounded-lg animate-pulse" />
              </div>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="mt-6">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Or Enter Barcode Manually
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 200001000001"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
