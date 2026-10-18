import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function NewInventoryItem() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const { items, isLoading, createItem, updateItem, deleteItem } = useInventory();
  const existingItem = items.find(i => i.id === id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    sku: '',
    unit_price: 0,
    cost_price: 0,
    tax_rate: 18,
    hsn_code: '',
    is_service: false,
    stock_quantity: 0,
    low_stock_threshold: 10,
    unit: 'pcs',
    is_active: true,
  });

  useEffect(() => {
    if (existingItem) {
      setFormData({
        name: existingItem.name || '',
        description: existingItem.description || '',
        category: existingItem.category || '',
        sku: existingItem.sku || '',
        unit_price: Number(existingItem.unit_price) || 0,
        cost_price: Number(existingItem.cost_price) || 0,
        tax_rate: Number(existingItem.tax_rate) || 18,
        hsn_code: existingItem.hsn_code || '',
        is_service: Boolean(existingItem.is_service),
        stock_quantity: Number(existingItem.stock_quantity) || 0,
        low_stock_threshold: Number(existingItem.low_stock_threshold) || 10,
        unit: existingItem.unit || 'pcs',
        is_active: existingItem.is_active ?? true,
      });
    }
  }, [existingItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (isEditing && id) {
        await updateItem.mutateAsync({ id, ...formData });
      } else {
        await createItem.mutateAsync(formData);
      }
      navigate('/inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      await deleteItem.mutateAsync(id);
      navigate('/inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isEditing && isLoading && !existingItem) {
    return (
      <AppLayout title="Edit Item" showBottomNav={false}>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={isEditing ? "Edit Item" : "New Item"} showBottomNav={false}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b bg-card p-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-lg font-semibold">
            {isEditing ? "Edit Inventory Item" : "Add Inventory Item"}
          </h1>
          <div className="flex items-center gap-2">
            {isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this inventory item? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Save Item"}
            </Button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 p-4 pb-20">
          {/* Type Toggle */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <Label htmlFor="is_service" className="font-medium">This is a Service</Label>
                <p className="text-sm text-muted-foreground">Services don't track physical inventory stock</p>
              </div>
              <Switch
                id="is_service"
                checked={formData.is_service}
                onCheckedChange={(checked) => handleChange('is_service', checked)}
              />
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Web Development or Widget A"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Detailed specifications or notes..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    placeholder="Hardware, Services, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU / Code</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                    placeholder="PRD-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="hsn_code">HSN / SAC Code</Label>
                  <Input
                    id="hsn_code"
                    value={formData.hsn_code}
                    onChange={(e) => handleChange('hsn_code', e.target.value)}
                    placeholder="998314"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => handleChange('unit', e.target.value)}
                    placeholder="pcs, hrs, kgs..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Tax */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing & Tax</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Selling Price (₹) *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_price || ''}
                    onChange={(e) => handleChange('unit_price', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price (₹)</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost_price || ''}
                    onChange={(e) => handleChange('cost_price', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.tax_rate || ''}
                  onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value) || 0)}
                  placeholder="18"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stock Tracking (only if not a service) */}
          {!formData.is_service && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Stock Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="stock_quantity">Available Stock</Label>
                    <Input
                      id="stock_quantity"
                      type="number"
                      min="0"
                      value={formData.stock_quantity || ''}
                      onChange={(e) => handleChange('stock_quantity', parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">Low Stock Alert Level</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      min="0"
                      value={formData.low_stock_threshold || ''}
                      onChange={(e) => handleChange('low_stock_threshold', parseInt(e.target.value) || 0)}
                      placeholder="10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </form>
    </AppLayout>
  );
}
