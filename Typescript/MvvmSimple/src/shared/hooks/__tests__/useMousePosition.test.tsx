import * as React from "react";
import { act } from "react-dom/test-utils";

// hooks can be tested only inside of scope of some FC

import { shallow, mount, ShallowWrapper } from "enzyme";

import useMousePosition from "../useMousePosition";

const MockComponent = () => {
  const pos = useMousePosition();
  return (
    <h1>
      {pos.x}, {pos.y}
    </h1>
  );
};

describe("useMousePosition hook", () => {
  let wrapper: ShallowWrapper;

  beforeEach(() => {
    wrapper = shallow(<MockComponent />);
  });

  it("should return an initial position {x: 0, y: 0} without mousemove action", () => {
    expect(wrapper.find("h1").text()).toEqual("0, 0");
  });

  it("should contain updated position after window mousemove", () => {
    // need to mock window events
    const events: any = {};
    jest
      .spyOn(window, "addEventListener")
      .mockImplementation((event, handle, options?) => {
        events[event] = handle;
      });
    jest
      .spyOn(window, "removeEventListener")
      .mockImplementation((event, handle, options?) => {
        events[event] = undefined;
      });

    const component = mount(<MockComponent />);
    // to make sure that the tests behave like the app in a real browser
    act(() => {
      events.mousemove({ clientX: 100, clientY: 100 });
    });

    expect(component.find("h1").text()).toEqual("100, 100");
  });
});
