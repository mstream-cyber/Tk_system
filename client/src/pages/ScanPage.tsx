import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LockIcon, CheckIcon, CloseIcon } from '../components/ui/Icons';
import msLogo from '../assets/mslogo.png';

type ScanState = 'pin' | 'scanning' | 'loading' | 'valid' | 'already_used' | 'invalid' | 'reset_success';
type ResultData = {
  buyerName?: string;
  ticketType?: string;
  quantity?: number;
  eventName?: string;
  eventDate?: string;
  venue?: string;
  ticketId?: string;
  scannedAt?: string;
  errorMessage?: string;
};

const TOKEN_KEY = 'scan_token';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-content-muted text-xs font-semibold uppercase tracking-wide">{label}</span>
      <span className="text-content text-sm font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export default function ScanPage() {
  const [state, setState] = useState<ScanState>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [result, setResult] = useState<ResultData>({});
  const [scannerToken, setScannerToken] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scanningRef = useRef(false);
  const currentScanTokenRef = useRef<string>('');

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      sessionStorage.setItem(TOKEN_KEY, urlToken);
      setScannerToken(urlToken);
      window.history.replaceState({}, '', '/scan');
      setState('scanning');
      return;
    }
    const savedToken = sessionStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setScannerToken(savedToken);
      setState('scanning');
      return;
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

  const handlePinSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    try {
      const res = await fetch('/api/admin/verify-scan-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await res.json();
      if (data.success && data.data?.token) {
        sessionStorage.setItem(TOKEN_KEY, data.data.token);
        setScannerToken(data.data.token);
        setState('scanning');
      } else {
        setPinError('Incorrect PIN');
      }
    } catch {
      setPinError('Network error. Try again.');
    }
  }, [pin]);

  const handleScan = useCallback(async (decodedText: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    currentScanTokenRef.current = decodedText.trim();
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (scannerToken) {
        headers['Authorization'] = `Bearer ${scannerToken}`;
      }
      const res = await fetch('/api/ticket/scan', {
        method: 'POST',
        headers,
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
          eventDate: data.data?.event_date || '',
          venue: data.data?.venue || '',
          ticketId: data.data?.ticket_id || '',
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
  }, [stopScanner, scannerToken]);

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

  const handleResetSubmit = useCallback(async () => {
    setResetLoading(true);
    setResetError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (scannerToken) {
        headers['Authorization'] = `Bearer ${scannerToken}`;
      }
      const res = await fetch('/api/ticket/reset-scan', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token: currentScanTokenRef.current,
          resetPassword: resetPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowResetModal(false);
        setResetPassword('');
        setResetLoading(false);
        setState('reset_success');
      } else {
        setResetError(data.error || 'Reset failed');
        setResetLoading(false);
      }
    } catch {
      setResetError('Network error. Try again.');
      setResetLoading(false);
    }
  }, [scannerToken, resetPassword]);

  const formatTimestamp = (iso: string, withTime = true) => {
    const d = new Date(iso);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    if (!withTime) return `${day} ${month} ${year}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins}`;
  };

  if (state === 'pin') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <form onSubmit={handlePinSubmit} className="bg-card rounded-2xl shadow-xl border border-border p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-4">
              <LockIcon className="text-accent-light" size={28} />
            </div>
            <h1 className="text-xl font-bold text-content">Staff Login</h1>
            <p className="text-sm text-content-muted mt-1">Enter PIN to access scanner</p>
          </div>
          <Input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(''); }}
            placeholder="Enter PIN"
            error={pinError}
            touched={!!pinError}
            className="text-center text-lg tracking-widest font-bold"
            maxLength={10}
          />
          <Button type="submit" disabled={!pin.trim()} className="w-full mt-5" size="lg">
            Unlock Scanner
          </Button>
        </form>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-content-secondary text-base">Verifying ticket...</p>
        </div>
      </div>
    );
  }

  if (state === 'valid') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden">
          <div className="bg-success px-6 py-5 text-center">
            <CheckIcon className="text-white mx-auto mb-1" size={40} />
            <h1 className="text-white font-bold text-3xl tracking-wider">VALID</h1>
          </div>
          <div className="p-5">
            {result.eventName && (
              <p className="text-accent-light text-sm font-semibold text-center mb-4">{result.eventName}</p>
            )}
            <div className="space-y-0">
              <DetailRow label="Buyer" value={result.buyerName || ''} />
              <DetailRow label="Ticket" value={result.ticketType || ''} />
              <DetailRow label="Qty" value={String(result.quantity)} />
              {result.eventDate && <DetailRow label="Date" value={formatTimestamp(result.eventDate, false)} />}
              {result.venue && <DetailRow label="Venue" value={result.venue} />}
              {result.ticketId && <DetailRow label="Ticket ID" value={result.ticketId} />}
            </div>
          </div>
        </div>
        <Button onClick={resetToScanning} className="mt-6" size="lg">
          Scan Next Ticket
        </Button>
      </div>
    );
  }

  if (state === 'already_used') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden">
          <div className="bg-danger px-6 py-5 text-center">
            <CloseIcon className="text-white mx-auto mb-1" size={40} />
            <h1 className="text-white font-bold text-2xl tracking-wider">ALREADY SCANNED</h1>
          </div>
          <div className="p-5">
            {result.scannedAt && <DetailRow label="Scanned At" value={formatTimestamp(result.scannedAt)} />}
          </div>
        </div>
        <Button onClick={resetToScanning} className="mt-5" size="lg">
          Scan Next Ticket
        </Button>
        <button
          onClick={() => { setResetPassword(''); setResetError(''); setShowResetModal(true); }}
          className="mt-3 text-sm text-content-muted hover:text-accent-light transition-colors underline underline-offset-2"
        >
          Reset scan
        </button>

        {showResetModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowResetModal(false); setResetPassword(''); setResetError(''); } }}
          >
            <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-content text-lg font-bold mb-2">Reset Scan</h2>
              <p className="text-content-muted text-sm mb-4">
                This will make the ticket scannable again. Enter the reset password to confirm.
              </p>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }}
                placeholder="Reset password"
                error={resetError}
                touched={!!resetError}
              />
              <div className="flex gap-3 mt-5">
                <Button
                  onClick={() => { setShowResetModal(false); setResetPassword(''); setResetError(''); }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetSubmit}
                  disabled={resetLoading || !resetPassword.trim()}
                  variant="danger"
                  loading={resetLoading}
                  className="flex-1"
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (state === 'reset_success') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden">
          <div className="bg-success px-6 py-5 text-center">
            <CheckIcon className="text-white mx-auto mb-1" size={40} />
            <h1 className="text-white font-bold text-3xl tracking-wider">SCAN RESET</h1>
          </div>
          <div className="p-5 text-center">
            <p className="text-content-secondary text-sm">Ticket can now be scanned again.</p>
          </div>
        </div>
        <Button onClick={resetToScanning} className="mt-6" size="lg">
          Scan Next Ticket
        </Button>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden">
          <div className="bg-danger px-6 py-5 text-center">
            <CloseIcon className="text-white mx-auto mb-1" size={40} />
            <h1 className="text-white font-bold text-3xl tracking-wider">INVALID TICKET</h1>
          </div>
          <div className="p-5">
            <p className="text-content-secondary text-sm text-center">{result.errorMessage || 'Ticket could not be verified'}</p>
          </div>
        </div>
        <Button onClick={resetToScanning} className="mt-6" size="lg">
          Scan Next Ticket
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="relative flex items-center justify-center mb-6 min-h-[40px]">
          <img src={msLogo} alt="Logo" className="absolute left-0 h-10 w-auto" />
          <h1 className="text-xl font-bold text-content">Ticket Scanner</h1>
        </div>
        <p className="text-content-muted text-sm text-center mb-6">Point camera at ticket QR code</p>
        <div id="qr-reader" className="rounded-xl overflow-hidden [&_video]:rounded-xl [&_video]:border [&_video]:border-border" />
      </div>
    </div>
  );
}
