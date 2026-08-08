import { InstructorsService } from './instructors.service';

describe('InstructorsService remove', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    instructorProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new InstructorsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.instructorProfile.findUnique.mockResolvedValue({
      id: 'instructor-1',
      isActive: true,
      user: { id: 'user-1', name: 'Teacher', email: 'teacher@example.com' },
      classes: [{ id: 'class-1' }],
    });
    prisma.instructorProfile.update.mockResolvedValue({ id: 'instructor-1', isActive: false });
  });

  it('archives an instructor instead of deleting referenced class history', async () => {
    await expect(service.remove('instructor-1')).resolves.toEqual({ message: 'Instructor archived successfully' });
    expect(prisma.instructorProfile.update).toHaveBeenCalledWith({
      where: { id: 'instructor-1' },
      data: { isActive: false },
    });
  });

  it('stores a verified image and clears the old remote URL', async () => {
    const photo = {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      mimetype: 'image/jpeg',
    };

    await expect(service.setPhoto('instructor-1', photo)).resolves.toEqual({
      message: 'Instructor photo uploaded successfully',
      photoPath: '/instructors/instructor-1/photo',
    });
    expect(prisma.instructorProfile.update).toHaveBeenCalledWith({
      where: { id: 'instructor-1' },
      data: { photoData: Uint8Array.from(photo.buffer), photoMime: 'image/jpeg', photoUrl: null },
    });
  });

  it('rejects image content that does not match its declared type', async () => {
    const photo = { buffer: Buffer.from('not an image'), mimetype: 'image/jpeg' };
    await expect(service.setPhoto('instructor-1', photo)).rejects.toThrow('Photo content does not match its file type');
  });

  it('preserves an admin role when attaching an instructor profile', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.instructorProfile.findUnique.mockResolvedValue(null);
    prisma.instructorProfile.create.mockResolvedValue({ id: 'instructor-2' });

    await service.create({ userId: 'admin-1', specialization: 'Founder' });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.instructorProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'admin-1', specialization: 'Founder' }),
    }));
  });
});
