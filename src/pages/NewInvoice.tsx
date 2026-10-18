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
  const [terms, setTerms] = useState('');
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  const invoiceNumber = isEditing && existingInvoice
    ? existingInvoice.invoice_number
    : getNextDocumentNumber(
        business?.invoice_prefix || 'INV',
        (invoices || []).map(i => i.invoice_number),
        business?.current_invoice_number || 0
      );

  useEffect(() => {
    if (!isEditing && business?.default_terms) setTerms(business.default_terms);
    if (!isEditing && business?.default_notes) setNotes(business.default_notes);
  }, [business, isEditing]);

  useEffect(() => {
    if (existingInvoice) {
      setSelectedClientId(existingInvoice.client_id || '');
      setInvoiceDate(existingInvoice.invoice_date || format(new Date(), 'yyyy-MM-dd'));
      setDueDate(existingInvoice.due_date || '');
      setNotes(existingInvoice.notes || '');
      setTerms(existingInvoice.terms || '');

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
        if (firstItemTax && firstItemTax > 0) {
          setShowTaxBreakdown(true);
          setTaxRate(String(firstItemTax / 2));
        }
      }
    }
  }, [existingInvoice]);

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
        const combinedRate = showTaxBreakdown ? rate * 2 : 0;
        const itemSubtotal = combinedRate > 0 ? itemTotal / (1 + combinedRate / 100) : itemTotal;
        const itemTax = itemTotal - itemSubtotal;

        return {
          name: item.name,
          description: item.description || null,
          hsn_code: item.hsn_code || null,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          unit_price: item.unit_price,
          tax_rate: combinedRate,
          tax_amount: itemTax,
          subtotal: itemSubtotal,
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
            discount_amount: 0,
            total_amount: total,
            notes: notes || null,
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
            discount_amount: 0,
            total_amount: total,
            amount_paid: 0,
            payment_date: null,
            payment_method: null,
            notes: notes || null,
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

          {/* Tax Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tax (GST)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="tax_toggle">Include GST Breakdown</Label>
                  <p className="text-xs text-muted-foreground">Applies CGST + SGST</p>
                </div>
                <Switch id="tax_toggle" checked={showTaxBreakdown} onCheckedChange={setShowTaxBreakdown} />
              </div>

              {showTaxBreakdown && (
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate per component (%) - e.g. 9 for 18% total GST</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    step="0.5"
                    placeholder="9"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals Summary Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="space-y-2 p-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {showTaxBreakdown && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>CGST ({rate}%):</span>
                    <span>₹{cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>SGST ({rate}%):</span>
                    <span>₹{sgstAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total Amount:</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Terms & Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Terms & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes visible to client..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea id="terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms..." />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </AppLayout>
  );
}