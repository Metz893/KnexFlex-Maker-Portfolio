import { NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();

function clean(v: any): any {
  // Firestore Timestamp -> JSON-safe
  if (v && typeof v === "object" && typeof v.toDate === "function") {
    const d = v.toDate();
    return { _type: "timestamp", iso: d.toISOString(), ms: d.getTime() };
  }
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) out[k] = clean(val);
    return out;
  }
  return v;
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(match[1]);

    // 🔒 only admins can use this route
    if (decoded.admin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const collection = searchParams.get("collection") || "sessions";
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const snap = await adminDb.collection(collection).doc(sessionId).get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = clean({ id: snap.id, path: snap.ref.path, ...snap.data() });

    return new NextResponse(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="session_${sessionId}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}