// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#pragma once
#include "windows.h"
#include "ConsoleGraphics.h"

class ConsoleGraphics;

//------------------------------------------------------------------------
// MouseDrag
//------------------------------------------------------------------------
struct MouseDrag
{
public:
	int DX, DY;
};

//------------------------------------------------------------------------
// Widget - Ordinary widget base class - just an invisible rectangle
//			that can receive mouse events.
//------------------------------------------------------------------------
class Widget
{

protected:
	int _lastX, _lastY;
	bool _mouseButtonPressed = false;

public:
	int X, Y, Width, Height;
	MouseDrag Drags[50];
	int DragCount = 0;

	Widget(int x, int y, int width, int height);
	~Widget();

	void MouseUp(int x, int y);
	void MouseDown(int x, int y);
	void MouseMove(int x, int y);

	virtual void HandleMouseDrag(MouseDrag drag);
	virtual void Draw(ConsoleGraphics *g);
};


//------------------------------------------------------------------------
// SliderWidget - Acts like a typical slider control
//------------------------------------------------------------------------
class SliderWidget : public Widget
{
	char *_label;
	char _buffer[256];
	int _sliderPosition;
public:
	int Min, Max;
	SliderWidget(int x, int y, int width, int height, char* label, int min, int max);

	int GetValue();
	void SetValue(int);
	virtual void Draw(ConsoleGraphics *g);
	virtual void HandleMouseDrag(MouseDrag drag);
};

//------------------------------------------------------------------------
// ConsoleGraphics - Turn your text console into a lo-res graphics console
//------------------------------------------------------------------------
class ConsoleGraphics
{
	void SetConsoleSize(int Width, int Height);
	HANDLE _outputHandle, _inputHandle;
	_CHAR_INFO *_offScreenBuffer;
	Widget **_widgets;
	int _widgetCount;
	int _currentLeftButtonState;
	Widget *_activeWidget;
public:
	int Width, Height;

	ConsoleGraphics(int width, int height);
	~ConsoleGraphics();

	void Refresh();
	void Clear(char c, int attributes = 15);
	void SetCursorLocation(int x, int y);
	void DrawLine(int x1, int y1, int x2, int y2, char c, WORD attributes = 15);
	void SetPixel(int x2, int y2, char c, WORD attributes = 15);
	void DrawString(char *string, int x, int y, int attribute);

	void AddWidget(Widget *widget);
	void DrawWidgets();
	Widget *FindWidget(int x, int y);
};

