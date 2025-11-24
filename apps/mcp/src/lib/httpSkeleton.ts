/**
 * Generic internal server error response in JSON-RPC shape.
 */
export const InternalServerErrorResponseSkeleton = {
  jsonrpc: "2.0",
  error: { code: -32603, message: "Internal server error." },
  id: null
};

/**
 * Response used when no valid MCP session ID is provided.
 */
export const InvalidSessionIdResponseSkeleton = {
  jsonrpc: "2.0",
  error: { code: -32600, message: "Invalid or missing session ID" },
  id: null
};


