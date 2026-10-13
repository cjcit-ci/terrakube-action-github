import * as core from '@actions/core'
import * as httpm from '@actions/http-client'
import { GitHubActionInput } from './userInput';
import { TerrakubeAuthentication } from './authentication';

export class TerrakubeClient {

    private httpClient: httpm.HttpClient;
    private authentication: TerrakubeAuthentication;
    private gitHubActionInput: GitHubActionInput;

    constructor(gitHubActionInput: GitHubActionInput) {
        this.httpClient = new httpm.HttpClient("TerrakubeClient", [], { ignoreSslError: gitHubActionInput.ignoreSslError });
        this.gitHubActionInput = gitHubActionInput;
        this.authentication = new TerrakubeAuthentication(gitHubActionInput)

        core.info(`Creating Terrakube CLient....`)
        core.info(`Endpoint: ${gitHubActionInput.terrakubeEndpoint}`)
        core.info(`Repository: ${gitHubActionInput.terrakubeRepository}`)
        core.info(`Template: ${gitHubActionInput.terrakubeTemplate}`)
    }

    getHttpClient(): httpm.HttpClient{
        return this.httpClient;
    }

    async getAuthToken(): Promise<string> {
        return this.authentication.getToken();
    }

    async getOrganizationId(organizationName: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization?filter[organization]=name==${organizationName}`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization?filter[organization]=name==${organizationName}`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response size: ${terrakubeResponse.data.length}`)

        if (terrakubeResponse.data.length === 0) {
            return ""
        } else {
            core.debug(`Organization Id: ${terrakubeResponse.data[0].id}`)

            return terrakubeResponse.data[0].id
        }
    }

    async getWorkspaceId(organizationId: string, workspaceName: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace?filter[workspace]=name==${workspaceName}"`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace?filter[workspace]=name==${workspaceName}`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response size: ${terrakubeResponse.data.length}`)

        if (terrakubeResponse.data.length === 0) {
            return ""
        } else {
            core.info(`Workspace Id: ${terrakubeResponse.data[0].id}`)

            return terrakubeResponse.data[0].id
        }
    }

    async createWorkspace(organizationId: string, name: string, terraformVersion: string, folder: string, repository: string, branch: string, ssh_key_id: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`POST ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace`)


        const sshData = `,
        "relationships": {
            "ssh": {
                "data": {
                    "type": "ssh",
                    "id": "${ssh_key_id}"
                }
            }
        }`

        const response: httpm.HttpClientResponse = await this.httpClient.post(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace`,
            `{
                "data": {
                  "type": "workspace",
                  "attributes": {
                    "name": "${name}",
                    "source": "${repository}",
                    "branch": "${branch}",
                    "folder": "${folder}",
                    "terraformVersion": "${terraformVersion}"
                  }${(ssh_key_id.length > 0 ? sshData : "")}
                }
              }`,
            {
                'Authorization': `Bearer ${authenticationToken}`,
                'Content-Type': 'application/vnd.api+json'
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response: ${JSON.stringify(terrakubeResponse)}`)

        core.info(`Variable Id: ${terrakubeResponse.data.id}`)

        return terrakubeResponse.data.id

    }

    async getTemplateId(organizationId: string, templateName: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/template?filter[template]=name==${templateName}`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/template?filter[template]=name==${templateName}`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response size: ${terrakubeResponse.data.length}`)

        if (terrakubeResponse.data.length === 0) {
            return ""
        } else {
            core.info(`Template Id: ${terrakubeResponse.data[0].id}`)

            return terrakubeResponse.data[0].id
        }

    }

    async getSshId(organizationId: string, sshName: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/ssh?filter[ssh]=name==${sshName}`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/ssh?filter[ssh]=name==${sshName}`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response size: ${terrakubeResponse.data.length}`)

        if (terrakubeResponse.data.length === 0) {
            return ""
        } else {
            core.info(`Ssh Id: ${terrakubeResponse.data[0].id}`)

            return terrakubeResponse.data[0].id
        }

    }

    async getVariableId(organizationId: string, workspaceId: string, variableName: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable?filter[variable]=key==${variableName}`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable?filter[variable]=key==${variableName}`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response size: ${terrakubeResponse.data.length === 0}`)

        if (terrakubeResponse.data.length === 0) {
            return ""
        } else {
            core.info(`Variable Id: ${terrakubeResponse.data[0].id}`)

            return terrakubeResponse.data[0].id
        }

    }

    async getVariableById(organizationId: string, workspaceId: string, variableId: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable/${variableId}`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable/${variableId}`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response: ${terrakubeResponse}`)

        return terrakubeResponse;
    }

    async updateVariableById(organizationId: string, workspaceId: string, variableId: string, variableValue: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`PATCH ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable/${variableId}`)

        const response: httpm.HttpClientResponse = await this.httpClient.patch(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable/${variableId}`,
            `{
                "data": {
                  "type": "variable",
                  "id": "${variableId}",
                  "attributes": {
                    "value": "${variableValue}"
                  }
                }
              }`,
            {
                'Authorization': `Bearer ${authenticationToken}`,
                'Content-Type': 'application/vnd.api+json'
            }
        )

        const body: string = await response.readBody()

        core.debug(`Updated Variable: ${variableId}`)

        return true;
    }

    async createVariable(organizationId: string, workspaceId: string, variableName: string, varaibleValue: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`POST ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable`)

        const response: httpm.HttpClientResponse = await this.httpClient.post(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable`,
            `{
                "data": {
                  "type": "variable",
                  "attributes": {
                    "key": "${variableName}",
                    "value": "${varaibleValue}",
                    "sensitive": false,
                    "hcl": false,
                    "category": "TERRAFORM",
                    "description": ""
                  }
                }
              }`,
            {
                'Authorization': `Bearer ${authenticationToken}`,
                'Content-Type': 'application/vnd.api+json'
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response: ${JSON.stringify(terrakubeResponse)}`)

        core.info(`Variable Id: ${terrakubeResponse.data.id}`)

        return terrakubeResponse.data.id

    }



    async getVariableValue(organizationId: string, workspaceId: string, variableName: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable?filter[variable]=key==${variableName}`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/workspace/${workspaceId}/variable?filter[variable]=key==${variableName}`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(`Response size: ${terrakubeResponse.data.length}`)

        if (terrakubeResponse.data.length === 0) {
            return ""
        } else {
            core.info(`Variable Id: ${terrakubeResponse.data[0].id}`)

            return terrakubeResponse.data[0].attributes.value
        }

    }

    async createJobId(organizationId: string, workspaceId: string, templateId: string, branchName: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        const requestBody = {
            "data": {
                "type": "job",
                "attributes": {
                    "templateReference": templateId,
                    "overrideBranch": branchName
                },
                "relationships": {
                    "workspace": {
                        "data": {
                            "type": "workspace",
                            "id": workspaceId
                        }
                    }
                }
            }
        }

        core.debug(`POST ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/job`)
        core.debug(`${JSON.stringify(requestBody)}`)

        const response: httpm.HttpClientResponse = await this.httpClient.post(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/job`,
            JSON.stringify(requestBody),
            {
                'Authorization': `Bearer ${authenticationToken}`,
                'Content-Type': 'application/vnd.api+json'
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(JSON.stringify(terrakubeResponse))

        return terrakubeResponse.data.id
    }

    async getJobData(organizationId: string, jobId: string): Promise<any> {
        const authenticationToken = await this.getAuthToken()

        core.debug(`GET ${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/job/${jobId}?include=step`)

        const response: httpm.HttpClientResponse = await this.httpClient.get(
            `${this.gitHubActionInput.terrakubeEndpoint}/api/v1/organization/${organizationId}/job/${jobId}?include=step`,
            {
                'Authorization': `Bearer ${authenticationToken}`
            }
        )

        const body: string = await response.readBody()
        const terrakubeResponse = JSON.parse(body)

        core.debug(JSON.stringify(terrakubeResponse))

        return body
    }


}
