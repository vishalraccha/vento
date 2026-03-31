import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Cloud, Moon, Bell, Shield, Trash2, Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

export default function Settings() {
  const navigate = useNavigate();
  const { 
    isConnected, 
    isLoading: driveLoading, 
    connect, 
    disconnect, 
    isConnecting,
    isDisconnecting 
  } = useGoogleDrive();

  return (
    <AppLayout 
      title="Settings" 
      showBottomNav={false}
      showBackButton
    >
      <div className="space-y-4 p-4">

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
              <Label htmlFor="darkMode">Dark Mode</Label>
              <Switch id="darkMode" />
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
              <Label htmlFor="paymentReminders">Payment Reminders</Label>
              <Switch id="paymentReminders" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dailySummary">Daily Summary</Label>
              <Switch id="dailySummary" />
            </div>
          </CardContent>
        </Card>

        {/* Google Drive */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4" />
              Google Drive
              {isConnected && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isConnected 
                ? 'Your documents are being backed up to Google Drive automatically.'
                : 'Connect Google Drive to automatically backup your invoices and documents.'
              }
            </p>
            {driveLoading ? (
              <Button variant="outline" className="w-full" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
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
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <Trash2 className="h-4 w-4" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Button variant="destructive" className="w-full">
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}