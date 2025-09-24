import { FileRef, nextTestSetup } from 'e2e-utils'
import path from 'path'
import { retry } from 'next-test-utils'

describe('mcp-server get_errors tool', () => {
  const { next } = nextTestSetup({
    files: new FileRef(path.join(__dirname, 'fixtures', 'default-template')),
  })

  async function callGetErrors(id: string) {
    const response = await fetch(`${next.url}/_next/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: 'get_errors', arguments: {} },
      }),
    })

    const text = await response.text()
    const match = text.match(/data: ({.*})/s)
    const result = JSON.parse(match![1])
    return result.result?.content?.[0]?.text
  }

  it('should return no errors for clean page', async () => {
    await next.browser('/')
    const errors = await callGetErrors('test-1')
    expect(errors).toBe('No errors detected in the browser.')
  })

  it('should capture runtime errors with source-mapped stack frames', async () => {
    const browser = await next.browser('/')
    await browser.elementByCss('a[href="/runtime-error"]').click()

    let errors: string = ''
    await retry(async () => {
      const sessionId = 'test-2-' + Date.now()
      errors = await callGetErrors(sessionId)
      expect(errors).toContain('=== RUNTIME ERRORS ===')
    })

    expect(errors).toContain('Found 1 error(s) in the browser')
    expect(errors).toMatch(/Error: Test runtime error/)
    expect(errors).toMatch(
      /at\s+RuntimeErrorPage\s+\([^)]*runtime-error\/page\.tsx:2:9\)/
    )
    expect(errors).toContain('runtime-error/page.tsx')
  })

  it('should capture build errors when directly visiting error page', async () => {
    await next.browser('/build-error')

    let errors: string = ''
    await retry(async () => {
      const sessionId = 'test-4-' + Date.now()
      errors = await callGetErrors(sessionId)
      expect(errors).toContain('=== BUILD ERROR ===')
    })

    expect(errors).toMatch(/Found \d+ error\(s\) in the browser/)
    expect(errors).toContain('build-error/page.tsx')
    expect(errors).toMatch(/(Syntax error|Unexpected token|Expected)/)
  })
})
