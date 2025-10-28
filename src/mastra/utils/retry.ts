/**
 * Retry logic with exponential backoff and circuit breaker
 */

import { AgentError, shouldRetry } from './errors';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number; // milliseconds
  maxDelay?: number;
  backoffMultiplier?: number;
  timeout?: number; // milliseconds
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  timeout: 30000, // 30 seconds
  onRetry: () => {}
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Add timeout wrapper
      const result = await withTimeout(fn(), opts.timeout);
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!shouldRetry(error)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt >= opts.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );

      // Log retry attempt
      console.log(`[RETRY] Attempt ${attempt}/${opts.maxAttempts} failed. Retrying in ${delay}ms...`);
      opts.onRetry(attempt, error);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

/**
 * Add timeout to a promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new AgentError(
          'TIMEOUT_ERROR',
          `Operation timed out after ${timeoutMs}ms`,
          'The operation took too long to complete. Please try again with a more specific query.',
          'error',
          true
        ));
      }, timeoutMs);
    })
  ]);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker implementation
 * Prevents cascading failures by stopping requests after repeated failures
 */
export class CircuitBreaker {
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly successThreshold: number = 2,
    private readonly timeout: number = 60000 // 1 minute
  ) {}

  /**
   * Check if circuit breaker is allowing requests
   */
  public canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      // Check if we should transition to HALF_OPEN
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.timeout) {
        console.log('[CIRCUIT BREAKER] Transitioning from OPEN to HALF_OPEN');
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow request to test if service recovered
    return true;
  }

  /**
   * Record a successful execution
   */
  public recordSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === 'HALF_OPEN' && this.successCount >= this.successThreshold) {
      console.log('[CIRCUIT BREAKER] Transitioning from HALF_OPEN to CLOSED');
      this.state = 'CLOSED';
      this.successCount = 0;
    }
  }

  /**
   * Record a failed execution
   */
  public recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      console.log('[CIRCUIT BREAKER] Too many failures. Transitioning to OPEN');
      this.state = 'OPEN';
    }
  }

  /**
   * Get current state
   */
  public getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  /**
   * Reset the circuit breaker
   */
  public reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
    console.log('[CIRCUIT BREAKER] Reset to CLOSED');
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new AgentError(
        'RATE_LIMIT_ERROR',
        'Circuit breaker is OPEN',
        'The service is temporarily unavailable due to repeated failures. Please try again in a moment.',
        'warning',
        true
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

// Global circuit breaker for database operations
export const databaseCircuitBreaker = new CircuitBreaker(5, 2, 60000);
