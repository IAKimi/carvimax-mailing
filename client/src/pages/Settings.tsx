import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Eye, EyeOff, CheckCircle2, XCircle, ExternalLink, Zap } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentPreferences, EmailProvider } from "@shared/schema";

interface UserProfile {
  name: string;
  email: string;
  company: string | null;
}

const profileSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede exceder 200 caracteres"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: z
    .string()
    .min(6, "Mínimo 6 caracteres")
    .max(128, "Máximo 128 caracteres")
    .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
    .regex(/[0-9]/, "Debe tener al menos un número"),
  confirmPassword: z.string().min(1, "Confirma tu nueva contraseña"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

const PREF_LABELS: Array<{ key: keyof Omit<ContentPreferences, "id" | "userId" | "updatedAt">; label: string; description: string }> = [
  { key: "includeEmojis", label: "Incluir emojis", description: "Añade emojis para mayor expresividad" },
  { key: "includeCta", label: "Incluir botón CTA", description: "Botón de llamada a la acción en los correos" },
  { key: "includeSignature", label: "Incluir firma", description: "Añade la firma al final del correo" },
  { key: "formalTone", label: "Tono formal", description: "Usa un tono más corporativo y formal" },
  { key: "includeWebsite", label: "Incluir sitio web", description: "Agrega el enlace a tu sitio web" },
  { key: "includeWhatsapp", label: "Incluir WhatsApp", description: "Agrega tu número de WhatsApp" },
];

export default function Settings() {
  const { toast } = useToast();

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  const { data: prefs, isLoading: prefsLoading } = useQuery<ContentPreferences>({
    queryKey: ["/api/user/content-preferences"],
  });

  const { data: providers } = useQuery<EmailProvider[]>({
    queryKey: ["/api/email-providers"],
  });

  const defaultProvider = providers?.find((p) => p.isDefault) ?? providers?.[0] ?? null;

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { name: profile?.name ?? "" },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const profileMutation = useMutation({
    mutationFn: (data: ProfileFormValues) =>
      apiRequest("PUT", "/api/user/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Perfil actualizado", description: "Tu nombre se guardó correctamente." });
    },
    onError: async (err: unknown) => {
      let msg = "Error al actualizar el perfil.";
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({}));
        msg = (body as { message?: string }).message ?? msg;
      }
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: PasswordFormValues) =>
      apiRequest("PUT", "/api/user/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Contraseña actualizada", description: "Tu contraseña se cambió correctamente." });
    },
    onError: async (err: unknown) => {
      let msg = "Error al actualizar la contraseña.";
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({}));
        msg = (body as { message?: string }).message ?? msg;
      }
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const prefsMutation = useMutation({
    mutationFn: (data: Partial<Omit<ContentPreferences, "id" | "userId" | "updatedAt">>) =>
      apiRequest("PUT", "/api/user/content-preferences", data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/user/content-preferences"] });
      const prev = queryClient.getQueryData<ContentPreferences>(["/api/user/content-preferences"]);
      if (prev) {
        queryClient.setQueryData(["/api/user/content-preferences"], { ...prev, ...newData });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["/api/user/content-preferences"], ctx.prev);
      }
      toast({ title: "Error", description: "No se pudo guardar la preferencia.", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/content-preferences"] });
    },
  });

  const newPwd = passwordForm.watch("newPassword");
  const confirmPwd = passwordForm.watch("confirmPassword");
  const passwordsMatch = confirmPwd.length > 0 && newPwd === confirmPwd;
  const passwordsMismatch = confirmPwd.length > 0 && newPwd !== confirmPwd;

  const isProfileDirty = profileForm.formState.isDirty;

  const providerName = defaultProvider
    ? defaultProvider.provider === "brevo"
      ? "Brevo"
      : "Mailchimp"
    : null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-settings">Configuración</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona tu perfil, seguridad y preferencias de contenido.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Perfil ── */}
          <Card>
            <CardHeader>
              <CardTitle>Perfil</CardTitle>
              <CardDescription>Actualiza tu nombre de usuario.</CardDescription>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
                  <div className="h-9 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-1/3 mt-2" />
                  <div className="h-9 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                <Form {...profileForm}>
                  <form
                    onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))}
                    className="space-y-4"
                  >
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-profile-name"
                              placeholder="Tu nombre"
                              autoComplete="name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-1">
                      <Label>Correo electrónico</Label>
                      <Input
                        value={profile?.email ?? ""}
                        readOnly
                        disabled
                        data-testid="input-profile-email"
                        className="bg-muted/50 cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">El correo no se puede cambiar.</p>
                    </div>
                    {profile?.company && (
                      <div className="space-y-1">
                        <Label>Empresa</Label>
                        <Input
                          value={profile.company}
                          readOnly
                          disabled
                          data-testid="input-profile-company"
                          className="bg-muted/50 cursor-not-allowed"
                        />
                      </div>
                    )}
                    <Button
                      type="submit"
                      disabled={!isProfileDirty || profileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {profileMutation.isPending ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          {/* ── Contraseña ── */}
          <Card>
            <CardHeader>
              <CardTitle>Contraseña</CardTitle>
              <CardDescription>Cambia tu contraseña de acceso.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña actual</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showCurrent ? "text" : "password"}
                              data-testid="input-current-password"
                              placeholder="••••••••"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrent((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              data-testid="toggle-show-current-password"
                            >
                              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nueva contraseña</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showNew ? "text" : "password"}
                              data-testid="input-new-password"
                              placeholder="••••••••"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNew((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              data-testid="toggle-show-new-password"
                            >
                              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar nueva contraseña</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showConfirm ? "text" : "password"}
                              data-testid="input-confirm-password"
                              placeholder="••••••••"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              data-testid="toggle-show-confirm-password"
                            >
                              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                            {passwordsMatch && (
                              <CheckCircle2 size={16} className="absolute right-9 top-1/2 -translate-y-1/2 text-green-500" />
                            )}
                            {passwordsMismatch && (
                              <XCircle size={16} className="absolute right-9 top-1/2 -translate-y-1/2 text-destructive" />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    data-testid="button-save-password"
                  >
                    {passwordMutation.isPending ? "Actualizando..." : "Cambiar contraseña"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* ── Preferencias de contenido ── */}
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de contenido</CardTitle>
              <CardDescription>Personaliza cómo la IA genera tus correos.</CardDescription>
            </CardHeader>
            <CardContent>
              {prefsLoading ? (
                <div className="space-y-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="h-4 bg-muted rounded animate-pulse w-2/5" />
                        <div className="h-3 bg-muted rounded animate-pulse w-3/5" />
                      </div>
                      <div className="h-6 w-10 bg-muted rounded-full animate-pulse ml-4" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {PREF_LABELS.map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <Label htmlFor={`pref-${key}`} className="text-sm font-medium leading-none cursor-pointer">
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <Switch
                        id={`pref-${key}`}
                        checked={prefs ? (prefs[key] as boolean) : false}
                        onCheckedChange={(checked) =>
                          prefsMutation.mutate({ [key]: checked })
                        }
                        data-testid={`toggle-pref-${key}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Proveedor activo ── */}
          <Card>
            <CardHeader>
              <CardTitle>Proveedor activo</CardTitle>
              <CardDescription>Tu configuración de envío de correos.</CardDescription>
            </CardHeader>
            <CardContent>
              {!defaultProvider ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                  <Zap className="text-muted-foreground" size={32} />
                  <p className="text-sm text-muted-foreground">No tienes ningún proveedor configurado.</p>
                  <Link href="/email-provider">
                    <Button variant="outline" size="sm" data-testid="link-configure-provider">
                      Configurar proveedor
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Zap size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" data-testid="text-provider-name">{providerName}</p>
                      <p className="text-xs text-muted-foreground truncate" data-testid="text-provider-status">
                        {defaultProvider.isDefault ? "Proveedor predeterminado" : "Proveedor activo"}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Activo
                    </span>
                  </div>
                  {defaultProvider.senderName && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Nombre del remitente</p>
                      <p className="text-sm font-medium" data-testid="text-provider-sender-name">{defaultProvider.senderName}</p>
                    </div>
                  )}
                  {defaultProvider.senderEmail && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Correo del remitente</p>
                      <p className="text-sm font-medium" data-testid="text-provider-sender-email">{defaultProvider.senderEmail}</p>
                    </div>
                  )}
                  <Link href="/email-provider">
                    <Button variant="outline" size="sm" className="w-full gap-2 mt-2" data-testid="link-manage-provider">
                      <ExternalLink size={14} />
                      Gestionar proveedor
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </Layout>
  );
}
