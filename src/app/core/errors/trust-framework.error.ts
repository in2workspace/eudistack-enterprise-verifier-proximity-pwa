/**
 * Trust Framework Error
 * 
 * Thrown when trust framework operations fail (loading, parsing, querying).
 */
export class TrustFrameworkError extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'TrustFrameworkError';
  }
}
