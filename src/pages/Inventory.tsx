import { useState } from 'react';
import { AppLayout, FloatingActionButton } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Package, Search, Filter, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/hooks/useInventory';
import { InventoryItem } from '@/types/database';

export default function Inventory() {
  const navigate = useNavigate();
  const { items, isLoading } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'products') return matchesSearch && !item.is_service;
    if (activeTab === 'services') return matchesSearch && item.is_service;
    return matchesSearch;
  });

  const ItemCard = ({ item }: { item: InventoryItem }) => {
    const isLowStock = !item.is_service && item.stock_quantity <= item.low_stock_threshold;
    
    return (
      <div
        onClick={() => navigate(`/inventory/${item.id}`)}
        className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="font-medium">{item.name}</p>
            {item.is_service ? (
              <Badge variant="secondary" className="text-xs">Service</Badge>
            ) : isLowStock && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Low Stock
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">₹{Number(item.unit_price).toLocaleString('en-IN')}</span>
            {item.category && <span>{item.category}</span>}
            {!item.is_service && (
              <span>Stock: {item.stock_quantity} {item.unit}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="mb-4 h-16 w-16 text-muted-foreground/50" />
      <h3 className="mb-1 text-lg font-semibold">No items yet</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Add products and services to your inventory
      </p>
      <Button onClick={() => navigate('/inventory/new')}>
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </Button>
    </div>
  );

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const ItemList = ({ items }: { items: InventoryItem[] }) => (
    items.length > 0 ? (
      <div className="space-y-3 p-4">
        {items.map(item => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    ) : (
      <EmptyState />
    )
  );

  return (
    <AppLayout title="Inventory">
      <div className="space-y-4 p-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search items..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? <LoadingState /> : <ItemList items={filteredItems} />}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="products" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? <LoadingState /> : <ItemList items={filteredItems} />}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="services" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? <LoadingState /> : <ItemList items={filteredItems} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <FloatingActionButton 
        onClick={() => navigate('/inventory/new')}
        label="Add new item"
      />
    </AppLayout>
  );
}
