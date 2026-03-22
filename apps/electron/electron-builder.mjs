function readEnv(name) {
    const value = process.env[name];
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed || null;
}

const distribution = readEnv('DORY_DISTRIBUTION') === 'beta' ? 'beta' : 'stable';
const updateChannel = process.env.DORY_UPDATE_CHANNEL === 'beta' ? 'beta' : 'latest';
const appId = readEnv('DORY_ELECTRON_APP_ID') ?? (distribution === 'beta' ? 'com.dory.app.beta' : 'com.dory.app');
const productName = distribution === 'beta' ? 'Dory Beta' : 'Dory';
const protocolScheme = readEnv('DORY_PROTOCOL_SCHEME') ?? (distribution === 'beta' ? 'dory-beta' : 'dory');

/** @type {import('electron-builder').Configuration} */
const config = {
    appId,
    productName,
    extraMetadata: {
        main: 'dist-electron/main.js',
    },
    ...(distribution === 'beta'
        ? {
              artifactName: '${productName}-${version}-${os}-${arch}-beta.${ext}',
          }
        : {}),
    publish: [
        {
            provider: 'github',
            owner: 'dorylab',
            repo: 'dory',
            releaseType: updateChannel === 'beta' ? 'prerelease' : 'release',
            channel: updateChannel,
        },
    ],
    protocols: [
        {
            name: `${productName} Protocol`,
            schemes: [protocolScheme],
        },
    ],
    files: ['dist-electron/**/*', 'package.json'],
    extraResources: [
        {
            from: '../../release/standalone',
            to: 'standalone',
        },
    ],
    asar: true,
    asarUnpack: ['**/*.node'],
    dmg: {
        title: '${productName}-${version}-${arch}',
    },
    afterSign: './scripts/notarize.js',
    mac: {
        icon: '../web/public/logo.icns',
        category: 'public.app-category.developer-tools',
        hardenedRuntime: true,
        gatekeeperAssess: false,
        entitlements: './scripts/entitlements.mac.plist',
        entitlementsInherit: './scripts/entitlements.mac.plist',
        target: ['dmg', 'zip'],
        signIgnore: ['.*\\.map$', '.*\\.ttf$', '.*\\.woff2?$'],
    },
    win: {
        icon: '../../public/app.ico',
        target: ['nsis', 'zip', 'portable'],
    },
    nsis: {
        oneClick: false,
        allowElevation: true,
        allowToChangeInstallationDirectory: true,
        installerIcon: '../../public/app.ico',
        installerHeaderIcon: '../../public/app.ico',
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: productName,
    },
};

export default config;
