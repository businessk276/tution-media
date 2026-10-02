"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { formatTuitionBudget, type TuitionPost } from "@/lib/marketplace";

const tutorImage = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1900&q=85";

const subjects = [
  ["Mathematics", "Build confidence with every problem."],
  ["English", "Find your voice, in class and beyond."],
  ["Physics", "Make the big ideas click."],
  ["Quran & Arabic", "Learn with care, depth, and meaning."],
  ["Chemistry", "Turn curiosity into understanding."],
  ["Biology", "Explore the science of life."],
];

type SignedInAccount = {
  role: "student" | "teacher";
  name: string;
  accountStatus?: string;
  verificationStatus?: string;
};

type AvailableTeacher = {
  id: string;
  fullName: string;
  city: string;
  subjects: string[];
  teachingLevel: string;
  teachingMode: string;
  yearsExperience: number;
  qualification: string;
};

export default function LandingPage() {
  const pageRef = useRef<HTMLElement>(null);
  const [account, setAccount] = useState<SignedInAccount | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [tuitionPosts, setTuitionPosts] = useState<TuitionPost[]>([]);
  const [marketplaceError, setMarketplaceError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let currentRequest = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const requestId = ++currentRequest;
      const isCurrentRequest = () => !cancelled && requestId === currentRequest;
      setCheckingSession(true);
      setMarketplaceError("");
      setAvailableTeachers([]);
      setTuitionPosts([]);
      setAccount(null);
      if (!user) {
        if (isCurrentRequest()) setCheckingSession(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "tutionmedia", user.uid));
        const profile = snapshot.data();
        if (
          !snapshot.exists()
          || (profile?.role !== "student" && profile?.role !== "teacher")
        ) {
          if (isCurrentRequest()) setAccount(null);
          return;
        }

        const signedInAccount: SignedInAccount = {
          role: profile.role,
          name: profile.fullName ?? (profile.role === "student" ? "Student" : "Teacher"),
          accountStatus: profile.accountStatus,
          verificationStatus: profile.verificationStatus,
        };
        if (isCurrentRequest()) setAccount(signedInAccount);

        if (profile.accountStatus !== "active") {
          return;
        }

        if (profile.role === "student") {
          const teachersSnapshot = await getDocs(query(
            collection(db, "tutionmedia"),
            where("role", "==", "teacher"),
            where("accountStatus", "==", "active"),
            where("verificationStatus", "==", "approved"),
          ));
          if (isCurrentRequest()) {
            setAvailableTeachers(teachersSnapshot.docs.map((teacher) => ({
              id: teacher.id,
              ...teacher.data(),
            }) as AvailableTeacher));
          }
        } else if (profile.verificationStatus === "approved") {
          const postsSnapshot = await getDocs(query(
            collection(db, "tuitionPosts"),
            where("status", "in", ["pending", "approved"]),
          ));
          if (isCurrentRequest()) {
            setTuitionPosts(postsSnapshot.docs
              .map((post) => ({ id: post.id, ...post.data() }) as TuitionPost)
              .sort((first, second) => second.createdAt.localeCompare(first.createdAt)));
          }
        }
      } catch {
        if (isCurrentRequest()) {
          setMarketplaceError("We couldn't load your marketplace. Check your connection and Firestore rules, then refresh.");
        }
      } finally {
        if (isCurrentRequest()) setCheckingSession(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      setAccount(null);
    } finally {
      setSigningOut(false);
    }
  };

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !("IntersectionObserver" in window)) return;

    const revealItems = page.querySelectorAll<HTMLElement>("[data-reveal]");
    page.classList.add("motion-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -36px 0px" });

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [account, checkingSession]);

  return (
    <main className="tm-landing" ref={pageRef}>
      <header className="tm-header">
        <Link className="tm-brand" href="/" aria-label="Tuition Media home">
          <span className="tm-mark" aria-hidden="true">t</span>
          <span>tuition<span className="tm-brand-light">media</span></span>
        </Link>
        <nav className="tm-nav" aria-label="Main navigation">
          {checkingSession ? null : account ? <>
            {account.role === "student" ? <Link href="#member-board">Available teachers</Link> : <Link href="#member-board">Tuition posts</Link>}
            <Link href={account.role === "student" ? "/student" : "/teacher"}>My workspace</Link>
          </> : <>
            <a href="#approach">Our approach</a>
            <Link href="/teachers">Find teachers</Link>
            <Link href="/teacher">For tutors</Link>
          </>}
        </nav>
        <div className="tm-header-actions">
          {checkingSession ? <span className="tm-session-status" role="status">Checking account…</span> : account ? <>
            <span className="tm-account-role">{account.role} account</span>
            <Link className="tm-account-home" href={account.role === "teacher" ? "/teacher" : "/student"}>My workspace</Link>
            <button className="tm-header-cta tm-signout" type="button" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </> : <>
            <Link className="tm-signin" href="/auth">Sign in</Link>
            <Link className="tm-header-cta" href="/auth">Get started <span aria-hidden="true">↗</span></Link>
          </>}
        </div>
      </header>

      <section className="tm-hero" style={{ backgroundImage: `linear-gradient(90deg, rgb(16 38 29 / 82%) 0%, rgb(16 38 29 / 52%) 43%, rgb(16 38 29 / 8%) 100%), url("${tutorImage}")` }}>
        <div className="tm-hero-grain" aria-hidden="true" />
        <div className="tm-hero-content">
          <p className="tm-kicker tm-hero-kicker"><span />{checkingSession ? "Your learning space" : account ? `Welcome back, ${account.name.split(" ")[0]}` : "A little more understood"}</p>
          <h1>{checkingSession ? <>Getting your<br />space <em>ready.</em></> : account?.role === "student" ? <>Find a teacher,<br />make learning <em>click.</em></> : account?.role === "teacher" ? <>Your next student<br />is out <em>there.</em></> : <>When it clicks,<br />everything <em>opens.</em></>}</h1>
          <p className="tm-hero-copy">{checkingSession ? "Loading your account and marketplace…" : account?.role === "student" ? "Create a tuition post and explore verified teachers who can help you reach your goals." : account?.role === "teacher" ? "Explore tuition requests from students and find an opportunity that fits your experience." : "One good tutor can change how learning feels. Find the right person, and make your next step a confident one."}</p>
          {marketplaceError && !account && <p className="tm-session-error" role="alert">{marketplaceError}</p>}
          {!checkingSession && <div className="tm-hero-actions">
            {account?.role === "student" ? <>
              <Link className="tm-button tm-button-lime" href="/student">Add tuition post <span aria-hidden="true">↗</span></Link>
              <a className="tm-hero-secondary" href="#member-board">Available teachers <span aria-hidden="true">→</span></a>
              <button className="tm-hero-secondary tm-hero-signout" type="button" onClick={handleSignOut} disabled={signingOut}>
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </> : account?.role === "teacher" ? <>
              <Link className="tm-button tm-button-lime" href="/teacher">{account.verificationStatus === "approved" ? "Browse tuition posts" : "View verification status"} <span aria-hidden="true">↗</span></Link>
              {account.verificationStatus === "approved" && <a className="tm-hero-secondary" href="#member-board">All tuition posts <span aria-hidden="true">→</span></a>}
              <button className="tm-hero-secondary tm-hero-signout" type="button" onClick={handleSignOut} disabled={signingOut}>
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </> : <>
              <Link className="tm-button tm-button-lime" href="/teachers">Find your tutor <span aria-hidden="true">↗</span></Link>
              <Link className="tm-hero-secondary" href="/teacher">I want to teach <span aria-hidden="true">→</span></Link>
            </>}
          </div>}
          {!checkingSession && !account && <div className="tm-hero-proof"><span className="tm-proof-stars" aria-label="Five stars">★★★★★</span><span>A more personal way to learn, right here in Saudi Arabia.</span></div>}
        </div>
        {!checkingSession && <a className="tm-scroll-cue" href={account ? "#member-board" : "#approach"}><span className="tm-scroll-line" />{account ? "Your marketplace" : "Scroll to explore"}</a>}
        <span className="tm-hero-index" aria-hidden="true">01 — 04</span>
      </section>

      {!account && !checkingSession && <section className="tm-intro-band" aria-label="Tuition Media introduction">
        <p>More than a lesson</p>
        <span aria-hidden="true">✳</span>
        <p>A connection that moves you forward</p>
        <span aria-hidden="true">✳</span>
        <p>Learning on your terms</p>
      </section>}

      {!account && !checkingSession && <section className="tm-role-strip" aria-label="Choose how to get started">
        <Link href="/student"><span>01</span><strong>Student / Guardian</strong><small>Get learning support <b aria-hidden="true">↗</b></small></Link>
        <Link href="/teacher"><span>02</span><strong>Teacher / Tutor</strong><small>Share your expertise <b aria-hidden="true">↗</b></small></Link>
        <Link href="/student"><span>03</span><strong>Create Tuition Post</strong><small>Find the right teacher <b aria-hidden="true">↗</b></small></Link>
        <Link href="/teachers"><span>04</span><strong>Find Teachers</strong><small>Meet verified tutors <b aria-hidden="true">↗</b></small></Link>
      </section>
      }

      {account && <section className="tm-member-board" id="member-board" aria-labelledby="member-board-title">
        <div className="tm-member-board-inner">
          <div className="tm-member-board-heading">
            <div>
              <p className="tm-kicker tm-kicker-green">{account.role === "student" ? "Verified educators" : "Approved opportunities"}</p>
              <h2 id="member-board-title">{account.role === "student" ? "Available teachers" : "All tuition posts"}</h2>
              <p>{account.role === "student" ? "Browse active, verified teachers and find the right fit for your learning goals." : "Browse every approved tuition request currently available to verified teachers."}</p>
            </div>
            <Link className="tm-member-board-link" href={account.role === "student" ? "/teachers" : "/teacher"}>
              {account.role === "student" ? "Browse teacher directory" : "Open teacher workspace"} <span aria-hidden="true">↗</span>
            </Link>
          </div>

          {marketplaceError ? <p className="tm-member-state tm-member-error" role="alert">{marketplaceError}</p> : checkingSession ? <p className="tm-member-state" role="status">Loading marketplace…</p> : account.accountStatus !== "active" ? <div className="tm-member-state">
            <h3>{account.accountStatus === "suspended" ? "This account is suspended" : "Account activation needed"}</h3>
            <p>Your {account.role} account is signed in, but marketplace access is only available for active accounts. Please contact support to check your account status.</p>
          </div> : account.role === "teacher" && account.verificationStatus !== "approved" ? <div className="tm-member-state">
            <h3>{account.verificationStatus === "rejected" ? "Your profile needs an update" : "Your profile is being reviewed"}</h3>
            <p>Approved teachers can browse open tuition posts. Check your verification status in your teacher workspace.</p>
            <Link className="tm-member-inline-link" href="/teacher">Open teacher workspace <span aria-hidden="true">→</span></Link>
          </div> : account.role === "student" ? availableTeachers.length === 0 ? <div className="tm-member-state">
            <h3>No verified teachers to show yet</h3>
            <p>Check back soon, or create a tuition post so teachers can find your request.</p>
            <Link className="tm-member-inline-link" href="/student">Add tuition post <span aria-hidden="true">→</span></Link>
          </div> : <div className="tm-member-grid">
            {availableTeachers.map((teacher) => <article className="tm-member-card" key={teacher.id}>
              <div className="tm-member-card-top"><span className="tm-member-avatar" aria-hidden="true">{teacher.fullName.slice(0, 1).toUpperCase()}</span><span className="tm-member-badge">Verified</span></div>
              <h3>{teacher.fullName}</h3>
              <p className="tm-member-subtitle">{teacher.qualification}</p>
              <div className="tm-member-tags">{teacher.subjects.slice(0, 3).map((subject) => <span key={subject}>{subject}</span>)}</div>
              <p className="tm-member-detail">{teacher.city} · {teacher.teachingLevel} · {teacher.yearsExperience} years experience</p>
              <Link className="tm-member-card-link" href={`/teachers/${teacher.id}`}>View teacher profile <span aria-hidden="true">→</span></Link>
            </article>)}
          </div> : tuitionPosts.length === 0 ? <div className="tm-member-state">
            <h3>No approved tuition posts are available yet</h3>
            <p>New student requests will appear here after they are approved.</p>
          </div> : <div className="tm-member-grid">
            {tuitionPosts.map((post) => <article className="tm-member-card tm-post-card" key={post.id}>
              <div className="tm-member-card-top"><span className="tm-member-badge">Open tuition post</span><span className="tm-post-date">{new Date(post.createdAt).toLocaleDateString()}</span></div>
              <h3>{post.title}</h3>
              <p className="tm-member-subtitle">{post.classLevel} · {post.subject} · {post.numberOfStudents === "Group" ? "Group" : `${post.numberOfStudents} student${post.numberOfStudents === "1" ? "" : "s"}`}</p>
              <p className="tm-member-detail">{post.district}, {post.area} · {post.tuitionType} · {post.daysPerWeek} days/week</p>
              <p className="tm-member-detail">{post.preferredTime} · {post.preferredTeacherGender} teacher</p>
              <p className="tm-post-budget">{formatTuitionBudget(post.salaryMin, post.salaryMax)}</p>
              <p className="tm-post-description">{post.description}</p>
              <Link className="tm-member-card-link" href="/teacher">Open teacher workspace <span aria-hidden="true">→</span></Link>
            </article>)}
          </div>}
        </div>
      </section>}

      {!account && !checkingSession && <>
      <section className="tm-approach tm-section" id="approach">
        <div className="tm-section-heading" data-reveal>
          <p className="tm-kicker tm-kicker-green">A better fit makes all the difference</p>
          <h2>Learning should feel<br /><em>like it’s yours.</em></h2>
          <p className="tm-heading-aside">Not another lesson plan made for everyone. A real person who gets where you are, and helps you get where you want to go.</p>
        </div>
        <div className="tm-steps" data-reveal>
          <article className="tm-step">
            <span className="tm-step-number">01</span>
            <div><h3>Tell us what you need</h3><p>Your subject, your goals, your way of learning. Start with what matters to you.</p></div>
            <span className="tm-step-arrow" aria-hidden="true">↗</span>
          </article>
          <article className="tm-step">
            <span className="tm-step-number">02</span>
            <div><h3>Meet your kind of tutor</h3><p>Explore teachers who bring experience, patience, and the right perspective.</p></div>
            <span className="tm-step-arrow" aria-hidden="true">↗</span>
          </article>
          <article className="tm-step">
            <span className="tm-step-number">03</span>
            <div><h3>Find your momentum</h3><p>Learn at a pace that feels right, online or face to face, one step at a time.</p></div>
            <span className="tm-step-arrow" aria-hidden="true">↗</span>
          </article>
        </div>
      </section>

      <section className="tm-subjects" id="subjects">
        <div className="tm-subjects-inner">
          <div className="tm-subjects-heading" data-reveal>
            <p className="tm-kicker tm-kicker-green">Curiosity has no one subject</p>
            <h2>Make room for<br /><em>the “aha.”</em></h2>
            <p>From the fundamentals to the subjects you can’t stop thinking about, there’s a tutor ready to help it come together.</p>
            <Link className="tm-text-link" href="/auth">Explore your options <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="tm-subject-list" data-reveal>
            {subjects.map(([name, detail], index) => (
              <Link className="tm-subject-row" href="/auth" key={name}>
                <span className="tm-subject-index">0{index + 1}</span>
                <span className="tm-subject-name">{name}</span>
                <span className="tm-subject-detail">{detail}</span>
                <span className="tm-subject-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-tutors" id="tutors">
        <div className="tm-tutor-image" role="img" aria-label="Students learning together around a table" style={{ backgroundImage: `url("${tutorImage}")` }} />
        <div className="tm-tutor-copy" data-reveal>
          <p className="tm-kicker">For the ones who make it click</p>
          <h2>Your experience<br />could be someone’s<br /><em>turning point.</em></h2>
          <p>Bring your subject knowledge and your own way of teaching. Meet students who are ready to grow with you.</p>
          <Link className="tm-button tm-button-paper" href="/auth">Teach with Tuition Media <span aria-hidden="true">↗</span></Link>
        </div>
        <span className="tm-tutor-side-note">Good things grow together&nbsp; / &nbsp;Tuition Media</span>
      </section>

      <section className="tm-last-call" data-reveal>
        <span className="tm-last-flower" aria-hidden="true">✳</span>
        <p className="tm-kicker tm-kicker-green">Your next chapter starts here</p>
        <h2>Let’s make learning<br /><em>feel different.</em></h2>
        <Link className="tm-button tm-button-dark" href="/auth">Find your starting point <span aria-hidden="true">↗</span></Link>
      </section>
      </>}

      <footer className="tm-footer">
        <Link className="tm-brand tm-footer-brand" href="/" aria-label="Tuition Media home">
          <span className="tm-mark" aria-hidden="true">t</span>
          <span>tuition<span className="tm-brand-light">media</span></span>
        </Link>
        <p>{account?.role === "student" ? "Find your next great teacher." : account?.role === "teacher" ? "Find your next tuition opportunity." : "Learning, made personal."}</p>
        <div className="tm-footer-links">{account ? <><Link href={account.role === "student" ? "/student" : "/teacher"}>My workspace</Link><button type="button" onClick={() => void handleSignOut()} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button></> : <><a href="#approach">Our approach</a><a href="#subjects">Subjects</a><Link href="/auth">Sign in</Link></>}</div>
        <span className="tm-copyright">© {new Date().getFullYear()} Tuition Media</span>
      </footer>
    </main>
  );
}