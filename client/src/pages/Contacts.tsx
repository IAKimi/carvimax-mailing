import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Upload, Plus, Search, ChevronDown, ChevronUp, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Contact {
  id: number;
  name: string;
  email: string;
  country: string;
  segment: string;
  createdAt: string;
}

interface ContactDatabase {
  id: number;
  name: string;
  contacts: Contact[];
}

const MOCK_DATABASES: ContactDatabase[] = [
  {
    id: 1,
    name: "Clientes Premium",
    contacts: [
      { id: 1, name: "Juan Pérez", email: "juan@empresa.com", country: "MX", segment: "Premium", createdAt: new Date().toISOString() },
      { id: 2, name: "Ana Rodríguez", email: "ana@corp.mx", country: "MX", segment: "Premium", createdAt: new Date().toISOString() },
      { id: 3, name: "Carlos López", email: "carlos@tech.co", country: "ES", segment: "Premium", createdAt: new Date().toISOString() },
    ],
  },
  {
    id: 2,
    name: "Newsletter General",
    contacts: [
      { id: 4, name: "María Gómez", email: "maria@gmail.com", country: "CO", segment: "Standard", createdAt: new Date().toISOString() },
      { id: 5, name: "Pedro Sánchez", email: "pedro@outlook.com", country: "AR", segment: "Standard", createdAt: new Date().toISOString() },
    ],
  },
  {
    id: 3,
    name: "Leads 2026",
    contacts: [
      { id: 6, name: "Lucía Fernández", email: "lucia@startup.io", country: "CL", segment: "Lead", createdAt: new Date().toISOString() },
    ],
  },
];

export default function Contacts() {
  const [databases, setDatabases] = useState<ContactDatabase[]>(MOCK_DATABASES);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [newDbName, setNewDbName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleCreateDatabase() {
    if (!newDbName.trim()) return;
    const newDb: ContactDatabase = {
      id: Date.now(),
      name: newDbName.trim(),
      contacts: [],
    };
    setDatabases((prev) => [...prev, newDb]);
    setNewDbName("");
    setDialogOpen(false);
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function getFilteredContacts(db: ContactDatabase) {
    const term = (searchTerms[db.id] || "").toLowerCase();
    if (!term) return db.contacts;
    return db.contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold" data-testid="text-page-title">Base de Datos</h1>
            <p className="text-muted-foreground mt-1">Gestione sus bases de datos y contactos.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-database" className="rounded-xl gap-2">
                <Plus className="w-4 h-4" />
                Nueva Base de Datos
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Base de Datos</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="db-name">Nombre de la base de datos</Label>
                  <Input
                    id="db-name"
                    data-testid="input-new-db-name"
                    placeholder="Ej: Clientes VIP, Leads Q1..."
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateDatabase();
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  data-testid="button-confirm-create-db"
                  onClick={handleCreateDatabase}
                  disabled={!newDbName.trim()}
                >
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {databases.map((db) => {
            const isExpanded = expandedId === db.id;
            const filtered = getFilteredContacts(db);

            return (
              <Card key={db.id} data-testid={`card-database-${db.id}`} className="overflow-visible">
                <button
                  data-testid={`button-expand-db-${db.id}`}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left"
                  onClick={() => toggleExpand(db.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Database className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold" data-testid={`text-db-name-${db.id}`}>{db.name}</span>
                      <span className="ml-2">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-db-count-${db.id}`}>
                          {db.contacts.length} contacto{db.contacts.length !== 1 ? "s" : ""}
                        </Badge>
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[200px] relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          data-testid={`input-search-db-${db.id}`}
                          placeholder="Buscar por nombre o correo..."
                          className="pl-9 border-0 bg-muted/50"
                          value={searchTerms[db.id] || ""}
                          onChange={(e) =>
                            setSearchTerms((prev) => ({ ...prev, [db.id]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        data-testid={`button-import-csv-${db.id}`}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Importar CSV
                      </Button>
                    </div>

                    <div className="rounded-md border border-border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border">
                              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Contacto</th>
                              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">País</th>
                              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Segmento</th>
                              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Agregado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filtered.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">
                                  No se encontraron contactos.
                                </td>
                              </tr>
                            ) : (
                              filtered.map((contact) => (
                                <tr key={contact.id} data-testid={`row-contact-${contact.id}`} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="font-semibold">{contact.name}</div>
                                    <div className="text-sm text-muted-foreground">{contact.email}</div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">{contact.country || "-"}</td>
                                  <td className="px-4 py-3">
                                    <Badge variant="secondary" className="text-xs">
                                      {contact.segment || "General"}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">
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
                )}
              </Card>
            );
          })}

          {databases.length === 0 && (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-databases">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No hay bases de datos</p>
              <p className="text-sm mt-1">Cree su primera base de datos para comenzar a organizar sus contactos.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
