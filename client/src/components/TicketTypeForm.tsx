import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface TicketTypeFormTicketType {
  id: string;
  event_id: string;
  name: string;
  price: number;
  total_quantity: number;
  available_quantity: number;
  description: string | null;
  status: 'active' | 'paused' | 'sold_out';
  sort_order: number;
  created_at: string;
}

interface TicketTypeFormProps {
  eventId: string;
  ticketType: TicketTypeFormTicketType | null;
  onClose: () => void;
  onSaved: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<unknown>;
}

export default function TicketTypeForm({ eventId, ticketType, onClose, onSaved, apiFetch }: TicketTypeFormProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [status, setStatus] = useState<'active' | 'paused'>('active');
  const [quantityAdjustment, setQuantityAdjustment] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = ticketType !== null;

  useEffect(() => {
    if (ticketType) {
      setName(ticketType.name);
      setPrice(String(ticketType.price / 100));
      setDescription(ticketType.description || '');
      setSortOrder(String(ticketType.sort_order));
      setStatus(ticketType.status === 'active' ? 'active' : 'paused');
    }
  }, [ticketType]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!price || isNaN(Number(price)) || Number(price) <= 0) e.price = 'Price must be a positive number';
    if (!isEdit && (!totalQuantity || isNaN(Number(totalQuantity)) || Number(totalQuantity) < 1)) {
      e.totalQuantity = 'Total quantity must be a positive integer';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);

    try {
      const priceInPaisa = Math.round(Number(price) * 100);

      if (isEdit) {
        const body: Record<string, unknown> = {
          name: name.trim(),
          price: priceInPaisa,
          description: description.trim() || undefined,
          sort_order: parseInt(sortOrder) || 0,
          status,
        };

        const putRes = await apiFetch(`/api/admin/events/${eventId}/ticket-types/${ticketType.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });

        if (!putRes || !(putRes as Record<string, unknown>).success) {
          setLoading(false);
          return;
        }

        const adj = parseInt(quantityAdjustment);
        if (quantityAdjustment.trim() && !isNaN(adj) && adj !== 0) {
          const adjRes = await apiFetch(`/api/admin/events/${eventId}/ticket-types/${ticketType.id}/quantity`, {
            method: 'PATCH',
            body: JSON.stringify({ adjustment: adj }),
          });
          if (!adjRes || !(adjRes as Record<string, unknown>).success) {
            setLoading(false);
            return;
          }
        }
      } else {
        const body: Record<string, unknown> = {
          name: name.trim(),
          price: priceInPaisa,
          total_quantity: parseInt(totalQuantity),
          description: description.trim() || undefined,
          sort_order: parseInt(sortOrder) || 0,
        };

        const postRes = await apiFetch(`/api/admin/events/${eventId}/ticket-types`, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        if (!postRes || !(postRes as Record<string, unknown>).success) {
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

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl shadow-xl p-8 w-full max-w-lg overflow-y-auto max-h-[90vh] border border-border">
        <h2 className="text-xl font-bold text-content mb-6">
          {isEdit ? 'Edit ticket type' : 'New ticket type'}
        </h2>

        {errors.form && (
          <p className="text-danger-light text-sm mb-4">{errors.form}</p>
        )}

        <div className="space-y-4">
          <Input
            label="Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. General, VIP, Early Bird"
            error={errors.name}
            touched={!!errors.name}
          />

          <Input
            label="Description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Input
            label="Price (PKR)"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            step={100}
            min={0}
            placeholder="e.g. 1500"
            error={errors.price}
            touched={!!errors.price}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Sort order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />

            {isEdit && (
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'paused', label: 'Paused' },
                ]}
              />
            )}
          </div>

          {!isEdit && (
            <Input
              label="Total quantity"
              type="number"
              value={totalQuantity}
              onChange={(e) => setTotalQuantity(e.target.value)}
              min={1}
              error={errors.totalQuantity}
              touched={!!errors.totalQuantity}
            />
          )}

          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                Quantity adjustment
              </label>
              <p className="text-xs text-content-muted mb-1">
                Current: {ticketType.available_quantity} available of {ticketType.total_quantity} total
              </p>
              <input
                type="number"
                value={quantityAdjustment}
                onChange={(e) => setQuantityAdjustment(e.target.value)}
                placeholder="e.g. 50 or -10"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-content outline-none text-sm focus:border-accent placeholder-content-placeholder"
              />
            </div>
          )}
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
