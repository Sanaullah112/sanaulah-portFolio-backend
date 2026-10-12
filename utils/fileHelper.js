import fs from 'fs';
import path from 'path';

/**
 * Builds a publicly accessible URL for an uploaded file.
 */
export const buildFileUrl = (req, relativePath) => {
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/${relativePath.replace(/\\/g, '/')}`;
};

/**
 * Deletes a file from disk if it exists. Fails silently (logs only).
 */
export const deleteFileIfExists = (filePath) => {
  if (!filePath) return;
  const fullPath = path.resolve(filePath);
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) return;
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete file:', unlinkErr.message);
    });
  });
};
