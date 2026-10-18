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
import { 
  ArrowLeft, Loader2, Plus, Trash2, Save, CheckCircle2, 
  Download, Share2, PlusCircle, ArrowRight, Calendar, User, 
  FileText, Phone, Mail, MapPin, Package, Zap, AlertTriangle 
} from 'lucide-react';
import { useQuotations } from '@/hooks/useQuotations';
import { useClients } from '@/hooks/useClients';
import { useInventory } from '@/hooks/useInventory';
import { useBusiness } from '@/hooks/useBusiness';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { ItemSelector } from '@/components/inventory/ItemSelector';
import { InventoryItem } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { downloadQuotationPDF } from '@/lib/pdf/generateQuotationPDF';
import { ShareDialog } from '@/components/sharing';
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

// Default empty line item — quantity starts at 1, not 0
const emptyLineItem = (): LineItem => ({
  name: '',
  description: '',
  quantity: 1,
  unit: '',
  unit_price: 0,
  hsn_code: '',
  inventory_item_id: null,
});

export default function NewQuotation() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const { createQuotation, updateQuotation, useQuotation, quotations } = useQuotations();
  const { data: existingQuotation, isLoading: isQuotationLoading } = useQuotation(id);

  const { clients } = useClients();
  const { items: inventoryItems } = useInventory();
  const { business } = useBusiness();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const [quotationDate, setQuotationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  // Full-screen success confirmation state
  const [savedQuotationData, setSavedQuotationData] = useState<any | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const quotationNumber = isEditing && existingQuotation
    ? existingQuotation.quotation_number
    : getNextDocumentNumber(
        business?.quotation_prefix || 'QT',
        (quotations || []).map(q => q.quotation_number),
        business?.current_quotation_number || 0
      );

  const handleDownloadPDF = async () => {
    if (!savedQuotationData) return;
    try {
      setIsDownloadingPDF(true);
      await downloadQuotationPDF({
        quotation: savedQuotationData,
        business,
      });
      toast({
        title: "PDF Downloaded",
        description: `Quotation ${savedQuotationData.quotation_number}.pdf downloaded successfully.`,
      });
    } catch (error: any) {
      console.error("Failed to generate PDF:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: error?.message || "Failed to generate quotation PDF.",
      });
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleCreateAnother = () => {
    setSavedQuotationData(null);
    if (isEditing) {
      navigate('/quotations/new');
    } else {
      setLineItems([emptyLineItem()]);
      setSelectedClientId('');
      setQuotationDate(format(new Date(), 'yyyy-MM-dd'));
      setValidUntil(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
      setNotes(business?.default_notes || '');
      setTerms(business?.default_terms || '');
      setShowTaxBreakdown(false);
      setTaxRate('');
    }
  };

  useEffect(() => {
    if (!isEditing && business?.default_terms) setTerms(business.default_terms);
    if (!isEditing && business?.default_notes) setNotes(business.default_notes);
  }, [business, isEditing]);

  useEffect(() => {
    if (existingQuotation) {
      setSelectedClientId(existingQuotation.client_id || '');
      setQuotationDate(existingQuotation.quotation_date || format(new Date(), 'yyyy-MM-dd'));
      setValidUntil(existingQuotation.valid_until || format(addDays(new Date(), 30), 'yyyy-MM-dd'));
      setNotes(existingQuotation.notes || '');
      setTerms(existingQuotation.terms || '');

      if (existingQuotation.items && existingQuotation.items.length > 0) {
        setLineItems(existingQuotation.items.map(item => ({
          name: item.name,
          description: item.description || '',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || '',
          unit_price: Number(item.unit_price) || 0,
          hsn_code: item.hsn_code || '',
          inventory_item_id: item.inventory_item_id,
        })));

        const firstTax = existingQuotation.items[0]?.tax_rate;
        if (firstTax && firstTax > 0) {
          setShowTaxBreakdown(true);
          setTaxRate(String(firstTax / 2));
        }
      }
    }
  }, [existingQuotation]);

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
    const validLineItems = lineItems.filter(
      item => item.name.trim() && item.quantity > 0 && item.unit_price > 0
    );
    if (validLineItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Valid items required',
        description: 'Please add at least one line item with a name, quantity > 0, and price > 0.',
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
          unit: item.unit || null,
          unit_price: item.unit_price,
          tax_rate: combinedRate,
          tax_amount: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
          sort_order: index,
          inventory_item_id: item.inventory_item_id,
        };
      });

      let savedId = id;
      if (isEditing && id) {
        const updated = await updateQuotation.mutateAsync({
          id,
          quotation: {
            quotation_date: quotationDate,
            valid_until: validUntil || null,
            client_id: selectedClientId || null,
            client_name: selectedClient?.name || (existingQuotation?.client_name ?? null),
            client_email: selectedClient?.email || (existingQuotation?.client_email ?? null),
            client_phone: selectedClient?.phone || (existingQuotation?.client_phone ?? null),
            client_address: selectedClient
              ? [selectedClient.billing_address, selectedClient.city, selectedClient.state, selectedClient.pincode]
                  .filter(Boolean)
                  .join(', ')
              : (existingQuotation?.client_address ?? null),
            client_gstin: selectedClient?.gstin || (existingQuotation?.client_gstin ?? null),
            subtotal,
            tax_amount: taxAmount,
            discount_amount: 0,
            total_amount: total,
            notes: notes || null,
            terms: terms || null,
          },
          items: formattedItems,
        });
        if (updated?.id) savedId = updated.id;

        toast({
          title: "Quotation Updated!",
          description: `Quotation ${quotationNumber} has been updated successfully.`,
        });
      } else {
        const created = await createQuotation.mutateAsync({
          quotation: {
            quotation_number: quotationNumber,
            quotation_date: quotationDate,
            valid_until: validUntil || null,
            client_id: selectedClientId || null,
            client_name: selectedClient?.name || null,
            client_email: selectedClient?.email || null,
            client_phone: selectedClient?.phone || null,
            client_address: selectedClient
              ? [selectedClient.billing_address, selectedClient.city, selectedClient.state, selectedClient.pincode]
                  .filter(Boolean)
                  .join(', ')
              : null,
            client_gstin: selectedClient?.gstin || null,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: 0,
            total_amount: total,
            notes: notes || null,
            terms: terms || null,
            status: 'draft',
            converted_invoice_id: null,
          },
          items: formattedItems,
        });
        if (created?.id) savedId = created.id;

        toast({
          title: "Quotation Saved Successfully!",
          description: `Quotation ${quotationNumber} has been created and saved.`,
        });
      }

      setSavedQuotationData({
        id: savedId || 'qt-id',
        quotation_number: quotationNumber,
        quotation_date: quotationDate,
        valid_until: validUntil || null,
        client_name: selectedClient?.name || (existingQuotation?.client_name ?? 'Direct Customer'),
        client_email: selectedClient?.email || (existingQuotation?.client_email ?? null),
        client_phone: selectedClient?.phone || (existingQuotation?.client_phone ?? null),
        client_address: selectedClient
          ? [selectedClient.billing_address, selectedClient.city, selectedClient.state, selectedClient.pincode]
              .filter(Boolean)
              .join(', ')
          : (existingQuotation?.client_address ?? null),
        client_gstin: selectedClient?.gstin || (existingQuotation?.client_gstin ?? null),
        subtotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        total_amount: total,
        notes: notes || null,
        terms: terms || null,
        status: existingQuotation?.status || 'draft',
        items: formattedItems,
        isEditing,
      });
    } catch (error: any) {
      console.error("Failed to save quotation:", error);
      toast({
        variant: "destructive",
        title: "Failed to Save Quotation",
        description: error?.message || "An error occurred while saving the quotation. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (savedQuotationData) {
    return (
      <AppLayout title="Quotation Saved" showBottomNav={false}>
        <div className="max-w-2xl mx-auto space-y-6 pb-20 pt-4 px-2 sm:px-4">
          {/* Hero Success Badge */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-500/5 animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {savedQuotationData.isEditing ? "Quotation Updated Successfully!" : "Quotation Created Successfully!"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Quotation <span className="font-semibold text-foreground">{savedQuotationData.quotation_number}</span> has been saved to your records.
              </p>
            </div>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
            >
              {isDownloadingPDF ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full gap-2 border-primary/20 hover:bg-primary/5"
              onClick={() => setShowShareDialog(true)}
            >
              <Share2 className="h-4 w-4 text-primary" />
              Share Quotation
            </Button>
          </div>

          {/* Quotation Summary Card */}
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/40 border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document</span>
                  <div className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {savedQuotationData.quotation_number}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200">
                  {savedQuotationData.status || 'Draft'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Total Banner */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-semibold text-emerald-800 dark:text-emerald-300">Total Amount</div>
                  <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                    ₹{savedQuotationData.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                  <div>Subtotal: ₹{savedQuotationData.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <div>Tax: ₹{savedQuotationData.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              {/* Client & Date Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <User className="h-3.5 w-3.5" /> Client Name
                  </div>
                  <div className="font-semibold text-foreground">
                    {savedQuotationData.client_name || 'Direct Customer'}
                  </div>
                  {savedQuotationData.client_phone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {savedQuotationData.client_phone}
                    </div>
                  )}
                  {savedQuotationData.client_email && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {savedQuotationData.client_email}
                    </div>
                  )}
                  {savedQuotationData.client_address && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {savedQuotationData.client_address}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Calendar className="h-3.5 w-3.5" /> Quotation Dates
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Issued: </span>
                    <span className="font-medium text-foreground">{savedQuotationData.quotation_date}</span>
                  </div>
                  {savedQuotationData.valid_until && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Valid Until: </span>
                      <span className="font-medium text-foreground">{savedQuotationData.valid_until}</span>
                    </div>
                  )}
                  {savedQuotationData.client_gstin && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">GSTIN: </span>
                      <span className="font-mono text-foreground">{savedQuotationData.client_gstin}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items List */}
              <div className="border-t pt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Line Items ({savedQuotationData.items.length})
                </div>
                <div className="divide-y rounded-lg border overflow-hidden">
                  {savedQuotationData.items.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-sm bg-card hover:bg-muted/20">
                      <div>
                        <div className="font-medium text-foreground">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} {item.unit || 'pcs'} × ₹{Number(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="font-semibold text-foreground text-right">
                        ₹{Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes & Terms if present */}
              {(savedQuotationData.notes || savedQuotationData.terms) && (
                <div className="border-t pt-3 text-xs space-y-2 text-muted-foreground">
                  {savedQuotationData.notes && (
                    <div><span className="font-semibold text-foreground">Notes:</span> {savedQuotationData.notes}</div>
                  )}
                  {savedQuotationData.terms && (
                    <div><span className="font-semibold text-foreground">Terms:</span> {savedQuotationData.terms}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation / Next Actions Footer */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 gap-2"
              onClick={handleCreateAnother}
            >
              <PlusCircle className="h-4 w-4" />
              Create Another Quotation
            </Button>
            
            <Button
              variant="default"
              size="lg"
              className="flex-1 gap-2"
              onClick={() => navigate('/quotations')}
            >
              <span>Go to Quotations List</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Share Dialog */}
          <ShareDialog
            open={showShareDialog}
            onOpenChange={setShowShareDialog}
            documentType="quotation"
            documentNumber={savedQuotationData.quotation_number}
            clientName={savedQuotationData.client_name || undefined}
            clientPhone={savedQuotationData.client_phone || undefined}
            clientEmail={savedQuotationData.client_email || undefined}
            amount={savedQuotationData.total_amount}
            onDownloadPDF={handleDownloadPDF}
          />
        </div>
      </AppLayout>
    );
  }

  if (isEditing && isQuotationLoading) {
    return (
      <AppLayout title="Edit Quotation" showBottomNav={false}>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={isEditing ? "Edit Quotation" : "New Quotation"} showBottomNav={false}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center gap-3 border-b bg-card p-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-lg font-semibold">
            {isEditing ? `Edit Quotation (${quotationNumber})` : "Create Quotation"}
          </h1>
        </div>

        <div className="space-y-4 p-4 pb-24">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Quotation Number</Label>
                <Input value={quotationNumber} disabled className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quotation_date">Date</Label>
                  <Input
                    id="quotation_date"
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
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

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/clients/new')}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" /> Add New Client
              </Button>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Quotation Items</CardTitle>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveLineItem(index)}
                        >
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
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-md border border-amber-200 dark:border-amber-900">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Note: Quoted quantity ({item.quantity}) exceeds currently available stock ({linkedInvItem?.stock_quantity} {linkedInvItem?.unit || 'pcs'}).</span>
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
                        <Label className="text-xs">Qty *</Label>
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
                  <Label htmlFor="tax_toggle">Include GST</Label>
                  <p className="text-xs text-muted-foreground">Applies CGST + SGST</p>
                </div>
                <Switch
                  id="tax_toggle"
                  checked={showTaxBreakdown}
                  onCheckedChange={setShowTaxBreakdown}
                />
              </div>

              {showTaxBreakdown && (
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate per component (%) - e.g. 9 for 18% total</Label>
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

          {/* Totals Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
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
              <CardTitle className="text-base">Notes &amp; Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for the client..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="terms">Terms &amp; Conditions</Label>
                  {business?.default_terms && (
                    <span className="text-xs text-muted-foreground">From business profile</span>
                  )}
                </div>
                <Textarea
                  id="terms"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Quotation terms and conditions..."
                  rows={2}
                />
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
                {isEditing ? "Save Changes" : "Save Quotation"}
              </>
            )}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}