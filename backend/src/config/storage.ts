import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import { AppError } from '../middleware/errorHandler';

// Define allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  
  // Archives
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  
  // Code
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.css': 'text/css',
  '.py': 'text/x-python',
  '.java': 'text/x-java',
  '.cpp': 'text/x-c++',
  '.c': 'text/x-c',
  '.h': 'text/x-c',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.php': 'text/x-php',
  '.rb': 'text/x-ruby',
  '.swift': 'text/x-swift',
  '.kt': 'text/x-kotlin',
  
  // Videos (limited)
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  
  // Audio (limited)
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (_req: Request, _file: Express.Multer.File, cb) => {
    try {
      // Create subdirectories based on year/month
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const uploadPath = path.join(UPLOAD_DIR, year.toString(), month);
      
      // Ensure directory exists
      const fs = await import('fs/promises');
      await fs.mkdir(uploadPath, { recursive: true });
      
      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// File filter
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;
  
  // Check if file extension is allowed
  if (!ALLOWED_FILE_TYPES[ext as keyof typeof ALLOWED_FILE_TYPES]) {
    cb(new AppError(`File type ${ext} is not allowed`, 400));
    return;
  }
  
  // Verify MIME type matches extension
  const expectedMimeType = ALLOWED_FILE_TYPES[ext as keyof typeof ALLOWED_FILE_TYPES];
  if (mimeType !== expectedMimeType && !mimeType.startsWith(expectedMimeType.split('/')[0])) {
    cb(new AppError('File type does not match its extension', 400));
    return;
  }
  
  cb(null, true);
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10 // Maximum 10 files per request
  }
});

// Helper to get file URL
export const getFileUrl = (filePath: string): string => {
  // In production, this would return a CDN URL or S3 URL
  // For now, return a local file URL
  const relativePath = path.relative(UPLOAD_DIR, filePath);
  return `/uploads/${relativePath.replace(/\\/g, '/')}`;
};

// Helper to delete file
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    const fs = await import('fs/promises');
    await fs.unlink(filePath);
  } catch (error) {
    // Log error but don't throw - file might already be deleted
    console.error('Error deleting file:', error);
  }
};

// Export configuration
export const storageConfig = {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  UPLOAD_DIR
};