import { spawn } from 'node:child_process'

const port = 8799
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
})

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

try {
  await wait(1000)
  const health = await fetch(`http://localhost:${port}/api/v1/health`).then((r) => r.json())
  if (!health.data?.ok) throw new Error('health check failed')

  const auth = await fetch(`http://localhost:${port}/api/v1/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'smoke-token' })
  }).then((r) => r.json())
  if (!auth.data?.accessToken) throw new Error('auth failed')

  const wallet = await fetch(`http://localhost:${port}/api/v1/wallet`, {
    headers: { Authorization: `Bearer ${auth.data.accessToken}` }
  }).then((r) => r.json())
  if (wallet.data?.summary?.membershipCount !== 0) throw new Error('wallet failed')

  console.log('smoke test passed')
} finally {
  child.kill('SIGTERM')
}
