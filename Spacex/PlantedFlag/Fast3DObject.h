// -----------------------------------------------------------------
// Copyright 2015 - Eric Jorgensen - www.ericjorgensen.com
// All individuals are granted permission to use this code for 
// any non-profit activities
// -----------------------------------------------------------------

#pragma once

//------------------------------------------------------------------------
// FastVector - 4 element Vector
//------------------------------------------------------------------------
class FastVector
{

public:
	static FastVector Zero;
	static int Count;
	double X, Y, Z, W;
	FastVector();
	~FastVector();
	FastVector(double x, double y, double z);
	FastVector(double x, double y, double z, double w);

	FastVector & operator=(const FastVector &v2);
	FastVector operator*(const double value);
	FastVector operator/(const double value);
	FastVector operator-(const FastVector &v2);
	FastVector operator+(const FastVector &v2);
	FastVector &operator-=(const FastVector &v2);
	FastVector &operator+=(const FastVector &v2);
	FastVector CrossWith(const FastVector &v2);

	char *ToString(int length);

	void Normalize();
	double GetLength();
	double GetDistance(const FastVector &v2);
};



//------------------------------------------------------------------------
// FastTransformMatrix - 4x4 transform matrix for 3D rendering
//------------------------------------------------------------------------
class FastTransformMatrix
{
public:
	static int Count;
	double A11, A12, A13, A14, A21, A22, A23, A24, A31, A32, A33, A34, A41, A42, A43, A44;

	FastTransformMatrix();
	FastTransformMatrix(const FastTransformMatrix & otherMatrix);
	~FastTransformMatrix();
	FastTransformMatrix  operator*(const FastTransformMatrix & otherMatrix);
	void operator*=(const FastTransformMatrix & otherMatrix);
	FastVector operator*(FastVector & vector);
	FastTransformMatrix operator=(const FastTransformMatrix & otherMatrix);
	char * ToString();

	static FastTransformMatrix IdentityMatrix();
	static FastTransformMatrix TranslateMatrix(double x, double y, double z);
	static FastTransformMatrix ScaleMatrix(double scale);
	static FastTransformMatrix RotateXMatrix(double theta);
	static FastTransformMatrix RotateYMatrix(double theta);
	static FastTransformMatrix RotateZMatrix(double theta);

};


//------------------------------------------------------------------------
// Fast3DOjbect - Object with a set of points and transforms
//------------------------------------------------------------------------
class Fast3DOjbect
{
	FastVector** _points;
	int _pointBufferSize;
	int _pointCount;
	FastTransformMatrix _transformation;
	FastVector **_worldPoints;
public:
	Fast3DOjbect();
	~Fast3DOjbect();

	void AddPoint(double x, double y, double z);
	void AddPoint(FastVector &point);
	FastVector **WorldPoints();

	void ClearTransformation();
	void AddTransformation(FastTransformMatrix transformMatrix);
	void SetTransformation(FastTransformMatrix transformMatrix);
};