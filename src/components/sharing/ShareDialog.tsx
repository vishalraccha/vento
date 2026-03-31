import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageCircle, 
  Mail, 
  Download, 
  Copy, 
  Check,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'invoice' | 'quotation';
  documentNumber: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  amount: number;
  onDownloadPDF: () => void;
  getPDFBlob?: () => Blob;
}

export function ShareDialog({
  open,
  onOpenChange,
  documentType,
  documentNumber,
  clientName,
  clientPhone,
  clientEmail,
  amount,
  onDownloadPDF,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState(clientEmail || '');
  const [emailSubject, setEmailSubject] = useState(
    `${documentType === 'invoice' ? 'Invoice' : 'Quotation'} ${documentNumber} from Your Business`
  );
  const [emailBody, setEmailBody] = useState(
    `Dear ${clientName || 'Customer'},\n\nPlease find attached ${documentType} ${documentNumber} for ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.\n\nThank you for your business!\n\nBest regards`
  );
  const [isSharing, setIsSharing] = useState(false);

  const formatPhoneForWhatsApp = (phone: string) => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Add country code if not present (assuming India)
    if (cleaned.length === 10) {
      return `91${cleaned}`;
    }
    return cleaned;
  };

  const handleWhatsAppShare = () => {
    const phone = clientPhone ? formatPhoneForWhatsApp(clientPhone) : '';
    const message = encodeURIComponent(
      `Hi ${clientName || ''},\n\n` +
      `Your ${documentType} ${documentNumber} is ready!\n` +
      `Amount: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n` +
      `Thank you for your business!`
    );
    
    const whatsappUrl = phone 
      ? `https://wa.me/${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
    
    toast({
      title: 'Opening WhatsApp',
      description: 'Please attach the PDF after downloading it.',
    });
  };

  const handleEmailShare = () => {
    const mailtoUrl = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');
    
    toast({
      title: 'Opening Email Client',
      description: 'Please attach the PDF after downloading it.',
    });
  };

  const handleCopyLink = async () => {
    // For now, just copy document info since we don't have a public link
    const text = `${documentType === 'invoice' ? 'Invoice' : 'Quotation'} ${documentNumber} - ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Document details copied to clipboard.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Please try again.',
      });
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      toast({
        variant: 'destructive',
        title: 'Not supported',
        description: 'Native sharing is not supported on this device.',
      });
      return;
    }

    setIsSharing(true);
    try {
      await navigator.share({
        title: `${documentType === 'invoice' ? 'Invoice' : 'Quotation'} ${documentNumber}`,
        text: `${documentType === 'invoice' ? 'Invoice' : 'Quotation'} ${documentNumber} - ₹${amount.toLocaleString('en-IN')}`,
      });
    } catch (error) {
      // User cancelled sharing - that's okay
      if ((error as Error).name !== 'AbortError') {
        toast({
          variant: 'destructive',
          title: 'Sharing failed',
          description: 'Please try another method.',
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share {documentType === 'invoice' ? 'Invoice' : 'Quotation'}</DialogTitle>
          <DialogDescription>
            Share {documentNumber} with your client via WhatsApp, email, or download the PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Share Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={handleWhatsAppShare}
            >
              <MessageCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm">WhatsApp</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => {
                onDownloadPDF();
                toast({
                  title: 'PDF Downloaded',
                  description: 'Your document has been saved.',
                });
              }}
            >
              <Download className="h-5 w-5 text-primary" />
              <span className="text-sm">Download PDF</span>
            </Button>
          </div>

          {/* Copy & Native Share */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-green-600" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy Details'}
            </Button>
            
            {navigator.share && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleNativeShare}
                disabled={isSharing}
              >
                {isSharing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Share
              </Button>
            )}
          </div>

          {/* Email Section */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium">Send via Email</h4>
            
            <div className="space-y-2">
              <Label htmlFor="emailTo">To</Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="client@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailSubject">Subject</Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailBody">Message</Label>
              <Textarea
                id="emailBody"
                rows={4}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleEmailShare}
              disabled={!emailTo}
            >
              <Mail className="mr-2 h-4 w-4" />
              Open Email Client
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
