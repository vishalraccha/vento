import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ItemSelector } from '@/components/inventory/ItemSelector';
import { InventoryItem } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Package, Zap, AlertTriangle } from 'lucide-react';
import { getNextDocumentNumber } from '@/lib/documentNumber';

interface LineItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  hsn_code: string;
  inventory_item_id: string | null;
}

const emptyLineItem = (): LineItem => ({
  name: '',
  description: '',
  quantity: 1,
  unit: 'pcs',
  unit_price: 0,
  hsn_code: '',
  inventory_item_id: null,
});

export default function NewInvoice() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const { createInvoice, updateInvoice, useInvoice, invoices } = useInvoices();
  const { data: existingInvoice, isLoading: isInvoiceLoading } = useInvoice(id);

  const { clients } = useClients();
  const { items: inventoryItems } = useInventory();
  const { business } = useBusiness();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [warranty, setWarranty] = useState('');
  const [terms, setTerms] = useState('');
  const [taxRate, setTaxRate] = useState('10');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  const invoiceNumber = isEditing && existingInvoice
    ? existingInvoice.invoice_number
    : getNextDocumentNumber(
        business?.invoice_prefix || 'INV',
        (invoices || []).map(i => i.invoice_number),
        business?.current_invoice_number || 0
      );

  useEffect(() => {
    if (!isEditing) {
      if (business?.default_terms) {
        setTerms(business.default_terms);
      } else {
        setTerms("Please send payment within 30 days of receiving this invoice. There will be 10% interest charge per month on late invoice.");
      }
      if (business?.default_notes) {
        setWarranty(business.default_notes);
      } else {
        setWarranty("New products carry the manufacturer's warranty. This warranty is strictly void if the item is physically damaged, burned, or tampered with after delivery.");
      }
    }
  }, [business, isEditing]);

  useEffect(() => {
    if (existingInvoice) {
      setSelectedClientId(existingInvoice.client_id || '');
      setInvoiceDate(existingInvoice.invoice_date || format(new Date(), 'yyyy-MM-dd'));
      setDueDate(existingInvoice.due_date || '');
      setNotes(existingInvoice.notes || '');
      setWarranty(existingInvoice.notes || '');
      setTerms(existingInvoice.terms || '');
      setDiscountAmount(String(existingInvoice.discount_amount || 0));

      if (existingInvoice.items && existingInvoice.items.length > 0) {
        setLineItems(existingInvoice.items.map(item => ({
          name: item.name,
          description: item.description || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'pcs',
          unit_price: Number(item.unit_price) || 0,
          hsn_code: item.hsn_code || '',
          inventory_item_id: item.inventory_item_id,
        })));

        const firstItemTax = existingInvoice.items[0]?.tax_rate;
        if (firstItemTax !== undefined && firstItemTax !== null) {
          setTaxRate(String(firstItemTax));
        }
      }
    }
  }, [existingInvoice]);

  const calculateTotals = () => {
    let subtotal = 0;
    lineItems.forEach(item => {
      subtotal += item.quantity * item.unit_price;
    });

    const rate = parseFloat(taxRate) || 0;
    const taxAmount = (subtotal * rate) / 100;
    const discount = parseFloat(discountAmount) || 0;
    const total = Math.max(0, subtotal + taxAmount - discount);

    return { subtotal, taxAmount, total, rate, discount };
  };

  const { subtotal, taxAmount, total, rate, discount } = calculateTotals();

  const handleAddLineItem = () => {
    setLineItems([...lineItems, emptyLineItem()]);
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

  const handleSelectInventoryItem = (index: number, itemOrId: InventoryItem | string) => {
    const item = typeof itemOrId === 'string'
      ? inventoryItems.find(i => i.id === itemOrId)
      : itemOrId;

    if (item) {
      const updated = [...lineItems];
      updated[index] = {
        ...updated[index],
        name: item.name,
        description: item.description || '',
        unit_price: Number(item.unit_price) || 0,
        hsn_code: item.hsn_code || '',
        unit: item.unit || 'pcs',
        inventory_item_id: item.id,
      };
      setLineItems(updated);

      // Auto-set tax rate if specified on inventory item and not already configured
      if (item.tax_rate && (!taxRate || taxRate === '0')) {
        setShowTaxBreakdown(true);
        setTaxRate(String(Number(item.tax_rate) / 2));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLineItems = lineItems.filter(item => item.name.trim() && item.quantity > 0);
    if (validLineItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Line items required',
        description: 'Please add at least one line item with a name and quantity greater than zero.',
      });
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);

    setIsSubmitting(true);
    try {
      const formattedItems = validLineItems.map((item, index) => {
        const itemTotal = item.quantity * item.unit_price;
        const itemTax = (itemTotal * rate) / 100;

        return {
          name: item.name,
          description: item.description || null,
          hsn_code: item.hsn_code || null,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          unit_price: item.unit_price,
          tax_rate: rate,
          tax_amount: itemTax,
          subtotal: itemTotal,
          total: itemTotal,
          sort_order: index,
          inventory_item_id: item.inventory_item_id,
        };
      });

      if (isEditing && id) {
        await updateInvoice.mutateAsync({
          id,
          invoice: {
            invoice_date: invoiceDate,
            due_date: dueDate || null,
            client_id: selectedClientId || null,
            client_name: selectedClient?.name || (existingInvoice?.client_name ?? null),
            client_email: selectedClient?.email || (existingInvoice?.client_email ?? null),
            client_phone: selectedClient?.phone || (existingInvoice?.client_phone ?? null),
            client_address: selectedClient
              ? [selectedClient.billing_address, selectedClient.city, selectedClient.state, selectedClient.pincode].filter(Boolean).join(', ')
              : (existingInvoice?.client_address ?? null),
            client_gstin: selectedClient?.gstin || (existingInvoice?.client_gstin ?? null),
            subtotal,
            tax_amount: taxAmount,
            discount_amount: discount,
            total_amount: total,
            notes: warranty || notes || null,
            terms: terms || null,
          },
          items: formattedItems,
        });

        toast({
          title: "Invoice Updated!",
          description: `Invoice ${invoiceNumber} has been updated successfully.`,
        });
        navigate(`/invoices/${id}`);
      } else {
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
            discount_amount: discount,
            total_amount: total,
            amount_paid: 0,
            payment_date: null,
            payment_method: null,
            notes: warranty || notes || null,
            terms: terms || null,
            status: 'draft',
          },
          items: formattedItems,
        });

        toast({
          title: "Invoice Saved Successfully!",
          description: `Invoice ${invoiceNumber} has been created and saved.`,
        });
        navigate('/invoices');
      }
    } catch (error: any) {
      console.error("Failed to save invoice:", error);
      toast({
        variant: "destructive",
        title: "Failed to Save Invoice",
        description: error?.message || "An error occurred while saving the invoice. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && isInvoiceLoading) {
    return (
      <AppLayout title="Edit Invoice" showBottomNav={false}>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={isEditing ? "Edit Invoice" : "New Invoice"} showBottomNav={false}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center gap-3 border-b bg-card p-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-lg font-semibold">
            {isEditing ? `Edit Invoice (${invoiceNumber})` : "Create Invoice"}
          </h1>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? "Save Changes" : "Save Invoice"}
          </Button>
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
              <CardTitle className="text-base">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Select Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.phone ? `(${client.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && (
                <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>{selectedClient.name}</span>
                    {selectedClient.gstin && (
                      <Badge variant="outline" className="text-[10px]">
                        GSTIN: {selectedClient.gstin}
                      </Badge>
                    )}
                  </div>
                  {selectedClient.phone && <p className="text-muted-foreground">Phone: {selectedClient.phone}</p>}
                  {selectedClient.email && <p className="text-muted-foreground">Email: {selectedClient.email}</p>}
                  {selectedClient.billing_address && (
                    <p className="text-muted-foreground">
                      Address: {selectedClient.billing_address}
                      {selectedClient.city ? `, ${selectedClient.city}` : ''}
                      {selectedClient.state ? `, ${selectedClient.state}` : ''}
                      {selectedClient.pincode ? ` - ${selectedClient.pincode}` : ''}
                    </p>
                  )}
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={() => navigate('/clients/new')} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add New Client
              </Button>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Line Items</CardTitle>
                <p className="text-xs text-muted-foreground">Select from inventory or enter custom items</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item, index) => {
                const linkedInvItem = inventoryItems.find(i => i.id === item.inventory_item_id);
                const exceedsStock = linkedInvItem && !linkedInvItem.is_service && typeof linkedInvItem.stock_quantity === 'number' && item.quantity > linkedInvItem.stock_quantity;

                return (
                  <div key={index} className="space-y-3 rounded-lg border p-3 bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Item {index + 1}</span>
                        {linkedInvItem && (
                          <Badge variant="outline" className="text-[10px] gap-1 font-normal">
                            {linkedInvItem.is_service ? (
                              <><Zap className="h-2.5 w-2.5 text-blue-500" /> Service</>
                            ) : (
                              <><Package className="h-2.5 w-2.5 text-emerald-500" /> Stock: {linkedInvItem.stock_quantity} {linkedInvItem.unit || 'pcs'}</>
                            )}
                          </Badge>
                        )}
                      </div>
                      {lineItems.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveLineItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Item Name / Select Item *</Label>
                      <ItemSelector
                        value={item.name}
                        onChange={(val) => handleLineItemChange(index, 'name', val)}
                        onSelectItem={(invItem) => handleSelectInventoryItem(index, invItem)}
                        inventoryItems={inventoryItems}
                        selectedItemId={item.inventory_item_id}
                        placeholder="Click to select inventory item or type..."
                      />
                    </div>

                    {exceedsStock && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Warning: Quantity ({item.quantity}) exceeds available stock ({linkedInvItem?.stock_quantity} {linkedInvItem?.unit || 'pcs'}).</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs">Description (optional)</Label>
                      <Input
                        placeholder="Description (optional)"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity *</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity || ''}
                          onChange={(e) => handleLineItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Input
                          placeholder="pcs"
                          value={item.unit}
                          onChange={(e) => handleLineItemChange(index, 'unit', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Price (₹) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-sm font-medium border-t">
                      <span className="text-xs text-muted-foreground">Line Total:</span>
                      <span className="font-semibold">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Tax & Discount */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tax & Discount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <span className="text-xs text-muted-foreground">{rate > 0 ? `+ ₹${taxAmount.toFixed(2)}` : 'No Tax'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="tax_rate"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="10"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                  <div className="flex gap-1">
                    {[0, 5, 10, 18].map((pct) => (
                      <Button
                        key={pct}
                        type="button"
                        variant={Number(taxRate) === pct ? 'default' : 'outline'}
                        size="sm"
                        className="h-9 px-2.5 text-xs"
                        onClick={() => setTaxRate(String(pct))}
                      >
                        {pct}%
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">Discount (₹)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Totals Summary Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="space-y-2.5 p-4 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Sub Total:</span>
                <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
              {rate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({rate}%):</span>
                  <span>+₹{taxAmount.toFixed(2)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount:</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-primary/20 pt-2.5 text-base font-extrabold text-foreground">
                <span>Grand Total:</span>
                <span className="text-lg">₹{total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Terms & Warranty */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Terms & Warranty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terms">Term and Conditions</Label>
                <Textarea 
                  id="terms" 
                  rows={2} 
                  value={terms} 
                  onChange={(e) => setTerms(e.target.value)} 
                  placeholder="Please send payment within 30 days..." 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warranty">Warranty and Disclaimers</Label>
                <Textarea 
                  id="warranty" 
                  rows={2} 
                  value={warranty} 
                  onChange={(e) => setWarranty(e.target.value)} 
                  placeholder="New products carry the manufacturer's warranty..." 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </AppLayout>
  );
}