import {Client} from 'ssh2'
import {prisma} from '#server/utils/db'

export type SshConnection = {
  host: string
  port: number
  privateKey: string
  username?: string
}

export type SshExecResult = {
  stdout: string
  stderr: string
  code: number | null
  signal: string | null
}

export async function execSshCommand(
  conn: SshConnection,
  command: string,
  opts?: { timeoutMs?: number },
): Promise<SshExecResult> {
  return await new Promise<SshExecResult>((resolve, reject) => {
    const client = new Client()

    let timeout: NodeJS.Timeout | undefined
    if (opts?.timeoutMs) {
      timeout = setTimeout(() => {
        client.end()
        reject(new Error(`SSH command timed out after ${opts.timeoutMs}ms`))
      }, opts.timeoutMs)
    }

    const cleanup = () => {
      if (timeout) clearTimeout(timeout)
    }

    client
      .on('ready', () => {
        client.exec(command, (err : any, stream: any) => {
          if (err) {
            cleanup()
            client.end()
            reject(err)
            return
          }

          let stdout = ''
          let stderr = ''
          let code: number | null = null
          let signal: string | null = null

          stream.on('data', (d: Buffer) => {
            stdout += d.toString('utf8')
          })

          stream.stderr.on('data', (d: Buffer) => {
            stderr += d.toString('utf8')
          })

          stream.on('close', (c: number | null, s: string | null) => {
            code = c
            signal = s
            cleanup()
            client.end()
            resolve({ stdout, stderr, code, signal })
          })
        })
      })
      .on('error', (err : any) => {
        cleanup()
        reject(err)
      })
      .connect({
        host: conn.host,
        port: conn.port,
        username: conn.username ?? 'root',
        privateKey: conn.privateKey,
      })
  })
}

export async function execSshCommandByServerId(
  serverId: string,
  command: string,
  opts?: { timeoutMs?: number },
): Promise<SshExecResult> {
  const conn = await getServerSshConnection(serverId)

  return await execSshCommand(
    conn,
    command,
    opts,
  )
}

export type SshSession = {
  exec: (command: string, opts?: { timeoutMs?: number }) => Promise<SshExecResult>
  disconnect: () => void
}

export async function openSshConnection(conn: SshConnection): Promise<SshSession> {
  const client = new Client()

  return new Promise((resolve, reject) => {
    client
      .on('ready', () => {
        const session: SshSession = {
          exec: async (command, opts) => {
            return new Promise((execResolve, execReject) => {
              let timeout: NodeJS.Timeout | undefined
              if (opts?.timeoutMs) {
                timeout = setTimeout(() => {
                  execReject(new Error(`SSH command timed out after ${opts.timeoutMs}ms`))
                }, opts.timeoutMs)
              }

              client.exec(command, (err, stream) => {
                if (err) {
                  if (timeout) clearTimeout(timeout)
                  return execReject(err)
                }

                let stdout = ''
                let stderr = ''
                
                stream.on('data', (d: Buffer) => {
                  stdout += d.toString('utf8')
                })

                stream.stderr.on('data', (d: Buffer) => {
                  stderr += d.toString('utf8')
                })

                stream.on('close', (code: number | null, signal: string | null) => {
                  if (timeout) clearTimeout(timeout)
                  execResolve({ stdout, stderr, code, signal })
                })
              })
            })
          },
          disconnect: () => {
            client.end()
          },
        }
        resolve(session)
      })
      .on('error', (err) => {
        reject(err)
      })
      .connect({
        host: conn.host,
        port: conn.port,
        username: conn.username ?? 'root',
        privateKey: conn.privateKey,
      })
  })
}

export async function uploadFileToServer(
  conn: SshConnection,
  localPath: string,
  remotePath: string,
): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    const client = new Client()

    client
      .on('ready', () => {
        client.sftp((sftpErr, sftp) => {
          if (sftpErr || !sftp) {
            client.end()
            reject(sftpErr || new Error('Failed to initialize SFTP'))
            return
          }

          sftp.fastPut(localPath, remotePath, (putErr) => {
            client.end()
            if (putErr) {
              reject(putErr)
              return
            }
            resolve()
          })
        })
      })
      .on('error', (err) => {
        reject(err)
      })
      .connect({
        host: conn.host,
        port: conn.port,
        username: conn.username ?? 'root',
        privateKey: conn.privateKey,
      })
  })
}

export async function uploadFileToServerByServerId(
  serverId: string,
  localPath: string,
  remotePath: string,
): Promise<void> {
  const conn = await getServerSshConnection(serverId)
  await uploadFileToServer(conn, localPath, remotePath)
}

export async function getServerSshConnection(serverId: string): Promise<SshConnection> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: {
      hostname: true,
      sshPort: true,
      sshPrivateKey: true,
    },
  })

  if (!server) {
    throw new Error(`Server not found: ${serverId}`)
  }

  return {
    host: server.hostname,
    port: server.sshPort,
    privateKey: server.sshPrivateKey,
    username: 'root',
  }
}
