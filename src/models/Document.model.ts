import mongoose, { Document, Schema } from 'mongoose';
import path from 'path';
export type DocStatus = 'pending' | 'partially_signed' | 'signed' | 'rejected';

export interface ISignerInfo {
    email: string;
    token: string;
    tokenExpiry: Date;
    status: 'pending' | 'signed' | 'rejected';
    signedAt?: Date;
    rejectionReason?: string;
    ipAddress?: string;
}

export interface IDocument extends Document {
    ownerId?: mongoose.Types.ObjectId;
    originalName: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    status: DocStatus;
    pageCount?: number;
    signedFilePath?: string;
    signerEmail?: string;
    signerToken?: string;
    tokenExpiry?: Date;
    signers: ISignerInfo[];
    isPublic: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true, default: 'application/pdf' },
    status: { type: String, enum: ['pending', 'partially_signed', 'signed', 'rejected'], default: 'pending' },
    pageCount: { type: Number },
    signedFilePath: { type: String },
    signerEmail: { type: String, lowercase: true, trim: true },
    signerToken: { type: String },
    tokenExpiry: { type: Date },
    signers: [{
        email: { type: String, lowercase: true, trim: true },
        token: { type: String },
        tokenExpiry: { type: Date },
        status: { type: String, enum: ['pending', 'signed', 'rejected'], default: 'pending' },
        signedAt: { type: Date },
        rejectionReason: { type: String },
        ipAddress: { type: String },
    }],
    isPublic: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

DocumentSchema.virtual('fileUrl').get(function () {
    return `/uploads/${this.fileName}`;
});

DocumentSchema.virtual('signedFileUrl').get(function () {
    if (!this.signedFilePath) return null;
    const signedName = path.basename(this.signedFilePath);
    return `/uploads/signed/${signedName}`;
});

DocumentSchema.index({ ownerId: 1, originalName: 1, isDeleted: 1, createdAt: -1 });
DocumentSchema.index({ signerEmail: 1, signerToken: 1, tokenExpiry: 1 });
DocumentSchema.index({ 'signers.email': 1, 'signers.token': 1 });
DocumentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IDocument>('Document', DocumentSchema);
