import prisma from '../config/prisma';

const defaults = [
  {
    name: 'Basic Plan',
    price: 99,
    description: 'Essential tutoring access for one student.',
    student_limit: 1,
    class_ids: [],
    classes: [],
    allows_one_on_one: false,
    bank_details: '',
    is_active: true,
    subject: 'All Subjects',
    billing_type: 'recurring',
    billing_cycle: 'monthly',
    package_type: 'group',
    features: ['1 Student', 'Group Classes', 'Basic Support'],
  },
  {
    name: 'Premium Plan',
    price: 149,
    description: 'Expanded tutoring access with one-on-one lessons.',
    student_limit: 5,
    class_ids: [],
    classes: [],
    allows_one_on_one: true,
    bank_details: '',
    is_active: true,
    subject: 'All Subjects',
    billing_type: 'recurring',
    billing_cycle: 'monthly',
    package_type: 'premium',
    features: ['Up to 5 Students', 'All Classes', 'One-on-one Lessons'],
  },
];

export const formatRecord = (record: any) => {
  const raw = record.data && typeof record.data === 'object' ? record.data as any : {};
  const { payment_slip_data: _data, payment_slip_token: _token, ...safe } = raw;
  return {
    ...safe,
    id: record.id,
    created_at: record.createdAt?.toISOString?.(),
    updated_at: record.updatedAt?.toISOString?.(),
  };
};

export const ensureDefaultPackages = async () => {
  const count = await prisma.appRecord.count({ where: { kind: 'package' } });
  if (count > 0) return;
  await prisma.appRecord.createMany({
    data: defaults.map(data => ({ kind: 'package', data })),
  });
};

export const listPackages = async (activeOnly = false) => {
  await ensureDefaultPackages();
  const rows = await prisma.appRecord.findMany({
    where: { kind: 'package' },
    orderBy: { createdAt: 'asc' },
  });
  const packages = rows.map(formatRecord);
  return activeOnly ? packages.filter(pkg => pkg.is_active !== false) : packages;
};

export const findPackage = async (id: string) => {
  await ensureDefaultPackages();
  const row = await prisma.appRecord.findFirst({ where: { id, kind: 'package' } });
  return row ? formatRecord(row) : null;
};
