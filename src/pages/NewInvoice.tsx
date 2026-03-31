import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Plus, Trash2, Save } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useInventory } from '@/hooks/useInventory';
import { useBusiness } from '@/hooks/useBusiness';
import { format } from 'date-fns';

interface LineItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  hsn_code: string;
  inventory_item_id: string | null;
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const { createInvoice } = useInvoices();
  const { clients } = useClients();
  const { items: inventoryItems } = useInventory();
  const { business } = useBusiness();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { name: '', description: '', quantity: 0, unit: '', unit_price: 0, hsn_code: '', inventory_item_id: null }
  ]);

  const invoiceNumber = `${business?.invoice_prefix || 'INV'}-${String((business?.current_invoice_number || 0) + 1).padStart(4, '0')}`;

  useEffect(() => {
    if (business?.default_terms) setTerms(business.default_terms);
    if (business?.default_notes) setNotes(business.default_notes);
  }, [business]);

  const calculateTotals = () => {
    let total = 0;
    lineItems.forEach(item => {
      total += item.quantity * item.unit_price;
    });

    const rate = parseFloat(taxRate) || 0;
    const combinedRate = showTaxBreakdown ? rate * 2 : 0;
    let taxAmount = 0;
    let sgstAmount = 0;
    let cgstAmount = 0;
    let subtotal = total;

    if (showTaxBreakdown && combinedRate > 0) {
      subtotal = total / (1 + combinedRate / 100);
      taxAmount = total - subtotal;
      sgstAmount = taxAmount / 2;
      cgstAmount = taxAmount / 2;
    }

    return { subtotal, sgstAmount, cgstAmount, taxAmount, total, rate };
  };

  const { subtotal, sgstAmount, cgstAmount, taxAmount, total, rate } = calculateTotals();

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { name: '', description: '', quantity: 0, unit: '', unit_price: 0, hsn_code: '', inventory_item_id: null }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSelectInventoryItem = (index: number, itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      const updated = [...lineItems];
      updated[index] = {
        ...updated[index],
        name: item.name,
        description: item.description || '',
        unit_price: item.unit_price,
        hsn_code: item.hsn_code || '',
        unit: item.unit,
        inventory_item_id: item.id,
      };
      setLineItems(updated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    
    e.preventDefault();
    const validLineItems = lineItems.filter(item => item.name.trim() && item.quantity > 0);
    if (validLineItems.length === 0) return;

    const selectedClient = clients.find(c => c.id === selectedClientId);

    setIsSubmitting(true);
    try {
      await createInvoice.mutateAsync({
        invoice: {
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          client_id: selectedClientId || null,
          client_name: selectedClient?.name || null,
          client_email: selectedClient?.email || null,
          client_phone: selectedClient?.phone || null,
          client_address: selectedClient ? [selectedClient.billing_address, selectedClient.city, selectedClient.state, selectedClient.pincode].filter(Boolean).join(', ') : null,
          client_gstin: selectedClient?.gstin || null,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: 0,
          total_amount: total,
          amount_paid: 0,
          payment_date: null,
          payment_method: null,
          notes: notes || null,
          terms: terms || null,
          status: 'draft',
        },
        items: validLineItems.map((item, index) => {
          const itemTotal = item.quantity * item.unit_price;
          const combinedRate = showTaxBreakdown ? rate * 2 : 0;
          const itemSubtotal = combinedRate > 0 ? itemTotal / (1 + combinedRate / 100) : itemTotal;
          const itemTax = itemTotal - itemSubtotal;

          return {
            name: item.name,
            description: item.description || null,
            hsn_code: item.hsn_code || null,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            tax_rate: combinedRate,
            tax_amount: itemTax,
            subtotal: itemSubtotal,
            total: itemTotal,
            sort_order: index,
            inventory_item_id: item.inventory_item_id,
          };
        }),
      });
      navigate('/invoices');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="New Invoice" showBottomNav={false}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center gap-3 border-b bg-card p-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-lg font-semibold">Create Invoice</h1>
        </div>

        <div className="space-y-4 p-4 pb-24">
          {/* Invoice Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input value={invoiceNumber} disabled className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_date">Invoice Date</Label>
                  <Input id="invoice_date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bill To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/clients/new')} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />Add Client First
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-3">
                      {inventoryItems.length > 0 && (
                        <Select value={item.inventory_item_id || ''} onValueChange={(value) => handleSelectInventoryItem(index, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select from inventory" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map(invItem => (
                              <SelectItem key={invItem.id} value={invItem.id}>{invItem.name} - ₹{invItem.unit_price}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        placeholder="Enter item name"
                        value={item.name}
                        onChange={(e) => handleLineItemChange(index, 'name', e.target.value)}
                      />
                      <Input
                        placeholder="Item description (optional)"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Quantity"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          type="number"
                          placeholder="Amount (tax inclusive)"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    {lineItems.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveLineItem(index)} className="shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    Amount: ₹{(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={handleAddLineItem} className="w-full">
                <Plus className="mr-2 h-4 w-4" />Add Item
              </Button>
            </CardContent>
          </Card>

          {/* Tax Display Option */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tax Display</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Amounts entered above are tax-inclusive. Enable this to show SGST & CGST breakdown on the invoice.
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="show_tax">Show SGST & CGST on invoice</Label>
                <Switch id="show_tax" checked={showTaxBreakdown} onCheckedChange={setShowTaxBreakdown} />
              </div>
              {showTaxBreakdown && (
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%) per tax</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    placeholder="e.g. 9 for 9% SGST + 9% CGST"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {showTaxBreakdown && rate > 0 ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal (excl. tax)</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">SGST ({rate}%)</span>
                      <span>₹{sgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">CGST ({rate}%)</span>
                      <span>₹{cgstAmount.toFixed(2)}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes & Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes for the client..." rows={2} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  {business?.default_terms && (
                    <span className="text-xs text-muted-foreground">From business profile</span>
                  )}
                </div>
                <Textarea id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms and conditions..." rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fixed Save Button at Bottom */}
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Invoice
              </>
            )}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}