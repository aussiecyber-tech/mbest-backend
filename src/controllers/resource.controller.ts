import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const listResources = async (req: Request, res: Response) => {
  try {
    const resources = await prisma.resource.findMany({
      include: {
        uploader: {
          select: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = resources.map(r => ({
      id: r.id,
      title: r.title,
      description: `Course material for ${r.category}`,
      category: r.category,
      file_name: r.fileUrl.split('/').pop() || 'resource.pdf',
      file_size: '2.4 MB',
      file_type: 'pdf',
      url: r.fileUrl,
      file_path: r.fileUrl,
      is_public: r.isPublic,
      uploader: r.uploader ? `${r.uploader.firstName} ${r.uploader.lastName}`.trim() : 'Staff',
      created_at: r.createdAt.toISOString()
    }));

    return res.status(200).json({
      success: true,
      data: {
        data: formatted,
        total: formatted.length
      }
    });
  } catch (error: any) {
    console.error('listResources error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve resources' });
  }
};

export const createResource = async (req: Request, res: Response) => {
  try {
    const { title, category, fileUrl, isPublic } = req.body;
    const uploaderId = req.user?.userId;

    if (!uploaderId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const newResource = await prisma.resource.create({
      data: {
        uploaderId,
        title: title || 'New Learning Material',
        category: category || 'General',
        fileUrl: fileUrl || 'https://example.com/files/document.pdf',
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
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
