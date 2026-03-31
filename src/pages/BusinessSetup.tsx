import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Upload, Trash2, Loader2, Save } from "lucide-react";
import { useBusiness } from '@/hooks/useBusiness';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

// Validation schema
const businessSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  phone_number: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  business_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gstin: z.string().optional(),
  pan_number: z.string().optional(),
  is_gst_registered: z.boolean().optional(),
  default_tax_rate: z.number().min(0).max(100).optional(),
  invoice_prefix: z.string().optional(),
  invoice_starting_number: z.number().min(1).optional(),
  quotation_prefix: z.string().optional(),
  quotation_starting_number: z.number().min(1).optional(),
  currency: z.string().optional(),
  default_terms: z.string().optional(),
  default_notes: z.string().optional(),
});

type BusinessFormData = z.infer<typeof businessSchema>;

export default function BusinessSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    business, 
    isLoading, 
    updateBusiness, 
    uploadLogo, 
    removeLogo 
  } = useBusiness();

  const [formData, setFormData] = useState<BusinessFormData>({
    business_name: '',
    phone_number: '',
    email: '',
    business_address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan_number: '',
    is_gst_registered: false,
    default_tax_rate: 18,
    invoice_prefix: 'INV',
    invoice_starting_number: 1,
    quotation_prefix: 'QT',
    quotation_starting_number: 1,
    currency: 'INR',
    default_terms: '',
    default_notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Populate form when business data loads
  useEffect(() => {
    if (business) {
      setFormData({
        business_name: business.business_name || '',
        phone_number: business.phone_number || '',
        email: business.email || '',
        business_address: business.business_address || '',
        city: business.city || '',
        state: business.state || '',
        pincode: business.pincode || '',
        gstin: business.gstin || '',
        pan_number: business.pan_number || '',
        is_gst_registered: business.is_gst_registered || false,
        default_tax_rate: business.default_tax_rate || 18,
        invoice_prefix: business.invoice_prefix || 'INV',
        invoice_starting_number: business.invoice_starting_number || 1,
        quotation_prefix: business.quotation_prefix || 'QT',
        quotation_starting_number: business.quotation_starting_number || 1,
        currency: business.currency || 'INR',
        default_terms: business.default_terms || '',
        default_notes: business.default_notes || '',
      });
    }
  }, [business]);

  const handleInputChange = (field: keyof BusinessFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an image file',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Logo must be less than 5MB',
      });
      return;
    }

    uploadLogo.mutate(file);
  };

  const handleRemoveLogo = () => {
    removeLogo.mutate();
  };

  const handleSave = async () => {
    // Validate
    const result = businessSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateBusiness.mutateAsync({
        ...formData,
        setup_completed: true,
      });
      navigate('/');
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Business Profile" showBottomNav={false}>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Business Profile" showBottomNav={false}>
      <div className="space-y-4 p-4 pb-24">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="invoice">Invoice</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            {/* Logo Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Business Logo</CardTitle>
                <CardDescription>Upload your business logo (max 5MB)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    {business?.logo_url ? (
                      <img 
                        src={business.logo_url} 
                        alt="Business logo" 
                        className="h-24 w-24 rounded-full object-cover border-2 border-border"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed bg-muted">
                        <Building2 className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    {uploadLogo.isPending && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadLogo.isPending}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </Button>
                    {business?.logo_url && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRemoveLogo}
                        disabled={removeLogo.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Business Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input 
                    id="businessName" 
                    placeholder="Enter your business name"
                    value={formData.business_name}
                    onChange={(e) => handleInputChange('business_name', e.target.value)}
                    className={errors.business_name ? 'border-destructive' : ''}
                  />
                  {errors.business_name && (
                    <p className="text-sm text-destructive">{errors.business_name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea 
                    id="address" 
                    placeholder="Street address"
                    value={formData.business_address}
                    onChange={(e) => handleInputChange('business_address', e.target.value)}
                    rows={2}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city" 
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input 
                      id="pincode" 
                      placeholder="Pincode"
                      value={formData.pincode}
                      onChange={(e) => handleInputChange('pincode', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input 
                    id="state" 
                    placeholder="State"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="+91 "
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="business@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* GST Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">GST & Tax Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isGstRegistered">GST Registered</Label>
                    <p className="text-sm text-muted-foreground">Is your business GST registered?</p>
                  </div>
                  <Switch
                    id="isGstRegistered"
                    checked={formData.is_gst_registered}
                    onCheckedChange={(checked) => handleInputChange('is_gst_registered', checked)}
                  />
                </div>

                {formData.is_gst_registered && (
                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GSTIN</Label>
                    <Input 
                      id="gstNumber" 
                      placeholder="Enter GST number"
                      value={formData.gstin}
                      onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input 
                    id="pan" 
                    placeholder="Enter PAN number"
                    value={formData.pan_number}
                    onChange={(e) => handleInputChange('pan_number', e.target.value.toUpperCase())}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
                  <Input 
                    id="taxRate" 
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="18"
                    value={formData.default_tax_rate}
                    onChange={(e) => handleInputChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoice Settings Tab */}
          <TabsContent value="invoice" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Invoice Numbering</CardTitle>
                <CardDescription>Configure how your invoices are numbered</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Prefix</Label>
                    <Input 
                      id="invoicePrefix" 
                      placeholder="INV"
                      value={formData.invoice_prefix}
                      onChange={(e) => handleInputChange('invoice_prefix', e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceStartNum">Starting Number</Label>
                    <Input 
                      id="invoiceStartNum" 
                      type="number"
                      min={1}
                      placeholder="1"
                      value={formData.invoice_starting_number}
                      onChange={(e) => handleInputChange('invoice_starting_number', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Preview: {formData.invoice_prefix}-{String(formData.invoice_starting_number).padStart(3, '0')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quotation Numbering</CardTitle>
                <CardDescription>Configure how your quotations are numbered</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="quotationPrefix">Prefix</Label>
                    <Input 
                      id="quotationPrefix" 
                      placeholder="QT"
                      value={formData.quotation_prefix}
                      onChange={(e) => handleInputChange('quotation_prefix', e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quotationStartNum">Starting Number</Label>
                    <Input 
                      id="quotationStartNum" 
                      type="number"
                      min={1}
                      placeholder="1"
                      value={formData.quotation_starting_number}
                      onChange={(e) => handleInputChange('quotation_starting_number', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Preview: {formData.quotation_prefix}-{String(formData.quotation_starting_number).padStart(3, '0')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Currency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Input 
                    id="currency" 
                    placeholder="INR"
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value.toUpperCase())}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Defaults Tab */}
          <TabsContent value="defaults" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Default Terms & Conditions</CardTitle>
                <CardDescription>These will appear on all invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Enter your default terms and conditions..."
                  value={formData.default_terms}
                  onChange={(e) => handleInputChange('default_terms', e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Default Notes</CardTitle>
                <CardDescription>Additional notes for invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Enter your default notes..."
                  value={formData.default_notes}
                  onChange={(e) => handleInputChange('default_notes', e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Business Profile
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
