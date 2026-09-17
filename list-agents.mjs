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

  try {
    const users = await admin.listUsers();
    if (!Array.isArray(users)) return json({ error: "Identity returned an unexpected user list." }, 502);
    const filtered = users
      .filter((u) => (u?.email || "").toLowerCase().endsWith(DOMAIN))
      .map((u) => {
        const roles = u.roles || u.appMetadata?.roles || u.app_metadata?.roles || [];
        const confirmed = u.confirmedAt || u.confirmed_at || u.lastSignInAt || u.last_sign_in_at;
        return {
          id: u.id,
          email: u.email,
          name: u.name || u.userMetadata?.full_name || u.user_metadata?.full_name || "",
          roles: Array.isArray(roles) ? roles : [],
          status: confirmed ? "active" : "invited",
          invitedAt: u.invitedAt || u.invited_at || null,
          confirmedAt: u.confirmedAt || u.confirmed_at || null,
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    return json({ users: filtered });
  } catch (error) {
    console.error("list-agents failed", error);
    return json({ error: "Could not load agents from Netlify Identity. Check the Function log for list-agents." }, 500);
  }
};
