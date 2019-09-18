// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------


#pragma once
#include "ConsoleGraphics.h"
#include "Fast3dObject.h"
#include "PhysicsApp.h"
#include "ParticleSystem.h"

//------------------------------------------------------------------------
// PhysicsApp - Show a physics engine/toy with console graphics
//------------------------------------------------------------------------
class PhysicsApp
{
	Widget *mainControl;
	Widget *flagBaseControl;
	SliderWidget *windSlider;
	SliderWidget *gravitySlider;
	SliderWidget *springConstantSlider;
	SliderWidget *dragSlider;
	SliderWidget *turbulenceSlider;
	ParticleSystem *particleSystem;

	void DrawLineSegments(FastVector** points, char c, int attribute);
	ConsoleGraphics *_graphics;

	void HandleMouseDrag(Widget *widget, int x1, int y1, int x2, int y2);
	void SetupWidgets();

public:
	PhysicsApp();
	~PhysicsApp();

	void Run();
};

