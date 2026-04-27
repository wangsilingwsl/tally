import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';

// 应用入口，后续任务中添加路由和全局组件
function App() {
  return <div>归物 · Tally</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
