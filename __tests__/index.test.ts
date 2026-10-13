import * as core from '@actions/core'
import * as httpm from '@actions/http-client'
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  jest,
  test
} from '@jest/globals'
import {TerrakubeAuthentication} from '../src/authentication'
import {getActionInput, GitHubActionInput} from '../src/userInput'
import {TerrakubeClient} from '../src/terrakube'

jest.mock('@actions/core')

const input: GitHubActionInput = {
  token: 'personal-access-token',
  terrakubeEndpoint: 'https://terrakube.example.com',
  terrakubeRepository: 'https://github.com/example/repo.git',
  terrakubeTemplate: 'Plan',
  terrakubeOrganization: 'example',
  terrakubeFolder: 'workspace',
  terrakubeSshKeyName: '',
  githubToken: 'github-token',
  showOutput: false,
  branch: 'main',
  ignoreSslError: false,
  githubWorkspace: '/workspace'
}
const oidcInput = {...input, token: '', useOidc: true}
const originalEnv = {...process.env}

function jwt(expiresAt: number): string {
  return `header.${Buffer.from(JSON.stringify({exp: expiresAt})).toString(
    'base64'
  )}.signature`
}

beforeEach(() => {
  jest.resetAllMocks()
  process.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'https://oidc.example.com'
  process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'request-token'
})

afterEach(() => {
  process.env = {...originalEnv}
  jest.restoreAllMocks()
})

describe('authentication', () => {
  test('masks and reuses supplied tokens without requesting OIDC', async () => {
    const auth = new TerrakubeAuthentication(input)
    expect(await auth.getToken()).toBe(input.token)
    expect(await auth.getToken()).toBe(input.token)
    expect(core.setSecret).toHaveBeenCalledWith(input.token)
    expect(core.getIDToken).not.toHaveBeenCalled()
  })

  test.each([undefined, 'custom-audience'])(
    'requests the configured audience: %s',
    async audience => {
      jest.mocked(core.getIDToken).mockResolvedValue('  federated-token  ')
      const auth = new TerrakubeAuthentication({
        ...oidcInput,
        oidcAudience: audience
      })
      expect(await auth.getToken()).toBe('federated-token')
      expect(core.getIDToken).toHaveBeenCalledWith(
        audience || 'terrakube.platform.local'
      )
      expect(core.setSecret).toHaveBeenCalledWith('federated-token')
      await auth.getToken()
      expect(core.getIDToken).toHaveBeenCalledTimes(1)
    }
  )

  test('renews before JWT expiry during long jobs', async () => {
    const now = 1700000000000
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now)
    const first = jwt(now / 1000 + 120)
    const second = jwt(now / 1000 + 600)
    jest
      .mocked(core.getIDToken)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
    const auth = new TerrakubeAuthentication(oidcInput)
    expect(await auth.getToken()).toBe(first)
    clock.mockReturnValue(now + 59000)
    expect(await auth.getToken()).toBe(first)
    clock.mockReturnValue(now + 60000)
    expect(await auth.getToken()).toBe(second)
    expect(core.setSecret).toHaveBeenCalledWith(second)
    expect(core.getIDToken).toHaveBeenCalledTimes(2)
  })

  test('renews opaque tokens after four minutes', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0)
    jest
      .mocked(core.getIDToken)
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second')
    const auth = new TerrakubeAuthentication(oidcInput)
    expect(await auth.getToken()).toBe('first')
    clock.mockReturnValue(240000)
    expect(await auth.getToken()).toBe('second')
  })

  test('explains missing OIDC permission', async () => {
    delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL
    await expect(
      new TerrakubeAuthentication(oidcInput).getToken()
    ).rejects.toThrow('id-token: write')
    expect(core.getIDToken).not.toHaveBeenCalled()
  })

  test('rejects missing credentials and conflicting authentication modes', async () => {
    await expect(
      new TerrakubeAuthentication({...input, token: ''}).getToken()
    ).rejects.toThrow('TERRAKUBE_TOKEN is required')
    await expect(
      new TerrakubeAuthentication({...input, useOidc: true}).getToken()
    ).rejects.toThrow('not both')
  })

  test('rejects empty OIDC tokens', async () => {
    jest.mocked(core.getIDToken).mockResolvedValue('  ')
    await expect(
      new TerrakubeAuthentication(oidcInput).getToken()
    ).rejects.toThrow('empty OIDC token')
    expect(core.setSecret).not.toHaveBeenCalled()
  })

  test('does not fall back to an expired token or leak request errors', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(0)
    jest
      .mocked(core.getIDToken)
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('sensitive request details'))
    const auth = new TerrakubeAuthentication(oidcInput)
    await auth.getToken()
    clock.mockReturnValue(240000)
    await expect(auth.getToken()).rejects.toThrow(
      'Could not request a GitHub OIDC token'
    )
  })
})

describe('action inputs', () => {
  beforeEach(() => {
    jest.mocked(core.getInput).mockImplementation((name, options) => {
      const values: Record<string, string> = {
        terrakube_token: input.token,
        terrakube_endpoint: input.terrakubeEndpoint,
        server_url: 'https://github.com',
        git_repository: 'example/repo',
        terrakube_template: 'Plan',
        terrakube_branch: 'main',
        terrakube_folder: 'workspace',
        terrakube_organization: 'example',
        github_token: 'github-token',
        github_workspace: '/workspace'
      }
      const value = values[name] || ''
      if (options?.required && !value)
        throw new Error(`Input required: ${name}`)
      return value
    })
    jest.mocked(core.getBooleanInput).mockReturnValue(false)
  })

  test('preserves supplied-token workflows and removes partial credential logging', async () => {
    expect((await getActionInput()).token).toBe(input.token)
    expect(core.setSecret).toHaveBeenCalledWith(input.token)
    for (const [message] of jest.mocked(core.debug).mock.calls) {
      expect(message).not.toContain(input.token.substring(0, 10))
    }
  })

  test('allows OIDC without TERRAKUBE_TOKEN', async () => {
    const readInput = jest.mocked(core.getInput).getMockImplementation()!
    jest
      .mocked(core.getInput)
      .mockImplementation((name, options) =>
        name === 'terrakube_token' ? '' : readInput(name, options)
      )
    jest
      .mocked(core.getBooleanInput)
      .mockImplementation(name => name === 'terrakube_use_oidc')
    expect(await getActionInput()).toMatchObject({
      token: '',
      useOidc: true,
      oidcAudience: 'terrakube.platform.local'
    })
    expect(core.getInput).toHaveBeenCalledWith('terrakube_token', {
      required: false
    })
  })

  test('rejects conflicting inputs before requesting OIDC', async () => {
    jest
      .mocked(core.getBooleanInput)
      .mockImplementation(name => name === 'terrakube_use_oidc')
    await expect(getActionInput()).rejects.toThrow('not both')
    expect(core.getIDToken).not.toHaveBeenCalled()
  })
})

describe('Terrakube API credentials', () => {
  test.each([false, true])(
    'authenticates API requests and exposes the log credential (OIDC: %s)',
    async useOidc => {
      jest.mocked(core.getIDToken).mockResolvedValue('federated-token')
      const client = new TerrakubeClient(useOidc ? oidcInput : input)
      const token = useOidc ? 'federated-token' : input.token
      const response = {
        readBody: async () =>
          JSON.stringify({data: [{id: 'id', attributes: {value: 'value'}}]})
      } as httpm.HttpClientResponse
      const get = jest
        .spyOn(client.getHttpClient(), 'get')
        .mockResolvedValue(response)
      const post = jest
        .spyOn(client.getHttpClient(), 'post')
        .mockResolvedValue(response)
      const patch = jest
        .spyOn(client.getHttpClient(), 'patch')
        .mockResolvedValue(response)
      await client.getOrganizationId('example')
      await client.getWorkspaceId('org', 'workspace')
      await client.getTemplateId('org', 'Plan')
      await client.getSshId('org', 'ssh')
      await client.getVariableId('org', 'workspace', 'key')
      await client.getVariableById('org', 'workspace', 'var')
      await client.getVariableValue('org', 'workspace', 'key')
      await client.getJobData('org', 'job')
      await client.createWorkspace(
        'org',
        'workspace',
        '1.2.9',
        'folder',
        'repo',
        'main',
        ''
      )
      await client.createJobId('org', 'workspace', 'template', 'main')
      await client.createVariable('org', 'workspace', 'key', 'value')
      await client.updateVariableById('org', 'workspace', 'var', 'value')
      for (const [, headers] of get.mock.calls)
        expect(headers).toMatchObject({Authorization: `Bearer ${token}`})
      for (const [, , headers] of [...post.mock.calls, ...patch.mock.calls])
        expect(headers).toMatchObject({Authorization: `Bearer ${token}`})
      expect(await client.getAuthToken()).toBe(token)
      expect(core.getIDToken).toHaveBeenCalledTimes(useOidc ? 1 : 0)
    }
  )
})
