import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminCookieName, createAdminSession, validAdminSession } from "@/lib/admin-session";

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
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json({ error: "Admin login is not configured on the server. Set ADMIN_PASSWORD." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  if (attempts && now - attempts.windowStart < attemptWindowMs && attempts.count >= 5) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (!attempts || now - attempts.windowStart >= attemptWindowMs) loginAttempts.set(ip, { count: 0, windowStart: now });
  let submittedPassword = "";
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password === "string") submittedPassword = body.password;
  } catch {
    return NextResponse.json({ error: "Enter the admin password." }, { status: 400 });
  }

  const expected = createHash("sha256").update(configuredPassword).digest();
  const supplied = createHash("sha256").update(submittedPassword).digest();
  if (!submittedPassword || !timingSafeEqual(expected, supplied)) {
    const current = loginAttempts.get(ip);
    loginAttempts.set(ip, {
      count: (current?.count ?? 0) + 1,
      windowStart: current?.windowStart ?? now,
    });
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  loginAttempts.delete(ip);

  try {
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(adminCookieName, createAdminSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Admin session signing is not configured. Set ADMIN_SESSION_SECRET." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminCookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}