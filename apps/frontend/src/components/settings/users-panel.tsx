"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, KeyRound, UserX, UserCheck, Send, Ban, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useUsers,
  useInviteUser,
  useResendInvite,
  useRevokeInvite,
  useSetUserActive,
  useResetUserPassword,
  ManagedUser,
} from "@/lib/hooks/use-users";
import { useSession } from "@/lib/hooks/use-session";
import { cn } from "@/lib/utils";

function fmtLastLogin(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLES: Record<ManagedUser["status"], string> = {
  ACTIVE: "bg-success-soft text-success",
  INVITED: "bg-warning-soft text-warning",
  DEACTIVATED: "bg-secondary text-text-faint",
};
const STATUS_DOT: Record<ManagedUser["status"], string> = {
  ACTIVE: "bg-success",
  INVITED: "bg-warning",
  DEACTIVATED: "bg-text-faint",
};
const STATUS_LABEL: Record<ManagedUser["status"], string> = {
  ACTIVE: "Active",
  INVITED: "Pending",
  DEACTIVATED: "Deactivated",
};

export function UsersPanel() {
  const { data: session } = useSession();
  const { data: users, isLoading } = useUsers();
  const inviteUser = useInviteUser();
  const resendInvite = useResendInvite();
  const revokeInvite = useRevokeInvite();
  const setActive = useSetUserActive();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagedUser | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ManagedUser | null>(null);
  const [linkResult, setLinkResult] = useState<{ name: string; url: string } | null>(null);

  if (session?.user?.role !== "ADMIN") return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="font-display font-semibold text-[15.5px]">Users</div>
            <div className="text-[12.5px] text-muted-foreground">
              Who can sign in to this workspace, and what they can do.
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
            <Plus className="size-3.5" /> Invite User
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {users?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role === "ADMIN" ? "Admin" : "Reviewer"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full",
                      STATUS_STYLES[u.status],
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", STATUS_DOT[u.status])} />
                    {STATUS_LABEL[u.status]}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{fmtLastLogin(u.lastLoginAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {u.status === "INVITED" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={resendInvite.isPending}
                          onClick={() =>
                            resendInvite.mutate(u.id, {
                              onSuccess: (data) => setLinkResult({ name: u.name, url: data.inviteUrl }),
                              onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't resend invite"),
                            })
                          }
                        >
                          <Send className="size-3.5" /> Resend Invite
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-danger hover:text-danger"
                          onClick={() => setRevokeTarget(u)}
                        >
                          <Ban className="size-3.5" /> Revoke Invite
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setResetTarget(u)}>
                          <KeyRound className="size-3.5" /> Reset Password
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("gap-1.5", u.status === "ACTIVE" && "text-danger hover:text-danger")}
                          disabled={u.id === session?.user?.id}
                          onClick={() =>
                            u.status === "ACTIVE"
                              ? setDeactivateTarget(u)
                              : setActive.mutate({ id: u.id, isActive: true })
                          }
                        >
                          {u.status === "ACTIVE" ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                          {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={(data) => {
          inviteUser.mutate(data, {
            onSuccess: ({ inviteUrl }) => {
              setInviteOpen(false);
              setLinkResult({ name: data.name, url: inviteUrl });
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't create invite"),
          });
        }}
        isPending={inviteUser.isPending}
      />

      <InviteLinkDialog result={linkResult} onOpenChange={(open) => !open && setLinkResult(null)} />

      <ResetPasswordDialog user={resetTarget} onOpenChange={(open) => !open && setResetTarget(null)} />

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={`Deactivate ${deactivateTarget?.name}?`}
        description="They won't be able to sign in anymore, but their past approvals, rejections, and deletions stay attributed to them."
        confirmLabel="Deactivate"
        destructive
        isPending={setActive.isPending}
        onConfirm={() => {
          if (!deactivateTarget) return;
          setActive.mutate(
            { id: deactivateTarget.id, isActive: false },
            { onSuccess: () => setDeactivateTarget(null) },
          );
        }}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={`Revoke invite for ${revokeTarget?.name}?`}
        description="Their invite link stops working and this pending account is removed. You can invite the same or a corrected email again afterward."
        confirmLabel="Revoke Invite"
        destructive
        isPending={revokeInvite.isPending}
        onConfirm={() => {
          if (!revokeTarget) return;
          revokeInvite.mutate(revokeTarget.id, {
            onSuccess: () => {
              toast.success(`Invite for ${revokeTarget.name} revoked`);
              setRevokeTarget(null);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't revoke invite"),
          });
        }}
      />
    </Card>
  );
}

function InviteUserDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: "ADMIN" | "REVIEWER" }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "REVIEWER">("REVIEWER");

  function reset() {
    setName("");
    setEmail("");
    setRole("REVIEWER");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            They'll get a link to set their own password. Nothing is emailed automatically — you'll get the link
            to send them yourself.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Priya Nair" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Role</Label>
            <div className="flex gap-1.5">
              {(["REVIEWER", "ADMIN"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-colors",
                    role === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-secondary",
                  )}
                >
                  {r === "ADMIN" ? "Admin" : "Reviewer"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !email.trim() || isPending}
            onClick={() => onSubmit({ name: name.trim(), email: email.trim(), role })}
          >
            {isPending ? "Sending invite…" : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteLinkDialog({
  result,
  onOpenChange,
}: {
  result: { name: string; url: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={!!result}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setCopied(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite link for {result?.name}</DialogTitle>
          <DialogDescription>
            Send this to them yourself (email, Slack, whatever works) — it expires in 72 hours and only works once.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={result?.url ?? ""} className="font-mono text-[12px]" onFocus={(e) => e.target.select()} />
          <Button variant="outline" size="icon" className="size-9 shrink-0 gap-1.5" onClick={copy} aria-label="Copy invite link">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  user: ManagedUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const resetPassword = useResetUserPassword();
  const [password, setPassword] = useState("");

  return (
    <Dialog
      open={!!user}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPassword("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user?.name}</DialogTitle>
          <DialogDescription>They'll need to sign in with this new password next time.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">New password</Label>
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="At least 8 characters"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={password.length < 8 || resetPassword.isPending || !user}
            onClick={() => {
              if (!user) return;
              resetPassword.mutate(
                { id: user.id, password },
                {
                  onSuccess: () => {
                    toast.success(`Password reset for ${user.name}`);
                    onOpenChange(false);
                    setPassword("");
                  },
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't reset password"),
                },
              );
            }}
          >
            {resetPassword.isPending ? "Saving…" : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
