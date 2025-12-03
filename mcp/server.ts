/**
 * MCP Server Implementation
 * Handles MCP protocol over HTTP/SSE
 */

import { Context } from 'hono'
import {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPErrorCode,
  MCPServerInfo
} from './types'
import { HEALTH_GUILD_TOOLS, executeHealthGuildTool } from './tools'

const SERVER_INFO: MCPServerInfo = {
  name: 'health-guild-mcp',
  version: '1.0.0',
  protocolVersion: '2024-11-05',
  capabilities: {
    tools: {}
  }
}

/**
 * Create MCP response
 */
function createMCPResponse(id: string | number, result: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    result
  }
}

/**
 * Create MCP error response
 */
function createMCPError(id: string | number, code: number, message: string, data?: any): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data
    }
  }
}

/**
 * Handle MCP request
 */
export async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request

  try {
    switch (method) {
      case 'initialize': {
        return createMCPResponse(id, {
          protocolVersion: SERVER_INFO.protocolVersion,
          capabilities: SERVER_INFO.capabilities,
          serverInfo: {
            name: SERVER_INFO.name,
            version: SERVER_INFO.version
          }
        })
      }

      case 'tools/list': {
        return createMCPResponse(id, {
          tools: HEALTH_GUILD_TOOLS
        })
      }

      case 'tools/call': {
        if (!params || !params.name) {
          return createMCPError(id, MCPErrorCode.InvalidParams, 'Missing tool name')
        }

        const { name, arguments: args } = params
        const result = await executeHealthGuildTool(name, args || {})

        return createMCPResponse(id, result)
      }

      case 'ping': {
        return createMCPResponse(id, {})
      }

      default: {
        return createMCPError(
          id,
          MCPErrorCode.MethodNotFound,
          `Method not found: ${method}`
        )
      }
    }
  } catch (error: any) {
    return createMCPError(
      id,
      MCPErrorCode.InternalError,
      error.message || 'Internal server error',
      { stack: error.stack }
    )
  }
}

/**
 * Handle MCP over HTTP (SSE transport)
 */
export async function handleMCPSSE(c: Context) {
  // Check for API key (optional, add security later)
  const apiKey = c.req.header('X-API-Key')
  
  // For now, allow all requests
  // TODO: Implement API key validation

  return c.streamText(async (stream) => {
    try {
      // Parse request body
      const body = await c.req.json<MCPRequest>()

      // Handle the MCP request
      const response = await handleMCPRequest(body)

      // Send SSE event
      await stream.writeln(`data: ${JSON.stringify(response)}`)
      await stream.writeln('')
    } catch (error: any) {
      // Send error as SSE
      const errorResponse = createMCPError(
        0,
        MCPErrorCode.ParseError,
        error.message || 'Failed to parse request'
      )
      await stream.writeln(`data: ${JSON.stringify(errorResponse)}`)
      await stream.writeln('')
    }
  })
}

/**
 * Handle MCP over regular HTTP POST (simpler for testing)
 */
export async function handleMCPHTTP(c: Context) {
  try {
    const body = await c.req.json<MCPRequest>()
    const response = await handleMCPRequest(body)
    return c.json(response)
  } catch (error: any) {
    const errorResponse = createMCPError(
      0,
      MCPErrorCode.ParseError,
      error.message || 'Failed to parse request'
    )
    return c.json(errorResponse, 400)
  }
}

/**
 * Get MCP server info (for discovery)
 */
export async function getMCPInfo(c: Context) {
  return c.json({
    server: SERVER_INFO,
    endpoints: {
      http: '/mcp',
      sse: '/mcp/sse',
      health: '/mcp/health'
    },
    tools: HEALTH_GUILD_TOOLS.map(t => ({
      name: t.name,
      description: t.description
    })),
    documentation: 'https://github.com/YOUR_USERNAME/health-guild-mcp',
    usage: {
      http_example: {
        method: 'POST',
        url: '/mcp',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'your-api-key (optional)'
        },
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        }
      }
    }
  })
}
