import mongoose, { Document, Schema } from 'mongoose';
export type SigStatus = 'pending' | 'signed' | 'rejected';

export interface ISignature extends Document {
    documentId: mongoose.Types.ObjectId;
    placedBy: mongoose.Types.ObjectId;
    pageNumber: number;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
    status: SigStatus;
    type: 'signature' | 'text' | 'date' | 'initials';
    assignedTo?: string; // email of specific signer
    value?: string; // typed text or date
    imageData?: string; // Base64-encoded
    signedFilePath?: string;
    signerEmail?: string;
    signerToken?: string;
    signedAt?: Date;
    ipAddress?: string;
    tokenExpiry?: Date;
    isDeleted: boolean;
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SignatureSchema = new Schema<ISignature>({
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    placedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    xPercent: { type: Number, required: true, min: 0, max: 100 },
    yPercent: { type: Number, required: true, min: 0, max: 100 },
    widthPercent: { type: Number, required: true, min: 0, max: 100 },
    heightPercent: { type: Number, required: true, min: 0, max: 100 },
    pageNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['pending', 'signed', 'rejected'], default: 'pending' },
    type: { type: String, enum: ['signature', 'text', 'date', 'initials'], default: 'signature' },
    assignedTo: { type: String, lowercase: true, trim: true },
    value: { type: String },
    imageData: { type: String },
    signedAt: { type: Date },
    ipAddress: { type: String },
    signerEmail: { type: String, lowercase: true, trim: true },
    signerToken: { type: String },
    tokenExpiry: { type: Date },
    signedFilePath: { type: String },
    isDeleted: { type: Boolean, default: false },
    rejectionReason: { type: String },
}, { timestamps: true });

SignatureSchema.index({ documentId: 1, pageNumber: 1 });
SignatureSchema.index({ documentId: 1, status: 1 });

export default mongoose.model<ISignature>('Signature', SignatureSchema);