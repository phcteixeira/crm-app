import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  
  if (!filename) {
    return new NextResponse('Filename is required', { status: 400 });
  }

  // Security: Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'public', 'uploads', filename);

  try {
    // Check if file exists
    await fs.access(filePath);
    
    // Read the file
    const fileBuffer = await fs.readFile(filePath);
    
    // Determine the content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.webm') contentType = 'video/webm';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(`Error serving media file ${filename}:`, error);
    return new NextResponse('File not found', { status: 404 });
  }
}
