import React from "react";
import { mount, ReactWrapper } from "enzyme";

import Combobox from "../Combobox";

// The React Select is almost impossible to test because they didn't provide any api
// and the implementation wasn't designed to be testable from outside

const optionsMock = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta" },
  { value: "hamma", label: "Hamma" }
];

const propsMockValue = {
  options: optionsMock,
  selectedItem: null,
  onSelectValue: jest.fn(),
  onInputChange: jest.fn(),
  onInputEnter: jest.fn()
};

describe("<Combobox />", () => {
  let wrapper: ReactWrapper;
  // set the initial value
  let propsMock = propsMockValue;

  beforeEach(() => {
    wrapper = mount(<Combobox {...propsMock} />);
  });

  afterEach(() => {
    // we want to have isolated tests so we need to set the 'clean' mocks
    propsMock = propsMockValue;
  });

  it("should render the combobox", () => {
    expect(wrapper.find(".combobox")).toBeDefined();
  });

  it("should render the initial combobox menu", () => {
    // as the React Select uses css-modules, we can't use direct matching
    expect(wrapper.find("div[class*='menu']")).toBeDefined();
  });

  it("should render the input", () => {
    // as the React Select uses css-modules, we can't use direct matching
    expect(wrapper.find("input")).toBeDefined();
  });

  it("should call onInputChange on input change event", () => {
    // as the React Select uses css-modules, we can't use direct matching
    const inputWrapper = wrapper.find("input");
    expect(propsMock.onInputChange).not.toHaveBeenCalled();

    // inputWrapper.simulate("keypress", {key: "Enter"});
    inputWrapper.simulate("change", { target: { value: "Changed" } });
    expect(propsMock.onInputChange).toHaveBeenCalled();
  });
});
