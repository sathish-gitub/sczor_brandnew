"use client";

import { UserPlus } from "lucide-react";
import Image from "next/image";
import { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type AccountForm = {
  ownerName: string;
  email: string;
  mobile: string;
  profilePhoto: string;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
};

const roleHelp: Record<TeamMember["role"], string> = {
  OWNER: "Full access",
  MANAGER: "All except billing settings",
  STAFF: "Only their own data",
};

function passwordStrength(password: string) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { label: "Weak", width: "33%", color: "bg-red-500" };
  if (score <= 4) return { label: "Medium", width: "66%", color: "bg-amber-500" };
  return { label: "Strong", width: "100%", color: "bg-emerald-500" };
}

export default function AccountSettingsPage() {
  const { showToast } = useToast();

  const [profile, setProfile] = useState<AccountForm>({ ownerName: "", email: "", mobile: "", profilePhoto: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [openAddMember, setOpenAddMember] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ name: "", email: "", mobile: "", role: "MANAGER" as "MANAGER" | "STAFF" });

  useEffect(() => {
    let active = true;

    async function loadAll() {
      const [settingsResponse, teamResponse] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/settings/team", { cache: "no-store" }),
      ]);

      const settingsPayload = (await settingsResponse.json().catch(() => null)) as {
        error?: string;
        account?: AccountForm;
      } | null;
      const teamPayload = (await teamResponse.json().catch(() => null)) as {
        error?: string;
        items?: TeamMember[];
      } | null;

      if (!active) {
        return;
      }

      if (!settingsResponse.ok || !settingsPayload?.account) {
        showToast({ variant: "error", title: "Unable to load account settings", message: settingsPayload?.error });
      } else {
        setProfile(settingsPayload.account);
      }

      if (!teamResponse.ok) {
        showToast({ variant: "warning", title: "Team list unavailable", message: teamPayload?.error });
      } else {
        setTeam(teamPayload?.items ?? []);
      }

      setLoading(false);
      setTeamLoading(false);
    }

    loadAll();

    return () => {
      active = false;
    };
  }, [showToast]);

  const strength = useMemo(() => passwordStrength(password.newPassword), [password.newPassword]);

  function onProfilePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setProfile((current) => ({ ...current, profilePhoto: value }));
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    setProfileSaving(true);

    const response = await fetch("/api/settings/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to save profile", message: payload?.error });
      setProfileSaving(false);
      return;
    }

    showToast({ variant: "success", title: "Profile saved" });
    setProfileSaving(false);
  }

  async function savePassword() {
    if (password.newPassword !== password.confirmPassword) {
      showToast({ variant: "warning", title: "Passwords do not match" });
      return;
    }

    setPasswordSaving(true);

    const response = await fetch("/api/settings/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to change password", message: payload?.error });
      setPasswordSaving(false);
      return;
    }

    showToast({ variant: "success", title: "Password changed" });
    setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordSaving(false);
  }

  async function addTeamMember() {
    setAddingMember(true);

    const response = await fetch("/api/settings/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMember),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      item?: TeamMember;
      temporaryPassword?: string;
    } | null;

    if (!response.ok || !payload?.item) {
      showToast({ variant: "error", title: "Unable to add team member", message: payload?.error });
      setAddingMember(false);
      return;
    }

    setTeam((current) => [...current, payload.item!]);
    setOpenAddMember(false);
    setNewMember({ name: "", email: "", mobile: "", role: "MANAGER" });
    setAddingMember(false);

    showToast({
      variant: "success",
      title: "Team member added",
      message: payload.temporaryPassword
        ? `Invitation mocked. Temporary password: ${payload.temporaryPassword}`
        : "Invitation email mocked successfully.",
    });
  }

  async function removeTeamMember(id: string) {
    const response = await fetch(`/api/settings/team/${id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to remove team member", message: payload?.error });
      return;
    }

    setTeam((current) => current.filter((member) => member.id !== id));
    showToast({ variant: "success", title: "Team member removed" });
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Account & Security"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Account & Security" },
        ]}
      />

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="mt-3 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-[var(--border)] bg-slate-50">
            {profile.profilePhoto ? <Image src={profile.profilePhoto} alt="Profile preview" width={64} height={64} className="h-full w-full object-cover" /> : null}
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700">
            Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={onProfilePhotoChange} />
          </label>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Owner Name" value={profile.ownerName} onChange={(value) => setProfile((current) => ({ ...current, ownerName: value }))} />
          <Field label="Email" value={profile.email} onChange={(value) => setProfile((current) => ({ ...current, email: value }))} />
          <Field label="Mobile" value={profile.mobile} onChange={(value) => setProfile((current) => ({ ...current, mobile: value }))} />
        </div>
        <button type="button" onClick={saveProfile} disabled={profileSaving} className="mt-4 h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70">
          {profileSaving ? "Saving..." : "Save Profile"}
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-base font-semibold">Change Password</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <PasswordField label="Current Password" value={password.currentPassword} onChange={(value) => setPassword((current) => ({ ...current, currentPassword: value }))} />
          <PasswordField label="New Password" value={password.newPassword} onChange={(value) => setPassword((current) => ({ ...current, newPassword: value }))} />
          <PasswordField label="Confirm New Password" value={password.confirmPassword} onChange={(value) => setPassword((current) => ({ ...current, confirmPassword: value }))} />
        </div>
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--muted)]">Strength: {strength.label}</p>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className={["h-2 rounded-full", strength.color].join(" ")} style={{ width: strength.width }} />
          </div>
        </div>
        <button type="button" onClick={savePassword} disabled={passwordSaving} className="mt-4 h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-70">
          {passwordSaving ? "Saving..." : "Save Password"}
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Team Members</h2>
          <button type="button" onClick={() => setOpenAddMember(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-slate-700">
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </button>
        </div>

        {teamLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-slate-50" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <tr key={member.id} className="border-t border-[var(--border)]">
                    <td className="py-2 font-semibold">{member.name}</td>
                    <td className="py-2">{member.email}</td>
                    <td className="py-2">
                      <p>{member.role}</p>
                      <p className="text-xs text-[var(--muted)]">{roleHelp[member.role]}</p>
                    </td>
                    <td className="py-2">{member.status}</td>
                    <td className="py-2">
                      {member.role === "OWNER" ? (
                        <span className="text-xs text-[var(--muted)]">Protected</span>
                      ) : (
                        <button type="button" onClick={() => setPendingDeleteId(member.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={openAddMember} onClose={() => setOpenAddMember(false)} title="Add Team Member" size="md">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={newMember.name} onChange={(value) => setNewMember((current) => ({ ...current, name: value }))} />
          <Field label="Email" value={newMember.email} onChange={(value) => setNewMember((current) => ({ ...current, email: value }))} />
          <Field label="Mobile" value={newMember.mobile} onChange={(value) => setNewMember((current) => ({ ...current, mobile: value }))} />
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Role</span>
            <select value={newMember.role} onChange={(event) => setNewMember((current) => ({ ...current, role: event.target.value as "MANAGER" | "STAFF" }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3">
              <option value="MANAGER">MANAGER</option>
              <option value="STAFF">STAFF</option>
            </select>
          </label>
        </div>

        <button type="button" onClick={addTeamMember} disabled={addingMember} className="mt-4 h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70">
          {addingMember ? "Sending..." : "Send Invitation"}
        </button>
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Remove team member"
        message="This action removes access for the selected team member."
        danger
        confirmText="Remove"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          void removeTeamMember(id);
        }}
      />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
    </label>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input type="password" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
    </label>
  );
}
