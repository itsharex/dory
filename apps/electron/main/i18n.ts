import { app } from 'electron';

type SupportedLocale = 'zh-CN' | 'en-US';

type MessageKey =
    | 'menu.checkForUpdates'
    | 'menu.resetSkippedUpdate'
    | 'menu.openUpdateDialogDebug'
    | 'menu.openLog'
    | 'error.openLogFailed'
    | 'updater.title'
    | 'updater.checking'
    | 'updater.pleaseWait'
    | 'updater.cancel'
    | 'updater.updateAvailable'
    | 'updater.updatePrompt'
    | 'updater.installUpdate'
    | 'updater.remindLater'
    | 'updater.skipVersion'
    | 'updater.autoDownloadInstall'
    | 'updater.downloadingTitle'
    | 'updater.downloading'
    | 'updater.downloadWillPrompt'
    | 'updater.downloaded'
    | 'updater.downloadComplete'
    | 'updater.restartInstall'
    | 'updater.restartLater'
    | 'updater.latestVersion'
    | 'updater.ok'
    | 'updater.failed'
    | 'updater.checkFailedNetwork'
    | 'updater.checkFailedServer'
    | 'updater.checkFailedGeneric'
    | 'updater.installLocationBlocked'
    | 'updater.installLocationBlockedDetail'
    | 'updater.notConfigured'
    | 'updater.notConfiguredDetail'
    | 'updater.skipCleared';

const MESSAGES: Record<SupportedLocale, Record<MessageKey, string>> = {
    'zh-CN': {
        'menu.checkForUpdates': '检查更新',
        'menu.resetSkippedUpdate': '恢复跳过的更新提醒',
        'menu.openUpdateDialogDebug': '打开更新弹窗（调试）',
        'menu.openLog': '打开日志',
        'error.openLogFailed': '打开日志失败',
        'updater.title': '软件更新',
        'updater.checking': '正在检查更新...',
        'updater.pleaseWait': '请稍候',
        'updater.cancel': '取消',
        'updater.updateAvailable': '发现新版本 {version}',
        'updater.updatePrompt': '当前版本 {currentVersion}，是否开始下载并安装更新？',
        'updater.installUpdate': '安装更新',
        'updater.remindLater': '稍后提醒我',
        'updater.skipVersion': '跳过这个版本',
        'updater.autoDownloadInstall': '以后自动下载并安装更新',
        'updater.downloadingTitle': '正在更新',
        'updater.downloading': '正在下载更新...',
        'updater.downloadWillPrompt': '下载完成后会提示你重启安装',
        'updater.downloaded': '更新包已下载 ({version})',
        'updater.downloadComplete': '下载完成',
        'updater.restartInstall': '重启并安装',
        'updater.restartLater': '稍后重启',
        'updater.latestVersion': '当前已经是最新版本',
        'updater.ok': '知道了',
        'updater.failed': '更新失败',
        'updater.checkFailedNetwork': '无法连接更新服务器，请检查网络后重试。',
        'updater.checkFailedServer': '更新服务器暂时不可用，请稍后再试。',
        'updater.checkFailedGeneric': '检查更新失败，请稍后重试。',
        'updater.installLocationBlocked': '无法安装更新',
        'updater.installLocationBlockedDetail': '请将应用移动到“应用程序”文件夹后再重试更新。',
        'updater.notConfigured': '更新功能未配置',
        'updater.notConfiguredDetail': '未找到 app-update.yml 或 dev-app-update.yml，请先在构建配置中设置 publish。',
        'updater.skipCleared': '已恢复跳过版本提醒',
    },
    'en-US': {
        'menu.checkForUpdates': 'Check for Updates',
        'menu.resetSkippedUpdate': 'Reset Skipped Updates',
        'menu.openUpdateDialogDebug': 'Open Update Dialog (Debug)',
        'menu.openLog': 'Open Log',
        'error.openLogFailed': 'Open Log Failed',
        'updater.title': 'Software Update',
        'updater.checking': 'Checking for updates...',
        'updater.pleaseWait': 'Please wait',
        'updater.cancel': 'Cancel',
        'updater.updateAvailable': 'A new version is available: {version}',
        'updater.updatePrompt': 'Current version is {currentVersion}. Download and install now?',
        'updater.installUpdate': 'Install Update',
        'updater.remindLater': 'Remind Me Later',
        'updater.skipVersion': 'Skip This Version',
        'updater.autoDownloadInstall': 'Automatically download and install updates',
        'updater.downloadingTitle': 'Updating',
        'updater.downloading': 'Downloading update...',
        'updater.downloadWillPrompt': 'You will be prompted to restart after download.',
        'updater.downloaded': 'Update downloaded ({version})',
        'updater.downloadComplete': 'Download complete',
        'updater.restartInstall': 'Restart and Install',
        'updater.restartLater': 'Restart Later',
        'updater.latestVersion': 'You are up to date.',
        'updater.ok': 'OK',
        'updater.failed': 'Update Failed',
        'updater.checkFailedNetwork': 'Cannot reach update server. Please check your network and try again.',
        'updater.checkFailedServer': 'Update server is temporarily unavailable. Please try again later.',
        'updater.checkFailedGeneric': 'Failed to check for updates. Please try again later.',
        'updater.installLocationBlocked': 'Cannot Install Update',
        'updater.installLocationBlockedDetail': 'Move the app to the Applications folder, then try updating again.',
        'updater.notConfigured': 'Updater Not Configured',
        'updater.notConfiguredDetail': 'Missing app-update.yml or dev-app-update.yml. Configure publish in electron-builder first.',
        'updater.skipCleared': 'Skipped update preference has been reset.',
    },
};

function normalizeLocale(rawLocale: string | undefined): SupportedLocale {
    if (!rawLocale) return 'en-US';
    const lower = rawLocale.toLowerCase();
    if (lower.startsWith('zh')) return 'zh-CN';
    return 'en-US';
}

function format(template: string, vars?: Record<string, string>) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, token: string) => vars[token] ?? `{${token}}`);
}

export function getMainLocale() {
    return normalizeLocale(app.getLocale());
}

export function createMainI18n() {
    const locale = getMainLocale();
    const t = (key: MessageKey, vars?: Record<string, string>) => format(MESSAGES[locale][key], vars);
    return { locale, t };
}

export type MainTranslator = ReturnType<typeof createMainI18n>['t'];
