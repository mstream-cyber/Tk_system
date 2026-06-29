import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchEvents, createBooking, uploadReceiptWithProgress, getOrderStatus, fetchConfig, joinWaitlist, verifyEmail, resendVerificationCode } from '../api';
import { formatPrice, formatDate } from '../utils/format';
import type { EventType, FormData, BookingData, PaymentConfig } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StepIndicator } from '../components/ui/StepIndicator';
import { CheckIcon, CopyIcon } from '../components/ui/Icons';
import msLogo from '../assets/mslogo.png';

const emptyForm: FormData = {
  ticketTypeId: '',
  buyerName: '',
  buyerEmail: '',
  buyerPhone: '',
  buyerCity: '',
  quantity: 1,
  paymentMethod: '',
};

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const urlEventId = searchParams.get('eventId');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [events, setEvents] = useState<EventType[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);
  const [statusResult, setStatusResult] = useState<'approved' | 'pending' | null>(null);
  const [verifyCode, setVerifyCode] = useState<string[]>(Array(6).fill(''));
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistMsg, setWaitlistMsg] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  useEffect(() => {
    fetchEvents()
      .then((res) => {
        if (res.success && res.data) {
          const published = (res.data as EventType[]).filter((e) => e.status === 'published');
          setEvents(published);
        }
      })
      .catch(console.error);
    fetchConfig()
      .then((res) => { if (res.success && res.data) setConfig(res.data); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (urlEventId && events.length > 0 && !selectedEventId) {
      const match = events.find((e) => e.id === urlEventId);
      if (match) {
        setSelectedEventId(urlEventId);
      }
    } else if (events.length === 1 && !selectedEventId && !urlEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, urlEventId, selectedEventId]);

  const event = events.find((e) => e.id === selectedEventId) || null;
  const ticketTypes = (event?.ticket_types ?? [])
    .filter((tt) => tt.status === 'active')
    .sort((a, b) => a.sort_order - b.sort_order);
  const selectedTicket = ticketTypes.find((t) => t.id === form.ticketTypeId) ?? null;
  const maxQty = selectedTicket
    ? Math.min(selectedTicket.available_quantity, event?.max_tickets_per_order ?? 10)
    : 1;
  const allSoldOut = event && ticketTypes.length > 0 && ticketTypes.every((tt) => tt.available_quantity === 0);

  const liveTotal = useMemo(() => {
    if (!selectedTicket) return 0;
    return selectedTicket.price * form.quantity;
  }, [selectedTicket, form.quantity]);

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }, []);

  const validateStep1 = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!form.ticketTypeId) errs.ticketTypeId = 'Select a ticket type';
    if (!form.buyerName.trim()) errs.buyerName = 'Full name is required';
    if (!form.buyerEmail.trim()) errs.buyerEmail = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.buyerEmail)) errs.buyerEmail = 'Invalid email address';
    if (!form.buyerPhone.trim()) errs.buyerPhone = 'Phone number is required';
    if (!form.buyerCity.trim()) errs.buyerCity = 'City is required';
    const newTouched = new Set(touched);
    Object.keys(errs).forEach((k) => newTouched.add(k));
    setTouched(newTouched);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, touched]);

  const handleChange = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    set(key, value);
  }, [set]);

  const handleBlur = useCallback((key: string) => {
    setTouched((p) => new Set(p).add(key));
  }, []);

  const handleContinue = useCallback(() => {
    if (validateStep1()) setStep(2);
  }, [validateStep1]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFailed(false);
    setUploadProgress(0);

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, file: 'File exceeds 5 MB limit' }));
        e.target.value = '';
        return;
      }
      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowed.includes(file.type)) {
        setErrors((prev) => ({ ...prev, file: 'Only JPG, PNG, or PDF files are allowed' }));
        e.target.value = '';
        return;
      }
      setErrors((prev) => { const next = { ...prev }; delete next.file; return next; });
    }

    setSelectedFile(file);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(file ? URL.createObjectURL(file) : null);
  }, [filePreview]);

  const handleSubmit = useCallback(async () => {
    if (!selectedTicket || !form.paymentMethod || !selectedFile) return;
    setLoading(true);
    setUploadProgress(0);
    setUploadFailed(false);
    setErrors({});

    const bookRes = await createBooking({
      ticket_type_id: form.ticketTypeId,
      buyer_name: form.buyerName.trim(),
      buyer_email: form.buyerEmail.trim(),
      buyer_phone: form.buyerPhone.trim(),
      buyer_city: form.buyerCity.trim(),
      quantity: form.quantity,
      payment_method: form.paymentMethod,
    });

    if (!bookRes.success || !bookRes.data) {
      setLoading(false);
      setErrors({ api: bookRes.error || 'Booking failed. Please try again.' });
      return;
    }

    setBooking(bookRes.data);

    const uploadRes = await uploadReceiptWithProgress(
      bookRes.data.order_id,
      selectedFile,
      (pct) => setUploadProgress(pct)
    );

    setLoading(false);

    if (uploadRes.success) {
      setStep(3);
      setCountdown(60);
    } else {
      setUploadFailed(true);
      setErrors({ api: uploadRes.error || 'Receipt upload failed. Please try again.' });
    }
  }, [form, selectedTicket, selectedFile]);

  const handleRetry = useCallback(async () => {
    if (!booking || !selectedFile) return;
    setLoading(true);
    setUploadProgress(0);
    setUploadFailed(false);
    setErrors({});
    const res = await uploadReceiptWithProgress(
      booking.order_id,
      selectedFile,
      (pct) => setUploadProgress(pct)
    );
    setLoading(false);
    if (res.success) {
      setStep(3);
      setCountdown(60);
    } else {
      setUploadFailed(true);
      setErrors({ api: res.error || 'Upload failed. Please try again.' });
    }
  }, [booking, selectedFile]);

  const handleCheckStatus = useCallback(async () => {
    if (!booking) return;
    const res = await getOrderStatus(booking.order_id);
    if (res.success && res.data) {
      setStatusChecked(true);
      if (res.data.payment_status === 'approved') {
        setStatusResult('approved');
      } else {
        setStatusResult('pending');
      }
    }
  }, [booking]);

  const handleJoinWaitlist = useCallback(async () => {
    if (!event || !waitlistEmail.trim()) return;
    setWaitlistLoading(true);
    const res = await joinWaitlist(event.id, waitlistEmail.trim());
    setWaitlistMsg(res.success && res.data?.message ? res.data.message : (res.error || 'Something went wrong'));
    setWaitlistLoading(false);
  }, [event, waitlistEmail]);

  const handleReset = useCallback(() => {
    setForm(emptyForm);
    setErrors({});
    setTouched(new Set());
    setBooking(null);
    setSelectedFile(null);
    setFilePreview(null);
    setUploadProgress(0);
    setUploadFailed(false);
    setStatusChecked(false);
    setStatusResult(null);
    setVerifyCode(Array(6).fill(''));
    setVerifyError('');
    setCountdown(0);
    setStep(1);
  }, []);

  const handleCopyRef = useCallback(async () => {
    if (!booking) return;
    try { await navigator.clipboard.writeText(booking.ticket_id); } catch { /* ignore */ }
  }, [booking]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (step !== 3 || !booking) return;
    let cancelled = false;
    setVerifyLoading(true);
    resendVerificationCode(booking.order_id).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setCountdown(60);
      } else {
        setVerifyError(res.error || 'Failed to send verification code');
      }
    }).catch(() => {
      if (!cancelled) setVerifyError('Network error. Please request a new code.');
    }).finally(() => {
      if (!cancelled) setVerifyLoading(false);
    });
    return () => { cancelled = true; };
  }, [step]);

  const handleVerifySubmit = useCallback(async () => {
    const code = verifyCode.join('');
    if (code.length !== 6) { setVerifyError('Enter the full 6-digit code'); return; }
    if (!booking) return;
    setVerifyLoading(true);
    setVerifyError('');
    const res = await verifyEmail(booking.order_id, code);
    setVerifyLoading(false);
    if (res.success) {
      setStep(4);
    } else {
      setVerifyError(res.error || 'Verification failed');
      setVerifyCode(Array(6).fill(''));
    }
  }, [verifyCode, booking]);

  const handleResendCode = useCallback(async () => {
    if (!booking || countdown > 0) return;
    setVerifyError('');
    const res = await resendVerificationCode(booking.order_id);
    if (res.success) {
      setCountdown(60);
      setVerifyCode(Array(6).fill(''));
      setVerifyError('');
    } else {
      setVerifyError(res.error || 'Failed to resend code');
    }
  }, [booking, countdown]);

  const handleVerifyCodeChange = useCallback((index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    setVerifyCode((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setVerifyError('');
    if (value && index < 5) {
      const nextInput = document.getElementById(`vcode-${index + 1}`);
      nextInput?.focus();
    }
  }, []);

  const handleVerifyKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      const prevInput = document.getElementById(`vcode-${index - 1}`);
      prevInput?.focus();
    }
  }, [verifyCode]);

  const inputFields = [
    { key: 'buyerName', label: 'Full Name', type: 'text', placeholder: 'e.g. John Doe' },
    { key: 'buyerEmail', label: 'Email Address', type: 'email', placeholder: 'john@example.com' },
    { key: 'buyerPhone', label: 'WhatsApp Number', type: 'tel', placeholder: '03XX-XXXXXXX' },
    { key: 'buyerCity', label: 'City', type: 'text', placeholder: 'e.g. Karachi' },
  ] as const;

  const LogoHeader = () => (
    <div className="relative flex items-center justify-center mb-6 min-h-[40px]">
      <img src={msLogo} alt="Logo" className="absolute left-0 h-10 w-auto" />
      <h1 className="text-2xl font-bold text-content">Ticket Portal</h1>
    </div>
  );

  const EventHeader = () => {
    if (!event) return null;
    return (
      <div className="bg-gradient-to-r from-accent to-indigo-800 text-white rounded-xl p-5 mb-6">
        {event.banner_url && (
          <img src={event.banner_url} alt={event.name} className="w-full h-40 object-cover rounded-xl mb-4" />
        )}
        <h1 className="text-xl font-bold mb-1">{event.name}</h1>
        <p className="text-sm opacity-80">{formatDate(event.date)}{event.time && ` · ${event.time}`}</p>
        <p className="text-sm opacity-80">{event.venue}, {event.city}</p>
        {event.description && (
          <p className="text-sm opacity-80 mt-2 leading-relaxed">{event.description}</p>
        )}
      </div>
    );
  };

  if (allSoldOut) {
    return (
      <div className="min-h-screen bg-surface py-6 px-4">
        <div className="max-w-[480px] mx-auto">
          <LogoHeader />
          <EventHeader />
          <Card className="text-center">
            <div className="w-16 h-16 rounded-full bg-danger-subtle flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-content mb-1">Sold out</h2>
            <p className="text-sm text-content-muted mb-5">All tickets for this event are sold out. Join the waitlist to be notified if more become available.</p>
            <div className="flex gap-2">
              <input type="email" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)} placeholder="your@email.com" className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-input text-content placeholder-content-placeholder outline-none text-sm focus:border-accent" />
              <Button onClick={handleJoinWaitlist} disabled={waitlistLoading || !waitlistEmail.trim()} loading={waitlistLoading} size="md">
                {waitlistLoading ? '...' : 'Join'}
              </Button>
            </div>
            {waitlistMsg && <p className="text-xs text-content-muted mt-2">{waitlistMsg}</p>}
          </Card>
        </div>
      </div>
    );
  }

  if (!event && events.length > 1) {
    return (
      <div className="min-h-screen bg-surface py-6 px-4">
        <div className="max-w-[480px] mx-auto">
          <LogoHeader />
          <div className="flex flex-col gap-4">
            {events.map((e) => (
              <Link
                key={e.id}
                to={`/event/${e.id}`}
                className="bg-card rounded-2xl border border-border p-5 text-left hover:border-accent hover:shadow-lg transition-all block"
              >
                {e.banner_url && (
                  <img src={e.banner_url} alt={e.name} className="w-full h-36 object-cover rounded-xl mb-3" loading="lazy" />
                )}
                <h2 className="text-lg font-bold text-content">{e.name}</h2>
                <p className="text-sm text-content-muted mt-1">{formatDate(e.date)}{e.time && ` · ${e.time}`}</p>
                <p className="text-sm text-content-muted">{e.venue}, {e.city}</p>
                {e.description && <p className="text-xs text-content-placeholder mt-2 line-clamp-2">{e.description}</p>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderStep1 = () => (
    <div>
      <EventHeader />

      <label className="block text-sm font-semibold text-content-secondary mb-2">Select Ticket Type</label>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {ticketTypes.map((tt) => {
          const soldOut = tt.available_quantity === 0;
          const selected = form.ticketTypeId === tt.id;
          return (
            <button key={tt.id} type="button" disabled={soldOut} onClick={() => { handleChange('ticketTypeId', tt.id); if (form.quantity > Math.min(tt.available_quantity, 5)) handleChange('quantity', Math.min(tt.available_quantity, 5)); }}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${soldOut ? 'border-border bg-surface-elevated opacity-60 cursor-not-allowed' : selected ? 'border-accent bg-card shadow-sm' : 'border-border bg-card hover:border-accent'}`}>
              <div className="font-semibold text-content">{tt.name}</div>
              <div className="text-sm text-content-muted mt-1">{formatPrice(tt.price)}</div>
              {tt.description && (
                <p className="text-xs text-content-placeholder mt-1">{tt.description}</p>
              )}
              {!soldOut && tt.available_quantity < 20 && (
                <p className="text-xs text-warning font-medium mt-1">Only {tt.available_quantity} left</p>
              )}
              {soldOut && <Badge variant="danger" size="sm" className="absolute top-2 right-2">Sold out</Badge>}
            </button>
          );
        })}
      </div>
      {touched.has('ticketTypeId') && errors.ticketTypeId && <p className="text-danger-light text-xs -mt-3 mb-3">{errors.ticketTypeId}</p>}

      <div className="space-y-4">
        {inputFields.map(({ key, label, type, placeholder }) => (
          <Input
            key={key}
            label={label}
            type={type}
            value={form[key] as string}
            onChange={(e) => handleChange(key, e.target.value as never)}
            onBlur={() => handleBlur(key)}
            placeholder={placeholder}
            error={errors[key]}
            touched={touched.has(key)}
          />
        ))}

        <div>
          <label className="block text-sm font-semibold text-content-secondary mb-1">Number of Tickets</label>
          <select value={form.quantity} onChange={(e) => handleChange('quantity', Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-border bg-input text-content outline-none text-sm focus:border-accent">
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => <option key={n} value={n} className="bg-input">{n}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 p-4 bg-input rounded-xl flex items-center justify-between">
        <span className="text-sm font-semibold text-content-secondary">Total</span>
        <span className="text-xl font-bold text-accent-light">{formatPrice(liveTotal)}</span>
      </div>

      <Button onClick={handleContinue} className="mt-5 w-full" size="lg">
        Continue to Payment
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <div className="bg-gradient-to-r from-accent to-indigo-800 text-white rounded-xl p-5 mb-6 text-center">
        <p className="text-sm opacity-80 mb-1">Amount to Pay</p>
        <p className="text-3xl font-bold">{formatPrice(liveTotal)}</p>
      </div>

      <label className="block text-sm font-semibold text-content-secondary mb-3">Select Payment Method</label>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button type="button" onClick={() => handleChange('paymentMethod', 'bank_transfer')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${form.paymentMethod === 'bank_transfer' ? 'border-accent bg-card shadow-sm' : 'border-border bg-card hover:border-accent'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏦</span>
            <span className="font-semibold text-content text-sm">Bank Transfer</span>
            <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.paymentMethod === 'bank_transfer' ? 'border-accent' : 'border-border'}`}>
              {form.paymentMethod === 'bank_transfer' && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
          </div>
          {form.paymentMethod === 'bank_transfer' && (
            <div className="mt-2 pt-2 border-t border-border space-y-1 text-xs text-content-muted">
              <p><span className="font-medium text-content-secondary">Bank:</span> {config?.bank_name || 'Meezan Bank'}</p>
              <p><span className="font-medium text-content-secondary">Title:</span> {config?.bank_account_title || 'Global Tickets Pvt Ltd'}</p>
              <p><span className="font-medium text-content-secondary">A/C:</span> {config?.bank_account_number || '0123-0123456789'}</p>
              <p><span className="font-medium text-content-secondary">IBAN:</span> {config?.bank_iban || 'PK00MEZN0001234567890'}</p>
            </div>
          )}
        </button>

        <button type="button" onClick={() => handleChange('paymentMethod', 'easypaisa')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${form.paymentMethod === 'easypaisa' ? 'border-accent bg-card shadow-sm' : 'border-border bg-card hover:border-accent'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📱</span>
            <span className="font-semibold text-content text-sm">EasyPaisa</span>
            <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.paymentMethod === 'easypaisa' ? 'border-accent' : 'border-border'}`}>
              {form.paymentMethod === 'easypaisa' && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
          </div>
          {form.paymentMethod === 'easypaisa' && (
            <div className="mt-2 pt-2 border-t border-border space-y-1 text-xs text-content-muted">
              <p><span className="font-medium text-content-secondary">Title:</span> {config?.easypaisa_title || 'Global Tickets'}</p>
              <p><span className="font-medium text-content-secondary">Number:</span> {config?.easypaisa_number || '0300-0000000'}</p>
            </div>
          )}
        </button>
      </div>

      {form.paymentMethod && (
        <div className="mb-5 p-4 bg-warning-subtle border border-warning rounded-xl">
          <p className="text-sm text-warning-light font-medium">Transfer exactly {formatPrice(liveTotal)} to your chosen account. Then upload your payment receipt below.</p>
        </div>
      )}

      {form.paymentMethod && (
        <div className="mb-5">
          <label className="block text-sm font-semibold text-content-secondary mb-2">Upload Payment Receipt</label>
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange}
            className="w-full text-sm text-content-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent-subtle file:text-accent-light hover:file:bg-accent-subtle/60 cursor-pointer" />
          {errors.file && <p className="text-danger-light text-xs mt-1">{errors.file}</p>}
          {selectedFile && !errors.file && <p className="text-xs text-content-muted mt-1">{selectedFile.name}</p>}
          {filePreview && selectedFile?.type.startsWith('image/') && (
            <div className="mt-3"><img src={filePreview} alt="Receipt preview" className="max-h-48 rounded-lg border border-border object-contain" /></div>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-3 w-full bg-border rounded-full h-2">
              <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </div>
      )}

      {errors.api && <p className="text-danger-light text-sm text-center mt-2">{errors.api}</p>}

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Back</Button>
        {uploadFailed ? (
          <Button variant="danger" onClick={handleRetry} disabled={loading} loading={loading} className="flex-[2]">
            {loading ? 'Retrying...' : 'Retry Upload'}
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading || !form.paymentMethod || !selectedFile || !!errors.file} loading={loading} className="flex-[2]">
            {loading ? (uploadProgress > 0 ? `Uploading ${uploadProgress}%...` : 'Submitting...') : 'Submit for Approval'}
          </Button>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => {
    return (
      <div className="text-center">
        <div className="mb-6">
          <div className="w-20 h-20 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-accent-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-content mb-2">Verify your email</h2>
          <p className="text-sm text-content-muted">
            We sent a 6-digit code to <strong className="text-content-secondary">{form.buyerEmail}</strong>
          </p>
        </div>

        <div className="flex gap-2 justify-center mb-6">
          {verifyCode.map((digit, i) => (
            <input
              key={i}
              id={`vcode-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleVerifyCodeChange(i, e.target.value)}
              onKeyDown={(e) => handleVerifyKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-bold bg-input border border-border rounded-lg text-content outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {verifyError && <p className="text-danger-light text-sm mb-4">{verifyError}</p>}

        <Button onClick={handleVerifySubmit} disabled={verifyLoading || verifyCode.join('').length !== 6} loading={verifyLoading} className="w-full mb-3">
          {verifyLoading ? 'Verifying...' : 'Verify Email'}
        </Button>

        <button
          onClick={handleResendCode}
          disabled={countdown > 0}
          className="text-sm text-content-muted hover:text-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
        </button>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="text-center">
      {statusResult === 'approved' ? (
        <>
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="text-white" size={36} />
            </div>
            <h2 className="text-2xl font-bold text-content mb-2">Your ticket has been approved!</h2>
            <p className="text-sm text-content-muted">Your ticket has been approved and sent to <strong className="text-content-secondary">{form.buyerEmail}</strong>!</p>
          </div>
          <a href={`/ticket/${booking?.ticket_id}`} className="block w-full py-3 rounded-xl bg-accent text-white font-bold text-sm text-center hover:bg-accent-hover transition-colors mb-3">
            View Your Ticket
          </a>
        </>
      ) : (
        <>
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-warning flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="text-white" size={36} />
            </div>
            <h2 className="text-2xl font-bold text-content">Receipt submitted &mdash; we&apos;re reviewing it</h2>
          </div>

          <p className="text-sm text-content-muted leading-relaxed mb-6">
            Your booking reference is <strong className="text-content-secondary">{booking?.ticket_id}</strong>. Once your payment is verified, your ticket will be emailed to <strong className="text-content-secondary">{form.buyerEmail}</strong>. This usually takes up to 2 hours during business hours.
          </p>

          <div className="mb-4 p-4 bg-input rounded-xl border border-border">
            <p className="text-xs text-content-muted mb-2 font-medium">SAVE YOUR BOOKING REFERENCE</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-center text-lg font-mono font-bold text-content bg-card rounded-lg border border-border py-2.5 px-3">{booking?.ticket_id}</code>
              <Button onClick={handleCopyRef} variant="primary" size="sm" aria-label="Copy booking reference">
                <CopyIcon size={18} />
              </Button>
            </div>
          </div>

          <p className="text-sm text-content-placeholder mb-4">
            Questions?{' '}
            <a href={`https://wa.me/${(config?.contact_whatsapp || '+923000000000').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-success-light font-semibold hover:underline">
              WhatsApp us at {config?.contact_whatsapp || '+92 300 0000000'}
            </a>
          </p>

          {statusChecked && statusResult === 'pending' && (
            <p className="text-sm text-warning-light bg-warning-subtle border border-warning rounded-xl p-3 mb-4">
              Still under review &mdash; we&apos;ll email you soon.
            </p>
          )}

          <Button onClick={handleCheckStatus} disabled={statusChecked && statusResult === 'pending'} className="w-full mb-3">
            {statusChecked && statusResult === 'pending' ? 'Still under review' : 'Check Status'}
          </Button>
        </>
      )}

      <Button variant="secondary" onClick={handleReset} className="w-full">
        Book Another Ticket
      </Button>
    </div>
  );

  if (loading && !uploadProgress) {
    return (
      <div className="fixed inset-0 bg-surface/80 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-content-muted">Processing your booking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-6 px-4">
      <div className="max-w-[480px] mx-auto">
        <LogoHeader />
        <StepIndicator steps={4} currentStep={step} />
        <Card>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </Card>
      </div>
    </div>
  );
}
