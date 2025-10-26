import React, { useEffect, useState } from 'react';
import { SystemNotification } from '../services/socketService';

interface NotificationSystemProps {
  notifications: SystemNotification[];
  onDismiss: (index: number) => void;
  onClearAll: () => void;
  maxVisible?: number;
  autoHideDuration?: number;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  maxVisible = 5,
  autoHideDuration = 5000
}) => {
  const [hidingNotifications, setHidingNotifications] = useState<Set<number>>(new Set());

  // Auto-hide notifications after specified duration
  useEffect(() => {
    if (autoHideDuration > 0) {
      notifications.forEach((notification, index) => {
        if (notification.type === 'success' || notification.type === 'info') {
          const timer = setTimeout(() => {
            handleDismiss(index);
          }, autoHideDuration);

          return () => clearTimeout(timer);
        }
      });
    }
  }, [notifications, autoHideDuration]);

  const handleDismiss = (index: number) => {
    setHidingNotifications(prev => new Set(prev).add(index));
    
    // Remove from hiding set and actually dismiss after animation
    setTimeout(() => {
      setHidingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
      onDismiss(index);
    }, 300);
  };

  const getNotificationIcon = (type: SystemNotification['type']) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getNotificationColors = (type: SystemNotification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  if (notifications.length === 0) {
    return null;
  }

  const visibleNotifications = notifications.slice(-maxVisible);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {/* Clear All Button */}
      {notifications.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700 bg-white px-2 py-1 rounded shadow-sm border"
          >
            Clear all ({notifications.length})
          </button>
        </div>
      )}

      {/* Notifications */}
      {visibleNotifications.map((notification, index) => {
        const actualIndex = notifications.length - maxVisible + index;
        const isHiding = hidingNotifications.has(actualIndex);
        
        return (
          <div
            key={`${notification.timestamp}-${actualIndex}`}
            className={`
              transform transition-all duration-300 ease-in-out
              ${isHiding ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
              border rounded-lg p-4 shadow-lg backdrop-blur-sm
              ${getNotificationColors(notification.type)}
            `}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium">
                  {notification.message}
                </p>
                <p className="text-xs opacity-75 mt-1">
                  {formatTimestamp(notification.timestamp)}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => handleDismiss(actualIndex)}
                  className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Show count if there are more notifications */}
      {notifications.length > maxVisible && (
        <div className="text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
            +{notifications.length - maxVisible} more notifications
          </div>
        </div>
      )}
    </div>
  );
};