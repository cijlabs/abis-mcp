// Plan -> MCP tier, and tier -> tools / rate limit / denial message.
// Pure functions so the access rules can be unit-tested (test/tiers.test.js).
//
// Owner decision 2026-10-06: access is tiered and Business is NEVER admin.
// Business previously mapped to 'admin', which handed every Business (and
// Enterprise) key the internal operator tools (cost analysis, baseline
// recalibration, pipeline stats, notification config, stress benchmarks, ...).
// Admin is now reachable only with the operator ABIS_ADMIN_KEY or local stdio.

// Fail closed (2026-10-08): only a known paid plan gets a paid tier. Anything else on an
// active row (missing, 'free', 'cancelled', a typo) used to fall through to 'pro', so a
// key downgraded by changing its plan kept the Pro toolset. The backend only writes
// 'pro' / 'business' rows to mcp_api_keys.
export function tierFromPlan(plan) {
  const p = typeof plan === 'string' ? plan.trim().toLowerCase() : '';
  if (p === 'business' || p === 'enterprise') return 'business';
  if (p === 'pro') return 'pro';
  return 'free';
}

export function selectTools(allTools, tier, { freeNames, proNames, adminOnly }) {
  if (tier === 'admin') return allTools;
  // Fail-closed allow-list: Business gets exactly the customer (Pro) toolset. A deny-list
  // leaked any tool missing from ADMIN_ONLY_TOOLS (e.g. a misspelt name) to customers.
  if (tier === 'business') return allTools.filter(t => proNames.has(t.name) && !adminOnly.has(t.name));
  if (tier === 'pro') return allTools.filter(t => proNames.has(t.name));
  return allTools.filter(t => freeNames.has(t.name));
}

export function isToolAllowed(name, tier, { adminOnly, proOnly }) {
  if (adminOnly.has(name)) return tier === 'admin';
  if (proOnly.has(name)) return tier === 'admin' || tier === 'business' || tier === 'pro';
  return true; // free tools are available to every tier
}

export function rateLimitFor(tier, { free, pro, business, admin }) {
  if (tier === 'admin') return admin;
  if (tier === 'business') return business;
  if (tier === 'pro') return pro;
  return free;
}

export function deniedMessage(name, adminOnly) {
  return adminOnly.has(name)
    ? `Access denied: '${name}' is an internal operator tool and is not available on customer plans.`
    : `Access denied: '${name}' requires a Pro or Business plan. Upgrade at https://cijlabs.com/pricing`;
}
