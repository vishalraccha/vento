// Business types based on Supabase schema
export interface Business {
  id: string;
  user_id: string;
  business_name: string | null;
  business_address: string | null;
  city: string | null;
  pincode: string | null;
  state: string | null;
  gstin: string | null;
  pan_number: string | null;
  is_gst_registered: boolean;
  phone_number: string | null;
  email: string | null;
  logo_url: string | null;
  invoice_prefix: string;
  invoice_starting_number: number;
  current_invoice_number: number;
  quotation_prefix: string;
  quotation_starting_number: number;
  current_quotation_number: number;
  default_terms: string | null;
  default_notes: string | null;
  currency: string;
  default_tax_rate: number;
  setup_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  sku: string | null;
  unit_price: number;
  cost_price: number | null;
  tax_rate: number;
  hsn_code: string | null;
  is_service: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  terms: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_gstin: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  inventory_item_id: string | null;
  name: string;
  description: string | null;
  hsn_code: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;
  total: number;
  sort_order: number;
  created_at: string;
}

// Quotation types
export interface Quotation {
  id: string;
  user_id: string;
  client_id: string | null;
  quotation_number: string;
  quotation_date: string;
  valid_until: string | null;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_gstin: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  inventory_item_id: string | null;
  name: string;
  description: string | null;
  hsn_code: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;
  total: number;
  sort_order: number;
  created_at: string;
}

// Task types for daily work
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  category: string | null;
  related_client_id: string | null;
  related_invoice_id: string | null;
  related_quotation_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
