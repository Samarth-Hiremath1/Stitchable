#!/usr/bin/env node

/**
 * Test script for the complete end-to-end workflow integration
 * This script tests the workflow orchestrator and related services
 */

const path = require('path');
const fs = require('fs');

// Add the src directory to the module path
require('module').globalPaths.push(path.join(__dirname, '../src'));

async function testWorkflow() {
  console.log('🚀 Testing Complete Workflow Integration...\n');

  try {
    // Test 1: System Health Check
    console.log('1. Testing System Health Service...');
    const { HealthMonitorService } = require('../src/services/HealthMonitorService');
    const healthService = new HealthMonitorService();
    
    const health = await healthService.getSystemHealth();
    console.log(`   System Status: ${health.status}`);
    console.log(`   Memory Usage: ${health.memory.usage.toFixed(1)}%`);
    console.log(`   Disk Usage: ${health.disk.usage.toFixed(1)}%`);
    console.log(`   Database: ${health.database.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`   FFmpeg: ${health.services.ffmpeg ? 'Available' : 'Unavailable'}`);
    console.log('   ✅ Health check completed\n');

    // Test 2: Analytics
    console.log('2. Testing Analytics Service...');
    const analytics = await healthService.getAnalytics();
    console.log(`   Total Projects: ${analytics.projects.total}`);
    console.log(`   Total Videos: ${analytics.videos.total}`);
    console.log(`   Processing Jobs: ${analytics.processing.totalJobs}`);
    console.log(`   Success Rate: ${analytics.processing.successRate.toFixed(1)}%`);
    console.log('   ✅ Analytics completed\n');

    // Test 3: Cleanup Service
    console.log('3. Testing Cleanup Service...');
    const { CleanupService } = require('../src/services/CleanupService');
    const cleanupService = new CleanupService();
    
    // Dry run cleanup
    const cleanupStats = await cleanupService.performCleanup({ dryRun: true });
    console.log(`   Temp files to remove: ${cleanupStats.tempFilesRemoved}`);
    console.log(`   Old projects to remove: ${cleanupStats.oldProjectsRemoved}`);
    console.log(`   Disk space to free: ${(cleanupStats.diskSpaceFreed / 1024 / 1024).toFixed(2)} MB`);
    console.log('   ✅ Cleanup test completed\n');

    // Test 4: Disk Usage
    console.log('4. Testing Disk Usage Stats...');
    const diskUsage = await cleanupService.getDiskUsageStats();
    console.log(`   Total Size: ${(diskUsage.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Video Files: ${(diskUsage.videoFiles / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Processed Files: ${(diskUsage.processedFiles / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Thumbnails: ${(diskUsage.thumbnails / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Temp Files: ${(diskUsage.tempFiles / 1024 / 1024).toFixed(2)} MB`);
    console.log('   ✅ Disk usage stats completed\n');

    // Test 5: Error Handling Service
    console.log('5. Testing Error Handling Service...');
    const { ErrorHandlingService } = require('../src/services/ErrorHandlingService');
    const errorService = new ErrorHandlingService();
    
    // Test error handling
    const errorId = errorService.handleError(
      new Error('Test error for workflow integration'),
      {
        operation: 'test-workflow',
        projectId: 'test-project-123',
        timestamp: new Date()
      },
      'warning'
    );
    
    const errorStats = errorService.getErrorStats();
    console.log(`   Error ID: ${errorId}`);
    console.log(`   Total Errors: ${errorStats.total}`);
    console.log(`   Unresolved: ${errorStats.unresolved}`);
    console.log('   ✅ Error handling test completed\n');

    // Test 6: System Readiness
    console.log('6. Testing System Readiness...');
    const systemReady = await healthService.isSystemReady();
    console.log(`   System Ready: ${systemReady.ready}`);
    if (!systemReady.ready) {
      console.log(`   Reason: ${systemReady.reason}`);
    }
    console.log('   ✅ System readiness check completed\n');

    console.log('🎉 All workflow integration tests completed successfully!');
    console.log('\nNext steps:');
    console.log('- Start the server: npm run dev');
    console.log('- Test the workflow endpoints via API');
    console.log('- Use the frontend WorkflowDashboard component');
    console.log('- Monitor system health and analytics');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testWorkflow();
}

module.exports = { testWorkflow };