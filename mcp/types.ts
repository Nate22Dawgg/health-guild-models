/**
 * MCP Protocol Types
 * Based on Model Context Protocol specification
 */

export interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
}

export interface MCPResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: MCPError
}

export interface MCPError {
  code: number
  message: string
  data?: any
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface MCPToolResult {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError?: boolean
}

export interface MCPServerInfo {
  name: string
  version: string
  protocolVersion: string
  capabilities: {
    tools?: Record<string, any>
    resources?: Record<string, any>
    prompts?: Record<string, any>
  }
}

// Standard MCP error codes
export const MCPErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const
