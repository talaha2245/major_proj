import { Routes, Route } from 'react-router-dom';
import LandingPage from '@/components/LandingPage';
import ChatPage from '@/pages/ChatPage';
import DocsPage from '@/pages/DocsPage';
import TeamPage from '@/pages/TeamPage';
import Layout from '@/components/Layout';
import { useEffect } from 'react';
import axios from 'axios'

function App() {
  useEffect(() => {
    console.log('request has been sent ')
    const intreval = setInterval(() => {
      axios.get("https://my-backend1-6q8j.onrender.com/").then((res) => {
        console.log('sucess')
      })
    }, 10 * 60 * 1000);
    return () => clearInterval(intreval);
  },[])
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<Layout />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/team" element={<TeamPage />} />
      </Route>
    </Routes>
  );
}

export default App;
