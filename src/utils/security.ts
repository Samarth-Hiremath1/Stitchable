import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Security utilities for file handling and validation
 */
export class SecurityUtils {
  /**
   * Validate and sanitize file paths to prevent directory traversal attacks
   */
  static validateFilePath(filePath: string, allowedDirectory: string): boolean {
    try {
      // Resolve the absolute path
      const resolvedPath = path.resolve(filePath);
      const resolvedAllowedDir = path.resolve(allowedDirectory);

      // Check if the resolved path is within the allowed directory
      return resolvedPath.startsWith(resolvedAllowedDir);
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitize filename to prevent malicious file names
   */
  static sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Replace dangerous characters
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\.+$/, '') // Remove trailing dots
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 255); // Limit length
  }

  /**
   * Generate secure random filename
   */
  static generateSecureFilename(originalName: string): string {
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const sanitizedBaseName = this.sanitizeFilename(baseName);
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    
    return `${sanitizedBaseName}_${timestamp}_${randomSuffix}${extension}`;
  }

  /**
   * Validate file exists and is within allowed directory
   */
  static validateFileAccess(filePath: string, allowedDirectory: string): boolean {
    try {
      // Check path traversal
      if (!this.validateFilePath(filePath, allowedDirectory)) {
        return false;
      }

      // Check if file exists
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get safe file stats
   */
  static getSafeFileStats(filePath: string, allowedDirectory: string): fs.Stats | null {
    try {
      if (!this.validateFileAccess(filePath, allowedDirectory)) {
        return null;
      }

      return fs.statSync(filePath);
    } catch (error) {
      return null;
    }
  }

  /**
   * Create secure directory if it doesn't exist
   */
  static ensureSecureDirectory(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { 
          recursive: true, 
          mode: 0o755 // Read/write/execute for owner, read/execute for group and others
        });
      }
      return true;
    } catch (error) {
      console.error('Error creating directory:', error);
      return false;
    }
  }

  /**
   * Validate video file signature (magic bytes)
   */
  static async validateVideoFileSignature(filePath: string): Promise<boolean> {
    try {
      const buffer = Buffer.alloc(12);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 12, 0);
      fs.closeSync(fd);

      // Check for common video file signatures
      const signatures = [
        // MP4
        [0x00, 0x00, 0x00, null, 0x66, 0x74, 0x79, 0x70], // ....ftyp
        // MOV
        [0x00, 0x00, 0x00, null, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74], // ....ftypqt
        // AVI
        [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x41, 0x56, 0x49, 0x20], // RIFF....AVI 
        // WebM
        [0x1A, 0x45, 0xDF, 0xA3], // WebM signature
        // WMV
        [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11] // WMV signature
      ];

      return signatures.some(signature => {
        return signature.every((byte, index) => {
          return byte === null || buffer[index] === byte;
        });
      });
    } catch (error) {
      console.error('Error validating file signature:', error);
      return false;
    }
  }

  /**
   * Generate content hash for file integrity
   */
  static generateFileHash(filePath: string): string | null {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Error generating file hash:', error);
      return null;
    }
  }

  /**
   * Validate request origin for CSRF protection
   */
  static validateRequestOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
    if (!origin) {
      return false;
    }

    return allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === '*') {
        return true;
      }
      return origin === allowedOrigin;
    });
  }

  /**
   * Rate limiting key generator
   */
  static generateRateLimitKey(ip: string, endpoint: string): string {
    return `rate_limit:${ip}:${endpoint}`;
  }

  /**
   * Sanitize user input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/[<>]/g, '') // Remove remaining angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate share link format
   */
  static isValidShareLink(shareLink: string): boolean {
    const shareLinkRegex = /^[a-zA-Z0-9]{16}$/;
    return shareLinkRegex.test(shareLink);
  }
}