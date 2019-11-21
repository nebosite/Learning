import "assets/styles/index.scss";

import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router } from "react-router-dom";

import App from "core/components/App";
import StoreProvider from "stores";

import * as serviceWorker from "./serviceWorker";

ReactDOM.render(
  <StoreProvider>
    <Router>
      <App />
    </Router>
  </StoreProvider>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
