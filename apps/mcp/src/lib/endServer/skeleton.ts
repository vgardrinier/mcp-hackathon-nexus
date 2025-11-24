export const EndServerInitializeRequestSkeleton = {
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {
      roots: { listChanged: true },
      sampling: {},
      elicitation: {}
    },
    clientInfo: {
      name: "Nexus L2 MCP Proxy Client",
      title: "Nexus L2 MCP Proxy Client",
      version: "1.0.0"
    }
  }
};

export const EndServerToolsListRequestSkeleton = {
  jsonrpc: "2.0",
  method: "tools/list",
  params: {}
};

export const EndServerToolsCallRequestSkeleton = {
  jsonrpc: "2.0",
  method: "tools/call"
};


