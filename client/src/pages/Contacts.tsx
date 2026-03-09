import { Layout } from "@/components/Layout";
import { useContacts } from "@/hooks/use-contacts";
import { Upload, Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Contacts() {
  const { data: contacts, isLoading } = useContacts();

  const displayContacts = contacts?.length ? contacts : [
    { id: 1, name: "Juan Pérez", email: "juan@empresa.com", country: "MX", segment: "Premium", createdAt: new Date().toISOString() },
    { id: 2, name: "María Gómez", email: "maria@gmail.com", country: "CO", segment: "Standard", createdAt: new Date().toISOString() },
    { id: 3, name: "Carlos López", email: "carlos@tech.co", country: "ES", segment: "Premium", createdAt: new Date().toISOString() },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Contactos</h1>
            <p className="text-muted-foreground mt-1">Gestione sus contactos y segmentos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-import-csv" variant="outline" className="rounded-xl gap-2">
              <Upload className="w-4 h-4" />
              Importar CSV
            </Button>
            <Button data-testid="button-add-contact" className="rounded-xl gap-2">
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-search-contacts"
              placeholder="Buscar por nombre o correo..."
              className="pl-9 rounded-xl border-0 bg-muted/50"
            />
          </div>
          <Button data-testid="button-filter-segment" variant="outline" size="sm" className="rounded-lg gap-1">
            <Filter className="w-3.5 h-3.5" /> Segmento
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Contacto</th>
                  <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">País</th>
                  <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Segmento</th>
                  <th className="px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Agregado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  [1,2,3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-muted rounded w-40 mb-1.5" /><div className="h-3 bg-muted rounded w-28" /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-muted rounded w-12" /></td>
                      <td className="px-5 py-4"><div className="h-5 bg-muted rounded-full w-20" /></td>
                      <td className="px-5 py-4 text-right"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : (
                  displayContacts.map((contact: any) => (
                    <tr key={contact.id} data-testid={`row-contact-${contact.id}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold">{contact.name || "Sin nombre"}</div>
                        <div className="text-sm text-muted-foreground">{contact.email}</div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{contact.country || "-"}</td>
                      <td className="px-5 py-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground">
                          {contact.segment || "General"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-muted-foreground">
                        {new Date(contact.createdAt).toLocaleDateString("es")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
