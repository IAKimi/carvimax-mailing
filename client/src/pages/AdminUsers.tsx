import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Users, Search, Pencil, KeyRound, Eye, Trash2, Loader2, Shield, BarChart3,
  Mail, CalendarDays, LayoutTemplate, Database, UserX
} from "lucide-react";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";

type UserWithStats = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  role: string;
  createdAt: string | null;
  stats: { campaigns: number; templates: number; contacts: number; databases: number };
};

type AdminStats = {
  totalUsers: number;
  totalCampaigns: number;
  totalCampaignsByStatus: Record<string, number>;
  totalTemplates: number;
  totalContacts: number;
  totalDatabases: number;
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [editUser, setEditUser] = useState<UserWithStats | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", company: "" });
  const [resetUser, setResetUser] = useState<UserWithStats | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<UserWithStats | null>(null);

  const { data: currentUser, isLoading: authLoading } = useQuery<{ id: number; role: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const isAdmin = currentUser?.role === "admin";

  const { data: stats } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"], enabled: isAdmin === true });
  const { data: allUsers = [], isLoading } = useQuery<UserWithStats[]>({ queryKey: ["/api/admin/users"], enabled: isAdmin === true });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditUser(null);
      toast({ title: "Usuario actualizado", description: "Los datos del usuario han sido actualizados." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/reset-password`, { newPassword });
      return res.json();
    },
    onSuccess: () => {
      setResetUser(null);
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Contraseña restablecida", description: "La nueva contraseña ha sido configurada." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteUser(null);
      toast({ title: "Usuario eliminado", description: "El usuario y todos sus datos han sido eliminados." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/impersonate/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/";
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = searchTerm
    ? allUsers.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.company || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allUsers;

  if (!authLoading && !isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">Acceso Denegado</h2>
            <p className="text-muted-foreground">No tiene permisos para acceder a esta sección.</p>
          </div>
        </div>
      </Layout>
    );
  }

  function openEditDialog(user: UserWithStats) {
    setEditForm({ name: user.name, email: user.email, company: user.company || "" });
    setEditUser(user);
  }

  function handleSaveEdit() {
    if (!editUser) return;
    updateUserMutation.mutate({ id: editUser.id, data: editForm });
  }

  function handleResetPassword() {
    if (!resetUser) return;
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    resetPasswordMutation.mutate({ id: resetUser.id, newPassword });
  }

  const statusLabels: Record<string, string> = {
    draft: "Borradores",
    scheduled: "Programados",
    sent: "Enviados",
    cancelled: "Cancelados",
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 data-testid="heading-admin" className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#002073]" />
            Panel de Administración
          </h1>
          <p className="text-muted-foreground mt-1">Gestión de usuarios y estadísticas de la plataforma</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="p-4 text-center" data-testid="stat-users">
              <Users className="w-5 h-5 mx-auto text-[#002073] mb-1" />
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <div className="text-xs text-muted-foreground">Usuarios</div>
            </Card>
            <Card className="p-4 text-center" data-testid="stat-campaigns">
              <CalendarDays className="w-5 h-5 mx-auto text-[#002073] mb-1" />
              <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
              <div className="text-xs text-muted-foreground">Campañas</div>
            </Card>
            <Card className="p-4 text-center" data-testid="stat-sent">
              <Mail className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
              <div className="text-2xl font-bold">{stats.totalCampaignsByStatus?.sent || 0}</div>
              <div className="text-xs text-muted-foreground">Enviados</div>
            </Card>
            <Card className="p-4 text-center" data-testid="stat-templates">
              <LayoutTemplate className="w-5 h-5 mx-auto text-[#002073] mb-1" />
              <div className="text-2xl font-bold">{stats.totalTemplates}</div>
              <div className="text-xs text-muted-foreground">Plantillas</div>
            </Card>
            <Card className="p-4 text-center" data-testid="stat-contacts">
              <UserX className="w-5 h-5 mx-auto text-[#002073] mb-1" />
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <div className="text-xs text-muted-foreground">Contactos</div>
            </Card>
            <Card className="p-4 text-center" data-testid="stat-databases">
              <Database className="w-5 h-5 mx-auto text-[#002073] mb-1" />
              <div className="text-2xl font-bold">{stats.totalDatabases}</div>
              <div className="text-xs text-muted-foreground">Bases de Datos</div>
            </Card>
          </div>
        )}

        {stats && Object.keys(stats.totalCampaignsByStatus || {}).length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#002073]" />
              <span className="font-semibold text-sm">Campañas por Estado</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.totalCampaignsByStatus).map(([status, cnt]) => (
                <Badge key={status} variant="secondary" className="text-sm py-1 px-3">
                  {statusLabels[status] || status}: {cnt}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuarios ({filtered.length})
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-search-users"
                placeholder="Buscar usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold">Correo</th>
                    <th className="text-left px-4 py-3 font-semibold">Empresa</th>
                    <th className="text-left px-4 py-3 font-semibold">Rol</th>
                    <th className="text-center px-4 py-3 font-semibold">Campañas</th>
                    <th className="text-center px-4 py-3 font-semibold">Plantillas</th>
                    <th className="text-center px-4 py-3 font-semibold">Contactos</th>
                    <th className="text-right px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} data-testid={`row-user-${user.id}`} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{user.name}</div>
                        {user.createdAt && (
                          <div className="text-[10px] text-muted-foreground">
                            Registrado: {new Date(user.createdAt).toLocaleDateString("es-ES")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.company || <span className="italic text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-3">
                        {user.role === "admin" ? (
                          <Badge className="bg-[#002073] text-white text-xs"><Shield className="w-3 h-3 mr-1" />Admin</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Usuario</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{user.stats.campaigns}</td>
                      <td className="px-4 py-3 text-center font-medium">{user.stats.templates}</td>
                      <td className="px-4 py-3 text-center font-medium">{user.stats.contacts}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            data-testid={`button-edit-user-${user.id}`}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(user)}
                            title="Editar usuario"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            data-testid={`button-reset-password-${user.id}`}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setResetUser(user); setNewPassword(""); setConfirmPassword(""); }}
                            title="Restablecer contraseña"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          {user.role !== "admin" && (
                            <>
                              <Button
                                data-testid={`button-impersonate-${user.id}`}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#002073]"
                                onClick={() => impersonateMutation.mutate(user.id)}
                                disabled={impersonateMutation.isPending}
                                title="Ver como este usuario"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                data-testid={`button-delete-user-${user.id}`}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteUser(user)}
                                title="Eliminar usuario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                        {searchTerm ? "No se encontraron usuarios con ese criterio de búsqueda." : "No hay usuarios registrados."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl" data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modifica los datos de {editUser?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                data-testid="input-edit-user-name"
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Correo Electrónico</Label>
              <Input
                data-testid="input-edit-user-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Input
                data-testid="input-edit-user-company"
                value={editForm.company}
                onChange={(e) => setEditForm(f => ({ ...f, company: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button
              data-testid="button-save-edit-user"
              onClick={handleSaveEdit}
              disabled={updateUserMutation.isPending}
              className="bg-[#002073] hover:bg-[#001a5e] text-white"
            >
              {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={(open) => { if (!open) setResetUser(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl" data-testid="dialog-reset-password">
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>Establecer nueva contraseña para {resetUser?.name} ({resetUser?.email})</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nueva Contraseña</Label>
              <Input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-1">
              <Label>Confirmar Contraseña</Label>
              <Input
                data-testid="input-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita la contraseña"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button>
            <Button
              data-testid="button-confirm-reset-password"
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending || newPassword.length < 6 || newPassword !== confirmPassword}
              className="bg-[#002073] hover:bg-[#001a5e] text-white"
            >
              {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl" data-testid="dialog-delete-user">
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar Usuario</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar a <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
              Esta acción eliminará permanentemente al usuario y todos sus datos: campañas, plantillas, contactos e identidad de marca.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button
              data-testid="button-confirm-delete-user"
              variant="destructive"
              onClick={() => deleteUser && deleteUserMutation.mutate(deleteUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Eliminar Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
