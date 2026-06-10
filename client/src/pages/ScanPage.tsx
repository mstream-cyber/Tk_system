import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

type ScanState = 'pin' | 'scanning' | 'loading' | 'valid' | 'already_used' | 'invalid';
type ResultData = {
  buyerName?: string;
  ticketType?: string;
  quantity?: number;
  eventName?: string;
  scannedAt?: string;
  errorMessage?: string;
};

const STORAGE_KEY = 'scan_pin_confirmed';

export default function ScanPage() {
  const [state, setState] = useState<ScanState>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [result, setResult] = useState<ResultData>({});
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scanningRef = useRef(false);

  const correctPin = import.meta.env.VITE_SCAN_PIN || '0000';

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
      setState('scanning');
    }
  }, []);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    scanningRef.current = false;
  }, []);

  const resetToScanning = useCallback(() => {
    stopScanner();
    setResult({});
    setState('loading');
    setTimeout(() => setState('scanning'), 150);
  }, [stopScanner]);

  const handlePinSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setPinError('');
      setState('scanning');
    } else {
      setPinError('Incorrect PIN');
    }
  }, [pin, correctPin]);

  const handleScan = useCallback(async (decodedText: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    stopScanner();
    setState('loading');

    const token = decodedText.trim();

    if (!token.startsWith('gt_')) {
      setResult({ errorMessage: 'Not a valid Global Tickets QR code' });
      setState('invalid');
      scanningRef.current = false;
      return;
    }

    try {
      const res = await fetch('/api/ticket/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setResult({
          scannedAt: data.data?.scanned_at || new Date().toISOString()
        });
        setState('already_used');
      } else if (res.ok && data.success) {
        setResult({
          buyerName: data.data?.buyer_name || '',
          ticketType: data.data?.ticket_type || '',
          quantity: data.data?.quantity || 0,
          eventName: data.data?.event_name || '',
        });
        setState('valid');
      } else {
        setResult({
          errorMessage: data.error || 'Ticket could not be verified'
        });
        setState('invalid');
      }
    } catch {
      setResult({ errorMessage: 'Network error. Please try again.' });
      setState('invalid');
    }
    scanningRef.current = false;
  }, [stopScanner]);

  useEffect(() => {
    if (state !== 'scanning') return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => handleScan(decodedText),
      () => {}
    );

    return () => {
      stopScanner();
    };
  }, [state, handleScan, stopScanner]);

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins}`;
  };

  if (state === 'pin') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <form onSubmit={handlePinSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Staff Login</h1>
            <p className="text-sm text-gray-500 mt-1">Enter PIN to access scanner</p>
          </div>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(''); }}
            placeholder="Enter PIN"
            maxLength={10}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none text-center text-lg tracking-widest font-bold focus:border-purple-500"
            autoFocus
          />
          {pinError && <p className="text-red-500 text-sm text-center mt-2">{pinError}</p>}
          <button type="submit" disabled={!pin.trim()} className="w-full mt-5 py-3 rounded-xl bg-purple-600 text-white font-bold text-base hover:bg-purple-700 disabled:opacity-50 transition-colors">
            Unlock Scanner
          </button>
        </form>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-base">Verifying ticket...</p>
        </div>
      </div>
    );
  }

  if (state === 'valid') {
    return (
      <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#16a34a' }}>
        <svg className="w-20 h-20 text-white mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <h1 className="text-white font-bold text-5xl mb-6" style={{ fontSize: '48px' }}>VALID</h1>
        {result.eventName && <p className="text-white text-base opacity-75 mb-2 font-medium">{result.eventName}</p>}
        {result.buyerName && <p className="text-white text-xl font-bold">{result.buyerName}</p>}
        {result.ticketType && <p className="text-white text-lg opacity-90">{result.ticketType}</p>}
        {result.quantity && <p className="text-white text-base opacity-80 mt-1">Qty: {result.quantity}</p>}
        <button onClick={resetToScanning} className="mt-8 px-8 py-3 rounded-xl bg-white text-green-700 font-bold text-base hover:bg-gray-100 transition-colors">
          Scan Next Ticket
        </button>
      </div>
    );
  }

  if (state === 'already_used') {
    return (
      <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#dc2626' }}>
        <svg className="w-20 h-20 text-white mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <h1 className="text-white font-bold text-5xl mb-4" style={{ fontSize: '48px' }}>ALREADY SCANNED</h1>
        {result.scannedAt && <p className="text-white text-base opacity-90">Scanned at: {formatTimestamp(result.scannedAt)}</p>}
        <button onClick={resetToScanning} className="mt-8 px-8 py-3 rounded-xl bg-white text-red-700 font-bold text-base hover:bg-gray-100 transition-colors">
          Scan Next Ticket
        </button>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#dc2626' }}>
        <svg className="w-20 h-20 text-white mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <h1 className="text-white font-bold text-5xl mb-4" style={{ fontSize: '48px' }}>INVALID TICKET</h1>
        <p className="text-white text-base opacity-90">{result.errorMessage || 'Ticket could not be verified'}</p>
        <button onClick={resetToScanning} className="mt-8 px-8 py-3 rounded-xl bg-white text-red-700 font-bold text-base hover:bg-gray-100 transition-colors">
          Scan Next Ticket
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="text-white text-xl font-bold text-center mb-2">Scan Ticket</h1>
        <p className="text-gray-400 text-sm text-center mb-6">Point camera at ticket QR code</p>
        <div id="qr-reader" className="rounded-xl overflow-hidden" />
      </div>
    </div>
  );
}
