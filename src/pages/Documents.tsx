import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  FileText, 
  FileSpreadsheet,
  Calendar,
  Download,
  Share2,
  Eye,
  FolderOpen,
  Cloud,
  CloudOff,
  Loader2,
} from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuotations } from '@/hooks/useQuotations';
import { useBusiness } from '@/hooks/useBusiness';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { downloadInvoicePDF, getInvoicePDFBlob } from '@/lib/pdf/generateInvoicePDF';
import { downloadQuotationPDF, getQuotationPDFBlob } from '@/lib/pdf/generateQuotationPDF';
import { ShareDialog } from '@/components/sharing';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Document {
  id: string;
  type: 'invoice' | 'quotation';
  number: string;
  date: string;
  clientName: string | null;
  amount: number;
  status: string;
}

export default function Documents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { invoices, invoicesWithItems, isLoading: invoicesLoading } = useInvoices();
 const { quotations, quotationsWithItems, isLoading: quotationsLoading } = useQuotations();
  const { business } = useBusiness();
  const { 
    isConnected, 
    isLoading: driveLoading, 
    isConnecting,
    connect,
    handleCallback,
    disconnect,
    isDisconnecting,
    uploadDocument,
  } = useGoogleDrive();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const autoSyncDoneRef = useRef(false);

  const isLoading = invoicesLoading || quotationsLoading;

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleCallback(code).then((success) => {
        if (success) {
          setSearchParams({});
        }
      });
    }
  }, [searchParams, handleCallback, setSearchParams]);

  // Auto-upload to Drive when connected and documents are loaded
  const autoSyncToDrive = useCallback(async () => {
    if (!isConnected || isLoading || autoSyncDoneRef.current) return;
    autoSyncDoneRef.current = true;

    const allDocs = [
      ...invoices.map(inv => ({ type: 'invoice' as const, data: inv, number: inv.invoice_number })),
      ...quotations.map(qt => ({ type: 'quotation' as const, data: qt, number: qt.quotation_number })),
    ];

    for (const doc of allDocs) {
      try {
        let pdfBlob: Blob;
        if (doc.type === 'invoice') {
          pdfBlob = await getInvoicePDFBlob({ invoice: doc.data as any, business });
        } else {
          pdfBlob = await getQuotationPDFBlob({ quotation: doc.data as any, business });
        }

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });

        await uploadDocument({
          fileName: `${doc.number}.pdf`,
          fileContent: base64,
          documentType: doc.type,
        });
      } catch {
        // Silently skip failed uploads during auto-sync
      }
    }
  }, [isConnected, isLoading, invoices, quotations, business, uploadDocument]);

  useEffect(() => {
    autoSyncToDrive();
  }, [autoSyncToDrive]);

  // Combine and sort documents
  const allDocuments: Document[] = [
    ...invoices.map(inv => ({
      id: inv.id,
      type: 'invoice' as const,
      number: inv.invoice_number,
      date: inv.invoice_date,
      clientName: inv.client_name,
      amount: Number(inv.total_amount),
      status: inv.status,
    })),
    ...quotations.map(qt => ({
      id: qt.id,
      type: 'quotation' as const,
      number: qt.quotation_number,
      date: qt.quotation_date,
      clientName: qt.client_name,
      amount: Number(qt.total_amount),
      status: qt.status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredDocuments = allDocuments.filter(doc => {
    const matchesSearch = 
      doc.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'invoices' && doc.type === 'invoice') ||
      (activeTab === 'quotations' && doc.type === 'quotation');
    
    return matchesSearch && matchesTab;
  });

  // Group by month
  const groupedByMonth = filteredDocuments.reduce((acc, doc) => {
    const monthKey = format(new Date(doc.date), 'MMMM yyyy');
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

const handleDownload = async (doc: Document) => {
  if (doc.type === 'invoice') {
    const invoice = invoicesWithItems.find(i => i.id === doc.id);
    if (invoice) await downloadInvoicePDF({ invoice: invoice as any, business });
  } else {
    const quotation = quotationsWithItems.find(q => q.id === doc.id); // ← changed
    if (quotation) await downloadQuotationPDF({ quotation: quotation as any, business });
  }
};

const handleViewPDF = async (doc: Document) => {
  let blob: Blob;
  if (doc.type === 'invoice') {
    const invoice = invoicesWithItems.find(i => i.id === doc.id);
    if (!invoice) return;
    blob = await getInvoicePDFBlob({ invoice: invoice as any, business });
  } else {
    const quotation = quotationsWithItems.find(q => q.id === doc.id); // ← changed
    if (!quotation) return;
    blob = await getQuotationPDFBlob({ quotation: quotation as any, business });
  }
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

  return (
    <AppLayout title="Documents" showBottomNav={false} showBackButton>
      <div className="flex flex-col">
        {/* Storage Status Banner */}
        <Card className="m-4 mb-0 border-dashed">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isConnected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
            }`}>
              {driveLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <Cloud className="h-5 w-5 text-green-600" />
              ) : (
                <CloudOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {isConnected ? 'Google Drive Connected' : 'Google Drive Not Connected'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isConnected 
                  ? 'Documents are automatically synced to your Drive' 
                  : 'Connect to automatically backup your documents'
                }
              </p>
            </div>
            {isConnected ? (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => disconnect()}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Disconnect'
                )}
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                onClick={connect}
                disabled={isConnecting || driveLoading}
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Connect
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="quotations">Quotations</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-medium">No documents found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'Create invoices or quotations to see them here'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByMonth).map(([month, docs]) => (
                <div key={month}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {month}
                  </h3>
                  
                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <Card key={doc.id} className="overflow-hidden">
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            doc.type === 'invoice' 
                              ? 'bg-blue-100 dark:bg-blue-900/30' 
                              : 'bg-purple-100 dark:bg-purple-900/30'
                          }`}>
                            {doc.type === 'invoice' ? (
                              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <FileSpreadsheet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{doc.number}</p>
                              <Badge variant="outline" className="text-xs capitalize">
                                {doc.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {doc.clientName || 'No client'} • {format(new Date(doc.date), 'dd MMM yyyy')}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-sm font-medium">₹{doc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            <div className="mt-1 flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => handleViewPDF(doc)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => handleDownload(doc)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => setShareDoc(doc)}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage Info */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{isConnected ? 'Google Drive' : 'Local Storage'}</span>
            <span>{allDocuments.length} documents</span>
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      {shareDoc && (
        <ShareDialog
          open={!!shareDoc}
          onOpenChange={(open) => !open && setShareDoc(null)}
          documentType={shareDoc.type}
          documentNumber={shareDoc.number}
          clientName={shareDoc.clientName || undefined}
          amount={shareDoc.amount}
          onDownloadPDF={() => handleDownload(shareDoc)}
        />
      )}
    </AppLayout>
  );
}