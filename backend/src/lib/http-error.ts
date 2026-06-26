export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = "Could not validate credentials") =>
  new HttpError(401, message);
export const forbidden = (message = "You do not have permission to perform this action") =>
  new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
