// Setup file for Jest tests

// Create mock Prisma instance that will be shared across all tests
const mockPrismaInstance = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectMember: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  bug: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  comment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  attachment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  passwordReset: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
  bugWatcher: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  mention: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  notification: {
    createMany: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)),
};

// Mock Prisma client for all tests
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance)
}));

// Export the mock instance for use in tests
(global as any).mockPrisma = mockPrismaInstance;

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    flushall: jest.fn(),
    quit: jest.fn(),
  }));
});

// Mock Socket.IO
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
  }))
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn().mockReturnValue({ userId: '1', email: 'test@example.com' }),
}));

// Mock multer
jest.mock('multer', () => {
  const multer = () => ({
    single: () => (req: any, _res: any, next: any) => {
      req.file = {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        buffer: Buffer.from('test content'),
        size: 12
      };
      next();
    },
    array: () => (req: any, _res: any, next: any) => {
      req.files = [{
        fieldname: 'files',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        buffer: Buffer.from('test content'),
        size: 12
      }];
      next();
    }
  });
  multer.memoryStorage = jest.fn();
  return multer;
});

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// This is a setup file, not a test file
describe('setup', () => {
  it('should be a setup file', () => {
    expect(true).toBe(true);
  });
});