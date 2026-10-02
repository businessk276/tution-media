"use client";

import Link from "next/link";
import CircularLoader from "@/app/circular-loader";
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";

type TeacherProfileData = {
  fullName: string;
  email: string;
  mobileNumber: string;
  city: string;
  subjects: string[];
  teachingLevel: string;
  teachingMode: string;
  yearsExperience: number;
  qualification: string;
  gender: string;
};

export default function TeacherProfilePage() {
  const params = useParams<{ teacherId: string }>();
  const [teacher, setTeacher] = useState<TeacherProfileData | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    const load = async () => {
      if (!user) { setAllowed(false); setLoading(false); return; }
      try {
        const viewer = await getDoc(doc(db, "tutionmedia", user.uid));
        if (viewer.data()?.role !== "student" || viewer.data()?.accountStatus !== "active") {
          setAllowed(false);
          setLoading(false);
          return;
        }
        setAllowed(true);
        const profile = await getDoc(doc(db, "tutionmedia", params.teacherId));
        const data = profile.data();
        if (profile.exists() && data?.role === "teacher" && data.accountStatus === "active" && data.verificationStatus === "approved") {
          setTeacher(data as TeacherProfileData);
        }
      } catch {
        setTeacher(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }), [params.teacherId]);

  return <main className="portal-page"><section className="portal-wrap portal-profile-wrap">
    {loading ? <div className="portal-state"><CircularLoader label="Loading teacher profile…" /></div> : !allowed ? <div className="portal-empty"><h1>Student access required</h1><p>Sign in with an active student or guardian account to view teacher profiles.</p><Link className="portal-button" href="/auth">Sign in</Link></div> : !teacher ? <div className="portal-empty"><h1>Profile unavailable</h1><p>This teacher is not currently approved for public listing.</p><Link className="portal-button" href="/teachers">Back to teachers</Link></div> : <>
      <Link className="portal-secondary-link" href="/teachers">← Back to teacher directory</Link>
      <article className="teacher-profile-detail">
        <div className="teacher-profile-identity">
          <div className="teacher-profile-avatar" aria-hidden="true">{teacher.fullName.slice(0, 1).toUpperCase()}</div>
          <div><p className="portal-eyebrow">Verified teacher</p><h1>{teacher.fullName}</h1><p className="teacher-profile-qualification">{teacher.qualification}</p></div>
        </div>
        <section className="teacher-profile-section" aria-labelledby="teacher-subjects-heading">
          <h2 id="teacher-subjects-heading">Subjects taught</h2>
          <div className="teacher-tags">{teacher.subjects.map((subject) => <span key={subject}>{subject}</span>)}</div>
        </section>
        <section className="teacher-profile-section" aria-labelledby="teacher-details-heading">
          <h2 id="teacher-details-heading">Teaching details</h2>
          <dl className="teacher-facts">
            <div><dt>Location</dt><dd>{teacher.city}</dd></div>
            <div><dt>Teaching level</dt><dd>{teacher.teachingLevel}</dd></div>
            <div><dt>Teaching mode</dt><dd>{teacher.teachingMode}</dd></div>
            <div><dt>Experience</dt><dd>{teacher.yearsExperience} {teacher.yearsExperience === 1 ? "year" : "years"}</dd></div>
            <div><dt>Gender</dt><dd>{teacher.gender}</dd></div>
          </dl>
        </section>
        <section className="teacher-profile-section teacher-profile-contact" aria-labelledby="teacher-contact-heading">
          <h2 id="teacher-contact-heading">Contact teacher</h2>
          <a href={`tel:${teacher.mobileNumber.replace(/[^\d+]/g, "")}`}><span>Phone</span><strong>{teacher.mobileNumber}</strong></a>
          <a href={`mailto:${teacher.email}`}><span>Email</span><strong>{teacher.email}</strong></a>
        </section>
        <Link className="portal-button" href="/student">Create a tuition post</Link>
      </article>
    </>}
  </section></main>;
}