/**
 * Lightweight security utilities for Nexus MCP
 * 
 * - Intent sanitization: Strips prompt injection patterns
 * - Rate limiting: Prevents API quota exhaustion
 */

// ============================================================================
// Intent Sanitization
// ============================================================================

// Patterns commonly used in prompt injection attacks
const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above|all)\s+(instructions?|prompts?|rules?)/gi,
  /forget\s+(everything|that|what|previous)/gi,
  /disregard\s+(previous|prior|above|all)/gi,
  /instead\s*,?\s*(do|execute|run|perform)/gi,
  /actually\s*,?\s*(do|execute|run|perform)/gi,
  /new\s+instructions?:/gi,
  /system\s*prompt:/gi,
  /\[system\]/gi,
  /\[admin\]/gi,
  /override\s+(mode|settings?|config)/gi,
  /bypass\s+(security|auth|check)/gi,
];

// Max length for intents (prevents abuse via extremely long strings)
const MAX_INTENT_LENGTH = 500;

/**
 * Sanitizes user intent to remove potential injection patterns.
 * Returns cleaned intent string.
 */
export function sanitizeIntent(intent: string): string {
  if (!intent || typeof intent !== 'string') {
    return '';
  }

  let sanitized = intent;

  // Remove injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Collapse multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate to max length
  if (sanitized.length > MAX_INTENT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_INTENT_LENGTH);
  }

  return sanitized;
}

/**
 * Checks if intent contains suspicious patterns (for logging/alerting)
 */
export function detectInjectionAttempt(intent: string): boolean {
  if (!intent || typeof intent !== 'string') {
    return false;
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(intent)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limits
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limits (per minute)
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  // GitHub has 30 requests/min for search
  'search_repositories': { max: 30, windowMs: 60000 },
  'search_code': { max: 30, windowMs: 60000 },
  'search_issues': { max: 30, windowMs: 60000 },
  
  // Linear has generous limits but still be careful
  'linear_search': { max: 60, windowMs: 60000 },
  
  // Supabase - conservative defaults
  'supabase_query': { max: 100, windowMs: 60000 },
  
  // Default for unknown tools
  'default': { max: 100, windowMs: 60000 },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Checks if a tool call is within rate limits.
 * Returns whether the call is allowed and remaining quota.
 */
export function checkRateLimit(toolName: string): RateLimitResult {
  const now = Date.now();
  
  // Find applicable limit (check for partial matches)
  let limitConfig = RATE_LIMITS.default;
  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    if (key !== 'default' && toolName.toLowerCase().includes(key.toLowerCase())) {
      limitConfig = config;
      break;
    }
  }

  const entry = rateLimitStore.get(toolName);

  // No entry or window expired - create new entry
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(toolName, {
      count: 1,
      resetAt: now + limitConfig.windowMs
    });
    return {
      allowed: true,
      remaining: limitConfig.max - 1,
      resetInMs: limitConfig.windowMs
    };
  }

  // Check if within limit
  if (entry.count >= limitConfig.max) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: entry.resetAt - now
    };
  }

  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: limitConfig.max - entry.count,
    resetInMs: entry.resetAt - now
  };
}

/**
 * Gets current rate limit status for a tool (for debugging/monitoring)
 */
export function getRateLimitStatus(toolName: string): RateLimitEntry | null {
  return rateLimitStore.get(toolName) || null;
}

/**
 * Clears all rate limit entries (useful for testing)
 */
export function clearRateLimits(): void {
  rateLimitStore.clear();
}

// ============================================================================
// Exported types
// ============================================================================

export type { RateLimitResult, RateLimitEntry };

