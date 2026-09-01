const fs = require('fs');
const path = require('path');

const MAX_PACKAGE_SIZE = 16 * 1024 * 1024;
const MAX_PLUGIN_FILE_SIZE = 8 * 1024 * 1024;
const MANIFEST_VERSION = 1;
const API_VERSION = 2;

function fail(message) {
 console.error(`[pack-plugin] ${message}`);
 process.exit(1);
}

function isObject(value) {
 return Boolean(value) &&
 typeof value === 'object' &&
 !Array.isArray(value);
}

function normalizeRelativePath(value) {
 const normalized =
 String(value || '')
 .replace(/\\/g, '/')
 .replace(/^\.\/+/, '')
 .trim();

 if (
 !normalized ||
 normalized.startsWith('/') ||
 normalized.includes('\0') ||
 normalized.split('/').includes('..')
 ) {
 throw new Error(
 `Unsafe relative path: ${value}`
 );
 }

 return normalized;
}

function readJson(filePath) {
 try {
 return JSON.parse(
 fs.readFileSync(
 filePath,
 'utf8'
 )
 );
 } catch (error) {
 throw new Error(
 `Cannot read ${filePath}: ${error.message}`
 );
 }
}

function validateManifest(manifest) {
 if (!isObject(manifest)) {
 throw new Error(
 'manifest.json must contain an object.'
 );
 }

 if (
 manifest.manifestVersion !==
 MANIFEST_VERSION
 ) {
 throw new Error(
 `manifestVersion must be ${MANIFEST_VERSION}.`
 );
 }

 if (
 typeof manifest.id !== 'string' ||
 !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(
 manifest.id
 )
 ) {
 throw new Error(
 'manifest.id is invalid.'
 );
 }

 if (
 typeof manifest.name !== 'string' ||
 !manifest.name.trim()
 ) {
 throw new Error(
 'manifest.name is required.'
 );
 }

 if (
 typeof manifest.version !== 'string' ||
 !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9._-]+)?$/.test(
 manifest.version
 )
 ) {
 throw new Error(
 'manifest.version must use semantic versioning.'
 );
 }

 if (
 !isObject(manifest.orphira) ||
 Number(
 manifest.orphira.apiVersion
 ) !== API_VERSION
 ) {
 throw new Error(
 `orphira.apiVersion must be ${API_VERSION}.`
 );
 }

 if (
 manifest.entry !== undefined
 ) {
 normalizeRelativePath(
 manifest.entry
 );
 }

 return manifest;
}

function collectFiles(
 rootPath,
 currentPath,
 outputPath,
 result
) {
 const entries =
 fs.readdirSync(
 currentPath,
 {
 withFileTypes: true
 }
 )
 .sort(
 (left, right) =>
 left.name.localeCompare(
 right.name
 )
 );

 for (const entry of entries) {
 const absolutePath =
 path.join(
 currentPath,
 entry.name
 );

 const relativePath =
 normalizeRelativePath(
 path.relative(
 rootPath,
 absolutePath
 )
 );

 if (
 relativePath ===
 'manifest.json'
 ) {
 continue;
 }

 if (
 path.resolve(absolutePath) ===
 path.resolve(outputPath)
 ) {
 continue;
 }

 const stat =
 fs.lstatSync(
 absolutePath
 );

 if (stat.isSymbolicLink()) {
 throw new Error(
 `Symbolic links are not allowed: ${relativePath}`
 );
 }

 if (stat.isDirectory()) {
 collectFiles(
 rootPath,
 absolutePath,
 outputPath,
 result
 );
 continue;
 }

 if (!stat.isFile()) {
 continue;
 }

 if (
 stat.size >
 MAX_PLUGIN_FILE_SIZE
 ) {
 throw new Error(
 `File exceeds 8 MB: ${relativePath}`
 );
 }

 if (
 relativePath.endsWith(
 '.orphira-plugin'
 )
 ) {
 continue;
 }

 result[relativePath] =
 fs.readFileSync(
 absolutePath,
 'utf8'
 );
 }
}

function validateReferencedFiles(
 manifest,
 files
) {
 const references = [];

 if (manifest.entry) {
 references.push(
 normalizeRelativePath(
 manifest.entry
 )
 );
 }

 const contributes =
 isObject(
 manifest.contributes
 )
 ? manifest.contributes
 : {};

 for (
 const theme
 of contributes.themes || []
 ) {
 if (theme?.file) {
 references.push(
 normalizeRelativePath(
 theme.file
 )
 );
 }
 }

 for (
 const locale
 of contributes.locales || []
 ) {
 if (locale?.file) {
 references.push(
 normalizeRelativePath(
 locale.file
 )
 );
 }
 }

 for (
 const view
 of contributes.views || []
 ) {
 if (view?.file) {
 references.push(
 normalizeRelativePath(
 view.file
 )
 );
 }
 }

 for (const reference of references) {
 if (
 files[reference] === undefined
 ) {
 throw new Error(
 `Referenced file does not exist: ${reference}`
 );
 }
 }
}

function parseArguments(argv) {
 const args =
 argv.slice(2);

 if (
 args.length === 0 ||
 args.includes('--help') ||
 args.includes('-h')
 ) {
 console.log(
 [
 'Usage:',
 '  npm run pack-plugin -- ./my-plugin',
 '  npm run pack-plugin -- ./my-plugin --out ./dist/my-plugin.orphira-plugin'
 ].join('\n')
 );
 process.exit(0);
 }

 const source = args[0];
 let output = null;

 const outIndex =
 args.indexOf('--out');

 if (outIndex !== -1) {
 output =
 args[outIndex + 1];

 if (!output) {
 throw new Error(
 '--out requires a file path.'
 );
 }
 }

 return {
 source,
 output
 };
}

function main() {
 let parsed;

 try {
 parsed =
 parseArguments(
 process.argv
 );
 } catch (error) {
 fail(error.message);
 }

 const sourcePath =
 path.resolve(
 process.cwd(),
 parsed.source
 );

 if (
 !fs.existsSync(sourcePath) ||
 !fs.statSync(sourcePath)
 .isDirectory()
 ) {
 fail(
 `Plugin directory not found: ${sourcePath}`
 );
 }

 const manifestPath =
 path.join(
 sourcePath,
 'manifest.json'
 );

 if (
 !fs.existsSync(
 manifestPath
 )
 ) {
 fail(
 'manifest.json was not found.'
 );
 }

 try {
 const manifest =
 validateManifest(
 readJson(
 manifestPath
 )
 );

 const defaultOutput =
 path.join(
 path.dirname(sourcePath),
 `${path.basename(sourcePath)}.orphira-plugin`
 );

 let outputPath =
 parsed.output
 ? path.resolve(
 process.cwd(),
 parsed.output
 )
 : defaultOutput;

 if (
 path.extname(outputPath) !==
 '.orphira-plugin'
 ) {
 outputPath +=
 '.orphira-plugin';
 }

 const files = {};

 collectFiles(
 sourcePath,
 sourcePath,
 outputPath,
 files
 );

 validateReferencedFiles(
 manifest,
 files
 );

 const packageData = {
 manifest,
 files
 };

 const serialized =
 JSON.stringify(
 packageData,
 null,
 2
 );

 const totalBytes =
 Buffer.byteLength(
 serialized,
 'utf8'
 );

 if (
 totalBytes >
 MAX_PACKAGE_SIZE
 ) {
 throw new Error(
 'Generated package exceeds 16 MB.'
 );
 }

 fs.mkdirSync(
 path.dirname(outputPath),
 {
 recursive: true
 }
 );

 fs.writeFileSync(
 outputPath,
 serialized,
 'utf8'
 );

 console.log(
 `[pack-plugin] Packed ${manifest.id}@${manifest.version}`
 );
 console.log(
 `[pack-plugin] Files: ${Object.keys(files).length}`
 );
 console.log(
 `[pack-plugin] Size: ${totalBytes} bytes`
 );
 console.log(
 `[pack-plugin] Output: ${outputPath}`
 );
 } catch (error) {
 fail(error.message);
 }
}

main();