import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  FileText, 
  Users, 
  Package, 
  Calendar, 
  Cloud, 
  HelpCircle, 
  Mail, 
  Phone, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Help() {
  const navigate = useNavigate();

  const faqs = [
    {
      question: "How do I create and send an invoice?",
      answer: "Go to Invoices > New Invoice (+ button), select a client (or enter client details), add line items with quantities and prices, configure tax rates if applicable, and tap Save. Once created, you can view, download a PDF, share via WhatsApp/Email, or mark it as sent or paid."
    },
    {
      question: "How does Google Drive synchronization work?",
      answer: "Connect your Google Drive account in Documents or Settings. Once connected, your invoices and quotations are automatically generated as formatted PDFs and backed up into a dedicated folder on your Google Drive."
    },
    {
      question: "How do I convert a Quotation into an Invoice?",
      answer: "Navigate to Quotations. When a quotation status is marked as 'Approved', a 'Convert' button appears next to the quotation. Tapping 'Convert' automatically copies all line items and client details into a new invoice and increments your invoice sequence."
    },
    {
      question: "Can I manage inventory stock levels and services?",
      answer: "Yes! In the Inventory section, you can add products with stock quantities and low-stock alerts, or define billable services (which don't track physical inventory). When creating invoices, picking an item from inventory auto-fills pricing and HSN codes."
    },
    {
      question: "How do I configure my GSTIN and business details?",
      answer: "Go to More > Business Profile (or Header Menu > Business Setup). Here you can set your business name, GSTIN, PAN, registered address, invoice prefixes, starting invoice numbering, bank details, and default payment terms."
    },
    {
      question: "What is Daily Work?",
      answer: "Daily Work helps small business owners stay on top of daily deliverables, client follow-ups, payment collections, and pending tasks with priority levels and due dates."
    }
  ];

  return (
    <AppLayout title="Help & Support" showBottomNav={false} showBackButton>
      <div className="space-y-6 p-4 pb-12">
        {/* Hero Banner */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/5">
          <CardHeader className="pb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <HelpCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Help & Documentation</CardTitle>
            <CardDescription>
              Everything you need to know about managing your business, invoices, and quotations with Vento.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/invoices/new')}>
                New Invoice <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/business-setup')}>
                Business Profile <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feature Highlights */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Core Modules</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="transition-all hover:border-primary/50">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Invoices & Quotations</h3>
                  <p className="text-xs text-muted-foreground">GST-ready calculation, custom prefixes, instant PDF generation and payment tracking.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all hover:border-primary/50">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Google Drive Backup</h3>
                  <p className="text-xs text-muted-foreground">Automatic cloud sync ensures your business records are safe and accessible anywhere.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all hover:border-primary/50">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Inventory & Catalog</h3>
                  <p className="text-xs text-muted-foreground">Monitor stock counts, track items by SKU and HSN, with automated low-stock warnings.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all hover:border-primary/50">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">Daily Work & Tasks</h3>
                  <p className="text-xs text-muted-foreground">Organize your daily tasks, deadlines, client follow-ups, and collection reminders.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h2 className="mb-3 text-base font-semibold">Frequently Asked Questions</h2>
          <Card>
            <CardContent className="p-4">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-sm font-medium">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Support & Contact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Need more assistance?</CardTitle>
            <CardDescription>
              We're here to help you get the most out of your Vento billing app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Mail className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email Support</p>
                <p className="text-xs text-muted-foreground">support@vento.app</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => window.open('mailto:support@vento.app')}>
                Contact
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Data encrypted & securely stored with Supabase Cloud.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
