import { IUser } from '../models/User.model';
import { IDocument } from '../models/Document.model';

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
            document?: IDocument;
        }
    }
}

export { };