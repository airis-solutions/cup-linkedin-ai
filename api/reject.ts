import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handle } from './_app.js';

export default (req: VercelRequest, res: VercelResponse): Promise<void> => handle(req, res, '/reject');
