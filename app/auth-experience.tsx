"use client";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { type FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CircularLoader from "@/app/circular-loader";
import { auth, db } from "@/lib/firebase";

type Role = "student" | "teacher";
type Mode = "login" | "signup";
type Gender = "Female" | "Male" | "Prefer not to say";
type EducationLevel = "Primary" | "Middle School" | "High School" | "University" | "Other";
type TeachingLevel = Exclude<EducationLevel, "Other">;
type LearningMode = "Online" | "In-person";
type TeachingMode = LearningMode | "Both";
type AccountStatus = "active" | "suspended";
type VerificationStatus = "pending" | "approved" | "rejected";
type Profile = {
  role: Role;
  fullName: string;
  email: string;
  mobileNumber: string;
  gender: Gender;
  city: string;
  createdAt: string;
  accountStatus?: AccountStatus;
  verificationStatus?: VerificationStatus;
  educationLevel?: EducationLevel;
  subjectsNeeded?: string[];
  learningMode?: LearningMode;
  subjects?: string[];
  teachingLevel?: TeachingLevel;
  teachingMode?: TeachingMode;
  yearsExperience?: number;
  qualification?: string;
};

const subjects = ["Math", "English", "Physics", "Chemistry", "Quran", "Arabic", "Biology", "Computer Science"];
const cities = ["Riyadh", "Jeddah", "Dammam", "Makkah", "Madinah", "Khobar", "Abha", "Other"];

function errorMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  switch (code) {
    case "auth/email-already-in-use": return "An account with this email already exists. Try signing in instead.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "That email and password combination wasn't recognised.";
    case "auth/operation-not-allowed": return "Email/password sign-in is disabled for this Firebase project. Enable it under Firebase Console > Authentication > Sign-in method.";
    case "auth/invalid-api-key": return "Firebase rejected this project's API key. Check the NEXT_PUBLIC_FIREBASE_API_KEY value in .env.";
    case "auth/unauthorized-domain": return "This domain is not authorised for Firebase Authentication. Add it under Firebase Console > Authentication > Settings.";
    case "auth/weak-password": return "Choose a password with at least 8 characters.";
    case "auth/too-many-requests": return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed": return "Connection issue. Check your internet and try again.";
    case "permission-denied": return "We couldn't save your profile. Check that Firestore is enabled and its rules are deployed.";
    default: return "Something went wrong. Please try again.";
  }
}

function SelectField({ id, label, options }: { id: string; label: string; options: string[] }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={id} defaultValue="" required>
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}

function SubjectChoices({ role }: { role: Role }) {
  const fieldName = role === "student" ? "subjectsNeeded" : "subjects";
  return (
    <fieldset className="choice-grid field-full">
      <legend className="field-label">{role === "student" ? "Subjects needed" : "Subjects you teach"}</legend>
      {subjects.map((subject) => (
        <label className="choice-chip" key={subject}>
          <input type="checkbox" name={fieldName} value={subject} />{subject}
        </label>
      ))}
    </fieldset>
  );
}

export default function AuthExperience() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const creatingAccount = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    const restore = async () => {
      if (!user) {
        setChecking(false);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, "tutionmedia", user.uid));
        const saved = snapshot.data() as Profile | undefined;
        if (snapshot.exists() && saved?.role) {
          router.replace("/");
        } else if (!creatingAccount.current) {
          await signOut(auth);
        } else {
          setChecking(false);
        }
      } catch {
        setMessage("We couldn't restore your session. Check your connection and sign in again.");
      } finally {
        setChecking(false);
      }
    };
    void restore();
  }), [router]);

  const createAccount = async (account: Profile, password: string) => {
    creatingAccount.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, account.email, password);
      try {
        await updateProfile(credential.user, { displayName: account.fullName });
        await setDoc(doc(db, "tutionmedia", credential.user.uid), account);
        router.replace("/");
      } catch (error) {
        await deleteUser(credential.user).catch(() => undefined);
        throw error;
      }
    } finally {
      creatingAccount.current = false;
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const email = value("email").toLowerCase();
    const password = String(form.get("password") ?? "");

    try {
      if (mode === "login") {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const snapshot = await getDoc(doc(db, "tutionmedia", credential.user.uid));
        const saved = snapshot.data() as Profile | undefined;
        if (!snapshot.exists() || saved?.role !== role) {
          await signOut(auth);
          setMessage(`This email is not registered as a ${role}. Choose the other account type or create a ${role} account.`);
          return;
        }
        if (saved.accountStatus === "suspended") {
          await signOut(auth);
          setMessage("This account is suspended. Contact Tuition Media support for assistance.");
          return;
        }
        router.replace("/");
        return;
      }

      const selectedSubjects = form.getAll(role === "student" ? "subjectsNeeded" : "subjects").map(String);
      if (selectedSubjects.length === 0) {
        setMessage(role === "student" ? "Choose at least one subject you need help with." : "Choose at least one subject you teach.");
        return;
      }

      const mobileInput = value("mobileNumber");
      const common = {
        fullName: value("fullName"),
        email,
        mobileNumber: role === "teacher" ? `+966${mobileInput.replace(/\D/g, "")}` : mobileInput,
        gender: value("gender") as Gender,
        city: value("city"),
        createdAt: new Date().toISOString(),
        accountStatus: "active" as const,
      };

      if (role === "student") {
        await createAccount({
          ...common,
          role,
          educationLevel: value("educationLevel") as EducationLevel,
          subjectsNeeded: selectedSubjects,
          learningMode: value("learningMode") as LearningMode,
        }, password);
      } else {
        await createAccount({
          ...common,
          role,
          subjects: selectedSubjects,
          teachingLevel: value("teachingLevel") as TeachingLevel,
          teachingMode: value("teachingMode") as TeachingMode,
          yearsExperience: Number(value("yearsExperience")),
          qualification: value("qualification"),
          verificationStatus: "pending",
        }, password);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const selectRole = (next: Role) => { setRole(next); setMessage(""); };
  const selectMode = (next: Mode) => { setMode(next); setMessage(""); };

  return (
    <main className="auth-shell">
      <aside className="story-panel" aria-label="Tuition Media">
        <Link className="wordmark" href="/" aria-label="Tuition Media home"><span className="brand-symbol" aria-hidden="true">T</span><span>tuition media</span></Link>
        <div className="story-copy">
          <p className="eyebrow">Learning, made personal</p>
          <h1>Good teaching changes <span>everything.</span></h1>
          <p>Meet the people who make learning feel possible, one lesson at a time.</p>
        </div>
        <div className="book-art" aria-hidden="true"><span className="book book-one" /><span className="book book-two" /><span className="book book-three" /><span className="book book-four" /></div>
        <div className="story-footer"><span aria-hidden="true">✳</span><span>Rooted in Saudi Arabia. Open to every ambition.</span></div>
      </aside>

      <section className="auth-workspace" aria-label="Account access">
        <div className="workspace-top">
          <Link className="wordmark mobile-wordmark" href="/" aria-label="Tuition Media home"><span className="brand-symbol" aria-hidden="true">T</span><span>tuition media</span></Link>
          <span>Learn at your pace. Teach your way.</span>
        </div>

        {checking ? <div className="form-area session-check"><CircularLoader label="Checking your account…" /></div> : (
          <div className="form-area">
            <div className="role-switch" aria-label="Choose account type">
              <button type="button" aria-pressed={role === "student"} onClick={() => selectRole("student")}>I’m a student</button>
              <button type="button" aria-pressed={role === "teacher"} onClick={() => selectRole("teacher")}>I’m a teacher</button>
            </div>
            <div className="form-heading" key={`${role}-${mode}`}>
              <p className="eyebrow">{role === "student" ? "Your learning journey" : "Your teaching journey"}</p>
              <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p>{mode === "login" ? "Sign in to pick up where you left off." : `Join Tuition Media as a ${role}.`}</p>
            </div>
            <div className="mode-switch" aria-label="Choose sign in or sign up">
              <button type="button" aria-pressed={mode === "login"} onClick={() => selectMode("login")}>Sign in</button>
              <button type="button" aria-pressed={mode === "signup"} onClick={() => selectMode("signup")}>Create account</button>
            </div>

            <form className="account-form" key={`${role}-${mode}-form`} onSubmit={submit}>
              {mode === "signup" ? (
                <div className="field-grid">
                  <div className="field field-full"><label htmlFor="fullName">Full name</label><input id="fullName" name="fullName" autoComplete="name" minLength={2} maxLength={100} placeholder="Your full name" required /></div>
                  <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></div>
                  <div className="field"><label htmlFor="mobileNumber">Mobile number</label>
                      {role === "teacher" ? <div className="phone-input"><span className="phone-code">+966</span><input id="mobileNumber" name="mobileNumber" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{8,10}" maxLength={10} placeholder="5XXXXXXXX" required /></div> : <input id="mobileNumber" name="mobileNumber" type="tel" inputMode="tel" autoComplete="tel" pattern="[+]?[0-9 ]{8,20}" placeholder="+966 5X XXX XXXX" required />}
                  </div>
                  <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="At least 8 characters" required /></div>
                  <SelectField id="gender" label="Gender" options={["Female", "Male", "Prefer not to say"]} />
                  {role === "student" ? <>
                    <SelectField id="educationLevel" label="Education level / grade" options={["Primary", "Middle School", "High School", "University", "Other"]} />
                    <SubjectChoices role={role} />
                    <SelectField id="city" label="City" options={cities} />
                    <SelectField id="learningMode" label="Learning mode" options={["Online", "In-person"]} />
                  </> : <>
                    <SubjectChoices role={role} />
                    <SelectField id="teachingLevel" label="Teaching level" options={["Primary", "Middle School", "High School", "University"]} />
                    <SelectField id="teachingMode" label="Teaching mode" options={["Online", "In-person", "Both"]} />
                    <SelectField id="city" label="City" options={cities} />
                    <div className="field"><label htmlFor="yearsExperience">Years of experience</label><input id="yearsExperience" name="yearsExperience" type="number" min="0" max="60" step="1" placeholder="e.g. 5" required /></div>
                    <div className="field"><label htmlFor="qualification">Qualification / degree</label><input id="qualification" name="qualification" maxLength={120} placeholder="e.g. BSc Mathematics" required /></div>
                  </>}
                </div>
              ) : <div className="field-grid">
                <div className="field field-full"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></div>
                <div className="field field-full"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
              </div>}
              {message && <p className="form-message" role="alert">{message}</p>}
              <button className="submit-button" type="submit" disabled={busy}>{busy && <CircularLoader label="Please wait" inline decorative />}{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
              <p className="form-note">Your password is protected by Firebase Authentication and is never stored in your profile.</p>
            </form>
          </div>
        )}
        <footer className="workspace-footer">© {new Date().getFullYear()} Tuition Media · Secure account access</footer>
      </section>
    </main>
  );
}