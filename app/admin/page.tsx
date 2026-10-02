"use client";

import { type FormEvent, useEffect, useState } from "react";
import CircularLoader from "@/app/circular-loader";
import { formatTuitionBudget } from "@/lib/marketplace";

type AdminUser = {
  id: string;
  role: "student" | "teacher";
  fullName: string;
  email: string;
  mobileNumber?: string;
  city?: string;
  qualification?: string;
  subjects?: string[];
  subjectsNeeded?: string[];
  teachingLevel?: string;
  teachingMode?: string;
  yearsExperience?: number;
  educationLevel?: string;
  learningMode?: string;
  accountStatus?: string;
  verificationStatus?: string;
};
type AdminPost = {
  id: string;
  title: string;
  classLevel: string;
  subject: string;
  district: string;
  area: string;
  salaryMin: number;
  salaryMax: number;
  status: string;
  createdBy: string;
  description: string;
  contactNumber?: string;
};
type AdminData = { users: AdminUser[]; posts: AdminPost[] };
type Tab = "overview" | "students" | "teachers" | "posts";

const emptyData: AdminData = { users: [], posts: [] };

async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Admin request failed.");
  return data;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<AdminData>(emptyData);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState<"student" | "teacher">("student");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editPost, setEditPost] = useState<AdminPost | null>(null);

  const refresh = async () => {
    const nextData = await api("/api/admin/data") as AdminData;
    setData(nextData);
  };

  useEffect(() => {
    void api("/api/admin/session").then(async (session) => {
      if (session.authenticated) {
        setAuthenticated(true);
        await refresh();
      }
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not check admin session.")).finally(() => setChecking(false));
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/session", "POST", { password });
      setPassword("");
      setAuthenticated(true);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admin sign-in failed.");
    } finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await api("/api/admin/session", "DELETE", {});
      setAuthenticated(false);
      setData(emptyData);
      setTab("overview");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign out."); }
    finally { setBusy(false); }
  };

  const mutate = async (method: string, body: unknown, success: string) => {
    setError("");
    setNotice("");
    try {
      await api("/api/admin/data", method, body);
      await refresh();
      setNotice(success);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Admin action failed."); }
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const role = String(form.get("role"));
    const shared = {
      fullName: String(form.get("fullName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      mobileNumber: role === "teacher"
        ? `+966${String(form.get("mobileNumber") ?? "").replace(/\D/g, "").replace(/^966/, "")}`
        : String(form.get("mobileNumber") ?? "").trim(),
      gender: String(form.get("gender") ?? "Prefer not to say"),
      city: String(form.get("city") ?? "").trim(),
    };
    const profile = role === "teacher" ? {
      ...shared,
      subjects: String(form.get("subjects") ?? "").split(",").map((subject) => subject.trim()).filter(Boolean),
      teachingLevel: String(form.get("teachingLevel")),
      teachingMode: String(form.get("teachingMode")),
      yearsExperience: Number(form.get("yearsExperience")),
      qualification: String(form.get("qualification") ?? "").trim(),
    } : {
      ...shared,
      educationLevel: String(form.get("educationLevel")),
      subjectsNeeded: String(form.get("subjects") ?? "").split(",").map((subject) => subject.trim()).filter(Boolean),
      learningMode: String(form.get("learningMode")),
    };
    setBusy(true);
    try {
      await api("/api/admin/data", "POST", { action: "create-user", role, profile, password: String(form.get("password") ?? "") });
      setCreateOpen(false);
      await refresh();
      setNotice(`${role === "teacher" ? "Teacher" : "Student"} account created${role === "teacher" ? " and marked pending verification" : ""}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create account."); }
    finally { setBusy(false); }
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editUser) return;
    const form = new FormData(event.currentTarget);
    const changes: Record<string, unknown> = {
      fullName: String(form.get("fullName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      mobileNumber: String(form.get("mobileNumber") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
    };
    if (editUser.role === "teacher") {
      changes.qualification = String(form.get("qualification") ?? "").trim();
      changes.subjects = String(form.get("subjects") ?? "").split(",").map((subject) => subject.trim()).filter(Boolean);
      changes.teachingLevel = String(form.get("teachingLevel") ?? "");
      changes.teachingMode = String(form.get("teachingMode") ?? "");
      changes.yearsExperience = Number(form.get("yearsExperience"));
    } else {
      changes.educationLevel = String(form.get("educationLevel") ?? "");
      changes.subjectsNeeded = String(form.get("subjectsNeeded") ?? "").split(",").map((subject) => subject.trim()).filter(Boolean);
      changes.learningMode = String(form.get("learningMode") ?? "");
    }
    setBusy(true);
    await mutate("PATCH", { action: "update-user", id: editUser.id, changes }, "Profile updated.");
    setEditUser(null);
    setBusy(false);
  };

  const savePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editPost) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    await mutate("PATCH", { action: "update-post", id: editPost.id, changes: {
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      contactNumber: String(form.get("contactNumber") ?? "").trim(),
      salaryMin: Number(form.get("salaryMin")),
      salaryMax: Number(form.get("salaryMax")),
    } }, "Tuition post updated.");
    setEditPost(null);
    setBusy(false);
  };

  const review = (action: string, id: string, status: string, success: string) => void mutate("PATCH", { action, id, status }, success);
  const toggleAccountStatus = (user: AdminUser) => {
    const accountStatus = user.accountStatus === "active" ? "suspended" : "active";
    void mutate("PATCH", { action: "update-user", id: user.id, changes: { accountStatus } }, `Account ${accountStatus === "active" ? "activated" : "suspended"}.`);
  };
  const remove = async (type: "user" | "post", id: string) => {
    if (!window.confirm(`Permanently delete this ${type}?`)) return;
    await mutate("DELETE", { type, id }, `${type === "user" ? "Account" : "Post"} deleted.`);
  };

  if (checking) return <main className="admin-login-page"><CircularLoader label="Checking admin session…" /></main>;
  if (!authenticated) return <main className="admin-login-page"><form className="admin-login" onSubmit={login}><span className="admin-login-mark">t</span><p className="portal-eyebrow">Tuition Media · Administration</p><h1>Admin sign in</h1><p>Enter the admin password to continue.</p><label className="portal-field">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}<button className="portal-button portal-button-full" disabled={busy}>{busy && <CircularLoader label="Signing in" inline decorative />}{busy ? "Signing in…" : "Sign in securely"}</button></form></main>;

  const students = data.users.filter((user) => user.role === "student");
  const teachers = data.users.filter((user) => user.role === "teacher");
  const pendingTeachers = teachers.filter((user) => (user.verificationStatus ?? "pending") === "pending");
  const pendingPosts = data.posts.filter((post) => post.status === "pending");

  return <main className="admin-shell">
    <aside className="admin-sidebar"><p className="admin-nav-label">ADMIN WORKSPACE</p><nav className="admin-nav">{(["overview", "students", "teachers", "posts"] as Tab[]).map((item) => <button type="button" className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}><span>{item === "overview" ? "◫" : item === "students" ? "◉" : item === "teachers" ? "◇" : "▤"}</span>{item === "posts" ? "Tuition posts" : item[0].toUpperCase() + item.slice(1)}{item === "teachers" && pendingTeachers.length > 0 && <b>{pendingTeachers.length}</b>}{item === "posts" && pendingPosts.length > 0 && <b>{pendingPosts.length}</b>}</button>)}</nav><div className="admin-sidebar-bottom"><button type="button" onClick={() => void logout()} disabled={busy}>{busy && <CircularLoader label="Signing out" inline decorative />}Sign out</button></div></aside>
    <section className="admin-main"><header className="admin-topbar"><div><p>Tuition Media / Admin</p><h1>{tab === "posts" ? "Tuition posts" : tab[0].toUpperCase() + tab.slice(1)}</h1></div><button className="portal-button" type="button" onClick={() => { setCreateOpen(true); setError(""); }}>+ Add account</button></header>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
      {tab === "overview" ? <><div className="admin-metrics"><article><span>Students</span><strong>{students.length}</strong><small>registered accounts</small></article><article><span>Teachers</span><strong>{teachers.length}</strong><small>{pendingTeachers.length} awaiting review</small></article><article><span>Tuition posts</span><strong>{data.posts.length}</strong><small>{pendingPosts.length} awaiting moderation</small></article></div><section className="admin-table-panel"><div className="admin-table-heading"><div><h2>Needs attention</h2><p>Pending teacher profiles and student tuition posts</p></div></div><div className="admin-review-columns"><div><h3>Teacher verification <span>{pendingTeachers.length}</span></h3>{pendingTeachers.slice(0, 5).map((teacher) => <div className="admin-queue-item" key={teacher.id}><span><strong>{teacher.fullName}</strong><small>{teacher.email}</small></span><button type="button" onClick={() => { setTab("teachers"); }}>Review →</button></div>)}</div><div><h3>Tuition post review <span>{pendingPosts.length}</span></h3>{pendingPosts.slice(0, 5).map((post) => <div className="admin-queue-item" key={post.id}><span><strong>{post.title}</strong><small>{post.classLevel} · {post.subject} · {post.district}</small></span><button type="button" onClick={() => setTab("posts")}>Review →</button></div>)}</div></div></section></> : null}
      {tab === "students" && <section className="admin-table-panel"><div className="admin-table-heading"><div><h2>Student accounts</h2><p>Manage registered students and guardians</p></div></div><UserTable users={students} onEdit={setEditUser} onStatus={toggleAccountStatus} onDelete={(user) => void remove("user", user.id)} /></section>}
      {tab === "teachers" && <section className="admin-table-panel"><div className="admin-table-heading"><div><h2>Teacher accounts</h2><p>Review qualifications and manage verification status</p></div></div><TeacherTable teachers={teachers} onEdit={setEditUser} onReview={(user, status) => void mutate("PATCH", { action: "update-user", id: user.id, changes: { verificationStatus: status, ...(status === "approved" ? { accountStatus: "active" } : {}) } }, `Teacher ${status}${status === "approved" ? " and account activated" : ""}.`)} onStatus={toggleAccountStatus} onDelete={(user) => void remove("user", user.id)} /></section>}
      {tab === "posts" && <section className="admin-table-panel"><div className="admin-table-heading"><div><h2>Tuition post review</h2><p>Approve, reject, edit, or remove student requests</p></div></div><PostTable posts={data.posts} onReview={(post, status) => review("review-post", post.id, status, `Post ${status}.`)} onEdit={setEditPost} onDelete={(post) => void remove("post", post.id)} /></section>}
    </section>

    {createOpen && <div className="admin-modal-backdrop"><section className="admin-modal"><button className="admin-modal-close" type="button" onClick={() => setCreateOpen(false)} aria-label="Close">×</button><p className="portal-eyebrow">New account</p><h2>Create student or teacher</h2><form className="portal-form" onSubmit={createUser}><label className="portal-field portal-field-wide">Account type<select name="role" value={createRole} onChange={(event) => setCreateRole(event.target.value as "student" | "teacher")}><option value="student">Student / guardian</option><option value="teacher">Teacher / tutor</option></select></label><label className="portal-field">Full name<input name="fullName" minLength={2} required /></label><label className="portal-field">Email<input name="email" type="email" required /></label><label className="portal-field">Temporary password<input name="password" type="password" minLength={8} required /></label><label className="portal-field">{createRole === "teacher" ? "Mobile number (+966)" : "Mobile number"}<input name="mobileNumber" placeholder={createRole === "teacher" ? "5XXXXXXXX" : "Phone number"} required /></label><label className="portal-field">Gender<select name="gender"><option>Prefer not to say</option><option>Male</option><option>Female</option></select></label><label className="portal-field">City / district<input name="city" required /></label><label className="portal-field portal-field-wide">Subjects (comma separated)<input name="subjects" placeholder="Mathematics, English" required /></label>{createRole === "student" ? <><label className="portal-field">Education level<select name="educationLevel"><option>Primary</option><option>Middle School</option><option>High School</option><option>University</option><option>Other</option></select></label><label className="portal-field">Learning mode<select name="learningMode"><option>Online</option><option>In-person</option></select></label></> : <><label className="portal-field">Teaching level<select name="teachingLevel"><option>Primary</option><option>Middle School</option><option>High School</option><option>University</option></select></label><label className="portal-field">Teaching mode<select name="teachingMode"><option>Online</option><option>In-person</option><option>Both</option></select></label><label className="portal-field">Years experience<input name="yearsExperience" type="number" min="0" max="60" defaultValue="0" required /></label><label className="portal-field">Qualification<input name="qualification" placeholder="Degree or qualification" required /></label></>}<button className="portal-button portal-field-wide" disabled={busy}>{busy && <CircularLoader label="Creating account" inline decorative />}{busy ? "Creating…" : "Create account"}</button></form></section></div>}
    {editUser && <div className="admin-modal-backdrop"><section className="admin-modal"><button className="admin-modal-close" type="button" onClick={() => setEditUser(null)} aria-label="Close">×</button><p className="portal-eyebrow">{editUser.role} account</p><h2>Edit profile</h2><form className="portal-form" onSubmit={saveUser}><label className="portal-field portal-field-wide">Full name<input name="fullName" defaultValue={editUser.fullName} required /></label><label className="portal-field portal-field-wide">Email<input name="email" type="email" defaultValue={editUser.email} required /></label><label className="portal-field">Mobile number<input name="mobileNumber" defaultValue={editUser.mobileNumber} /></label><label className="portal-field">City / district<input name="city" defaultValue={editUser.city} /></label>{editUser.role === "teacher" ? <><label className="portal-field portal-field-wide">Qualification<input name="qualification" defaultValue={editUser.qualification} /></label><label className="portal-field portal-field-wide">Subjects (comma separated)<input name="subjects" defaultValue={editUser.subjects?.join(", ")} /></label><label className="portal-field">Teaching level<select name="teachingLevel" defaultValue={editUser.teachingLevel ?? "Primary"}><option>Primary</option><option>Middle School</option><option>High School</option><option>University</option></select></label><label className="portal-field">Teaching mode<select name="teachingMode" defaultValue={editUser.teachingMode ?? "Online"}><option>Online</option><option>In-person</option><option>Both</option></select></label><label className="portal-field">Years experience<input name="yearsExperience" type="number" min="0" max="60" defaultValue={editUser.yearsExperience ?? 0} /></label></> : <><label className="portal-field">Education level<select name="educationLevel" defaultValue={editUser.educationLevel ?? "Primary"}><option>Primary</option><option>Middle School</option><option>High School</option><option>University</option><option>Other</option></select></label><label className="portal-field">Learning mode<select name="learningMode" defaultValue={editUser.learningMode ?? "Online"}><option>Online</option><option>In-person</option></select></label><label className="portal-field portal-field-wide">Subjects needed<input name="subjectsNeeded" defaultValue={editUser.subjectsNeeded?.join(", ")} /></label></>}<button className="portal-button portal-field-wide" disabled={busy}>Save profile</button></form></section></div>}
    {editPost && <div className="admin-modal-backdrop"><section className="admin-modal"><button className="admin-modal-close" type="button" onClick={() => setEditPost(null)} aria-label="Close">×</button><p className="portal-eyebrow">Student tuition post</p><h2>Edit post</h2><form className="portal-form" onSubmit={savePost}><label className="portal-field portal-field-wide">Title<input name="title" defaultValue={editPost.title} required /></label><label className="portal-field">Minimum budget (৳)<input name="salaryMin" type="number" min="1" defaultValue={editPost.salaryMin} required /></label><label className="portal-field">Maximum budget (৳)<input name="salaryMax" type="number" min="1" defaultValue={editPost.salaryMax} required /></label><label className="portal-field portal-field-wide">Contact number<input name="contactNumber" type="tel" defaultValue={editPost.contactNumber ?? ""} required /></label><label className="portal-field portal-field-wide">Requirements<textarea name="description" rows={4} defaultValue={editPost.description} required /></label><button className="portal-button portal-field-wide" disabled={busy}>Save post</button></form></section></div>}
  </main>;
}

function StatusPill({ status }: { status?: string }) { return <span className={`portal-status status-${status ?? "pending"}`}>{status ?? "pending"}</span>; }

function UserTable({ users, onEdit, onStatus, onDelete }: { users: AdminUser[]; onEdit: (user: AdminUser) => void; onStatus: (user: AdminUser) => void; onDelete: (user: AdminUser) => void }) {
  return <div className="admin-table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>City</th><th>Account status</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.fullName}</td><td>{user.email}</td><td>{user.city}</td><td><StatusPill status={user.accountStatus ?? "not set"} /></td><td><div className="admin-row-actions"><button type="button" onClick={() => onEdit(user)}>Edit</button><button type="button" onClick={() => onStatus(user)}>{user.accountStatus === "active" ? "Suspend" : "Activate"}</button><button className="danger" type="button" onClick={() => onDelete(user)}>Delete</button></div></td></tr>)}</tbody></table>{users.length === 0 && <p className="admin-empty">No student accounts.</p>}</div>;
}

function TeacherTable({ teachers, onEdit, onReview, onStatus, onDelete }: { teachers: AdminUser[]; onEdit: (user: AdminUser) => void; onReview: (user: AdminUser, status: string) => void; onStatus: (user: AdminUser) => void; onDelete: (user: AdminUser) => void }) {
  return <div className="admin-table-scroll"><table><thead><tr><th>Teacher</th><th>Qualifications / subjects</th><th>Verification</th><th>Account</th><th>Actions</th></tr></thead><tbody>{teachers.map((teacher) => <tr key={teacher.id}><td><strong>{teacher.fullName}</strong><small>{teacher.email}</small></td><td>{teacher.qualification}<small>{teacher.subjects?.join(", ")}</small></td><td><StatusPill status={teacher.verificationStatus ?? "pending"} /></td><td><StatusPill status={teacher.accountStatus ?? "not set"} /></td><td><div className="admin-row-actions"><button type="button" onClick={() => onReview(teacher, "approved")}>Approve</button><button type="button" onClick={() => onReview(teacher, "rejected")}>Reject</button><button type="button" onClick={() => onEdit(teacher)}>Edit</button><button type="button" onClick={() => onStatus(teacher)}>{teacher.accountStatus === "active" ? "Suspend" : "Activate"}</button><button className="danger" type="button" onClick={() => onDelete(teacher)}>Delete</button></div></td></tr>)}</tbody></table>{teachers.length === 0 && <p className="admin-empty">No teacher accounts.</p>}</div>;
}

function PostTable({ posts, onReview, onEdit, onDelete }: { posts: AdminPost[]; onReview: (post: AdminPost, status: string) => void; onEdit: (post: AdminPost) => void; onDelete: (post: AdminPost) => void }) {
  return <div className="admin-table-scroll"><table><thead><tr><th>Tuition</th><th>Location</th><th>Budget</th><th>Status</th><th>Actions</th></tr></thead><tbody>{posts.map((post) => <tr key={post.id}><td><strong>{post.title}</strong><small>{post.classLevel} · {post.subject}</small></td><td>{post.district}, {post.area}</td><td>{formatTuitionBudget(post.salaryMin, post.salaryMax)}</td><td><StatusPill status={post.status} /></td><td><div className="admin-row-actions"><button type="button" onClick={() => onReview(post, "approved")}>Approve</button><button type="button" onClick={() => onReview(post, "rejected")}>Reject</button><button type="button" onClick={() => onEdit(post)}>Edit</button><button className="danger" type="button" onClick={() => onDelete(post)}>Delete</button></div></td></tr>)}</tbody></table>{posts.length === 0 && <p className="admin-empty">No tuition posts.</p>}</div>;
}