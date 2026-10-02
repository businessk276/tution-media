"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { type FormEvent, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { classLevels, districts, formatTuitionBudget, tuitionSubjects, type TuitionPost } from "@/lib/marketplace";

type StudentSession = { uid: string; name: string };

const freshPost = () => new Date().toISOString();

export default function StudentDashboard() {
  const [student, setStudent] = useState<StudentSession | null>(null);
  const [posts, setPosts] = useState<TuitionPost[]>([]);
  const [editingPost, setEditingPost] = useState<TuitionPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => {
    const load = async () => {
      if (!user) {
        setStudent(null);
        setPosts([]);
        setLoading(false);
        return;
      }
      try {
        const profileSnapshot = await getDoc(doc(db, "tutionmedia", user.uid));
        const profile = profileSnapshot.data();
        if (!profileSnapshot.exists() || profile?.role !== "student" || profile.accountStatus !== "active") {
          setStudent(null);
          setLoading(false);
          return;
        }
        setStudent({ uid: user.uid, name: profile.fullName ?? "Student" });
        const postSnapshots = await getDocs(query(collection(db, "tuitionPosts"), where("createdBy", "==", user.uid)));
        setPosts(postSnapshots.docs.map((post) => ({ id: post.id, ...post.data() }) as TuitionPost).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } catch {
        setMessage("Could not load your tuition posts. Check your connection and Firestore rules.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }), []);

  const savePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!student) return;
    const formElement = event.currentTarget;
    setSaving(true);
    setMessage("");
    const values = new FormData(formElement);
    const now = freshPost();
    const postData = {
      title: String(values.get("title") ?? "").trim(),
      classLevel: String(values.get("classLevel") ?? ""),
      subject: String(values.get("subject") ?? ""),
      numberOfStudents: String(values.get("numberOfStudents") ?? "1") as TuitionPost["numberOfStudents"],
      preferredTeacherGender: String(values.get("preferredTeacherGender") ?? "Any") as TuitionPost["preferredTeacherGender"],
      daysPerWeek: Number(values.get("daysPerWeek")),
      preferredTime: String(values.get("preferredTime") ?? "").trim(),
      salaryMin: Number(values.get("salaryMin")),
      salaryMax: Number(values.get("salaryMax")),
      district: String(values.get("district") ?? ""),
      area: String(values.get("area") ?? "").trim(),
      tuitionType: String(values.get("tuitionType") ?? "Home") as TuitionPost["tuitionType"],
      studentGender: String(values.get("studentGender") ?? "Male") as TuitionPost["studentGender"],
      description: String(values.get("description") ?? "").trim(),
      contactMethod: String(values.get("contactMethod") ?? "Platform Message") as TuitionPost["contactMethod"],
      createdBy: student.uid,
      status: "approved" as const,
      createdAt: editingPost?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      if (editingPost) {
        await updateDoc(doc(db, "tuitionPosts", editingPost.id), postData);
        setPosts((current) => current.map((post) => post.id === editingPost.id ? { ...postData, id: post.id } : post));
        setEditingPost(null);
        setMessage("Your changes were saved and are visible to verified teachers.");
      } else {
        const created = await addDoc(collection(db, "tuitionPosts"), postData);
        setPosts((current) => [{ ...postData, id: created.id }, ...current]);
        setMessage("Tuition post submitted and is now visible to verified teachers.");
        formElement.reset();
      }
    } catch {
      setMessage("Could not save this post. Make sure your account is active and try again.");
    } finally {
      setSaving(false);
    }
  };

  const removePost = async (post: TuitionPost) => {
    if (!window.confirm("Delete this tuition post?")) return;
    try {
      await deleteDoc(doc(db, "tuitionPosts", post.id));
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setMessage("Tuition post deleted.");
    } catch {
      setMessage("Could not delete this tuition post. Please try again.");
    }
  };

  return (
    <main className="portal-page">
      <header className="portal-header">
        <Link className="portal-brand" href="/">Tuition Media</Link>
        <nav><Link href="/teachers">Find teachers</Link><Link href="/">Home</Link></nav>
      </header>
      <section className="portal-wrap">
        <div className="portal-heading">
          <p className="portal-eyebrow">Student / guardian</p>
          <h1>{student ? `Welcome, ${student.name.split(" ")[0]}` : "Your tuition space"}</h1>
          <p>Create a request, keep an eye on its review, and find a teacher who fits.</p>
        </div>

        {loading ? <p className="portal-state">Loading your account…</p> : !student ? (
          <div className="portal-empty"><h2>Sign in to manage tuition</h2><p>Student and guardian accounts can create private tuition posts and follow their approval status here.</p><Link className="portal-button" href="/auth">Sign in or register</Link></div>
        ) : <div className="portal-columns">
          <section className="portal-panel">
            <div className="portal-panel-heading"><div><p className="portal-eyebrow">{editingPost ? "Edit request" : "New request"}</p><h2>{editingPost ? "Update tuition post" : "Create a tuition post"}</h2></div></div>
            <form className="portal-form" key={editingPost?.id ?? "new-post"} onSubmit={savePost}>
              <label className="portal-field portal-field-wide">Tuition title<input name="title" defaultValue={editingPost?.title} placeholder="e.g. HSC ICT teacher needed" minLength={5} maxLength={120} required /></label>
              <label className="portal-field">Student class / level<select name="classLevel" defaultValue={editingPost?.classLevel ?? ""} required><option value="" disabled>Select class</option>{classLevels.map((level) => <option key={level}>{level}</option>)}</select></label>
              <label className="portal-field">Subject<select name="subject" defaultValue={editingPost?.subject ?? ""} required><option value="" disabled>Select subject</option>{tuitionSubjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
              <label className="portal-field">Number of students<select name="numberOfStudents" defaultValue={editingPost?.numberOfStudents ?? "1"} required><option value="1">1</option><option value="2">2</option><option value="Group">Group</option></select></label>
              <label className="portal-field">Preferred teacher gender<select name="preferredTeacherGender" defaultValue={editingPost?.preferredTeacherGender ?? "Any"} required><option>Any</option><option>Male</option><option>Female</option></select></label>
              <label className="portal-field">Days per week<select name="daysPerWeek" defaultValue={String(editingPost?.daysPerWeek ?? 3)} required>{[3, 4, 5, 6].map((days) => <option key={days} value={days}>{days} days</option>)}</select></label>
              <label className="portal-field">Preferred time<input name="preferredTime" defaultValue={editingPost?.preferredTime} placeholder="5:00 PM – 7:00 PM" maxLength={80} required /></label>
              <label className="portal-field">Minimum budget (৳ / month)<input name="salaryMin" type="number" min="1" step="100" defaultValue={editingPost?.salaryMin} required /></label>
              <label className="portal-field">Maximum budget (৳ / month)<input name="salaryMax" type="number" min="1" step="100" defaultValue={editingPost?.salaryMax} required /></label>
              <label className="portal-field">District<select name="district" defaultValue={editingPost?.district ?? ""} required><option value="" disabled>Select district</option>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
              <label className="portal-field">Area<input name="area" defaultValue={editingPost?.area} placeholder="Area or neighbourhood" required /></label>
              <label className="portal-field">Tuition type<select name="tuitionType" defaultValue={editingPost?.tuitionType ?? "Home"} required><option>Home</option><option>Online</option></select></label>
              <label className="portal-field">Student gender<select name="studentGender" defaultValue={editingPost?.studentGender ?? "Male"} required><option>Male</option><option>Female</option></select></label>
              <label className="portal-field">Contact method<select name="contactMethod" defaultValue={editingPost?.contactMethod ?? "Platform Message"} required><option>Phone</option><option>WhatsApp</option><option>Platform Message</option></select></label>
              <label className="portal-field portal-field-wide">Requirements / description<textarea name="description" defaultValue={editingPost?.description} minLength={10} maxLength={2000} rows={4} placeholder="Share the learning goals, schedule preferences, and anything a tutor should know." required /></label>
              <div className="portal-form-actions"><button className="portal-button" type="submit" disabled={saving}>{saving ? "Saving…" : editingPost ? "Save changes" : "Submit for approval"}</button>{editingPost && <button className="portal-link-button" type="button" onClick={() => setEditingPost(null)}>Cancel</button>}</div>
            </form>
          </section>

          <section className="portal-panel portal-post-list">
            <div className="portal-panel-heading"><div><p className="portal-eyebrow">Private to your account</p><h2>Your tuition posts</h2></div><span className="portal-count">{posts.length}</span></div>
            {posts.length === 0 ? <p className="portal-muted">Your submitted requests will appear here. Other students cannot see them.</p> : posts.map((post) => (
              <article className="portal-post" key={post.id}>
                <div className="portal-post-top"><span className={`portal-status status-${post.status}`}>{post.status}</span><span className="portal-post-date">{new Date(post.createdAt).toLocaleDateString()}</span></div>
                <h3>{post.title}</h3>
                <p>{post.classLevel} · {post.subject} · {post.district}, {post.area}</p>
                <p>{formatTuitionBudget(post.salaryMin, post.salaryMax)} · {post.daysPerWeek} days/week</p>
                <div className="portal-post-actions"><button type="button" onClick={() => { setEditingPost(post); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{post.status === "approved" ? "Edit and resubmit" : "Edit"}</button><button type="button" onClick={() => void removePost(post)}>Delete</button></div>
              </article>
            ))}
            <Link className="portal-secondary-link" href="/teachers">Browse approved teachers <span aria-hidden="true">→</span></Link>
          </section>
        </div>}
        {message && <p className="portal-message" role="status">{message}</p>}
      </section>
    </main>
  );
}