// Simple test script to verify project API endpoints
const http = require('http');

const baseUrl = 'http://localhost:5001';

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testProjectAPI() {
  console.log('Testing Project Management API...\n');

  try {
    // Test 1: Create a project
    console.log('1. Testing project creation...');
    const createResponse = await makeRequest('POST', '/projects', {
      title: 'Test Event',
      description: 'A test event for API validation',
      eventDate: '2024-12-01T10:00:00Z',
      ownerId: 'test-owner-123'
    });
    
    console.log('Create Project Response:', createResponse.status, createResponse.data);
    
    if (createResponse.status !== 201) {
      console.error('❌ Project creation failed');
      return;
    }
    
    const projectId = createResponse.data.data.id;
    const shareLink = createResponse.data.data.shareLink;
    console.log('✅ Project created successfully');
    console.log('Project ID:', projectId);
    console.log('Share Link:', shareLink);

    // Test 2: Get project by ID (with ownership)
    console.log('\n2. Testing project retrieval by ID...');
    const getResponse = await makeRequest('GET', `/projects/${projectId}`, null, {
      'x-owner-id': 'test-owner-123'
    });
    
    console.log('Get Project Response:', getResponse.status, getResponse.data);
    
    if (getResponse.status === 200) {
      console.log('✅ Project retrieval by ID successful');
    } else {
      console.log('❌ Project retrieval by ID failed');
    }

    // Test 3: Get project by share link (public access)
    console.log('\n3. Testing project retrieval by share link...');
    const shareResponse = await makeRequest('GET', `/projects/share/${shareLink}`);
    
    console.log('Get Project by Share Link Response:', shareResponse.status, shareResponse.data);
    
    if (shareResponse.status === 200) {
      console.log('✅ Project retrieval by share link successful');
    } else {
      console.log('❌ Project retrieval by share link failed');
    }

    // Test 4: Update project (with ownership)
    console.log('\n4. Testing project update...');
    const updateResponse = await makeRequest('PUT', `/projects/${projectId}`, {
      title: 'Updated Test Event',
      description: 'Updated description for the test event'
    }, {
      'x-owner-id': 'test-owner-123'
    });
    
    console.log('Update Project Response:', updateResponse.status, updateResponse.data);
    
    if (updateResponse.status === 200) {
      console.log('✅ Project update successful');
    } else {
      console.log('❌ Project update failed');
    }

    // Test 5: Get projects by owner
    console.log('\n5. Testing projects retrieval by owner...');
    const ownerResponse = await makeRequest('GET', '/projects/owner/test-owner-123');
    
    console.log('Get Projects by Owner Response:', ownerResponse.status, ownerResponse.data);
    
    if (ownerResponse.status === 200) {
      console.log('✅ Projects retrieval by owner successful');
      console.log('Number of projects:', ownerResponse.data.data.length);
    } else {
      console.log('❌ Projects retrieval by owner failed');
    }

    // Test 6: Test access control (unauthorized access)
    console.log('\n6. Testing access control...');
    const unauthorizedResponse = await makeRequest('GET', `/projects/${projectId}`, null, {
      'x-owner-id': 'wrong-owner-id'
    });
    
    console.log('Unauthorized Access Response:', unauthorizedResponse.status, unauthorizedResponse.data);
    
    if (unauthorizedResponse.status === 403) {
      console.log('✅ Access control working correctly');
    } else {
      console.log('❌ Access control failed');
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run tests
testProjectAPI();