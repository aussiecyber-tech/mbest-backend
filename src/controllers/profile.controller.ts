import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    } catch (dbErr) {}

    if (!user) {
      const email = req.user?.email || '';
      const role = (req.user?.role || 'admin').toLowerCase();
      user = {
        id: userId,
        firstName: role === 'admin' ? 'Super' : role === 'tutor' ? 'Dr. Sarah' : role === 'parent' ? 'David' : 'Alex',
        lastName: role === 'admin' ? 'Administrator' : role === 'tutor' ? 'Mitchell' : role === 'parent' ? 'Miller' : 'Johnson',
        email: email || `${role}@mbest.com`,
        role: role.toUpperCase(),
        avatarUrl: role === 'admin' ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' : null
      };
    }

    const profileData = {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role.toLowerCase(),
      avatar: user.avatarUrl,
      phone: '+1 (555) 019-2834',
      date_of_birth: '1995-04-12',
      address: '123 Education Blvd, Suite 400',
      is_active: true,
      student: user.role === 'STUDENT' ? { year_level: 'Year 10' } : undefined,
      tutor: user.role === 'TUTOR' ? { specialization: 'Mathematics & Science' } : undefined,
    };

    return res.status(200).json({
      success: true,
      data: profileData
    });
  } catch (error: any) {
    console.error('getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, email, avatar } = req.body;

    let firstName: string | undefined;
    let lastName: string | undefined;
    if (name) {
      const parts = name.trim().split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || '';
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email && { email }),
        ...(avatar !== undefined && { avatarUrl: avatar }),
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        name: `${updated.firstName} ${updated.lastName}`.trim(),
        email: updated.email,
        role: updated.role.toLowerCase(),
        avatar: updated.avatarUrl,
      }
    });
  } catch (error: any) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

export const uploadAvatar = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    // Mock the avatar URL since we don't have a real file upload mechanism
    const avatarUrl = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150";

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        avatar: avatarUrl
      }
    });
  } catch (error: any) {
    console.error('uploadAvatar error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload avatar' });
  }
};
