"use client";

import Link from "next/link";
import CircularLoader from "@/app/circular-loader";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

type Teacher = {
  id: string;
  fullName: string;
  city: string;
  subjects: string[];
  teachingLevel: string;
  teachingMode: string;
  yearsExperience: number;
  qualification: string;
};

export default function TeacherDirectory() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isStudent, setIsStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All subjects");
  const [message, setMessage] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => {
    const load = async () => {
      if (!user) {
        setIsStudent(false);
        setLoading(false);
        return;
      }
      try {
        const profileSnapshot = await getDoc(doc(db, "tutionmedia", user.uid));
        const profile = profileSnapshot.data();
        if (profileSnapshot.exists() && profile?.role === "student" && profile.accountStatus === "active") {
          setIsStudent(true);
          const result = await getDocs(query(collection(db, "tutionmedia"), where("role", "==", "teacher"), where("accountStatus", "==", "active"), where("verificationStatus", "==", "approved")));
          setTeachers(result.docs.map((item) => ({ id: item.id, ...item.data() }) as Teacher));
        } else {
          setIsStudent(false);
        }
      } catch {
        setMessage("Teacher profiles could not be loaded. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }), []);

  const availableSubjects = ["All subjects", ...new Set(teachers.flatMap((teacher) => teacher.subjects ?? []))];
  const filtered = teachers.filter((teacher) => {
    const matchesSubject = subject === "All subjects" || teacher.subjects?.includes(subject);
    const haystack = `${teacher.fullName} ${teacher.city} ${teacher.qualification} ${teacher.subjects?.join(" ")}`.toLowerCase();
    return matchesSubject && haystack.includes(search.toLowerCase());
  });

  return (
    <main className="portal-page">
      <section className="portal-wrap">
        <div className="portal-heading"><p className="portal-eyebrow">Verified educators</p><h1>Find a teacher who fits</h1><p>Explore approved tutors by subject, qualification, and location.</p></div>
        {loading ? <div className="portal-state"><CircularLoader label="Loading teacher profiles…" /></div> : !isStudent ? <div className="portal-empty"><h2>Student access required</h2><p>Sign in with an active student or guardian account to browse approved teacher profiles.</p><Link className="portal-button" href="/auth">Sign in</Link></div> : <>
          <div className="portal-filter-row"><label className="portal-field">Search teachers<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, qualification, or city" /></label><label className="portal-field">Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}>{availableSubjects.map((item) => <option key={item}>{item}</option>)}</select></label><span className="portal-result-count">{filtered.length} verified tutors</span></div>
          {message && <p className="portal-message" role="alert">{message}</p>}
          {filtered.length === 0 ? <div className="portal-empty"><h2>No matching teachers yet</h2><p>Try a different search or subject.</p></div> : <div className="teacher-grid">{filtered.map((teacher) => <article className="teacher-card" key={teacher.id}>
            <div className="teacher-card-top"><span className="teacher-avatar" aria-hidden="true">{teacher.fullName.slice(0, 1).toUpperCase()}</span><span className="portal-status status-approved">Verified</span></div>
            <h2>{teacher.fullName}</h2><p className="teacher-qualification">{teacher.qualification}</p>
            <div className="teacher-tags">{teacher.subjects?.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>
            <dl className="teacher-facts"><div><dt>Location</dt><dd>{teacher.city}</dd></div><div><dt>Levels</dt><dd>{teacher.teachingLevel}</dd></div><div><dt>Experience</dt><dd>{teacher.yearsExperience} years</dd></div><div><dt>Mode</dt><dd>{teacher.teachingMode}</dd></div></dl>
            <Link className="portal-button portal-button-full" href={`/teachers/${teacher.id}`}>View teacher profile <span aria-hidden="true">→</span></Link>
          </article>)}</div>}
        </>}
      </section>
    </main>
  );
}