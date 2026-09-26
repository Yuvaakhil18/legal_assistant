import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../controllers/documentController.js';
import { AppError } from '../middleware/errorHandler.js';

import os from 'os';

const router = Router();

// Configure multer for temp storage
const upload = multer({ 
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Middleware to handle multer errors natively
const handleUpload = (req: any, res: any, next: any) => {
  const uploadMiddleware = upload.single('file');
  uploadMiddleware(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'FILE_TOO_LARGE', 'File exceeds maximum allowed size of 10MB'));
      }
      return next(new AppError(400, 'VALIDATION_FAILED', `Upload error: ${err.message}`));
    } else if (err) {
      return next(err);
    }
    next();
  });
};

router.post('/', handleUpload, documentController.upload);

import { documentReadController } from '../controllers/documentReadController.js';

router.get('/:documentId', documentReadController.getDocument);
router.get('/:documentId/overview', documentReadController.getOverview);
router.get('/:documentId/clauses', documentReadController.getClauses);
router.get('/:documentId/clauses/:clauseId', documentReadController.getClauseDetail);
router.get('/:documentId/gotchas', documentReadController.getGotchas);
router.get('/:documentId/checklist', documentReadController.getChecklist);
router.get('/:documentId/brief', documentReadController.getBrief);

import { interactiveController } from '../controllers/interactiveController.js';

router.post('/:documentId/clauses/:clauseId/counter-draft', interactiveController.generateCounterDraft);
router.post('/:documentId/query', interactiveController.askQuestion);

export default router;
