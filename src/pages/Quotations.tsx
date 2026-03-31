import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout, FloatingActionButton } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Plus, 
  FileText, 
  ArrowRight, 
  Loader2,
  Calendar,
  User
} from 'lucide-react';
import { useQuotations } from '@/hooks/useQuotations';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  converted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function Quotations() {
  const navigate = useNavigate();
  const { quotations, isLoading, stats, convertToInvoice } = useQuotations();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const filteredQuotations = quotations.filter(quotation => {
    const matchesSearch = 
      quotation.quotation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quotation.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
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

        {/* Search and Filter */}
        <div className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search quotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="sent">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Quotation List */}
        <div className="flex-1 space-y-3 p-4 pt-0">
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
                {searchQuery ? 'Try a different search term' : 'Create your first quotation'}
              </p>
              <Button onClick={() => navigate('/quotations/new')}>
                <Plus className="mr-2 h-4 w-4" />
                New Quotation
              </Button>
            </div>
          ) : (
            filteredQuotations.map((quotation) => (
              <Card key={quotation.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{quotation.quotation_number}</p>
                        <Badge className={statusColors[quotation.status]}>
                          {quotation.status}
                        </Badge>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {quotation.client_name || 'No client'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(quotation.quotation_date), 'dd MMM yyyy')}
                        </span>
                      </div>
                      
                      {quotation.valid_until && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Valid until: {format(new Date(quotation.valid_until), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-semibold">₹{quotation.total_amount.toFixed(2)}</p>
                      {quotation.status === 'approved' && !quotation.converted_invoice_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1"
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
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* FAB */}
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          onClick={() => navigate('/quotations/new')}
          label="New Quotation"
        />
      </div>
    </AppLayout>
  );
}
