import { SecurityMiddleware } from '../middleware/security';
import { SecurityUtils } from '../utils/security';
import { getSecurityConfig } from '../config/security';
import * as jwt from 'jsonwebtoken';

describe('Security Implementation Tests', () => {
  const securityConfig = getSecurityConfig();

  describe('SecurityMiddleware', () => {
    test('should generate valid access token', () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000';
      const ownerId = 'test-owner';
      
      const token = SecurityMiddleware.generateAccessToken(projectId, ownerId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify token can be decoded
      const decoded = jwt.verify(token, securityConfig.jwt.secret) as any;
      expect(decoded.projectId).toBe(projectId);
      expect(decoded.ownerId).toBe(ownerId);
      expect(decoded.type).toBe('project_access');
    });

    test('should generate valid share link token', () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000';
      const shareLink = 'abcd1234efgh5678';
      
      const token = SecurityMiddleware.generateShareLinkToken(projectId, shareLink);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify token can be decoded
      const decoded = jwt.verify(token, securityConfig.jwt.secret) as any;
      expect(decoded.projectId).toBe(projectId);
      expect(decoded.shareLink).toBe(shareLink);
      expect(decoded.type).toBe('share_link_access');
    });

    test('should hash and verify passwords correctly', async () => {
      const password = 'testPassword123';
      
      const hashedPassword = await SecurityMiddleware.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      
      const isValid = await SecurityMiddleware.verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await SecurityMiddleware.verifyPassword('wrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });

  describe('SecurityUtils', () => {
    test('should validate file paths correctly', () => {
      const allowedDir = '/uploads';
      
      // Valid paths
      expect(SecurityUtils.validateFilePath('/uploads/video.mp4', allowedDir)).toBe(true);
      expect(SecurityUtils.validateFilePath('/uploads/subfolder/video.mp4', allowedDir)).toBe(true);
      
      // Invalid paths (directory traversal attempts)
      expect(SecurityUtils.validateFilePath('/uploads/../../../etc/passwd', allowedDir)).toBe(false);
      expect(SecurityUtils.validateFilePath('../uploads/video.mp4', allowedDir)).toBe(false);
    });

    test('should sanitize filenames correctly', () => {
      expect(SecurityUtils.sanitizeFilename('normal-file.mp4')).toBe('normal-file.mp4');
      expect(SecurityUtils.sanitizeFilename('file with spaces.mp4')).toBe('file_with_spaces.mp4');
      expect(SecurityUtils.sanitizeFilename('file<>:"/\\|?*.mp4')).toBe('file_________.mp4');
      expect(SecurityUtils.sanitizeFilename('.hidden-file.mp4')).toBe('hidden-file.mp4');
    });

    test('should generate secure filenames', () => {
      const originalName = 'test video.mp4';
      const secureFilename = SecurityUtils.generateSecureFilename(originalName);
      
      expect(secureFilename).toContain('test_video');
      expect(secureFilename).toContain('.mp4');
      expect(secureFilename).toMatch(/test_video_\d+_[a-f0-9]{16}\.mp4/);
    });

    test('should validate UUIDs correctly', () => {
      expect(SecurityUtils.isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(SecurityUtils.isValidUUID('invalid-uuid')).toBe(false);
      expect(SecurityUtils.isValidUUID('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // too short
    });

    test('should validate share links correctly', () => {
      expect(SecurityUtils.isValidShareLink('abcd1234efgh5678')).toBe(true);
      expect(SecurityUtils.isValidShareLink('abcd1234efgh567')).toBe(false); // too short
      expect(SecurityUtils.isValidShareLink('abcd1234efgh56789')).toBe(false); // too long
      expect(SecurityUtils.isValidShareLink('abcd1234efgh567!')).toBe(false); // invalid character
    });

    test('should sanitize input correctly', () => {
      expect(SecurityUtils.sanitizeInput('normal text')).toBe('normal text');
      expect(SecurityUtils.sanitizeInput('<script>alert("xss")</script>')).toBe('');
      expect(SecurityUtils.sanitizeInput('javascript:alert("xss")')).toBe('alert("xss")');
      expect(SecurityUtils.sanitizeInput('onclick=alert("xss")')).toBe('alert("xss")');
      expect(SecurityUtils.sanitizeInput('Safe content with <b>tags</b>')).toBe('Safe content with btags/b');
    });

    test('should validate request origins correctly', () => {
      const allowedOrigins = ['http://localhost:3000', 'https://example.com'];
      
      expect(SecurityUtils.validateRequestOrigin('http://localhost:3000', allowedOrigins)).toBe(true);
      expect(SecurityUtils.validateRequestOrigin('https://example.com', allowedOrigins)).toBe(true);
      expect(SecurityUtils.validateRequestOrigin('https://malicious.com', allowedOrigins)).toBe(false);
      expect(SecurityUtils.validateRequestOrigin(undefined, allowedOrigins)).toBe(false);
      
      // Test wildcard
      expect(SecurityUtils.validateRequestOrigin('https://any-domain.com', ['*'])).toBe(true);
    });
  });

  describe('Security Configuration', () => {
    test('should have proper security settings', () => {
      expect(securityConfig.jwt.secret).toBeDefined();
      expect(securityConfig.jwt.accessTokenExpiry).toBe('7d');
      expect(securityConfig.jwt.shareTokenExpiry).toBe('30d');
      
      expect(securityConfig.upload.maxFileSize).toBe(500 * 1024 * 1024);
      expect(securityConfig.upload.allowedMimeTypes).toContain('video/mp4');
      expect(securityConfig.upload.allowedExtensions).toContain('.mp4');
      
      expect(securityConfig.rateLimit.api.max).toBe(100);
      expect(securityConfig.rateLimit.upload.max).toBe(10);
      
      expect(securityConfig.validation.maxTitleLength).toBe(200);
      expect(securityConfig.validation.maxDescriptionLength).toBe(1000);
    });
  });
});