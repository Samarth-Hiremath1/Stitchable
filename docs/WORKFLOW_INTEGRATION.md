# Complete End-to-End Workflow Integration

This document describes the complete end-to-end workflow integration implemented for the Stitchable Video Platform.

## Overview

The workflow integration provides a comprehensive system that orchestrates the entire video processing pipeline from project creation to final video download, with robust error handling, system monitoring, and cleanup utilities.

## Architecture

### Core Services

#### 1. WorkflowOrchestrator
- **Purpose**: Orchestrates the complete end-to-end workflow
- **Location**: `src/services/WorkflowOrchestrator.ts`
- **Key Features**:
  - Executes complete workflow from upload to final video
  - Manages workflow stages: upload → processing → sync → quality → stitching → complete
  - Provides real-time progress updates via WebSocket
  - Handles workflow retry and cancellation
  - Integrates with all processing services

#### 2. CleanupService
- **Purpose**: Manages temporary files and old project cleanup
- **Location**: `src/services/CleanupService.ts`
- **Key Features**:
  - Automatic cleanup of temporary files
  - Removal of old projects and associated files
  - Orphaned file detection and cleanup
  - Disk usage statistics
  - Scheduled cleanup with configurable intervals

#### 3. HealthMonitorService
- **Purpose**: System health monitoring and analytics
- **Location**: `src/services/HealthMonitorService.ts`
- **Key Features**:
  - Real-time system health monitoring
  - Memory, disk, and database health checks
  - Service availability monitoring (FFmpeg, uploads)
  - System analytics and performance metrics
  - System readiness checks

#### 4. ErrorHandlingService
- **Purpose**: Comprehensive error handling across the workflow
- **Location**: `src/services/ErrorHandlingService.ts`
- **Key Features**:
  - Centralized error logging and reporting
  - Error categorization (info, warning, error, critical)
  - Real-time error notifications via WebSocket
  - Error resolution tracking
  - Express middleware integration

### API Endpoints

#### Workflow Management
- `POST /api/projects/:projectId/workflow/execute` - Execute complete workflow
- `GET /api/projects/:projectId/workflow/status` - Get workflow status
- `POST /api/projects/:projectId/workflow/retry` - Retry failed workflow
- `DELETE /api/projects/:projectId/workflow/cancel` - Cancel ongoing workflow

#### System Monitoring
- `GET /api/system/health` - Get system health status
- `GET /api/system/analytics` - Get system analytics
- `GET /api/system/disk-usage` - Get disk usage statistics

#### System Maintenance
- `POST /api/system/cleanup` - Perform system cleanup

#### Error Management
- `GET /api/system/errors` - Get error reports
- `GET /api/system/errors/stats` - Get error statistics
- `PATCH /api/system/errors/:errorId/resolve` - Resolve error report

### Frontend Integration

#### WorkflowDashboard Component
- **Location**: `frontend/src/components/WorkflowDashboard.tsx`
- **Features**:
  - Real-time workflow progress visualization
  - System health status display
  - Workflow execution controls
  - Error handling and retry functionality
  - System readiness checks

#### Integration with ProjectDashboard
- New "Workflow" tab in project dashboard
- Seamless integration with existing project management
- Automatic navigation to preview after completion

## Workflow Stages

### 1. Upload Stage
- Validates project exists and has videos
- Checks system readiness
- Initializes workflow tracking

### 2. Processing Stage
- Processes all uploaded videos in parallel
- Standardizes video formats and quality
- Generates thumbnails and metadata

### 3. Synchronization Stage
- Synchronizes multiple videos using audio/visual cues
- Calculates sync offsets and confidence scores
- Skipped for single-video projects

### 4. Quality Assessment Stage
- Analyzes video quality metrics
- Assigns quality scores to each video
- Determines optimal video ordering

### 5. Stitching Stage
- Combines all videos into final output
- Applies sync offsets and quality optimizations
- Generates final downloadable video

### 6. Completion Stage
- Updates project status
- Notifies users of completion
- Triggers cleanup of temporary files

## Error Handling

### Error Categories
- **Info**: Informational messages
- **Warning**: Non-critical issues that don't stop workflow
- **Error**: Issues that cause workflow failure
- **Critical**: System-level issues requiring immediate attention

### Error Recovery
- Automatic retry for transient failures
- Manual retry options for failed workflows
- Graceful degradation for non-critical failures
- Comprehensive error logging and reporting

## System Monitoring

### Health Checks
- **Memory Usage**: Monitors system memory consumption
- **Disk Usage**: Tracks storage utilization
- **Database**: Verifies database connectivity and performance
- **Services**: Checks FFmpeg and upload directory availability

### Analytics
- **Project Metrics**: Creation rates, completion rates, failure rates
- **Video Metrics**: Upload volumes, processing times, file sizes
- **Performance Metrics**: Average processing times per stage
- **Error Metrics**: Error rates, failure reasons, resolution times

## Cleanup and Maintenance

### Automatic Cleanup
- **Temporary Files**: Removes files older than 24 hours
- **Old Projects**: Archives projects older than 30 days
- **Orphaned Files**: Removes files without database records
- **Scheduled Execution**: Runs daily cleanup automatically

### Manual Cleanup
- On-demand cleanup via API endpoint
- Dry-run mode for testing cleanup operations
- Detailed cleanup statistics and reporting

## Configuration

### Environment Variables
```bash
# Cleanup intervals (hours)
CLEANUP_TEMP_FILE_MAX_AGE=24
CLEANUP_PROJECT_MAX_AGE=720  # 30 days

# Health monitoring interval (minutes)
HEALTH_MONITOR_INTERVAL=5

# System limits
MAX_MEMORY_USAGE=90
MAX_DISK_USAGE=95
```

### Startup Configuration
The server automatically starts background services:
- Health monitoring (5-minute intervals)
- Automatic cleanup (24-hour intervals)
- Error report cleanup (7-day retention)

## Usage Examples

### Execute Complete Workflow
```javascript
// Frontend
const response = await fetch(`/api/projects/${projectId}/workflow/execute`, {
  method: 'POST'
});

// Backend
const result = await orchestrator.executeCompleteWorkflow(projectId);
```

### Monitor System Health
```javascript
// Get current health status
const health = await fetch('/api/system/health');

// Listen for real-time updates
socket.on('system-health', (healthData) => {
  console.log('System status:', healthData.status);
});
```

### Perform Cleanup
```javascript
// Dry run cleanup
const stats = await fetch('/api/system/cleanup', {
  method: 'POST',
  body: JSON.stringify({ dryRun: true })
});
```

## Testing

### Test Script
Run the workflow integration test:
```bash
npm run test:workflow
```

This tests:
- System health monitoring
- Analytics generation
- Cleanup operations
- Error handling
- System readiness checks

### Manual Testing
1. Start the development server: `npm run dev`
2. Create a new project
3. Upload videos to the project
4. Navigate to the "Workflow" tab
5. Execute the complete workflow
6. Monitor progress and system health
7. Download the final video

## Monitoring and Debugging

### Logs
- All workflow operations are logged with context
- Error reports include stack traces and request IDs
- System health is logged periodically

### WebSocket Events
- `workflow-progress`: Real-time workflow updates
- `system-health`: System health status changes
- `error`: Error notifications
- `critical-error`: Critical system errors

### Health Dashboard
Access system health and analytics through:
- API endpoints for programmatic access
- Frontend WorkflowDashboard for visual monitoring
- Console logs for debugging

## Performance Considerations

### Resource Management
- Parallel video processing with controlled concurrency
- Memory usage monitoring and limits
- Disk space management and cleanup
- Database connection pooling

### Scalability
- Modular service architecture
- Configurable processing limits
- Background job processing
- Efficient file handling

## Security

### Input Validation
- All API endpoints use security middleware
- File upload validation and limits
- Project ownership verification
- Request rate limiting

### Error Information
- Sensitive information filtered from error responses
- Request IDs for error tracking
- Secure error logging

## Future Enhancements

### Planned Features
- Distributed processing support
- Advanced analytics dashboard
- Custom workflow configurations
- Integration with external storage
- Performance optimization recommendations

### Monitoring Improvements
- Alerting system for critical issues
- Historical performance tracking
- Predictive maintenance
- Custom health check plugins