import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchEvents, createBooking, uploadReceiptWithProgress, getOrderStatus, fetchConfig, joinWaitlist } from '../api';
import { formatPrice, formatDate } from '../utils/format';
import type { EventType, FormData, BookingData, PaymentConfig } from '../types';

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const event = events[0];
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

  const handleContinue = useCallback(() => {
    if (validateStep1()) setStep(2);
  }, [validateStep1]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadFailed(false);
    setUploadProgress(0);

    // Client-side validation
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
    setStep(1);
  }, []);

  const handleCopyRef = useCallback(async () => {
    if (!booking) return;
    try { await navigator.clipboard.writeText(booking.ticket_id); } catch { /* ignore */ }
  }, [booking]);

  const errClass = (key: string) =>
    touched.has(key) && errors[key] ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-purple-500';

  const StepDots = () => (
    <div className="flex items-center justify-center gap-0 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{s}</div>
          {s < 3 && <div className={`w-12 sm:w-20 h-1 transition-colors ${step > s ? 'bg-purple-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );

  // ── Sold out state ────────────────────────────────
  if (allSoldOut) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-[480px] mx-auto">
          {event && (
            <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white rounded-xl p-5 mb-6">
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
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Sold out</h2>
            <p className="text-sm text-gray-500 mb-5">All tickets for this event are sold out. Join the waitlist to be notified if more become available.</p>
            <div className="flex gap-2">
              <input type="email" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)} placeholder="your@email.com" className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500" />
              <button onClick={handleJoinWaitlist} disabled={waitlistLoading || !waitlistEmail.trim()} className="px-4 py-2.5 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors shrink-0">
                {waitlistLoading ? '...' : 'Join'}
              </button>
            </div>
            {waitlistMsg && <p className="text-xs text-gray-500 mt-2">{waitlistMsg}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Booking Form ─────────────────────────
  const renderStep1 = () => (
    <div>
      {event && (
        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white rounded-xl p-5 mb-6">
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
      )}

      <label className="block text-sm font-semibold text-gray-700 mb-2">Select Ticket Type</label>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {ticketTypes.map((tt) => {
          const soldOut = tt.available_quantity === 0;
          const selected = form.ticketTypeId === tt.id;
          return (
            <button key={tt.id} type="button" disabled={soldOut} onClick={() => { set('ticketTypeId', tt.id); if (form.quantity > Math.min(tt.available_quantity, 5)) set('quantity', Math.min(tt.available_quantity, 5)); }}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${soldOut ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed' : selected ? 'border-purple-600 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-purple-300'}`}>
              <div className="font-semibold text-gray-900">{tt.name}</div>
              <div className="text-sm text-gray-600 mt-1">{formatPrice(tt.price)}</div>
              {tt.description && (
                <p className="text-xs text-gray-500 mt-1">{tt.description}</p>
              )}
              {!soldOut && tt.available_quantity < 20 && (
                <p className="text-xs text-amber-600 font-medium mt-1">Only {tt.available_quantity} left</p>
              )}
              {soldOut && <span className="absolute top-2 right-2 text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">Sold out</span>}
            </button>
          );
        })}
      </div>
      {touched.has('ticketTypeId') && errors.ticketTypeId && <p className="text-red-500 text-xs -mt-3 mb-3">{errors.ticketTypeId}</p>}

      <div className="space-y-4">
        {[
          { key: 'buyerName', label: 'Full Name', type: 'text', placeholder: 'e.g. Ahsan Ali' },
          { key: 'buyerEmail', label: 'Email Address', type: 'email', placeholder: 'ahsan@example.com' },
          { key: 'buyerPhone', label: 'WhatsApp Number', type: 'tel', placeholder: '03XX-XXXXXXX' },
          { key: 'buyerCity', label: 'City', type: 'text', placeholder: 'e.g. Karachi' },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
            <input type={type} value={form[key as keyof FormData] as string} onChange={(e) => set(key as keyof FormData, e.target.value as never)} onBlur={() => setTouched((p) => new Set(p).add(key))}
              className={`w-full px-3 py-2.5 rounded-lg border ${errClass(key)} outline-none text-sm`} placeholder={placeholder} />
            {touched.has(key) && errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
          </div>
        ))}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Number of Tickets</label>
          <select value={form.quantity} onChange={(e) => set('quantity', Number(e.target.value))} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white">
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Total</span>
        <span className="text-xl font-bold text-purple-700">{formatPrice(liveTotal)}</span>
      </div>

      <button type="button" onClick={handleContinue} className="mt-5 w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-base hover:bg-purple-700 transition-colors">
        Continue to Payment
      </button>
    </div>
  );

  // ── Step 2: Payment + Receipt Upload ──────────────
  const renderStep2 = () => (
    <div>
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white rounded-xl p-5 mb-6 text-center">
        <p className="text-sm opacity-80 mb-1">Amount to Pay</p>
        <p className="text-3xl font-bold">{formatPrice(liveTotal)}</p>
      </div>

      <label className="block text-sm font-semibold text-gray-700 mb-3">Select Payment Method</label>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button type="button" onClick={() => set('paymentMethod', 'bank_transfer')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${form.paymentMethod === 'bank_transfer' ? 'border-purple-600 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-purple-300'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏦</span>
            <span className="font-semibold text-gray-900 text-sm">Bank Transfer</span>
            <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.paymentMethod === 'bank_transfer' ? 'border-purple-600' : 'border-gray-300'}`}>
              {form.paymentMethod === 'bank_transfer' && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
            </div>
          </div>
          {form.paymentMethod === 'bank_transfer' && (
            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1 text-xs text-gray-600">
              <p><span className="font-medium">Bank:</span> {config?.bank_name || 'Meezan Bank'}</p>
              <p><span className="font-medium">Title:</span> {config?.bank_account_title || 'Global Tickets Pvt Ltd'}</p>
              <p><span className="font-medium">A/C:</span> {config?.bank_account_number || '0123-0123456789'}</p>
              <p><span className="font-medium">IBAN:</span> {config?.bank_iban || 'PK00MEZN0001234567890'}</p>
            </div>
          )}
        </button>

        <button type="button" onClick={() => set('paymentMethod', 'easypaisa')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${form.paymentMethod === 'easypaisa' ? 'border-purple-600 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-purple-300'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📱</span>
            <span className="font-semibold text-gray-900 text-sm">EasyPaisa</span>
            <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.paymentMethod === 'easypaisa' ? 'border-purple-600' : 'border-gray-300'}`}>
              {form.paymentMethod === 'easypaisa' && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
            </div>
          </div>
          {form.paymentMethod === 'easypaisa' && (
            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1 text-xs text-gray-600">
              <p><span className="font-medium">Title:</span> {config?.easypaisa_title || 'Global Tickets'}</p>
              <p><span className="font-medium">Number:</span> {config?.easypaisa_number || '0300-0000000'}</p>
            </div>
          )}
        </button>
      </div>

      {form.paymentMethod && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800 font-medium">Transfer exactly {formatPrice(liveTotal)} to your chosen account. Then upload your payment receipt below.</p>
        </div>
      )}

      {form.paymentMethod && (
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Payment Receipt</label>
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange}
            className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer" />
          {errors.file && <p className="text-red-500 text-xs mt-1">{errors.file}</p>}
          {selectedFile && !errors.file && <p className="text-xs text-gray-500 mt-1">{selectedFile.name}</p>}
          {filePreview && selectedFile?.type.startsWith('image/') && (
            <div className="mt-3"><img src={filePreview} alt="Receipt preview" className="max-h-48 rounded-lg border border-gray-200 object-contain" /></div>
          )}

          {/* Progress bar */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </div>
      )}

      {errors.api && <p className="text-red-500 text-sm text-center mt-2">{errors.api}</p>}

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Back</button>
        {uploadFailed ? (
          <button type="button" onClick={handleRetry} disabled={loading} className="flex-[2] py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50">
            {loading ? 'Retrying...' : 'Retry Upload'}
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading || !form.paymentMethod || !selectedFile || !!errors.file} className="flex-[2] py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (uploadProgress > 0 ? `Uploading ${uploadProgress}%...` : 'Submitting...') : 'Submit for Approval'}
          </button>
        )}
      </div>
    </div>
  );

  // ── Step 3: Pending Confirmation ──────────────────
  const renderStep3 = () => (
    <div className="text-center">
      {statusResult === 'approved' ? (
        <>
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your ticket has been approved!</h2>
            <p className="text-sm text-gray-600">Your ticket has been approved and sent to <strong>{form.buyerEmail}</strong>!</p>
          </div>
          <a href={`/ticket/${booking?.ticket_id}`} className="block w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm text-center hover:bg-purple-700 transition-colors mb-3">
            View Your Ticket
          </a>
        </>
      ) : (
        <>
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-400 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Receipt submitted &mdash; we&apos;re reviewing it</h2>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Your booking reference is <strong>{booking?.ticket_id}</strong>. Once your payment is verified, your ticket will be emailed to <strong>{form.buyerEmail}</strong>. This usually takes up to 2 hours during business hours.
          </p>

          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 mb-2 font-medium">SAVE YOUR BOOKING REFERENCE</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-center text-lg font-mono font-bold text-gray-900 bg-white rounded-lg border border-gray-200 py-2.5 px-3">{booking?.ticket_id}</code>
              <button type="button" onClick={handleCopyRef} className="p-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shrink-0" title="Copy booking reference">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Questions?{' '}
            <a href={`https://wa.me/${(config?.contact_whatsapp || '+923000000000').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold hover:underline">
              WhatsApp us at {config?.contact_whatsapp || '+92 300 0000000'}
            </a>
          </p>

          {statusChecked && statusResult === 'pending' && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              Still under review &mdash; we&apos;ll email you soon.
            </p>
          )}

          <button type="button" onClick={handleCheckStatus} disabled={statusChecked && statusResult === 'pending'} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 mb-3">
            {statusChecked && statusResult === 'pending' ? 'Still under review' : 'Check Status'}
          </button>
        </>
      )}

      <button type="button" onClick={handleReset} className="w-full py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
        Book Another Ticket
      </button>
    </div>
  );

  if (loading && !uploadProgress) {
    return (
      <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Processing your booking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-[480px] mx-auto">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Global Tickets</h1>
        </div>
        <StepDots />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </div>
    </div>
  );
}
