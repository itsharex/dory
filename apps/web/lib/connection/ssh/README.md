# SSH Tunneling in the Connection Layer

This directory contains the shared SSH tunneling implementation used by connection drivers in `apps/web/lib/connection/drivers`.

## Purpose

The SSH layer is a transport concern, not a driver-specific concern.

Its job is to:

- read SSH options from the normalized connection config
- establish an SSH session when `ssh.enabled` is true
- expose a local TCP endpoint that any driver can consume
- hide SSH lifecycle management behind `BaseConnection`

The SSH layer does not know anything about ClickHouse, Postgres, or any future database-specific client.

## High-Level Flow

1. The frontend submits connection settings and optional SSH settings.
2. The backend loads the stored connection record, identity, and SSH secrets.
3. The connection layer builds a normalized `BaseConfig`.
4. The pool layer creates the correct datasource instance for the connection type.
5. The datasource calls `setupSshIfNeeded(targetPort)` during driver initialization.
6. `createSshTunnel(...)` creates a local TCP forwarding server on `127.0.0.1:<random-port>`.
7. The datasource reads that local endpoint and passes it into its driver-specific client builder.
8. The database client connects to the local endpoint instead of connecting directly to the remote database host.

In practice, the tunnel looks like this:

`database client -> 127.0.0.1:<local-port> -> SSH server -> remote database host:<target-port>`

## Where the SSH Config Comes From

The SSH config is attached to `BaseConfig.options.ssh` before any driver is created.

Relevant code paths:

- `apps/web/app/api/connection/utils.ts`
- `apps/web/lib/connection/config-builder.ts`

That means drivers should not fetch SSH settings themselves. They only consume the normalized config prepared by the connection layer.

## Shared Abstraction

The shared abstraction lives in:

- `apps/web/lib/connection/ssh/ssh-tunnel.ts`
- `apps/web/lib/connection/base/base-connection.ts`

`createSshTunnel(...)` returns:

- `localHost`
- `localPort`
- `close()`

`BaseConnection` is responsible for:

- calling `createSshTunnel(...)`
- storing the active tunnel instance
- exposing the local endpoint through `getSshEndpoint()`
- closing the tunnel during datasource teardown

## Why We Use a Local TCP Endpoint

The previous model returned an HTTP-specific agent, which only worked cleanly for HTTP-based drivers.

The current model returns a local TCP endpoint instead. This is driver-agnostic and works for:

- HTTP-based clients
- native TCP clients
- future drivers that only need host/port overrides

This is the reason SSH is now a cross-driver capability instead of a ClickHouse-only implementation detail.

## Driver Responsibilities

Drivers do not implement SSH themselves.

Drivers only need to do two things:

1. Decide the remote target port and call `setupSshIfNeeded(targetPort)`.
2. If `getSshEndpoint()` returns a value, map that local endpoint into the client library's connection options.

The mapping is driver-specific because each client library has different connection primitives.

### ClickHouse

Files:

- `apps/web/lib/connection/drivers/clickhouse/ClickhouseDatasource.ts`
- `apps/web/lib/connection/drivers/clickhouse/clickhouse-driver.ts`

ClickHouse consumes the SSH endpoint by overriding the host and HTTP port used to build the client URL.

### Postgres

Files:

- `apps/web/lib/connection/drivers/postgres/PostgresDatasource.ts`
- `apps/web/lib/connection/drivers/postgres/postgres-driver.ts`

Postgres consumes the SSH endpoint by overriding the `host` and `port` passed to `pg.Pool`.

## Adding SSH Support to a New Driver

When adding a new driver, follow this pattern:

1. Determine the remote database port the driver needs.
2. Call `await this.setupSshIfNeeded(targetPort)` in the datasource `_init()`.
3. Read `const sshEndpoint = this.getSshEndpoint()`.
4. If `sshEndpoint` exists, pass it into the driver-specific client builder as a host/port override.
5. Keep all protocol-specific mapping logic inside the driver, not inside the shared SSH layer.

Pseudo-code:

```ts
protected async _init(): Promise<void> {
    await this.setupSshIfNeeded(targetPort);
    const sshEndpoint = this.getSshEndpoint();

    this.client = createDriverClient({
        host: sshEndpoint?.host ?? originalHost,
        port: sshEndpoint?.port ?? originalPort,
    });
}
```

## Lifecycle Notes

- The SSH tunnel is created once per datasource instance.
- The datasource pool owns the datasource lifecycle.
- When the datasource is closed, the SSH tunnel is also closed.
- Query execution should not create new tunnels per request.

## Important Boundary

The SSH layer is responsible for transport only.

It should not:

- know about SQL dialects
- know about driver capabilities
- know about metadata, privileges, monitoring, or table inspection
- parse frontend payloads directly

If a change is specific to one database client, that change belongs in the driver layer, not in this directory.
