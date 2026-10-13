import { Request, Response } from 'express';
import prisma from '../config/prisma';

const parseMultipart = (req: Request) => {
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match || !Buffer.isBuffer(req.body)) return null;
  const raw = req.body.toString('latin1');
  const fields: Record<string, string> = {};
  let file: { name: string; type: string; data: Buffer } | null = null;
  for (const part of raw.split(`--${match[1] || match[2]}`)) {
    const divider = part.indexOf('\r\n\r\n');
    if (divider < 0) continue;
    const headers = part.slice(0, divider);
    const name = headers.match(/name="([^"]+)"/i)?.[1];
    if (!name) continue;
    let body = part.slice(divider + 4); if (body.endsWith('\r\n')) body = body.slice(0, -2);
    const filename = headers.match(/filename="([^"]*)"/i)?.[1];
    if (filename !== undefined) file = { name: filename, type: headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || 'application/octet-stream', data: Buffer.from(body, 'latin1') };
    else fields[name] = body;
  }
  return { fields, file };
};

const formatResource = (resource: any) => ({
  id: resource.id,
  title: resource.title,
  description: `Course material for ${resource.category}`,
  category: resource.category,
  file_name: resource.fileUrl.split('/').pop() || 'resource',
  file_type: resource.fileUrl.split('.').pop() || 'file',
  url: resource.fileUrl,
  file_path: resource.fileUrl,
  is_public: resource.isPublic,
  uploader: resource.uploader
    ? `${resource.uploader.firstName} ${resource.uploader.lastName}`.trim()
    : 'Staff',
  created_at: resource.createdAt.toISOString()
});

export const listResources = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(req.query.per_page) || 15, 1), 100);
    const where = req.query.category
      ? { category: String(req.query.category) }
      : undefined;

    const [resources, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        include: {
          uploader: {
            select: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      prisma.resource.count({ where })
    ]);

    const formatted = resources.map(formatResource);

    return res.status(200).json({
      success: true,
      data: {
        data: formatted,
        total,
        current_page: page,
        per_page: perPage
      }
    });
  } catch (error: any) {
    console.error('listResources error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve resources' });
  }
};

export const getResource = async (req: Request, res: Response) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
      include: {
        uploader: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    return res.status(200).json({ success: true, data: { data: formatResource(resource) } });
  } catch (error: any) {
    console.error('getResource error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve resource' });
  }
};

export const updateResource = async (req: Request, res: Response) => {
  try {
    const { title, category, fileUrl, url, isPublic, is_public } = req.body || {};
    const resource = await prisma.resource.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: String(title) }),
        ...(category !== undefined && { category: String(category) }),
        ...((fileUrl !== undefined || url !== undefined) && { fileUrl: String(fileUrl || url) }),
        ...((isPublic !== undefined || is_public !== undefined) && {
          isPublic: String(isPublic ?? is_public) === 'true'
        })
      },
      include: {
        uploader: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    return res.status(200).json({ success: true, data: { data: formatResource(resource) } });
  } catch (error: any) {
    console.error('updateResource error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update resource' });
  }
};

export const createResource = async (req: Request, res: Response) => {
  try {
    const multipart = parseMultipart(req);
    const body = multipart?.fields || req.body || {};
    const { title, category, fileUrl, url, isPublic, is_public } = body;
    const uploaderId = req.user?.userId;

    if (!uploaderId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!title || (!multipart?.file?.data.length && !fileUrl && !url)) {
      return res.status(400).json({ success: false, message: 'Resource title and a file or URL are required' });
    }
    if (multipart?.file && multipart.file.data.length > 10 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Resource file must be 10 MB or smaller' });
    }

    let newResource = await prisma.resource.create({
      data: {
        uploaderId,
        title: String(title),
        category: category || 'General',
        fileUrl: fileUrl || url || 'pending-upload',
        isPublic: String(isPublic ?? is_public ?? 'true') === 'true',
      }
    });
    if (multipart?.file) {
      await prisma.appRecord.create({
        data: { kind: 'resource_file', ownerId: newResource.id, data: { name: multipart.file.name, type: multipart.file.type, content: multipart.file.data.toString('base64') } },
      });
      newResource = await prisma.resource.update({ where: { id: newResource.id }, data: { fileUrl: `/api/v1/resources/${newResource.id}/download` } });
    }

    return res.status(201).json({
      success: true,
      data: { data: newResource }
    });
  } catch (error: any) {
    console.error('createResource error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create resource' });
  }
};

export const downloadResource = async (req: Request, res: Response) => {
  const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
  if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
  const file = await prisma.appRecord.findFirst({ where: { kind: 'resource_file', ownerId: resource.id } });
  const data = file?.data && typeof file.data === 'object' ? file.data as any : null;
  if (!data?.content) {
    if (/^https?:\/\//i.test(resource.fileUrl)) return res.redirect(resource.fileUrl);
    return res.status(404).json({ success: false, message: 'Resource file is unavailable' });
  }
  res.setHeader('Content-Type', data.type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${String(data.name || 'resource').replace(/["\r\n]/g, '')}"`);
  return res.send(Buffer.from(data.content, 'base64'));
};

export const deleteResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.resource.delete({ where: { id } });
    await prisma.appRecord.deleteMany({ where: { kind: 'resource_file', ownerId: id } });
    return res.status(200).json({ success: true, message: 'Resource deleted successfully' });
  } catch (error: any) {
    console.error('deleteResource error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete resource' });
  }
};
