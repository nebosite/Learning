import React from "react";
import { shallow, ShallowWrapper } from "enzyme";

import TextInpTrackedLn from "../TextInpTrackedLn";

describe("<TextInpTrackedLn />", () => {
  let wrapper: ShallowWrapper;

  beforeEach(() => {
    wrapper = shallow(<TextInpTrackedLn />);
  });

  it("should render a wrapper with a class .text-input-tracked", () => {
    expect(wrapper.find(".text-input-tracked")).toBeDefined();
  });

  it("at the initial render attention-msg should contain a 0 length", () => {
    expect(wrapper.find(".attention-msg").text()).toBe("0");
  });

  it(`after input change the attention-msg should 
	     contain the update length of the entered phrase`, () => {
    expect(wrapper.find(".attention-msg").text()).toBe("0");

    wrapper.find("input").simulate("change", { target: { value: "Changed" } });
    const expecteLn = "Changed".length;

    expect(wrapper.find(".attention-msg").text()).toBe(expecteLn.toString());
  });
});
