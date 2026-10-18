import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, IndianRupee, CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Invoice } from '@/types/database';

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onPaymentSuccess?: () => void;
  updateInvoiceStatus: any;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onPaymentSuccess,
  updateInvoiceStatus,
}: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const totalAmount = Number(invoice.total_amount) || 0;
  const currentPaid = Number(invoice.amount_paid) || 0;
  const balanceDue = Math.max(0, totalAmount - currentPaid);

  const [paymentAmount, setPaymentAmount] = useState<string>(balanceDue.toString());
  const [paymentMethod, setPaymentMethod] = useState<string>(invoice.payment_method || 'UPI');
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountToRecord = parseFloat(paymentAmount);

    if (isNaN(amountToRecord) || amountToRecord <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid amount',
        description: 'Please enter a valid payment amount greater than zero.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const newTotalPaid = Math.min(totalAmount, currentPaid + amountToRecord);
      const isFullyPaid = newTotalPaid >= totalAmount;

      await updateInvoiceStatus.mutateAsync({
        id: invoice.id,
        status: isFullyPaid ? 'paid' : (invoice.status === 'draft' ? 'sent' : invoice.status),
        paymentDetails: {
          amount_paid: newTotalPaid,
          payment_date: new Date(paymentDate).toISOString(),
          payment_method: paymentMethod,
        },
      });

      toast({
        title: isFullyPaid ? 'Invoice Paid in Full!' : 'Partial Payment Recorded',
        description: `Recorded ₹${amountToRecord.toLocaleString('en-IN')} via ${paymentMethod}.`,
      });

      onOpenChange(false);
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      toast({
        variant: 'destructive',
        title: 'Payment recording failed',
        description: err?.message || 'Could not save payment. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Record full or partial payment for invoice <span className="font-semibold text-foreground">{invoice.invoice_number}</span>.
            </DialogDescription>
          </DialogHeader>

          {/* Payment Balance Summary Card */}
          <div className="my-4 rounded-xl border bg-muted/40 p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Invoice Total</span>
              <span className="font-medium text-foreground">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            {currentPaid > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Already Paid</span>
                <span className="font-medium text-emerald-600">₹{currentPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remaining Balance</span>
              <span className="text-base font-bold text-foreground">
                ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Amount input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="pay-amount">Amount Received (₹)</Label>
                <button
                  type="button"
                  className="text-xs text-primary font-medium hover:underline"
                  onClick={() => setPaymentAmount(balanceDue.toString())}
                >
                  Pay in Full
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={totalAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-8 text-base font-semibold"
                  required
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="pay-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI (Google Pay, PhonePe, Paytm)</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Card">Debit / Credit Card</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Payment Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            {/* Reference/Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Transaction / Reference Note (Optional)</Label>
              <Input
                id="pay-ref"
                placeholder="e.g. UPI Ref # 12345678, Cheque # 00123"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
