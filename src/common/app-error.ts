export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;
    public additionalInfo?: any;
    constructor(message: string, statusCode: number, additionalInfo?: any) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // This flag can be used to determine if the error is operational or programming error
        this.additionalInfo = additionalInfo;
        // Set the prototype explicitly to maintain the prototype chain
        Object.setPrototypeOf(this, AppError.prototype);
        // Capture the stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}