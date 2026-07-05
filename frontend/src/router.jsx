import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import ChatListPage from './pages/ChatListPage.jsx';
import ChatRoomPage from './pages/ChatRoomPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import StoriesPage from './pages/StoriesPage.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <Navigate to="/chats" replace /> },
      { path: '/chats', element: <ChatListPage /> },
      { path: '/chats/:chatId', element: <ChatRoomPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/stories', element: <StoriesPage /> },
    ],
  },
]);
