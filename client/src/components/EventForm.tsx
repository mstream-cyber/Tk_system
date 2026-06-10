import { useState, useEffect } from 'react';

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

        const token = localStorage.getItem('admin_token');
        const bannerRes = await fetch(`/api/admin/events/${targetId}/banner`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
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
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {isEdit ? 'Edit event' : 'New event'}
        </h2>

        {errors.form && (
          <p className="text-red-500 text-sm mb-4">{errors.form}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500"
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500"
              />
              {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500"
            />
            {errors.venue && <p className="text-red-500 text-xs mt-1">{errors.venue}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500"
            />
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max tickets per order</label>
            <input
              type="number"
              value={maxTicketsPerOrder}
              onChange={(e) => setMaxTicketsPerOrder(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={20}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'cancelled')}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-purple-500"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner image</label>
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleBannerChange}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
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
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
