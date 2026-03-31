-- Create businesses table for storing business profiles
CREATE TABLE public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Business Information
  business_name TEXT,
  business_address TEXT,
  city TEXT,
  pincode TEXT,
  state TEXT,
  
  -- GST Details
  gstin TEXT,
  pan_number TEXT,
  is_gst_registered BOOLEAN DEFAULT false,
  
  -- Contact Details
  phone_number TEXT,
  email TEXT,
  
  -- Logo (stored in Supabase Storage)
  logo_url TEXT,
  
  -- Invoice Settings
  invoice_prefix TEXT DEFAULT 'INV',
  invoice_starting_number INTEGER DEFAULT 1,
  current_invoice_number INTEGER DEFAULT 0,
  
  -- Quotation Settings
  quotation_prefix TEXT DEFAULT 'QT',
  quotation_starting_number INTEGER DEFAULT 1,
  current_quotation_number INTEGER DEFAULT 0,
  
  -- Default Terms and Conditions
  default_terms TEXT,
  default_notes TEXT,
  
  -- Currency and Tax Settings
  currency TEXT DEFAULT 'INR',
  default_tax_rate DECIMAL(5,2) DEFAULT 18.00,
  
  -- Setup Status
  setup_completed BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one business per user
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own business"
ON public.businesses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own business"
ON public.businesses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business"
ON public.businesses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business"
ON public.businesses
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_businesses_updated_at
BEFORE UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user business profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_business()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.businesses (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create business profile on user signup
CREATE TRIGGER on_auth_user_created_business
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_business();

-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true);

-- Storage policies for business logos
CREATE POLICY "Business logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'business-logos');

CREATE POLICY "Users can upload their own business logo"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own business logo"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own business logo"
ON storage.objects
FOR DELETE
USING (bucket_id = 'business-logos' AND auth.uid()::text = (storage.foldername(name))[1]);