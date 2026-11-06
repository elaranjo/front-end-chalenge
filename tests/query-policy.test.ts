import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import axios from 'axios'
import { queryClient } from '../src/app/query-client.ts'

test('GET retries only network and server failures, not cancellation, validation or client errors', () => {
  const options = queryClient.getDefaultOptions()
  const retry = options.queries?.retry
  assert.equal(typeof retry, 'function')
  if (typeof retry !== 'function') throw new Error('Missing query retry policy')
  const network = new axios.AxiosError('network', 'ERR_NETWORK')
  const response = (status: number) => new axios.AxiosError('response', undefined, undefined, undefined, { data: {}, status, statusText: '', headers: {}, config: {} as never })
  assert.equal(retry(0, network), true)
  assert.equal(retry(1, response(503)), true)
  assert.equal(retry(2, network), false)
  assert.equal(retry(0, response(422)), false)
  assert.equal(retry(0, new axios.CanceledError()), false)
  assert.equal(retry(0, new Error('invalid response')), false)
  assert.equal(options.mutations?.retry, false)
  assert.equal(options.queries?.gcTime, 300_000)
  assert.equal(options.queries?.staleTime, 30_000)
  const delay = options.queries?.retryDelay
  assert.equal(typeof delay, 'function')
  if (typeof delay === 'function') {
    assert.equal(delay(0, network), 250)
    assert.equal(delay(1, network), 500)
  }
})
