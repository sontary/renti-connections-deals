import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';

const PRIMARY_ADMIN_EMAIL = 'sontary@renti.co';
const CATEGORIES = ['power', 'gas', 'broadband', 'mobile', 'bundle'];
const TERM_TYPES = ['open', 'fixed', 'mixed'];

function json(data, status = 200) { return Response.json(data, { status, headers: { 'cache-control': 'no-store' } }); }
function sameOrigin(req) { const origin = req.headers.get('origin'); return !origin || origin === new URL(req.url).origin; }
function emailOf(user) { return String(user?.email || '').trim().toLowerCase(); }
function rolesOf(user) { return Array.isArray(user?.roles) ? user.roles : []; }
function validCatalogRecord(record) { return Array.isArray(record?.catalog?.providers) && record.catalog.providers.length > 0; }
function isPrimary(user) { return emailOf(user) === PRIMARY_ADMIN_EMAIL; }
function isAdmin(user) { return isPrimary(user) || rolesOf(user).includes('admin'); }
function cleanText(value, max = 5000) { return String(value ?? '').trim().slice(0, max); }
function cleanHtml(value) {
  return cleanText(value, 30000)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}
function slug(value) {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function cleanOption(option, index, keepDraftFlags = false) {
  const monthlyPrice = option?.monthlyPrice === '' || option?.monthlyPrice == null ? null : Number(option.monthlyPrice);
  const result = {
    id: slug(option?.id || option?.label || `option-${index + 1}`),
    label: cleanText(option?.label, 300),
    category: CATEGORIES.includes(option?.category) ? option.category : undefined,
    bullets: Array.isArray(option?.bullets) ? option.bullets.map(x => cleanText(x, 500)).filter(Boolean).slice(0, 30) : [],
    monthlyPrice: Number.isFinite(monthlyPrice) && monthlyPrice >= 0 ? monthlyPrice : null,
    benefit: cleanText(option?.benefit, 500),
    archived: option?.archived === true,
  };
  if (keepDraftFlags && option?._draftNew === true) result._draftNew = true;
  return result;
}
function cleanAxis(axis, fallbackKey, fallbackLabel, keepDraftFlags = false) {
  if (!axis || !Array.isArray(axis.options)) return null;
  return {
    key: slug(axis.key || fallbackKey),
    label: cleanText(axis.label || fallbackLabel, 120),
    options: axis.options.map((option, index) => cleanOption(option, index, keepDraftFlags)).filter(x => x.id && x.label).slice(0, 100),
  };
}
function cleanProvider(provider, index, keepDraftFlags = false) {
  const id = slug(provider?.id || provider?.name || `provider-${index + 1}`);
  const categories = Array.isArray(provider?.categories) ? provider.categories.filter(x => CATEGORIES.includes(x)) : [];
  const result = {
    id,
    name: cleanText(provider?.name, 120),
    color: /^#[0-9a-f]{6}$/i.test(provider?.color || '') ? provider.color : '#4A1942',
    initials: cleanText(provider?.initials, 12),
    categories: [...new Set(categories)],
    recommended: provider?.recommended === true,
    exclusive: provider?.exclusive === true,
    term: cleanText(provider?.term, 160),
    termType: TERM_TYPES.includes(provider?.termType) ? provider.termType : 'mixed',
    validity: cleanHtml(provider?.validity),
    headline: cleanHtml(provider?.headline),
    details: cleanHtml(provider?.details),
    archived: provider?.archived === true,
  };
  if (keepDraftFlags && provider?._draftNew === true) result._draftNew = true;
  if (Array.isArray(provider?.plans)) result.plans = provider.plans.map((option, optionIndex) => cleanOption(option, optionIndex, keepDraftFlags)).filter(x => x.id && x.label).slice(0, 150);
  const planA = cleanAxis(provider?.planA, 'primary', 'Primary plan', keepDraftFlags);
  const planB = cleanAxis(provider?.planB, 'secondary', 'Secondary plan', keepDraftFlags);
  if (planA) result.planA = planA;
  if (planB) result.planB = planB;
  if (provider?.modemAxis && Array.isArray(provider.modemAxis.options)) {
    result.modemAxis = {
      label: cleanText(provider.modemAxis.label || 'Modem', 120),
      infoOnly: provider.modemAxis.infoOnly === true,
      options: provider.modemAxis.options.map((option, optionIndex) => cleanOption(option, optionIndex, keepDraftFlags)).filter(x => x.id && x.label).slice(0, 50),
    };
  }
  return result;
}
function cleanPromotion(promotion, index, providerIds, keepDraftFlags = false) {
  const providerId = slug(promotion?.providerId);
  if (!providerIds.has(providerId)) return null;
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';
  const startDate = date(promotion?.startDate);
  const endDate = date(promotion?.endDate);
  if (!startDate || !endDate || endDate < startDate) return null;
  const promotionalMonthlyPrice = promotion?.promotionalMonthlyPrice === '' || promotion?.promotionalMonthlyPrice == null ? null : Number(promotion.promotionalMonthlyPrice);
  const result = {
    id: slug(promotion?.id || `${providerId}-promotion-${index + 1}`),
    providerId,
    planId: slug(promotion?.planId),
    name: cleanText(promotion?.name, 160),
    headline: cleanHtml(promotion?.headline),
    customerSummary: cleanText(promotion?.customerSummary, 2000),
    agentNotes: cleanText(promotion?.agentNotes, 2000),
    replacementPlanLabel: cleanText(promotion?.replacementPlanLabel, 300),
    promotionalMonthlyPrice: Number.isFinite(promotionalMonthlyPrice) && promotionalMonthlyPrice >= 0 ? promotionalMonthlyPrice : null,
    startDate,
    endDate,
    archived: promotion?.archived === true,
  };
  if (keepDraftFlags && promotion?._draftNew === true) result._draftNew = true;
  return result;
}
function cleanStandardChange(change, index, providerIds, keepDraftFlags = false) {
  const providerId = slug(change?.providerId);
  if (!providerIds.has(providerId)) return null;
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(change?.effectiveDate || '') ? change.effectiveDate : '';
  if (!effectiveDate) return null;
  const nullableNumber = value => {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const result = {
    id: slug(change?.id || `${providerId}-standard-change-${index + 1}`),
    providerId,
    planId: slug(change?.planId),
    name: cleanText(change?.name, 160),
    effectiveDate,
    planFields: {
      monthlyPrice: nullableNumber(change?.planFields?.monthlyPrice),
    },
    standardPricing: {
      lpgBottlePrice: nullableNumber(change?.standardPricing?.lpgBottlePrice),
      lpgRentalMonthly: nullableNumber(change?.standardPricing?.lpgRentalMonthly),
    },
    archived: change?.archived === true,
  };
  if (keepDraftFlags && change?._draftNew === true) result._draftNew = true;
  return result;
}
function cleanCatalog(input, keepDraftFlags = false) {
  const providers = Array.isArray(input?.providers) ? input.providers.map((provider, index) => cleanProvider(provider, index, keepDraftFlags)).filter(x => x.id && x.name && x.categories.length).slice(0, 100) : [];
  const ids = new Set();
  for (const p of providers) {
    if (ids.has(p.id)) throw new Error(`Provider id “${p.id}” is used more than once.`);
    ids.add(p.id);
  }
  if (!providers.length) throw new Error('The catalogue must contain at least one provider.');
  const promotions = Array.isArray(input?.promotions) ? input.promotions.map((p, i) => cleanPromotion(p, i, ids, keepDraftFlags)).filter(Boolean).slice(0, 300) : [];
  const standardChanges = Array.isArray(input?.standardChanges) ? input.standardChanges.map((change, index) => cleanStandardChange(change, index, ids, keepDraftFlags)).filter(Boolean).slice(0, 500) : [];
  return { schemaVersion: 2, providers, promotions, standardChanges };
}
function unfinishedNewItem(input) {
  const providers = Array.isArray(input?.providers) ? input.providers : [];
  for (const provider of providers) {
    if (provider?.archived !== true && provider?._draftNew === true && cleanText(provider?.name, 120) === 'New provider') return 'new provider';
    const optionGroups = [provider?.plans, provider?.planA?.options, provider?.planB?.options, provider?.modemAxis?.options];
    if (optionGroups.some(options => Array.isArray(options) && options.some(option => option?.archived !== true && option?._draftNew === true && cleanText(option?.label, 300) === 'New option'))) return 'new option';
  }
  const promotions = Array.isArray(input?.promotions) ? input.promotions : [];
  if (promotions.some(promotion => promotion?.archived !== true && promotion?._draftNew === true && cleanText(promotion?.name, 160) === 'New promotion')) return 'new promotion';
  const standardChanges = Array.isArray(input?.standardChanges) ? input.standardChanges : [];
  if (standardChanges.some(change => change?.archived !== true && change?._draftNew === true && cleanText(change?.name, 160) === 'New standard change')) return 'new standard change';
  return '';
}

async function accessRecord(store) {
  return (await store.get('access', { type: 'json' })) || { editors: [] };
}
async function canEdit(user, store) {
  if (isPrimary(user)) return true;
  if (!isAdmin(user)) return false;
  const access = await accessRecord(store);
  return Array.isArray(access.editors) && access.editors.includes(emailOf(user));
}

export default async (req) => {
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed' }, 405);
  if (!sameOrigin(req)) return json({ error: 'Invalid request origin' }, 403);
  const user = await getUser();
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  const store = getStore('provider-catalog');

  if (req.method === 'GET') {
    const permitted = await canEdit(user, store);
    const access = await accessRecord(store);
    if (!permitted) return json({ canEdit: false, isPrimary: isPrimary(user) });
    const [published, draft, historyList] = await Promise.all([
      store.get('published', { type: 'json' }),
      store.get('draft', { type: 'json' }),
      store.list({ prefix: 'history/' }),
    ]);
    return json({
      canEdit: true,
      isPrimary: isPrimary(user),
      revision: Number(published?.revision || 0),
      editors: isPrimary(user) ? access.editors || [] : undefined,
      published: validCatalogRecord(published) ? published : null,
      draft: validCatalogRecord(draft) ? draft : null,
      historyCount: historyList?.blobs?.length || 0,
    });
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const action = cleanText(body?.action, 40);

  if (action === 'access') {
    if (!isPrimary(user)) return json({ error: 'Only the Primary Admin can change provider update permissions.' }, 403);
    const editors = Array.isArray(body?.editors)
      ? [...new Set(body.editors.map(email => cleanText(email, 180).toLowerCase()).filter(email => email.endsWith('@renti.co') && email !== PRIMARY_ADMIN_EMAIL))]
      : [];
    await store.setJSON('access', { editors, updatedAt: new Date().toISOString(), updatedBy: emailOf(user) });
    return json({ ok: true, editors });
  }

  if (!(await canEdit(user, store))) return json({ error: 'You do not have permission to edit provider updates.' }, 403);
  const unfinished = unfinishedNewItem(body?.catalog);
  if (unfinished) return json({ error: `Complete or cancel the unfinished ${unfinished} before saving.` }, 400);
  let catalog;
  try { catalog = cleanCatalog(body?.catalog, action === 'draft'); } catch (error) { return json({ error: error.message || 'Invalid catalogue.' }, 400); }
  const published = await store.get('published', { type: 'json' });
  const currentRevision = Number(published?.revision || 0);
  const expectedRevision = Number(body?.expectedRevision || 0);
  if (expectedRevision !== currentRevision) return json({ error: 'Someone published a newer provider update. Reload before saving so their changes are not overwritten.', revision: currentRevision }, 409);
  const now = new Date().toISOString();
  const record = { catalog, revision: action === 'publish' ? currentRevision + 1 : currentRevision, updatedAt: now, updatedBy: emailOf(user) };

  if (action === 'draft') {
    await store.setJSON('draft', record);
    return json({ ok: true, draft: record });
  }
  if (action !== 'publish') return json({ error: 'Unknown action.' }, 400);
  const next = { ...record, publishedAt: now, publishedBy: emailOf(user) };
  await Promise.all([
    store.setJSON('published', next),
    store.setJSON(`history/${String(next.revision).padStart(6, '0')}-${Date.now()}`, next),
    store.setJSON('draft', next),
  ]);
  return json({ ok: true, published: next });
};
