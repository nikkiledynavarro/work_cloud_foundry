#!/usr/bin/env node
/**
 * generate-launch-configs.js
 *
 * Regenerates the ☁ CF Apps (local approuter) and ☁ CF Direct (CF Launchpad)
 * sections of .vscode/launch.json.
 *
 * ── HOW IT WORKS ───────────────────────────────────────────────────────────
 *  1. Reads sap.cloud.service (= app ID) from each app's manifest.json
 *  2. Generates two launch config groups:
 *     - "☁ CF Apps"   → localhost:5000/{appId}/index.html  (local approuter)
 *     - "☁ CF Direct" → CF Launchpad URL                   (no approuter needed)
 *  3. Merges back into launch.json preserving all other configs unchanged
 *
 * ── CHANGE THESE IF THE CF ENVIRONMENT CHANGES ──────────────────────────────
 */
const CF_CONFIG = {
    host:     'https://btp-cf-8qsdli3e.launchpad.cfapps.us11.hana.ondemand.com',
    siteUuid: 'a167a84f-0812-44fd-86e6-01c300d56f26',
    version:  '1.0.0'
};
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const LAUNCH_FILE = path.join(ROOT, '.vscode', 'launch.json');
const APPS_DIR    = path.join(ROOT, 'apps');
const MTA_FILE    = path.join(ROOT, 'mta.yaml');

// ── 1. Read the 27 CF module names from mta.yaml ──────────────────────────
function getMtaModules() {
    const content = fs.readFileSync(MTA_FILE, 'utf8');
    const modules = new Set();
    // Match "  - name: <moduleName>" followed by "    type: html5"
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const nameMatch = lines[i].match(/^\s{2}-\s+name:\s+(\S+)/);
        if (nameMatch) {
            const nextLines = lines.slice(i + 1, i + 4).join('\n');
            if (nextLines.includes('type: html5')) {
                modules.add(nameMatch[1]);
            }
        }
    }
    return modules;
}

// ── 2. Read app IDs from manifest.json (only MTA html5 modules) ─────────────
function getApps() {
    const mtaModules = getMtaModules();
    const apps = [];

    for (const name of [...mtaModules].sort()) {
        // Try webapp/manifest.json first, then manifest.json
        let manifestPath = path.join(APPS_DIR, name, 'webapp', 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            manifestPath = path.join(APPS_DIR, name, 'manifest.json');
        }
        if (!fs.existsSync(manifestPath)) {
            console.warn(`  ⚠ No manifest found for: ${name}`);
            continue;
        }

        try {
            const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, '');
            const m   = JSON.parse(raw);
            const svc = m?.['sap.cloud']?.service;
            if (!svc) {
                console.warn(`  ⚠ No sap.cloud.service in: ${name}/manifest.json`);
                continue;
            }
            apps.push({ folder: name, appId: svc });
        } catch (e) {
            console.warn(`  ⚠ Could not parse manifest for: ${name} (${e.message})`);
        }
    }
    return apps;
}

// ── 2. Build a "☁ CF Apps" config (local approuter) ───────────────────────
function localConfig(app, order) {
    return {
        runtimeArgs: [
            '-Command',
            `Start-Process 'http://localhost:5000/${app.appId}/index.html'`
        ],
        type:                   'node',
        internalConsoleOptions: 'neverOpen',
        preLaunchTask:          '🚀 Start ShipERP (Proxy + Approuter)',
        name:                   `☁ ${app.folder} (CF)`,
        presentation: {
            hidden: false,
            group:  '☁ CF Apps',
            order
        },
        runtimeExecutable: 'powershell.exe',
        console:           'internalConsole',
        request:           'launch'
    };
}

// ── 3. Build a "☁ CF Direct" config (CF Launchpad, no approuter) ──────────
function cfDirectConfig(app, order) {
    const { host, siteUuid, version } = CF_CONFIG;
    const url = `${host}/${siteUuid}.${app.appId}.${app.appId}-${version}/index.html`;
    return {
        runtimeArgs: [
            '-Command',
            `Start-Process '${url}'`
        ],
        type:                   'node',
        internalConsoleOptions: 'neverOpen',
        name:                   `☁ ${app.folder} (CF Direct)`,
        presentation: {
            hidden: false,
            group:  '☁ CF Direct',
            order
        },
        runtimeExecutable: 'powershell.exe',
        console:           'internalConsole',
        request:           'launch'
    };
}

// ── 4. Main ────────────────────────────────────────────────────────────────
function main() {
    const apps = getApps();
    console.log(`Found ${apps.length} CF apps`);

    // Load existing launch.json
    const raw    = fs.readFileSync(LAUNCH_FILE, 'utf8').replace(/^﻿/, '');
    const launch = JSON.parse(raw);

    // Keep everything that is NOT in the two groups we manage
    const others = launch.configurations.filter(c => {
        const g = c?.presentation?.group;
        return g !== '☁ CF Apps' && g !== '☁ CF Direct';
    });

    // Generate fresh configs for both groups
    const localConfigs    = apps.map((app, i) => localConfig(app, i + 1));
    const cfDirectConfigs = apps.map((app, i) => cfDirectConfig(app, i + 1));

    launch.configurations = [...others, ...localConfigs, ...cfDirectConfigs];

    // Write back (no BOM, 4-space indent to match existing style)
    fs.writeFileSync(LAUNCH_FILE, JSON.stringify(launch, null, 4), 'utf8');

    console.log(`✅ launch.json updated:`);
    console.log(`   ${localConfigs.length} configs in "☁ CF Apps"    (localhost:5000)`);
    console.log(`   ${cfDirectConfigs.length} configs in "☁ CF Direct" (CF Launchpad)`);
    console.log(`\nTo change the CF environment, edit CF_CONFIG at the top of this script.`);
}

main();
