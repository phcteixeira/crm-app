import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function saveFile(base64OrBuffer: string | Buffer, fileName?: string): Promise<string> {
  // Ensure upload directory exists
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }

  let buffer: Buffer;
  let extension = '';

  if (typeof base64OrBuffer === 'string') {
    const matches = base64OrBuffer.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
      extension = `.${mimeType.split('/')[1].split('+')[0]}`;
      // Fix for some common mimetypes
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') extension = '.docx';
      if (mimeType === 'application/pdf') extension = '.pdf';
    } else {
      buffer = Buffer.from(base64OrBuffer, 'base64');
    }
  } else {
    buffer = base64OrBuffer;
  }

  const finalFileName = fileName || `${uuidv4()}${extension || '.bin'}`;
  const filePath = path.join(UPLOAD_DIR, finalFileName);

  await fs.writeFile(filePath, buffer);

  // Return the public URL
  return `/uploads/${finalFileName}`;
}

export async function deleteFile(relativeUrl: string): Promise<void> {
  if (!relativeUrl.startsWith('/uploads/')) return;
  const filePath = path.join(process.cwd(), 'public', relativeUrl);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.error('Failed to delete file:', err);
  }
}
