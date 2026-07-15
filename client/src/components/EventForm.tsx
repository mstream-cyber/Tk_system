import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface EventFormEvent {
  id: string;
  name: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  description: string | null;
  banner_url: string | null;
  poster_url: string | null;
  status: 'draft' | 'published' | 'cancelled';
  max_tickets_per_order: number;
  organizer_phone: string | null;
  location_link: string | null;
  terms_conditions: string | null;
  bulk_discount_enabled: boolean;
  bulk_discount_min_qty: number;
  bulk_discount_type: string;
  bulk_discount_value: number;
  created_at: string;
  ticket_types: unknown[];
}

interface EventFormProps {
  event: EventFormEvent | null;
  onClose: () => void;
  onSaved: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<unknown>;
}

export default function EventForm({ event, onClose, onSaved, apiFetch }: EventFormProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'cancelled'>('draft');
  const [maxTicketsPerOrder, setMaxTicketsPerOrder] = useState(10);
  const [organizerPhone, setOrganizerPhone] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [bulkDiscountEnabled, setBulkDiscountEnabled] = useState(false);
  const [bulkDiscountMinQty, setBulkDiscountMinQty] = useState(5);
  const [bulkDiscountValue, setBulkDiscountValue] = useState(0);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = event !== null;

  useEffect(() => {
    if (event) {
      setName(event.name);
      setDate(event.date ? event.date.split('T')[0] : '');
      setTime(event.time || '');
      setVenue(event.venue);
      setCity(event.city);
      setDescription(event.description || '');
      setStatus(event.status);
      setMaxTicketsPerOrder(event.max_tickets_per_order);
      setOrganizerPhone(event.organizer_phone || '');
      setLocationLink(event.location_link || '');
      setTermsConditions(event.terms_conditions || '');
      setBulkDiscountEnabled(event.bulk_discount_enabled ?? false);
      setBulkDiscountMinQty(event.bulk_discount_min_qty ?? 5);
      setBulkDiscountValue(event.bulk_discount_value ?? 0);
      if (event.banner_url) setBannerPreview(event.banner_url);
    }
  }, [event]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Event name is required';
    if (!date.trim()) e.date = 'Date is required';
    if (!time.trim()) e.time = 'Time is required';
    if (!venue.trim()) e.venue = 'Venue is required';
    if (!city.trim()) e.city = 'City is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        date,
        time: time.trim(),
        venue: venue.trim(),
        city: city.trim(),
        description: description.trim() || undefined,
        status,
        max_tickets_per_order: maxTicketsPerOrder,
        organizer_phone: organizerPhone.trim() || undefined,
        location_link: locationLink.trim() || undefined,
        terms_conditions: termsConditions.trim() || undefined,
        bulk_discount_enabled: bulkDiscountEnabled,
        bulk_discount_min_qty: bulkDiscountEnabled ? bulkDiscountMinQty : undefined,
        bulk_discount_type: 'percentage',
        bulk_discount_value: bulkDiscountEnabled ? bulkDiscountValue : undefined,
      };

      let newEventId: string | null = null;

      if (isEdit) {
        const putRes = await apiFetch(`/api/admin/events/${event.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        }) as Record<string, unknown>;
        if (!putRes?.success) {
          setLoading(false);
          return;
        }
      } else {
        const postRes = await apiFetch('/api/admin/events', {
          method: 'POST',
          body: JSON.stringify(body),
        }) as Record<string, unknown>;
        if (!postRes?.success) {
          setLoading(false);
          return;
        }
        newEventId = (postRes.data as Record<string, string>)?.id || null;
      }

      if (bannerFile) {
        const targetId = isEdit ? event.id : newEventId;
        if (!targetId) {
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('banner_image', bannerFile);

        const bannerRes = await fetch(`/api/admin/events/${targetId}/banner`, {
          method: 'POST',
          body: formData,
        });
        const bannerData = await bannerRes.json();
        if (!bannerData.success) {
          setLoading(false);
          return;
        }
      }

      onSaved();
      onClose();
    } catch {
      setErrors({ form: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl shadow-xl p-8 w-full max-w-lg overflow-y-auto max-h-[90vh] border border-border">
        <h2 className="text-xl font-bold text-content mb-6">
          {isEdit ? 'Edit event' : 'New event'}
        </h2>

        {errors.form && (
          <p className="text-danger-light text-sm mb-4">{errors.form}</p>
        )}

        <div className="space-y-4">
          <Input
            label="Event name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            touched={!!errors.name}
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                error={errors.date}
                touched={!!errors.date}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                error={errors.time}
                touched={!!errors.time}
              />
            </div>
          </div>

          <Input
            label="Venue"
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            error={errors.venue}
            touched={!!errors.venue}
          />

          <Input
            label="City"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            error={errors.city}
            touched={!!errors.city}
          />

          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-content outline-none text-sm focus:border-accent resize-none placeholder-content-placeholder"
            />
          </div>

          <Input
            label="Max tickets per order"
            type="number"
            value={String(maxTicketsPerOrder)}
            onChange={(e) => setMaxTicketsPerOrder(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={20}
          />

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkDiscountEnabled}
                onChange={(e) => setBulkDiscountEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-input accent-accent"
              />
              <span className="text-sm font-medium text-content-secondary">Enable bulk discount</span>
            </label>
          </div>

          {bulkDiscountEnabled && (
            <div className="flex gap-3 pl-6">
              <div className="flex-1">
                <Input
                  label="Min quantity"
                  type="number"
                  value={String(bulkDiscountMinQty)}
                  onChange={(e) => setBulkDiscountMinQty(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Discount %"
                  type="number"
                  value={String(bulkDiscountValue)}
                  onChange={(e) => setBulkDiscountValue(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          )}

          <Input
            label="Organizer phone (for queries)"
            type="tel"
            value={organizerPhone}
            onChange={(e) => setOrganizerPhone(e.target.value)}
            placeholder="e.g. 03XX-XXXXXXX"
          />

          <Input
            label="Google Maps link"
            type="url"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="https://maps.google.com/..."
          />

          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Terms &amp; Conditions
            </label>
            <textarea
              value={termsConditions}
              onChange={(e) => setTermsConditions(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-content outline-none text-sm focus:border-accent resize-none placeholder-content-placeholder"
              placeholder="e.g. No refunds after 24 hours of purchase."
            />
          </div>

          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'cancelled')}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Banner image</label>
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleBannerChange}
              className="w-full text-sm text-content-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent-subtle file:text-accent-light hover:file:bg-accent-subtle/60"
            />
            {bannerPreview && (
              <img
                src={bannerPreview}
                alt="Banner preview"
                className="mt-2 w-full h-24 object-cover rounded-lg"
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button onClick={onClose} disabled={loading} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} loading={loading} className="flex-1">
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
