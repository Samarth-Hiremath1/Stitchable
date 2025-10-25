// Test script to create a project and test the upload flow
const API_BASE_URL = 'http://localhost:5001/api';

async function testUploadFlow() {
  try {
    console.log('Creating test project...');
    
    // Create a test project
    const projectResponse = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Test Upload Project',
        description: 'Testing video upload functionality',
        eventDate: new Date().toISOString(),
        ownerId: 'test-user'
      })
    });

    if (!projectResponse.ok) {
      throw new Error(`Failed to create project: ${projectResponse.status}`);
    }

    const projectData = await projectResponse.json();
    const project = projectData.data;
    
    console.log('Project created successfully!');
    console.log('Project ID:', project.id);
    console.log('Share Link:', project.shareLink);
    console.log('');
    console.log('To test video upload:');
    console.log(`1. Open: http://localhost:3000?share=${project.shareLink}`);
    console.log('2. Enter your name');
    console.log('3. Upload a video file');
    console.log('');
    console.log('To view project as owner:');
    console.log(`1. Open: http://localhost:3000`);
    console.log(`2. Click on the project: "${project.title}"`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUploadFlow();