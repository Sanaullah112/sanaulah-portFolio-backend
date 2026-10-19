import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadsDir = path.join(backendDir, 'uploads');

/**
 * Builds a publicly accessible URL for an uploaded file.
 */
export const buildFileUrl = (_req, relativePath) => {
  const filePath = path.isAbsolute(relativePath)
    ? path.relative(uploadsDir, path.resolve(relativePath))
    : relativePath.replace(/\\/g, '/').replace(/^uploads[\\/]/i, '');
  const normalizedFilePath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');

  if (
    !normalizedFilePath ||
    normalizedFilePath === '..' ||
    normalizedFilePath.startsWith('../') ||
    path.isAbsolute(normalizedFilePath)
  ) {
    throw new Error('Uploaded file path is outside the uploads directory');
  }

  return `/uploads/${normalizedFilePath}`;
};

/**
 * Deletes a file from disk if it exists. Fails silently (logs only).
 */
export const deleteFileIfExists = (filePath) => {
  if (!filePath) return;
  const portablePath = filePath.replace(/[\\/]+/g, path.sep);
  const fullPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(backendDir, portablePath);
  const relativePath = path.relative(uploadsDir, fullPath);

  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    console.error('Refusing to delete a file outside the uploads directory');
    return;
  }

  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) return;
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete file:', unlinkErr.message);
    });
  });
};
