"use client";
import { useState } from "react";
import { Guard, usePerms } from "@/components/shell";
import { Badge, Btn, Card, Empty, Field, Loading, Modal, Notice, PageHeader, Table, Td, inputCls } from "@/components/ui";
import { errText, rpc, useLoad, type Row } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { dateTime, label } from "@/lib/format";

async function load() {
  const db = supabaseBrowser();
  const [staff, inv, roles, perms, over] = await Promise.all([
    db.from("staff_members").select("*").order("created_at"),
    db.from("staff_invitations").select("id,email,role_template,expires_at,accepted_at,revoked_at,created_at").order("created_at", { ascending: false }).limit(50),
    db.from("role_templates").select("*").order("code"),
    db.from("permissions").select("code,description").order("code"),
    db.from("staff_permission_overrides").select("*"),
  ]);
  for (const r of [staff, inv, roles, perms, over]) if (r.error) throw r.error;
  return { staff: (staff.data ?? []) as Row[], inv: (inv.data ?? []) as Row[], roles: (roles.data ?? []) as Row[], perms: (perms.data ?? []) as Row[], over: (over.data ?? []) as Row[] };
}

function Body() {
  const me = usePerms();
  const { data, error, loading, reload } = useLoad(load, []);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("support");
  const [token, setToken] = useState<string | null>(null);
  const [ov, setOv] = useState<{ user: string; name: string } | null>(null);
  const [ovPerm, setOvPerm] = useState("");
  const [ovEffect, setOvEffect] = useState("deny");
  const [ovReason, setOvReason] = useState("");
  const canManage = me.has("staff.manage");

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try { await fn(); setMsg({ kind: "ok", text: ok }); await reload(); } catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  async function invite() {
    setMsg(null);
    try {
      const r = await rpc<{ token: string }>("admin_create_staff_invitation", { p_email: email.trim(), p_role: role, p_days: 7 });
      setToken(r.token);
      setEmail("");
      await reload();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    }
  }

  const inviteLink = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/accept-invite?token=${token}` : "";
  const roleName = (code: unknown) => String(data?.roles.find((r) => r.code === code)?.name ?? code);

  return (
    <>
      <PageHeader title="Staff & roles" subtitle="Roles are starting points. Per-person overrides can allow or deny single permissions. The owner cannot be demoted, disabled or overridden." />
      {(error || msg) && <Notice kind={error ? "error" : msg!.kind}>{error ?? msg!.text}</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <div className="space-y-5">
          <Card title="Team">
            <Table head={["Name", "Role", "Status", "Overrides", ""]}>
              {data.staff.map((s) => {
                const mine = data.over.filter((o) => o.user_id === s.user_id);
                return (
                  <tr key={String(s.user_id)}>
                    <Td>{String(s.display_name ?? s.user_id)}{s.is_owner ? <> <Badge tone="blue">Owner</Badge></> : null}</Td>
                    <Td>{s.is_owner ? "Owner" : canManage ? (
                      <select aria-label="Role" className="rounded-lg border border-neutral-300 px-2 py-1 text-sm" value={String(s.role_template ?? "")}
                        onChange={(e) => run(() => rpc("admin_set_staff_role", { p_target: s.user_id, p_role: e.target.value }), "Role changed.")}>
                        {data.roles.map((r) => <option key={String(r.code)} value={String(r.code)}>{String(r.name)}</option>)}
                      </select>
                    ) : roleName(s.role_template)}</Td>
                    <Td>{s.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</Td>
                    <Td className="text-xs">{mine.length === 0 ? "-" : mine.map((o) => `${o.effect === "deny" ? "−" : "+"}${String(o.permission_code)}`).join(", ")}</Td>
                    <Td>{canManage && !s.is_owner && (
                      <div className="flex gap-1.5">
                        <Btn kind="ghost" onClick={() => { setOv({ user: String(s.user_id), name: String(s.display_name ?? "staff member") }); setOvPerm(String(data.perms[0]?.code ?? "")); }}>Permissions</Btn>
                        <Btn kind={s.is_active ? "danger" : "ghost"} onClick={() => run(() => rpc("admin_set_staff_active", { p_target: s.user_id, p_active: !s.is_active }), s.is_active ? "Deactivated. Access ends immediately." : "Reactivated.")}>
                          {s.is_active ? "Deactivate" : "Reactivate"}</Btn>
                      </div>
                    )}</Td>
                  </tr>
                );
              })}
            </Table>
          </Card>

          {canManage && (
            <Card title="Invite staff">
              <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
                <Field label="Email"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Role"><select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
                  {data.roles.map((r) => <option key={String(r.code)} value={String(r.code)}>{String(r.name)}</option>)}</select></Field>
                <div className="flex items-end"><Btn onClick={invite} disabled={!email.trim()}>Create invitation</Btn></div>
              </div>
              <p className="mt-2 text-xs text-neutral-500">The invitation is a single-use link. It works for whichever account opens it while signed in, so send it only to the person you trust. It expires in 7 days.</p>
              {data.inv.length > 0 && (
                <div className="mt-4">
                  <Table head={["Email", "Role", "Expires", "State", ""]}>
                    {data.inv.map((i) => (
                      <tr key={String(i.id)}>
                        <Td>{String(i.email)}</Td><Td>{roleName(i.role_template)}</Td><Td>{dateTime(String(i.expires_at))}</Td>
                        <Td>{i.accepted_at ? <Badge tone="green">Accepted</Badge> : i.revoked_at ? <Badge tone="red">Revoked</Badge> : new Date(String(i.expires_at)) < new Date() ? <Badge>Expired</Badge> : <Badge tone="amber">Open</Badge>}</Td>
                        <Td>{!i.accepted_at && !i.revoked_at && <Btn kind="danger" onClick={() => run(() => rpc("admin_revoke_staff_invitation", { p_id: i.id }), "Invitation revoked.")}>Revoke</Btn>}</Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
            </Card>
          )}
          {!canManage && data.staff.length === 0 && <Empty>No staff visible.</Empty>}
        </div>
      )}

      {token && (
        <Modal title="Invitation created" onClose={() => setToken(null)}>
          <Notice kind="info">This link is shown once. Copy it now; only a hash is stored.</Notice>
          <input readOnly className={`${inputCls} font-mono text-xs`} value={inviteLink} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
          <div className="mt-3 flex gap-2">
            <Btn onClick={() => void navigator.clipboard.writeText(inviteLink)}>Copy link</Btn>
            <Btn kind="ghost" onClick={() => setToken(null)}>Done</Btn>
          </div>
        </Modal>
      )}

      {ov && data && (
        <Modal title={`Permission override: ${ov.name}`} onClose={() => setOv(null)}>
          <div className="space-y-3">
            <Field label="Permission"><select className={inputCls} value={ovPerm} onChange={(e) => setOvPerm(e.target.value)}>
              {data.perms.map((p) => <option key={String(p.code)} value={String(p.code)}>{String(p.code)}: {String(p.description)}</option>)}</select></Field>
            <Field label="Effect" hint="You can only grant permissions you hold yourself"><select className={inputCls} value={ovEffect} onChange={(e) => setOvEffect(e.target.value)}>
              <option value="deny">Deny (overrides the role)</option><option value="allow">Allow (adds to the role)</option><option value="clear">Clear (back to the role)</option></select></Field>
            <Field label="Reason"><input className={inputCls} value={ovReason} onChange={(e) => setOvReason(e.target.value)} /></Field>
            <div className="flex gap-2">
              <Btn onClick={() => run(async () => { await rpc("admin_set_permission_override", { p_target: ov.user, p_perm: ovPerm, p_effect: ovEffect, p_reason: ovReason }); setOv(null); }, "Override saved and audited.")}>Save</Btn>
              <Btn kind="ghost" onClick={() => setOv(null)}>Cancel</Btn>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Effective role: {label(String(data.staff.find((s) => s.user_id === ov.user)?.role_template ?? ""))}</p>
        </Modal>
      )}
    </>
  );
}

export default function StaffPage() {
  return <Guard perm="staff.read|staff.manage"><Body /></Guard>;
}
