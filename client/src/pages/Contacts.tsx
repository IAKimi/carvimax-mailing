import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Plus, Search, ChevronDown, ChevronUp, Database, Trash2, Pencil, FileUp, FileWarning, Check, X, Loader2, UserPlus, AlertCircle, ArrowRight } from "lucide-react";
import { useTutorial } from "@/contexts/TutorialContext";
import { TutorialHighlight } from "@/components/TutorialHighlight";
import { TutorialTip } from "@/components/TutorialTip";
import * as XLSX from "xlsx";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactDatabase as ContactDatabaseType, Contact } from "@shared/schema";

interface EditingContact {
  name: string;
  email: string;
  position: string;
  segment: string;
}

interface NewContactForm {
  name: string;
  email: string;
  position: string;
  segment: string;
}

const EMPTY_NEW_CONTACT: NewContactForm = { name: "", email: "", position: "", segment: "" };

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const sep = headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(sep).map(h => h.trim().replace(/^["']|["']$/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map(v => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
    if (Object.values(row).some(v => v)) rows.push(row);
  }
  return rows;
}

function parseXLSX(data: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return jsonData.map(row => {
    const mapped: Record<string, string> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = String(key).replace(/^\uFEFF/, '').trim();
      mapped[cleanKey] = String(row[key] ?? "").trim();
    }
    return mapped;
  }).filter(row => Object.values(row).some(v => v));
}

function ContactsTable({ db, isEditMode, editModeDbId, toggleEditMode, toast }: {
  db: ContactDatabaseType;
  isEditMode: boolean;
  editModeDbId: number | null;
  toggleEditMode: (id: number) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRows, setEditingRows] = useState<Record<number, EditingContact>>({});
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState<NewContactForm>(EMPTY_NEW_CONTACT);
  const [deletingContactId, setDeletingContactId] = useState<number | null>(null);
  const [importColumnError, setImportColumnError] = useState<string[] | null>(null);
  const csvAppendRef = useRef<HTMLInputElement>(null);
  const csvOverwriteRef = useRef<HTMLInputElement>(null);

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contact-databases", db.id, "contacts"],
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: number; data: Partial<EditingContact> }) => {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases", db.id, "contacts"] });
      toast({ title: "Contacto actualizado", description: "Los cambios han sido guardados." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el contacto.", variant: "destructive" });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: NewContactForm) => {
      await apiRequest("POST", `/api/contact-databases/${db.id}/contacts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases", db.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases"] });
      setNewContact(EMPTY_NEW_CONTACT);
      setAddingContact(false);
      toast({ title: "Contacto agregado", description: "El contacto ha sido agregado correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo agregar el contacto.", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await apiRequest("DELETE", `/api/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases", db.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases"] });
      setDeletingContactId(null);
      toast({ title: "Contacto eliminado", description: "El contacto ha sido eliminado correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el contacto.", variant: "destructive" });
    },
  });

  const csvImportMutation = useMutation({
    mutationFn: async ({ contacts: rows, mode }: { contacts: Record<string, string>[]; mode: string }) => {
      setImportColumnError(null);
      const res = await apiRequest("POST", `/api/contact-databases/${db.id}/import`, { contacts: rows, mode });
      return res.json();
    },
    onSuccess: (result: any) => {
      setImportColumnError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases", db.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases"] });
      const parts = [`${result.imported} contacto(s) importado(s).`];
      if (result.duplicates > 0) parts.push(`${result.duplicates} duplicado(s) omitido(s).`);
      if (result.errors?.length > 0) parts.push(`${result.errors.length} correo(s) con formato inválido omitido(s).`);
      toast({ title: "Importación completada", description: parts.join(" ") });
    },
    onError: (err: Error) => {
      const marker = "Las columnas detectadas son:";
      const markerIdx = err.message.indexOf(marker);
      if (markerIdx !== -1) {
        const rest = err.message.slice(markerIdx + marker.length).trim();
        const colsPart = rest.split(/\.\s/)[0];
        const cols = colsPart.split(/",\s*"/).map((c) => c.replace(/^"|"$/g, "").trim()).filter(Boolean);
        if (cols.length > 0) {
          setImportColumnError(cols);
          toast({ title: "Columna de correo no encontrada", description: "Revisá las columnas detectadas abajo.", variant: "destructive" });
          return;
        }
      }
      toast({ title: "Error de importación", description: err.message, variant: "destructive" });
    },
  });

  function handleImportFile(file: File, mode: string) {
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let rows: Record<string, string>[];
        if (isXlsx) {
          rows = parseXLSX(reader.result as ArrayBuffer);
        } else {
          rows = parseCSV(reader.result as string);
        }
        if (rows.length === 0) {
          toast({ title: "Archivo vacío", description: "El archivo no contiene filas válidas.", variant: "destructive" });
          return;
        }
        csvImportMutation.mutate({ contacts: rows, mode });
      } catch (err: any) {
        toast({ title: "Archivo inválido", description: "No se pudo leer el archivo. Verifique que sea un CSV o Excel válido.", variant: "destructive" });
      }
    };
    reader.onerror = () => {
      toast({ title: "Error de lectura", description: "No se pudo leer el archivo.", variant: "destructive" });
    };
    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
  }

  const filtered = searchTerm
    ? contacts.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : contacts;

  function startEditRow(contact: Contact) {
    setEditingRows((prev) => ({
      ...prev,
      [contact.id]: {
        name: contact.name || "",
        email: contact.email,
        position: (contact as any).position || "",
        segment: contact.segment || "",
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

  function saveEditRow(contactId: number) {
    const edited = editingRows[contactId];
    if (!edited) return;
    updateContactMutation.mutate({ contactId, data: edited });
    cancelEditRow(contactId);
  }

  function updateEditingField(contactId: number, field: keyof EditingContact, value: string) {
    setEditingRows((prev) => ({
      ...prev,
      [contactId]: { ...prev[contactId], [field]: value },
    }));
  }

  function handleAddContact() {
    if (!newContact.email.trim()) return;
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(newContact.email.trim())) {
      toast({ title: "Email inválido", description: "Por favor ingrese un email con formato válido.", variant: "destructive" });
      return;
    }
    addContactMutation.mutate(newContact);
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid={`input-search-db-${db.id}`}
            placeholder="Buscar por nombre o correo..."
            className="pl-9 border-0 bg-muted/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
        {isEditMode && (
          <Button
            data-testid={`button-add-contact-${db.id}`}
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setAddingContact(!addingContact)}
          >
            <UserPlus className="w-4 h-4" />
            Agregar Contacto
          </Button>
        )}
        <TutorialHighlight fieldId="import-contacts">
          <Button
            data-testid={`button-add-csv-${db.id}`}
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => csvAppendRef.current?.click()}
            disabled={csvImportMutation.isPending}
          >
            {csvImportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            Añadir a Base de Datos
          </Button>
        </TutorialHighlight>
        <input
          ref={csvAppendRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file, "append");
            e.target.value = "";
          }}
        />
        <Button
          data-testid={`button-overwrite-csv-${db.id}`}
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            if (window.confirm("¿Está seguro? Esta acción reemplazará todos los contactos existentes con los del archivo.")) {
              csvOverwriteRef.current?.click();
            }
          }}
          disabled={csvImportMutation.isPending}
        >
          {csvImportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileWarning className="w-4 h-4" />}
          Sobreescribir Base de Datos
        </Button>
        <input
          ref={csvOverwriteRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file, "overwrite");
            e.target.value = "";
          }}
        />
      </div>

      {importColumnError && (
        <div
          data-testid="import-column-error-panel"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 flex gap-3"
        >
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-destructive text-sm">No se encontró una columna de correo electrónico</p>
            <p className="text-sm text-muted-foreground mt-1">
              El archivo tiene las siguientes columnas detectadas:
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {importColumnError.map((col) => (
                <li
                  key={col}
                  data-testid={`import-detected-column-${col}`}
                  className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground border border-border"
                >
                  {col}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Renombrá la columna de correo como <span className="font-semibold text-foreground">email</span> o <span className="font-semibold text-foreground">correo</span> en tu archivo y volvé a importar.
            </p>
          </div>
          <button
            data-testid="button-dismiss-import-column-error"
            onClick={() => setImportColumnError(null)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Contacto</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Correo Electrónico</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cargo</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Segmento</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">
                  {isEditMode ? "Acciones" : "Agregado"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {addingContact && (
                <tr data-testid={`row-new-contact-${db.id}`} className="bg-muted/20">
                  <td className="px-4 py-2">
                    <Input
                      data-testid={`input-new-contact-name-${db.id}`}
                      placeholder="Nombre"
                      maxLength={200}
                      value={newContact.name}
                      onChange={(e) => setNewContact((prev) => ({ ...prev, name: e.target.value }))}
                      className="text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      data-testid={`input-new-contact-email-${db.id}`}
                      type="email"
                      placeholder="correo@ejemplo.com"
                      maxLength={255}
                      value={newContact.email}
                      onChange={(e) => setNewContact((prev) => ({ ...prev, email: e.target.value }))}
                      className="text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      data-testid={`input-new-contact-position-${db.id}`}
                      placeholder="Cargo"
                      maxLength={100}
                      value={newContact.position}
                      onChange={(e) => setNewContact((prev) => ({ ...prev, position: e.target.value }))}
                      className="text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      data-testid={`input-new-contact-segment-${db.id}`}
                      placeholder="Segmento"
                      maxLength={100}
                      value={newContact.segment}
                      onChange={(e) => setNewContact((prev) => ({ ...prev, segment: e.target.value }))}
                      className="text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        data-testid={`button-save-new-contact-${db.id}`}
                        variant="ghost"
                        size="icon"
                        className="text-green-600"
                        onClick={handleAddContact}
                        disabled={!newContact.email.trim() || addContactMutation.isPending}
                      >
                        {addContactMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button
                        data-testid={`button-cancel-new-contact-${db.id}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setAddingContact(false);
                          setNewContact(EMPTY_NEW_CONTACT);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {contactsLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
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
                          <Input
                            data-testid={`input-edit-name-${contact.id}`}
                            maxLength={200}
                            value={editData.name}
                            onChange={(e) => updateEditingField(contact.id, "name", e.target.value)}
                            className="text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            data-testid={`input-edit-email-${contact.id}`}
                            type="email"
                            maxLength={255}
                            value={editData.email}
                            onChange={(e) => updateEditingField(contact.id, "email", e.target.value)}
                            className="text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            data-testid={`input-edit-position-${contact.id}`}
                            maxLength={100}
                            value={editData.position}
                            onChange={(e) => updateEditingField(contact.id, "position", e.target.value)}
                            className="text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            data-testid={`input-edit-segment-${contact.id}`}
                            maxLength={100}
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
                              onClick={() => saveEditRow(contact.id)}
                              disabled={updateContactMutation.isPending}
                            >
                              {updateContactMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
                        <div className="font-semibold">{contact.name || <span className="text-muted-foreground/60 italic text-xs">No encontrado</span>}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{contact.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(contact as any).position || <span className="text-muted-foreground/60 italic text-xs">No encontrado</span>}</td>
                      <td className="px-4 py-3">
                        {contact.segment ? (
                          <Badge variant="secondary" className="text-xs">{contact.segment}</Badge>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-xs">No encontrado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {isEditMode ? (
                          <div className="flex items-center justify-end gap-1">
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
                            <Button
                              data-testid={`button-delete-contact-${contact.id}`}
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingContactId(contact.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          contact.createdAt ? new Date(contact.createdAt).toLocaleDateString("es") : "-"
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

      <AlertDialog open={deletingContactId !== null} onOpenChange={(open) => { if (!open) setDeletingContactId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const c = contacts.find(ct => ct.id === deletingContactId);
                return c ? `Se eliminará "${c.name || c.email}" de esta base de datos. Esta acción no se puede deshacer.` : "Esta acción no se puede deshacer.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-contact">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-contact"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingContactId) deleteContactMutation.mutate(deletingContactId);
              }}
              disabled={deleteContactMutation.isPending}
            >
              {deleteContactMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Contacts() {
  const [, setLocation] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newDbName, setNewDbName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editModeDbId, setEditModeDbId] = useState<number | null>(null);
  const { toast } = useToast();
  const { setCurrentSection, tutorialActive } = useTutorial();

  useEffect(() => {
    setCurrentSection("contacts");
  }, [setCurrentSection]);

  const { data: databases = [], isLoading: databasesLoading } = useQuery<ContactDatabaseType[]>({
    queryKey: ["/api/contact-databases"],
  });

  const { data: existingCampaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns"],
  });

  const createDbMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/contact-databases", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      setNewDbName("");
      setDialogOpen(false);
      toast({ title: "Base de datos creada", description: "La base de datos ha sido creada correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la base de datos.", variant: "destructive" });
    },
  });

  const deleteDbMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/contact-databases/${id}`);
      return res;
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-databases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
      if (expandedId === deletedId) setExpandedId(null);
      if (editModeDbId === deletedId) setEditModeDbId(null);
      toast({ title: "Base de datos eliminada", description: "La base de datos ha sido eliminada correctamente." });
    },
    onError: (err: any) => {
      let msg = "No se pudo eliminar la base de datos.";
      try {
        const raw = err?.message || "";
        const jsonPart = raw.substring(raw.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.message) msg = parsed.message;
      } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  function handleCreateDatabase() {
    if (!newDbName.trim()) return;
    createDbMutation.mutate(newDbName.trim());
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function toggleEditMode(dbId: number) {
    if (editModeDbId === dbId) {
      setEditModeDbId(null);
    } else {
      setEditModeDbId(dbId);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold" data-testid="text-page-title">Base de Datos</h1>
            <p className="text-muted-foreground mt-1">Carga y organiza tus listas de contactos. Importa archivos CSV o Excel para segmentar y enviar correos personalizados.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <TutorialHighlight fieldId="new-database">
              <DialogTrigger asChild>
                <Button data-testid="button-new-database" className="rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Nueva Base de Datos
                </Button>
              </DialogTrigger>
            </TutorialHighlight>
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
                    maxLength={100}
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
                  disabled={!newDbName.trim() || createDbMutation.isPending}
                >
                  {createDbMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <TutorialHighlight fieldId="contacts-overview">
        <div className="space-y-3">
          {databasesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-visible">
                  <div className="flex items-center gap-3 p-4">
                    <Skeleton className="w-9 h-9 rounded-md" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            databases.map((db) => {
              const isExpanded = expandedId === db.id;
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
                        <Database className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold" data-testid={`text-db-name-${db.id}`}>{db.name}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button data-testid={`button-delete-db-${db.id}`} variant="ghost" size="icon" className="text-red-500 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar base de datos</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acci\u00f3n eliminar\u00e1 la base de datos "{db.name}" y todos sus contactos. No se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            data-testid={`button-confirm-delete-db-${db.id}`}
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteDbMutation.mutate(db.id)}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {isExpanded && (
                    <ContactsTable
                      db={db}
                      isEditMode={isEditMode}
                      editModeDbId={editModeDbId}
                      toggleEditMode={toggleEditMode}
                      toast={toast}
                    />
                  )}
                </Card>
              );
            })
          )}
          {!databasesLoading && databases.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No tiene bases de datos a\u00fan</p>
              <p className="text-sm mt-1">Cree su primera base de datos para comenzar a organizar sus contactos.</p>
            </div>
          )}
        </div>
        </TutorialHighlight>

        {tutorialActive && <TutorialTip />}

        <div data-testid="disclaimer-csv-format" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700 font-medium">
            Tu archivo debe contener al menos las columnas <strong>"nombre"</strong> y <strong>"correo"</strong>. Los demás campos serán ignorados.
          </p>
        </div>

        {databases.length > 0 && existingCampaigns.length === 0 && (
          <div className="flex justify-end mt-6">
            <Button
              data-testid="button-next-to-calendar"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
                setLocation("/calendar");
              }}
              className="rounded-xl gap-2 bg-[#002073] hover:bg-[#001a5e] text-white px-6"
            >
              Ir a Calendario
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
