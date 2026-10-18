import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Cloud, 
  Moon, 
  Bell, 
  Shield, 
  Trash2, 
  Loader2, 
  CheckCircle,
  HelpCircle,
  AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  
  const { 
    isConnected, 
    isLoading: driveLoading, 
    connect, 
    disconnect, 
    isConnecting,
    isDisconnecting 
  } = useGoogleDrive();

  const [paymentReminders, setPaymentReminders] = useState(() => {
    return localStorage.getItem("vento_pref_payment_reminders") !== "false";
  });
  const [dailySummary, setDailySummary] = useState(() => {
    return localStorage.getItem("vento_pref_daily_summary") === "true";
  });

  const handlePaymentRemindersChange = (checked: boolean) => {
    setPaymentReminders(checked);
    localStorage.setItem("vento_pref_payment_reminders", String(checked));
    toast({ title: checked ? "Payment reminders enabled" : "Payment reminders disabled" });
  };

  const handleDailySummaryChange = (checked: boolean) => {
    setDailySummary(checked);
    localStorage.setItem("vento_pref_daily_summary", String(checked));
    toast({ title: checked ? "Daily summary enabled" : "Daily summary disabled" });
  };

  const isDarkMode = theme === 'dark';

  return (
    <AppLayout 
      title="Settings" 
      showBottomNav={false}
      showBackButton
    >
      <div className="space-y-4 p-4 pb-20">

        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Moon className="h-4 w-4" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="darkMode" className="font-medium">Dark Mode</Label>
                <p className="text-xs text-muted-foreground">Adjust the interface color scheme</p>
              </div>
              <Switch 
                id="darkMode" 
                checked={isDarkMode}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="paymentReminders" className="font-medium">Payment Reminders</Label>
                <p className="text-xs text-muted-foreground">Notify when invoice due dates arrive</p>
              </div>
              <Switch 
                id="paymentReminders" 
                checked={paymentReminders}
                onCheckedChange={handlePaymentRemindersChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="dailySummary" className="font-medium">Daily Summary</Label>
                <p className="text-xs text-muted-foreground">Receive daily task and revenue digest</p>
              </div>
              <Switch 
                id="dailySummary" 
                checked={dailySummary}
                onCheckedChange={handleDailySummaryChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Google Drive */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4" />
              Google Drive Cloud Storage
              {isConnected && (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isConnected 
                ? 'Your invoices and quotations are automatically backed up to Google Drive.'
                : 'Connect Google Drive to automatically backup your invoices and quotation documents.'
              }
            </p>
            {driveLoading ? (
              <Button variant="outline" className="w-full" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking connection...
              </Button>
            ) : isConnected ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => disconnect()}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Disconnect Google Drive
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={connect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Connect Google Drive
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/auth?mode=reset')}
            >
              Reset / Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Help & About */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4" />
              Support &amp; Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/help')}
            >
              View Documentation &amp; FAQs
            </Button>
            <p className="text-center text-xs text-muted-foreground">Vento Invoice Manager v1.0.0</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}