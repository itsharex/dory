import net from 'node:net';
import { translate } from '@/lib/i18n/i18n';
import { Locale, routing } from '@/lib/i18n/routing';

export type SshOptions = {
    enabled?: boolean;
    host?: string | null;
    port?: number | string | null;
    username?: string | null;
    authMethod?: string | null;
    password?: string | null;
    privateKey?: string | null;
    passphrase?: string | null;
    targetHostOverride?: string;
};

export interface SshTunnel {
    localHost: string;
    localPort: number;
    close(): Promise<void>;
}

export async function createSshTunnel(
    targetHost: string,
    targetPort: number,
    ssh: SshOptions,
    options?: {
        locale?: Locale;
        messages?: {
            disabled?: string;
            missingHost?: string;
            missingDependency?: string;
            missingPassword?: string;
            missingPrivateKey?: string;
            missingAgent?: string;
        };
    },
): Promise<SshTunnel> {
    const locale = options?.locale ?? routing.defaultLocale;
    if (!ssh.enabled) {
        throw new Error(options?.messages?.disabled ?? translate(locale, 'Utils.SshTunnel.Disabled'));
    }

    if (!ssh.host) {
        throw new Error(options?.messages?.missingHost ?? translate(locale, 'Utils.SshTunnel.MissingHost'));
    }

    const sshModule = await import('ssh2-no-cpu-features').catch(() => null as any);
    if (!sshModule?.Client) {
        throw new Error(options?.messages?.missingDependency ?? translate(locale, 'Utils.SshTunnel.MissingDependency'));
    }

    const { Client } = sshModule as any;
    const client = new Client();

    const connectionOptions: any = {
        host: ssh.host!,
        port: typeof ssh.port === 'string' ? Number(ssh.port) : ssh.port ?? 22,
        username: ssh.username ?? undefined,
        readyTimeout: 15_000,
    };

    const method = ssh.authMethod ?? 'password';
    if (method === 'password') {
        connectionOptions.password = ssh.password ?? '';
    } else if (method === 'private_key') {
        if (!ssh.privateKey) throw new Error(options?.messages?.missingPrivateKey ?? translate(locale, 'Utils.SshTunnel.MissingPrivateKey'));
        connectionOptions.privateKey = ssh.privateKey;
        if (ssh.passphrase) connectionOptions.passphrase = ssh.passphrase;
    } else if (method === 'agent') {
        const agentSock = process.env.SSH_AUTH_SOCK;
        if (!agentSock) throw new Error(options?.messages?.missingAgent ?? translate(locale, 'Utils.SshTunnel.MissingAgent'));
        connectionOptions.agent = agentSock;
    }

    await new Promise<void>((resolve, reject) => {
        client.once('ready', () => resolve());
        client.once('error', reject);
        client.connect(connectionOptions);
    }).catch(err => {
        client.removeAllListeners();
        client.end();
        throw err;
    });

    const server = net.createServer(socket => {
        client.forwardOut(
            socket.localAddress ?? '127.0.0.1',
            socket.localPort ?? 0,
            targetHost,
            targetPort,
            (err: Error | null, upstream: net.Socket) => {
                if (err) {
                    socket.destroy(err);
                    return;
                }

                socket.pipe(upstream);
                upstream.pipe(socket);

                const destroyBoth = () => {
                    if (!socket.destroyed) socket.destroy();
                    if (!upstream.destroyed) upstream.destroy();
                };

                socket.on('error', destroyBoth);
                upstream.on('error', destroyBoth);
                socket.on('close', () => {
                    if (!upstream.destroyed) upstream.end();
                });
                upstream.on('close', () => {
                    if (!socket.destroyed) socket.end();
                });
            },
        );
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    }).catch(err => {
        server.removeAllListeners();
        client.removeAllListeners();
        client.end();
        throw err;
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        server.close();
        client.end();
        throw new Error('Failed to resolve SSH local tunnel address');
    }

    return {
        localHost: address.address,
        localPort: address.port,
        async close() {
            await new Promise<void>(resolve => {
                server.close(() => resolve());
            }).catch(() => undefined);
            server.removeAllListeners();
            client.removeAllListeners?.();
            client.end();
        },
    };
}
