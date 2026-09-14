import { Request, Response } from 'express';

// In-memory store for mock packages during development
let mockPackages = [
  { id: 'pkg_1', name: 'Basic Plan', subject: 'Math', yearLevel: 'Year 10', tutor: 'All Tutors', price: 99.00, billing_cycle: 'monthly', status: 'active', features: ['1 Student', 'Basic Support'] },
  { id: 'pkg_2', name: 'Premium Plan', subject: 'Science', yearLevel: 'Year 11', tutor: 'All Tutors', price: 149.00, billing_cycle: 'monthly', status: 'active', features: ['Unlimited Students', '24/7 Support'] }
];

export const getPackages = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: mockPackages
    });
  } catch (error: any) {
    console.error('getPackages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve packages' });
  }
};

export const getPackage = async (req: Request, res: Response) => {
  try {
    const pkg = mockPackages.find(p => p.id === req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    return res.status(200).json({
      success: true,
      data: pkg
    });
  } catch (error: any) {
    console.error('getPackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve package' });
  }
};

export const createPackage = async (req: Request, res: Response) => {
  try {
    const newPackage = {
      id: `pkg_${Date.now()}`,
      ...req.body,
      status: 'active'
    };
    mockPackages.push(newPackage);
    
    return res.status(201).json({
      success: true,
      data: newPackage
    });
  } catch (error: any) {
    console.error('createPackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create package' });
  }
};

export const updatePackage = async (req: Request, res: Response) => {
  try {
    const index = mockPackages.findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    
    mockPackages[index] = { ...mockPackages[index], ...req.body };
    
    return res.status(200).json({
      success: true,
      data: mockPackages[index]
    });
  } catch (error: any) {
    console.error('updatePackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update package' });
  }
};

export const deletePackage = async (req: Request, res: Response) => {
  try {
    const index = mockPackages.findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    
    mockPackages.splice(index, 1);
    
    return res.status(200).json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error: any) {
    console.error('deletePackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete package' });
  }
};
