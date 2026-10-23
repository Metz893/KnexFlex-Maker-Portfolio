import { auth } from "@/lib/firebase";

export async function downloadSessionJson(sessionId: string, collection: string = "sessions") {
  const token = await auth.currentUser?.getIdToken(true);
  if (!token) throw new Error("Not logged in");

  const res = await fetch(
    `/api/admin/export-session?collection=${encodeURIComponent(collection)}&sessionId=${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Export failed");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `session_${sessionId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}