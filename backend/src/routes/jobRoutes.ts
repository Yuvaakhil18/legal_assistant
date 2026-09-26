import { Router } from 'express';
import { jobController } from '../controllers/jobController.js';

const router = Router();

router.get('/:jobId', jobController.getStatus);

export default router;
