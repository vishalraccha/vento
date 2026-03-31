import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, 
  Calendar, 
  FolderOpen, 
  Settings, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Building2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function More() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const menuItems = [
    { icon: FileText, label: "Quotations", description: "Manage your quotes", path: "/quotations" },
    { icon: Calendar, label: "Daily Work", description: "Tasks and reminders", path: "/daily-work" },
    { icon: FolderOpen, label: "Documents", description: "Stored invoices & quotes", path: "/documents" },
    { icon: Building2, label: "Business Profile", description: "Edit your business info", path: "/business-setup" },
    { icon: Settings, label: "Settings", description: "App preferences", path: "/settings" },
    { icon: HelpCircle, label: "Help & Support", description: "Get assistance", path: "/help" },
  ];

  return (
    <AppLayout title="More">
      <div className="space-y-4 p-4">
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <item.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-4 p-4 text-left text-destructive transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Logout</p>
                <p className="text-sm text-muted-foreground">Sign out of your account</p>
              </div>
            </button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Vento v1.0.0</p>
      </div>
    </AppLayout>
  );
}
