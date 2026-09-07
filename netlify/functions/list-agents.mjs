import { getUser, admin } from "@netlify/identity";

const DOMAIN = "@renti.co";
const PRIMARY_ADMIN_EMAIL = "sontary@renti.co";
function json(data, status = 200) { return Response.json(data, { status }); }
function isAdmin(user) {
  const email=(user?.email||"").toLowerCase();
  return email===PRIMARY_ADMIN_EMAIL || (Array.isArray(user?.roles)&&user.roles.includes("admin"));
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const user = await getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);
  if (!isAdmin(user)) return json({ error: "Forbidden" }, 403);

  const users = await admin.listUsers({ perPage: 1000 });
  const filtered = users
    .filter((u) => (u.email || "").toLowerCase().endsWith(DOMAIN))
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || u.userMetadata?.full_name || "",
      roles: u.roles || u.appMetadata?.roles || [],
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return json({ users: filtered });
};
