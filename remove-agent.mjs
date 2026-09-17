import { getUser, admin } from "@netlify/identity";

const PRIMARY_ADMIN_EMAIL = "sontary@renti.co";
function json(data, status = 200) { return Response.json(data, { status }); }
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}
function isAdmin(user) {
  const email=(user?.email||"").toLowerCase();
  return email===PRIMARY_ADMIN_EMAIL || (Array.isArray(user?.roles)&&user.roles.includes("admin"));
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!sameOrigin(req)) return json({ error: "Invalid request origin" }, 403);

  const user = await getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);
  if (!isAdmin(user)) return json({ error: "Forbidden" }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const id = String(body?.id || "").trim();
  if (!id) return json({ error: "Missing user id." }, 400);

  const target = await admin.getUser(id);
  const targetEmail=(target.email||"").toLowerCase();
  if (targetEmail === PRIMARY_ADMIN_EMAIL) return json({ error: "Sontary's access cannot be removed here." }, 400);
  if (targetEmail === (user.email||"").toLowerCase()) return json({ error: "You cannot remove your own access while signed in." }, 400);

  await admin.deleteUser(id);
  return json({ ok: true });
};
