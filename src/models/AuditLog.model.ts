import mongoose, { Schema } from 'mongoose';

const AuditLogSchema = new Schema({
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String },
    userAgent: { type: String },
    details: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed, default: {} },
    previousHash: { type: String, default: '0' },
    hash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
});

AuditLogSchema.index({ documentId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 }); // Optional: auto-delete logs after 2 year

export default mongoose.model('AuditLog', AuditLogSchema);