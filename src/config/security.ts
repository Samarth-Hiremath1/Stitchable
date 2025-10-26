/**
 * Security configuration settings
 */
export const SecurityConfig = {
  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    accessTokenExpiry: '7d' as const,
    shareTokenExpiry: '30d' as const,
    algorithm: 'HS256' as const
  },

  // Rate limiting settings
  rateLimit: {
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      skipSuccessfulRequests: false
    },
    upload: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // uploads per window
      skipSuccessfulRequests: false
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // auth attempts per window
      skipSuccessfulRequests: true
    }
  },

  // File upload settings
  upload: {
    maxFileSize: 500 * 1024 * 1024, // 500MB
    maxFiles: 1,
    maxFieldSize: 1024 * 1024, // 1MB
    maxFieldNameSize: 100,
    maxFields: 10,
    allowedMimeTypes: [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-ms-wmv'
    ],
    allowedExtensions: ['.mp4', '.mov', '.avi', '.webm', '.wmv']
  },

  // CORS settings
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },

  // Password hashing settings
  bcrypt: {
    saltRounds: 12
  },

  // File validation settings
  fileValidation: {
    validateSignature: true,
    generateHash: true,
    maxFilenameLength: 255,
    allowedPathChars: /^[a-zA-Z0-9._/-]+$/
  },

  // Request validation settings
  validation: {
    maxTitleLength: 200,
    maxDescriptionLength: 1000,
    maxUploaderNameLength: 100,
    maxOwnerIdLength: 100,
    shareLinkLength: 16,
    allowedNameChars: /^[a-zA-Z0-9\s_-]+$/,
    allowedOwnerIdChars: /^[a-zA-Z0-9_-]+$/
  },

  // Security headers
  headers: {
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
    xXSSProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
    cacheControl: 'private, max-age=3600'
  },

  // Allowed origins for file serving
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5001',
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ].filter(Boolean),

  // Logging settings
  logging: {
    logSecurityEvents: true,
    logFailedAttempts: true,
    logRateLimitExceeded: true
  }
} as const;

/**
 * Environment-specific security settings
 */
export const getSecurityConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    return {
      ...SecurityConfig,
      jwt: {
        ...SecurityConfig.jwt,
        secret: process.env.JWT_SECRET || (() => {
          throw new Error('JWT_SECRET must be set in production');
        })()
      },
      cors: {
        ...SecurityConfig.cors,
        origin: process.env.CORS_ORIGIN || false // Disable CORS in production unless explicitly set
      }
    };
  }

  return SecurityConfig;
};