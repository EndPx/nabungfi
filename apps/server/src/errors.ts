export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) { super(message); }
}
export const notFound = () => new ApiError('NOT_FOUND', 404, 'This goal or step is not available.');
