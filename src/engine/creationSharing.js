// src/engine/creationSharing.js — Phase 13: sharing, remix attribution, and
// version history, shared across the 4 near-identical code-submission
// overlays (room claim in WorldScene.js; game/object(interactive)/music in
// RoomScene.js). Pulled into one module because it's the exact same feature
// repeated at every call site, not just visually-similar code — matches the
// existing pattern of small shared modules for cross-cutting concerns
// (src/creation-kinds/*.js, ObjectRenderer.js's sanitizeObjectConfig).
//
// Does NOT apply to decorative objects — they're pure JSON, never touch
// /api/submit, and never get a creationMeta entry server-side.
import { getFreshIdToken } from '../auth/session.js';

export async function fetchCreationMeta(kind, slotKey) {
  const res = await fetch(`/api/creation-meta?kind=${encodeURIComponent(kind)}&slotKey=${encodeURIComponent(slotKey)}`);
  return res.json();
}

export async function fetchSharedCreations() {
  try {
    const res  = await fetch('/api/creations/shared');
    const data = await res.json();
    return data.creations ?? [];
  } catch {
    return [];
  }
}

export async function setShared(creationKey, shared) {
  const idToken = await getFreshIdToken();
  const res = await fetch('/api/creation-meta/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, creationKey, shared }),
  });
  return res.json();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// HTML snippet for the additive fields, inlined into an overlay's innerHTML
// template right before its status div. `prefix` must match the overlay's
// existing id convention (e.g. 'game' → woc-game-*). Objects have no way to
// reopen an already-approved creation this milestone (create-only, see
// Phase 11), so there's nowhere to toggle sharing after the fact — pass
// includeShare:false there and only offer version description + remix source.
export function buildSharingFieldsHTML(prefix, { includeShare = true } = {}) {
  return `
    <label style="display:block;margin-bottom:0.75rem">
      <span id="woc-${prefix}-versiondesc-label" style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Describe this creation</span>
      <input id="woc-${prefix}-versiondesc" type="text" maxlength="200" placeholder="e.g. Added a jump mechanic"
        style="width:100%;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.9rem;box-sizing:border-box;outline:none">
    </label>
    <label style="display:block;margin-bottom:0.75rem">
      <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Based on another shared creation? (optional)</span>
      <select id="woc-${prefix}-basedon"
        style="width:100%;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.9rem;box-sizing:border-box;outline:none">
        <option value="">— none —</option>
      </select>
    </label>
    ${includeShare ? `
    <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;color:#aaa;font-size:0.85rem;cursor:pointer">
      <input id="woc-${prefix}-share" type="checkbox">
      Share this code so others can remix it
    </label>
    <div id="woc-${prefix}-share-status" style="margin-bottom:0.75rem;font-size:0.78rem;min-height:1rem"></div>` : ''}
    <div id="woc-${prefix}-versionpicker" style="display:none;margin-bottom:1rem;padding:0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:6px">
      <div style="color:#e07a7a;font-size:0.82rem;margin-bottom:0.5rem">This already has 5 saved versions — choose one to replace:</div>
      <div id="woc-${prefix}-versionpicker-list"></div>
    </div>`;
}

// Refreshes the additive fields when an overlay opens: repopulates the
// "based on" dropdown, pre-fills the share checkbox (if present), and shows
// the version-cap picker if the creation already has 5 versions. Returns the
// fetched creationMeta ({creationKey, shared, remixedFrom, versions}) so the
// caller can stash it (e.g. this._gameCreationMeta = meta) for the share
// checkbox's onchange handler to read later. `kind === 'object'` always
// returns empty defaults — a new object submission has no creationKey yet.
export async function refreshSharingFields(prefix, kind, slotKey) {
  const label      = document.getElementById(`woc-${prefix}-versiondesc-label`);
  const share      = document.getElementById(`woc-${prefix}-share`);
  const shareStatus = document.getElementById(`woc-${prefix}-share-status`);
  const basedOn    = document.getElementById(`woc-${prefix}-basedon`);
  const pickerBox  = document.getElementById(`woc-${prefix}-versionpicker`);
  const pickerList = document.getElementById(`woc-${prefix}-versionpicker-list`);

  document.getElementById(`woc-${prefix}-versiondesc`).value = '';
  if (share) share.checked = false;
  if (shareStatus) shareStatus.textContent = '';
  pickerBox.style.display = 'none';
  pickerList.innerHTML = '';
  basedOn.innerHTML = '<option value="">— none —</option>';

  const shared = await fetchSharedCreations();
  for (const c of shared) {
    const opt = document.createElement('option');
    opt.value = c.creationKey;
    opt.textContent = `[${c.kind}] ${c.label}`;
    basedOn.appendChild(opt);
  }

  if (kind === 'object') return { creationKey: null, shared: false, remixedFrom: null, versions: [] };

  const meta = await fetchCreationMeta(kind, slotKey);
  if (label) label.textContent = meta.versions.length > 0 ? 'What changed in this version?' : 'Describe this creation';
  if (share) share.checked = !!meta.shared;

  if (meta.versions.length >= 5) {
    pickerBox.style.display = 'block';
    for (const v of meta.versions) {
      const row = document.createElement('label');
      row.style.cssText = 'display:block;margin-bottom:0.4rem;color:#e0e0e0;font-size:0.8rem;cursor:pointer';
      const date = new Date(v.createdAt).toLocaleString();
      row.innerHTML = `<input type="radio" name="woc-${prefix}-dropversion" value="${escapeHtml(v.versionId)}" style="margin-right:0.5rem">${escapeHtml(v.description || '(no description)')} — ${escapeHtml(v.displayName)}, ${date}`;
      pickerList.appendChild(row);
    }
  }
  return meta;
}

// Reads the fields' current values for inclusion in the /api/submit body's
// `meta`. Returns null if the version-cap picker is showing but nothing's
// been chosen yet — caller should show an error and abort the submit.
export function readSharingFields(prefix) {
  const versionDescription = document.getElementById(`woc-${prefix}-versiondesc`)?.value.trim() ?? '';
  const remixedFrom = document.getElementById(`woc-${prefix}-basedon`)?.value || null;
  const pickerBox = document.getElementById(`woc-${prefix}-versionpicker`);
  if (pickerBox && pickerBox.style.display !== 'none') {
    const chosen = document.querySelector(`input[name="woc-${prefix}-dropversion"]:checked`);
    if (!chosen) return null;
    return { versionDescription, remixedFrom, dropVersionId: chosen.value };
  }
  return { versionDescription, remixedFrom, dropVersionId: null };
}

// Wires the share checkbox (if the overlay has one) to toggle immediately,
// independent of code submission. `getCreationKey` reads back whatever
// refreshSharingFields() last returned (stashed by the caller), since a
// brand-new submission has no creationKey until it's approved.
export function wireShareCheckbox(prefix, getCreationKey) {
  const checkbox = document.getElementById(`woc-${prefix}-share`);
  const status = document.getElementById(`woc-${prefix}-share-status`);
  if (!checkbox) return;
  checkbox.onchange = async () => {
    const creationKey = getCreationKey();
    if (!creationKey) {
      status.textContent = 'Submit at least one approved version first to enable sharing.';
      status.style.color = '#e07a7a';
      checkbox.checked = !checkbox.checked;
      return;
    }
    checkbox.disabled = true;
    try {
      const data = await setShared(creationKey, checkbox.checked);
      if (data.ok) {
        status.textContent = checkbox.checked ? '✓ Shared — others can pick this as a remix source.' : 'Sharing turned off.';
        status.style.color = '#52b788';
      } else {
        status.textContent = data.error ?? 'Failed to update sharing.';
        status.style.color = '#e07a7a';
        checkbox.checked = !checkbox.checked;
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#e07a7a';
      checkbox.checked = !checkbox.checked;
    } finally {
      checkbox.disabled = false;
    }
  };
}
