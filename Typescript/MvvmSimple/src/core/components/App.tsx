import React from "react";

import Home from "modules/home";
import About from "modules/about";

import { Switch, Route, Link } from "react-router-dom";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>MVVM Example</h1>
        <nav>
          <ul className="nav">
            <li className="nav-item">
              <Link className="nav-link" to="/">
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/about">
                About
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <Switch>
          <Route exact path="/">
            <Home />
          </Route>
          <Route exact path="/about">
            <About />
          </Route>
        </Switch>
      </main>
    </div>
  );
}
