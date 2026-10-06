import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, QrCode, AlertCircle } from 'lucide-react';

// Simplified scanning using BarcodeDetector API if available, 
// otherwise this would need a library like jsqr. 
// For this POS, I'll leverage the proven camera initialization from CameraScannerModal.
interface QRScannerModalProps {
  onScan: (data: string | null) => void;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.debug('Play interrupted:', e));

          // Scan loop
          if ('BarcodeDetector' in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            
            const scan = async () => {
              if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes.length > 0) {
                    onScan(barcodes[0].rawValue);
                    return; // Stop scanning after successful scan
                  }
                } catch (e) {
                  console.debug('Scan error:', e);
                }
              }
              animationFrameId = requestAnimationFrame(scan);
            };
            scan();
          } else {
            setError('Barcode scanning not supported in this browser.');
          }
        }
      } catch (err) {
        setError('Camera access denied or not available: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    initCamera();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scan Recovery QR</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="aspect-square overflow-hidden rounded-2xl bg-black relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        </div>
        <p className="text-xs text-slate-500 mt-4 text-center">Camera active. Ensure QR code is in view.</p>
      </div>
    </div>,
    document.body
  );
};
