import { Request, Response } from 'express';
import prisma from '../config/prisma';

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
    const { title, category, fileUrl, url, isPublic, is_public } = req.body || {};
    const uploaderId = req.user?.userId;

    if (!uploaderId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const newResource = await prisma.resource.create({
      data: {
        uploaderId,
        title: title || 'New Learning Material',
        category: category || 'General',
        fileUrl: fileUrl || url || 'https://example.com/files/document.pdf',
        isPublic: String(isPublic ?? is_public ?? 'true') === 'true',
      }
    });

    return res.status(201).json({
      success: true,
      data: { data: newResource }
    });
  } catch (error: any) {
    console.error('createResource error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create resource' });
  }
};

export const deleteResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.resource.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Resource deleted successfully' });
  } catch (error: any) {
    console.error('deleteResource error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete resource' });
  }
};
