#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le fichier index.html généré
const htmlFile = path.join(__dirname, 'dist', 'index.html');

try {
  // Lire le fichier HTML
  let htmlContent = fs.readFileSync(htmlFile, 'utf8');

  // Les chemins restent relatifs car on utilise file:// en production
  // Vite génère déjà les chemins corrects avec base: "./"
  // Aucune modification nécessaire pour Electron

  console.log('✅ HTML configuré pour Electron (chemins relatifs avec file://)');
} catch (error) {
  console.error('❌ Erreur lors de la configuration HTML:', error);
  process.exit(1);
}