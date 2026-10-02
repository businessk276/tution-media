import { NextResponse } from "next/server";
import { adminCookieName, createAdminSession, validAdminSession } from "@/lib/admin-session";
import { getAdminServices } from "@/lib/firebase-admin";

const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const attemptWindowMs = 15 * 60 * 1000;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function GET(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${adminCookieName}=`))?.slice(adminCookieName.length + 1);
  try {
    return NextResponse.json({ authenticated: validAdminSession(token) });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  if (attempts && now - attempts.windowStart < attemptWindowMs && attempts.count >= 5) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (!attempts || now - attempts.windowStart >= attemptWindowMs) loginAttempts.set(ip, { count: 0, windowStart: now });
  const allowedEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (allowedEmails.length === 0) return NextResponse.json({ error: "Configure at least one Firebase admin email in ADMIN_EMAILS." }, { status: 503 });
  const authorization = request.headers.get("authorization");
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) return NextResponse.json({ error: "Firebase sign-in required." }, { status: 401 });

  let email = "";
  try {
    const { auth } = getAdminServices();
    const decoded = await auth.verifyIdToken(idToken, true);
    email = decoded.email?.toLowerCase() ?? "";
    if (!email || !decoded.email_verified) {
      return NextResponse.json({ error: "Verify this Firebase account's email address, then sign in again." }, { status: 403 });
    }
    if (!allowedEmails.includes(email)) {
      return NextResponse.json({ error: "This Firebase email is not listed in ADMIN_EMAILS." }, { status: 403 });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Firebase Admin credentials are not configured")) {
      return NextResponse.json({ error: "Firebase Admin is not configured. Add FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY to .env.local, then restart Next.js." }, { status: 503 });
    }
    const current = loginAttempts.get(ip);
    loginAttempts.set(ip, { count: (current?.count ?? 0) + 1, windowStart: current?.windowStart ?? now });
    return NextResponse.json({ error: "Firebase sign-in could not be verified. Check your Firebase Admin configuration and try again." }, { status: 401 });
  }
  loginAttempts.delete(ip);

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(adminCookieName, createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return response;
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminCookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}