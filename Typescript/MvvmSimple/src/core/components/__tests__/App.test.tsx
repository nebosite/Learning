import React from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import App from "../App";

import { shallow, ShallowWrapper } from "enzyme";

describe("<App />", () => {
  let wrapper: ShallowWrapper;
  // Setup mock
  beforeEach(() => {
    wrapper = shallow(<App />);
  });

  it("should render the header", () => {
    expect(wrapper.find("header")).not.toEqual(0);
  });

  it("the h1 in header should contain a phrase: MVVM Example", () => {
    expect(
      wrapper
        .find("header")
        .find("h1")
        .text()
    ).toBe("MVVM Example");
  });
  it("should render the nav", () => {
    expect(wrapper.find("nav")).not.toEqual(0);
  });

  it("the nav should contain ul", () => {
    expect(wrapper.find("nav").find("ul")).not.toEqual(0);
  });

  it("the ul should contain 2 li", () => {
    expect(
      wrapper
        .find("nav")
        .find("ul")
        .find("li").length
    ).toEqual(2);
  });

  it("should contain Switch", () => {
    expect(wrapper.find(Switch)).toBeDefined();
  });

  it("should contain Route", () => {
    expect(wrapper.find(Route)).toBeDefined();
  });

  it("should contain 2 Links", () => {
    expect(wrapper.find(Link).length).toEqual(2);
  });
});
