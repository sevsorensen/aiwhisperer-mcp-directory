#!/usr/bin/env node
/**
 * MCP Directory Auto-Updater
 * -----------------------------------------------------------
 * Queries npm registry and GitHub API to refresh metadata for
 * the 66 curated connectors in claude-mcp-directory.html.
 *
 * Updates: version numbers, last-updated dates, GitHub stars,
 * npm weekly download tiers, and the "Current as of" date.
 *
 * Usage:
 *   node update-mcp-directory.js                  # dry-run (prints changes)
 *   node update-mcp-directory.js --apply          # writes changes to HTML
 *   GITHUB_TOKEN=ghp_xxx node update-mcp-directory.js --apply   # with auth (higher rate limits)
 *
 * Schedule (cron): 0 6 * * 1   (Monday 6:00 AM local)
 * -----------------------------------------------------------
 * Author: Severin Sorensen, ePraxis LLC
 * Published by AIWhisperer.org
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'claude-mcp-directory.html');
const APPLY = process.argv.includes('--apply');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

// âââ npm package â connector name mapping âââ
const NPM_PACKAGES = {
  '@modelcontextprotocol/server-filesystem': 'Filesystem',
  '@modelcontextprotocol/server-git': 'Git',
  '@modelcontextprotocol/server-fetch': 'Fetch',
  '@modelcontextprotocol/server-memory': 'Memory',
  '@modelcontextprotocol/server-sequential-thinking': 'Sequential Thinking',
  '@modelcontextprotocol/server-time': 'Time',
  '@modelcontextprotocol/server-everything': 'Everything',
  '@modelcontextprotocol/server-github': 'GitHub',
  '@modelcontextprotocol/server-gitlab': 'GitLab',
  '@modelcontextprotocol/server-sentry': 'Sentry',
  '@modelcontextprotocol/server-puppeteer': 'Puppeteer',
  '@modelcontextprotocol/server-postgres': 'PostgreSQL',
  '@modelcontextprotocol/server-sqlite': 'SQLite',
  '@modelcontextprotocol/server-slack': 'Slack',
  '@modelcontextprotocol/server-brave-search': 'Brave Search',
  '@modelcontextprotocol/server-google-maps': 'Google Maps',
  '@modelcontextprotocol/server-redis': 'Redis',
  '@modelcontextprotocol/server-gdrive': 'Google Drive',
  '@modelcontextprotocol/server-everart': 'EverArt',
  '@modelcontextprotocol/server-aws-kb-retrieval': 'AWS Knowledge Base',
  '@cloudflare/mcp-server': 'Cloudflare',
  '@stripe/mcp-server': 'Stripe',
  '@notion/mcp-server': 'Notion',
  '@linear/mcp-server': 'Linear',
  '@atlassian/mcp-server': 'Jira & Confluence',
  '@supabase/mcp-server': 'Supabase',
  'mongodb-mcp-server': 'MongoDB',
  'exa-mcp-server': 'Exa Search',
  'firecrawl-mcp-server': 'Firecrawl',
};

// âââ GitHub repos â connector name mapping (owner/repo) âââ
const GITHUB_REPOS = {
  'modelcontextprotocol/servers': ['Filesystem', 'Git', 'Fetch', 'Memory', 'Sequential Thinking', 'Time', 'Everything', 'GitLab', 'Sentry', 'Puppeteer', 'PostgreSQL', 'SQLite', 'Slack', 'Brave Search', 'Google Maps', 'Redis', 'Google Drive', 'EverArt', 'AWS Knowledge Base'],
  'github/github-mcp-server': ['GitHub'],
  'docker/docker-mcp': ['Docker'],
  'cloudflare/mcp-server-cloudflare': ['Cloudflare'],
  'notion/notion-mcp-server': ['Notion'],
  'linear/linear-mcp-server': ['Linear'],
  'atlassian/atlassian-mcp-server': ['Jira & Confluence'],
  'mongodb-js/mongodb-mcp-server': ['MongoDB'],
  'stripe/agent-toolkit': ['Stripe'],
  'mendableai/firecrawl-mcp-server': ['Firecrawl'],
  'exa-labs/exa-mcp-server': ['Exa Search'],
  'supabase/mcp-server': ['Supabase'],
  'DataDog/datadog-mcp-server': ['Datadog'],
  'grafana/mcp-grafana': ['Grafana'],
  'dbt-labs/dbt-mcp': ['dbt'],
  'apify/actors-mcp-server': ['Apify'],
  'composioHQ/composio-mcp': ['Composio'],
};

// âââ Helpers âââ

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'MCP-Directory-Updater/1.0',
        'Accept': 'application/json',
        ...headers,
      },
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatStars(count) {
  if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return count + '+';
}

function downloadTier(weekly) {
  if (weekly >= 10000) return 'High';
  if (weekly >= 1000) return 'Moderate';
  return 'Low';
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function todayFormatted() {
  const d = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

// âââ Data collection âââ

async function fetchNpmData(pkg) {
  try {
    const meta = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
    const version = meta.version;
    const updated = meta.time ? undefined : formatDate(meta._time || new Date().toISOString());

    // Get download counts
    let downloads = 0;
    try {
      const dl = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`);
      downloads = dl.downloads || 0;
    } catch {}

    // Get publish date from full metadata
    let publishDate;
    try {
      const full = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
      if (full.time && full.time[version]) {
        publishDate = formatDate(full.time[version]);
      }
    } catch {}

    return { version, updated: publishDate, downloads, downloadTier: downloadTier(downloads) };
  } catch (e) {
    console.error(`  â  npm error for ${pkg}: ${e.message}`);
    return null;
  }
}

async function fetchGitHubData(repo) {
  try {
    const headers = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {};
    const data = await fetch(`https://api.github.com/repos/${repo}`, headers);
    return {
      stars: data.stargazers_count,
      starsFormatted: formatStars(data.stargazers_count),
      pushed: formatDate(data.pushed_at),
    };
  } catch (e) {
    console.error(`  â  GitHub error for ${repo}: ${e.message}`);
    return null;
  }
}

// âââ Main âââ

async function main() {
  console.log('ââââââââââââââââââââââââââââââââââââââââââââââââ');
  console.log('â  MCP Directory Auto-Updater                 â');
  console.log('â  ' + todayFormatted().padEnd(43) + 'â');
  console.log('ââââââââââââââââââââââââââââââââââââââââââââââââ');
  console.log(APPLY ? 'â Mode: APPLY (will write changes)' : 'â Mode: DRY RUN (preview only)');
  console.log('');

  if (!fs.existsSync(HTML_FILE)) {
    console.error('ERROR: HTML file not found at ' + HTML_FILE);
    process.exit(1);
  }

  let html = fs.readFileSync(HTML_FILE, 'utf8');
  const changes = [];

  // ââ 1. Fetch npm metadata ââ
  console.log('ð¦ Fetching npm package metadata...');
  const npmResults = {};
  for (const [pkg, name] of Object.entries(NPM_PACKAGES)) {
    process.stdout.write(`  ${name}... `);
    const data = await fetchNpmData(pkg);
    if (data) {
      npmResults[name] = data;
      console.log(`v${data.version} (${data.downloadTier} downloads)`);
    } else {
      console.log('skipped');
    }
    await sleep(200); // Rate limiting
  }

  // ââ 2. Fetch GitHub stars ââ
  console.log('\nâ­ Fetching GitHub repository data...');
  const ghResults = {};
  for (const [repo, names] of Object.entries(GITHUB_REPOS)) {
    process.stdout.write(`  ${repo}... `);
    const data = await fetchGitHubData(repo);
    if (data) {
      names.forEach(n => { ghResults[n] = data; });
      console.log(`${data.starsFormatted} stars`);
    } else {
      console.log('skipped');
    }
    await sleep(GITHUB_TOKEN ? 100 : 500); // Respect rate limits
  }

  // ââ 3. Apply updates to connector data in HTML ââ
  console.log('\nð Computing changes...');

  // Update connector version and updated fields
  for (const [name, npm] of Object.entries(npmResults)) {
    if (npm.version) {
      const versionRegex = new RegExp(
        `(name:\\s*"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*version:\\s*")([^"]+)(")`
      );
      const match = html.match(versionRegex);
      if (match && match[2] !== npm.version) {
        changes.push(`  ${name}: version ${match[2]} â ${npm.version}`);
        html = html.replace(versionRegex, `$1${npm.version}$3`);
      }
    }
    if (npm.updated) {
      const updatedRegex = new RegExp(
        `(name:\\s*"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*updated:\\s*")([^"]+)(")`
      );
      const match = html.match(updatedRegex);
      if (match && match[2] !== npm.updated) {
        changes.push(`  ${name}: updated ${match[2]} â ${npm.updated}`);
        html = html.replace(updatedRegex, `$1${npm.updated}$3`);
      }
    }
  }

  // Update trust data: stars
  for (const [name, gh] of Object.entries(ghResults)) {
    const starsRegex = new RegExp(
      `("${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}":\\s*\\{[^}]*stars:\\s*")([^"]+)(")`
    );
    const match = html.match(starsRegex);
    if (match && match[2] !== gh.starsFormatted) {
      changes.push(`  ${name}: stars ${match[2]} â ${gh.starsFormatted}`);
      html = html.replace(starsRegex, `$1${gh.starsFormatted}$3`);
    }
  }

  // Update trust data: downloads tier
  for (const [name, npm] of Object.entries(npmResults)) {
    const dlRegex = new RegExp(
      `("${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}":\\s*\\{[^}]*downloads:\\s*")([^"]+)(")`
    );
    const match = html.match(dlRegex);
    if (match && match[2] !== npm.downloadTier) {
      changes.push(`  ${name}: downloads ${match[2]} â ${npm.downloadTier}`);
      html = html.replace(dlRegex, `$1${npm.downloadTier}$3`);
    }
  }

  // ââ 4. Update "Current as of" date ââ
  const today = todayFormatted();
  const dateRegex = /Current as of [A-Z][a-z]+ \d{1,2}, \d{4}/;
  const dateMatch = html.match(dateRegex);
  if (dateMatch && dateMatch[0] !== `Current as of ${today}`) {
    changes.push(`  Date: ${dateMatch[0]} â Current as of ${today}`);
    html = html.replace(dateRegex, `Current as of ${today}`);
  }

  // ââ 5. Report ââ
  console.log('');
  if (changes.length === 0) {
    console.log('â No changes detected â directory is up to date.');
  } else {
    console.log(`Found ${changes.length} change(s):`);
    changes.forEach(c => console.log(c));

    if (APPLY) {
      fs.writeFileSync(HTML_FILE, html, 'utf8');
      console.log(`\nâ Written ${changes.length} changes to ${HTML_FILE}`);
      console.log(`   File size: ${(fs.statSync(HTML_FILE).size / 1024).toFixed(1)} KB`);
    } else {
      console.log('\nâ Dry run complete. Use --apply to write changes.');
    }
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
