import { useState } from 'react';
import { AppLayout, FloatingActionButton } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Filter, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { formatSafeDate } from '@/lib/dateUtils';
import { Invoice } from '@/types/database';

export default function Invoices() {
  const navigate = useNavigate();
  const { invoices, isLoading } = useInvoices();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const total = Number(invoice.total_amount) || 0;
    const paid = Number(invoice.amount_paid) || 0;
    const isPaid = invoice.status === 'paid' || (paid >= total && total > 0);
    const isOverdue = invoice.status === 'overdue' || (!isPaid && invoice.due_date && new Date(invoice.due_date) < new Date());

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'paid') return matchesSearch && isPaid;
    if (activeTab === 'pending') return matchesSearch && !isPaid;
    if (activeTab === 'overdue') return matchesSearch && isOverdue;
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default',
      sent: 'secondary',
      draft: 'outline',
      overdue: 'destructive',
      cancelled: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const InvoiceCard = ({ invoice }: { invoice: Invoice }) => {
    const total = Number(invoice.total_amount) || 0;
    const paid = Number(invoice.amount_paid) || 0;
    const balance = Math.max(0, total - paid);
    const isPaid = invoice.status === 'paid' || (paid >= total && total > 0);

    return (
      <div
        onClick={() => navigate(`/invoices/${invoice.id}`)}
        className="flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
      >
        <div className="space-y-1">
          <p className="font-medium text-foreground">{invoice.client_name || 'Walk-in / Direct Client'}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{invoice.invoice_number}</span> • {formatSafeDate(invoice.invoice_date)}
          </p>
          {!isPaid && paid > 0 && (
            <p className="text-xs text-emerald-600 font-medium">
              ₹{paid.toLocaleString('en-IN')} paid of ₹{total.toLocaleString('en-IN')}
            </p>
          )}
        </div>
        <div className="text-right space-y-1">
          <p className="font-semibold text-foreground">₹{total.toLocaleString('en-IN')}</p>
          <div className="flex items-center justify-end gap-1.5">
            {isPaid ? (
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200">
                Paid
              </Badge>
            ) : paid > 0 ? (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200">
                ₹{balance.toLocaleString('en-IN')} Due
              </Badge>
            ) : (
              getStatusBadge(invoice.status)
            )}
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="mb-4 h-16 w-16 text-muted-foreground/50" />
      <h3 className="mb-1 text-lg font-semibold">No invoices yet</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Create your first invoice to start tracking your business
      </p>
      <Button onClick={() => navigate('/invoices/new')}>
        Create Invoice
      </Button>
    </div>
  );

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const InvoiceList = ({ invoices }: { invoices: Invoice[] }) => (
    invoices.length > 0 ? (
      <div className="space-y-3 p-4">
        {invoices.map(invoice => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
      </div>
    ) : (
      <EmptyState />
    )
  );

  return (
    <AppLayout title="Invoices">
      <div className="space-y-4 p-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search invoices..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? <LoadingState /> : <InvoiceList invoices={filteredInvoices} />}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="paid" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? <LoadingState /> : <InvoiceList invoices={filteredInvoices} />}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? <LoadingState /> : <InvoiceList invoices={filteredInvoices} />}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="overdue" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? <LoadingState /> : <InvoiceList invoices={filteredInvoices} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <FloatingActionButton 
        onClick={() => navigate('/invoices/new')}
        label="Create new invoice"
      />
    </AppLayout>
  );
}
