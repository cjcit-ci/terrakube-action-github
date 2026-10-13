import * as core from '@actions/core'
import {GitHubActionInput} from './userInput'

const DEFAULT_AUDIENCE = 'terrakube.platform.local'
const REFRESH_MARGIN_MS = 60 * 1000
const DEFAULT_CACHE_MS = 4 * 60 * 1000

/** Supplies a masked bearer token, renewing GitHub credentials during long jobs. */
export class TerrakubeAuthentication {
  private token = ''
  private refreshAt = 0

  constructor(private readonly input: GitHubActionInput) {}

  async getToken(): Promise<string> {
    if (!this.input.useOidc) {
      if (!this.input.token) {
        throw new Error(
          'TERRAKUBE_TOKEN is required unless TERRAKUBE_USE_OIDC is true.'
        )
      }
      if (!this.token) {
        core.setSecret(this.input.token)
        this.token = this.input.token
      }
      return this.token
    }

    if (this.input.token) {
      throw new Error(
        'Set either TERRAKUBE_TOKEN or TERRAKUBE_USE_OIDC, not both.'
      )
    }
    if (this.token && Date.now() < this.refreshAt) return this.token

    if (
      !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
      !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
    ) {
      throw new Error(
        'GitHub OIDC is unavailable. Set permissions: id-token: write on the workflow job.'
      )
    }

    let token: string
    try {
      token = (
        await core.getIDToken(this.input.oidcAudience || DEFAULT_AUDIENCE)
      ).trim()
    } catch {
      throw new Error(
        'Could not request a GitHub OIDC token. Check id-token: write permission and the OIDC audience.'
      )
    }
    if (!token) throw new Error('GitHub returned an empty OIDC token.')

    core.setSecret(token)
    this.token = token
    this.refreshAt = Date.now() + DEFAULT_CACHE_MS
    try {
      // The expiry is used only for renewal scheduling; Terrakube verifies the JWT.
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString('utf8')
      )
      if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
        this.refreshAt = Math.min(
          this.refreshAt,
          payload.exp * 1000 - REFRESH_MARGIN_MS
        )
      }
    } catch {
      // Keep a short cache duration if the token does not expose a JWT expiry.
    }
    return this.token
  }
}
