import { useState } from 'react';
import { AppLayout, FloatingActionButton } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Users, Search, Filter, UserPlus, Phone, Mail, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { Client } from '@/types/database';

export default function Clients() {
  const navigate = useNavigate();
  const { clients, isLoading } = useClients();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (client.phone?.includes(searchQuery) ?? false)
  );

  const ClientCard = ({ client }: { client: Client }) => (
    <div
      onClick={() => navigate(`/clients/${client.id}`)}
      className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="text-lg font-semibold text-primary">
          {client.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        <p className="font-medium">{client.name}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {client.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {client.phone}
            </span>
          )}
          {client.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" />
              {client.email}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout title="Clients">
      <div className="space-y-4 p-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search clients..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Client List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredClients.length > 0 ? (
              <div className="space-y-3 p-4">
                {filteredClients.map(client => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="mb-4 h-16 w-16 text-muted-foreground/50" />
                <h3 className="mb-1 text-lg font-semibold">No clients yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Add your first client to start creating invoices
                </p>
                <Button onClick={() => navigate('/clients/new')}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FloatingActionButton 
        onClick={() => navigate('/clients/new')}
        icon={<UserPlus className="h-6 w-6" />}
        label="Add new client"
      />
    </AppLayout>
  );
}
