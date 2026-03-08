import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { PDFDocument, rgb } from 'pdf-lib';
import DocumentModel, { IDocument } from '../models/Document.model';
import Signature, { ISignature } from '../models/Signature.model';
import User from '../models/User.model';
import { AppError } from '../types/errors';
import { toAbsolutePoints } from '../utils/coordinates.utils';
import * as emailService from './email.service';

export async function savePlacement(userId: string | undefined, data: any) {
    const doc = await DocumentModel.findOne({
        _id: data.documentId, ownerId: userId, isDeleted: false,
    });
    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');
    if (doc.status === 'signed' || doc.status === 'rejected')
        throw new AppError('Document already finalized', 409, 'DOC_FINALIZED');
    if (data.page > (doc.pageCount ?? 9999))
        throw new AppError(`Page ${data.page} out of range`, 422, 'PAGE_OUT_OF_RANGE');

    return Signature.create({
        documentId: data.documentId,
        placedBy: userId,
        xPercent: data.xPercent,
        yPercent: data.yPercent,
        widthPercent: data.widthPercent,
        heightPercent: data.heightPercent,
        pageNumber: data.page,
        type: data.type || 'signature',
        assignedTo: data.assignedTo,
    });
}

export async function getPlacementsForDoc(docId: string) {
    return Signature.find({ documentId: docId }).sort({ pageNumber: 1, createdAt: 1 }).lean();
}

export async function removePlacement(sigId: string, userId: string | undefined) {
    const sig = await Signature.findById(sigId);
    if (!sig) throw new AppError('Signature field not found', 404, 'SIG_NOT_FOUND');
    const doc = await DocumentModel.findOne({ _id: sig.documentId, ownerId: userId });
    if (!doc) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    await sig.deleteOne();
}

export async function generateShareToken(
    docId: string, ownerId: string, signerEmail: string
) {
    const doc = await DocumentModel.findOne({ _id: docId, ownerId, isDeleted: false });
    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');
    if (doc.status === 'signed' || doc.status === 'rejected')
        throw new AppError('Document already finalized', 409, 'DOC_FINALIZED');

    const fieldCount = await Signature.countDocuments({ documentId: docId });
    if (!fieldCount)
        throw new AppError('Place at least one signature field first', 422, 'NO_FIELDS');

    // Check if this signer already exists
    const existingSigner = doc.signers?.find(s => s.email.toLowerCase() === signerEmail.toLowerCase());

    let token: string;
    let signerStatus = 'pending';

    if (existingSigner && existingSigner.status === 'pending') {
        // Regenerate token for existing pending signer
        token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

        await DocumentModel.updateOne(
            { _id: docId, 'signers.email': signerEmail.toLowerCase() },
            { $set: { 'signers.$.token': token, 'signers.$.tokenExpiry': expiry } }
        );
    } else {
        // Add new signer
        token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

        const newSigner = {
            email: signerEmail.toLowerCase(),
            token,
            tokenExpiry: expiry,
            status: 'pending' as const
        };

        if (!doc.signers) doc.signers = [];
        doc.signers.push(newSigner);

        // Also update legacy fields for backward compatibility
        if (!doc.signerToken) {
            doc.signerToken = token;
            doc.tokenExpiry = expiry;
            doc.signerEmail = signerEmail.toLowerCase();
        }

        await doc.save();
    }

    const owner = await User.findById(ownerId).select('email').lean();
    await emailService.sendSigningLink(signerEmail, token, doc.originalName, owner?.email);
    return `${process.env.CLIENT_URL}/sign/${token}`;
}

export async function finalizePDF(
    token: string, fieldsData: Array<{ fieldId: string; imageData?: string; value?: string }>, ipAddress: string
) {
    // Find by legacy token or new signers array
    let doc = await DocumentModel.findOne({
        signerToken: token,
        tokenExpiry: { $gt: new Date() },
        status: { $in: ['pending', 'partially_signed'] },
        isDeleted: false,
    });

    // If not found, search in signers array
    if (!doc) {
        doc = await DocumentModel.findOne({
            'signers.token': token,
            'signers.tokenExpiry': { $gt: new Date() },
            'signers.status': 'pending',
            isDeleted: false,
        });
    }

    if (!doc) throw new AppError('Invalid or expired signing link', 404, 'TOKEN_INVALID');

    // Find which signer this is
    let signerEmail = doc.signerEmail;
    const signerInArray = doc.signers?.find(s => s.token === token);
    if (signerInArray) {
        signerEmail = signerInArray.email;
    }

    if (!fieldsData || !fieldsData.length)
        throw new AppError('No signature fields provided', 422, 'NO_FIELDS');

    // Load original PDF
    console.log('Finalizing PDF: loading bytes from', doc.filePath);
    const pdfBytes = fs.readFileSync(doc.filePath);
    console.log('PDF bytes loaded, length:', pdfBytes.length);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    console.log('PDF loaded, total pages:', pages.length);

    const processedFields = [];

    // Flatten AcroForms (remove interactive fields)
    const form = pdfDoc.getForm();
    try {
        form.flatten();
    } catch (e) {
        console.warn('Could not flatten AcroForm', e);
    }

    // Embed signature on every field
    for (const fieldData of fieldsData) {
        const field = await Signature.findById(fieldData.fieldId);
        if (!field || field.documentId.toString() !== doc._id.toString()) continue;
        if (field.status !== 'pending') continue;
        if (field.assignedTo && field.assignedTo !== signerEmail) continue;

        const page = pages[field.pageNumber - 1];
        if (!page) continue;

        const { width: pw, height: ph } = page.getSize();
        const { x, y, width, height } = toAbsolutePoints(
            {
                xPercent: field.xPercent,
                yPercent: field.yPercent,
                widthPercent: field.widthPercent,
                heightPercent: field.heightPercent,
            },
            pw, ph
        );

        if (field.type === 'signature' || field.type === 'initials') {
            if (fieldData.imageData) {
                const imgBytes = Buffer.from(fieldData.imageData.split(',')[1], 'base64');
                const mimeType = fieldData.imageData.split(',')[0].split(':')[1].split(';')[0];

                let image;
                if (mimeType === 'image/png') {
                    image = await pdfDoc.embedPng(imgBytes);
                } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                    image = await pdfDoc.embedJpg(imgBytes);
                } else {
                    continue; // Skip unsupported image format
                }

                if (image) {
                    page.drawImage(image, { x, y, width, height });
                    page.drawText(
                        `Signed: ${signerEmail} | ${new Date().toISOString()}`,
                        { x, y: y - 10, size: 6, color: rgb(0.45, 0.45, 0.45) }
                    );
                }
            }
        } else if ((field.type === 'text' || field.type === 'date') && fieldData.value) {
            page.drawText(fieldData.value, {
                x: x + 5,
                y: y + height / 2 - 6,
                size: Math.min(height * 0.6, 14),
                color: rgb(0, 0, 0),
            });
        }

        processedFields.push({
            id: field._id,
            imageData: fieldData.imageData,
            value: fieldData.value
        });
    }

    if (processedFields.length === 0) {
        throw new AppError('No valid fields were signed', 400, 'NO_FIELDS_SIGNED');
    }

    // Enterprise metadata and security
    pdfDoc.setProducer('DocSign Enterprise');
    pdfDoc.setCreator('DocSign Cryptographic Engine');
    pdfDoc.setAuthor(signerEmail || 'DocSign User');

    // Save signed PDF with optimization
    const signedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
    });
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const signedDir = path.join(uploadDir, 'signed');
    if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });
    const signedPath = path.join(signedDir, `${doc._id}-signed.pdf`);
    fs.writeFileSync(signedPath, signedBytes);

    // Atomic DB update
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Update signer's status in array
        if (signerInArray) {
            await DocumentModel.updateOne(
                { _id: doc._id, 'signers.token': token },
                {
                    $set: {
                        'signers.$.status': 'signed',
                        'signers.$.signedAt': new Date(),
                        'signers.$.ipAddress': ipAddress
                    }
                },
                { session }
            );
        }

        // Update the fields in DB
        for (const pf of processedFields) {
            await Signature.updateOne(
                { _id: pf.id },
                { $set: { status: 'signed', imageData: pf.imageData, value: pf.value, signedAt: new Date(), ipAddress, signerEmail } },
                { session }
            );
        }

        // Check if all signers have signed
        const updatedDoc = await DocumentModel.findById(doc._id).session(session);
        const pendingSigners = updatedDoc?.signers?.filter(s => s.status === 'pending') || [];

        let newStatus: 'partially_signed' | 'signed' = 'partially_signed';
        if (pendingSigners.length === 0) {
            newStatus = 'signed';
        }

        await DocumentModel.updateOne(
            { _id: doc._id },
            { $set: { status: newStatus, signedFilePath: signedPath } },
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    // Send notification to document owner
    try {
        const owner = await User.findById(doc.ownerId).select('email').lean();
        if (owner?.email) {
            await emailService.sendSignedNotification(
                owner.email,
                doc.originalName,
                signerEmail || 'Unknown'
            );
        }
    } catch (emailErr) {
        console.error('Failed to send signed notification:', emailErr);
    }

    return { signedFilePath: signedPath };
}

export async function rejectDocument(
    token: string, reason: string, ipAddress: string
) {
    let doc = await DocumentModel.findOne({
        signerToken: token,
        tokenExpiry: { $gt: new Date() },
        status: { $in: ['pending', 'partially_signed'] },
        isDeleted: false,
    });

    if (!doc) {
        doc = await DocumentModel.findOne({
            'signers.token': token,
            'signers.tokenExpiry': { $gt: new Date() },
            'signers.status': 'pending',
            isDeleted: false,
        });
    }

    if (!doc) throw new AppError('Invalid or expired signing link', 404, 'TOKEN_INVALID');

    let signerEmail = doc.signerEmail;
    const signerInArray = doc.signers?.find(s => s.token === token);
    if (signerInArray) {
        signerEmail = signerInArray.email;
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Update signer in array
        if (signerInArray) {
            await DocumentModel.updateOne(
                { _id: doc._id, 'signers.token': token },
                {
                    $set: {
                        'signers.$.status': 'rejected',
                        'signers.$.rejectionReason': reason,
                        'signers.$.ipAddress': ipAddress,
                        'signers.$.signedAt': new Date()
                    }
                },
                { session }
            );
        }

        await DocumentModel.updateOne(
            { _id: doc._id },
            { $set: { status: 'rejected' } },
            { session }
        );
        await Signature.updateMany(
            { documentId: doc._id },
            { $set: { status: 'rejected', rejectionReason: reason, ipAddress, signedAt: new Date(), signerEmail } },
            { session }
        );
        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    // Send notification to document owner
    try {
        const owner = await User.findById(doc.ownerId).select('email').lean();
        if (owner?.email) {
            await emailService.sendRejectedNotification(
                owner.email,
                doc.originalName,
                signerEmail || 'Unknown',
                reason
            );
        }
    } catch (emailErr) {
        console.error('Failed to send rejection notification:', emailErr);
    }
}

export async function getFieldsByToken(token: string) {
    let doc = await DocumentModel.findOne({
        signerToken: token,
        tokenExpiry: { $gt: new Date() },
        isDeleted: false,
    });

    if (!doc) {
        doc = await DocumentModel.findOne({
            'signers.token': token,
            'signers.tokenExpiry': { $gt: new Date() },
            isDeleted: false,
        });
    }

    if (!doc) throw new AppError('Invalid or expired signing link', 404, 'TOKEN_INVALID');

    return Signature.find({ documentId: doc._id, status: 'pending' }).lean();
}

export async function addSigners(docId: string, ownerId: string, emails: string[]) {
    const doc = await DocumentModel.findOne({ _id: docId, ownerId, isDeleted: false });
    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');
    if (doc.status === 'signed' || doc.status === 'rejected')
        throw new AppError('Document already finalized', 409, 'DOC_FINALIZED');

    const results = [];
    const owner = await User.findById(ownerId).select('email').lean();

    if (!doc.signers) doc.signers = [];

    for (const email of emails) {
        const signerEmail = email.trim().toLowerCase();
        if (!signerEmail) continue;

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

        const newSigner = {
            email: signerEmail,
            token,
            tokenExpiry: expiry,
            status: 'pending' as const
        };

        // Check if already added
        const existingIdx = doc.signers.findIndex(s => s.email.toLowerCase() === signerEmail);
        if (existingIdx > -1) {
            if (doc.signers[existingIdx].status !== 'signed') {
                doc.signers[existingIdx].token = token;
                doc.signers[existingIdx].tokenExpiry = expiry;
            }
        } else {
            doc.signers.push(newSigner);
        }

        await emailService.sendSigningLink(signerEmail, token, doc.originalName, owner?.email);
        results.push({ email: signerEmail, token });
    }

    await doc.save();
    return { count: results.length, signers: results };
}

export async function getSigners(docId: string, ownerId: string) {
    const doc = await DocumentModel.findOne({ _id: docId, ownerId, isDeleted: false });
    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');

    return doc.signers || [];
}

export async function removeSigner(docId: string, ownerId: string, signerEmail: string) {
    const doc = await DocumentModel.findOne({ _id: docId, ownerId, isDeleted: false });
    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');
    if (doc.status === 'signed' || doc.status === 'rejected')
        throw new AppError('Document already finalized', 409, 'DOC_FINALIZED');

    if (!doc.signers) return;

    const signer = doc.signers.find(s => s.email.toLowerCase() === signerEmail.toLowerCase());
    if (signer?.status === 'signed') {
        throw new AppError('Cannot remove a signer who has already signed', 400, 'ALREADY_SIGNED');
    }

    doc.signers = doc.signers.filter(s => s.email.toLowerCase() !== signerEmail.toLowerCase());
    await doc.save();
}

export async function selfSign(
    docId: string,
    ownerId: string | undefined,
    fields: Array<{ fieldId: string; imageData?: string; value?: string }>
) {
    const doc = await DocumentModel.findOne({ _id: docId, ownerId, isDeleted: false });
    if (!doc) throw new AppError('Document not found', 404, 'DOC_NOT_FOUND');
    if (doc.status === 'signed' || doc.status === 'rejected')
        throw new AppError('Document already finalized', 409, 'DOC_FINALIZED');

    console.log('Self-signing PDF: loading bytes from', doc.filePath);
    const pdfBytes = fs.readFileSync(doc.filePath);
    console.log('PDF bytes loaded, length:', pdfBytes.length);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    console.log('PDF loaded, total pages:', pages.length);

    // Flatten AcroForms
    const form = pdfDoc.getForm();
    try {
        form.flatten();
    } catch (e) {
        console.warn('Could not flatten AcroForm', e);
    }

    for (const fieldData of fields) {
        console.log('Processing field:', fieldData.fieldId);
        const field = await Signature.findById(fieldData.fieldId);
        if (!field || field.documentId.toString() !== docId) {
            throw new AppError('Field not found', 404, 'FIELD_NOT_FOUND');
        }

        const page = pages[field.pageNumber - 1];
        if (!page) continue;

        const { width: pw, height: ph } = page.getSize();
        const { x, y, width, height } = toAbsolutePoints(
            {
                xPercent: field.xPercent,
                yPercent: field.yPercent,
                widthPercent: field.widthPercent,
                heightPercent: field.heightPercent,
            },
            pw, ph
        );

        if (field.type === 'signature' || field.type === 'initials') {
            if (fieldData.imageData) {
                const imgBytes = Buffer.from(fieldData.imageData.split(',')[1], 'base64');
                const mimeType = fieldData.imageData.split(',')[0].split(':')[1].split(';')[0];

                let image;
                if (mimeType === 'image/png') {
                    image = await pdfDoc.embedPng(imgBytes);
                } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                    image = await pdfDoc.embedJpg(imgBytes);
                }

                if (image) {
                    page.drawImage(image, { x, y, width, height });
                }
            }
        } else if (field.type === 'text' && fieldData.value) {
            page.drawText(fieldData.value, {
                x: x + 5,
                y: y + height / 2 - 6,
                size: Math.min(height * 0.6, 14),
                color: rgb(0, 0, 0),
            });
            field.value = fieldData.value;
        } else if (field.type === 'date' && fieldData.value) {
            page.drawText(fieldData.value, {
                x: x + 5,
                y: y + height / 2 - 6,
                size: Math.min(height * 0.6, 14),
                color: rgb(0, 0, 0),
            });
            field.value = fieldData.value;
        }

        field.status = 'signed';
        field.imageData = fieldData.imageData;
        field.value = fieldData.value;
        field.signedAt = new Date();
        await field.save();
    }

    // Enterprise metadata
    pdfDoc.setProducer('DocSign Enterprise');
    pdfDoc.setCreator('DocSign Cryptographic Engine');
    pdfDoc.setAuthor('Owner (Self-Signed)');

    const signedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false
    });
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const signedDir = path.join(uploadDir, 'signed');
    if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });
    const signedPath = path.join(signedDir, `${doc._id}-self-signed-${Date.now()}.pdf`);
    fs.writeFileSync(signedPath, signedBytes);

    await DocumentModel.updateOne(
        { _id: docId },
        { $set: { status: 'signed', signedFilePath: signedPath } }
    );

    return { signedFilePath: signedPath };
}

export async function updateFieldAssignment(
    fieldId: string,
    ownerId: string | undefined,
    assignedTo: string
) {
    const field = await Signature.findById(fieldId);
    if (!field) throw new AppError('Field not found', 404, 'FIELD_NOT_FOUND');

    const doc = await DocumentModel.findOne({ _id: field.documentId, ownerId, isDeleted: false });
    if (!doc) throw new AppError('Forbidden', 403, 'FORBIDDEN');

    field.assignedTo = assignedTo.toLowerCase();
    await field.save();

    return field;
}

export async function updatePlacement(
    sigId: string,
    userId: string | undefined,
    data: Partial<ISignature>
) {
    const sig = await Signature.findById(sigId);
    if (!sig) throw new AppError('Signature field not found', 404, 'SIG_NOT_FOUND');

    const doc = await DocumentModel.findOne({ _id: sig.documentId, ownerId: userId });
    if (!doc) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    if (doc.status === 'signed' || doc.status === 'rejected')
        throw new AppError('Document already finalized', 409, 'DOC_FINALIZED');

    // Filter allowed fields
    const allowed = ['xPercent', 'yPercent', 'widthPercent', 'heightPercent', 'type', 'assignedTo', 'pageNumber'];
    Object.keys(data).forEach(key => {
        if (allowed.includes(key)) {
            (sig as any)[key] = (data as any)[key];
        }
    });

    await sig.save();
    return sig;
}
