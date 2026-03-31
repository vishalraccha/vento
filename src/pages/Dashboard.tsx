import { AppLayout, FloatingActionButton } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  FilePlus, 
  IndianRupee,
  TrendingUp,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { useBusiness } from '@/hooks/useBusiness';
import { format } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const { invoices, stats, isLoading } = useInvoices();
  const { business } = useBusiness();

  const recentInvoices = invoices.slice(0, 5);

  const statCards = [
    { 
      label: 'Total Invoices', 
      value: stats.totalInvoices.toString(), 
      icon: FileText, 
      color: 'text-primary' 
    },
    { 
      label: 'Pending Amount', 
      value: `₹${stats.pendingAmount.toLocaleString('en-IN')}`, 
      icon: Clock, 
      color: 'text-warning' 
    },
    { 
      label: 'Paid Amount', 
      value: `₹${stats.paidAmount.toLocaleString('en-IN')}`, 
      icon: TrendingUp, 
      color: 'text-accent' 
    },
    { 
      label: 'Overdue', 
      value: stats.overdueCount.toString(), 
      icon: AlertCircle, 
      color: 'text-destructive' 
    },
  ];

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

  return (
    <AppLayout title="Vento">
      <div className="space-y-6 p-4">
        {/* Welcome Section */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">
            Welcome{business?.business_name ? `, ${business.business_name}` : ' back'}!
          </h2>
          <p className="text-muted-foreground">Here's your business overview</p>
        </div>

        {/* Setup Reminder */}
        {business && !business.setup_completed && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Complete your business setup</p>
                <p className="text-sm text-muted-foreground">Add your business details to create professional invoices</p>
              </div>
              <Button size="sm" onClick={() => navigate('/business-setup')}>
                Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button 
            onClick={() => navigate('/invoices/new')}
            className="flex-1 gap-2"
          >
            <FilePlus className="h-4 w-4" />
            New Invoice
          </Button>
          <Button 
            onClick={() => navigate('/quotations/new')}
            variant="outline"
            className="flex-1 gap-2"
          >
            <Plus className="h-4 w-4" />
            New Quote
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Invoices</CardTitle>
            {recentInvoices.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
                View All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : recentInvoices.length > 0 ? (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{invoice.client_name || 'No client'}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.invoice_number} • {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{Number(invoice.total_amount).toLocaleString('en-IN')}</p>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No invoices yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first invoice to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.filter(i => ['sent', 'overdue'].includes(i.status)).length > 0 ? (
              <div className="space-y-3">
                {invoices
                  .filter(i => ['sent', 'overdue'].includes(i.status))
                  .slice(0, 3)
                  .map((invoice) => (
                    <div
                      key={invoice.id}
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{invoice.client_name || 'No client'}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {invoice.due_date ? format(new Date(invoice.due_date), 'dd MMM yyyy') : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-warning">
                          ₹{(Number(invoice.total_amount) - Number(invoice.amount_paid)).toLocaleString('en-IN')}
                        </p>
                        {getStatusBadge(invoice.status)}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <IndianRupee className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No pending payments</p>
                <p className="text-xs text-muted-foreground">
                  All payments are up to date
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FloatingActionButton 
        onClick={() => navigate('/invoices/new')}
        label="Create new invoice"
      />
    </AppLayout>
  );
}
