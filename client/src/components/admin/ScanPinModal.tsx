import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { QrScanIcon } from '../ui/Icons';

interface ScanPinModalProps {
  onClose: () => void;
  onSuccess: (token: string) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<unknown>;
}

export function ScanPinModal({ onClose, onSuccess, apiFetch }: ScanPinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const entered = pin.trim();
    if (!entered) return;

    const data = await apiFetch('/api/admin/verify-scan-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: entered }),
    });

    if (data && (data as Record<string, unknown>).success) {
      const token = (data as { data: { token: string } }).data.token;
      setPin('');
      setError('');
      onSuccess(token);
    } else {
      setError('Invalid PIN');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setPin(''); setError(''); } }}>
      <div className="bg-card rounded-2xl shadow-xl p-8 w-full max-w-sm border border-border">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-success-subtle flex items-center justify-center mx-auto mb-3">
            <QrScanIcon className="text-success-light" size={24} />
          </div>
          <h2 className="text-lg font-bold text-content">Scanner access</h2>
          <p className="text-sm text-content-muted mt-1">Enter the staff PIN to open the scanner</p>
        </div>
        <Input type="password" value={pin}
          onChange={(e) => { setPin(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="Enter PIN" error={error} touched={!!error}
          className="text-center text-lg tracking-widest font-bold" maxLength={10} />
        <div className="flex gap-3 mt-5">
          <Button onClick={() => { onClose(); setPin(''); setError(''); }} variant="secondary" className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!pin.trim()} variant="success" className="flex-1">Open scanner</Button>
        </div>
      </div>
    </div>
  );
}
