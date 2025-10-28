/**
 * Custom error classes for the VelocityFibre Agent
 */

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
export type ErrorCode =
  | 'DATABASE_CONNECTION_ERROR'
  | 'QUERY_EXECUTION_ERROR'
  | 'INVALID_TABLE'
  | 'INVALID_COLUMN'
  | 'INVALID_INPUT'
  | 'MISSING_PARAMETER'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'CALCULATION_ERROR'
  | 'EXPORT_ERROR'
  | 'UNKNOWN_ERROR';

export class AgentError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = 'error',
    retryable: boolean = false,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.userMessage = userMessage;
    this.severity = severity;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentError);
    }
  }

  /**
   * Get a user-friendly error message
   */
  toUserMessage(): string {
    return this.userMessage;
  }

  /**
   * Get a detailed error message for logging
   */
  toLogMessage(): string {
    return JSON.stringify({
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    }, null, 2);
  }

  /**
   * Convert to a JSON-serializable object
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp.toISOString()
    };
  }
}

/**
 * Convert unknown errors to AgentError
 */
export function normalizeError(error: unknown, context?: Record<string, any>): AgentError {
  if (error instanceof AgentError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for known error patterns
    const message = error.message.toLowerCase();

    // Database connection errors
    if (message.includes('connect') || message.includes('econnrefused')) {
      return new AgentError(
        'DATABASE_CONNECTION_ERROR',
        error.message,
        'Unable to connect to the database. Please try again in a moment.',
        'critical',
        true,
        context
      );
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return new AgentError(
        'TIMEOUT_ERROR',
        error.message,
        'The query took too long to execute. Please try a more specific query or add filters.',
        'error',
        true,
        context
      );
    }

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return new AgentError(
        'RATE_LIMIT_ERROR',
        error.message,
        'Too many requests. Please wait a moment before trying again.',
        'warning',
        true,
        context
      );
    }

    // Generic query errors
    if (message.includes('syntax') || message.includes('column') || message.includes('table')) {
      return new AgentError(
        'QUERY_EXECUTION_ERROR',
        error.message,
        'There was an error with the query. Please check your parameters and try again.',
        'error',
        false,
        context
      );
    }

    // Unknown error
    return new AgentError(
      'UNKNOWN_ERROR',
      error.message,
      'An unexpected error occurred. Please try again.',
      'error',
      true,
      context
    );
  }

  // Non-Error objects
  return new AgentError(
    'UNKNOWN_ERROR',
    String(error),
    'An unexpected error occurred. Please try again.',
    'error',
    true,
    context
  );
}

/**
 * Check if an error should be retried
 */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof AgentError) {
    return error.retryable;
  }

  // By default, retry for unknown errors
  return true;
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof AgentError) {
    return error.toUserMessage();
  }

  if (error instanceof Error) {
    return normalizeError(error).toUserMessage();
  }

  return 'An unexpected error occurred. Please try again.';
}
