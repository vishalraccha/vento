import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  FileText,
  Users,
  Package,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuotations } from '@/hooks/useQuotations';
import { useClients } from '@/hooks/useClients';
import { useInventory } from '@/hooks/useInventory';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Reports() {
  const navigate = useNavigate();
  const { invoices } = useInvoices();
  const { quotations } = useQuotations();
  const { clients } = useClients();
  const { items: inventoryItems } = useInventory();
  
  const [dateRange, setDateRange] = useState('6months');
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case '1month':
        return { start: subMonths(now, 1), end: now };
      case '3months':
        return { start: subMonths(now, 3), end: now };
      case '6months':
        return { start: subMonths(now, 6), end: now };
      case '1year':
        return { start: subMonths(now, 12), end: now };
      default:
        return { start: subMonths(now, 6), end: now };
    }
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: rangeStart, end: rangeEnd });
    });
  }, [invoices, rangeStart, rangeEnd]);

  // Monthly revenue data
  const monthlyRevenueData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; paid: number; pending: number }> = {};
    
    // Initialize months
    let current = new Date(rangeStart);
    while (current <= rangeEnd) {
      const key = format(current, 'MMM yyyy');
      months[key] = { month: format(current, 'MMM'), revenue: 0, paid: 0, pending: 0 };
      current = new Date(current.setMonth(current.getMonth() + 1));
    }
    
    // Aggregate invoice data
    filteredInvoices.forEach((inv) => {
      const key = format(parseISO(inv.invoice_date), 'MMM yyyy');
      if (months[key]) {
        months[key].revenue += Number(inv.total_amount);
        if (inv.status === 'paid') {
          months[key].paid += Number(inv.total_amount);
        } else {
          months[key].pending += Number(inv.total_amount);
        }
      }
    });
    
    return Object.values(months);
  }, [filteredInvoices, rangeStart, rangeEnd]);

  // Invoice status breakdown
  const statusBreakdown = useMemo(() => {
    const breakdown = {
      paid: 0,
      sent: 0,
      draft: 0,
      overdue: 0,
      cancelled: 0,
    };
    
    filteredInvoices.forEach((inv) => {
      if (breakdown.hasOwnProperty(inv.status)) {
        breakdown[inv.status as keyof typeof breakdown] += 1;
      }
    });
    
    return Object.entries(breakdown)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
      }));
  }, [filteredInvoices]);

  // Top clients by revenue
  const topClients = useMemo(() => {
    const clientRevenue: Record<string, { name: string; revenue: number; invoiceCount: number }> = {};
    
    filteredInvoices.forEach((inv) => {
      const clientName = inv.client_name || 'Unknown';
      if (!clientRevenue[clientName]) {
        clientRevenue[clientName] = { name: clientName, revenue: 0, invoiceCount: 0 };
      }
      clientRevenue[clientName].revenue += Number(inv.total_amount);
      clientRevenue[clientName].invoiceCount += 1;
    });
    
    return Object.values(clientRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredInvoices]);

  // Summary stats
  const stats = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const paidAmount = filteredInvoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const pendingAmount = totalRevenue - paidAmount;
    
    // Previous period for comparison
    const prevStart = subMonths(rangeStart, dateRange === '1month' ? 1 : dateRange === '3months' ? 3 : 6);
    const prevEnd = rangeStart;
    const prevInvoices = invoices.filter((inv) => {
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: prevStart, end: prevEnd });
    });
    const prevRevenue = prevInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    
    return {
      totalRevenue,
      paidAmount,
      pendingAmount,
      invoiceCount: filteredInvoices.length,
      revenueChange,
      averageInvoice: filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0,
    };
  }, [filteredInvoices, invoices, dateRange, rangeStart]);

  // Quotation conversion rate
  const quotationStats = useMemo(() => {
    const total = quotations.length;
    const converted = quotations.filter((q) => q.status === 'converted').length;
    const approved = quotations.filter((q) => q.status === 'approved').length;
    const pending = quotations.filter((q) => ['draft', 'sent'].includes(q.status)).length;
    
    return {
      total,
      converted,
      approved,
      pending,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0',
    };
  }, [quotations]);

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }
    if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value.toFixed(0)}`;
  };

  return (
    <AppLayout title="Reports" showBottomNav={false} showBackButton>
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-background p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="-ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4 p-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <IndianRupee className="h-5 w-5 text-muted-foreground" />
                  {stats.revenueChange >= 0 ? (
                    <div className="flex items-center text-xs text-green-600">
                      <ArrowUpRight className="h-3 w-3" />
                      {stats.revenueChange.toFixed(0)}%
                    </div>
                  ) : (
                    <div className="flex items-center text-xs text-red-600">
                      <ArrowDownRight className="h-3 w-3" />
                      {Math.abs(stats.revenueChange).toFixed(0)}%
                    </div>
                  )}
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {formatCurrency(stats.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-2xl font-bold">{stats.invoiceCount}</p>
                <p className="text-xs text-muted-foreground">Invoices Created</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-green-600">
                  {formatCurrency(stats.paidAmount)}
                </p>
                <p className="text-xs text-muted-foreground">Paid Amount</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-amber-600">
                  {formatCurrency(stats.pendingAmount)}
                </p>
                <p className="text-xs text-muted-foreground">Pending Amount</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue Overview</CardTitle>
              <CardDescription className="text-xs">
                Monthly revenue breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `₹${value.toLocaleString('en-IN')}`,
                        'Revenue',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563EB"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Status & Top Clients */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Invoice Status Pie Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Invoice Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusBreakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        formatter={(value) => (
                          <span className="text-xs">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Clients */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Clients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topClients.length > 0 ? (
                    topClients.map((client, index) => (
                      <div key={client.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {client.invoiceCount} invoices
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-medium">
                          {formatCurrency(client.revenue)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quotation Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Quotation Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{quotationStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {quotationStats.converted}
                  </p>
                  <p className="text-xs text-muted-foreground">Converted</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {quotationStats.approved}
                  </p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {quotationStats.conversionRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-xl font-bold">{clients.length}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Package className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-xl font-bold">{inventoryItems.length}</p>
                <p className="text-xs text-muted-foreground">Inventory Items</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <IndianRupee className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-xl font-bold">
                  {formatCurrency(stats.averageInvoice)}
                </p>
                <p className="text-xs text-muted-foreground">Avg Invoice</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
