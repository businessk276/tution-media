import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-session";
import { getAdminServices } from "@/lib/firebase-admin";

const profileFields = new Set([
  "fullName", "email", "mobileNumber", "gender", "city", "educationLevel",
  "subjectsNeeded", "learningMode", "subjects", "teachingLevel", "teachingMode",
  "yearsExperience", "qualification", "accountStatus", "verificationStatus",
]);
const postFields = new Set([
  "title", "classLevel", "subject", "numberOfStudents", "preferredTeacherGender",
  "daysPerWeek", "preferredTime", "salaryMin", "salaryMax", "district", "area",
  "tuitionType", "studentGender", "description", "contactNumber", "status",
]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown server error.";
  if (message.includes("Firebase Admin credentials")) return NextResponse.json({ error: "Firebase Admin credentials are not configured on the server." }, { status: 503 });
  return NextResponse.json({ error: "The admin request could not be completed." }, { status: 500 });
}

async function requireAdmin() {
  return hasAdminSession();
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const { db } = getAdminServices();
    const [usersSnapshot, postsSnapshot] = await Promise.all([
      db.collection("tutionmedia").get(),
      db.collection("tuitionPosts").get(),
    ]);
    return NextResponse.json({
      users: usersSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
      posts: postsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; role?: string; password?: string; profile?: Record<string, unknown> };
    if (body.action !== "create-user" || !body.profile || !["student", "teacher"].includes(String(body.role))) {
      return NextResponse.json({ error: "Invalid user request." }, { status: 400 });
    }
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
      return NextResponse.json({ error: "Temporary password must be 8–128 characters." }, { status: 400 });
    }
    const profile = body.profile;
    const role = body.role as "student" | "teacher";
    const fullName = typeof profile.fullName === "string" ? profile.fullName.trim() : "";
    const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid name and email address." }, { status: 400 });
    }
    const requiredFields = role === "student"
      ? ["mobileNumber", "gender", "city", "educationLevel", "subjectsNeeded", "learningMode"]
      : ["mobileNumber", "gender", "city", "subjects", "teachingLevel", "teachingMode", "yearsExperience", "qualification"];
    if (requiredFields.some((field) => profile[field] === undefined || profile[field] === "")) {
      return NextResponse.json({ error: "Complete all required role-specific profile fields." }, { status: 400 });
    }
    const allowedFields = role === "student"
      ? new Set(["fullName", "email", "mobileNumber", "gender", "city", "educationLevel", "subjectsNeeded", "learningMode"])
      : new Set(["fullName", "email", "mobileNumber", "gender", "city", "subjects", "teachingLevel", "teachingMode", "yearsExperience", "qualification"]);
    if (Object.keys(profile).some((field) => !allowedFields.has(field))) {
      return NextResponse.json({ error: "Unsupported profile fields." }, { status: 400 });
    }
    const subjects = role === "student" ? profile.subjectsNeeded : profile.subjects;
    const validGender = ["Female", "Male", "Prefer not to say"].includes(String(profile.gender));
    const validMobile = typeof profile.mobileNumber === "string" && /^[+0-9 ()-]{8,20}$/.test(profile.mobileNumber);
    const validRoleFields = role === "student"
      ? ["Primary", "Middle School", "High School", "University", "Other"].includes(String(profile.educationLevel))
        && ["Online", "In-person"].includes(String(profile.learningMode))
      : ["Primary", "Middle School", "High School", "University"].includes(String(profile.teachingLevel))
        && ["Online", "In-person", "Both"].includes(String(profile.teachingMode))
        && Number.isInteger(profile.yearsExperience)
        && Number(profile.yearsExperience) >= 0
        && Number(profile.yearsExperience) <= 60
        && typeof profile.qualification === "string"
        && profile.qualification.trim().length >= 2
        && profile.qualification.trim().length <= 120;
    if (!Array.isArray(subjects) || subjects.length === 0 || !subjects.every((subject) => typeof subject === "string") || !validMobile || !validGender || !validRoleFields || typeof profile.city !== "string" || !profile.city.trim()) {
      return NextResponse.json({ error: "Provide a valid mobile number and at least one subject." }, { status: 400 });
    }

    const { auth, db } = getAdminServices();
    const created = await auth.createUser({ email, password: body.password, displayName: fullName });
    const common = { ...profile, role, fullName, email, accountStatus: "active", createdAt: new Date().toISOString() };
    const account = role === "teacher"
      ? { ...common, verificationStatus: "pending" }
      : common;
    try {
      await db.collection("tutionmedia").doc(created.uid).set(account);
    } catch (error) {
      await auth.deleteUser(created.uid).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ id: created.uid }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; id?: string; status?: string; changes?: Record<string, unknown> };
    const { auth, db } = getAdminServices();

    if (body.action === "update-user" && body.id && body.changes) {
      const profileRef = db.collection("tutionmedia").doc(body.id);
      const snapshot = await profileRef.get();
      if (!snapshot.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });
      const current = snapshot.data() ?? {};
      const changes = body.changes;
      if (Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !profileFields.has(key))) {
        return NextResponse.json({ error: "Unsupported profile fields." }, { status: 400 });
      }
      if (changes.accountStatus !== undefined && !["active", "suspended"].includes(String(changes.accountStatus))) {
        return NextResponse.json({ error: "Invalid account status." }, { status: 400 });
      }
      if (changes.verificationStatus !== undefined && !["pending", "approved", "rejected"].includes(String(changes.verificationStatus))) {
        return NextResponse.json({ error: "Invalid verification status." }, { status: 400 });
      }
      if (changes.email !== undefined && typeof changes.email === "string") {
        await auth.updateUser(body.id, { email: changes.email.toLowerCase() });
        changes.email = changes.email.toLowerCase();
      }
      if (changes.fullName !== undefined && typeof changes.fullName === "string") {
        const fullName = changes.fullName.trim();
        if (fullName.length < 2 || fullName.length > 100) return NextResponse.json({ error: "Name must be 2–100 characters." }, { status: 400 });
        changes.fullName = fullName;
        await auth.updateUser(body.id, { displayName: fullName });
      }
      if (current.role !== "teacher" && changes.verificationStatus !== undefined) return NextResponse.json({ error: "Only teacher accounts have verification status." }, { status: 400 });
      await profileRef.update(changes);
      return NextResponse.json({ updated: true });
    }

    if (body.action === "review-post" && body.id && ["approved", "rejected"].includes(String(body.status))) {
      await db.collection("tuitionPosts").doc(body.id).update({ status: body.status, reviewedAt: new Date().toISOString() });
      return NextResponse.json({ updated: true });
    }

    if (body.action === "update-post" && body.id && body.changes) {
      if (Object.keys(body.changes).length === 0 || Object.keys(body.changes).some((key) => !postFields.has(key))) {
        return NextResponse.json({ error: "Unsupported tuition post fields." }, { status: 400 });
      }
      await db.collection("tuitionPosts").doc(body.id).update({ ...body.changes, updatedAt: new Date().toISOString() });
      return NextResponse.json({ updated: true });
    }

    return NextResponse.json({ error: "Unsupported admin action." }, { status: 400 });
  } catch (error) { return failure(error); }
}

async function deleteMatching(db: FirebaseFirestore.Firestore, collectionName: string, field: string, value: string) {
  const query = db.collection(collectionName).where(field, "==", value);
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    if (snapshot.size < 400) return;
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await requireAdmin()) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const body = await request.json() as { type?: string; id?: string };
    if (!body.id || !["user", "post"].includes(String(body.type))) return NextResponse.json({ error: "Invalid delete request." }, { status: 400 });
    const { auth, db } = getAdminServices();
    if (body.type === "user") {
      const user = await db.collection("tutionmedia").doc(body.id).get();
      if (!user.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });
      if (user.data()?.role === "student") await deleteMatching(db, "tuitionPosts", "createdBy", body.id);
      if (user.data()?.role === "teacher") await deleteMatching(db, "applications", "teacherId", body.id);
      await db.collection("tutionmedia").doc(body.id).delete();
      await auth.deleteUser(body.id).catch((error: unknown) => {
        if (!(error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found")) throw error;
      });
    } else {
      await deleteMatching(db, "applications", "postId", body.id);
      await db.collection("tuitionPosts").doc(body.id).delete();
    }
    return NextResponse.json({ deleted: true });
  } catch (error) { return failure(error); }
}