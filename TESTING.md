# Testing Documentation

This document outlines the testing strategy, setup, and execution for the BugBase project.

## Overview

The BugBase project includes comprehensive testing at multiple levels:

- **Unit Tests**: Test individual functions, components, and modules
- **Integration Tests**: Test API endpoints and service interactions
- **End-to-End Tests**: Test complete user workflows

## Project Structure

```
BugBase/
├── backend/
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── setup.ts           # Test setup and mocks
│   │   │   └── e2e/               # End-to-end tests
│   │   ├── services/__tests__/    # Service unit tests
│   │   └── controllers/__tests__/ # Controller tests
│   ├── jest.config.js            # Jest configuration
│   └── package.json
└── frontend/
    ├── src/
    │   ├── __tests__/
    │   │   └── setup.ts           # Test setup and mocks
    │   ├── components/__tests__/  # Component tests
    │   ├── services/__tests__/    # Service tests
    │   └── lib/__tests__/         # Utility tests
    ├── vitest.config.ts          # Vitest configuration
    └── package.json
```

## Backend Testing (Jest)

### Setup

The backend uses Jest with TypeScript support:

```bash
cd backend
npm install
npm test
```

### Test Configuration

- **Framework**: Jest with ts-jest
- **Test Environment**: Node.js
- **Coverage**: Enabled with lcov and html reporters
- **Setup**: Global mocks in `src/__tests__/setup.ts`

### Available Scripts

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPatterns=auth.service.test.ts
```

### Test Categories

#### Unit Tests

Located in `src/services/__tests__/` and `src/controllers/__tests__/`:

- **Auth Service Tests**: Registration, login, logout, token refresh, password reset
- **Bug Service Tests**: CRUD operations, filtering, pagination, permissions
- **Comment Service Tests**: Creating, updating, deleting comments, mentions
- **Attachment Service Tests**: File upload, download, deletion, permissions
- **Controller Tests**: HTTP request/response handling, validation, error handling

#### Integration Tests

Located in `src/controllers/__tests__/*.integration.test.ts`:

- **API Endpoint Tests**: Full request/response cycle testing
- **Middleware Integration**: Authentication, error handling, validation
- **Service Integration**: Multiple service interactions

#### End-to-End Tests

Located in `src/__tests__/e2e/`:

- **Authentication Flow**: Complete user registration and login flow
- **Bug Management Flow**: Creating, updating, resolving bugs
- **Comment System Flow**: Adding comments, mentions, replies

### Mocking Strategy

The backend uses comprehensive mocking:

- **Prisma Client**: Mocked for database operations
- **External Services**: Redis, Socket.IO, bcrypt, JWT
- **File System**: Multer file upload simulation
- **Email Service**: Nodemailer mocking

## Frontend Testing (Vitest)

### Setup

The frontend uses Vitest with React Testing Library:

```bash
cd frontend
npm install
npm test
```

### Test Configuration

- **Framework**: Vitest with React Testing Library
- **Test Environment**: jsdom
- **Coverage**: V8 coverage provider
- **Setup**: Global mocks in `src/__tests__/setup.ts`

### Available Scripts

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run tests in watch mode (default)
npm test

# Run specific test file
npm test -- src/components/__tests__/StatusBadge.test.tsx
```

### Test Categories

#### Unit Tests

- **Utility Functions**: `src/lib/__tests__/utils.test.ts`
- **UI Components**: `src/components/__tests__/`
- **Services**: `src/services/__tests__/`
- **Hooks**: Custom React hooks testing

#### Component Tests

- **StatusBadge**: Different status rendering and styling
- **PriorityBadge**: Priority levels with optional icons
- **SeverityBadge**: Severity indicators
- **BugCard**: Bug information display
- **Comment**: Comment rendering and interactions

#### Service Tests

- **API Service**: HTTP client configuration, interceptors
- **Auth Service**: Authentication method calls
- **Bug Service**: Bug management operations
- **Comment Service**: Comment operations

### Mocking Strategy

The frontend uses targeted mocking:

- **Axios**: HTTP client mocking
- **React Router**: Navigation and routing mocks
- **Socket.IO Client**: Real-time communication mocks
- **Browser APIs**: localStorage, window.location, etc.

## Test Data Management

### Fixtures

Test data is managed through:

- **Mock Data**: Consistent test data across tests
- **Factory Functions**: Dynamic test data generation
- **Database Seeding**: For integration tests (when needed)

### Example Test Data

```typescript
// Mock user data
const mockUser = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
  fullName: 'Test User',
  role: 'REPORTER'
};

// Mock bug data
const mockBug = {
  id: '1',
  title: 'Test Bug',
  description: 'Test Description',
  status: 'NEW',
  priority: 'HIGH',
  severity: 'MAJOR'
};
```

## Coverage Reports

### Backend Coverage

Target coverage thresholds:
- **Statements**: 80%
- **Branches**: 70%
- **Functions**: 80%
- **Lines**: 80%

### Frontend Coverage

Target coverage thresholds:
- **Statements**: 75%
- **Branches**: 65%
- **Functions**: 75%
- **Lines**: 75%

### Viewing Coverage

Coverage reports are generated in:
- **Backend**: `backend/coverage/`
- **Frontend**: `frontend/coverage/`

Open `coverage/index.html` in your browser to view detailed coverage reports.

## Running Tests

### Full Test Suite

```bash
# Run all backend tests
cd backend && npm test

# Run all frontend tests
cd frontend && npm test

# Run both with coverage
cd backend && npm run test:coverage
cd frontend && npm run test:coverage
```

### Continuous Integration

Tests are configured to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Backend Tests
  run: |
    cd backend
    npm install
    npm test

- name: Run Frontend Tests
  run: |
    cd frontend
    npm install
    npm test -- --run
```

## Test Writing Guidelines

### Best Practices

1. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
2. **Naming**: Use descriptive test names
3. **Isolation**: Each test should be independent
4. **Mocking**: Mock external dependencies
5. **Coverage**: Aim for high coverage but focus on important paths

### Example Test Structure

```typescript
describe('Component/Service Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe('method/feature name', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

## Debugging Tests

### Common Issues

1. **Async Tests**: Use proper async/await patterns
2. **Mock Persistence**: Clear mocks between tests
3. **DOM Cleanup**: Ensure proper cleanup in component tests
4. **Environment Variables**: Set up test environment variables

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with debug info
npm test -- --testNamePattern="specific test name"

# Run tests with coverage and open report
npm run test:coverage && open coverage/index.html
```

## Performance Testing

### Load Testing

For API endpoints, consider using:
- **Artillery**: For HTTP load testing
- **Jest Performance**: For unit test performance
- **Lighthouse CI**: For frontend performance testing

### Memory Testing

- Monitor memory usage in long-running tests
- Use `--detectOpenHandles` flag to find memory leaks
- Profile test execution with `--logHeapUsage`

## Security Testing

### Input Validation

Tests include validation for:
- **SQL Injection**: Parameterized queries
- **XSS Prevention**: Input sanitization
- **CSRF Protection**: Token validation
- **Authentication**: JWT token handling

### Dependency Security

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix
```

## Maintenance

### Updating Tests

When adding new features:
1. Write tests first (TDD approach)
2. Update existing tests if APIs change
3. Maintain test coverage thresholds
4. Update documentation

### Regular Tasks

- **Monthly**: Review and update test dependencies
- **Per Release**: Run full test suite with coverage
- **Continuous**: Monitor test execution times
- **Quarterly**: Review and refactor test code

## Troubleshooting

### Common Problems

1. **Tests timeout**: Increase timeout in jest/vitest config
2. **Mock not working**: Check mock placement and syntax
3. **Coverage not accurate**: Verify file patterns in config
4. **Tests flaky**: Add proper async handling and cleanup

### Getting Help

- Check test output for specific error messages
- Use `--verbose` flag for detailed test information
- Review mock configurations in setup files
- Consult framework documentation (Jest/Vitest)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supertest Documentation](https://github.com/ladjs/supertest)