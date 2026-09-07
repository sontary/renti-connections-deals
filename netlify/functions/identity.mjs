const DOMAIN = "@renti.co";
const PRIMARY_ADMIN_EMAIL = "sontary@renti.co";

function allowed(email) {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(DOMAIN);
}

export default {
  userValidate(event) {
    if (!allowed(event.user?.email)) return event.deny();
  },

  userSignup(event) {
    if (!allowed(event.user?.email)) return event.deny();
    const email = event.user.email.toLowerCase();
    const existingRoles = Array.isArray(event.user.appMetadata?.roles) ? event.user.appMetadata.roles : [];
    const roles = existingRoles.length ? existingRoles : [email === PRIMARY_ADMIN_EMAIL ? "admin" : "agent"];
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...(event.user.appMetadata || {}),
          roles,
        },
      },
    };
  },

  userLogin(event) {
    if (!allowed(event.user?.email)) return event.deny();
  },
};
