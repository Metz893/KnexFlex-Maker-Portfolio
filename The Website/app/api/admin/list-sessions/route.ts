import { NextResponse } from "next/server";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();

export async function GET(req: Request) {
  try {
    // auth
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(match[1]);
    if (decoded.admin !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);

    const collection = searchParams.get("collection") || "sessions";
    const email = searchParams.get("email")?.trim() || "";
    const ownerUidParam = searchParams.get("ownerUid")?.trim() || "";

    const fromMs = Number(searchParams.get("fromMs") || "0");
    const toMs = Number(searchParams.get("toMs") || "0");
    const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);

    // resolve email -> uid if provided
    let ownerUid = ownerUidParam;
    if (!ownerUid && email) {
      const u = await adminAuth.getUserByEmail(email);
      ownerUid = u.uid;
    }

    // Build query (assumes sessions docs have ownerUid; if not, see note at bottom)
    let q: FirebaseFirestore.Query = adminDb.collection(collection);

    if (ownerUid) q = q.where("ownerUid", "==", ownerUid);

    if (Number.isFinite(fromMs) && fromMs > 0) q = q.where("createdAtMs", ">=", fromMs);
    if (Number.isFinite(toMs) && toMs > 0) q = q.where("createdAtMs", "<", toMs);

    q = q.orderBy("createdAtMs", "desc").limit(limit);

    const snap = await q.get();

    const rows = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ownerUid: data.ownerUid ?? null,
        title: data.displayName ?? data.title ?? d.id,
        createdAtMs: data.createdAtMs ?? null,
        sampleCount: data.sampleCount ?? null,
        sessionType: data.sessionType ?? null,
      };
    });

    return NextResponse.json({ rows, ownerUidResolved: ownerUid || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}