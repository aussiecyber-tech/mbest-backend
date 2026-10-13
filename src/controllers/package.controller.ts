import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { findPackage, formatRecord, listPackages } from '../services/subscription.service';

const normalizePackage = (body: any) => ({
  ...body,
  name: String(body?.name || '').trim(),
  price: Number(body?.price || 0),
  student_limit: Number(body?.student_limit || 0),
  class_ids: Array.isArray(body?.class_ids) ? body.class_ids.map(String) : [],
  is_active: body?.is_active !== false,
  status: body?.is_active === false ? 'inactive' : 'active',
});

export const getPackages = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: await listPackages()
    });
  } catch (error: any) {
    console.error('getPackages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve packages' });
  }
};

export const getPackage = async (req: Request, res: Response) => {
  try {
    const pkg = await findPackage(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    return res.status(200).json({
      success: true,
      data: { data: pkg }
    });
  } catch (error: any) {
    console.error('getPackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve package' });
  }
};

export const createPackage = async (req: Request, res: Response) => {
  try {
    const data = normalizePackage(req.body);
    if (!data.name || data.price < 0) {
      return res.status(400).json({ success: false, message: 'Package name and a valid price are required' });
    }
    const record = await prisma.appRecord.create({ data: { kind: 'package', data } });
    const newPackage = formatRecord(record);
    
    return res.status(201).json({
      success: true,
      data: { data: newPackage }
    });
  } catch (error: any) {
    console.error('createPackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create package' });
  }
};

export const updatePackage = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.appRecord.findFirst({ where: { id: req.params.id, kind: 'package' } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    const previous = existing.data && typeof existing.data === 'object' ? existing.data as any : {};
    const record = await prisma.appRecord.update({
      where: { id: existing.id },
      data: { data: normalizePackage({ ...previous, ...req.body }) },
    });
    
    return res.status(200).json({
      success: true,
      data: { data: formatRecord(record) }
    });
  } catch (error: any) {
    console.error('updatePackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update package' });
  }
};

export const deletePackage = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.appRecord.findFirst({ where: { id: req.params.id, kind: 'package' } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    await prisma.appRecord.delete({ where: { id: existing.id } });
    
    return res.status(200).json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error: any) {
    console.error('deletePackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete package' });
  }
};
