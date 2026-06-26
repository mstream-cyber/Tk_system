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
