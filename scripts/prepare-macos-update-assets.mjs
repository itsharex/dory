import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const [, , arm64DirArg, x64DirArg, outputDirArg] = process.argv;

if (!arm64DirArg || !x64DirArg || !outputDirArg) {
    console.error('Usage: node scripts/prepare-macos-update-assets.mjs <arm64-dir> <x64-dir> <output-dir>');
    process.exit(1);
}

const arm64Dir = path.resolve(arm64DirArg);
const x64Dir = path.resolve(x64DirArg);
const outputDir = path.resolve(outputDirArg);

const UPDATE_INFO_SUFFIX = '-mac.yml';
const ARCHES = ['arm64', 'x64'];

function isUpdateInfoFile(fileName) {
    return fileName.endsWith(UPDATE_INFO_SUFFIX);
}

function getChannelFromFileName(fileName) {
    return fileName.slice(0, -UPDATE_INFO_SUFFIX.length);
}

function getArchSpecificFileName(channel, arch) {
    return `${channel}-${arch}-mac.yml`;
}

function matchesArch(fileName, arch) {
    return fileName.includes(`-${arch}.`) || fileName.includes(`-${arch}-`);
}

function normalizeFiles(info) {
    return Array.isArray(info?.files) ? info.files.filter(file => file && typeof file.url === 'string') : [];
}

function cloneInfo(info) {
    return JSON.parse(JSON.stringify(info));
}

function buildUpdateInfo(baseInfo, files) {
    if (files.length === 0) {
        throw new Error(`No files found for update info version ${String(baseInfo?.version ?? 'unknown')}`);
    }

    const next = cloneInfo(baseInfo);
    next.files = files;

    const preferredFile = files.find(file => file.url.endsWith('.zip')) ?? files[0];
    next.path = preferredFile.url;
    if (preferredFile.sha512) {
        next.sha512 = preferredFile.sha512;
    } else {
        delete next.sha512;
    }

    return next;
}

async function ensureCleanDir(dir) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
}

async function copyNonMetadataFiles(sourceDir, targetDir) {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (isUpdateInfoFile(entry.name)) continue;

        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        await fs.copyFile(sourcePath, targetPath);
    }
}

async function readUpdateInfo(dir, fileName) {
    const filePath = path.join(dir, fileName);
    const raw = await fs.readFile(filePath, 'utf8');
    return YAML.parse(raw);
}

async function writeUpdateInfo(dir, fileName, info) {
    const filePath = path.join(dir, fileName);
    const raw = YAML.stringify(info);
    await fs.writeFile(filePath, raw, 'utf8');
}

async function main() {
    await ensureCleanDir(outputDir);
    await copyNonMetadataFiles(arm64Dir, outputDir);
    await copyNonMetadataFiles(x64Dir, outputDir);

    const arm64Entries = await fs.readdir(arm64Dir, { withFileTypes: true });
    const updateInfoFiles = arm64Entries
        .filter(entry => entry.isFile() && isUpdateInfoFile(entry.name))
        .map(entry => entry.name)
        .sort();

    if (updateInfoFiles.length === 0) {
        throw new Error(`No macOS update metadata found in ${arm64Dir}`);
    }

    for (const fileName of updateInfoFiles) {
        const x64Path = path.join(x64Dir, fileName);
        await fs.access(x64Path);

        const channel = getChannelFromFileName(fileName);
        const arm64Info = await readUpdateInfo(arm64Dir, fileName);
        const x64Info = await readUpdateInfo(x64Dir, fileName);

        const arm64Files = normalizeFiles(arm64Info).filter(file => matchesArch(file.url, 'arm64'));
        const x64Files = normalizeFiles(x64Info).filter(file => matchesArch(file.url, 'x64'));

        const arm64ArchInfo = buildUpdateInfo(arm64Info, arm64Files.length > 0 ? arm64Files : normalizeFiles(arm64Info));
        const x64ArchInfo = buildUpdateInfo(x64Info, x64Files.length > 0 ? x64Files : normalizeFiles(x64Info));

        const mergedFiles = [...arm64ArchInfo.files, ...x64ArchInfo.files];
        const mergedInfo = buildUpdateInfo(arm64Info, mergedFiles);

        await writeUpdateInfo(outputDir, fileName, mergedInfo);

        for (const arch of ARCHES) {
            const archInfo = arch === 'arm64' ? arm64ArchInfo : x64ArchInfo;
            await writeUpdateInfo(outputDir, getArchSpecificFileName(channel, arch), archInfo);
        }
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
