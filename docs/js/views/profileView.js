// ─────────────────────────────────────────────────────────────────────────────
// Profile view (tabbed): Overview / Stats / Activity / Settings
// Same module renders own profile (all tabs) and public profile (Overview+Stats).
// ─────────────────────────────────────────────────────────────────────────────

import { getSession } from '../auth.js';
import {
  getCurrentUserProfile, getUserProfile, getUserStats, updateUserProfile,
  uploadAvatar, getAvatarInitials, changeEmail, changePassword,
  getFollowCounts, getRecentActivity,
} from '../userProfiles.js';
import {
  getUserBetsForAnalytics, calculateAdvancedMetrics, calculateEquityCurve,
  getPerformanceBySport, getPerformanceByBookmaker,
} from '../analytics.js';
import { followUser, unfollowUser, isFollowing } from '../communityPicks.js';
import { navigate } from '../router.js';

const TABS = ['overview', 'stats', 'activity', 'settings'];
let currentTab = 'overview';

const SPORTS_LIST = [
  { key: 'nfl', label: 'NFL' },
  { key: 'nba', label: 'NBA' },
  { key: 'mlb', label: 'MLB' },
  { key: 'nhl', label: 'NHL' },
  { key: 'ncaaf', label: 'NCAAF' },
  { key: 'ncaab', label: 'NCAAB' },
  { key: 'soccer', label: 'Soccer' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'mma', label: 'MMA' },
  { key: 'boxing', label: 'Boxing' },
];

/**
 * Mount the tabbed profile view.
 * @param {HTMLElement} main     - container to render into
 * @param {string|null} userId   - userId to view; null = own profile
 */
export async function renderProfileView(main, userId = null) {
  if (!main) return;

  main.innerHTML = `<div class="profile-loading">Loading profile…</div>`;

  try {
    const session = await getSession();
    const ownId = session?.user?.id ?? null;
    const targetId = userId ?? ownId;
    if (!targetId) {
      main.innerHTML = `<div class="profile-loading">Sign in to view profiles.</div>`;
      return;
    }
    const isOwn = targetId === ownId;

    const [profile, stats, follow, isFollowingTarget] = await Promise.all([
      isOwn ? getCurrentUserProfile() : getUserProfile(targetId),
      getUserStats(targetId),
      getFollowCounts(targetId),
      isOwn ? Promise.resolve(false) : isFollowing(targetId),
    ]);
    if (!profile) {
      main.innerHTML = `<div class="profile-loading">User not found.</div>`;
      return;
    }

    const visibleTabs = isOwn ? TABS : ['overview', 'stats'];
    if (!visibleTabs.includes(currentTab)) currentTab = 'overview';

    main.innerHTML = renderHeader(profile, follow, isOwn, isFollowingTarget, ownId)
      + renderTabsNav(visibleTabs)
      + `<div id="profileTabContent" class="profile-tab-content"></div>`;

    wireHeader(main, profile, targetId, isOwn);
    wireTabs(main, () => mountActiveTab(main, profile, targetId, isOwn, stats));

    await mountActiveTab(main, profile, targetId, isOwn, stats);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="profile-loading" style="color:#f87171">Error loading profile: ${err.message}</div>`;
  }
}

// ── Header ───────────────────────────────────────────────────────────────────

function renderHeader(profile, follow, isOwn, isFollowingTarget, ownId) {
  const initials = getAvatarInitials(profile.username);
  const displayName = profile.display_name || profile.username;
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long',
  });

  return `
    <div class="profile-v2-header">
      <div class="profile-v2-avatar">
        ${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="${displayName}">` : escapeHtml(initials)}
      </div>
      <div class="profile-v2-identity">
        <div class="profile-v2-name">${escapeHtml(displayName)}</div>
        <div class="profile-v2-handle">@${escapeHtml(profile.username)}</div>
        ${profile.bio ? `<div class="profile-v2-bio">${escapeHtml(profile.bio)}</div>` : ''}
        <div class="profile-v2-meta">Member since ${joinDate}</div>
        <div class="profile-v2-follow-row">
          <span><strong>${follow.followers}</strong> followers</span>
          <span><strong>${follow.following}</strong> following</span>
        </div>
      </div>
      <div class="profile-v2-actions">
        ${isOwn
          ? `<button class="btn-profile-action" id="copyShareLink">🔗 Share profile</button>`
          : (ownId
              ? `<button class="btn-profile-action ${isFollowingTarget ? 'is-following' : ''}" id="followToggleBtn">
                   ${isFollowingTarget ? '✓ Following' : '+ Follow'}
                 </button>`
              : ''
            )
        }
      </div>
    </div>
  `;
}

function wireHeader(main, profile, targetId, isOwn) {
  if (isOwn) {
    main.querySelector('#copyShareLink')?.addEventListener('click', async () => {
      const url = `${window.location.origin}${window.location.pathname}#user/${targetId}`;
      try {
        await navigator.clipboard.writeText(url);
        const btn = main.querySelector('#copyShareLink');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = '✓ Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        }
      } catch {
        prompt('Copy this URL:', url);
      }
    });
  } else {
    const followBtn = main.querySelector('#followToggleBtn');
    followBtn?.addEventListener('click', async () => {
      followBtn.disabled = true;
      try {
        if (followBtn.classList.contains('is-following')) {
          await unfollowUser(targetId);
          followBtn.classList.remove('is-following');
          followBtn.textContent = '+ Follow';
        } else {
          await followUser(targetId);
          followBtn.classList.add('is-following');
          followBtn.textContent = '✓ Following';
        }
      } catch (e) {
        alert('Failed: ' + e.message);
      } finally {
        followBtn.disabled = false;
      }
    });
  }
}

// ── Tab nav ──────────────────────────────────────────────────────────────────

function renderTabsNav(visibleTabs) {
  return `
    <div class="profile-tabs-nav" role="tablist">
      ${visibleTabs.map(tab => `
        <button
          class="profile-tab-btn ${tab === currentTab ? 'profile-tab-btn--active' : ''}"
          data-tab="${tab}" type="button"
        >${tabLabel(tab)}</button>
      `).join('')}
    </div>
  `;
}

function tabLabel(t) {
  return { overview: 'Overview', stats: 'Stats', activity: 'Activity', settings: 'Settings' }[t] ?? t;
}

function wireTabs(main, onChange) {
  main.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab || tab === currentTab) return;
      currentTab = tab;
      main.querySelectorAll('.profile-tab-btn').forEach(b => {
        b.classList.toggle('profile-tab-btn--active', b.dataset.tab === currentTab);
      });
      onChange();
    });
  });
}

// ── Tab dispatcher ───────────────────────────────────────────────────────────

async function mountActiveTab(main, profile, targetId, isOwn, stats) {
  const container = main.querySelector('#profileTabContent');
  if (!container) return;
  container.innerHTML = '<div class="profile-loading">Loading…</div>';
  try {
    if (currentTab === 'overview')      await renderOverviewTab(container, profile, stats);
    else if (currentTab === 'stats')    await renderStatsTab(container, targetId);
    else if (currentTab === 'activity') await renderActivityTab(container, targetId);
    else if (currentTab === 'settings' && isOwn) await renderSettingsTab(container, profile);
  } catch (err) {
    container.innerHTML = `<div class="profile-loading" style="color:#f87171">Error: ${err.message}</div>`;
  }
}

// ── Overview ─────────────────────────────────────────────────────────────────

async function renderOverviewTab(container, profile, stats) {
  container.innerHTML = `
    <div class="profile-overview-grid">
      <div class="profile-stat-card">
        <div class="profile-stat-label">Total Bets</div>
        <div class="profile-stat-value">${stats.totalBets}</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-label">Win Rate</div>
        <div class="profile-stat-value ${stats.winRate >= 52.5 ? 'positive' : (stats.totalBets ? 'negative' : '')}">${stats.winRate}%</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-label">ROI</div>
        <div class="profile-stat-value ${stats.roi >= 0 ? 'positive' : 'negative'}">${stats.roi >= 0 ? '+' : ''}${stats.roi}%</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-label">Profit / Loss</div>
        <div class="profile-stat-value ${stats.totalProfit >= 0 ? 'positive' : 'negative'}">${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-label">Won</div>
        <div class="profile-stat-value positive">${stats.won}</div>
      </div>
      <div class="profile-stat-card">
        <div class="profile-stat-label">Lost</div>
        <div class="profile-stat-value negative">${stats.lost}</div>
      </div>
      ${profile.bankroll != null ? `
        <div class="profile-stat-card">
          <div class="profile-stat-label">Bankroll</div>
          <div class="profile-stat-value">$${Number(profile.bankroll).toFixed(2)}</div>
        </div>` : ''}
      ${profile.favorite_sports?.length ? `
        <div class="profile-stat-card profile-stat-card--wide">
          <div class="profile-stat-label">Favorite Sports</div>
          <div class="profile-fav-sports">
            ${profile.favorite_sports.map(s => `<span class="fav-sport-pill">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>
  `;
}

// ── Stats ────────────────────────────────────────────────────────────────────

async function renderStatsTab(container, targetId) {
  const bets = await getUserBetsForAnalytics(targetId);
  if (bets.length === 0) {
    container.innerHTML = `<div class="profile-loading">No bets yet — once bets are placed, full analytics will appear here.</div>`;
    return;
  }
  const m = calculateAdvancedMetrics(bets);
  const curve = calculateEquityCurve(bets);
  const bySport = getPerformanceBySport(bets);
  const byBook = getPerformanceByBookmaker(bets);

  container.innerHTML = `
    ${renderAdvancedMetrics(m)}
    ${renderEquityChart(curve)}
    ${renderBreakdownTable('Performance by sport', bySport)}
    ${Object.keys(byBook).length ? renderBreakdownTable('Performance by bookmaker', byBook) : ''}
  `;
}

function renderAdvancedMetrics(m) {
  const pairs = [
    ['Sharpe Ratio',   m.sharpeRatio,       null],
    ['Max Drawdown',   `${m.maxDrawdown}%`, 'negative'],
    ['Profit Factor',  m.profitFactor,      null],
    ['Longest Streak', `${m.longestWinStreak}W / ${m.longestLossStreak}L`, null],
    ['Max Win',        `$${m.maxWin}`,      'positive'],
    ['Max Loss',       `$${Math.abs(m.maxLoss)}`, 'negative'],
    ['Avg Bet',        `$${m.avgBetSize}`,  null],
    ['Total Staked',   `$${m.totalStaked}`, null],
  ];
  return `
    <div class="profile-section">
      <div class="profile-section-title">Advanced Metrics</div>
      <div class="profile-pairs-grid">
        ${pairs.map(([label, value, tone]) => `
          <div class="profile-pair">
            <div class="profile-pair-label">${label}</div>
            <div class="profile-pair-value ${tone ?? ''}">${value}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderEquityChart(curve) {
  if (curve.length < 2) return '';
  const balances = curve.map(c => c.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(0, ...balances);
  const range = max - min || 1;
  const W = 600, H = 160, PAD = 10;
  const step = (W - 2 * PAD) / Math.max(1, curve.length - 1);
  const points = curve.map((c, i) => {
    const x = PAD + i * step;
    const y = H - PAD - ((c.balance - min) / range) * (H - 2 * PAD);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const zeroY = H - PAD - ((0 - min) / range) * (H - 2 * PAD);
  const last = balances[balances.length - 1];
  const colorClass = last >= 0 ? 'positive' : 'negative';

  return `
    <div class="profile-section">
      <div class="profile-section-title">Equity Curve</div>
      <div class="profile-chart">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="profile-chart-svg">
          <line x1="${PAD}" x2="${W - PAD}" y1="${zeroY}" y2="${zeroY}" class="profile-chart-zero"/>
          <polyline points="${points}" class="profile-chart-line ${colorClass}"/>
        </svg>
        <div class="profile-chart-foot">
          <span>Start: $0.00</span>
          <span>End: <strong class="${colorClass}">${last >= 0 ? '+' : ''}$${last.toFixed(2)}</strong></span>
        </div>
      </div>
    </div>
  `;
}

function renderBreakdownTable(title, data) {
  const rows = Object.entries(data);
  if (rows.length === 0) return '';
  return `
    <div class="profile-section">
      <div class="profile-section-title">${title}</div>
      <div class="profile-table-wrap">
        <table class="profile-table">
          <thead><tr><th>${title.includes('sport') ? 'Sport' : 'Bookmaker'}</th><th>Bets</th><th>W-L</th><th>Win %</th><th>ROI</th><th>Profit</th></tr></thead>
          <tbody>
            ${rows.map(([key, d]) => `
              <tr>
                <td>${escapeHtml(key)}</td>
                <td>${d.count}</td>
                <td>${d.wins}-${d.losses}</td>
                <td class="${d.winRate >= 52.5 ? 'positive' : 'negative'}">${d.winRate}%</td>
                <td class="${d.roi >= 0 ? 'positive' : 'negative'}">${d.roi >= 0 ? '+' : ''}${d.roi}%</td>
                <td class="${d.profit >= 0 ? 'positive' : 'negative'}">${d.profit >= 0 ? '+' : ''}$${d.profit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Activity ─────────────────────────────────────────────────────────────────

async function renderActivityTab(container, targetId) {
  const items = await getRecentActivity(targetId, 30);
  if (items.length === 0) {
    container.innerHTML = `<div class="profile-loading">No activity yet.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="profile-section">
      <div class="profile-section-title">Recent Activity</div>
      <div class="profile-activity">
        ${items.map(it => `
          <div class="activity-item">
            <div class="activity-icon">${it.icon}</div>
            <div class="activity-body">
              <div class="activity-title">${escapeHtml(it.title)}</div>
              <div class="activity-detail">${escapeHtml(it.detail)}</div>
              <div class="activity-time">${formatRelTime(it.ts)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function formatRelTime(iso) {
  const date = new Date(iso);
  const sec = (Date.now() - date.getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return date.toLocaleDateString();
}

// ── Settings ─────────────────────────────────────────────────────────────────

async function renderSettingsTab(container, profile) {
  const notif = profile.notification_prefs || {};
  container.innerHTML = `
    <form id="profileSettingsForm" class="profile-settings">
      <div class="profile-section">
        <div class="profile-section-title">Identity</div>

        <div class="settings-avatar-row">
          <div class="settings-avatar-preview" id="settingsAvatarPreview">
            ${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="">` : escapeHtml(getAvatarInitials(profile.username))}
          </div>
          <div class="settings-avatar-actions">
            <input type="file" id="settingsAvatarFile" accept="image/*" hidden>
            <button type="button" class="btn-secondary" id="settingsAvatarBtn">Change avatar</button>
          </div>
        </div>

        <label class="settings-field">
          <span>Display name</span>
          <input type="text" id="set_displayName" maxlength="50" value="${escapeAttr(profile.display_name || '')}" placeholder="${escapeAttr(profile.username)}">
        </label>
        <label class="settings-field">
          <span>Username</span>
          <input type="text" id="set_username" maxlength="24" value="${escapeAttr(profile.username || '')}" pattern="[a-zA-Z0-9_-]+">
          <small>Letters, numbers, _ and - only. Must be unique.</small>
        </label>
        <label class="settings-field">
          <span>Bio</span>
          <textarea id="set_bio" rows="3" maxlength="280" placeholder="Tell people about your betting style…">${escapeHtml(profile.bio || '')}</textarea>
        </label>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Preferences</div>
        <label class="settings-field">
          <span>Default odds format</span>
          <select id="set_oddsFormat">
            <option value="american" ${profile.default_odds_format === 'american' ? 'selected' : ''}>American (-110, +150)</option>
            <option value="decimal"  ${profile.default_odds_format === 'decimal'  ? 'selected' : ''}>Decimal (1.91, 2.50)</option>
            <option value="fractional" ${profile.default_odds_format === 'fractional' ? 'selected' : ''}>Fractional (10/11, 3/2)</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Theme</span>
          <select id="set_theme">
            <option value="dark"  ${(profile.theme ?? 'dark') === 'dark'  ? 'selected' : ''}>Dark</option>
            <option value="light" ${profile.theme === 'light' ? 'selected' : ''}>Light (preview)</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Kelly fraction</span>
          <select id="set_kelly">
            <option value="0.1"  ${Number(profile.kelly_fraction) === 0.1  ? 'selected' : ''}>10% — Conservative</option>
            <option value="0.25" ${Number(profile.kelly_fraction) === 0.25 ? 'selected' : ''}>25% — Recommended</option>
            <option value="0.5"  ${Number(profile.kelly_fraction) === 0.5  ? 'selected' : ''}>50% — Aggressive</option>
            <option value="1"    ${Number(profile.kelly_fraction) === 1    ? 'selected' : ''}>100% — Full Kelly</option>
          </select>
        </label>

        <div class="settings-field">
          <span>Favorite sports</span>
          <div class="settings-chip-grid">
            ${SPORTS_LIST.map(s => `
              <label class="chip-check">
                <input type="checkbox" name="fav_sport" value="${s.key}"
                  ${(profile.favorite_sports || []).includes(s.key) ? 'checked' : ''}>
                <span>${s.label}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Notifications</div>
        <label class="settings-toggle">
          <input type="checkbox" id="set_nf_high" ${notif.high_value_picks !== false ? 'checked' : ''}>
          <span>Push alerts when Engie finds a high-value pick</span>
        </label>
        <label class="settings-toggle">
          <input type="checkbox" id="set_nf_comments" ${notif.comments_on_my_picks !== false ? 'checked' : ''}>
          <span>Comments on my shared picks</span>
        </label>
        <label class="settings-toggle">
          <input type="checkbox" id="set_nf_followers" ${notif.new_followers !== false ? 'checked' : ''}>
          <span>New followers</span>
        </label>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Account</div>
        <label class="settings-field">
          <span>Email</span>
          <input type="email" id="set_email" value="${escapeAttr(profile.email || '')}" placeholder="you@example.com">
          <small>Changing email will require confirmation via the new address.</small>
        </label>
        <label class="settings-field">
          <span>New password</span>
          <input type="password" id="set_password" minlength="8" placeholder="Leave blank to keep current">
          <small>Minimum 8 characters.</small>
        </label>
      </div>

      <div class="settings-actions">
        <button type="button" class="btn-secondary" id="settingsCancelBtn">Cancel</button>
        <button type="submit" class="btn-primary" id="settingsSaveBtn">Save changes</button>
      </div>
      <div class="settings-status" id="settingsStatus"></div>
    </form>
  `;

  // Wire avatar upload
  const fileInput = container.querySelector('#settingsAvatarFile');
  const avatarBtn = container.querySelector('#settingsAvatarBtn');
  const preview = container.querySelector('#settingsAvatarPreview');
  avatarBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    avatarBtn.disabled = true;
    avatarBtn.textContent = 'Uploading…';
    try {
      const url = await uploadAvatar(file);
      preview.innerHTML = `<img src="${url}" alt="">`;
      avatarBtn.textContent = '✓ Saved';
      setTimeout(() => { avatarBtn.disabled = false; avatarBtn.textContent = 'Change avatar'; }, 1500);
    } catch (err) {
      alert('Upload failed: ' + err.message);
      avatarBtn.disabled = false;
      avatarBtn.textContent = 'Change avatar';
    }
  });

  // Cancel — re-mount the tab to reset form
  container.querySelector('#settingsCancelBtn').addEventListener('click', () => {
    renderSettingsTab(container, profile);
  });

  // Save
  const form = container.querySelector('#profileSettingsForm');
  const status = container.querySelector('#settingsStatus');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = container.querySelector('#settingsSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    status.textContent = '';
    status.className = 'settings-status';

    try {
      const favSports = [...container.querySelectorAll('input[name="fav_sport"]:checked')]
        .map(el => el.value);

      const updates = {
        display_name:        container.querySelector('#set_displayName').value.trim() || null,
        username:            container.querySelector('#set_username').value.trim(),
        bio:                 container.querySelector('#set_bio').value.trim() || null,
        default_odds_format: container.querySelector('#set_oddsFormat').value,
        theme:               container.querySelector('#set_theme').value,
        kelly_fraction:      parseFloat(container.querySelector('#set_kelly').value),
        favorite_sports:     favSports,
        notification_prefs: {
          high_value_picks:      container.querySelector('#set_nf_high').checked,
          comments_on_my_picks:  container.querySelector('#set_nf_comments').checked,
          new_followers:         container.querySelector('#set_nf_followers').checked,
        },
      };

      const updated = await updateUserProfile(updates);

      // Email & password changes (only if provided / different)
      const newEmail = container.querySelector('#set_email').value.trim();
      if (newEmail && newEmail !== profile.email) {
        await changeEmail(newEmail);
      }
      const newPassword = container.querySelector('#set_password').value;
      if (newPassword) {
        await changePassword(newPassword);
      }

      // Apply theme immediately
      if (updates.theme) document.documentElement.setAttribute('data-theme', updates.theme);

      status.textContent = '✓ Saved';
      status.classList.add('positive');
      profile = { ...profile, ...updated };
    } catch (err) {
      status.textContent = err.message;
      status.classList.add('negative');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save changes';
    }
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// Reset to overview tab when leaving the view (for fresh visits)
export function resetProfileTab() { currentTab = 'overview'; }
