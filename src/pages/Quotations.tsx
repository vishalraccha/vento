import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout, FloatingActionButton } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Plus, 
  FileText, 
  ArrowRight, 
  Loader2,
  Calendar,
  User,
  Eye,
  Download,
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle2,
  Send
} from 'lucide-react';
import { useQuotations } from '@/hooks/useQuotations';
import { useBusiness } from '@/hooks/useBusiness';
import { downloadQuotationPDF, getQuotationPDFBlob } from '@/lib/pdf/generateQuotationPDF';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  converted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const formatSafeDate = (dateVal: string | null | undefined, formatStr: string = 'dd MMM yyyy') => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return dateVal;
    return format(d, formatStr);
  } catch {
    return dateVal || '';
  }
};

export default function Quotations() {
  const navigate = useNavigate();
  const { 
    quotations, 
    quotationsWithItems, 
    isLoading, 
    stats, 
    convertToInvoice, 
    deleteQuotation, 
    updateQuotation 
  } = useQuotations();
  const { business } = useBusiness();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const filteredQuotations = (quotations || []).filter(quotation => {
    if (!quotation) return false;
    const qNum = (quotation.quotation_number || '').toLowerCase();
    const cName = (quotation.client_name || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();

    const matchesSearch = !query || qNum.includes(query) || cName.includes(query);
    const matchesStatus = statusFilter === 'all' || quotation.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleConvertToInvoice = async (id: string) => {
    setConvertingId(id);
    try {
      await convertToInvoice.mutateAsync(id);
      navigate('/invoices');
    } finally {
      setConvertingId(null);
    }
  };

  const handleViewPDF = async (id: string) => {
    const quotation = quotationsWithItems.find(q => q.id === id) || quotations.find(q => q.id === id);
    if (!quotation) return;
    const blob = await getQuotationPDFBlob({ quotation: quotation as any, business });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleDownloadPDF = async (id: string) => {
    const quotation = quotationsWithItems.find(q => q.id === id) || quotations.find(q => q.id === id);
    if (!quotation) return;
    await downloadQuotationPDF({ quotation: quotation as any, business });
  };

  const handleStatusChange = async (id: string, status: 'sent' | 'approved' | 'rejected') => {
    await updateQuotation.mutateAsync({ id, status });
  };

  const handleDelete = async (id: string) => {
    await deleteQuotation.mutateAsync(id);
  };

  return (
    <AppLayout title="Quotations" showBottomNav={false} showBackButton>
      <div className="flex flex-col">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 border-b p-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search quotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-2">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Quotations List */}
        <div className="space-y-3 p-4 pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-medium">No quotations found</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first quotation to get started'
                }
              </p>
              <Button onClick={() => navigate('/quotations/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Quotation
              </Button>
            </div>
          ) : (
            filteredQuotations.map((quotation) => (
              <Card key={quotation.id} className="overflow-hidden transition-all hover:border-primary/40">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{quotation.quotation_number}</p>
                        <Badge className={statusColors[quotation.status] || ''}>
                          {quotation.status}
                        </Badge>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {quotation.client_name || 'No client'}
                        </span>
                        {formatSafeDate(quotation.quotation_date) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatSafeDate(quotation.quotation_date)}
                          </span>
                        )}
                      </div>
                      
                      {quotation.valid_until && formatSafeDate(quotation.valid_until) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Valid until: {formatSafeDate(quotation.valid_until)}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-base font-semibold">₹{Number(quotation.total_amount || 0).toFixed(2)}</p>
                        {quotation.status === 'approved' && !quotation.converted_invoice_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1 h-7 text-xs"
                            disabled={convertingId === quotation.id}
                            onClick={() => handleConvertToInvoice(quotation.id)}
                          >
                            {convertingId === quotation.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <ArrowRight className="mr-1 h-3 w-3" />
                            )}
                            Convert
                          </Button>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewPDF(quotation.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(quotation.id)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/quotations/${quotation.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Quotation
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {quotation.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(quotation.id, 'sent')}>
                              <Send className="mr-2 h-4 w-4" />
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {quotation.status !== 'approved' && quotation.status !== 'converted' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(quotation.id, 'approved')}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mark as Approved
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(quotation.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* FAB */}
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="New Quote"
          onClick={() => navigate('/quotations/new')}
        />
      </div>
    </AppLayout>
  );
}
