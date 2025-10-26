
import { useState, useEffect } from 'react';
import { Project } from './types';
import { ProjectListPage } from './pages/ProjectListPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ContributorUploadPage } from './pages/ContributorUploadPage';
import { NotificationSystem } from './components/NotificationSystem';
import { useProcessingUpdates } from './hooks/useProcessingUpdates';

type AppView = 'list' | 'create' | 'detail' | 'contribute';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('list');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  
  // For demo purposes, using a hardcoded owner ID
  // In a real app, this would come from authentication
  const ownerId = 'demo-user';

  // Global processing updates for notifications
  const [globalProcessingState, globalProcessingActions] = useProcessingUpdates();

  // Check URL for share link on app load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareLinkParam = urlParams.get('share');
    
    if (shareLinkParam) {
      setShareLink(shareLinkParam);
      setCurrentView('contribute');
    }
  }, []);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setCurrentView('detail');
  };

  const handleCreateProject = () => {
    setCurrentView('create');
  };

  const handleProjectCreated = (project: Project) => {
    setSelectedProject(project);
    setCurrentView('detail');
  };

  const handleBack = () => {
    setSelectedProject(null);
    setCurrentView('list');
  };

  const handleCancel = () => {
    setCurrentView('list');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Stitchable
              </h1>
              <p className="text-gray-600 mt-2">
                AI-powered multi-source video stitching platform
              </p>
            </div>
            
            {currentView !== 'list' && (
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>
      
      <main className="py-6">
        {currentView === 'list' && (
          <ProjectListPage
            ownerId={ownerId}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
          />
        )}
        
        {currentView === 'create' && (
          <CreateProjectPage
            ownerId={ownerId}
            onProjectCreated={handleProjectCreated}
            onCancel={handleCancel}
          />
        )}
        
        {currentView === 'detail' && selectedProject && (
          <ProjectDetailPage
            projectId={selectedProject.id}
            onBack={handleBack}
          />
        )}
        
        {currentView === 'contribute' && shareLink && (
          <ContributorUploadPage
            shareLink={shareLink}
          />
        )}
      </main>

      {/* Global Notification System */}
      <NotificationSystem
        notifications={globalProcessingState.notifications}
        onDismiss={globalProcessingActions.dismissNotification}
        onClearAll={globalProcessingActions.clearNotifications}
        maxVisible={5}
        autoHideDuration={5000}
      />
    </div>
  );
}

export default App;