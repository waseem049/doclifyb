// This file defines custom error classes for the application.

export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number,
        public code: string
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}       