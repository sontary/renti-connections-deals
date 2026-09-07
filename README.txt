RENTI CONNECTIONS - LIVE PORTAL BUILD

This build includes:
- Netlify Identity / Google agent login
- Invite-only @renti.co access
- Sontary-only Agents & Access controls
- Comparison / Products / Me tabs
- 2-hour inactivity logout
- provider + power + broadband package comparisons
- editable email preview and recommendations
- Gmail OAuth connection per agent
- sending from each agent's own Gmail
- Gmail signature retrieval when 'Use my Gmail signature' is selected
- same-thread follow-up comparisons for the same agent + customer email + property address
- server-side token/thread storage using Netlify Blobs

GOOGLE CLOUD SETUP (do this before the final deploy)

1. Create or select a Google Cloud project, e.g. 'Renti Connections'.
2. Enable the Gmail API.
3. In Google Auth Platform, set up the OAuth app:
   - App name: Renti Connections
   - Audience: Internal
   - Support/developer email: your Renti email
4. Add these scopes under Data Access:
   - openid
   - email
   - https://www.googleapis.com/auth/gmail.send
   - https://www.googleapis.com/auth/gmail.settings.basic
5. Create an OAuth Client:
   - Application type: Web application
   - Name: Renti Connections Agent Portal
   - Authorized redirect URI:
     https://renti-connections-deals.netlify.app/.netlify/functions/gmail-oauth-callback
6. Copy the Client ID and Client Secret. Do NOT put them in the HTML or send them in chat.

NETLIFY ENVIRONMENT VARIABLES

In Netlify > Project configuration > Environment variables, add:

GOOGLE_GMAIL_CLIENT_ID = <your Google OAuth Client ID>
GOOGLE_GMAIL_CLIENT_SECRET = <your Google OAuth Client Secret>

Make sure they are available to Functions.

IMPORTANT
- Keep Netlify Identity Registration = Invite only.
- Keep Google enabled as the Netlify Identity external provider.
- The Gmail OAuth app is separate from the Netlify default Google login.
- Gmail access requested by this build is limited to sending email and reading the agent's Gmail signature settings. It does not request inbox-reading access.
- When the first comparison is sent, the portal saves Gmail's thread ID plus reply headers. Later comparisons for the same agent + customer email + property address are sent back into that same Gmail thread.

DEPLOYMENT

This is no longer a static HTML-only site because it contains Netlify Functions and server-side storage. Deploy the PROJECT ROOT (the folder containing netlify.toml, package.json, public/, and netlify/functions/) using a Netlify build-capable deployment method such as Git-connected deployment or Netlify CLI/API. A plain static Netlify Drop of only index.html will not deploy the Functions.

The publish directory is configured as: public
The Functions directory is configured as: netlify/functions

UPDATE 2026-09-07
- Customer email preview and Gmail-sent comparison now share the same inline-styled card layout.
- Added a dynamic power estimate breakdown table showing daily charge, rates, estimated usage and line costs.
- Power rows only appear when relevant; GST handling is labelled clearly.
- Improved mobile sizing for the customer bill-comparison Yes/No controls.
- Gmail signature insertion remains supported without adding a top email logo/header.


V4 updates (7 Sep 2026)
- Provider cards no longer stretch to the height of an expanded neighbouring card; only the selected provider grows.
- 2degrees expired extra $50 manual credit removed.
- 2degrees fibre pricing now: 100/20 $70; 500/100 $101 + $100 joining credit; 900/500 $116 + $100 joining credit; optional modem $5/mo; $15 one-off delivery fee.
- 2degrees deal validity copy now says: Deals valid until further notice.

V5 provider/service rules update:
- Contact Energy: power requires broadband; broadband products are separated from power plans.
- Electric Kiwi: power only, broadband only, or power + broadband.
- Pulse: power only or power + broadband; no broadband-only agent option.
- 2degrees: broadband only or power + broadband; no power-only agent option.
- Broadband comparison includes modem choice, recurring modem costs in monthly/package totals, and one-off modem purchase shown separately (not added to total).
- Genesis: power requires LPG; LPG-only option available. LPG defaults: $175/bottle LPG-only, $155/bottle with power, $11.50/month rental for two bottles. Agent can set estimated bottle quantity.


V10 audited/hardening update:
- Hardened all frontend Netlify Function response parsing so HTML error pages no longer trigger raw JSON parser errors.
- Gmail status, disconnect, send, agent list, invite and remove now surface readable function errors.
- Gmail OAuth start keeps signed-state validation and returns JSON errors.
- Static syntax validation completed for all Netlify Functions and both inline browser scripts.
- Verified all frontend function routes have matching deployed function files.
