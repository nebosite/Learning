// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#include "stdafx.h"
#include "Fast3DObject.h"
#include "malloc.h"
#include "math.h"
#include "stdafx.h"
#include "string.h"

//############################################################################################
//############################################################################################
//################################    FastTransformMatrix   ##################################
//############################################################################################
//############################################################################################

int FastTransformMatrix::Count = 0;

//--------------------------------------------------------------------------------
// 
//--------------------------------------------------------------------------------
FastTransformMatrix::FastTransformMatrix()
{
	Count++;

	A11 = A12 = A13 = A14 = A21 = A22 = A23 = A24 = A31 = A32 = A33 = A34 = A41 = A42 = A43 = A44 = 0;
}

//--------------------------------------------------------------------------------
// 
//--------------------------------------------------------------------------------
FastTransformMatrix::~FastTransformMatrix()
{
	Count--;
}


//--------------------------------------------------------------------------------
// 
//--------------------------------------------------------------------------------
FastTransformMatrix FastTransformMatrix::operator=(const FastTransformMatrix & otherMatrix)
{
	A11 = otherMatrix.A11;
	A12 = otherMatrix.A12;
	A13 = otherMatrix.A13;
	A14 = otherMatrix.A14;
	A21 = otherMatrix.A21;
	A22 = otherMatrix.A22;
	A23 = otherMatrix.A23;
	A24 = otherMatrix.A24;
	A31 = otherMatrix.A31;
	A32 = otherMatrix.A32;
	A33 = otherMatrix.A33;
	A34 = otherMatrix.A34;
	A41 = otherMatrix.A41;
	A42 = otherMatrix.A42;
	A43 = otherMatrix.A43;
	A44 = otherMatrix.A44;
	return *this;
}

//--------------------------------------------------------------------------------
// 
//--------------------------------------------------------------------------------
FastTransformMatrix::FastTransformMatrix(const FastTransformMatrix & otherMatrix)
{
	A11 = otherMatrix.A11;
	A12 = otherMatrix.A12;
	A13 = otherMatrix.A13;
	A14 = otherMatrix.A14;
	A21 = otherMatrix.A21;
	A22 = otherMatrix.A22;
	A23 = otherMatrix.A23;
	A24 = otherMatrix.A24;
	A31 = otherMatrix.A31;
	A32 = otherMatrix.A32;
	A33 = otherMatrix.A33;
	A34 = otherMatrix.A34;
	A41 = otherMatrix.A41;
	A42 = otherMatrix.A42;
	A43 = otherMatrix.A43;
	A44 = otherMatrix.A44;
}


//--------------------------------------------------------------------------------
// ToString
//--------------------------------------------------------------------------------
char * FastTransformMatrix::ToString()
{
	char* output = new char[1000];
	output[0] = 0;
	strcat(output, "[");
	double values[]{A11, A12, A13, A14, A21, A22, A23, A24, A31, A32, A33, A34, A41, A42, A43, A44};

	strcat(output, "[");
	for (int i = 0; i < 16; i++)
	{
		int col = i % 4;
		if (col == 0) strcat(output, "[");
		sprintf(output + strlen(output), "%lf", values[i]);
		for (int j = strlen(output) - 1;
			j > 1 && output[j - 1] != '.' && output[j] == '0';
			j--)
		{
			output[j] = 0;
		}
		if (col < 3) strcat(output, ", ");
		if (col == 3) strcat(output, "]");
	}
	strcat(output, "]");
	return output;
}

//--------------------------------------------------------------------------------
// Multiply two matrices
//--------------------------------------------------------------------------------
FastTransformMatrix  FastTransformMatrix::operator*(const FastTransformMatrix & m)
{
	FastTransformMatrix newMatrix;

	newMatrix.A11 = A11 * m.A11 + A12 * m.A21 + A13 * m.A31 + A14 * m.A41;
	newMatrix.A12 = A11 * m.A12 + A12 * m.A22 + A13 * m.A32 + A14 * m.A42;
	newMatrix.A13 = A11 * m.A13 + A12 * m.A23 + A13 * m.A33 + A14 * m.A43;
	newMatrix.A14 = A11 * m.A14 + A12 * m.A24 + A13 * m.A34 + A14 * m.A44;
	newMatrix.A21 = A21 * m.A11 + A22 * m.A21 + A23 * m.A31 + A24 * m.A41;
	newMatrix.A22 = A21 * m.A12 + A22 * m.A22 + A23 * m.A32 + A24 * m.A42;
	newMatrix.A23 = A21 * m.A13 + A22 * m.A23 + A23 * m.A33 + A24 * m.A43;
	newMatrix.A24 = A21 * m.A14 + A22 * m.A24 + A23 * m.A34 + A24 * m.A44;
	newMatrix.A31 = A31 * m.A11 + A32 * m.A21 + A33 * m.A31 + A34 * m.A41;
	newMatrix.A32 = A31 * m.A12 + A32 * m.A22 + A33 * m.A32 + A34 * m.A42;
	newMatrix.A33 = A31 * m.A13 + A32 * m.A23 + A33 * m.A33 + A34 * m.A43;
	newMatrix.A34 = A31 * m.A14 + A32 * m.A24 + A33 * m.A34 + A34 * m.A44;
	newMatrix.A41 = A41 * m.A11 + A42 * m.A21 + A43 * m.A31 + A44 * m.A41;
	newMatrix.A42 = A41 * m.A12 + A42 * m.A22 + A43 * m.A32 + A44 * m.A42;
	newMatrix.A43 = A41 * m.A13 + A42 * m.A23 + A43 * m.A33 + A44 * m.A43;
	newMatrix.A44 = A41 * m.A14 + A42 * m.A24 + A43 * m.A34 + A44 * m.A44;

	return newMatrix;
}

//--------------------------------------------------------------------------------
// Multiply two matrices
//--------------------------------------------------------------------------------
void FastTransformMatrix::operator*=(const FastTransformMatrix & m)
{
	FastTransformMatrix newMatrix;
	newMatrix.A11 = A11 * m.A11 + A12 * m.A21 + A13 * m.A31 + A14 * m.A41;
	newMatrix.A12 = A11 * m.A12 + A12 * m.A22 + A13 * m.A32 + A14 * m.A42;
	newMatrix.A13 = A11 * m.A13 + A12 * m.A23 + A13 * m.A33 + A14 * m.A43;
	newMatrix.A14 = A11 * m.A14 + A12 * m.A24 + A13 * m.A34 + A14 * m.A44;
	newMatrix.A21 = A21 * m.A11 + A22 * m.A21 + A23 * m.A31 + A24 * m.A41;
	newMatrix.A22 = A21 * m.A12 + A22 * m.A22 + A23 * m.A32 + A24 * m.A42;
	newMatrix.A23 = A21 * m.A13 + A22 * m.A23 + A23 * m.A33 + A24 * m.A43;
	newMatrix.A24 = A21 * m.A14 + A22 * m.A24 + A23 * m.A34 + A24 * m.A44;
	newMatrix.A31 = A31 * m.A11 + A32 * m.A21 + A33 * m.A31 + A34 * m.A41;
	newMatrix.A32 = A31 * m.A12 + A32 * m.A22 + A33 * m.A32 + A34 * m.A42;
	newMatrix.A33 = A31 * m.A13 + A32 * m.A23 + A33 * m.A33 + A34 * m.A43;
	newMatrix.A34 = A31 * m.A14 + A32 * m.A24 + A33 * m.A34 + A34 * m.A44;
	newMatrix.A41 = A41 * m.A11 + A42 * m.A21 + A43 * m.A31 + A44 * m.A41;
	newMatrix.A42 = A41 * m.A12 + A42 * m.A22 + A43 * m.A32 + A44 * m.A42;
	newMatrix.A43 = A41 * m.A13 + A42 * m.A23 + A43 * m.A33 + A44 * m.A43;
	newMatrix.A44 = A41 * m.A14 + A42 * m.A24 + A43 * m.A34 + A44 * m.A44;
	*this = newMatrix;
}

//--------------------------------------------------------------------------------
// Multiply matrix by a vector
//--------------------------------------------------------------------------------
FastVector FastTransformMatrix::operator*(FastVector & v)
{
	FastVector newVector;
	newVector.X = A11 * v.X + A12 * v.Y + A13 * v.Z + A14 * v.W;
	newVector.Y = A21 * v.X + A22 * v.Y + A23 * v.Z + A24 * v.W;
	newVector.Z = A31 * v.X + A32 * v.Y + A33 * v.Z + A34 * v.W;
	newVector.W = A41 * v.X + A42 * v.Y + A43 * v.Z + A44 * v.W;
	return newVector;
}


//--------------------------------------------------------------------------------
// IdentityMatrix
//--------------------------------------------------------------------------------
FastTransformMatrix FastTransformMatrix::IdentityMatrix()
{
	FastTransformMatrix newMatrix;
	newMatrix.A11 = 1;
	newMatrix.A22 = 1;
	newMatrix.A33 = 1;
	newMatrix.A44 = 1;

	return newMatrix;
}

//--------------------------------------------------------------------------------
// TranslateMatrix
//--------------------------------------------------------------------------------
FastTransformMatrix FastTransformMatrix::TranslateMatrix(double x, double y, double z)
{
	FastTransformMatrix newMatrix;
	newMatrix.A11 = 1;
	newMatrix.A22 = 1;
	newMatrix.A33 = 1;
	newMatrix.A44 = 1;

	newMatrix.A14 = x;
	newMatrix.A24 = y;
	newMatrix.A34 = z;

	return newMatrix;
}

//--------------------------------------------------------------------------------
// ScaleMatrix
//--------------------------------------------------------------------------------
FastTransformMatrix FastTransformMatrix::ScaleMatrix(double scale)
{
	FastTransformMatrix newMatrix;
	(newMatrix).A11 = scale;
	(newMatrix).A22 = scale;
	(newMatrix).A33 = scale;
	(newMatrix).A44 = 1;
	return newMatrix;
}

//--------------------------------------------------------------------------------
// RotateXMatrix
//--------------------------------------------------------------------------------
FastTransformMatrix FastTransformMatrix::RotateXMatrix(double theta)
{
	FastTransformMatrix newMatrix;
	double costheta = cos(theta);
	double sintheta = sin(theta);
	newMatrix.A11 = 1;
	newMatrix.A22 = costheta;
	newMatrix.A23 = -sintheta;
	newMatrix.A32 = sintheta;
	newMatrix.A33 = costheta;

	newMatrix.A44 = 1;
	return newMatrix;
}

//--------------------------------------------------------------------------------
// RotateYMatrix
//--------------------------------------------------------------------------------
FastTransformMatrix FastTransformMatrix::RotateYMatrix(double theta)
{
	FastTransformMatrix newMatrix;
	double costheta = cos(theta);
	double sintheta = sin(theta);

	newMatrix.A11 = costheta;
	newMatrix.A13 = sintheta;
	newMatrix.A22 = 1;
	newMatrix.A31 = -sintheta;
	newMatrix.A33 = costheta;

	newMatrix.A44 = 1;
	return newMatrix;
}

//--------------------------------------------------------------------------------
// RotateZMatrix
//--------------------------------------------------------------------------------
FastTransformMatrix FastTransformMatrix::RotateZMatrix(double theta)
{
	FastTransformMatrix newMatrix;
	double costheta = cos(theta);
	double sintheta = sin(theta);
	newMatrix.A11 = costheta;
	newMatrix.A12 = -sintheta;
	newMatrix.A21 = sintheta;
	newMatrix.A22 = costheta;

	newMatrix.A33 = 1;
	newMatrix.A44 = 1;
	return newMatrix;
}


//############################################################################################
//############################################################################################
//################################        FastVector        ##################################
//############################################################################################
//############################################################################################


int FastVector::Count = 0;
FastVector FastVector::Zero;

//------------------------------------------------------------------------
// Destructor
//------------------------------------------------------------------------
FastVector::~FastVector()
{
	Count--;
}

//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
FastVector::FastVector()
{
	Count++;
	X = Y = Z = W = 0;
}

//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
FastVector::FastVector(double x, double y, double z)
{
	Count++;
	X = x;
	Y = y;
	Z = z;
}

//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
FastVector::FastVector(double x, double y, double z, double w)
{
	Count++;
	X = x;
	Y = y;
	Z = z;
	W = w;
}

//------------------------------------------------------------------------
// ToString
//------------------------------------------------------------------------
char *FastVector::ToString(int length)
{
	char* output = new char[1000];
	output[0] = 0;
	strcat(output, "[");
	double values[]{X, Y, Z, W};

	for (int i = 0; i < length; i++)
	{
		sprintf(output + strlen(output), "%lf", values[i]);
		for (int j = strlen(output) - 1;
			j > 1 && output[j - 1] != '.' && output[j] == '0';
			j--)
		{
			output[j] = 0;
		}
		if (i < length - 1) strcat(output, ", ");
	}
	strcat(output, "]");
	return output;
}

//------------------------------------------------------------------------
// GetLength
//------------------------------------------------------------------------
double FastVector::GetLength()
{
	return sqrt(X*X + Y*Y + Z*Z);
}

//------------------------------------------------------------------------
// Normalize
//------------------------------------------------------------------------
void FastVector::Normalize()
{
	double length = GetLength();
	X = X / length;
	Y = Y / length;
	Z = Z / length;
}



//------------------------------------------------------------------------
// CrossWith - Cross product
//------------------------------------------------------------------------
FastVector FastVector::CrossWith(const FastVector &v2)
{
	FastVector *newVector = new FastVector();

	(*newVector).X = Y * v2.Z - Z * v2.Y;
	(*newVector).Y = Z * v2.X - X * v2.Z;
	(*newVector).Z = X * v2.Y - Y * v2.X;

	return *newVector;
}

//------------------------------------------------------------------------
// *
//------------------------------------------------------------------------
FastVector FastVector::operator*(const double value)
{
	FastVector newVector;

	(newVector).X = X * value;
	(newVector).Y = Y * value;
	(newVector).Z = Z * value;
	(newVector).W = W * value;

	return newVector;
}

//------------------------------------------------------------------------
// /
//------------------------------------------------------------------------
FastVector FastVector::operator/(const double value)
{
	FastVector newVector;

	(newVector).X = X / value;
	(newVector).Y = Y / value;
	(newVector).Z = Z / value;
	(newVector).W = W / value;

	return newVector;
}

//------------------------------------------------------------------------
// -
//------------------------------------------------------------------------
FastVector FastVector::operator-(const FastVector &v2)
{
	FastVector newVector;

	(newVector).X = X - v2.X;
	(newVector).Y = Y - v2.Y;
	(newVector).Z = Z - v2.Z;
	(newVector).W = W - v2.W;

	return newVector;
}

//------------------------------------------------------------------------
// +
//------------------------------------------------------------------------
FastVector FastVector::operator+(const FastVector &v2)
{
	FastVector newVector;

	(newVector).X = X + v2.X;
	(newVector).Y = Y + v2.Y;
	(newVector).Z = Z + v2.Z;
	(newVector).W = W + v2.W;

	return newVector;
}

//------------------------------------------------------------------------
// =
//------------------------------------------------------------------------
FastVector& FastVector::operator=(const FastVector &sourceObject)
{
	X = sourceObject.X;
	Y = sourceObject.Y;
	Z = sourceObject.Z;
	W = sourceObject.W;

	return *this;
}

//------------------------------------------------------------------------
// -=
//------------------------------------------------------------------------
FastVector& FastVector::operator-=(const FastVector &sourceObject)
{
	X -= sourceObject.X;
	Y -= sourceObject.Y;
	Z -= sourceObject.Z;
	W -= sourceObject.W;

	return *this;
}

//------------------------------------------------------------------------
// +=
//------------------------------------------------------------------------
FastVector& FastVector::operator+=(const FastVector &sourceObject)
{
	X += sourceObject.X;
	Y += sourceObject.Y;
	Z += sourceObject.Z;
	W += sourceObject.W;

	return *this;
}

//------------------------------------------------------------------------
// GetDistance
//------------------------------------------------------------------------
double FastVector::GetDistance(const FastVector &v2)
{
	double dx = v2.X - X;
	double dy = v2.Y - Y;
	double dz = v2.Z - Z;
	return sqrt(dx * dx + dy * dy + dz * dz);
}

//############################################################################################
//############################################################################################
//################################        Fast3dObject      ##################################
//############################################################################################
//############################################################################################


//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
Fast3DOjbect::Fast3DOjbect()
{
	_pointBufferSize = 1000;
	_pointCount = 0;
	_points = (FastVector**)calloc(1000, sizeof(FastVector*));
	_worldPoints = NULL;
	ClearTransformation();
}


//------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------
Fast3DOjbect::~Fast3DOjbect()
{
	free(_points);
}

//------------------------------------------------------------------------
// AddPoint
//------------------------------------------------------------------------
void Fast3DOjbect::AddPoint(double x, double y, double z)
{
	FastVector *newPoint = new FastVector();
	_points[_pointCount++] = newPoint;

	(*newPoint).X = x;
	(*newPoint).Y = y;
	(*newPoint).Z = z;
	(*newPoint).W = 1;

}


//------------------------------------------------------------------------
// AddPoint
//------------------------------------------------------------------------
void Fast3DOjbect::AddPoint(FastVector &point)
{
	FastVector *newPoint = new FastVector();
	_points[_pointCount++] = newPoint;
	(*newPoint) = point;
}



//------------------------------------------------------------------------
// WorldPoints - transform object points to world points
//------------------------------------------------------------------------
FastVector **Fast3DOjbect::WorldPoints()
{
	if (_worldPoints == NULL)
	{
		_worldPoints = new FastVector*[_pointCount + 1];
		for (int i = 0; i < _pointCount; i++)
		{
			_worldPoints[i] = new FastVector();
		}
	}
	for (int i = 0; i < _pointCount; i++)
	{
		(*_worldPoints[i]) = (_transformation * (*_points[i]));
	}
	_worldPoints[_pointCount] = 0;
	return _worldPoints;
}

//------------------------------------------------------------------------
// ClearTransformation
//------------------------------------------------------------------------
void Fast3DOjbect::ClearTransformation()
{
	_transformation = FastTransformMatrix::IdentityMatrix();
}

//------------------------------------------------------------------------
// AddTransformation
//------------------------------------------------------------------------
void Fast3DOjbect::AddTransformation(FastTransformMatrix transformMatrix)
{
	_transformation *= transformMatrix;
}

//------------------------------------------------------------------------
// SetTransformation
//------------------------------------------------------------------------
void Fast3DOjbect::SetTransformation(FastTransformMatrix transformMatrix)
{
	_transformation = transformMatrix;
}