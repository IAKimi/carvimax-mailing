import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Plus, Search, ChevronDown, ChevronUp, Database, Trash2, Pencil, FileUp, FileWarning, Check, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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

interface EditingContact {
  name: string;
  email: string;
  country: string;
  segment: string;
}

export default function Contacts() {
  const [databases, setDatabases] = useState<ContactDatabase[]>(MOCK_DATABASES);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [newDbName, setNewDbName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editModeDbId, setEditModeDbId] = useState<number | null>(null);
  const [editingRows, setEditingRows] = useState<Record<number, EditingContact>>({});
  const { toast } = useToast();

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

  function handleDeleteDatabase(dbId: number) {
    setDatabases((prev) => prev.filter((db) => db.id !== dbId));
    if (expandedId === dbId) setExpandedId(null);
    if (editModeDbId === dbId) {
      setEditModeDbId(null);
      setEditingRows({});
    }
    toast({ title: "Base de datos eliminada", description: "La base de datos ha sido eliminada correctamente." });
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function toggleEditMode(dbId: number) {
    if (editModeDbId === dbId) {
      setEditModeDbId(null);
      setEditingRows({});
    } else {
      setEditModeDbId(dbId);
      setEditingRows({});
    }
  }

  function startEditRow(contact: Contact) {
    setEditingRows((prev) => ({
      ...prev,
      [contact.id]: {
        name: contact.name,
        email: contact.email,
        country: contact.country,
        segment: contact.segment,
      },
    }));
  }

  function cancelEditRow(contactId: number) {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
  }

  function saveEditRow(dbId: number, contactId: number) {
    const edited = editingRows[contactId];
    if (!edited) return;
    setDatabases((prev) =>
      prev.map((db) => {
        if (db.id !== dbId) return db;
        return {
          ...db,
          contacts: db.contacts.map((c) => {
            if (c.id !== contactId) return c;
            return { ...c, name: edited.name, email: edited.email, country: edited.country, segment: edited.segment };
          }),
        };
      })
    );
    cancelEditRow(contactId);
    toast({ title: "Contacto actualizado", description: "Los cambios han sido guardados." });
  }

  function updateEditingField(contactId: number, field: keyof EditingContact, value: string) {
    setEditingRows((prev) => ({
      ...prev,
      [contactId]: { ...prev[contactId], [field]: value },
    }));
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
            const isEditMode = editModeDbId === db.id;

            return (
              <Card key={db.id} data-testid={`card-database-${db.id}`} className="overflow-visible">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    data-testid={`button-expand-db-${db.id}`}
                    className="flex-1 flex items-center gap-3 text-left"
                    onClick={() => toggleExpand(db.id)}
                  >
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
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          data-testid={`button-delete-db-${db.id}`}
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar base de datos</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Está seguro de que desea eliminar "{db.name}"? Esta acción no se puede deshacer y se perderán todos los contactos asociados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`button-cancel-delete-db-${db.id}`}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            data-testid={`button-confirm-delete-db-${db.id}`}
                            onClick={() => handleDeleteDatabase(db.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

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
                        data-testid={`button-edit-db-${db.id}`}
                        variant={isEditMode ? "default" : "outline"}
                        size="sm"
                        className="gap-2"
                        onClick={() => toggleEditMode(db.id)}
                      >
                        <Pencil className="w-4 h-4" />
                        {isEditMode ? "Salir de Edición" : "Editar"}
                      </Button>
                      <Button
                        data-testid={`button-add-csv-${db.id}`}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          toast({
                            title: "Añadir contactos",
                            description: "Seleccione un archivo CSV para añadir contactos a esta base de datos.",
                          })
                        }
                      >
                        <FileUp className="w-4 h-4" />
                        Añadir a Base de Datos
                      </Button>
                      <Button
                        data-testid={`button-overwrite-csv-${db.id}`}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          toast({
                            title: "Sobreescribir base de datos",
                            description: "Advertencia: Esta acción reemplazará todos los contactos existentes con los del archivo CSV seleccionado.",
                            variant: "destructive",
                          })
                        }
                      >
                        <FileWarning className="w-4 h-4" />
                        Sobreescribir Base de Datos
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
                              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">
                                {isEditMode ? "Acciones" : "Agregado"}
                              </th>
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
                              filtered.map((contact) => {
                                const isRowEditing = isEditMode && editingRows[contact.id] !== undefined;
                                const editData = editingRows[contact.id];

                                if (isRowEditing && editData) {
                                  return (
                                    <tr key={contact.id} data-testid={`row-contact-editing-${contact.id}`} className="bg-muted/20">
                                      <td className="px-4 py-2">
                                        <div className="space-y-1">
                                          <Input
                                            data-testid={`input-edit-name-${contact.id}`}
                                            value={editData.name}
                                            onChange={(e) => updateEditingField(contact.id, "name", e.target.value)}
                                            className="text-sm"
                                          />
                                          <Input
                                            data-testid={`input-edit-email-${contact.id}`}
                                            value={editData.email}
                                            onChange={(e) => updateEditingField(contact.id, "email", e.target.value)}
                                            className="text-sm"
                                          />
                                        </div>
                                      </td>
                                      <td className="px-4 py-2">
                                        <Input
                                          data-testid={`input-edit-country-${contact.id}`}
                                          value={editData.country}
                                          onChange={(e) => updateEditingField(contact.id, "country", e.target.value)}
                                          className="text-sm"
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <Input
                                          data-testid={`input-edit-segment-${contact.id}`}
                                          value={editData.segment}
                                          onChange={(e) => updateEditingField(contact.id, "segment", e.target.value)}
                                          className="text-sm"
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            data-testid={`button-save-contact-${contact.id}`}
                                            variant="ghost"
                                            size="icon"
                                            className="text-green-600"
                                            onClick={() => saveEditRow(db.id, contact.id)}
                                          >
                                            <Check className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            data-testid={`button-cancel-contact-${contact.id}`}
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => cancelEditRow(contact.id)}
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr
                                    key={contact.id}
                                    data-testid={`row-contact-${contact.id}`}
                                    className={`hover:bg-muted/30 transition-colors ${isEditMode ? "cursor-pointer" : ""}`}
                                    onClick={isEditMode ? () => startEditRow(contact) : undefined}
                                  >
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
                                      {isEditMode ? (
                                        <Button
                                          data-testid={`button-start-edit-${contact.id}`}
                                          variant="ghost"
                                          size="sm"
                                          className="gap-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            startEditRow(contact);
                                          }}
                                        >
                                          <Pencil className="w-3 h-3" />
                                          Editar
                                        </Button>
                                      ) : (
                                        new Date(contact.createdAt).toLocaleDateString("es")
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
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
