import { getUser, getIdentityConfig } from "@netlify/identity";

const DOMAIN = "@renti.co";
const PRIMARY_ADMIN_EMAIL = "sontary@renti.co";

function json(data, status = 200) { return Response.json(data, { status }); }
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}
function isAdmin(user) {
  const email = (user?.email || "").toLowerCase();
  return email === PRIMARY_ADMIN_EMAIL || (Array.isArray(user?.roles) && user.roles.includes("admin"));
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!sameOrigin(req)) return json({ error: "Invalid request origin" }, 403);

  const user = await getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);
  if (!isAdmin(user)) return json({ error: "You do not have permission to invite agents." }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const email = String(body?.email || "").trim().toLowerCase();
  const role = body?.role === "admin" ? "admin" : "agent";
  if (!email.endsWith(DOMAIN) || email.length <= DOMAIN.length) {
    return json({ error: "Only @renti.co email addresses can be invited." }, 400);
  }

  const identity = getIdentityConfig();
  if (!identity?.url || !identity?.token) return json({ error: "Netlify Identity is not available for this deploy." }, 503);

  const inviteResponse = await fetch(`${identity.url}/invite`, {
    method: "POST",
    headers: { authorization: `Bearer ${identity.token}`, "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });

  let invited = null;
  try { invited = await inviteResponse.json(); } catch {}
  if (!inviteResponse.ok) {
    let detail = invited?.msg || invited?.error_description || invited?.error || "Invite could not be sent.";
    if (/already|registered|exists/i.test(detail)) detail = "That email already has portal access or a pending invite.";
    return json({ error: detail }, inviteResponse.status >= 400 && inviteResponse.status < 600 ? inviteResponse.status : 500);
  }

  if (invited?.id) {
    const appMetadata = { ...(invited.app_metadata || {}), roles: [role] };
    const roleResponse = await fetch(`${identity.url}/admin/users/${invited.id}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${identity.token}`, "content-type": "application/json" },
      body: JSON.stringify({ app_metadata: appMetadata }),
    });
    if (!roleResponse.ok) {
      return json({ error: "The invite was sent, but the access level could not be saved. Set the role in Netlify Identity before they log in." }, 500);
    }
  }

  return json({ ok: true, email, role });
};
