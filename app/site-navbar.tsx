"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import CircularLoader from "@/app/circular-loader";
import { auth, db } from "@/lib/firebase";

type NavbarAccount = {
  role: "student" | "teacher";
};

export default function SiteNavbar() {
  const [account, setAccount] = useState<NavbarAccount | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    let current = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (current) setCheckingAccount(true);
      if (!user) {
        if (current) {
          setAccount(null);
          setAccountError("");
          setCheckingAccount(false);
        }
        return;
      }

      try {
        const profile = await getDoc(doc(db, "tutionmedia", user.uid));
        const data = profile.data();
        const isActiveStudent = data?.role === "student" && data.accountStatus === "active";
        const isApprovedTeacher = data?.role === "teacher"
          && data.accountStatus === "active"
          && data.verificationStatus === "approved";
        if (!current) return;
        setAccount(isActiveStudent ? { role: "student" } : isApprovedTeacher ? { role: "teacher" } : null);
        setAccountError("");
        setCheckingAccount(false);
      } catch {
        if (!current) return;
        setAccount(null);
        setAccountError("Could not load account navigation. Refresh the page or check your connection.");
        setCheckingAccount(false);
      }
    });

    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    setAccountError("");
    try {
      await signOut(auth);
      setAccount(null);
    } catch {
      setAccountError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <header className="site-navbar">
        <Link className="site-navbar-brand" href="/" aria-label="Tuition Media home">
          <span className="site-navbar-mark" aria-hidden="true">t</span>
          <span>tuition<span className="site-navbar-brand-light">media</span></span>
        </Link>
        <nav className="site-navbar-links" aria-label="Main navigation">
          {account ? (
            <>
              <Link href="/">Home</Link>
              <Link href={account.role === "student" ? "/teachers" : "/teacher"}>
                {account.role === "student" ? "Available teachers" : "Tuition posts"}
              </Link>
            </>
          ) : checkingAccount ? (
            <span className="site-navbar-checking"><CircularLoader label="Checking account…" inline /></span>
          ) : (
            <>
              <Link href="/">Home</Link>
              <Link href="/#approach">Our approach</Link>
              <Link href="/teachers">Find teachers</Link>
              <Link href="/teacher">For tutors</Link>
            </>
          )}
        </nav>
        {account ? (
          <div className="site-navbar-account-actions">
            <span className="site-navbar-role">{account.role} account</span>
            <Link className="site-navbar-workspace" href={account.role === "student" ? "/student" : "/teacher"}>My workspace</Link>
            <button className="site-navbar-action" type="button" onClick={() => void handleSignOut()} disabled={signingOut}>
              {signingOut && <CircularLoader label="Signing out" inline decorative />}{signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : checkingAccount ? (
          <span className="site-navbar-action-pending" aria-hidden="true" />
        ) : (
          <Link className="site-navbar-action" href="/auth">
            Sign in<span aria-hidden="true">↗</span>
          </Link>
        )}
      </header>
      {accountError && <p className="site-navbar-error" role="status">{accountError}</p>}
    </>
  );
}
