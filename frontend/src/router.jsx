import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import ChatLayout from './layouts/ChatLayout.jsx';
import ChatPlaceholder from './components/chat/ChatPlaceholder.jsx';
import ChatRoomPage from './pages/ChatRoomPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import StoriesPage from './pages/StoriesPage.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import PublicOnlyRoute from './components/common/PublicOnlyRoute.jsx';

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <Navigate to="/chats" replace /> },
      {
        element: <ChatLayout />,
        children: [
          { path: '/chats', element: <ChatPlaceholder /> },
          { path: '/chats/:chatId', element: <ChatRoomPage /> },
        ],
      },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/stories', element: <StoriesPage /> },
    ],
  },
]);
