"use client";

import Link from "next/link";
import CircularLoader from "@/app/circular-loader";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { classLevels, districts, formatTuitionBudget, tuitionSubjects, type TuitionPost } from "@/lib/marketplace";

type TeacherSession = { uid: string; name: string; verificationStatus: string };

export default function TeacherDashboard() {
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [posts, setPosts] = useState<TuitionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [classFilter, setClassFilter] = useState("All levels");
  const [subjectFilter, setSubjectFilter] = useState("All subjects");
  const [districtFilter, setDistrictFilter] = useState("All districts");
  const [daysFilter, setDaysFilter] = useState("Any days");
  const [salaryCeiling, setSalaryCeiling] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => {
    const load = async () => {
      if (!user) { setTeacher(null); setLoading(false); return; }
      try {
        const profileSnapshot = await getDoc(doc(db, "tutionmedia", user.uid));
        const profile = profileSnapshot.data();
        if (!profileSnapshot.exists() || profile?.role !== "teacher" || profile.accountStatus !== "active") {
          setTeacher(null);
          setLoading(false);
          return;
        }
        const verificationStatus = profile.verificationStatus ?? "pending";
        setTeacher({ uid: user.uid, name: profile.fullName ?? "Teacher", verificationStatus });
        if (verificationStatus === "approved") {
          const postSnapshot = await getDocs(query(collection(db, "tuitionPosts"), where("status", "in", ["pending", "approved"])));
          setPosts(postSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as TuitionPost));
        }
      } catch {
        setMessage("Could not load the teacher workspace. Check your connection and Firestore rules.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }), []);

  const filteredPosts = useMemo(() => posts.filter((post) =>
    (classFilter === "All levels" || post.classLevel === classFilter)
    && (subjectFilter === "All subjects" || post.subject === subjectFilter)
    && (districtFilter === "All districts" || post.district === districtFilter)
    && (daysFilter === "Any days" || post.daysPerWeek === Number(daysFilter))
    && (!salaryCeiling || post.salaryMin <= Number(salaryCeiling)),
  ), [posts, classFilter, subjectFilter, districtFilter, daysFilter, salaryCeiling]);

  return (
    <main className="portal-page">
      <section className="portal-wrap">
        <div className="portal-heading"><p className="portal-eyebrow">Teacher / tutor workspace</p><h1>{teacher ? `Welcome, ${teacher.name.split(" ")[0]}` : "Your teaching space"}</h1><p>Keep your verification status close and find tuition opportunities that fit.</p></div>
        {loading ? <div className="portal-state"><CircularLoader label="Loading your account…" /></div> : !teacher ? <div className="portal-empty"><h2>Teacher account required</h2><p>Sign in or register as a teacher to see your verification status and tuition opportunities.</p><Link className="portal-button" href="/auth">Sign in or register</Link></div> : teacher.verificationStatus !== "approved" ? <div className="portal-review-state"><span className={`portal-status status-${teacher.verificationStatus}`}>{teacher.verificationStatus}</span><h2>{teacher.verificationStatus === "rejected" ? "Your profile needs an update" : "Your profile is being reviewed"}</h2><p>{teacher.verificationStatus === "rejected" ? "The admin team has reviewed your registration. Contact support for next steps." : "Verified teachers can browse open tuition posts once their profile is approved."}</p></div> : <>
          <section className="portal-panel portal-board-controls"><div className="portal-panel-heading"><div><p className="portal-eyebrow">Verified teacher access</p><h2>Tuition opportunities</h2></div><span className="portal-count">{filteredPosts.length}</span></div>
            <div className="portal-filters"><label className="portal-field">Class / level<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All levels</option>{classLevels.map((item) => <option key={item}>{item}</option>)}</select></label><label className="portal-field">Subject<select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option>All subjects</option>{tuitionSubjects.map((item) => <option key={item}>{item}</option>)}</select></label><label className="portal-field">District<select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)}><option>All districts</option>{districts.map((item) => <option key={item}>{item}</option>)}</select></label><label className="portal-field">Days per week<select value={daysFilter} onChange={(event) => setDaysFilter(event.target.value)}><option>Any days</option>{[3, 4, 5, 6].map((days) => <option key={days} value={days}>{days} days</option>)}</select></label><label className="portal-field">Minimum budget up to (৳)<input type="number" min="0" value={salaryCeiling} onChange={(event) => setSalaryCeiling(event.target.value)} placeholder="Any budget" /></label></div>
          </section>
          {message && <p className="portal-message" role="status">{message}</p>}
          {filteredPosts.length === 0 ? <div className="portal-empty"><h2>No tuition posts match yet</h2><p>Try broadening your filters. New tuition requests will appear here as soon as students submit them.</p></div> : <div className="teacher-post-grid">{filteredPosts.map((post) => {
            return <article className="portal-panel teacher-opportunity" key={post.id}><div className="portal-post-top"><span className="portal-status status-approved">Open tuition post</span><span className="portal-post-date">{new Date(post.createdAt).toLocaleDateString()}</span></div><h2>{post.title}</h2><p>{post.classLevel} · {post.subject} · {post.numberOfStudents === "Group" ? "Group" : `${post.numberOfStudents} student${post.numberOfStudents === "1" ? "" : "s"}`}</p><p>{post.district}, {post.area} · {post.tuitionType} · {post.daysPerWeek} days/week</p><p>{post.preferredTime} · {post.preferredTeacherGender} teacher</p><p className="teacher-budget">{formatTuitionBudget(post.salaryMin, post.salaryMax)}</p><p className="teacher-description">{post.description}</p>{post.contactNumber && <p className="teacher-contact">Contact: <a href={`tel:${post.contactNumber.replace(/[^\d+]/g, "")}`}>{post.contactNumber}</a></p>}</article>;
          })}</div>}
        </>}
      </section>
    </main>
  );
}