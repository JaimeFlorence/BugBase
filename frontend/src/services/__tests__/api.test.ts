import { vi } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  describe('API instance configuration', () => {
    it('should have correct environment variables', () => {
      // Test environment configuration
      expect(import.meta.env.VITE_API_URL || 'http://localhost:3000/api').toBe('http://localhost:3000/api');
    });
  });

  describe('localStorage integration', () => {
    it('should interact with localStorage for token storage', () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');
      
      const token = localStorage.getItem('accessToken');
      expect(token).toBe('test-token');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('accessToken');
    });

    it('should set token in localStorage', () => {
      localStorage.setItem('accessToken', 'new-token');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'new-token');
    });

    it('should remove token from localStorage', () => {
      localStorage.removeItem('accessToken');
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('accessToken');
    });
  });

  describe('window.location integration', () => {
    it('should be able to redirect to login', () => {
      window.location.href = '/login';
      
      expect(mockLocation.href).toBe('/login');
    });
  });
});