// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#include "stdafx.h"
#include "ConsoleGraphics.h"
#include "math.h"


//------------------------------------------------------------------------
// Constructor - Set up a console window for showing graphics
//------------------------------------------------------------------------
ConsoleGraphics::ConsoleGraphics(int width, int height)
{
	_widgetCount = 0;
	_widgets = new Widget*[100];
	_outputHandle = GetStdHandle(STD_OUTPUT_HANDLE);
	_inputHandle = GetStdHandle(STD_INPUT_HANDLE);
	SetConsoleSize(width, height);
	SetConsoleMode(_inputHandle, ENABLE_MOUSE_INPUT);

	CONSOLE_CURSOR_INFO cursorInfo;
	cursorInfo.bVisible = false;
	cursorInfo.dwSize = 1;
	SetConsoleCursorInfo(_outputHandle, &cursorInfo);
	
	_currentLeftButtonState = 0;
}


//------------------------------------------------------------------------
// Destructor
//------------------------------------------------------------------------
ConsoleGraphics::~ConsoleGraphics()
{
	delete _offScreenBuffer;
}


//------------------------------------------------------------------------
// SetConsoleSize
//------------------------------------------------------------------------
void ConsoleGraphics::SetConsoleSize(int width, int height)
{
	Width = width;
	Height = height;

	_COORD coord;
	coord.X = Width;
	coord.Y = Height;

	_SMALL_RECT Rect;
	Rect.Top = 0;
	Rect.Left = 0;
	Rect.Bottom = Height - 1;
	Rect.Right = Width - 1;

	SetConsoleScreenBufferSize(_outputHandle, coord);
	SetConsoleWindowInfo(_outputHandle, TRUE, &Rect);
	_offScreenBuffer = new _CHAR_INFO[Width * Height];
}

//------------------------------------------------------------------------
// Refresh  - Read input events and dump background graphics 
//				to the onscreen buffer
//------------------------------------------------------------------------
void ConsoleGraphics::Refresh()
{
	_COORD coord;
	coord.X = 0;
	coord.Y = 0;

	_COORD bufferSize;
	bufferSize.X = Width;
	bufferSize.Y = Height;

	_SMALL_RECT Rect;
	Rect.Top = 0;
	Rect.Left = 0;
	Rect.Bottom = Height - 1;
	Rect.Right = Width - 1;
	WriteConsoleOutputA(_outputHandle, (const CHAR_INFO *)_offScreenBuffer, bufferSize, coord, &Rect);

	DWORD waitingEventCount;
	GetNumberOfConsoleInputEvents(_inputHandle, &waitingEventCount);
	for (int i = 0; i < waitingEventCount; i++)
	{
		INPUT_RECORD InRec;
		DWORD NumRead;
		ReadConsoleInput(_inputHandle, &InRec, 1, &NumRead);

		switch (InRec.EventType)
		{

		case MOUSE_EVENT:
			COORD *coords = &(InRec.Event.MouseEvent.dwMousePosition);
			int leftButton = InRec.Event.MouseEvent.dwButtonState & FROM_LEFT_1ST_BUTTON_PRESSED;

			// mouse down
			if (_currentLeftButtonState == 0 && leftButton != 0)
			{
				_currentLeftButtonState = leftButton;
				_activeWidget = FindWidget(coords->X, coords->Y);
				_activeWidget->MouseDown(coords->X, coords->Y);
			}
			// mouse up
			else if (_currentLeftButtonState != 0 && leftButton == 0)
			{
				_activeWidget->MouseUp(coords->X, coords->Y);
				_currentLeftButtonState = 0;
				_activeWidget = NULL;
			}

			if (_activeWidget) _activeWidget->MouseMove(coords->X, coords->Y);
			break;
		}
	}
}

//------------------------------------------------------------------------
// FindWidget
//------------------------------------------------------------------------
Widget *ConsoleGraphics::FindWidget(int x, int y)
{
	// return the most recently added widge that matches the location
	for (int i = _widgetCount - 1; i >= 0; i--)
	{
		Widget *w = _widgets[i];
		if (x >= w->X
			&& y >= w->Y
			&& x <= (w->X + w->Width)
			&& y <= (w->Y + w->Height))
		{
			return _widgets[i];
		}

	}
	return NULL;
}

//------------------------------------------------------------------------
// Clear - Clear the offscreen buffer
//------------------------------------------------------------------------
void ConsoleGraphics::Clear(char c, int attributes)
{
	for (int i = 0; i < Width * Height; i++)
	{
		_offScreenBuffer[i].Char.AsciiChar = c;
		_offScreenBuffer[i].Attributes = attributes;
	}
}

//------------------------------------------------------------------------
// SetCursorLocation
//------------------------------------------------------------------------
void ConsoleGraphics::SetCursorLocation(int x, int y)
{
	_COORD cursorPosition;
	cursorPosition.X = x;
	cursorPosition.Y = y;
	SetConsoleCursorPosition(_outputHandle, cursorPosition);
}

//------------------------------------------------------------------------
// swap (for DrawLine)
//------------------------------------------------------------------------
void swap(int &a, int &b)
{
	int temp = a;
	a = b;
	b = temp;
}

//------------------------------------------------------------------------
// DrawLine - Thanks, Bresenham!
//------------------------------------------------------------------------
void ConsoleGraphics::DrawLine(int x1, int y1, int x2, int y2, char c, WORD attributes)
{
	SetPixel(x2, y2, c, attributes);  // Because bresenham sometimes leaves off the end pixel

	const bool steep = (abs(y2 - y1) > abs(x2 - x1));
	if (steep)
	{
		swap(x1, y1);
		swap(x2, y2);
	}

	if (x1 > x2)
	{
		swap(x1, x2);
		swap(y1, y2);
	}

	const float dx = x2 - x1;
	const float dy = abs(y2 - y1);

	float error = dx / 2.0f;
	const int ystep = (y1 < y2) ? 1 : -1;
	int y = (int)y1;

	const int maxX = (int)x2;

	for (int x = (int)x1; x<maxX; x++)
	{
		if (steep)
		{
			SetPixel(y, x, c, attributes);
		}
		else
		{
			SetPixel(x, y, c, attributes);
		}

		error -= dy;
		if (error < 0)
		{
			y += ystep;
			error += dx;
		}
	}

}

//------------------------------------------------------------------------
// SetPixel - (offscreen pixels are clipped)
//------------------------------------------------------------------------
void ConsoleGraphics::SetPixel(int x, int y, char c, WORD attributes)
{
	if (x < 0 || y < 0 || x >= Width || y >= Height) return;
	int spot = x + y * Width;
	if (spot < 0 || spot > Width * Height) return;
	_offScreenBuffer[spot].Char.AsciiChar = c;
	_offScreenBuffer[spot].Attributes = attributes;
}

//------------------------------------------------------------------------
// DrawString
//------------------------------------------------------------------------
void ConsoleGraphics::DrawString(char *string, int x, int y, int attributes)
{
	int bufferSpot = x + y * Width;
	int maxBuffer = Width * Height;
	for (int i = 0; i < strlen(string); i++)
	{
		if (bufferSpot >= maxBuffer) break;
		_offScreenBuffer[bufferSpot].Char.AsciiChar = string[i];
		_offScreenBuffer[bufferSpot].Attributes = attributes;
		bufferSpot++;

	}
}

//------------------------------------------------------------------------
// AddWidget
//------------------------------------------------------------------------
void ConsoleGraphics::AddWidget(Widget *widget)
{
	_widgets[_widgetCount++] = widget;
	_widgets[_widgetCount] = NULL;
}

//------------------------------------------------------------------------
// DrawWidgets
//------------------------------------------------------------------------
void ConsoleGraphics::DrawWidgets()
{
	for (int i = 0; i < _widgetCount; i++)
	{
		_widgets[i]->Draw(this);
	}
}

// ******************************************************************************************
// ******************************************************************************************
// **************   WIDGET        ***********************************************************
// ******************************************************************************************
// ******************************************************************************************
// ******************************************************************************************

//------------------------------------------------------------------------
// Widget
//------------------------------------------------------------------------
Widget::Widget(int x, int y, int width, int height)
{
	X = x;
	Y = y;
	Width = width;
	Height = height;
	_mouseButtonPressed = false;
}


//------------------------------------------------------------------------
// MouseDown
//------------------------------------------------------------------------
void Widget::MouseDown(int x, int y)
{
	_lastX = x;
	_lastY = y;
	_mouseButtonPressed = true;
}

//------------------------------------------------------------------------
// MouseUp
//------------------------------------------------------------------------
void Widget::MouseUp(int x, int y)
{
	_lastX = x;
	_lastY = y;
	_mouseButtonPressed = false;
}

//------------------------------------------------------------------------
// MouseMove
//------------------------------------------------------------------------
void Widget::MouseMove(int x, int y)
{
	if (_mouseButtonPressed)
	{
		Drags[DragCount].DX = x - _lastX;
		Drags[DragCount].DY = y - _lastY;
		HandleMouseDrag(Drags[DragCount]);
		DragCount++;
	}

	_lastX = x;
	_lastY = y;

}

//------------------------------------------------------------------------
// Draw
//------------------------------------------------------------------------
void Widget::Draw(ConsoleGraphics *g)
{
	//g->DrawLine(X, Y, X + Width, Y, '-', 15);
	//g->DrawLine(X, Y, X, Y +Height, '|', 15);
}

//------------------------------------------------------------------------
// HandleMouseDrag
//------------------------------------------------------------------------
void Widget::HandleMouseDrag(MouseDrag drag)
{

}

// ******************************************************************************************
// ******************************************************************************************
// **************   SLIDER        ***********************************************************
// ******************************************************************************************
// ******************************************************************************************
// ******************************************************************************************

//------------------------------------------------------------------------
// SliderWidget
//------------------------------------------------------------------------
SliderWidget::SliderWidget(int x, int y, int width, int height, char* label, int min, int max) : Widget(x, y, width, height)
{
	_label = (char *)malloc(strlen(label) + 1);
	strcpy(_label, label);
	Min = min;
	Max = max;
	_sliderPosition = x + width / 2;
}

//------------------------------------------------------------------------
// Draw
//------------------------------------------------------------------------
void SliderWidget::Draw(ConsoleGraphics *g)
{
	sprintf(_buffer, "%s: %d", _label, GetValue());
	g->SetCursorLocation(X, Y);
	g->DrawString(_buffer, X, Y, 15);
	for (int i = 0; i < Width; i++)
	{
		g->SetPixel(X + i, Y + 1, '=', 7);
	}
	g->SetPixel(X, Y + 1, '[', 7);
	g->SetPixel(X + Width - 1, Y + 1, ']', 7);
	g->SetPixel(_sliderPosition, Y + 1, 'H', 7);

}

//------------------------------------------------------------------------
// GetValue
//------------------------------------------------------------------------
int SliderWidget::GetValue()
{
	double ratio = (_sliderPosition - X - 1) / ((double)Width - 3);
	return ratio * (Max - Min) + Min;
}

//------------------------------------------------------------------------
// SetValue
//------------------------------------------------------------------------
void SliderWidget::SetValue(int newValue)
{
	double ratio = (newValue - Min) / ((double)Max - Min);
	if (ratio < 0) ratio = 0;
	if (ratio > 1) ratio = 1;
	_sliderPosition = X + 1 + (ratio * (Width - 3));
}

//------------------------------------------------------------------------
// HandleMouseDrag
//------------------------------------------------------------------------
void SliderWidget::HandleMouseDrag(MouseDrag drag)
{
	_sliderPosition = _lastX;
	if (_sliderPosition < X + 1) _sliderPosition = X + 1;
	if (_sliderPosition >= X + Width - 1) _sliderPosition = X + Width - 1;
}