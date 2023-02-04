import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter as Router } from 'react-router-dom';
import { store } from './store/Store';
import App from './App';
import ScrollToTop from './scrollToTop';

import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);

// breaks Map:
/*
  root.render(
    <React.StrictMode>
      <Router>
        <Provider store={store}>
          <App />
        </Provider>
      </Router>
    </React.StrictMode>
  );
*/

root.render(
  <Router>
    <Provider store={store}>
      <ScrollToTop />
      <App />
    </Provider>
  </Router>,
);
