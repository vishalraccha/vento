import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  MoreVertical,
  Download,
  Share2,
  Edit,
  Trash2,
  CheckCircle,
  Send,
  Eye,
  Loader2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { useBusiness } from '@/hooks/useBusiness';
import { downloadInvoicePDF, getInvoicePDFBlob } from '@/lib/pdf';
import { ShareDialog } from '@/components/sharing';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { useInvoice, updateInvoiceStatus, deleteInvoice } = useInvoices();
  const { business } = useBusiness();
  
  const { data: invoice, isLoading } = useInvoice(id);
  
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDownloadPDF = async () => {
  if (!invoice) return;
  await downloadInvoicePDF({ 
    invoice: { ...invoice, items: invoice.items ?? [] } as any, 
    business 
  });
};

const handleViewPDF = async () => {
  if (!invoice) return;
  const blob = await getInvoicePDFBlob({ 
    invoice: { ...invoice, items: invoice.items ?? [] } as any, 
    business 
  });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

  const handleMarkAsPaid = () => {
    if (!id) return;
    updateInvoiceStatus.mutate({
      id,
      status: 'paid',
      paymentDetails: {
        amount_paid: Number(invoice?.total_amount || 0),
        payment_date: new Date().toISOString(),
      },
    });
  };

  const handleMarkAsSent = () => {
    if (!id) return;
    updateInvoiceStatus.mutate({ id, status: 'sent' });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteInvoice.mutate(id, {
      onSuccess: () => {
        navigate('/invoices');
      },
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default',
      sent: 'secondary',
      draft: 'outline',
      overdue: 'destructive',
      cancelled: 'secondary',
    };
    return variants[status] || 'outline';
  };

  if (isLoading) {
    return (
      <AppLayout title="Invoice" showBottomNav={false}>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout title="Invoice" showBottomNav={false}>
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Invoice not found</p>
          <Button onClick={() => navigate('/invoices')}>
            Back to Invoices
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Invoice" showBottomNav={false}>
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-background p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/invoices')}
            className="-ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareDialog(true)}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleViewPDF}>
                  <Eye className="mr-2 h-4 w-4" />
                  View PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/invoices/${id}/edit`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Invoice
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {invoice.status === 'draft' && (
                  <DropdownMenuItem onClick={handleMarkAsSent}>
                    <Send className="mr-2 h-4 w-4" />
                    Mark as Sent
                  </DropdownMenuItem>
                )}
                {invoice.status !== 'paid' && (
                  <DropdownMenuItem onClick={handleMarkAsPaid}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Paid
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Invoice
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="space-y-4 p-4">
          {/* Invoice Header Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice</p>
                  <p className="text-xl font-bold">{invoice.invoice_number}</p>
                </div>
                <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">
                  {invoice.status}
                </Badge>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">
                    {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {invoice.due_date
                      ? format(new Date(invoice.due_date), 'dd MMM yyyy')
                      : 'Not set'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bill To
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-semibold">{invoice.client_name || 'No client'}</p>
              
              {invoice.client_address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{invoice.client_address}</span>
                </div>
              )}
              
              {invoice.client_phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{invoice.client_phone}</span>
                </div>
              )}
              
              {invoice.client_email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{invoice.client_email}</span>
                </div>
              )}
              
              {invoice.client_gstin && (
                <p className="text-sm text-muted-foreground">
                  GSTIN: {invoice.client_gstin}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item, index) => {
                  const hasTax = Number(invoice.tax_amount) > 0;
                  const lineTotal = Number(item.quantity) * Number(item.unit_price);
                  const displayAmount = hasTax ? Number(item.subtotal) || lineTotal : lineTotal;
                  const displayRate = hasTax ? (displayAmount / Number(item.quantity)) : Number(item.unit_price);

                  return (
                    <div key={item.id || index} className="space-y-1">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <p className="font-medium">
                          ₹{displayAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.unit} × ₹{displayRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      {index < (invoice.items?.length || 0) - 1 && (
                        <Separator className="mt-3" />
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No items</p>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>₹{Number(invoice.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600">
                      -₹{Number(invoice.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">
                    ₹{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                
                {invoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="text-green-600">
                        ₹{Number(invoice.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {Number(invoice.total_amount) - Number(invoice.amount_paid) > 0 && (
                      <div className="flex justify-between font-medium text-destructive">
                        <span>Balance Due</span>
                        <span>
                          ₹{(Number(invoice.total_amount) - Number(invoice.amount_paid)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <Card>
              <CardContent className="space-y-4 p-4">
                {invoice.notes && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">Notes</p>
                    <p className="text-sm">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">Terms & Conditions</p>
                    <p className="text-sm">{invoice.terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="flex gap-3 pb-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleViewPDF}
            >
              <Eye className="mr-2 h-4 w-4" />
              View PDF
            </Button>
            
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownloadPDF}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            
            {invoice.status !== 'paid' && (
              <Button
                className="flex-1"
                onClick={handleMarkAsPaid}
                disabled={updateInvoiceStatus.isPending}
              >
                {updateInvoiceStatus.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Paid
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        documentType="invoice"
        documentNumber={invoice.invoice_number}
        clientName={invoice.client_name || undefined}
        clientPhone={invoice.client_phone || undefined}
        clientEmail={invoice.client_email || undefined}
        amount={Number(invoice.total_amount)}
        onDownloadPDF={handleDownloadPDF}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete invoice {invoice.invoice_number}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}