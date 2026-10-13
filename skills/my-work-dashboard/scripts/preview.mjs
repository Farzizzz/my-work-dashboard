#!/usr/bin/env node
// Author: Farz Owasil (my-work-dashboard)
// preview.mjs - renders the built dashboard with SAMPLE data into <projectDir>/preview.html, so the
// user can check colours, logo and tabs before anything is deployed. No real data is involved.
//   node preview.mjs <projectDir> [--dark|--light]
import fs from 'node:fs';
import path from 'node:path';
import { renderTemplate, templateVars } from './render.mjs';
import { mockModel } from './mock.mjs';

const dir = process.argv[2];
if (!dir) { console.error('usage: node preview.mjs <projectDir> [--dark|--light]'); process.exit(1); }
const config = JSON.parse(fs.readFileSync(path.join(dir, '.mwd', 'config.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, 'DashboardUI.html'), 'utf8');
let page = renderTemplate(html, templateVars(config, mockModel(config)));
const force = process.argv.includes('--dark') ? 'dark' : process.argv.includes('--light') ? 'light' : '';
if (force) page = page.replace('<html lang="en">', `<html lang="en" data-theme="${force}">`);
const out = path.join(dir, force ? `preview-${force}.html` : 'preview.html');
fs.writeFileSync(out, page);
console.log('Preview (sample data): ' + path.resolve(out));
