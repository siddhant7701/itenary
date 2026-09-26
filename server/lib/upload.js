import path from 'node:path';
import multer from 'multer';
import { UPLOAD_DIR } from '../config.js';
import { newId } from '../db.js';
import { badRequest } from './http.js';

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic' };

export const uploadImage = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now().toString(36)}-${newId(8)}${ALLOWED[file.mimetype] || path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(badRequest('Only JPG, PNG, WEBP, GIF or HEIC images are allowed'))),
});

export const publicUrl = (file) => `/uploads/${file.filename}`;
