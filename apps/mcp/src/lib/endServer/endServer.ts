import type { JSONRPCMessage, Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  EndServerInitializeRequestSkeleton,
  EndServerToolsCallRequestSkeleton,
  EndServerToolsListRequestSkeleton
} from "./skeleton.js";
import {
  EndServerConfig,
  EndServerData,
  EndServerEnvVariable,
  EndServerOptions,
  EndServerTransport
} from "./types.js";
import { createServerTransport, verifyEnvironmentVariables } from "./utils.js";

export class EndServer {
  private readonly idValue: string;
  private readonly nameValue: string;
  private readonly descriptionValue?: string;
  private readonly sourceUrlValue?: string;
  private readonly categoryValue?: string;
  private readonly installedOnValue?: Date | string;
  private readonly logoUrlValue?: string;
  private readonly config: EndServerConfig;
  private readonly environmentVariablesValue: EndServerEnvVariable[];
  private accessToken?: string;

  private readonly options?: EndServerOptions;
  private transport: EndServerTransport | null;

  private responseCounter = 1;
  private readonly responsePromises = new Map<
    number,
    { resolve: (value: JSONRPCMessage) => void; reject: (reason?: Error) => void }
  >();

  constructor(data: EndServerData, options?: EndServerOptions) {
    this.idValue = data.id;
    this.nameValue = data.name;
    this.descriptionValue = data.description;
    this.sourceUrlValue = data.sourceUrl;
    this.categoryValue = data.category;
    this.installedOnValue = data.installedOn;
    this.logoUrlValue = data.logoUrl;
    this.config = data.config;
    this.environmentVariablesValue = data.environmentVariables;
    this.accessToken = data.accessToken;
    this.options = options;
    this.transport = null;
  }

  get id() {
    return this.idValue;
  }

  get name() {
    return this.nameValue;
  }

  get description() {
    return this.descriptionValue;
  }

  get sourceUrl() {
    return this.sourceUrlValue;
  }

  get category() {
    return this.categoryValue;
  }

  get installedOn() {
    return this.installedOnValue;
  }

  get logoUrl() {
    return this.logoUrlValue;
  }

  get environmentVariables() {
    return this.environmentVariablesValue;
  }

  get isTransportCreated() {
    return this.transport !== null && this.transport !== undefined;
  }

  updateAccessToken(accessToken: string) {
    this.accessToken = accessToken;
    console.log(`\x1B[90m[${this.nameValue}] Access token updated.\x1B[0m`);
  }

  private async sendRequest(request: JSONRPCMessage): Promise<JSONRPCMessage> {
    if (!this.transport) throw new Error("No transport for server");

    return new Promise((resolve, reject) => {
      try {
        const id = this.responseCounter++;
        this.responsePromises.set(id, { resolve, reject });
        this.transport!.send({ ...request, id });
        console.log(`\x1B[96m[${this.nameValue}] #${id} sent request\x1B[0m`);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private async rejectPendingRequests(reason?: string) {
    const errorToReject = new Error(reason || "Transport closed");
    const pendingCount = this.responsePromises.size;

    for (const [, { reject }] of this.responsePromises) {
      try {
        reject(errorToReject);
      } catch (error) {
        console.log(
          `\x1B[90m[${this.nameValue}] Error during promise rejection (ignoring): ${
            error instanceof Error ? error.message : String(error)
          }\x1B[0m`
        );
      }
    }
    this.responsePromises.clear();
    console.log(`\x1B[90m[${this.nameValue}] Rejected ${pendingCount} pending requests.\x1B[0m`);
  }

  private async handleMessage(message: JSONRPCMessage) {
    if ("method" in message) {
      switch (message.method) {
        case "notifications/tools/list_changed":
          console.log(`\x1B[96m[${this.nameValue}] notification: tools list changed\x1B[0m`);
          await this.options?.handleToolsListChanged();
          break;
        default:
          console.error(`\x1B[91m[${this.nameValue}] Unknown method: ${message.method}\x1B[0m`);
          break;
      }
      return;
    }

    if ("id" in message && message.id !== undefined && typeof message.id === "number") {
      if (this.responsePromises.has(message.id)) {
        console.log(`\x1B[96m[${this.nameValue}] #${message.id} received response\x1B[0m`);
        const { resolve } = this.responsePromises.get(message.id)!;
        this.responsePromises.delete(message.id);
        resolve(message);
      }
      return;
    }

    console.error(`\x1B[91m[${this.nameValue}] Unknown message: ${JSON.stringify(message, null, 2)}\x1B[0m`);
  }

  private async handleError(error: Error) {
    if (error.message.includes("401") && error.message.includes("invalid_token")) {
      console.log(`\x1B[91m[${this.nameValue}] Unauthorized. (${error.message})\x1B[0m`);
      await this.closeTransport("Unauthorized: Invalid or missing access token");
      return;
    }

    console.error(`\x1B[91m[${this.nameValue}] Error from end server: ${error.message}\x1B[0m`);
  }

  async listTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];
    let cursor: string | undefined;

    do {
      const request = {
        ...EndServerToolsListRequestSkeleton,
        params: cursor ? { cursor } : {}
      };

      const response = await this.sendRequest(request as JSONRPCMessage);
      if ("result" in response) {
        allTools.push(...((response.result.tools || []) as Tool[]));
        cursor = (response.result.nextCursor as string) || undefined;
      } else {
        throw new Error("Invalid response from end server");
      }
    } while (cursor);

    return allTools;
  }

  async callTool(name: string, params: unknown) {
    const res = await this.sendRequest({
      ...EndServerToolsCallRequestSkeleton,
      params: {
        ...(params as Record<string, unknown>),
        name
      }
    } as JSONRPCMessage);

    if ("result" in res) {
      return res.result;
    }

    if ("error" in res && res.error) {
      throw new Error(`End server error: ${res.error.message}`);
    }

    throw new Error("Invalid response from end server");
  }

  async createTransport() {
    if (this.transport) throw new Error("Transport already created");

    if (!verifyEnvironmentVariables(this.environmentVariablesValue)) {
      console.error(`\x1B[91m[${this.nameValue}] Missing required env variables.\x1B[0m`);
      return;
    }

    this.transport = await createServerTransport(this.config, this.accessToken);

    this.transport.onmessage = async (message: JSONRPCMessage) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error(`\x1B[91m[${this.nameValue}] Error handling message:`, error, "\x1B[0m");
      }
    };

    this.transport.onerror = async (error: Error) => {
      try {
        await this.handleError(error);
      } catch (handlerError) {
        console.error(`\x1B[91m[${this.nameValue}] Error in error handler:`, handlerError, "\x1B[0m");
      }
    };

    console.log(
      `\x1B[90m[${this.nameValue}] Transport created ${this.accessToken ? "with" : "without"} authentication.\x1B[0m`
    );
  }

  async startTransport() {
    if (!this.transport) throw new Error("No transport for server");

    await this.transport.start();
    console.log(`\x1B[90m[${this.nameValue}] Transport started.\x1B[0m`);
  }

  async closeTransport(reason?: string) {
    if (!this.transport) {
      console.log(`\x1B[90m[${this.nameValue}] Transport already closed or not created.\x1B[0m`);
      return;
    }

    await this.rejectPendingRequests(reason);

    try {
      await this.transport.close();
      console.log(`\x1B[90m[${this.nameValue}] Transport closed.\x1B[0m`);
    } catch (error) {
      console.log(
        `\x1B[90m[${this.nameValue}] Transport close error (ignoring): ${
          error instanceof Error ? error.message : String(error)
        }\x1B[0m`
      );
    } finally {
      this.transport = null;
    }
  }

  async initializeConnection() {
    const res = await this.sendRequest({
      ...EndServerInitializeRequestSkeleton
    } as JSONRPCMessage);

    if ("error" in res && res.error) {
      throw new Error(`${this.nameValue} error: ${res.error.message || "Unknown error"}`);
    }

    console.log(`\x1B[90m[${this.nameValue}] Initialized.\x1B[0m`);
  }
}
