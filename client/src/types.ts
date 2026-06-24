export interface EventType {
  id: string;
  name: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  description: string | null;
  banner_url: string | null;
  poster_url: string | null;
  status: string;
  max_tickets_per_order: number;
  created_at: string;
  ticket_types: TicketType[];
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  price: number;
  total_quantity: number;
  available_quantity: number;
  description: string | null;
  status: string;
  sort_order: number;
  created_at: string;
}

export interface BookingPayload {
  ticket_type_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_city: string;
  quantity: number;
  payment_method: string;
}

export interface BookingData {
  order_id: string;
  ticket_id: string;
}

export interface OrderStatus {
  payment_status: string;
  ticket_id: string | null;
}

export interface PaymentConfig {
  bank_name: string;
  bank_account_title: string;
  bank_account_number: string;
  bank_iban: string;
  easypaisa_number: string;
  easypaisa_title: string;
  contact_whatsapp: string;
}

export interface TicketOrder {
  id: string;
  ticket_id: string;
  scan_token: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_city: string | null;
  quantity: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  ticket_types: {
    name: string;
    price: number;
      events: {
        name: string;
        date: string;
        venue: string;
        city: string;
        banner_url: string | null;
      };
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FormData {
  ticketTypeId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerCity: string;
  quantity: number;
  paymentMethod: 'bank_transfer' | 'easypaisa' | '';
}
